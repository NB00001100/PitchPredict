"""The weekly update, end to end. Run by .github/workflows/refresh.yml (Tuesdays and
Fridays) and by hand whenever you like.

Usage:
    .venv/bin/python refresh.py              # the real thing
    .venv/bin/python refresh.py --dry-run    # every step, no writes (reads Supabase)
    .venv/bin/python refresh.py --days 10    # widen the forecast window (default 8)

Steps, in order (the first failure stops the run with a non-zero exit):
  1. fetch fixtures and results  (fetch_fixtures.py -> current_fixtures)
  2. ingest match results        (ingest_matches.py -> matches, the training data)
  3. team-name check             (teams.py: every fixture team maps to a model name)
  4. staleness report            (results in current_fixtures not yet in matches)
  5. forecast upcoming fixtures  (fit_predict.py, fixtures kicking off within --days)
  6. backfill finished fixtures that lack a real forecast (backfill_predictions.py)
  7. summary from the matchweek_predictions view (what the website shows)

Every write is an idempotent upsert, so a failed run is fixed by running again. Step 5
appends one new forecast set per run (predicted_at is part of the key); the view shows
only the latest forecast made before kickoff, so running twice in a day is harmless.

With --dry-run, steps 3-7 read the database as the last real run left it.
If GITHUB_STEP_SUMMARY is set (GitHub Actions), the summary is also written there.
"""

import argparse
import os
import sys
import time
import traceback
from datetime import datetime, timezone

import pandas as pd

import backfill_predictions
import fetch_fixtures
import fit_predict
import ingest_matches
from db import DEFAULT_DAYS, get_client, load_all_fixtures, load_matches, load_view, select_upcoming
from seasons import CURRENT_SEASON
from teams import check_team_names

WARNINGS = []  # collected for the final summary


def warn(msg):
    WARNINGS.append(msg)
    print(f"WARNING: {msg}")


def step(n, title, fn):
    """Run one step; on any failure print what failed and exit 1."""
    print(f"\n{'=' * 72}\nSTEP {n}: {title}\n{'=' * 72}", flush=True)
    t0 = time.time()
    try:
        result = fn()
    except SystemExit as e:
        if e.code in (0, None):
            result = None
        else:
            if not isinstance(e.code, int):
                print(e.code)
            fail(n, title, f"exited with {e.code if isinstance(e.code, int) else 1}")
    except Exception:
        traceback.print_exc()
        fail(n, title, "raised an exception (traceback above)")
    print(f"-- step {n} done in {time.time() - t0:.1f} s", flush=True)
    return result


def fail(n, title, why):
    msg = (f"STEP {n} FAILED ({title}): {why}. Nothing after it ran. Earlier writes are "
           "idempotent upserts, so fixing the cause and re-running is safe.")
    print(f"\n{msg}", file=sys.stderr)
    write_step_summary(f"## PitchPredict refresh FAILED\n\n{msg}\n")
    sys.exit(1)


def team_check(sb):
    fixtures = load_all_fixtures(sb, CURRENT_SEASON)
    if fixtures.empty:
        sys.exit(f"ERROR: current_fixtures has no {CURRENT_SEASON} rows. If the new season has just "
                 "started, check that step 1 fetched it (or pin seasons.SEASON_START_YEAR).")
    if not check_team_names(fixtures, load_matches(sb), CURRENT_SEASON):
        sys.exit("ERROR: update teams.py as listed above, then re-run.")


def staleness(sb):
    """Compare results in current_fixtures (prompt) with current-season rows in matches
    (football-data.co.uk, can lag a day or two). Warns; never fails."""
    fixtures = load_all_fixtures(sb, CURRENT_SEASON)
    matches = load_matches(sb)
    cur = matches[matches["season"] == CURRENT_SEASON]
    finished = fixtures[fixtures["status"] == "FINISHED"]
    gap = len(finished) - len(cur)
    latest = f"{cur['date'].max():%Y-%m-%d %H:%M} UTC" if len(cur) else "none"
    print(f"FINISHED fixtures in current_fixtures ({CURRENT_SEASON}): {len(finished)}")
    print(f"{CURRENT_SEASON} rows in matches (training data):     {len(cur)}  (latest {latest})")
    if gap > 0:
        newer = finished[finished["kickoff"] > cur["date"].max()] if len(cur) else finished
        warn(f"matches is {gap} result(s) behind current_fixtures (football-data.co.uk not updated yet). "
             f"Forecasts this run are fitted without them; they will be included once the CSV catches up.")
        for f in newer.itertuples(index=False):
            print(f"    not yet in matches? MW{f.matchweek} {f.kickoff:%Y-%m-%d %H:%M} "
                  f"{f.home_team} {f.home_goals}-{f.away_goals} {f.away_team}")
    elif gap < 0:
        warn(f"matches has {-gap} more {CURRENT_SEASON} result(s) than current_fixtures has FINISHED "
             "fixtures; one of the sources looks wrong, worth a manual look.")
    else:
        print("Training data is up to date with the results (gap 0).")
    return gap


