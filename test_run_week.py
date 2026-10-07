"""Self-tests for run_week.decide() and the training-set helpers. No database needed.

    .venv/bin/python test_run_week.py     # prints PASS/FAIL per case, exit 1 on any failure
    pytest test_run_week.py               # also works, if pytest is installed

Fixtures are synthetic: matchweek k of a 20-team league kicks off on Saturday
2026-08-15 + 7(k-1) days, its ten games spread over Sat-Mon.
"""

import sys
import traceback

import numpy as np
import pandas as pd

from run_week import check_training_window, decide, supplement_training
from teams import TEAM_MAP

TEAMS = sorted(TEAM_MAP)[:20]  # football-data.org names, all mapped
SEASON = "2026-2027"
START = pd.Timestamp("2026-08-15 11:30", tz="UTC")


def ts(s):
    return pd.Timestamp(s, tz="UTC")


def round_robin(mw):
    """Ten (home, away) pairs for matchweek mw (1-38) by the circle method, second half
    reversed, so every pairing occurs once per season as in a real league."""
    k = (mw - 1) % 19
    order = [TEAMS[0]] + [TEAMS[1 + (i + k) % 19] for i in range(19)]
    pairs = [(order[i], order[19 - i]) for i in range(10)]
    return [(a, h) for h, a in pairs] if mw > 19 else pairs


