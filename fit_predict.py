"""Fit Dixon-Coles on all played matches, predict the upcoming fixtures, store forecasts.

Usage:
    .venv/bin/python fit_predict.py              # fit, check, predict, write to predictions
    .venv/bin/python fit_predict.py --dry-run    # everything except the write
    .venv/bin/python fit_predict.py --days 10    # widen the window (default 8 days)

"Upcoming" is date-driven: every SCHEDULED/TIMED fixture of the current season kicking
off within the next --days days, whatever its matchweek, each stored with its own
matchweek. A postponed fixture from an old matchweek therefore cannot hold the
predictions back. No fixtures in the window (an international break) is not an error.

Teams promoted this season are fit with the shrinkage prior from shrinkage.py
(strength `shrink` from model_config.json; 0 = plain fit).

refresh.py runs this after refreshing current_fixtures and matches; run standalone,
the caller is assumed to have refreshed them first.
"""

import argparse
import json
import os
import sys
from datetime import datetime, timezone

import numpy as np

import pandas as pd

from db import DEFAULT_DAYS, get_client, load_all_fixtures, load_matches, select_upcoming
from seasons import CURRENT_SEASON, PREVIOUS_SEASON
from shrinkage import clean_number, fit_with_promoted_prior
from teams import check_team_names, promoted_model_names, to_model_name

DEFAULT_XI = 0.0018
CONFIG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "model_config.json")
TABLE = "predictions"


def load_params():
    """(xi, shrink) from model_config.json, else (DEFAULT_XI, 0)."""
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE) as f:
            cfg = json.load(f)
        xi, shrink = float(cfg["xi"]), clean_number(cfg.get("shrink", 0))
        print(f"xi = {xi}, shrink = {shrink} (from model_config.json)")
    else:
        xi, shrink = DEFAULT_XI, 0
        print(f"xi = {xi}, shrink = {shrink} (defaults; model_config.json not found)")
    return xi, shrink


def print_shrinkage(model, promoted, shrink):
    """Prior centre and the promoted teams' ratings before and after shrinkage."""
    c = model.prior_centre
    print(f"\nPromoted in {CURRENT_SEASON}: {', '.join(sorted(promoted))}; shrink = {shrink}")
    print(f"  prior centre: attack {c[0]:+.3f}, defense {c[1]:+.3f} "
          f"(mean of the three weakest established teams: {', '.join(model.prior_basis)})")
    print(f"  {'team':<16} {'att plain':>9} {'def plain':>9} {'att fit':>8} {'def fit':>8}")
    for t in sorted(promoted):
        a0, d0 = model.stage1_attack.get(t), model.stage1_defense.get(t)
        before = f"{a0:9.3f} {d0:9.3f}" if a0 is not None else f"{'unrated':>9} {'':>9}"
        print(f"  {t:<16} {before} {model.attack[t]:8.3f} {model.defense[t]:8.3f}")


def map_team(name):
    try:
        return to_model_name(name)
    except KeyError as e:
        sys.exit(f"ERROR: {e.args[0]}")


def model_version_for(xi, shrink):
    return f"dc-xi{xi}-shrink{shrink}" if shrink > 0 else f"dc-xi{xi}"