def summary(sb, days, dry_run, forecast, backfill, gap):
    v = load_view(sb, CURRENT_SEASON)
    now = pd.Timestamp(datetime.now(timezone.utc))
    finished = v[v["status"] == "FINISHED"]
    graded = finished[finished["hit"].notna()]
    hits = int(graded["hit"].astype(bool).sum())
    upcoming = v[v["status"].isin(["SCHEDULED", "TIMED"]) & (v["kickoff"] > now)]
    window = select_upcoming(upcoming.rename(columns={"fixture_id": "id"}), now, days)
    with_fc = int(window["p_home"].notna().sum()) if len(window) else 0
    late = int((v["predicted_at"].notna() & (v["predicted_at"] > v["kickoff"])).sum())
    dupes = int(v["fixture_id"].duplicated().sum())

    lines = [
        f"Season {CURRENT_SEASON}{' (DRY RUN: nothing written)' if dry_run else ''}",
        f"Fixtures finished: {len(finished)}",
        f"Graded (finished with a forecast): {len(graded)}",
        f"Hits: {hits} of {len(graded)}" + (f" (hit rate {hits / len(graded):.1%})" if len(graded) else ""),
        f"Finished without any forecast: {len(finished) - len(graded)}",
        "Next kickoff: " + (f"{upcoming['kickoff'].min():%Y-%m-%d %H:%M} UTC" if len(upcoming) else "none scheduled"),
        f"Upcoming fixtures in the next {days:g} days: {len(window)}, with a forecast: {with_fc}",
        f"Forecasts written this run: {forecast.get('written', 0) if forecast else 0} new, "
        f"{backfill.get('written', 0) if backfill else 0} backfill rows upserted",
        f"Results not yet in training data (matches): {max(gap, 0)}",
    ]
    if late or dupes:  # the view guarantees neither; reported in case it ever changes
        warn(f"view integrity: {late} forecast(s) shown with predicted_at after kickoff, "
             f"{dupes} duplicated fixture row(s)")
    print("\n".join(lines))
    if WARNINGS:
        print("\nWarnings:\n" + "\n".join(f"  - {w}" for w in WARNINGS))
    md = "## PitchPredict refresh\n\n" + "\n".join(f"- {l}" for l in lines)
    if WARNINGS:
        md += "\n\n### Warnings\n\n" + "\n".join(f"- {w}" for w in WARNINGS)
    write_step_summary(md + "\n")


def write_step_summary(md):
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if path:
        with open(path, "a") as f:
            f.write(md)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dry-run", action="store_true", help="run every step without writing to Supabase")
    parser.add_argument("--days", type=float, default=DEFAULT_DAYS,
                        help=f"forecast fixtures kicking off within this many days (default {DEFAULT_DAYS})")
    args = parser.parse_args()
    dry = args.dry_run

    print(f"PitchPredict refresh, season {CURRENT_SEASON}, "
          f"{datetime.now(timezone.utc):%Y-%m-%d %H:%M} UTC{', DRY RUN' if dry else ''}")
    sb = get_client()

    step(1, "fetch fixtures and results (football-data.org)", lambda: fetch_fixtures.run(dry, client=sb))
    step(2, "ingest match results (football-data.co.uk)", lambda: ingest_matches.run(dry, client=sb))
    step(3, "team-name check", lambda: team_check(sb))
    gap = step(4, "staleness report", lambda: staleness(sb))
    forecast = step(5, f"forecast fixtures in the next {args.days:g} days",
                    lambda: fit_predict.run(sb, dry_run=dry, days=args.days))
    backfill = step(6, "backfill finished fixtures without a real forecast",
                    lambda: backfill_predictions.run(sb, dry_run=dry))
    if backfill and backfill["stale_groups"]:
        warn(f"{sum(n for *_, n in backfill['stale_groups'])} finished fixture(s) not backfilled yet: "
             "their training data is missing earlier results (see step 6).")
    step(7, "summary", lambda: summary(sb, args.days, dry, forecast, backfill, gap or 0))


if __name__ == "__main__":
    main()
