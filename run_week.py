"""The forecasting pipeline, end to end, and the one place that decides when to forecast.
Run every day by .github/workflows/predict.yml, and by hand whenever you like.

Usage:
    .venv/bin/python run_week.py              # the real thing
    .venv/bin/python run_week.py --dry-run    # every step reads, nothing is written

Steps, in order (the first failure stops the run with a non-zero exit; a decision to
skip is not a failure and exits 0):
  1. fetch fixtures and results  (fetch_fixtures.py -> current_fixtures)
  2. ingest match results        (ingest_matches.py -> matches, the training data)
  3. team-name check             (teams.py: every fixture team maps to a model name)
  4. staleness report            (results in current_fixtures not yet in matches)
  5. decide                      (decide(): is a matchweek due for its forecast?)
  6. forecast the round          (only if step 5 said so; fit_predict.forecast)
  7. backfill finished fixtures that lack a real forecast (backfill_predictions.py)
  8. summary, also written to $GITHUB_STEP_SUMMARY: ACTED or SKIPPED, and why

Why it decides for itself: GitHub's cron is UTC, can start late or be skipped under
load, and is switched off in repositories inactive for 60 days. So this script never
assumes what day it is. It runs daily, looks at the fixture list, and forecasts the
next matchweek exactly once, as soon as the one before it has been played. A missed day
costs nothing as long as one run lands before the matchweek's first kickoff.

The rules (the honesty policy; decide() implements them and test_run_week.py tests them):

  Round. The next round is led by the earliest SCHEDULED/TIMED fixture that kicks off
  after now (the head). It holds the upcoming fixtures of the head's matchweek kicking off
  within ROUND_SPAN_DAYS of the head (a matchweek spans Fri-Mon or Tue-Thu). A fixture of
  the same matchweek rescheduled weeks later is not in this round; it is handled when it
  becomes the next kickoff itself.

  A. The matchweek is not under way. A matchweek's forecasts are never written or
     rewritten once its first fixture has kicked off. If any fixture of the matchweek is
     in play, finished, or past its kickoff, the run skips, and anything left without a
     forecast is covered after the fact by the backfill (flagged is_backfill). Exception:
     a detached round, whose head kicks off more than ROUND_SPAN_DAYS after the
     matchweek's earliest (non-cancelled) fixture. That is a rescheduled fixture (or a
     few) played apart from its matchweek; it is forecast as a round of its own, fitted
     on everything played before it, as backfill_predictions.py does for postponed games.

  B. Everything before the round has finished. No fixture of any matchweek outside the
     round that kicked off before the round's first kickoff may still be unfinished
     (SCHEDULED, TIMED, IN_PLAY, PAUSED): its result belongs in the fit. FINISHED,
     AWARDED and CANCELLED are done; POSTPONED and SUSPENDED keep a past date but have no
     result coming, so they never block (otherwise one postponement would stall the
     season).

  C. Not forecast yet. A fixture has a forecast if `predictions` holds a real
     (is_backfill = false) row for it made at or before its kickoff. Round fixtures that
     have one are left alone; the rest are forecast. If all have one, the run skips.

When it forecasts, it fits on every played match: `matches`, plus any result that
current_fixtures has as FINISHED but football-data.co.uk has not published yet. Before
fitting it checks (and stops if violated) that nothing in the training data kicked off
at or after the round's first kickoff, that no fixture being forecast is in the training
data, and that every fixture being forecast kicks off after now. There is no flag to
override any of this.

Every write is an idempotent upsert, so a failed run is fixed by running again. With
--dry-run, steps 3-8 read the database as the last real run left it, and a forecast that
is due is computed and printed but not written.
"""

import argparse
import os
import sys
import time
import traceback
from dataclasses import dataclass
from datetime import datetime, timezone

import pandas as pd

from seasons import CURRENT_SEASON

