"""Pull in final scores for fixtures that have kicked off. Run by
.github/workflows/results.yml every 15 minutes and by hand whenever you like.

Usage:
    .venv/bin/python update_results.py                  # the real thing
    .venv/bin/python update_results.py --dry-run        # show what it would do; no API call, no writes
    .venv/bin/python update_results.py --grace-hours 0 --stale-days 60   # widen the window

What it does:
  1. Asks Supabase which current-season fixtures in current_fixtures kicked off more
     than --grace-hours ago (default 2) but less than --stale-days ago (default 7) and
     still have no final status.
  2. If there are none, it says so and exits: no API call.
  3. Otherwise it runs fetch_fixtures.run() once (one football-data.org call for the
     whole season, upserting status and scores for every fixture into current_fixtures)
     and reports which of the pending fixtures are now FINISHED and which are not yet.

Why it self-gates on kickoff timestamps rather than on the clock: GitHub's cron runs in
UTC and may start late or be skipped under load, and football-data.org's free-tier
scores are delayed (they land minutes to hours after full time). Checking the database
for "kicked off a while ago, not final yet" works whenever the run happens, retries
naturally on the next run, and means most runs exit in seconds with no API call.

It never refits the model and never touches the forecasts; the only write is
fetch_fixtures' upsert into current_fixtures keyed on id, so it is safe to re-run.
If GITHUB_STEP_SUMMARY is set (GitHub Actions), a short summary is written there too.
"""

import argparse
import os
import sys
from datetime import datetime, timedelta, timezone

import fetch_fixtures
from db import get_client
from seasons import CURRENT_SEASON

TABLE = "current_fixtures"
COLUMNS = "id,matchweek,kickoff,status,home_team,away_team"
GRACE_HOURS = 2  # a match lasts ~2 h with stoppages; free-tier scores land after that
STALE_DAYS = 7   # not final a week after kickoff: polling won't fix it; left to the daily run
# Statuses that will not change by polling. FINISHED/POSTPONED/CANCELLED are the obvious
# ones; SUSPENDED and AWARDED are terminal for our purposes too, otherwise one abandoned
# or awarded match would trigger an API call every 15 minutes for the rest of the season.
TERMINAL = ("FINISHED", "POSTPONED", "CANCELLED", "SUSPENDED", "AWARDED")


def window(now, grace_hours=GRACE_HOURS, stale_days=STALE_DAYS):
    """(floor_iso, cutoff_iso): fixtures kicking off in [floor, cutoff] are due a result.
    Both are UTC ISO-8601 strings with an explicit +00:00 offset (kickoff is timestamptz)."""
    now = now.astimezone(timezone.utc)
    cutoff = now - timedelta(hours=grace_hours)
    floor = now - timedelta(days=stale_days)
    return floor.isoformat(timespec="seconds"), cutoff.isoformat(timespec="seconds")


def pending_fixtures(sb, now, grace_hours=GRACE_HOURS, stale_days=STALE_DAYS):
    """Current-season fixtures that kicked off in the polling window without a final status."""
    floor_iso, cutoff_iso = window(now, grace_hours, stale_days)
    return (sb.table(TABLE).select(COLUMNS)
            .eq("season", CURRENT_SEASON)
            .lte("kickoff", cutoff_iso)
            .gte("kickoff", floor_iso)
            .not_.in_("status", list(TERMINAL))
            .order("kickoff").order("id")
            .execute().data)


def stale_count(sb, now, stale_days=STALE_DAYS):
    """How many current-season fixtures kicked off before the window and are still not final."""
    floor_iso, _ = window(now, 0, stale_days)
    resp = (sb.table(TABLE).select("id", count="exact")
            .eq("season", CURRENT_SEASON)
            .lt("kickoff", floor_iso)
            .not_.in_("status", list(TERMINAL))
            .limit(1).execute())
    return resp.count or 0


