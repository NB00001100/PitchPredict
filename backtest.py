"""Walk-forward backtest of the Dixon-Coles model against two baselines.

The governing rule: never report skill from data the model was fit on.

Design
    - The first `min_train_seasons` seasons are training only; every later match
      is a test match.
    - Test matches are grouped into calendar weeks running Tuesday 00:00 UTC to
      Monday 23:59 UTC (keeps a Friday-Monday round together). For each week:
      train = every match with kickoff strictly before the week's first test
      kickoff, ref_date = that kickoff, fit once, predict every match in the week.
    - Promoted teams (in this season, not in the previous one) are fit with a
      Gaussian prior of strength `shrink` towards the mean attack / defense of the
      three weakest recently-active established teams (shrinkage.py). Promoted
      teams with no rating at all (first week) get that centre directly.
    - Baselines on exactly the same matches: climatology (H/D/A rates of the
      week's training slice; the floor) and the closing market (multiplicative
      de-vig of closing average odds; the ceiling).

Usage:
    .venv/bin/python backtest.py                  # xi, shrink from model_config.json, else 0.0018, 0
    .venv/bin/python backtest.py --xi 0.0018 --shrink 10
    .venv/bin/python backtest.py --skip-early 5   # main tables exclude each team's first 5 matches
    .venv/bin/python backtest.py --self-test      # metric unit checks, no network
"""

import argparse
import json
import os
import sys
import time

import numpy as np
import pandas as pd

from shrinkage import RECENT_DAYS, clean_number, fit_with_promoted_prior, promoted_teams

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE_DIR = os.path.join(HERE, "backtest_cache")
REPORT_PATH = os.path.join(HERE, "backtest_report.md")
CONFIG_PATH = os.path.join(HERE, "model_config.json")
DEFAULT_XI = 0.0018
FULL_SEASON = 380
N_BOOT = 10_000
BOOT_SEED = 20260101
HEADLINE_SKIP = 5      # second headline line excludes each team's first 5 matches

OUTCOMES = ["H", "D", "A"]


# ---------------------------------------------------------------------- #
# Metrics. P is an (n, 3) array of [home, draw, away] probabilities,
# y an (n,) array of outcome indices (0 home, 1 draw, 2 away).
# Each returns per-match values; average them for the score.
# ---------------------------------------------------------------------- #
def one_hot(y):
    return np.eye(3)[np.asarray(y, dtype=int)]


def rps(P, y):
    """Ranked probability score, 0.5 * sum of squared cumulative differences."""
    P, O = np.asarray(P, dtype=float), one_hot(y)
    cp, co = np.cumsum(P, axis=1)[:, :2], np.cumsum(O, axis=1)[:, :2]
    return 0.5 * np.sum((cp - co) ** 2, axis=1)


def log_loss(P, y):
    P = np.asarray(P, dtype=float)
    return -np.log(P[np.arange(len(P)), np.asarray(y, dtype=int)])


def brier(P, y):
    """Multiclass Brier: sum over the three outcomes of squared error."""
    return np.sum((np.asarray(P, dtype=float) - one_hot(y)) ** 2, axis=1)


def accuracy(P, y):
    return (np.argmax(np.asarray(P), axis=1) == np.asarray(y)).astype(float)


def devig(odds):
    """Multiplicative de-vig: q_i = 1/odds_i, p_i = q_i / sum(q)."""
    q = 1.0 / np.asarray(odds, dtype=float)
    return q / q.sum(axis=1, keepdims=True)


def week_start(dates):
    """Tuesday 00:00 UTC that opens the Tue-Mon week containing each date."""
    d = pd.to_datetime(dates, utc=True).dt.normalize()
    return d - pd.to_timedelta((d.dt.weekday - 1) % 7, unit="D")


def paired_bootstrap(diff, n_boot=N_BOOT, seed=BOOT_SEED, chunk=1000):
    """Mean of `diff` and its percentile 95% CI from resampling matches with replacement."""
    diff = np.asarray(diff, dtype=float)
    rng = np.random.default_rng(seed)
    n = len(diff)
    means = np.empty(n_boot)
    for start in range(0, n_boot, chunk):          # chunks keep memory small
        k = min(chunk, n_boot - start)
        means[start:start + k] = diff[rng.integers(0, n, size=(k, n))].mean(axis=1)
    lo, hi = np.percentile(means, [2.5, 97.5])
    return float(diff.mean()), float(lo), float(hi)