ROUND_SPAN_DAYS = 6
UPCOMING = {"SCHEDULED", "TIMED"}
STARTED = {"IN_PLAY", "PAUSED", "FINISHED"}
# Statuses with nothing left to wait for. POSTPONED/SUSPENDED fixtures keep a past date
# but no result is coming until they are rescheduled (and become TIMED again).
DONE = {"FINISHED", "CANCELLED", "POSTPONED", "SUSPENDED", "AWARDED"}

WARNINGS = []  # collected for the final summary


@dataclass
class Decision:
    action: str  # "predict" or "skip"
    reason: str
    matchweek: int = None
    target: pd.DataFrame = None  # fixtures to forecast (empty unless action == "predict")
    first_kickoff: pd.Timestamp = None
    round: pd.DataFrame = None  # every fixture of the round, forecast or not


def utc(ts):
    return f"{ts:%Y-%m-%d %H:%M} UTC"


def describe(f):
    return f"MW{f.matchweek} {f.home_team} v {f.away_team} ({f.status}, kicked off {utc(f.kickoff)})"


def has_forecast(fixtures, forecasts):
    """Boolean Series over `fixtures`: a real forecast made at or before kickoff exists."""
    if forecasts is None or forecasts.empty:
        return pd.Series(False, index=fixtures.index)
    real = forecasts[~forecasts["is_backfill"].astype(bool)]
    kickoff = fixtures.set_index("id")["kickoff"]
    ok = real["predicted_at"] <= real["fixture_id"].map(kickoff)  # NaT (other fixtures) -> False
    done = set(real.loc[ok, "fixture_id"])
    return fixtures["id"].isin(done)


def decide(fixtures, forecasts, now, span_days=ROUND_SPAN_DAYS):
    """Whether to forecast now, and what. Pure: no database, no clock. See the module
    docstring for the rules."""
    now = pd.Timestamp(now)
    span = pd.Timedelta(days=span_days)
    empty = fixtures.iloc[0:0]
    upcoming = fixtures[fixtures["status"].isin(UPCOMING) & (fixtures["kickoff"] > now)]
    if upcoming.empty:
        return Decision("skip", "no dated fixtures left to play", target=empty, round=empty)

    head = upcoming.sort_values(["kickoff", "id"]).iloc[0]
    mw, first = int(head["matchweek"]), head["kickoff"]
    assert first > now, "round's first kickoff is not in the future"
    rnd = upcoming[(upcoming["matchweek"] == mw) & (upcoming["kickoff"] <= first + span)]
    rnd = rnd.sort_values(["kickoff", "id"])
    base = dict(matchweek=mw, first_kickoff=first, round=rnd, target=empty)

    # A: never (re)write a matchweek's forecasts once it is under way, unless this round
    # is a rescheduled fixture played apart from the rest of its matchweek.
    week = fixtures[fixtures["matchweek"] == mw]
    played = week[week["status"].isin(STARTED) | (week["status"].isin(UPCOMING) & (week["kickoff"] <= now))]
    week_start = week.loc[week["status"] != "CANCELLED", "kickoff"].min()
    detached = first > week_start + span
    if len(played) and not detached:
        return Decision("skip", f"matchweek {mw} is under way ({len(played)} of {len(week)} played); "
                                "forecasts are never rewritten after first kickoff", **base)

    # B: every fixture before the round must have finished (or have no result coming).
    blockers = fixtures[~fixtures["id"].isin(rnd["id"]) & (fixtures["kickoff"] < first)
                        & ~fixtures["status"].isin(DONE)].sort_values(["kickoff", "id"])
    if len(blockers):
        listed = "; ".join(describe(f) for f in blockers.head(5).itertuples(index=False))
        more = f"; and {len(blockers) - 5} more" if len(blockers) > 5 else ""
        return Decision("skip", f"waiting for {len(blockers)} earlier fixture(s) to finish before "
                                f"matchweek {mw}: {listed}{more}", **base)

    # C: forecast only what has no real pre-kickoff forecast yet.
    target = rnd[~has_forecast(rnd, forecasts)]
    if target.empty:
        return Decision("skip", f"matchweek {mw} already forecast ({len(rnd)} fixtures), nothing to do", **base)
    what = (f"rescheduled fixture(s) of matchweek {mw} played apart from the rest of it, "
            f"{len(rnd)} fixture(s)" if detached else f"matchweek {mw}: {len(rnd)} fixtures")
    missing = (f"{len(target)} of them without a forecast (forecasting only those)"
               if len(target) < len(rnd) else "no forecast yet")
    return Decision("predict", f"{what}, first kickoff {utc(first)}, all earlier fixtures finished, "
                               f"{missing}", **(base | {"target": target}))


