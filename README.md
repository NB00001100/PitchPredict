# PitchPredict

A Premier League match predictor built from scratch and evaluated honestly. For each
fixture it outputs home-win / draw / away-win probabilities and a most-likely
scoreline.

**Headline result.** Using nothing but historical scorelines, the model recovers 84% of
the gap between a naive baseline and the closing betting market, and finishes a small
but statistically real distance behind the market. It does not beat the bookmakers, and
it was never expected to.

| Forecaster | RPS (lower is better) | Most-likely outcome correct |
|---|---:|---:|
| Base rates only (floor) | 0.2322 | 42.9% |
| **PitchPredict (Dixon-Coles)** | **0.2003** | **51.7%** |
| Closing betting market (ceiling) | 0.1943 | 54.6% |

Measured on 1,190 held-out matches (2023/24 to September 2026). Full tables, per-season
splits and confidence intervals are in [`backtest_report.md`](backtest_report.md).

## Purpose

The goal is not to beat bookmakers; no public model has been shown to do that out of
sample. The goal is a forecasting system whose quality is measured properly: against a
floor, against a ceiling, on data the model has never seen, with uncertainty reported.

The betting market appears here only as an evaluation benchmark. Closing odds are the
strongest public forecast available, so they are the ceiling to measure against. The
model never takes odds as an input, which is what makes the comparison meaningful: it
gets most of the way to the market from goals alone.

## Tech stack