def check_ratings(model, df, fixtures, season_fixtures=None):
    """Print the ratings table; exit on hard failures, print warnings otherwise."""
    cur = df[df["season"] == CURRENT_SEASON]
    names = set(cur["home_team"]) | set(cur["away_team"])
    if season_fixtures is not None:  # before matchweek 1, matches has no current-season rows
        names |= {map_team(t) for t in set(season_fixtures["home_team"]) | set(season_fixtures["away_team"])}
    teams = sorted(names, key=lambda t: model.attack.get(t, float("-inf")), reverse=True)

    print(f"\nRatings for {len(teams)} teams of {CURRENT_SEASON} (sorted by attack):")
    print(f"  {'team':<16} {'attack':>8} {'defense':>8} {'mp ' + CURRENT_SEASON[2:4] + '-' + CURRENT_SEASON[7:]:>8}")
    for t in teams:
        n = int(((cur["home_team"] == t) | (cur["away_team"] == t)).sum())
        if t not in model.attack:
            print(f"  {t:<16} {'unrated':>8} {'':>8} {n:8d}")
            continue
        print(f"  {t:<16} {model.attack[t]:8.3f} {model.defense[t]:8.3f} {n:8d}")
    print(f"  home_adv = {model.home_adv:.3f}   rho = {model.rho:.3f}   "
          f"converged = {model.converged}   iterations = {model.n_iter}")

    # Hard failures: these mean the column mapping or the fit itself is wrong.
    errors = []
    if not model.converged:
        errors.append("optimiser did not converge")
    if not 0.05 < model.home_adv < 0.5:
        errors.append(f"home_adv {model.home_adv:.3f} outside (0.05, 0.5)")
    if not -0.3 < model.rho < 0.1:
        errors.append(f"rho {model.rho:.3f} outside (-0.3, 0.1)")
    fixture_teams = {map_team(t) for t in set(fixtures["home_team"]) | set(fixtures["away_team"])}
    unrated = sorted(t for t in fixture_teams if t not in model.attack)
    if unrated:
        errors.append(f"fixture team(s) with no rating: {unrated}")
    if errors:
        sys.exit("ERROR: sanity check failed:\n  " + "\n  ".join(errors))

    # Warnings: plausible but worth a look.
    top5 = teams[:5]
    big = [t for t in ("Man City", "Arsenal", "Liverpool") if t in top5]
    if len(big) < 2:
        print(f"WARNING: only {big or 'none'} of Man City/Arsenal/Liverpool in the top five attacks ({top5})")
    extreme = [f"{t} (att {model.attack[t]:+.2f}, def {model.defense[t]:+.2f})" for t in teams
               if t in model.attack and abs(model.attack[t]) > 1.0 or abs(model.defense[t]) > 1.0]
    if extreme:
        print("WARNING: ratings beyond +/-1.0, likely resting on very few matches: " + ", ".join(extreme))


def predict_fixtures(model, fixtures):
    out = []
    for f in fixtures.itertuples(index=False):
        p = model.predict(map_team(f.home_team), map_team(f.away_team))
        i, j = np.unravel_index(np.argmax(p["score_matrix"]), p["score_matrix"].shape)
        out.append({
            "fixture_id": int(f.id),
            "matchweek": int(f.matchweek),
            "kickoff": f.kickoff,
            "home_team": f.home_team,  # as named in current_fixtures, not the mapped name
            "away_team": f.away_team,
            "p_home": round(p["home_win"], 6),
            "p_draw": round(p["draw"], 6),
            "p_away": round(p["away_win"], 6),
            "exp_home_goals": round(p["exp_home_goals"], 6),
            "exp_away_goals": round(p["exp_away_goals"], 6),
            "modal_score": f"{i}-{j}",
        })
    return out


def print_predictions(preds):
    print(f"\nPredictions ({len(preds)} fixtures):")
    print(f"  {'kickoff (UTC)':<16} {'home':<15} {'away':<15} {'p_home':>6} {'p_draw':>6} "
          f"{'p_away':>6} {'xg_h':>5} {'xg_a':>5} {'modal':>5}")
    for p in preds:
        print(f"  {p['kickoff']:%Y-%m-%d %H:%M} {p['home_team']:<15} {p['away_team']:<15} "
              f"{p['p_home']:6.3f} {p['p_draw']:6.3f} {p['p_away']:6.3f} "
              f"{p['exp_home_goals']:5.2f} {p['exp_away_goals']:5.2f} {p['modal_score']:>5}")