def model_pairs(df):
    """(home, away) pairs of a frame whose team columns already hold model names."""
    return set(zip(df["home_team"], df["away_team"]))


def fixture_pairs(fixtures):
    from teams import to_model_name
    return {(to_model_name(h), to_model_name(a)) for h, a in zip(fixtures["home_team"], fixtures["away_team"])}


def supplement_training(df, fixtures, first_kickoff):
    """`df` plus, as training rows, results FINISHED in current_fixtures before
    `first_kickoff` that are not in `df` yet (football-data.co.uk lags a day or two).

    A home/away pairing occurs once per season, so the mapped pair identifies the match.
    Returns (training frame sorted by date, the fixtures that were added).
    """
    from teams import to_model_name
    done = fixtures[(fixtures["status"] == "FINISHED") & (fixtures["kickoff"] < first_kickoff)
                    & fixtures["home_goals"].notna() & fixtures["away_goals"].notna()]
    rows, added = [], []
    for season, g in done.groupby("season"):
        have = model_pairs(df[df["season"] == season])
        for f in g.itertuples(index=False):
            home, away = to_model_name(f.home_team), to_model_name(f.away_team)
            if (home, away) in have:
                continue
            rows.append({"id": f"fixture-{f.id}", "season": season, "date": f.kickoff,
                         "home_team": home, "away_team": away,
                         "home_goals": int(f.home_goals), "away_goals": int(f.away_goals),
                         "odds_home": float("nan"), "odds_draw": float("nan"), "odds_away": float("nan")})
            added.append(f)
    if not rows:
        return df, done.iloc[0:0]
    extra = pd.DataFrame(rows, columns=df.columns)
    extra[["home_goals", "away_goals"]] = extra[["home_goals", "away_goals"]].astype(int)
    for c in ("odds_home", "odds_draw", "odds_away"):
        extra[c] = extra[c].astype(float)
    out = pd.concat([df, extra], ignore_index=True)
    return out.sort_values("date", kind="stable").reset_index(drop=True), pd.DataFrame(added)


def check_training_window(df, target, first_kickoff, now):
    """The honesty assertions, checked just before fitting; SystemExit if any fails."""
    errors = []
    if len(df) and not df["date"].max() < first_kickoff:
        errors.append(f"training data runs to {utc(df['date'].max())}, at or after the round's "
                      f"first kickoff {utc(first_kickoff)}")
    seasons = set(target["season"])
    leaked = fixture_pairs(target) & model_pairs(df[df["season"].isin(seasons)])
    if leaked:
        errors.append(f"fixture(s) being forecast are already in the training data: {sorted(leaked)}")
    late = target[target["kickoff"] <= now]
    if len(late):
        errors.append(f"{len(late)} fixture(s) being forecast have already kicked off "
                      f"(now {utc(now)}): " + "; ".join(describe(f) for f in late.itertuples(index=False)))
    if errors:
        raise SystemExit("ERROR: honesty check failed, nothing forecast:\n  " + "\n  ".join(errors))


# --- the pipeline ------------------------------------------------------------------------

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
    write_step_summary(f"## PitchPredict run FAILED\n\n{msg}\n")
    sys.exit(1)


