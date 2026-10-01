"""Backfill out-of-sample forecasts for already-played matchweeks of the current season.

Usage:
    .venv/bin/python backfill_predictions.py            # fit, predict, write to predictions
    .venv/bin/python backfill_predictions.py --dry-run  # everything except the write

For every matchweek with FINISHED fixtures, the model is fit only on matches played
strictly before that matchweek's first kickoff (`ref`), exactly as fit_predict.py would
have done had it run just before the matchweek started, and the finished fixtures are
predicted. Rows are written with is_backfill = true and predicted_at = ref, so a rerun
upserts onto the same keys instead of adding rows.

Postponed games: a fixture kicking off more than SPLIT_DAYS after its matchweek's first
kickoff starts its own group with its own ref (its kickoff), so it is fitted on the
data available just before it was actually played rather than weeks-old data.

A fixture that already has a real (non-backfill) forecast made before kickoff is
skipped: a real forecast always wins and is never overwritten or duplicated.

Training data that lags: `matches` comes from football-data.co.uk, which can trail the
results in current_fixtures by a day or two. If a group's training data is missing
current-season matches that current_fixtures says finished before its ref, the group is
not fitted (a backfill must reproduce what a forecast at ref would have seen). It is
listed with a warning and picked up by a later run once `matches` has caught up.
"""

import argparse

import numpy as np
import pandas as pd

from db import PAGE, get_client, load_all_fixtures, load_matches
from fit_predict import TABLE, load_params, model_version_for
from seasons import CURRENT_SEASON, PREVIOUS_SEASON
from shrinkage import fit_with_promoted_prior
from teams import check_team_names, promoted_model_names, to_model_name

SPLIT_DAYS = 4  # a fixture this long after its group's first kickoff starts a new group


def group_by_ref(fixtures):
    """[(matchweek, ref, fixtures DataFrame)] for the FINISHED fixtures.

    ref is the earliest kickoff among *all* fixtures of the matchweek (finished or not);
    a fixture more than SPLIT_DAYS after the current group's ref opens a new group
    whose ref is its own kickoff.
    """
    groups = []
    for mw, g in fixtures.groupby("matchweek"):
        g = g.sort_values(["kickoff", "id"])
        if not (g["status"] == "FINISHED").any():
            continue
        ref, members = g["kickoff"].min(), []
        for f in g.itertuples(index=False):
            if f.kickoff > ref + pd.Timedelta(days=SPLIT_DAYS):
                if members:
                    groups.append((mw, ref, members))
                ref, members = f.kickoff, []
            if f.status == "FINISHED":
                members.append(f)
        if members:
            groups.append((mw, ref, members))
    return [(mw, ref, pd.DataFrame(m)) for mw, ref, m in groups]


def real_forecast_ids(sb, fixtures):
    """Fixture ids that already have a non-backfill forecast made at or before kickoff."""
    kickoff = dict(zip(fixtures["id"], fixtures["kickoff"]))
    rows, start = [], 0
    while True:  # paged: PostgREST returns at most PAGE rows per request
        page = (
            sb.table(TABLE).select("fixture_id,predicted_at").eq("is_backfill", False)
            .order("fixture_id").order("model_version").order("predicted_at")
            .range(start, start + PAGE - 1).execute().data
        )
        rows.extend(page)
        if len(page) < PAGE:
            break
        start += PAGE
    return {
        r["fixture_id"] for r in rows
        if r["fixture_id"] in kickoff
        and pd.Timestamp(r["predicted_at"]) <= kickoff[r["fixture_id"]]
    }


def pick(p_home, p_draw, p_away):
    """Argmax of the three probabilities; ties home > away > draw (as in matchweek_predictions)."""
    if p_home >= p_draw and p_home >= p_away:
        return "H"
    return "A" if p_away >= p_draw else "D"


def actual(home_goals, away_goals):
    if home_goals > away_goals:
        return "H"
    return "A" if home_goals < away_goals else "D"


def missing_before(fixtures, train, ref):
    """How many current-season matches current_fixtures has as FINISHED before ref, minus
    how many of them the training data (from `matches`) has. > 0 means stale training data."""
    finished = int(((fixtures["status"] == "FINISHED") & (fixtures["kickoff"] < ref)).sum())
    have = int((train["season"] == CURRENT_SEASON).sum())
    return finished - have


def predict_group(model, fixtures):
    out = []
    for f in fixtures.itertuples(index=False):
        p = model.predict(to_model_name(f.home_team), to_model_name(f.away_team))
        i, j = np.unravel_index(np.argmax(p["score_matrix"]), p["score_matrix"].shape)
        out.append({
            "fixture_id": int(f.id),
            "matchweek": int(f.matchweek),
            "home_team": f.home_team,  # as named in current_fixtures, not the mapped name
            "away_team": f.away_team,
            "p_home": round(p["home_win"], 6),
            "p_draw": round(p["draw"], 6),
            "p_away": round(p["away_win"], 6),
            "exp_home_goals": round(p["exp_home_goals"], 6),
            "exp_away_goals": round(p["exp_away_goals"], 6),
            "modal_score": f"{i}-{j}",
        })
    return out