def classify(rows):
    """Split re-queried rows into (finished, still_pending) by status."""
    finished = [r for r in rows if r["status"] == "FINISHED"]
    still = [r for r in rows if r["status"] != "FINISHED"]
    return finished, still


def describe(r):
    return f"MW{r['matchweek']} {r['home_team']} v {r['away_team']} ({r['kickoff']}) [{r['status']}]"


def describe_result(r):
    return f"MW{r['matchweek']} {r['home_team']} {r['home_goals']}-{r['away_goals']} {r['away_team']}"


def write_summary(lines):
    path = os.environ.get("GITHUB_STEP_SUMMARY")
    if not path:
        return
    with open(path, "a") as f:
        f.write("### Update results\n\n" + "\n".join(lines) + "\n")


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dry-run", action="store_true",
                        help="run the gate query and say what would happen; no API call, no writes")
    parser.add_argument("--grace-hours", type=float, default=GRACE_HOURS,
                        help=f"only fixtures that kicked off at least this long ago (default {GRACE_HOURS})")
    parser.add_argument("--stale-days", type=float, default=STALE_DAYS,
                        help=f"ignore fixtures that kicked off more than this long ago (default {STALE_DAYS})")
    args = parser.parse_args()

    now = datetime.now(timezone.utc)
    sb = get_client()
    floor_iso, cutoff_iso = window(now, args.grace_hours, args.stale_days)
    print(f"Season {CURRENT_SEASON}, now {now.isoformat(timespec='seconds')}; "
          f"window: kickoff between {floor_iso} and {cutoff_iso}, status not in {', '.join(TERMINAL)}")

    stale = stale_count(sb, now, args.stale_days)
    if stale:
        print(f"WARNING: {stale} fixture(s) kicked off more than {args.stale_days:g} days ago and are "
              "still not final; left to the daily run (predict.yml)")

    pending = pending_fixtures(sb, now, args.grace_hours, args.stale_days)
    if not pending:
        print(f"No fixtures awaiting a result (0 kicked off more than {args.grace_hours:g} h ago "
              "without a final status); no API call.")
        write_summary(["No fixtures awaiting a result; no-op (no API call)."]
                      + ([f"Warning: {stale} fixture(s) older than {args.stale_days:g} days still not final."]
                         if stale else []))
        return

    print(f"{len(pending)} fixture(s) awaiting a result:")
    for r in pending:
        print(f"  {describe(r)}")

    if args.dry_run:
        print("\nDry run: would call football-data.org once (fetch_fixtures.run) and upsert "
              "current_fixtures; nothing fetched, nothing written.")
        write_summary([f"Dry run: {len(pending)} fixture(s) awaiting a result; no API call, no writes."]
                      + [f"- {describe(r)}" for r in pending])
        return

    print()
    try:
        fetch_fixtures.run(client=sb)
    except SystemExit as e:
        # fetch_fixtures exits on API/HTTP failure; surface it as a failed run with context.
        write_summary([f"Fetch from football-data.org failed: {e.code}"])
        raise SystemExit(f"ERROR: fetch_fixtures failed while updating results: {e.code}") from e

    ids = [r["id"] for r in pending]
    after = (sb.table(TABLE).select(COLUMNS + ",home_goals,away_goals")
             .in_("id", ids).order("kickoff").order("id").execute().data)
    finished, still = classify(after)

    print(f"\nMoved to FINISHED: {len(finished)}")
    for r in finished:
        print(f"  {describe_result(r)}")
    print(f"Still awaiting a result: {len(still)} (the next run retries)")
    for r in still:
        print(f"  {describe(r)}")

    lines = [f"{len(pending)} fixture(s) were awaiting a result; {len(finished)} now FINISHED, "
             f"{len(still)} still pending."]
    lines += [f"- {describe_result(r)}" for r in finished]
    lines += [f"- pending: {describe(r)}" for r in still]
    write_summary(lines)


if __name__ == "__main__":
    sys.exit(main())
