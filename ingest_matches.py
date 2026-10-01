"""Load 6 seasons of Premier League results from football-data.co.uk into Supabase `matches`.

Usage:
    .venv/bin/python ingest_matches.py            # download, transform, upsert, validate
    .venv/bin/python ingest_matches.py --dry-run  # everything except touching Supabase
"""

import argparse
import io
import os
import re
import sys
from datetime import datetime, timezone

import numpy as np
import pandas as pd
import requests
from dotenv import load_dotenv

URL = "https://www.football-data.co.uk/mmz4281/{code}/E0.csv"
SEASONS = {
    "2122": "2021-2022",
    "2223": "2022-2023",
    "2324": "2023-2024",
    "2425": "2024-2025",
    "2526": "2025-2026",
    "2627": "2026-2027",
}
CURRENT_SEASON = "2026-2027"
COMPLETED_ROWS = 380
CHUNK = 500
CORE = ["kickoff", "home_team", "away_team", "home_goals", "away_goals"]

# Closing odds fallback chain, applied to the H/D/A triple as a unit.
ODDS_SOURCES = [
    ("AvgC", ["AvgCH", "AvgCD", "AvgCA"]),
    ("Avg", ["AvgH", "AvgD", "AvgA"]),
    ("B365C", ["B365CH", "B365CD", "B365CA"]),
    ("B365", ["B365H", "B365D", "B365A"]),
]


def download(code):
    resp = requests.get(URL.format(code=code), timeout=30)  # requests follows redirects
    resp.raise_for_status()
    try:
        text = resp.content.decode("utf-8-sig")
    except UnicodeDecodeError:
        text = resp.content.decode("latin-1")
    return pd.read_csv(io.StringIO(text))


def parse_dates(s):
    # Day-first, explicit formats only: never let pandas guess month/day order.
    s = s.astype(str).str.strip()
    out = pd.to_datetime(s, format="%d/%m/%Y", errors="coerce")
    two_digit = out.isna()
    out[two_digit] = pd.to_datetime(s[two_digit], format="%d/%m/%y", errors="coerce")
    bad = s[out.isna()]
    if len(bad):
        sys.exit(f"Unparseable dates: {bad.unique()[:10]}")
    return out