def self_test():
    p = [[0.5, 0.3, 0.2]]
    checks = [
        (rps(p, [0]), 0.145), (rps(p, [1]), 0.145), (rps(p, [2]), 0.445),
        (brier(p, [0]), 0.38), (log_loss(p, [0]), 0.693147),
        # uniform: home RPS = 0.5*((2/3)^2 + (1/3)^2) = 5/18; draw = 0.5*(1/9+1/9) = 1/9
        (rps([[1 / 3] * 3], [0]), 5 / 18), (rps([[1 / 3] * 3], [1]), 1 / 9),
        (brier([[1 / 3] * 3], [2]), 2 / 3), (log_loss([[1 / 3] * 3], [1]), np.log(3)),
        # p=(0.6,0.25,0.15), away: RPS 0.5*(0.36+0.7225)=0.54125, Brier 0.36+0.0625+0.7225=1.145
        (rps([[0.6, 0.25, 0.15]], [2]), 0.54125), (brier([[0.6, 0.25, 0.15]], [2]), 1.145),
        (log_loss([[0.6, 0.25, 0.15]], [2]), 1.897120),
        (accuracy([[0.5, 0.3, 0.2], [0.2, 0.3, 0.5]], [0, 0]), [1.0, 0.0]),
        (devig([[2.0, 4.0, 4.0]]), [[0.5, 0.25, 0.25]]),
        # odds 1.5/4/6: q = 2/3, 1/4, 1/6, sum 13/12 -> 8/13, 3/13, 2/13
        (devig([[1.5, 4.0, 6.0]]), [[8 / 13, 3 / 13, 2 / 13]]),
    ]
    for k, (got, want) in enumerate(checks):
        assert np.allclose(got, want, atol=1e-6), f"check {k}: got {got}, want {want}"
    # Tue-Mon weeks: Fri 2024-08-16 and Mon 2024-08-19 share a week; Tue 2024-08-20 starts a new one.
    ws = week_start(pd.Series(pd.to_datetime(
        ["2024-08-16 19:00", "2024-08-19 20:00", "2024-08-20 00:00", "2024-08-13 00:00"], utc=True)))
    assert ws[0] == ws[1] == ws[3] == pd.Timestamp("2024-08-13", tz="UTC"), ws
    assert ws[2] == pd.Timestamp("2024-08-20", tz="UTC"), ws
    # Bootstrap of a constant is that constant.
    assert np.allclose(paired_bootstrap(np.full(50, 0.01), n_boot=200), 0.01)
    print(f"self-test: {len(checks) + 3} checks passed")


# ---------------------------------------------------------------------- #
# Walk-forward
# ---------------------------------------------------------------------- #
def outcome_index(df):
    return np.select([df["home_goals"] > df["away_goals"], df["home_goals"] == df["away_goals"]],
                     [0, 1], 2)


def prior_matches_in_season(df):
    """For each match, how many league matches each side had played earlier that season."""
    long = pd.concat([
        pd.DataFrame({"row": df.index, "season": df["season"], "team": df["home_team"],
                      "date": df["date"], "side": "home"}),
        pd.DataFrame({"row": df.index, "season": df["season"], "team": df["away_team"],
                      "date": df["date"], "side": "away"}),
    ]).sort_values(["date", "row"])
    long["n_prior"] = long.groupby(["season", "team"]).cumcount()
    wide = long.pivot(index="row", columns="side", values="n_prior")
    return wide["home"].reindex(df.index).to_numpy(), wide["away"].reindex(df.index).to_numpy()