def fixtures_through(n_weeks, finished_through=0):
    """Matchweeks 1..n_weeks; those <= finished_through FINISHED (1-0), the rest TIMED."""
    rows, fid = [], 1000
    for mw in range(1, n_weeks + 1):
        sat = START + pd.Timedelta(days=7 * (mw - 1))
        for g, (h, a) in enumerate(round_robin(mw)):
            kickoff = sat + pd.Timedelta(days=g // 4, hours=2 * (g % 4))  # Sat x4, Sun x4, Mon x2
            done = mw <= finished_through
            rows.append({"id": fid, "season": SEASON, "matchweek": mw, "kickoff": kickoff,
                         "status": "FINISHED" if done else "TIMED", "home_team": h, "away_team": a,
                         "home_goals": 1 if done else pd.NA, "away_goals": 0 if done else pd.NA})
            fid += 1
    df = pd.DataFrame(rows)
    df[["home_goals", "away_goals"]] = df[["home_goals", "away_goals"]].astype("Int64")
    return df.sort_values(["kickoff", "id"]).reset_index(drop=True)


def forecasts_for(ids, predicted_at, is_backfill=False):
    return pd.DataFrame({"fixture_id": list(ids), "predicted_at": [predicted_at] * len(ids),
                         "is_backfill": [is_backfill] * len(ids)})


NO_FORECASTS = pd.DataFrame({"fixture_id": pd.Series(dtype="int64"),
                             "predicted_at": pd.Series(dtype="datetime64[ns, UTC]"),
                             "is_backfill": pd.Series(dtype=bool)})


def mw_ids(fx, mw):
    return fx.loc[fx["matchweek"] == mw, "id"].tolist()


def sat(mw):
    return START + pd.Timedelta(days=7 * (mw - 1))


# --- decide() ------------------------------------------------------------------------------

def test_a_next_matchweek_due():
    now = sat(7) - pd.Timedelta(days=3)  # Wednesday before MW7; MW1-6 finished
    fx = fixtures_through(10, finished_through=6)
    d = decide(fx, NO_FORECASTS, now)
    assert d.action == "predict", d.reason
    assert d.matchweek == 7 and len(d.target) == 10, (d.matchweek, len(d.target))
    assert d.first_kickoff == sat(7)


def test_b_already_forecast_and_backfill_does_not_count():
    now = sat(7) - pd.Timedelta(days=2)
    fx = fixtures_through(10, finished_through=6)
    ids = mw_ids(fx, 7)
    d = decide(fx, forecasts_for(ids, now - pd.Timedelta(days=1)), now)
    assert d.action == "skip" and "already forecast" in d.reason, d.reason
    # Backfill rows are not forecasts.
    d = decide(fx, forecasts_for(ids, now - pd.Timedelta(days=1), is_backfill=True), now)
    assert d.action == "predict" and len(d.target) == 10, d.reason


def test_c_waits_for_unfinished_earlier_fixture():
    now = sat(7) - pd.Timedelta(days=3)
    fx = fixtures_through(10, finished_through=6)
    i = fx.index[fx["matchweek"] == 6][-1]
    fx.loc[i, ["status", "home_goals", "away_goals"]] = ["TIMED", pd.NA, pd.NA]
    d = decide(fx, NO_FORECASTS, now)
    assert d.action == "skip" and "waiting for 1 earlier fixture" in d.reason, d.reason
    assert fx.loc[i, "home_team"] in d.reason


def test_d_postponed_does_not_block():
    now = sat(7) - pd.Timedelta(days=3)
    fx = fixtures_through(10, finished_through=6)
    i = fx.index[fx["matchweek"] == 5][0]
    fx.loc[i, ["status", "home_goals", "away_goals"]] = ["POSTPONED", pd.NA, pd.NA]
    d = decide(fx, NO_FORECASTS, now)
    assert d.action == "predict" and d.matchweek == 7 and len(d.target) == 10, d.reason


def test_e_matchweek_under_way():
    now = sat(7) + pd.Timedelta(hours=5)  # Saturday afternoon: three MW7 games played
    fx = fixtures_through(10, finished_through=6)
    week = fx.index[fx["matchweek"] == 7]
    first3 = fx.loc[week].sort_values("kickoff").index[:3]
    fx.loc[first3, ["status", "home_goals", "away_goals"]] = ["FINISHED", 2, 2]
    assert (fx.loc[week.difference(first3), "kickoff"] > now).all()
    d = decide(fx, NO_FORECASTS, now)
    assert d.action == "skip" and "under way (3 of 10 played)" in d.reason, d.reason


def test_f_detached_rescheduled_fixture():
    # MW5's tenth game was postponed and rescheduled to a December midweek; MW1-15 finished.
    now = ts("2026-12-01 09:00")
    fx = fixtures_through(20, finished_through=15)
    i = fx.index[fx["matchweek"] == 5][-1]
    fx.loc[i, ["status", "home_goals", "away_goals", "kickoff"]] = ["TIMED", pd.NA, pd.NA, ts("2026-12-02 19:30")]
    # MW16 is Sat 2026-11-28 .. Mon 11-30, so "finished_through=15" leaves it TIMED in the past:
    # mark it FINISHED so the rescheduled game is the next kickoff with nothing pending before it.
    fx.loc[fx["matchweek"] == 16, ["status", "home_goals", "away_goals"]] = ["FINISHED", 0, 0]
    fx = fx.sort_values(["kickoff", "id"]).reset_index(drop=True)
    d = decide(fx, NO_FORECASTS, now)
    assert d.action == "predict", d.reason
    assert d.matchweek == 5 and d.target["id"].tolist() == [fx.loc[fx["kickoff"] == ts("2026-12-02 19:30"), "id"].item()]
    assert "rescheduled" in d.reason, d.reason


def test_g_rescheduled_fixture_excluded_from_round():
    now = sat(7) - pd.Timedelta(days=3)
    fx = fixtures_through(12, finished_through=6)
    i = fx.index[fx["matchweek"] == 7][-1]
    fx.loc[i, "kickoff"] = sat(7) + pd.Timedelta(days=21, hours=8)
    fx = fx.sort_values(["kickoff", "id"]).reset_index(drop=True)
    d = decide(fx, NO_FORECASTS, now)
    assert d.action == "predict" and d.matchweek == 7, d.reason
    assert len(d.round) == 9 and len(d.target) == 9, (len(d.round), len(d.target))


def test_h_partial_forecasts():
    now = sat(7) - pd.Timedelta(days=2)
    fx = fixtures_through(10, finished_through=6)
    ids = mw_ids(fx, 7)
    d = decide(fx, forecasts_for(ids[:6], now - pd.Timedelta(hours=5)), now)
    assert d.action == "predict" and sorted(d.target["id"]) == sorted(ids[6:]), d.reason
    assert "4 of them without a forecast" in d.reason, d.reason


def test_i_no_upcoming_fixtures():
    now = sat(10) + pd.Timedelta(days=5)
    fx = fixtures_through(10, finished_through=10)
    d = decide(fx, NO_FORECASTS, now)
    assert d.action == "skip" and d.reason == "no dated fixtures left to play", d.reason
    d = decide(fx.iloc[0:0], NO_FORECASTS, now)
    assert d.action == "skip"


def test_j_forecast_after_kickoff_does_not_count():
    now = sat(7) - pd.Timedelta(days=2)
    fx = fixtures_through(10, finished_through=6)
    ids = mw_ids(fx, 7)
    # Rows stamped after kickoff (impossible for a real run, but never trusted).
    d = decide(fx, forecasts_for(ids, sat(7) + pd.Timedelta(days=3)), now)
    assert d.action == "predict" and len(d.target) == 10, d.reason


def test_k_in_play_earlier_fixture_blocks_and_cancelled_does_not():
    now = sat(7) - pd.Timedelta(days=3)
    fx = fixtures_through(10, finished_through=6)
    i, j = fx.index[fx["matchweek"] == 6][-2:]
    fx.loc[i, "status"] = "CANCELLED"
    assert decide(fx, NO_FORECASTS, now).action == "predict"
    fx.loc[j, "status"] = "IN_PLAY"
    d = decide(fx, NO_FORECASTS, now)
    assert d.action == "skip" and "IN_PLAY" in d.reason, d.reason


# --- training-set helpers ------------------------------------------------------------------

def training_from(fx):
    """A `matches`-shaped frame of the FINISHED fixtures, with model names."""
    done = fx[fx["status"] == "FINISHED"]
    df = pd.DataFrame({"id": [f"m{i}" for i in done["id"]], "season": done["season"],
                       "home_team": done["home_team"].map(TEAM_MAP), "away_team": done["away_team"].map(TEAM_MAP),
                       "home_goals": done["home_goals"].astype(int), "away_goals": done["away_goals"].astype(int),
                       "odds_home": 2.0, "odds_draw": 3.0, "odds_away": 4.0, "date": done["kickoff"]})
    return df.reset_index(drop=True)


def test_supplement_adds_lagging_results():
    now = sat(7) - pd.Timedelta(days=3)
    fx = fixtures_through(10, finished_through=6)
    lagging = fx[fx["matchweek"] == 6].tail(3)
    df = training_from(fx[~fx["id"].isin(lagging["id"])])
    out, added = supplement_training(df, fx, sat(7))
    assert len(out) == len(df) + 3 and sorted(added["id"]) == sorted(lagging["id"])
    assert set(out["id"]) - set(df["id"]) == {f"fixture-{i}" for i in lagging["id"]}
    assert out["date"].is_monotonic_increasing and out["odds_home"].isna().sum() == 3
    assert out["home_goals"].dtype == np.int64 or str(out["home_goals"].dtype).startswith("int")
    # Nothing to add: unchanged.
    out2, added2 = supplement_training(training_from(fx), fx, sat(7))
    assert len(out2) == len(training_from(fx)) and added2.empty


def test_check_training_window():
    now = sat(7) - pd.Timedelta(days=3)
    fx = fixtures_through(10, finished_through=6)
    target = fx[fx["matchweek"] == 7]
    df = training_from(fx)
    check_training_window(df, target, sat(7), now)  # clean: no exception

    def fails(df_, target_, now_):
        try:
            check_training_window(df_, target_, sat(7), now_)
        except SystemExit as e:
            return str(e.code)
        return None

    late = df.copy()
    late.loc[len(late) - 1, "date"] = sat(7)
    assert "at or after" in fails(late, target, now)
    leaked = pd.concat([df, training_from(target.assign(status="FINISHED", home_goals=1, away_goals=1)).head(1)
                        .assign(date=now - pd.Timedelta(days=1))], ignore_index=True)
    assert "already in the training data" in fails(leaked, target, now)
    assert "already kicked off" in fails(df, target, sat(7) + pd.Timedelta(minutes=1))


TESTS = [(name, fn) for name, fn in sorted(globals().items()) if name.startswith("test_") and callable(fn)]


if __name__ == "__main__":
    failed = 0
    for name, fn in TESTS:
        try:
            fn()
            print(f"PASS  {name}")
        except Exception:
            failed += 1
            print(f"FAIL  {name}")
            traceback.print_exc()
    print(f"\n{len(TESTS) - failed} passed, {failed} failed")
    sys.exit(1 if failed else 0)
