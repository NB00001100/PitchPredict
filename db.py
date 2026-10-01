"""Shared Supabase access for the model scripts."""

import os

import pandas as pd
from dotenv import load_dotenv
from supabase import create_client

PAGE = 1000  # PostgREST returns at most 1000 rows per request


def get_client():
    load_dotenv()
    url, key = os.environ.get("SUPABASE_URL"), os.environ.get("SUPABASE_KEY")
    if not url or not key:
        raise SystemExit("SUPABASE_URL and SUPABASE_KEY must be set in .env")
    return create_client(url, key)


def _fetch_all(sb, table, columns, order, eq=None):
    """Every row of `table` (paged), optionally filtered on column == value pairs in `eq`."""
    rows, start = [], 0
    while True:
        q = sb.table(table).select(columns)
        for col, val in (eq or {}).items():
            q = q.eq(col, val)
        page = q.order(order).range(start, start + PAGE - 1).execute().data
        rows.extend(page)
        if len(page) < PAGE:
            return rows
        start += PAGE


def load_matches(sb=None):
    """All played matches, oldest first, with the columns dixon_coles.py expects
    (date, home_team, away_team, home_goals, away_goals) plus season and odds."""
    sb = sb or get_client()
    rows = _fetch_all(
        sb, "matches",
        "id,season,kickoff,home_team,away_team,home_goals,away_goals,"
        "odds_home,odds_draw,odds_away",
        "id",  # unique, so paging is stable
    )
    df = pd.DataFrame(rows)
    df = df.dropna(subset=["home_goals", "away_goals"])
    df["date"] = pd.to_datetime(df["kickoff"], utc=True, format="ISO8601")
    df = df.drop(columns="kickoff")
    df[["home_goals", "away_goals"]] = df[["home_goals", "away_goals"]].astype(int)
    for c in ("odds_home", "odds_draw", "odds_away"):
        df[c] = df[c].astype(float)
    return df.sort_values(["date", "id"]).reset_index(drop=True)


UPCOMING_STATUSES = ("SCHEDULED", "TIMED")
DEFAULT_DAYS = 8


def select_upcoming(fixtures, now, days=DEFAULT_DAYS):
    """Fixtures to forecast: status SCHEDULED/TIMED, kicking off after `now` and within
    `days` days of it, whatever their matchweek number.

    Date-driven on purpose: a postponed fixture left over from an old matchweek must
    not hold back the next round (the current_matchweek view would, since it is the
    lowest matchweek with any unfinished fixture). Each row keeps its own matchweek.
    """
    now = pd.Timestamp(now)
    if fixtures.empty:
        return fixtures
    window = (
        fixtures["status"].isin(UPCOMING_STATUSES)
        & (fixtures["kickoff"] > now)
        & (fixtures["kickoff"] <= now + pd.Timedelta(days=days))
    )
    return fixtures[window].sort_values(["kickoff", "id"]).reset_index(drop=True)


def load_all_fixtures(sb=None, season=None):
    """Fixtures from current_fixtures (all statuses), ordered by kickoff; only those of
    `season` (e.g. '2026-2027') if given, since the table keeps old seasons' rows after
    a new season is fetched. Team names are football-data.org shortNames."""
    sb = sb or get_client()
    cols = "id,season,matchweek,kickoff,status,home_team,away_team,home_goals,away_goals"
    rows = _fetch_all(sb, "current_fixtures", cols, "id",
                      eq={"season": season} if season else None)
    df = pd.DataFrame(rows, columns=cols.split(","))
    df["kickoff"] = pd.to_datetime(df["kickoff"], utc=True, format="ISO8601")
    return df.sort_values(["kickoff", "id"]).reset_index(drop=True)


def load_view(sb=None, season=None):
    """Rows of the matchweek_predictions view (what the website shows), optionally one season."""
    sb = sb or get_client()
    rows = _fetch_all(sb, "matchweek_predictions", "*", "fixture_id",
                      eq={"season": season} if season else None)
    df = pd.DataFrame(rows)
    for c in ("kickoff", "predicted_at"):
        if c in df:
            df[c] = pd.to_datetime(df[c], utc=True, format="ISO8601")
    return df