def run_walk_forward(df, xi, shrink=0.0, min_train_seasons=2, skip_early=0, test_seasons=None):
    """One row per test match with model, climatology and market probabilities.

    `df` is load_matches() output. Rows with scored=False (either side had played
    fewer than `skip_early` league matches that season) are still predicted but
    should be excluded from scoring; score_frame() does that. `test_seasons`
    overrides the default (every season after the first `min_train_seasons`);
    training always uses every match before the block, whatever its season.
    """
    df = df.sort_values(["date", "id"]).reset_index(drop=True)
    seasons = sorted(df["season"].unique())
    if test_seasons is None:
        test_seasons = seasons[min_train_seasons:]
    promoted_by_season = {s: promoted_teams(df, s) for s in test_seasons}
    y_all = outcome_index(df)
    home_prior, away_prior = prior_matches_in_season(df)

    is_test = df["season"].isin(test_seasons).to_numpy()
    blocks = week_start(df["date"])
    rows = []
    for block_no, (wk, idx) in enumerate(df[is_test].groupby(blocks[is_test]).groups.items()):
        test = df.loc[idx]
        ref_date = test["date"].min()
        train = df[df["date"] < ref_date]
        assert train["date"].max() < test["date"].min(), f"leak in block {wk}"

        (season,) = test["season"].unique()            # a Tue-Mon week never spans two seasons
        promoted = promoted_by_season[season]
        model = fit_with_promoted_prior(train, ref_date, xi, shrink, promoted)
        teams = set(test["home_team"]) | set(test["away_team"])
        unrated = sorted(t for t in teams if t not in model.attack)
        assert not unrated, f"unrated non-promoted team(s) {unrated} in block {wk}"
        # Teams in the training data but not recently active keep their old (stale) rating
        # (shrunk towards the prior centre if promoted and shrink > 0).
        recent = train[train["date"] >= ref_date - pd.Timedelta(days=RECENT_DAYS)]
        active = set(recent["home_team"]) | set(recent["away_team"])
        fallback = model.fallback_teams

        clim = np.bincount(y_all[train.index], minlength=3) / len(train)
        for i, m in test.iterrows():
            pred = model.predict(m["home_team"], m["away_team"])
            hg, ag = np.unravel_index(np.argmax(pred["score_matrix"]), pred["score_matrix"].shape)
            rows.append({
                "id": m["id"], "season": m["season"], "date": m["date"],
                "home_team": m["home_team"], "away_team": m["away_team"],
                "home_goals": m["home_goals"], "away_goals": m["away_goals"],
                "result": OUTCOMES[y_all[i]], "y": int(y_all[i]),
                "p_home": pred["home_win"], "p_draw": pred["draw"], "p_away": pred["away_win"],
                "clim_home": clim[0], "clim_draw": clim[1], "clim_away": clim[2],
                "odds_home": m["odds_home"], "odds_draw": m["odds_draw"], "odds_away": m["odds_away"],
                "fallback": m["home_team"] in fallback or m["away_team"] in fallback,
                "fallback_teams": ";".join(sorted({m["home_team"], m["away_team"]} & fallback)),
                "stale_rating": any(t not in fallback and t not in active
                                    for t in (m["home_team"], m["away_team"])),
                "promoted": m["home_team"] in promoted or m["away_team"] in promoted,
                "promoted_teams": ";".join(sorted({m["home_team"], m["away_team"]} & promoted)),
                "exp_home_goals": pred["exp_home_goals"], "exp_away_goals": pred["exp_away_goals"],
                "modal_score": f"{hg}-{ag}",
                "home_prior": int(home_prior[i]), "away_prior": int(away_prior[i]),
                "block": block_no, "block_start": wk, "n_train": len(train),
                "fit_converged": model.converged,
            })

    out = pd.DataFrame(rows)
    mk = devig(out[["odds_home", "odds_draw", "odds_away"]].to_numpy())
    out["mkt_home"], out["mkt_draw"], out["mkt_away"] = mk[:, 0], mk[:, 1], mk[:, 2]
    out["scored"] = np.minimum(out["home_prior"], out["away_prior"]) >= skip_early
    return out


# ---------------------------------------------------------------------- #
# Scoring and report
# ---------------------------------------------------------------------- #
FORECASTERS = {"model": ["p_home", "p_draw", "p_away"],
               "climatology": ["clim_home", "clim_draw", "clim_away"],
               "market": ["mkt_home", "mkt_draw", "mkt_away"]}