def slug(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


def transform(raw, season):
    df = raw[raw["HomeTeam"].notna() & (raw["HomeTeam"].astype(str).str.strip() != "")].copy()

    date = parse_dates(df["Date"])
    if "Time" in df.columns:
        time = df["Time"].astype("string").str.strip()
    else:
        time = pd.Series(pd.NA, index=df.index, dtype="string")
    missing_time = time.isna() | (time == "")
    time = time.mask(missing_time, "00:00")
    local = pd.to_datetime(date.dt.strftime("%Y-%m-%d") + " " + time, format="%Y-%m-%d %H:%M")
    kickoff = local.dt.tz_localize("Europe/London").dt.tz_convert("UTC")

    out = pd.DataFrame(index=df.index)
    out["season"] = season
    out["matchweek"] = None
    out["kickoff"] = kickoff
    out["home_team"] = df["HomeTeam"].astype(str).str.strip()
    out["away_team"] = df["AwayTeam"].astype(str).str.strip()
    out["home_goals"] = pd.to_numeric(df["FTHG"], errors="coerce").astype("Int64")
    out["away_goals"] = pd.to_numeric(df["FTAG"], errors="coerce").astype("Int64")
    out["result"] = df["FTR"].astype("string").str.strip()

    # Odds: take the first source whose full H/D/A triple is present for that row.
    out[["odds_home", "odds_draw", "odds_away"]] = np.nan
    out["odds_source"] = None
    for name, cols in ODDS_SOURCES:
        if not all(c in df.columns for c in cols):
            continue
        triple = df[cols].apply(pd.to_numeric, errors="coerce")
        use = out["odds_source"].isna() & triple.notna().all(axis=1)
        out.loc[use, ["odds_home", "odds_draw", "odds_away"]] = triple[use].to_numpy()
        out.loc[use, "odds_source"] = name
    out["odds_source"] = out["odds_source"].fillna("none")

    out["id"] = [
        slug(f"{d:%Y%m%d}-{h}-{a}") for d, h, a in zip(local, out["home_team"], out["away_team"])
    ]
    out["missing_time"] = missing_time.to_numpy()
    return out.reset_index(drop=True)


def to_python(v):
    # JSON-safe: NaN/NaT/NA -> None, numpy scalars -> plain Python, timestamps -> ISO 8601.
    if v is None or (not isinstance(v, str) and pd.isna(v)):
        return None
    if isinstance(v, pd.Timestamp):
        return v.isoformat()
    if isinstance(v, np.generic):
        return v.item()
    return v


def to_records(df):
    cols = ["id", "season", "matchweek", "kickoff", "home_team", "away_team",
            "home_goals", "away_goals", "result", "odds_home", "odds_draw", "odds_away"]
    now = datetime.now(timezone.utc).isoformat()
    records = []
    for row in df[cols].astype(object).itertuples(index=False):
        rec = {c: to_python(v) for c, v in zip(cols, row)}
        rec["updated_at"] = now  # created_at is never sent, so the DB default survives re-runs
        records.append(rec)
    return records


def fetch_all(client):
    rows, start, page = [], 0, 1000
    while True:
        res = (client.table("matches")
               .select("id,season,kickoff,home_team,away_team,home_goals,away_goals,odds_home")
               .order("id").range(start, start + page - 1).execute())
        rows.extend(res.data)
        if len(res.data) < page:
            break
        start += page
    df = pd.DataFrame(rows)
    if len(df):
        df["kickoff"] = pd.to_datetime(df["kickoff"], utc=True)
    return df


def report(df, title, odds_sources=True):
    """Print checks 1-5. Returns a list of hard failures (checks 1 and 2)."""
    failures = []
    print(f"\n===== Validation: {title} =====")

    print("\n[1] Rows per season")
    counts = df.groupby("season").size() if len(df) else pd.Series(dtype=int)
    for season in SEASONS.values():
        n = int(counts.get(season, 0))
        if season == CURRENT_SEASON:
            print(f"  {season}: {n}  (in progress)")
        else:
            flag = "OK" if n == COMPLETED_ROWS else f"FAIL (expected {COMPLETED_ROWS})"
            print(f"  {season}: {n}  {flag}")
            if n != COMPLETED_ROWS:
                failures.append(f"{season} has {n} rows, expected {COMPLETED_ROWS}")
    print(f"  total: {len(df)}")

    print("\n[2] Nulls in core fields")
    for c in CORE:
        n = int(df[c].isna().sum()) if c in df else len(df)
        print(f"  {c}: {n}")
        if n:
            failures.append(f"{n} null {c}")

    print("\n[3] Distinct teams per season (expect 20)")
    for season, g in df.groupby("season"):
        n = len(set(g["home_team"]) | set(g["away_team"]))
        print(f"  {season}: {n}{'' if n == 20 else '  <-- check'}")
    teams = sorted(set(df["home_team"]) | set(df["away_team"]))
    print(f"  all distinct names ({len(teams)}): {', '.join(teams)}")

    print("\n[4] Kickoff range per season (UTC)")
    for season, g in df.groupby("season"):
        print(f"  {season}: {g['kickoff'].min():%Y-%m-%d %H:%M} -> {g['kickoff'].max():%Y-%m-%d %H:%M}")

    print("\n[5] Odds")
    if odds_sources:
        for name in [s for s, _ in ODDS_SOURCES] + ["none"]:
            print(f"  source {name}: {int((df['odds_source'] == name).sum())}")
        print("  by season:")
        print("    " + df.groupby(["season", "odds_source"]).size().unstack(fill_value=0)
              .to_string().replace("\n", "\n    "))
    print(f"  rows with null odds: {int(df['odds_home'].isna().sum())}")
    return failures


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--dry-run", action="store_true", help="do everything except touch Supabase")
    args = parser.parse_args()

    load_dotenv()
    if not args.dry_run and not (os.environ.get("SUPABASE_URL") and os.environ.get("SUPABASE_KEY")):
        sys.exit("SUPABASE_URL and SUPABASE_KEY must be set in .env (or use --dry-run).")

    frames = []
    for code, season in SEASONS.items():
        raw = download(code)
        frame = transform(raw, season)
        print(f"{season}: downloaded {len(raw)} raw rows, kept {len(frame)}")
        frames.append(frame)
    df = pd.concat(frames, ignore_index=True)

    dupes = df.loc[df["id"].duplicated(keep=False), "id"]
    assert dupes.empty, f"Duplicate ids: {sorted(dupes.unique())}"
    n_missing_time = int(df["missing_time"].sum())
    print(f"\nRows with missing Time (defaulted to 00:00 UK local): {n_missing_time}")

    failures = report(df, "source dataframe")

    if args.dry_run:
        print("\nDry run: Supabase not touched.")
    else:
        from supabase import create_client

        client = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])
        records = to_records(df)
        for i in range(0, len(records), CHUNK):
            client.table("matches").upsert(records[i:i + CHUNK], on_conflict="id").execute()
        print(f"\nUpserted {len(records)} rows in chunks of {CHUNK}.")

        db = fetch_all(client)
        failures += report(db, "database (after upsert)", odds_sources=False)
        total = client.table("matches").select("id", count="exact").limit(1).execute().count
        print(f"\n[6] Total rows in matches table: {total}")

    if failures:
        print("\nHARD FAILURES:\n  " + "\n  ".join(failures))
        sys.exit(1)
    print("\nAll hard checks passed.")


if __name__ == "__main__":
    main()
