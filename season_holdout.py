"""Compare the model's predictions for every played match of one season with what happened.

Two modes, printed one after the other:
    frozen  fit once on all matches before the season's first kickoff (ref_date =
            that kickoff) and predict every match of the season with that one fit.
    weekly  the walk-forward predictions for the season (backtest.run_walk_forward
            with only this season as test: refit each Tue-Mon week on everything
            before it, earlier matches of the same season included).

Both use the promoted-team shrinkage from shrinkage.py. The market is the de-vigged
closing average; climatology is the home/draw/away rates of all matches before the
season's first kickoff (the same in both modes).

Usage:
    .venv/bin/python season_holdout.py                         # latest season, config xi/shrink
    .venv/bin/python season_holdout.py --season 2025-2026 --xi 0.003 --shrink 0
"""

import argparse

import numpy as np
import pandas as pd

from backtest import (OUTCOMES, devig, load_config, log_loss, outcome_index, rps,
                      run_walk_forward)
from db import load_matches
from shrinkage import clean_number, fit_with_promoted_prior, promoted_teams

MODEL = ["p_home", "p_draw", "p_away"]
MARKET = ["mkt_home", "mkt_draw", "mkt_away"]


def frozen_predictions(df, season, xi, shrink):
    """One fit at the season's first kickoff; predictions for every match of the season."""
    test = df[df["season"] == season]
    ref_date = test["date"].min()
    train = df[df["date"] < ref_date]
    model = fit_with_promoted_prior(train, ref_date, xi, shrink, promoted_teams(df, season))
    y = outcome_index(test)
    rows = []
    for (_, m), yi in zip(test.iterrows(), y):
        p = model.predict(m["home_team"], m["away_team"])
        hg, ag = np.unravel_index(np.argmax(p["score_matrix"]), p["score_matrix"].shape)
        rows.append({"date": m["date"], "home_team": m["home_team"], "away_team": m["away_team"],
                     "home_goals": m["home_goals"], "away_goals": m["away_goals"],
                     "y": int(yi), "result": OUTCOMES[yi],
                     "p_home": p["home_win"], "p_draw": p["draw"], "p_away": p["away_win"],
                     "exp_home_goals": p["exp_home_goals"], "exp_away_goals": p["exp_away_goals"],
                     "modal_score": f"{hg}-{ag}",
                     "odds_home": m["odds_home"], "odds_draw": m["odds_draw"],
                     "odds_away": m["odds_away"]})
    out = pd.DataFrame(rows)
    mk = devig(out[["odds_home", "odds_draw", "odds_away"]].to_numpy())
    out["mkt_home"], out["mkt_draw"], out["mkt_away"] = mk[:, 0], mk[:, 1], mk[:, 2]
    return out, model


def weekly_predictions(df, season, xi, shrink):
    return run_walk_forward(df, xi, shrink=shrink, test_seasons=[season])


def report(preds, clim, label):
    y = preds["y"].to_numpy()
    n = len(preds)
    P, M = preds[MODEL].to_numpy(), preds[MARKET].to_numpy()
    C = np.tile(clim, (n, 1))
    pick, mpick = P.argmax(axis=1), M.argmax(axis=1)
    actual_score = preds["home_goals"].astype(str) + "-" + preds["away_goals"].astype(str)
    exact = int((preds["modal_score"] == actual_score).sum())
    pred_goals = float((preds["exp_home_goals"] + preds["exp_away_goals"]).sum())
    goals = int((preds["home_goals"] + preds["away_goals"]).sum())

    print(f"\n=== {label} ===")
    print(f"correct picks: model {int((pick == y).sum())}/{n}, market {int((mpick == y).sum())}/{n}")
    for name, Q in (("model", P), ("market", M), ("climatology", C)):
        print(f"  {name:<12} RPS {rps(Q, y).mean():.4f}  log loss {log_loss(Q, y).mean():.4f}")
    print(f"total goals: predicted {pred_goals:.1f}, actual {goals}")
    print(f"exact scorelines (modal cell of score_matrix): {exact}/{n}")
    print(f"draws: {int((y == 1).sum())} occurred, model picked {int((pick == 1).sum())}")
    print(f"climatology base rates H/D/A: {clim[0]:.3f}/{clim[1]:.3f}/{clim[2]:.3f}")

    print(f"\n  {'date':<10} {'home':<15} {'away':<15} {'p_H':>5} {'p_D':>5} {'p_A':>5} "
          f"{'pick':>4} {'modal':>5} {'score':>5} {'res':>3} {'hit':>3}")
    for k, r in enumerate(preds.itertuples(index=False)):
        print(f"  {pd.Timestamp(r.date):%Y-%m-%d} {r.home_team:<15} {r.away_team:<15} "
              f"{r.p_home:5.3f} {r.p_draw:5.3f} {r.p_away:5.3f} {OUTCOMES[pick[k]]:>4} "
              f"{r.modal_score:>5} {actual_score.iloc[k]:>5} {r.result:>3} "
              f"{'yes' if pick[k] == y[k] else '':>3}")


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--season", default=None, help="e.g. 2026-2027 (default: latest in data)")
    ap.add_argument("--xi", type=float, default=None)
    ap.add_argument("--shrink", type=float, default=None)
    args = ap.parse_args()

    cfg_xi, cfg_shrink = load_config()
    xi = cfg_xi if args.xi is None else args.xi
    shrink = cfg_shrink if args.shrink is None else clean_number(args.shrink)

    df = load_matches()
    season = args.season or sorted(df["season"].unique())[-1]
    first = df.loc[df["season"] == season, "date"].min()
    pre = df[df["date"] < first]
    clim = np.bincount(outcome_index(pre), minlength=3) / len(pre)
    print(f"season {season}: {int((df['season'] == season).sum())} played matches; xi = {xi}, "
          f"shrink = {shrink}; promoted: {', '.join(sorted(promoted_teams(df, season)))}")

    frozen, model = frozen_predictions(df, season, xi, shrink)
    print(f"frozen fit at {first:%Y-%m-%d %H:%M} UTC: prior centre attack {model.prior_centre[0]:+.3f}, "
          f"defense {model.prior_centre[1]:+.3f}; shrunk in fit: {sorted(model.prior_teams) or 'none'}; "
          f"set to centre (no data): {sorted(model.fallback_teams) or 'none'}")
    report(frozen, clim, f"frozen (one fit before the season, xi={xi}, shrink={shrink})")
    report(weekly_predictions(df, season, xi, shrink), clim,
           f"weekly (walk-forward refit each Tue-Mon week, xi={xi}, shrink={shrink})")


if __name__ == "__main__":
    main()