def score_frame(preds, skip_early=None):
    """Restrict to scored matches (or re-filter with a given skip_early)."""
    if skip_early is None:
        return preds[preds["scored"]]
    return preds[np.minimum(preds["home_prior"], preds["away_prior"]) >= skip_early]


def per_match_rps(preds):
    return {name: rps(preds[cols].to_numpy(), preds["y"].to_numpy())
            for name, cols in FORECASTERS.items()}


def summarise(preds):
    """Mean RPS / log loss / Brier / accuracy for each forecaster on these matches."""
    y = preds["y"].to_numpy()
    out = {"n": len(preds)}
    for name, cols in FORECASTERS.items():
        P = preds[cols].to_numpy()
        out[name] = {"rps": rps(P, y).mean(), "log_loss": log_loss(P, y).mean(),
                     "brier": brier(P, y).mean(), "accuracy": accuracy(P, y).mean()}
    out["skill_vs_clim"] = 1 - out["model"]["rps"] / out["climatology"]["rps"]
    out["skill_vs_market"] = 1 - out["model"]["rps"] / out["market"]["rps"]
    return out


def season_label(season, n_in_data):
    short = f"{season[2:4]}/{season[7:9]}" if len(season) == 9 else season
    return f"20{short} (partial, {n_in_data} matches)" if n_in_data < FULL_SEASON else f"20{short}"


def groups(preds, all_matches):
    """[(label, frame)] for overall then each test season."""
    counts = all_matches["season"].value_counts()
    out = [("Overall", preds)]
    for s in sorted(preds["season"].unique()):
        out.append((season_label(s, int(counts[s])), preds[preds["season"] == s]))
    return out


def fmt(x):
    return f"{x:.4f}"


def ci_text(mean, lo, hi):
    side = "excludes zero" if lo > 0 or hi < 0 else "includes zero"
    return f"{mean:+.4f} [{lo:+.4f}, {hi:+.4f}] ({side})"


def headline_table(preds):
    """Markdown table: model vs both baselines, all matches and skip_early=5."""
    lines = ["| Matches scored | n | RPS model | RPS climatology | RPS market | "
             "Skill vs climatology | Skill vs market |",
             "|---|---:|---:|---:|---:|---:|---:|"]
    for label, k in (("All test matches", 0),
                     (f"Excluding each team's first {HEADLINE_SKIP} matches of a season", HEADLINE_SKIP)):
        s = summarise(score_frame(preds, k))
        lines.append(f"| {label} | {s['n']} | {fmt(s['model']['rps'])} | "
                     f"{fmt(s['climatology']['rps'])} | {fmt(s['market']['rps'])} | "
                     f"{fmt(s['skill_vs_clim'])} | {fmt(s['skill_vs_market'])} |")
    return "\n".join(lines)


def verdict(s, ci_mkt, ci_clim):
    """Plain statement of where the model landed, generated from the numbers."""
    m, c, k = s["model"]["rps"], s["climatology"]["rps"], s["market"]["rps"]
    if k <= m <= c:
        where = "between the two baselines, as expected"
        gap = (m - k) / (c - k)
        where += (f"; it closes {1 - gap:.0%} of the gap from climatology to the market "
                  f"(RPS {fmt(c)} -> {fmt(m)}, market {fmt(k)})")
    elif m < k:
        where = (f"better than the closing market (RPS {fmt(m)} vs {fmt(k)}), which was NOT "
                 "expected and should be treated as a probable harness bug until explained")
    else:
        where = (f"worse than climatology (RPS {fmt(m)} vs {fmt(c)}): the model does not beat "
                 "the floor, which misses the expectation")
    return (f"Overall, the model landed {where}. "
            f"Model minus market RPS: {ci_text(*ci_mkt)}. "
            f"Model minus climatology RPS: {ci_text(*ci_clim)}.")


