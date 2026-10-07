"""Plain-assert self-test for update_results.py's pure helpers (no network, no Supabase).

Usage:
    .venv/bin/python test_update_results.py
"""

from datetime import datetime, timedelta, timezone

from update_results import classify, window

# window(): UTC, explicit +00:00 offset, correct distances from now.
now = datetime(2026, 10, 10, 14, 0, tzinfo=timezone.utc)
floor_iso, cutoff_iso = window(now)
assert cutoff_iso == "2026-10-10T12:00:00+00:00", cutoff_iso
assert floor_iso == "2026-10-03T14:00:00+00:00", floor_iso

# A non-UTC `now` is converted, not reinterpreted: 16:00+02:00 is 14:00 UTC.
cest = timezone(timedelta(hours=2))
assert window(datetime(2026, 10, 10, 16, 0, tzinfo=cest)) == (floor_iso, cutoff_iso)

# Overrides.
f, c = window(now, grace_hours=0, stale_days=60)
assert c == "2026-10-10T14:00:00+00:00" and f == "2026-08-11T14:00:00+00:00", (f, c)
assert all(s.endswith("+00:00") for s in (f, c, floor_iso, cutoff_iso))

# classify(): FINISHED vs anything else.
rows = [
    {"id": 1, "status": "FINISHED", "home_goals": 2, "away_goals": 1},
    {"id": 2, "status": "IN_PLAY", "home_goals": None, "away_goals": None},
    {"id": 3, "status": "PAUSED", "home_goals": None, "away_goals": None},
    {"id": 4, "status": "FINISHED", "home_goals": 0, "away_goals": 0},
]
finished, still = classify(rows)
assert [r["id"] for r in finished] == [1, 4]
assert [r["id"] for r in still] == [2, 3]
assert classify([]) == ([], [])

print("test_update_results: all checks passed")
