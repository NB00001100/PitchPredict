"""Load the 2026/27 Premier League schedule from football-data.org into Supabase.

Usage:
    .venv/bin/python fetch_fixtures.py            # fetch, validate, upsert into current_fixtures
    .venv/bin/python fetch_fixtures.py --dry-run  # fetch and validate only; Supabase is not touched
"""

import argparse
import os
import sys
from collections import Counter
from datetime import datetime, timezone

import requests
from dotenv import load_dotenv

API_URL = "https://api.football-data.org/v4/competitions/PL/matches"
API_SEASON = 2026
SEASON = "2026-2027"
TABLE = "current_fixtures"
CHUNK_SIZE = 500


def require_env(names):
    missing = [n for n in names if not os.environ.get(n, "").strip()]
    if missing:
        sys.exit(f"ERROR: missing required environment variable(s): {', '.join(missing)} (set them in .env)")


def fetch_matches(api_key):
    # One request returns the whole season; free tier allows 10 calls/min.
    resp = requests.get(
        API_URL,
        params={"season": API_SEASON},
        headers={"X-Auth-Token": api_key},
        timeout=30,
    )
    if resp.status_code != 200:
        sys.exit(f"ERROR: football-data.org returned HTTP {resp.status_code}\n{resp.text}")
    return resp.json()["matches"]


def to_rows(matches, now):
    """Map API matches to table rows. Rows with a null matchday are returned separately."""
    rows, skipped = [], []
    for m in matches:
        row = {
            "id": m["id"],
            "season": SEASON,
            "matchweek": m.get("matchday"),
            "kickoff": m["utcDate"],
            "status": m["status"],
            "home_team": m["homeTeam"]["shortName"],
            "away_team": m["awayTeam"]["shortName"],
            "home_tla": m["homeTeam"].get("tla"),
            "away_tla": m["awayTeam"].get("tla"),
            "home_goals": m["score"]["fullTime"]["home"],
            "away_goals": m["score"]["fullTime"]["away"],
            "updated_at": now.isoformat(),
        }
        if row["matchweek"] is None:
            skipped.append(row)
        else:
            rows.append(row)
    return rows, skipped


def parse_utc(s):
    return datetime.fromisoformat(s.replace("Z", "+00:00"))


def describe(r):
    return f"id={r['id']} MW{r['matchweek']} {r['kickoff']} {r['home_team']} v {r['away_team']} [{r['status']}]"


def report(rows, skipped, now):
    print("\n" + "=" * 70)
    print(f"VALIDATION REPORT  (season {SEASON}, run at {now.isoformat(timespec='seconds')})")
    print("=" * 70)

    # 0. Rows left out because matchday was null
    if skipped:
        print(f"\n!!! {len(skipped)} fixture(s) with NULL matchday were NOT loaded:")
        for r in skipped:
            print(f"    {describe(r)}")
    else:
        print("\nRows skipped for null matchday: 0")

    # 1. Total fixtures (including skipped ones, which are still real fixtures)
    total = len(rows) + len(skipped)
    weeks = sorted({r["matchweek"] for r in rows})
    print(f"\n1. Total fixtures from API: {total} (expected 380); loadable: {len(rows)}")
    if total < 380:
        print(f"   WARNING: fewer than 380 fixtures; max matchweek present: {max(weeks) if weeks else None}")

    # 2. Matchweeks
    per_week = Counter(r["matchweek"] for r in rows)
    missing_weeks = sorted(set(range(1, 39)) - set(weeks))
    extra_weeks = sorted(set(weeks) - set(range(1, 39)))
    print(f"\n2. Matchweeks present: {len(weeks)} "
          f"(range {min(weeks) if weeks else None}-{max(weeks) if weeks else None}; expected 1-38)")
    if missing_weeks:
        print(f"   Missing matchweeks: {missing_weeks}")
    if extra_weeks:
        print(f"   Unexpected matchweeks: {extra_weeks}")
    odd = {w: n for w, n in sorted(per_week.items()) if n != 10}
    print(f"   Matchweeks without exactly 10 fixtures: {odd if odd else 'none'}")

    # 3. Status checks
    status_counts = Counter(r["status"] for r in rows)
    print("\n3. Status counts:")
    for s, n in sorted(status_counts.items()):
        print(f"   {s:<10} {n}")
    past_not_finished = [r for r in rows if parse_utc(r["kickoff"]) < now and r["status"] != "FINISHED"]
    future_not_sched = [r for r in rows if parse_utc(r["kickoff"]) >= now and r["status"] not in ("TIMED", "SCHEDULED")]
    print(f"   Past-dated fixtures not FINISHED: {len(past_not_finished)}")
    for r in past_not_finished:
        print(f"     {describe(r)}")
    print(f"   Future-dated fixtures not TIMED/SCHEDULED: {len(future_not_sched)}")
    for r in future_not_sched:
        print(f"     {describe(r)}")
    goal_violations = []
    for r in rows:
        finished = r["status"] == "FINISHED"
        has_both = r["home_goals"] is not None and r["away_goals"] is not None
        has_none = r["home_goals"] is None and r["away_goals"] is None
        if (finished and not has_both) or (not finished and not has_none):
            goal_violations.append(r)
    print(f"   Rows violating 'goals non-null iff FINISHED': {len(goal_violations)}")
    for r in goal_violations:
        print(f"     {describe(r)} goals={r['home_goals']}-{r['away_goals']}")

    # 4. Teams
    teams = set()
    for r in rows + skipped:
        teams.add((r["home_team"], r["home_tla"]))
        teams.add((r["away_team"], r["away_tla"]))
    names = {name for name, _ in teams}
    print(f"\n4. Distinct team names: {len(names)} (expected 20)")
    for name, tla in sorted(teams, key=lambda t: (t[0] or "", t[1] or "")):
        print(f"   {tla or '???':<4} {name}")
    if len(teams) != len(names):
        print("   WARNING: some team name maps to more than one TLA (see above)")


def load(rows):
    from supabase import create_client

    client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])
    for i in range(0, len(rows), CHUNK_SIZE):
        chunk = rows[i:i + CHUNK_SIZE]
        client.table(TABLE).upsert(chunk, on_conflict="id").execute()
        print(f"Upserted rows {i + 1}-{i + len(chunk)}")
    resp = client.table(TABLE).select("id", count="exact").limit(1).execute()
    return resp.count


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dry-run", action="store_true", help="fetch and validate only; do not touch Supabase")
    args = parser.parse_args()

    load_dotenv()
    require_env(["FOOTBALL_DATA_API_KEY"] if args.dry_run
                else ["FOOTBALL_DATA_API_KEY", "SUPABASE_URL", "SUPABASE_KEY"])

    now = datetime.now(timezone.utc)
    matches = fetch_matches(os.environ["FOOTBALL_DATA_API_KEY"])
    print(f"Fetched {len(matches)} matches from football-data.org (season={API_SEASON})")
    rows, skipped = to_rows(matches, now)

    report(rows, skipped, now)

    if args.dry_run:
        print("\n5. Dry run: Supabase not touched.")
    else:
        print()
        table_count = load(rows)
        print(f"\n5. Rows in {TABLE} after upsert: {table_count}")


if __name__ == "__main__":
    main()
