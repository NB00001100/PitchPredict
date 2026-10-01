"""Shrinkage of newly promoted teams' ratings, shared by backtest.py and fit_predict.py.

Plain maximum likelihood has nothing pulling a promoted side's rating towards
anything, so after a handful of matches it can run to the rating bounds (e.g. a
team that has not scored yet). The fix used here:

  1. Plain fit on the training data.
  2. Prior centre = mean attack and mean defense of the three weakest established
     teams in that fit (established = rated, not promoted this season, played
     within RECENT_DAYS of ref_date; weakest = lowest attack + defense).
  3. Refit with a Gaussian prior (strength `shrink`) pulling each promoted team
     towards that centre. A promoted team keeps the prior all season; it fades on
     its own as its matches accumulate. Next season it is no longer promoted.
  4. Promoted teams with no matches in the training data at all get the centre
     itself (the shrink -> infinity limit; this is the old backtest fallback).

With shrink = 0 step 3 is skipped, which reproduces the plain fit plus fallback.
"""

import numpy as np
import pandas as pd

from dixon_coles import DixonColes

RECENT_DAYS = 380      # "recently active" window for choosing the prior centre


def clean_number(x):
    """5.0 -> 5 so that file names and model versions read shrink5, not shrink5.0."""
    x = float(x)
    return int(x) if x.is_integer() else x


def promoted_teams(df, season):
    """Teams that play in `season` but not in the immediately preceding season of df.

    League membership is known before a season starts, so this is not leakage.
    Returns an empty set for the first season in df (no preceding season to compare).
    """
    seasons = sorted(df["season"].unique())
    if season not in seasons:
        raise ValueError(f"season {season!r} not in data")
    k = seasons.index(season)
    if k == 0:
        return set()

    def teams_of(s):
        g = df[df["season"] == s]
        return set(g["home_team"]) | set(g["away_team"])

    return teams_of(season) - teams_of(seasons[k - 1])


def weakest_centre(model, train, ref_date, exclude=()):
    """(attack, defense) mean of the three weakest recently-active rated teams, and those teams.

    Weakest = lowest attack + defense (higher defense means fewer goals conceded).
    Only teams that played in the RECENT_DAYS before ref_date are candidates, so
    stale ratings of long-relegated teams do not define "weakest"; teams in
    `exclude` (the promoted sides) are never candidates.
    """
    recent = train[train["date"] >= ref_date - pd.Timedelta(days=RECENT_DAYS)]
    active = set(recent["home_team"]) | set(recent["away_team"])
    pool = [t for t in model.attack if t in active and t not in exclude]
    if len(pool) < 3:
        pool = [t for t in model.attack if t not in exclude]
    weakest = sorted(pool, key=lambda t: model.attack[t] + model.defense[t])[:3]
    att = float(np.mean([model.attack[t] for t in weakest]))
    dfn = float(np.mean([model.defense[t] for t in weakest]))
    return (att, dfn), weakest


def fit_with_promoted_prior(train, ref_date, xi, shrink, promoted):
    """Two-stage fit described in the module docstring. Returns the fitted model.

    Extra attributes on the returned model:
        prior_centre    (attack, defense) used as the centre
        prior_basis     the three teams the centre was computed from
        prior_teams     promoted teams that were in train and got the prior in the fit
        fallback_teams  promoted teams with no matches in train, set to the centre
        stage1_attack / stage1_defense  ratings from the plain fit (before shrinkage)
    """
    promoted = set(promoted)
    plain = DixonColes(xi=xi).fit(train, ref_date=ref_date)
    centre, basis = weakest_centre(plain, train, ref_date, exclude=promoted)

    stage1_attack, stage1_defense = dict(plain.attack), dict(plain.defense)

    rated = {t for t in promoted if t in plain.attack} if shrink > 0 else set()
    model = plain
    if rated:
        model = DixonColes(xi=xi, shrink=shrink).fit(
            train, ref_date=ref_date, priors={t: centre for t in rated})

    fallback = {t for t in promoted if t not in model.attack}
    for t in fallback:
        model.attack[t], model.defense[t] = centre

    model.prior_centre = centre
    model.prior_basis = basis
    model.prior_teams = rated
    model.fallback_teams = fallback
    model.stage1_attack, model.stage1_defense = stage1_attack, stage1_defense
    return model