def team_check(sb):
    from db import load_all_fixtures, load_matches
    from teams import check_team_names
    fixtures = load_all_fixtures(sb, CURRENT_SEASON)
    if fixtures.empty:
        sys.exit(f"ERROR: current_fixtures has no {CURRENT_SEASON} rows. If the new season has just "
                 "started, check that step 1 fetched it (or pin seasons.SEASON_START_YEAR).")
    # Run on `matches` as stored, before any supplement: supplemental rows carry TEAM_MAP's
    # own spellings and would hide a misspelled entry from this check.
    if not check_team_names(fixtures, load_matches(sb), CURRENT_SEASON):
        sys.exit("ERROR: update teams.py as listed above, then re-run.")


def staleness(sb):
    """Compare results in current_fixtures (prompt) with current-season rows in matches
    (football-data.co.uk, can lag a day or two). Warns; never fails."""
    from db import load_all_fixtures, load_matches
    fixtures = load_all_fixtures(sb, CURRENT_SEASON)
    matches = load_matches(sb)
    cur = matches[matches["season"] == CURRENT_SEASON]
    finished = fixtures[fixtures["status"] == "FINISHED"]
    gap = len(finished) - len(cur)
    latest = utc(cur["date"].max()) if len(cur) else "none"
    print(f"FINISHED fixtures in current_fixtures ({CURRENT_SEASON}): {len(finished)}")
    print(f"{CURRENT_SEASON} rows in matches (training data):     {len(cur)}  (latest {latest})")
    if gap > 0:
        warn(f"matches is {gap} result(s) behind current_fixtures (football-data.co.uk not updated yet). "
             "A forecast this run adds them to the training data from current_fixtures; the "
             "backfill waits for the CSV.")
    elif gap < 0:
        warn(f"matches has {-gap} more {CURRENT_SEASON} result(s) than current_fixtures has FINISHED "
             "fixtures; one of the sources looks wrong, worth a manual look.")
    else:
        print("Training data is up to date with the results (gap 0).")
    return gap


def decide_now(sb):
    from db import load_all_fixtures, load_forecasts
    fixtures = load_all_fixtures(sb, CURRENT_SEASON)
    forecasts = load_forecasts(sb, fixtures["id"])
    now = pd.Timestamp(datetime.now(timezone.utc))
    d = decide(fixtures, forecasts, now)
    print(f"Now {utc(now)}; {len(fixtures)} {CURRENT_SEASON} fixtures, {len(forecasts)} forecast rows.")
    if d.round is not None and len(d.round):
        print(f"Next round: matchweek {d.matchweek}, {len(d.round)} fixture(s), first kickoff {utc(d.first_kickoff)}")
    print(f"Decision: {d.action.upper()}: {d.reason}")
    return d, fixtures


def predict_round(sb, decision, fixtures, dry_run):
    import fit_predict
    from db import load_matches
    df, added = supplement_training(load_matches(sb), fixtures, decision.first_kickoff)
    if len(added):
        print(f"Added {len(added)} result(s) from current_fixtures that matches does not have yet:")
        for f in added.itertuples(index=False):
            print(f"    MW{f.matchweek} {utc(f.kickoff)} {f.home_team} {f.home_goals}-{f.away_goals} {f.away_team}")
    print(f"Training on {len(df)} played matches, latest {utc(df['date'].max())}; forecasting "
          f"{len(decision.target)} fixture(s) of matchweek {decision.matchweek}.")
    predicted_at = pd.Timestamp(datetime.now(timezone.utc))
    check_training_window(df, decision.target, decision.first_kickoff, predicted_at)
    return fit_predict.forecast(sb, df, decision.target, fixtures, predicted_at, dry_run)


