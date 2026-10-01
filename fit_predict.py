"""Fit Dixon-Coles on all played matches, predict the upcoming matchweek, store forecasts.

Usage:
    .venv/bin/python fit_predict.py            # fit, check, predict, write to predictions
    .venv/bin/python fit_predict.py --dry-run  # everything except the write

Teams promoted this season are fit with the shrinkage prior from shrinkage.py
(strength `shrink` from model_config.json; 0 = plain fit).

Intended cadence: refit after every matchday, once `matches` has been refreshed by
ingest_matches.py. Nothing is scheduled here; the caller is assumed to have refreshed
`matches` (and current_fixtures) before running this.
"""

import argparse
import json
import os
import sys
from datetime import datetime, timezone

import numpy as np

from db import get_client, load_matches, load_upcoming_fixtures
from shrinkage import clean_number, fit_with_promoted_prior, promoted_teams

DEFAULT_XI = 0.0018
CONFIG_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "model_config.json")
CURRENT_SEASON = "2026-2027"
TABLE = "predictions"

# football-data.org shortName (current_fixtures) -> football-data.co.uk name (matches).
TEAM_MAP = {
    "Arsenal": "Arsenal",
    "Aston Villa": "Aston Villa",
    "Bournemouth": "Bournemouth",
    "Brentford": "Brentford",
    "Brighton Hove": "Brighton",
    "Chelsea": "Chelsea",
    "Coventry City": "Coventry",
    "Crystal Palace": "Crystal Palace",
    "Everton": "Everton",
    "Fulham": "Fulham",
    "Hull City": "Hull",
    "Ipswich Town": "Ipswich",
    "Leeds United": "Leeds",
    "Liverpool": "Liverpool",
    "Man City": "Man City",
    "Man United": "Man United",
    "Newcastle": "Newcastle",
    "Nottingham": "Nott'm Forest",
    "Sunderland": "Sunderland",
    "Tottenham": "Tottenham",
}


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
    if name not in TEAM_MAP:
        sys.exit(f"ERROR: fixture team {name!r} has no entry in TEAM_MAP; add it before predicting")
    return TEAM_MAP[name]


def check_ratings(model, df, fixtures):
    """Print the ratings table; exit on hard failures, print warnings otherwise."""
    cur = df[df["season"] == CURRENT_SEASON]
    teams = sorted(set(cur["home_team"]) | set(cur["away_team"]),
                   key=lambda t: model.attack.get(t, float("-inf")), reverse=True)

    print(f"\nRatings for {len(teams)} teams of {CURRENT_SEASON} (sorted by attack):")
    print(f"  {'team':<16} {'attack':>8} {'defense':>8} {'mp 26-27':>8}")
    for t in teams:
        n = int(((cur["home_team"] == t) | (cur["away_team"] == t)).sum())
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
               if abs(model.attack[t]) > 1.0 or abs(model.defense[t]) > 1.0]
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


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dry-run", action="store_true", help="everything except the write to Supabase")
    args = parser.parse_args()

    xi, shrink = load_params()
    model_version = f"dc-xi{xi}-shrink{shrink}" if shrink > 0 else f"dc-xi{xi}"
    predicted_at = datetime.now(timezone.utc)  # one timestamp for the whole run

    sb = get_client()
    df = load_matches(sb)
    fixtures = load_upcoming_fixtures(sb)
    ref_date = df["date"].max()
    print(f"Loaded {len(df)} played matches; latest match date used: {ref_date:%Y-%m-%d %H:%M} UTC")
    print(f"Loaded {len(fixtures)} upcoming fixtures (matchweek {sorted(fixtures['matchweek'].unique().tolist())})")

    # Fit once on everything played, current season included; promoted teams shrunk.
    promoted = promoted_teams(df, CURRENT_SEASON)
    model = fit_with_promoted_prior(df, ref_date, xi, shrink, promoted)
    print_shrinkage(model, promoted, shrink)
    check_ratings(model, df, fixtures)

    preds = predict_fixtures(model, fixtures)
    print_predictions(preds)

    rows = [{k: v for k, v in p.items() if k != "kickoff"}
            | {"model_version": model_version, "predicted_at": predicted_at.isoformat()}
            for p in preds]

    if args.dry_run:
        print(f"\nDry run: {len(rows)} rows not written ({model_version}, predicted_at {predicted_at.isoformat()}).")
        return

    # predicted_at is part of the key, so each run appends a new forecast set instead of
    # overwriting earlier ones; that history is what lets us measure skill by lead time.
    sb.table(TABLE).upsert(rows, on_conflict="fixture_id,model_version,predicted_at").execute()
    print(f"\nUpserted {len(rows)} rows into {TABLE} ({model_version}, predicted_at {predicted_at.isoformat()}).")


if __name__ == "__main__":
    main()
