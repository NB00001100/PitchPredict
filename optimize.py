"""Tune the Dixon-Coles time-decay rate xi and the promoted-team shrinkage strictly
through the walk-forward harness.

C1: run backtest.run_walk_forward for every (xi, shrink) on a fixed grid, pick the
    lowest overall out-of-sample RPS (all test matches), write model_config.json and
    regenerate backtest_report.md at the winner with the grid tables appended.
C2: scaffold only for a stacked meta-model (stubs below, not wired).
C3: calibration, a comment only (see bottom of the file).

Usage:
    .venv/bin/python optimize.py
"""

import json
import os
import time
from datetime import datetime, timezone

import numpy as np

from backtest import (CONFIG_PATH, REPORT_PATH, build_report, ci_text, fmt, headline_table,
                      log_loss, paired_bootstrap, rps, run_walk_forward, save_preds,
                      score_frame, shrinkage_section, summarise)
from db import load_matches

XI_GRID = [0.0, 0.0015, 0.0018, 0.002, 0.0025, 0.003, 0.004]
SHRINK_GRID = [0, 2, 5, 10, 20, 40]
REFERENCE = (0.003, 0)     # the configuration before shrinkage was added


# ---------------------------------------------------------------------- #
# C1: grid search over xi
# ---------------------------------------------------------------------- #
def run_grid(matches, xi_grid=XI_GRID, shrink_grid=SHRINK_GRID):
    """{(xi, shrink): (preds, runtime_s)} for every pair, all from the same loaded data."""
    results = {}
    for xi in xi_grid:
        for shrink in shrink_grid:
            t0 = time.time()
            preds = run_walk_forward(matches, xi, shrink=shrink)
            results[(xi, shrink)] = (preds, time.time() - t0)
            save_preds(preds, xi, shrink)
            m = summarise(score_frame(preds))["model"]
            print(f"xi={xi:<7} shrink={shrink:<3} RPS {m['rps']:.6f} log loss {m['log_loss']:.4f} "
                  f"({results[(xi, shrink)][1]:.1f} s)")
    return results


def model_metric_by_match(preds, metric=rps):
    """Per-match model metric indexed by match id (for pairing across configurations)."""
    s = score_frame(preds)
    return dict(zip(s["id"], metric(s[["p_home", "p_draw", "p_away"]].to_numpy(), s["y"].to_numpy())))


def paired_ci(results, a, b, metric=rps):
    """Paired bootstrap (mean, lo, hi) of metric(a) - metric(b) over the common test matches."""
    ma, mb = model_metric_by_match(results[a][0], metric), model_metric_by_match(results[b][0], metric)
    ids = sorted(ma)
    return paired_bootstrap(np.array([ma[i] - mb[i] for i in ids])), len(ids)


def grid_table(results, key, best):
    xis = sorted({x for x, _ in results})
    shrinks = sorted({k for _, k in results})
    L = ["| xi \\ shrink | " + " | ".join(str(k) for k in shrinks) + " |",
         "|---:|" + "---:|" * len(shrinks)]
    for xi in xis:
        cells = []
        for k in shrinks:
            v = fmt(summarise(score_frame(results[(xi, k)][0]))["model"][key])
            cells.append(f"**{v}**" if (xi, k) == best else v)
        L.append(f"| {xi} | " + " | ".join(cells) + " |")
    return L


def grid_section(results, best, reference=REFERENCE):
    """Markdown for the xi x shrink tables, the selection caveat and the chosen-vs-reference CIs."""
    overall = {c: summarise(score_frame(p))["model"] for c, (p, _) in results.items()}
    L = ["## Choice of xi and shrink", "",
         "Each cell is a complete walk-forward run (same weeks, same test matches); only the "
         "Dixon-Coles model changes, so the baselines are identical across cells. Model metrics "
         "on all test matches; the chosen cell is in bold.", "",
         "Overall RPS:", ""] + grid_table(results, "rps", best) + [
         "", "Overall log loss:", ""] + grid_table(results, "log_loss", best)

    rps_all = [o["rps"] for o in overall.values()]
    L += ["", f"Selection rule: lowest overall mean out-of-sample RPS on all test matches. "
          f"Chosen xi = {best[0]}, shrink = {best[1]} (RPS {fmt(overall[best]['rps'])}, log loss "
          f"{fmt(overall[best]['log_loss'])}). Log loss is reported alongside because the "
          "shrinkage targets a handful of very overconfident forecasts, which RPS barely "
          "penalises and log loss penalises heavily. Spread of overall RPS across the whole grid: "
          f"{max(rps_all) - min(rps_all):.4f} (from {fmt(min(rps_all))} to {fmt(max(rps_all))}).", "",
          "**Caveat.** xi and shrink were chosen on the same out-of-sample weeks that the headline "
          f"numbers are reported on, so the headline is slightly optimistic: it is the best of "
          f"{len(results)} tries, not a fresh test.", ""]

    if best == reference:
        L.append(f"The chosen configuration is the reference (xi={reference[0]}, shrink={reference[1]}), "
                 "so there is no chosen-vs-reference difference to test.")
    else:
        for label, metric in (("RPS", rps), ("log loss", log_loss)):
            ci, n = paired_ci(results, best, reference, metric)
            side = "excludes zero" if ci[1] > 0 or ci[2] < 0 else "includes zero"
            L.append(f"- Paired bootstrap 95% CI for {label}(xi={best[0]}, shrink={best[1]}) - "
                     f"{label}(xi={reference[0]}, shrink={reference[1]}) over {n} test matches: "
                     f"{ci_text(*ci)}. The interval {side}.")

    # Is the choice among shrink > 0 meaningful? Compare best and worst shrink > 0 at the chosen xi.
    pos = [(best[0], k) for k in sorted({k for _, k in results}) if k > 0]
    if best[1] > 0 and len(pos) > 1:
        worst = max(pos, key=lambda c: overall[c]["rps"])
        lo_c = min(pos, key=lambda c: overall[c]["rps"])
        ci, n = paired_ci(results, lo_c, worst)
        flat = not (ci[1] > 0 or ci[2] < 0)
        L += ["", f"At xi = {best[0]}, overall RPS across shrink > 0 ranges from "
              f"{fmt(overall[lo_c]['rps'])} (shrink {lo_c[1]}) to {fmt(overall[worst]['rps'])} "
              f"(shrink {worst[1]}); best minus worst: {ci_text(*ci)}."
              + (" Even the largest difference between shrink values is not distinguishable from "
                 "resampling noise at this sample size, so the particular shrink value chosen should "
                 "not be read as meaningful; what the data do support is that some shrinkage removes "
                 "the extreme forecasts (see the promoted-team shrinkage section)." if flat else
                 " The difference between shrink values is distinguishable from noise.")]
        smallest = min(k for _, k in pos)
        if best[1] == smallest:
            L += ["", f"The chosen shrink ({best[1]}) is the smallest non-zero value in the grid, so "
                  "the optimum may lie below it; the grid does not show where RPS turns back up."]
    return "\n".join(L)


