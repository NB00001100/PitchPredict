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


def _fetch_all(sb, table, columns, order):
    rows, start = [], 0
    while True:
        page = (
            sb.table(table).select(columns).order(order)
            .range(start, start + PAGE - 1).execute().data
        )
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


def load_upcoming_fixtures(sb=None):
    """Not-yet-played fixtures of the current matchweek (current_matchweek view).
    Team names are football-data.org shortNames, not the names used in matches."""
    sb = sb or get_client()
    mw = sb.table("current_matchweek").select("matchweek").execute().data[0]["matchweek"]
    if mw is None:
        raise SystemExit("current_matchweek is null: no unfinished fixtures")
    rows = (
        sb.table("current_fixtures")
        .select("id,matchweek,kickoff,status,home_team,away_team")
        .eq("matchweek", mw).in_("status", ["SCHEDULED", "TIMED"])
        .order("kickoff").execute().data
    )
    df = pd.DataFrame(rows)
    df["kickoff"] = pd.to_datetime(df["kickoff"], utc=True, format="ISO8601")
    return df