- **Python** (numpy, scipy, pandas) for the model and evaluation.
- **Supabase** (hosted Postgres) for storage.
- **Data sources:** [football-data.co.uk](https://www.football-data.co.uk) season CSVs
  and the [football-data.org](https://www.football-data.org) API (free tier).
- **penaltyblog** is used only as a correctness cross-check in one test, not as the
  model.

## Data

Three tables in Supabase (DDL in `schema.sql` and `schema_predictions.sql`):

| Table | Rows | Contents | Role |
|---|---:|---|---|
| `matches` | 1,950 | Every played Premier League match from 2021/22 to 2026/27 (in progress): kickoff, teams, score, average closing odds. From football-data.co.uk. | Training and evaluation |
| `current_fixtures` | 380 | The full 2026/27 schedule by matchweek, played and upcoming. From football-data.org. | What gets predicted |
| `predictions` | 10 per run | Stored forecasts for the upcoming matchweek, keyed by model version and timestamp so later runs append instead of overwriting. | Output |

Both ingestion scripts are idempotent upserts and print a validation report (row counts
per season, null checks, team counts).

## Model

A Dixon-Coles model, implemented from scratch in [`dixon_coles.py`](dixon_coles.py).

- Each team has an **attack** and a **defense** rating. Two global parameters: **home
  advantage** and **rho**, a correction for low scores.
- Expected goals for a fixture are
  `exp(attack_home − defense_away + home_adv)` for the home side and
  `exp(attack_away − defense_home)` for the away side. Goals are Poisson, with the
  Dixon-Coles adjustment to the 0-0, 1-0, 0-1 and 1-1 cells, which plain Poisson gets
  slightly wrong.
- Fit by maximum likelihood (SLSQP with an analytic gradient), with exponential
  time-decay weights so recent matches count more.
- **Team strength is learned, not supplied.** The only inputs are date, teams and
  goals. Attack and defense ratings are outputs of the fit.

Checks on the implementation:

- 1X2 probabilities agree with penaltyblog's Dixon-Coles to within 0.0024 on a real
  season (`test_vs_penaltyblog.py`).
- The analytic gradient matches finite differences to about 1e-7.
- A fit on all 1,950 matches takes about 36 ms.
- Current fit: home advantage 0.170 (log scale, roughly 19% more goals at home),
  rho −0.101; the top three attack ratings are Man City, Liverpool and Arsenal.

## Evaluation

[`backtest.py`](backtest.py) runs a **walk-forward backtest**: the first two seasons are
training only; after that, for each calendar week the model is fit on every match that
kicked off before that week and then predicts that week's matches. The code asserts for
every week that no training match is later than a test match. That gives 111 fits and
1,190 out-of-sample predictions.

- **Primary metric: RPS** (ranked probability score), which scores the full probability
  forecast and respects the ordering of outcomes, so predicting a home win when the
  result is a draw is penalised less than when it is an away win.
- **Secondary:** log loss and Brier score. Accuracy is reported as a sanity line only.
- **Two baselines on the same matches:** historical home/draw/away base rates (the
  floor), and closing odds with the bookmaker margin removed (the ceiling).
- **Uncertainty:** paired bootstrap 95% confidence intervals on the RPS differences.

Result: the model is 0.0060 RPS behind the market (95% CI 0.0027 to 0.0093) and 0.0319
ahead of base rates (CI 0.0243 to 0.0394). Both intervals exclude zero.

**Harness validation.** The market baseline's per-season RPS (0.181, 0.196, 0.205) and
favourite hit rates (60.0%, 55.5%, 49.5%) match figures computed independently from the
source data before the harness existed, which is evidence the scoring is right.

[`season_holdout.py`](season_holdout.py) runs a simpler test: fit on previous seasons
only, predict the current one. On the 50 matches of 2026/27 played so far the model's
pick was right 24 times and the market's 23 times. That sample is far too small to
conclude anything from.

## Parameter tuning

[`optimize.py`](optimize.py) searches two hyperparameters through the same walk-forward
harness, choosing the lowest out-of-sample RPS:

- **Time-decay rate (xi):** chosen 0.0025 per day (a match about nine months old counts
  half). It is statistically indistinguishable from neighbouring values; the robust
  finding is that some decay beats none.
- **Promoted-team shrinkage strength:** chosen 2 (see below).

A caveat the report states too: these were chosen on the same out-of-sample weeks the
headline is reported on, so the headline is slightly optimistic (best of 42
combinations). With about three test seasons there was not enough data for a separate
tuning window. The spread across the whole grid is 0.0037 RPS, most of it from the
no-decay row.

## Honest findings and limitations

- **The ceiling is the sport.** Football is low-scoring and close to the random end of
  team sports. The market itself picked the right outcome only 54.6% of the time here.
- **Draws are structurally hard.** A draw is almost never the single most likely
  outcome, so the model never picked one in 1,190 matches, while 295 of them (25%) were
  drawn. That caps accuracy, and is why RPS is the headline metric.
- **Skill varies by season.** Skill over base rates fell from 19% (2023/24) to 8%
  (2025/26). The market also scored worse in those seasons; the cause was not
  investigated.
- **Cold start for promoted teams, fixed with a caveat.** Plain maximum likelihood let
  a new team's rating run to extremes after a few matches, producing eight forecasts
  that put under 1% on an outcome, two of which happened. A Gaussian prior now pulls
  promoted teams toward the rating of a typical weak team and fades as their matches
  accumulate. That removed all eight extreme forecasts and cut the worst single-match
  log loss from 7.3 to 2.8. The overall RPS and log-loss improvements are inside the
  noise, so the fix is a robustness gain, not a demonstrated accuracy gain.
- **Small evaluation sample.** 1,190 matches can separate the model from the market,
  but not fine differences between model variants.

## Features considered and not added

These decisions come from a literature review done before building
([`storm-work/HANDOFF.md`](storm-work/HANDOFF.md)), not from experiments in this repo:

- **Expected goals (xG):** the one direct comparison found showed no measurable gain
  over a goals-based model, and free xG sources are fragile.
- **Lineups, injuries, squad value:** published gains are roughly 0.001 to 0.003 RPS,
  for a much higher data cost.
- **Manager changes:** studies find essentially no effect.

The common thread: team ratings already measure strength directly from results, so a
noisy proxy for the same thing adds little. Any covariate added later has to earn its
place by lowering out-of-sample RPS in this harness.

## Status

- **Done:** data layer, from-scratch model, walk-forward harness with baselines and
  confidence intervals, hyperparameter search, promoted-team shrinkage, stored
  predictions for the upcoming matchweek.
- **Stubbed:** a stacking layer for extra covariates (interface only, in
  `optimize.py`).
- **Planned:** API endpoint, frontend, scheduled refresh.

## Setup

Developed on Python 3.13; requires a Supabase project.

```bash
python -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env    # then fill in the three values
```

`.env` variables:

| Variable | What it is |
|---|---|
| `SUPABASE_URL` | Your project URL |
| `SUPABASE_KEY` | Service-role key (server-side only; the tables have row-level security on with no public policies) |
| `FOOTBALL_DATA_API_KEY` | Free key from football-data.org |

Create the tables by running `schema.sql` and `schema_predictions.sql` in the Supabase
SQL editor, then:

```bash
# 1. Load data (both accept --dry-run)
.venv/bin/python ingest_matches.py      # historical results
.venv/bin/python fetch_fixtures.py      # current-season schedule

# 2. Evaluate
.venv/bin/python backtest.py            # writes backtest_report.md
.venv/bin/python optimize.py            # grid search; writes model_config.json (~2.5 min)
.venv/bin/python season_holdout.py      # previous seasons -> this season

# 3. Predict the upcoming matchweek
.venv/bin/python fit_predict.py         # --dry-run to print without storing

# Model self-checks
.venv/bin/python dixon_coles.py
.venv/bin/python test_vs_penaltyblog.py
.venv/bin/python backtest.py --self-test
```

## Repository layout

| File | Purpose |
|---|---|
| `dixon_coles.py` | The model |
| `shrinkage.py` | Promoted-team prior and the two-stage fit |
| `backtest.py` | Walk-forward harness, metrics, baselines, report |
| `optimize.py` | Hyperparameter grid search; stacking stub |
| `fit_predict.py` | Production fit and stored predictions |
| `season_holdout.py` | Previous-seasons-only test for one season |
| `ingest_matches.py`, `fetch_fixtures.py` | Data ingestion |
| `db.py` | Supabase loaders |
| `model_config.json` | Tuned hyperparameters |
| `backtest_report.md` | Full evaluation results |