def build_report(preds, all_matches, xi, runtime_s, skip_early=0, xi_section=None,
                 shrink=0.0, shrink_section=None):
    """Return the report as markdown. `xi_section` (from optimize.py) and `shrink_section`
    (from shrinkage_section()) are optional extra markdown."""
    scored = score_frame(preds)
    blocks = preds.drop_duplicates("block")
    n_blocks, n_nonconv = len(blocks), int((~blocks["fit_converged"]).sum())
    fb = preds[preds["fallback"]]
    stale = preds[preds["stale_rating"]]
    g_all = groups(scored, all_matches)

    L = [f"# Dixon-Coles walk-forward backtest (xi = {xi}, shrink = {shrink})", ""]
    L += ["**Expectation, stated before the results.** The model should land between the two "
          "baselines: clearly better than climatology (always predicting the historical "
          "home/draw/away rates) and close to, but not better than, the closing betting market, "
          "which aggregates far more information (team news, injuries, lineups). Beating the "
          "closing line is not expected. What actually happened is reported below as measured.", ""]

    s0 = summarise(scored)
    d = per_match_rps(scored)
    ci_m = paired_bootstrap(d["model"] - d["market"])
    ci_c = paired_bootstrap(d["model"] - d["climatology"])
    L += ["## Headline", "", headline_table(preds), "",
          "Lower RPS is better. Skill = 1 - RPS_model / RPS_baseline (positive = model better).", "",
          verdict(s0, ci_m, ci_c), ""]
    if skip_early:
        L += [f"Note: the detailed tables below exclude matches where either team had played "
              f"fewer than {skip_early} league matches that season (`--skip-early {skip_early}`).", ""]

    L += ["## How the test works", "",
          f"- Data: {len(all_matches)} played Premier League matches, seasons "
          f"{', '.join(sorted(all_matches['season'].unique()))}.",
          "- The first two seasons are training only. Every later match is a test match "
          f"({len(preds)} matches).",
          "- Test matches are grouped into Tuesday-Monday weeks (UTC). For each week the model is "
          "fit on every match that kicked off strictly before the week's first kickoff, with time "
          "decay measured from that kickoff, and then predicts every match in the week. No result "
          "from the test week or later is ever used (asserted in code for every week).",
          f"- Time-decay rate xi = {xi} per day (a match d days old gets weight exp(-xi*d)).",
          f"- Promoted-team shrinkage strength shrink = {shrink} (0 = none; see the "
          "promoted-team shrinkage section).",
          "- Climatology baseline: home/draw/away frequencies of that week's training data.",
          "- Market baseline: closing average odds, de-vigged multiplicatively (p_i = (1/odds_i) / sum_j(1/odds_j)).",
          "- Metrics: RPS (ranked probability score, primary; respects the ordering home > draw > away), "
          "log loss (-ln of the probability given to what happened), multiclass Brier (sum of squared "
          "errors over the three outcomes), accuracy (most likely outcome was right; a sanity check only).",
          ""]

    L += ["## Fit diagnostics", "",
          f"- Weekly blocks (= model fits): {n_blocks}",
          f"- Fits that did not report convergence: {n_nonconv}"
          + (f" (blocks starting {', '.join(str(b.date()) for b in blocks.loc[~blocks['fit_converged'], 'block_start'])})"
             if n_nonconv else ""),
          f"- Test matches where at least one promoted team had no rating at all and got the prior "
          f"centre (mean of the three weakest recently-active established teams): {len(fb)}"
          + (f" (unrated teams: {', '.join(sorted(set(';'.join(fb['fallback_teams']).split(';'))))})"
             if len(fb) else ""),
          f"- Test matches where a team's rating came only from matches more than {RECENT_DAYS} days "
          f"old (a promoted side that was last in the league seasons ago keeps that old rating): {len(stale)}",
          ""]

    L += ["## Results by season", "",
          "| Season | n | Forecaster | RPS | Log loss | Brier | Accuracy |",
          "|---|---:|---|---:|---:|---:|---:|"]
    for label, g in g_all:
        s = summarise(g)
        for name in FORECASTERS:
            r = s[name]
            L.append(f"| {label} | {s['n']} | {name} | {fmt(r['rps'])} | {fmt(r['log_loss'])} | "
                     f"{fmt(r['brier'])} | {fmt(r['accuracy'])} |")
    L += ["", "| Season | n | Skill vs climatology | Skill vs market |", "|---|---:|---:|---:|"]
    for label, g in g_all:
        s = summarise(g)
        L.append(f"| {label} | {s['n']} | {fmt(s['skill_vs_clim'])} | {fmt(s['skill_vs_market'])} |")

    L += ["", "## Paired bootstrap 95% confidence intervals", "",
          f"Difference in mean RPS, resampling test matches with replacement ({N_BOOT:,} resamples, "
          f"seed {BOOT_SEED}). Negative = model better. An interval that excludes zero means the "
          "difference is unlikely to be resampling noise.", "",
          "| Season | n | RPS(model) - RPS(market) | RPS(model) - RPS(climatology) |",
          "|---|---:|---|---|"]
    for label, g in g_all:
        d = per_match_rps(g)
        L.append(f"| {label} | {len(g)} | {ci_text(*paired_bootstrap(d['model'] - d['market']))} | "
                 f"{ci_text(*paired_bootstrap(d['model'] - d['climatology']))} |")

    early = preds[np.minimum(preds["home_prior"], preds["away_prior"]) < HEADLINE_SKIP]
    if len(early):
        se = summarise(early)
        L += ["", "## Early-season matches", "",
              f"Matches where either team had played fewer than {HEADLINE_SKIP} league matches that "
              f"season: {se['n']}. RPS model {fmt(se['model']['rps'])}, climatology "
              f"{fmt(se['climatology']['rps'])}, market {fmt(se['market']['rps'])}. "
              f"Largest model probability given to any outcome in these matches: "
              f"{early[FORECASTERS['model']].to_numpy().max():.3f} "
              f"(market: {early[FORECASTERS['market']].to_numpy().max():.3f})."]
        # A promoted side's rating after one or two matches rests on almost no data, and the
        # maximum-likelihood fit can push it towards the rating bounds (e.g. a team that has
        # not conceded yet). Show the most extreme such predictions rather than hide them.
        P = preds[FORECASTERS["model"]].to_numpy()
        extreme = preds[P.min(axis=1) < 0.01]
        n_mkt = int((preds[FORECASTERS["market"]].to_numpy().min(axis=1) < 0.01).sum())
        L += ["", f"Test matches where the model gave some outcome under 1% probability: {len(extreme)} "
              f"({int((np.minimum(extreme['home_prior'], extreme['away_prior']) < HEADLINE_SKIP).sum())} "
              f"of them early-season); the market did so in {n_mkt}."]
        if len(extreme):
            ll = log_loss(extreme[FORECASTERS["model"]].to_numpy(), extreme["y"].to_numpy())
            L += ["", "| Date | Home | Away | Prior matches (H/A) | Model H/D/A | Market H/D/A | Result | Model log loss |",
                  "|---|---|---|---|---|---|---|---:|"]
            for (_, r), l in zip(extreme.iterrows(), ll):
                L.append(f"| {pd.Timestamp(r['date']).date()} | {r['home_team']} | {r['away_team']} | "
                         f"{r['home_prior']}/{r['away_prior']} | "
                         f"{r['p_home']:.3f}/{r['p_draw']:.3f}/{r['p_away']:.3f} | "
                         f"{r['mkt_home']:.3f}/{r['mkt_draw']:.3f}/{r['mkt_away']:.3f} | {r['result']} | {l:.4f} |")

    if shrink_section:
        L += ["", shrink_section.rstrip()]
    if xi_section:
        L += ["", xi_section.rstrip()]

    L += ["", "---", f"Runtime of the walk-forward at this xi and shrink: {runtime_s:.1f} s. "
          f"Per-match predictions: `backtest_cache/{preds_name(xi, shrink)}`.", ""]
    return "\n".join(L)