def run(sb=None, dry_run=False, days=DEFAULT_DAYS, now=None):
    """Forecast every fixture in the window. Returns a small summary dict.

    Writes nothing when dry_run, or when no fixture is in the window.
    """
    xi, shrink = load_params()
    model_version = model_version_for(xi, shrink)
    predicted_at = pd.Timestamp(now) if now is not None else pd.Timestamp(datetime.now(timezone.utc))

    sb = sb or get_client()
    df = load_matches(sb)
    season_fixtures = load_all_fixtures(sb, CURRENT_SEASON)
    fixtures = select_upcoming(season_fixtures, predicted_at, days)
    window_end = predicted_at + pd.Timedelta(days=days)
    ref_date = df["date"].max()
    print(f"Season {CURRENT_SEASON}: loaded {len(df)} played matches; latest match date used: "
          f"{ref_date:%Y-%m-%d %H:%M} UTC")
    summary = {"model_version": model_version, "predicted_at": predicted_at, "window_end": window_end,
               "in_window": len(fixtures), "written": 0}

    if fixtures.empty:
        later = season_fixtures[season_fixtures["status"].isin(["SCHEDULED", "TIMED"])
                                & (season_fixtures["kickoff"] > predicted_at)]
        nxt = f"next kickoff {later['kickoff'].min():%Y-%m-%d %H:%M} UTC" if len(later) else "no later fixtures"
        print(f"No SCHEDULED/TIMED fixtures kick off between {predicted_at:%Y-%m-%d %H:%M} and "
              f"{window_end:%Y-%m-%d %H:%M} UTC ({days}-day window; {nxt}). "
              "Nothing to predict, which is normal during an international break.")
        return summary

    weeks = sorted(fixtures["matchweek"].unique().tolist())
    print(f"{len(fixtures)} fixture(s) kick off in the next {days} days "
          f"(matchweek {', '.join(map(str, weeks))}; {fixtures['kickoff'].min():%Y-%m-%d %H:%M} to "
          f"{fixtures['kickoff'].max():%Y-%m-%d %H:%M} UTC)")

    if not check_team_names(season_fixtures, df, CURRENT_SEASON, now=predicted_at):
        sys.exit("ERROR: fix teams.py (see above) before predicting")

    # Fit once on everything played, current season included; promoted teams shrunk.
    promoted = promoted_model_names(season_fixtures, df, PREVIOUS_SEASON)
    model = fit_with_promoted_prior(df, ref_date, xi, shrink, promoted)
    print_shrinkage(model, promoted, shrink)
    check_ratings(model, df, fixtures, season_fixtures)

    preds = predict_fixtures(model, fixtures)
    print_predictions(preds)
    # Selection guarantees this; asserted because the view only ever shows forecasts
    # made at or before kickoff.
    assert all(p["kickoff"] > predicted_at for p in preds), "forecast after kickoff"

    rows = [{k: v for k, v in p.items() if k != "kickoff"}
            | {"model_version": model_version, "predicted_at": predicted_at.isoformat()}
            for p in preds]

    if dry_run:
        print(f"\nDry run: {len(rows)} rows not written ({model_version}, predicted_at {predicted_at.isoformat()}).")
        return summary

    # predicted_at is part of the key, so each run appends a new forecast set instead of
    # overwriting earlier ones; that history is what lets us measure skill by lead time.
    # The matchweek_predictions view shows only the latest one made before kickoff.
    sb.table(TABLE).upsert(rows, on_conflict="fixture_id,model_version,predicted_at").execute()
    print(f"\nUpserted {len(rows)} rows into {TABLE} ({model_version}, predicted_at {predicted_at.isoformat()}).")
    summary["written"] = len(rows)
    return summary


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dry-run", action="store_true", help="everything except the write to Supabase")
    parser.add_argument("--days", type=float, default=DEFAULT_DAYS,
                        help=f"predict fixtures kicking off within this many days (default {DEFAULT_DAYS})")
    args = parser.parse_args()
    run(dry_run=args.dry_run, days=args.days)


if __name__ == "__main__":
    main()