def summary(sb, dry_run, decision, forecast, backfill, gap):
    from db import load_view
    v = load_view(sb, CURRENT_SEASON)
    now = pd.Timestamp(datetime.now(timezone.utc))
    finished = v[v["status"] == "FINISHED"]
    graded = finished[finished["hit"].notna()]
    hits = int(graded["hit"].astype(bool).sum())
    upcoming = v[v["status"].isin(UPCOMING) & (v["kickoff"] > now)]
    late = int((v["predicted_at"].notna() & (v["predicted_at"] > v["kickoff"])).sum())
    dupes = int(v["fixture_id"].duplicated().sum())

    if decision.action == "predict":
        verdict = f"ACTED{' (dry run: nothing written)' if dry_run else ''}: {decision.reason}"
    else:
        verdict = f"SKIPPED: {decision.reason}"
    lines = [
        verdict,
        f"Season {CURRENT_SEASON}{' (DRY RUN: nothing written)' if dry_run else ''}",
        f"Fixtures finished: {len(finished)}",
        f"Graded (finished with a forecast): {len(graded)}",
        f"Hits: {hits} of {len(graded)}" + (f" (hit rate {hits / len(graded):.1%})" if len(graded) else ""),
        f"Finished without any forecast: {len(finished) - len(graded)}",
        "Next kickoff: " + (utc(upcoming["kickoff"].min()) if len(upcoming) else "none scheduled"),
    ]
    if decision.round is not None and len(decision.round):
        rnd = v[v["fixture_id"].isin(decision.round["id"])]
        lines.append(f"Next round (matchweek {decision.matchweek}): {len(decision.round)} fixture(s), "
                     f"with a forecast shown: {int(rnd['p_home'].notna().sum())}")
    lines += [
        f"Forecasts written this run: {forecast.get('written', 0) if forecast else 0} new, "
        f"{backfill.get('written', 0) if backfill else 0} backfill rows upserted",
        f"Results not yet in matches (football-data.co.uk): {max(gap, 0)}",
    ]
    if late or dupes:  # the view guarantees neither; reported in case it ever changes
        warn(f"view integrity: {late} forecast(s) shown with predicted_at after kickoff, "
             f"{dupes} duplicated fixture row(s)")
    print("\n".join(lines))
    if WARNINGS:
        print("\nWarnings:\n" + "\n".join(f"  - {w}" for w in WARNINGS))
    md = (f"## PitchPredict: {'ACTED' if decision.action == 'predict' else 'SKIPPED'}\n\n"
          + "\n".join(f"- {l}" for l in lines))
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
    dry = parser.parse_args().dry_run

    import backfill_predictions
    import fetch_fixtures
    import ingest_matches
    from db import get_client

    print(f"PitchPredict run, season {CURRENT_SEASON}, "
          f"{datetime.now(timezone.utc):%Y-%m-%d %H:%M} UTC{', DRY RUN' if dry else ''}")
    sb = get_client()

    step(1, "fetch fixtures and results (football-data.org)", lambda: fetch_fixtures.run(dry, client=sb))
    step(2, "ingest match results (football-data.co.uk)", lambda: ingest_matches.run(dry, client=sb))
    step(3, "team-name check", lambda: team_check(sb))
    gap = step(4, "staleness report", lambda: staleness(sb))
    decision, fixtures = step(5, "decide whether a matchweek is due", lambda: decide_now(sb))
    forecast = None
    if decision.action == "predict":
        forecast = step(6, f"forecast matchweek {decision.matchweek}",
                        lambda: predict_round(sb, decision, fixtures, dry))
    else:
        print(f"\nSTEP 6: forecast skipped ({decision.reason})")
    backfill = step(7, "backfill finished fixtures without a real forecast",
                    lambda: backfill_predictions.run(sb, dry_run=dry))
    if backfill and backfill["stale_groups"]:
        warn(f"{sum(n for *_, n in backfill['stale_groups'])} finished fixture(s) not backfilled yet: "
             "their training data is missing earlier results (see step 7).")
    step(8, "summary", lambda: summary(sb, dry, decision, forecast, backfill, gap or 0))


if __name__ == "__main__":
    main()