MODEL_COLS = FORECASTERS["model"]


def extreme_matches(preds):
    """Rows where the model gave some outcome under 1%."""
    return preds[preds[MODEL_COLS].to_numpy().min(axis=1) < 0.01]


def shrinkage_section(before, after, xi, shrink):
    """Markdown comparing shrink = 0 (`before`) with the chosen shrink (`after`), same xi."""
    b = score_frame(before).set_index("id")
    a = score_frame(after).set_index("id").loc[b.index]
    yb, ya = b["y"].to_numpy(), a["y"].to_numpy()
    assert (yb == ya).all()

    def compare(mask, label):
        Pb, Pa, y = b.loc[mask, MODEL_COLS].to_numpy(), a.loc[mask, MODEL_COLS].to_numpy(), yb[mask]
        rows = [f"| {label}: shrink = 0 | {mask.sum()} | {fmt(rps(Pb, y).mean())} | "
                f"{fmt(log_loss(Pb, y).mean())} | {fmt(brier(Pb, y).mean())} |",
                f"| {label}: shrink = {shrink} | {mask.sum()} | {fmt(rps(Pa, y).mean())} | "
                f"{fmt(log_loss(Pa, y).mean())} | {fmt(brier(Pa, y).mean())} |"]
        ci_r = paired_bootstrap(rps(Pa, y) - rps(Pb, y))
        ci_l = paired_bootstrap(log_loss(Pa, y) - log_loss(Pb, y))
        return rows, (f"{label} ({mask.sum()} matches), after minus before: "
                      f"RPS {ci_text(*ci_r)}; log loss {ci_text(*ci_l)}.")

    everything = np.ones(len(b), dtype=bool)
    promo = b["promoted"].to_numpy()
    r1, c1 = compare(everything, "All test matches")
    r2, c2 = compare(promo, "Matches involving a promoted team")

    L = ["## Promoted-team shrinkage", "",
         "Plain maximum likelihood has nothing pulling a newly promoted team's rating towards "
         "anything, so after a handful of matches it can run away (a team that has not scored "
         "yet heads for the lower rating bound and the model then gives its opponents 99%+). "
         "The fix: each week, the model is first fit as before; the mean attack and defense of "
         "the three weakest established teams (recently active, not promoted this season) "
         "becomes a prior centre; the model is refit with a Gaussian penalty of strength "
         f"shrink = {shrink} pulling each team promoted this season towards that centre. "
         f"shrink = k is roughly worth k goals of evidence at the centre, so it dominates in "
         "the first weeks and fades as the team's own matches accumulate. Promoted teams "
         "with no matches in the data at all get the centre itself, as before. Teams are "
         "promoted for the whole of the season they come up and unpenalised after that.", "",
         f"Same xi = {xi}, same weeks, same test matches; only the shrinkage differs. "
         "Model metrics only (the baselines do not change).", "",
         "| Matches | n | RPS | Log loss | Brier |", "|---|---:|---:|---:|---:|"] + r1 + r2
    L += ["", "Paired bootstrap 95% CIs (negative = shrinkage better):", "", f"- {c1}", f"- {c2}"]

    eb, ea = extreme_matches(b), extreme_matches(a)
    llb, lla = log_loss(b[MODEL_COLS].to_numpy(), yb), log_loss(a[MODEL_COLS].to_numpy(), ya)
    wb, wa = int(np.argmax(llb)), int(np.argmax(lla))
    L += ["", f"Test matches where the model put under 1% on some outcome: {len(eb)} with "
          f"shrink = 0, {len(ea)} with shrink = {shrink}.",
          f"Worst single-match log loss: {llb[wb]:.4f} with shrink = 0 "
          f"({b.iloc[wb]['home_team']} v {b.iloc[wb]['away_team']}, {pd.Timestamp(b.iloc[wb]['date']).date()}), "
          f"{lla[wa]:.4f} with shrink = {shrink} "
          f"({a.iloc[wa]['home_team']} v {a.iloc[wa]['away_team']}, {pd.Timestamp(a.iloc[wa]['date']).date()})."]
    if len(eb):
        L += ["", "The under-1% matches at shrink = 0, with their probabilities after the fix:", "",
              "| Date | Home | Away | Result | Before H/D/A | After H/D/A | Market H/D/A | "
              "Log loss before | Log loss after |", "|---|---|---|---|---|---|---|---:|---:|"]
        for mid in eb.index:
            r, q = b.loc[mid], a.loc[mid]
            k = b.index.get_loc(mid)
            L.append(f"| {pd.Timestamp(r['date']).date()} | {r['home_team']} | {r['away_team']} | "
                     f"{r['result']} | {r['p_home']:.3f}/{r['p_draw']:.3f}/{r['p_away']:.3f} | "
                     f"{q['p_home']:.3f}/{q['p_draw']:.3f}/{q['p_away']:.3f} | "
                     f"{r['mkt_home']:.3f}/{r['mkt_draw']:.3f}/{r['mkt_away']:.3f} | "
                     f"{llb[k]:.4f} | {lla[k]:.4f} |")
    new = ea.index.difference(eb.index)
    if len(new):
        L += ["", f"Matches under 1% only after the fix: {len(new)} ("
              + "; ".join(f"{a.loc[i, 'home_team']} v {a.loc[i, 'away_team']} "
                          f"{pd.Timestamp(a.loc[i, 'date']).date()}" for i in new) + ")."]
    return "\n".join(L)