def run(sb=None, dry_run=False):
    """Backfill every finished fixture lacking a real pre-kickoff forecast. Returns a summary dict."""
    xi, shrink = load_params()
    model_version = model_version_for(xi, shrink)

    sb = sb or get_client()
    df = load_matches(sb)
    fixtures = load_all_fixtures(sb, CURRENT_SEASON)
    summary = {"written": 0, "stale_groups": []}
    if not (fixtures["status"] == "FINISHED").any():
        print(f"No finished {CURRENT_SEASON} fixtures yet; nothing to backfill.")
        return summary
    if not check_team_names(fixtures, df, CURRENT_SEASON):
        raise SystemExit("ERROR: fix teams.py (see above) before backfilling")
    promoted = promoted_model_names(fixtures, df, PREVIOUS_SEASON)
    skip = real_forecast_ids(sb, fixtures)
    print(f"Loaded {len(df)} played matches and {len(fixtures)} {CURRENT_SEASON} fixtures; "
          f"promoted in {CURRENT_SEASON}: {', '.join(sorted(promoted))}")
    print(f"{len(skip)} fixture(s) already have a real pre-kickoff forecast; "
          "finished ones among them are skipped\n")

    print(f"  {'mw':>2} {'ref (UTC)':<16} {'train':>5} {'cur-season':>10} {'predicted':>9} "
          f"{'skipped':>7} {'hits':>4}")
    rows, details, tot_n, tot_hits = [], [], 0, 0
    for mw, ref, group in group_by_ref(fixtures):
        train = df[df["date"] < ref]
        # The honesty guarantee: nothing on or after ref may reach the fit.
        assert (train["date"] < ref).all() and train["date"].max() < ref, f"leak in matchweek {mw}"
        assert not group["kickoff"].lt(ref).any(), f"fixture before ref in matchweek {mw}"
        n_cur = int((train["season"] == CURRENT_SEASON).sum())

        todo = group[~group["id"].isin(skip)]
        gap = missing_before(fixtures, train, ref) if len(todo) else 0
        if gap > 0:
            summary["stale_groups"].append((mw, ref, gap, len(todo)))
            print(f"  {mw:>2} {ref:%Y-%m-%d %H:%M} {len(train):5d} {n_cur:10d} {'held':>9} "
                  f"{len(group):7d}     WARNING: training data lacks {gap} finished {CURRENT_SEASON} "
                  f"match(es) before this ref; not backfilled this run")
            continue
        hits = 0
        if len(todo):
            model = fit_with_promoted_prior(train, ref, xi, shrink, promoted)
            if not model.converged:
                raise SystemExit(f"ERROR: fit for matchweek {mw} (ref {ref}) did not converge")
            preds = predict_group(model, todo)
            goals = todo.set_index("id")[["home_goals", "away_goals"]]
            for p in preds:
                hg, ag = goals.loc[p["fixture_id"]]
                pk, ac = pick(p["p_home"], p["p_draw"], p["p_away"]), actual(int(hg), int(ag))
                hits += pk == ac
                details.append((mw, p, int(hg), int(ag), pk, ac))
                rows.append(p | {"model_version": model_version,
                                 "predicted_at": ref.isoformat(),
                                 "is_backfill": True})
        tot_n, tot_hits = tot_n + len(todo), tot_hits + hits
        print(f"  {mw:>2} {ref:%Y-%m-%d %H:%M} {len(train):5d} {n_cur:10d} {len(todo):9d} "
              f"{len(group) - len(todo):7d} {hits:4d}")
    print(f"  season total: {tot_hits} correct of {tot_n}"
          + (f" ({tot_hits / tot_n:.1%})" if tot_n else ""))
    if summary["stale_groups"]:
        held = sum(n for *_, n in summary["stale_groups"])
        print(f"\nWARNING: {held} fixture(s) in {len(summary['stale_groups'])} group(s) held back because "
              "matches (football-data.co.uk) has not caught up with current_fixtures yet; "
              "a later run will backfill them. If this persists for more than a few days, "
              "compare the two sources.")

    print("\nPer fixture:")
    print(f"  {'mw':>2} {'home':<15} {'away':<15} {'p_home':>6} {'p_draw':>6} {'p_away':>6} "
          f"{'score':>5} {'pick':>4} {'act':>3}")
    for mw, p, hg, ag, pk, ac in details:
        print(f"  {mw:>2} {p['home_team']:<15} {p['away_team']:<15} {p['p_home']:6.3f} "
              f"{p['p_draw']:6.3f} {p['p_away']:6.3f} {f'{hg}-{ag}':>5} {pk:>4} {ac:>3}"
              + ("" if pk == ac else "  x"))

    if dry_run:
        print(f"\nDry run: {len(rows)} rows not written ({model_version}, is_backfill = true).")
        return summary
    if rows:
        sb.table(TABLE).upsert(rows, on_conflict="fixture_id,model_version,predicted_at").execute()
    print(f"\nUpserted {len(rows)} rows into {TABLE} ({model_version}, is_backfill = true).")
    summary["written"] = len(rows)
    return summary


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--dry-run", action="store_true", help="everything except the write to Supabase")
    args = parser.parse_args()
    run(dry_run=args.dry_run)


if __name__ == "__main__":
    main()
