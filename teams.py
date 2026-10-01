"""Team names: football-data.org shortName (current_fixtures) -> football-data.co.uk
name (matches, and therefore the model). Shared by fit_predict.py,
backfill_predictions.py and refresh.py.

Every August the three promoted teams need entries here. Run

    .venv/bin/python teams.py

to check the map against the database: it prints exactly which names are missing or
wrong. It does not guess names; look them up in the two sources.
"""

import sys

import pandas as pd

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

# Model (football-data.co.uk) names of newly promoted teams that have no rows in
# `matches` at all yet (not in the Premier League in any loaded season). Spell them
# exactly as football-data.co.uk will; the check below catches a wrong spelling once
# their first results arrive. Entries can stay after they have history; they are harmless.
NO_HISTORY = set()

MISMATCH_GRACE_DAYS = 7  # longer than football-data.co.uk normally lags behind results


def to_model_name(name):
    """Model (matches) name for a current_fixtures team name; KeyError if unmapped."""
    if name not in TEAM_MAP:
        raise KeyError(f"fixture team {name!r} has no entry in teams.TEAM_MAP; add it before predicting")
    return TEAM_MAP[name]


def fixture_team_names(fixtures):
    return set(fixtures["home_team"]) | set(fixtures["away_team"]) if len(fixtures) else set()


def team_name_problems(fixtures, matches, season, now=None):
    """Problems with TEAM_MAP for this season's fixtures; an empty list means all good.

    fixtures: current_fixtures rows of `season` (home_team, away_team, status, kickoff).
    matches:  rows of `matches` (season, home_team, away_team), all seasons.
    """
    now = pd.Timestamp(now) if now is not None else pd.Timestamp.now(tz="UTC")
    problems = []
    known = set(matches["home_team"]) | set(matches["away_team"])
    cur = matches[matches["season"] == season]
    cur_names = set(cur["home_team"]) | set(cur["away_team"])
    names = fixture_team_names(fixtures)

    unmapped = sorted(n for n in names if n not in TEAM_MAP)
    if unmapped:
        problems.append(
            "fixture team name(s) missing from teams.TEAM_MAP; add an entry for each, mapped to "
            "the name football-data.co.uk uses: " + ", ".join(repr(n) for n in unmapped))

    unknown = sorted((n, TEAM_MAP[n]) for n in names
                     if n in TEAM_MAP and TEAM_MAP[n] not in known and TEAM_MAP[n] not in NO_HISTORY)
    for fixture_name, model_name in unknown:
        problems.append(
            f"TEAM_MAP[{fixture_name!r}] = {model_name!r}, but {model_name!r} never appears in matches. "
            f"Fix the spelling, or if it is a newly promoted team with no Premier League history "
            f"in the loaded seasons, add {model_name!r} to teams.NO_HISTORY.")

    # A mapped team that has played (with time for the CSV to catch up) but has no
    # current-season row in matches: football-data.co.uk spells it differently, and the
    # model would otherwise keep rating it as a team with no matches.
    if len(cur):
        cutoff = now - pd.Timedelta(days=MISMATCH_GRACE_DAYS)
        played = fixtures[(fixtures["status"] == "FINISHED") & (fixtures["kickoff"] < cutoff)]
        missing = sorted({TEAM_MAP[n] for n in fixture_team_names(played)
                          if n in TEAM_MAP and TEAM_MAP[n] not in cur_names})
        if missing:
            targeted = {TEAM_MAP[n] for n in names if n in TEAM_MAP}
            untargeted = sorted(cur_names - targeted)
            problems.append(
                f"team(s) {missing} have finished fixtures over {MISMATCH_GRACE_DAYS} days old but no "
                f"{season} rows in matches, so the TEAM_MAP value is probably spelled differently "
                f"from football-data.co.uk. {season} names in matches that no TEAM_MAP entry "
                f"points to: {untargeted or 'none'}")
    return problems


def check_team_names(fixtures, matches, season, now=None):
    """Print the result of team_name_problems; return True if there are none."""
    problems = team_name_problems(fixtures, matches, season, now)
    if problems:
        print(f"Team-name check FAILED for {season}:")
        for p in problems:
            print(f"  - {p}")
        return False
    names = fixture_team_names(fixtures)
    new = sorted(TEAM_MAP[n] for n in names if TEAM_MAP[n] in NO_HISTORY)
    print(f"Team-name check OK: {len(names)} fixture teams of {season} all map to model names"
          + (f" (no history yet: {', '.join(new)})" if new else ""))
    return True


def promoted_model_names(fixtures, matches, previous_season):
    """Model names of this season's teams that did not play in `previous_season`.

    Taken from the fixture list rather than from played matches, so it is right before a
    ball is kicked (matchweek 1) and includes promoted teams with no history at all.
    """
    prev = matches[matches["season"] == previous_season]
    if prev.empty:
        raise SystemExit(f"ERROR: no {previous_season} rows in matches; cannot tell which teams "
                         "are promoted (run ingest_matches.py)")
    prev_names = set(prev["home_team"]) | set(prev["away_team"])
    return {to_model_name(n) for n in fixture_team_names(fixtures)} - prev_names


if __name__ == "__main__":
    from db import get_client, load_all_fixtures, load_matches
    from seasons import CURRENT_SEASON

    sb = get_client()
    ok = check_team_names(load_all_fixtures(sb, CURRENT_SEASON), load_matches(sb), CURRENT_SEASON)
    sys.exit(0 if ok else 1)