def write_config(best, results):
    s = summarise(score_frame(results[best][0]))
    grid_rps, grid_ll = {}, {}
    for (xi, k), (p, _) in results.items():
        m = summarise(score_frame(p))["model"]
        grid_rps.setdefault(str(xi), {})[str(k)] = round(m["rps"], 6)
        grid_ll.setdefault(str(xi), {})[str(k)] = round(m["log_loss"], 6)
    config = {
        "xi": best[0],
        "shrink": best[1],
        "chosen_on": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "selection": "lowest overall mean out-of-sample RPS, walk-forward (backtest.py), "
                     "all test matches (skip_early=0), joint grid over xi and shrink",
        "rps": round(s["model"]["rps"], 6),
        "log_loss": round(s["model"]["log_loss"], 6),
        "n_test_matches": s["n"],
        "grid_rps": grid_rps,
        "grid_log_loss": grid_ll,
    }
    with open(CONFIG_PATH, "w") as f:
        json.dump(config, f, indent=2)
        f.write("\n")
    return config


# ---------------------------------------------------------------------- #
# C2: stacking scaffold (NOT wired; stubs only)
# ---------------------------------------------------------------------- #
def stack_features(preds):
    """STUB. Feature matrix for a stacked meta-model: for now just the walk-forward
    out-of-fold Dixon-Coles probabilities, shape (n, 3), columns [home, draw, away].

    Intended interface (not implemented):
        X = stack_features(preds)              # preds = run_walk_forward(...) output
        model = fit_stacker(X_train, y_train)  # y = preds["y"], 0/1/2 for H/D/A
        P = predict_stacker(model, X_test)     # (n, 3) probabilities

    Later candidate columns, each added ONE AT A TIME and kept only if it lowers
    out-of-sample RPS through this same walk-forward harness:
        - Elo rating difference (home minus away)
        - rest days for each side since its previous match
        - de-vigged market probability (only for a model meant to be used once odds exist)
    """
    return preds[["p_home", "p_draw", "p_away"]].to_numpy()


def fit_stacker(X, y):
    """STUB. Meta-model on out-of-fold features: multinomial logistic regression
    (or gradient boosting) trained ONLY on rows from earlier weeks than those it
    predicts, i.e. nested inside the walk-forward loop, never on the test week.
    """
    raise NotImplementedError("C2 stacking is scaffold only")


def predict_stacker(model, X):
    """STUB. (n, 3) probabilities from a fitted meta-model."""
    raise NotImplementedError("C2 stacking is scaffold only")


# ---------------------------------------------------------------------- #
# C3: calibration (comment only, deliberately no code)
# ---------------------------------------------------------------------- #
# Platt scaling or isotonic regression could be fitted on out-of-sample folds
# (walk-forward predictions from earlier weeks) and then frozen before being
# applied to later weeks. But Dixon-Coles probabilities are already reasonably
# calibrated, and the gap to the market is resolution (the market separates
# likely from unlikely outcomes better, using information the model does not
# have), which calibration cannot fix.


def main():
    t0 = time.time()
    matches = load_matches()
    print(f"loaded {len(matches)} matches; xi grid {XI_GRID}; shrink grid {SHRINK_GRID}")
    results = run_grid(matches)

    best = min(results, key=lambda c: summarise(score_frame(results[c][0]))["model"]["rps"])
    config = write_config(best, results)
    print(f"chosen xi = {best[0]}, shrink = {best[1]} (RPS {config['rps']:.6f}); wrote {CONFIG_PATH}")

    preds, runtime = results[best]
    shrink_sec = (shrinkage_section(results[(best[0], 0)][0], preds, best[0], best[1])
                  if best[1] > 0 else None)
    section = grid_section(results, best)
    with open(REPORT_PATH, "w") as f:
        f.write(build_report(preds, matches, best[0], runtime, xi_section=section,
                             shrink=best[1], shrink_section=shrink_sec))
    print(headline_table(preds))
    print()
    if shrink_sec:
        print(shrink_sec)
        print()
    print(section)
    print(f"wrote {REPORT_PATH}")
    print(f"optimize.py total runtime: {time.time() - t0:.1f} s")


if __name__ == "__main__":
    main()
