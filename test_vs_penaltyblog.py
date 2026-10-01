"""
Correctness check: our from-scratch Dixon-Coles vs penaltyblog's DixonColesGoalModel.

Both models are fit on the full 2024/25 Premier League season with no time
weighting, then the 1X2 probabilities are compared for every home/away pairing
of the 20 teams. The parameterisations differ (penaltyblog uses
log(lambda) = attack_h + defence_a + hfa and sum(attack) = n_teams), so only
probabilities are compared, not parameters.

Run as a script:   .venv/bin/python test_vs_penaltyblog.py
or with pytest:    .venv/bin/python -m pytest test_vs_penaltyblog.py -s
Requires network access to football-data.co.uk.
"""

import io
import itertools
import urllib.request

import numpy as np
import pandas as pd
import penaltyblog as pb

from dixon_coles import DixonColes

SEASON_URL = "https://www.football-data.co.uk/mmz4281/2425/E0.csv"
TOLERANCE = 0.03
# Score grid size: goals 0..14 for both models.
MAX_GOALS_INCLUSIVE = 14


def load_season(url=SEASON_URL):
    """Download one football-data.co.uk season into the DixonColes input format."""
    # urllib follows HTTP redirects by default.
    with urllib.request.urlopen(url, timeout=60) as resp:
        text = resp.read().decode("utf-8-sig")
    raw = pd.read_csv(io.StringIO(text))
    raw = raw.dropna(subset=["HomeTeam", "AwayTeam", "FTHG", "FTAG"])
    return pd.DataFrame({
        "date": pd.to_datetime(raw["Date"], format="%d/%m/%Y"),
        "home_team": raw["HomeTeam"].astype(str),
        "away_team": raw["AwayTeam"].astype(str),
        "home_goals": raw["FTHG"].astype(int),
        "away_goals": raw["FTAG"].astype(int),
    }).reset_index(drop=True)


def _fit_penaltyblog(df, use_gradient):
    """penaltyblog Dixon-Coles fit; weights=None means every match has weight 1."""
    model = pb.models.DixonColesGoalModel(
        df["home_goals"], df["away_goals"], df["home_team"], df["away_team"]
    )
    model.fit(use_gradient=use_gradient)
    return model


def _max_mean_1x2_diff(ours, theirs, teams):
    """Max / mean absolute 1X2 difference over every ordered home/away pairing."""
    diffs = []
    for home, away in itertools.permutations(teams, 2):
        p_ours = ours.predict(home, away, max_goals=MAX_GOALS_INCLUSIVE)
        # penaltyblog's max_goals is the grid size, i.e. goals 0..max_goals-1.
        grid = theirs.predict(home, away, max_goals=MAX_GOALS_INCLUSIVE + 1)
        diffs.append([p_ours["home_win"] - grid.home_win,
                      p_ours["draw"] - grid.draw,
                      p_ours["away_win"] - grid.away_win])
    diffs = np.abs(np.array(diffs))
    return float(diffs.max()), float(diffs.mean()), len(diffs)


def compare_models(df):
    """Fit both models and return a dict of comparison statistics.

    penaltyblog is fit twice: with its default analytic gradient, and with
    use_gradient=False. In penaltyblog 1.13.0 the analytic Dixon-Coles gradient
    does not match its own loss (finite-difference discrepancy ~0.3, largest on
    home advantage), so the default fit stops slightly short of the optimum
    (NLL ~0.003 higher). The numerical-gradient fit reaches the same optimum as
    ours and is the tighter reference.
    """
    ours = DixonColes(xi=0.0).fit(df)
    teams = sorted(set(df["home_team"]) | set(df["away_team"]))

    stats = {"n_matches": len(df), "n_teams": len(teams),
             "ours_converged": ours.converged, "ours_nll": ours.nll,
             "ours_home_adv": ours.home_adv, "ours_rho": ours.rho}
    for label, use_gradient in (("pb_default", True), ("pb_numgrad", False)):
        theirs = _fit_penaltyblog(df, use_gradient)
        params = theirs.get_params()
        max_d, mean_d, n_pairs = _max_mean_1x2_diff(ours, theirs, teams)
        stats.update({
            f"{label}_home_adv": float(params["home_advantage"]),
            f"{label}_rho": float(params["rho"]),
            f"{label}_nll": float(-theirs.loglikelihood),
            f"{label}_max_diff": max_d,
            f"{label}_mean_diff": mean_d,
            "n_pairings": n_pairs,
        })
    return stats


def test_matches_penaltyblog():
    df = load_season()
    assert len(df) == 380, f"expected 380 matches, got {len(df)}"

    st = compare_models(df)
    print(f"\npenaltyblog version: {pb.__version__}")
    print(f"matches: {st['n_matches']}, teams: {st['n_teams']}, "
          f"ordered pairings compared: {st['n_pairings']}")
    print(f"ours converged: {st['ours_converged']}")
    print(f"{'':34}{'home_adv':>10}{'rho':>10}{'NLL':>14}{'max |d1X2|':>12}{'mean |d1X2|':>12}")
    print(f"{'ours':34}{st['ours_home_adv']:10.5f}{st['ours_rho']:10.5f}{st['ours_nll']:14.6f}")
    for label, name in (("pb_default", "penaltyblog (default)"),
                        ("pb_numgrad", "penaltyblog (use_gradient=False)")):
        print(f"{name:34}{st[label + '_home_adv']:10.5f}{st[label + '_rho']:10.5f}"
              f"{st[label + '_nll']:14.6f}{st[label + '_max_diff']:12.6f}"
              f"{st[label + '_mean_diff']:12.6f}")

    assert st["ours_converged"]
    for label in ("pb_default", "pb_numgrad"):
        assert st[label + "_max_diff"] < TOLERANCE, (
            f"{label}: max 1X2 difference {st[label + '_max_diff']:.4f} exceeds {TOLERANCE}"
        )


if __name__ == "__main__":
    test_matches_penaltyblog()
    print("PASS")