def market_climatology_crosscheck(preds):
    """Per-season market / climatology RPS on all test matches, for comparing with independent numbers."""
    expected = {"2023-2024": 0.181, "2024-2025": 0.196, "2025-2026": 0.205}
    lines = []
    for s, g in preds.groupby("season"):
        r = summarise(g)
        exp = expected.get(s)
        note = f" (expected ~{exp}, diff {r['market']['rps'] - exp:+.4f})" if exp else ""
        lines.append(f"  {s}: market RPS {r['market']['rps']:.4f}{note}; "
                     f"climatology RPS {r['climatology']['rps']:.4f}")
    return "\n".join(lines)


def preds_name(xi, shrink):
    return f"preds_xi{xi}_shrink{clean_number(shrink)}.csv"


def save_preds(preds, xi, shrink=0.0):
    os.makedirs(CACHE_DIR, exist_ok=True)
    path = os.path.join(CACHE_DIR, preds_name(xi, shrink))
    preds.to_csv(path, index=False)
    return path


def load_config():
    """(xi, shrink) from model_config.json, else (DEFAULT_XI, 0)."""
    if os.path.exists(CONFIG_PATH):
        with open(CONFIG_PATH) as f:
            cfg = json.load(f)
        return float(cfg["xi"]), clean_number(cfg.get("shrink", 0))
    return DEFAULT_XI, 0


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--xi", type=float, default=None)
    ap.add_argument("--shrink", type=float, default=None)
    ap.add_argument("--skip-early", type=int, default=0)
    ap.add_argument("--self-test", action="store_true")
    args = ap.parse_args()

    if args.self_test:
        self_test()
        return

    from db import load_matches
    cfg_xi, cfg_shrink = load_config()
    xi = cfg_xi if args.xi is None else args.xi
    shrink = cfg_shrink if args.shrink is None else clean_number(args.shrink)
    matches = load_matches()
    print(f"loaded {len(matches)} matches; xi = {xi}, shrink = {shrink}")

    t0 = time.time()
    preds = run_walk_forward(matches, xi, shrink=shrink, skip_early=args.skip_early)
    runtime = time.time() - t0
    path = save_preds(preds, xi, shrink)

    section = None
    if shrink > 0:
        before = run_walk_forward(matches, xi, shrink=0, skip_early=args.skip_early)
        save_preds(before, xi, 0)
        section = shrinkage_section(before, preds, xi, shrink)
    report = build_report(preds, matches, xi, runtime, skip_early=args.skip_early,
                          shrink=shrink, shrink_section=section)
    with open(REPORT_PATH, "w") as f:
        f.write(report)

    print(headline_table(preds))
    blocks = preds.drop_duplicates("block")
    print(f"blocks/fits: {len(blocks)}  non-converged: {int((~blocks['fit_converged']).sum())}  "
          f"fallback matches: {int(preds['fallback'].sum())}  "
          f"stale-rating matches: {int(preds['stale_rating'].sum())}  runtime: {runtime:.1f} s")
    print("cross-check (all test matches):")
    print(market_climatology_crosscheck(preds))
    print(f"wrote {REPORT_PATH} and {path}")


if __name__ == "__main__":
    sys.exit(main())
