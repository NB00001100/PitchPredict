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

Three tables in Supabase (DDL in `schema.sql` and `schema_predictions.sql`; the website's
read-only access and the `matchweek_predictions` view are in `schema_frontend.sql`):

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
- **Automation:** two GitHub Actions workflows. `run_week.py` runs daily and forecasts
  the next matchweek once the one before it has been played; `update_results.py` runs
  every 15 minutes and pulls in final scores. See [Weekly automation](#weekly-automation)
  and [`docs/OPERATIONS.md`](docs/OPERATIONS.md).
- **Website:** a Vite + React app in `web/` that reads Supabase directly from the
  browser, deployed on Vercel. See [Deploy to Vercel](#deploy-to-vercel).

## Setup

Developed on Python 3.13; requires a Supabase project.

```bash
python -m venv .venv
.venv/bin/pip install -r requirements.txt       # runtime (what CI installs)
.venv/bin/pip install -r requirements-dev.txt   # + penaltyblog, for test_vs_penaltyblog.py only
cp .env.example .env    # then fill in the three values
```

`.env` variables:

| Variable | What it is |
|---|---|
| `SUPABASE_URL` | Your project URL |
| `SUPABASE_KEY` | Service-role (secret) key: server-side only, it bypasses row-level security. The publishable key does not work here |
| `FOOTBALL_DATA_API_KEY` | Free key from football-data.org |

Create the tables by running `schema.sql`, `schema_predictions.sql` and
`schema_frontend.sql` in the Supabase SQL editor, then:

```bash
# 1. Load data (both accept --dry-run)
.venv/bin/python ingest_matches.py      # historical results
.venv/bin/python fetch_fixtures.py      # current-season schedule

# 2. Evaluate
.venv/bin/python backtest.py            # writes backtest_report.md
.venv/bin/python optimize.py            # grid search; writes model_config.json (~2.5 min)
.venv/bin/python season_holdout.py      # previous seasons -> this season

# 3. Predict fixtures kicking off in the next 8 days
.venv/bin/python fit_predict.py         # --dry-run to print without storing, --days N

# Or the scheduled jobs (both accept --dry-run)
.venv/bin/python run_week.py            # fetch, ingest, decide, forecast if due, backfill
.venv/bin/python update_results.py      # pull final scores for kicked-off fixtures

# Model self-checks
.venv/bin/python dixon_coles.py
.venv/bin/python test_vs_penaltyblog.py
.venv/bin/python backtest.py --self-test
.venv/bin/python test_run_week.py       # the decision rules, no database needed
.venv/bin/python test_update_results.py
```

## Weekly automation

Two GitHub Actions workflows keep the data current. Neither needs a person, and neither
trusts the clock: GitHub's cron is UTC, can start late or be skipped, and is switched off
after 60 days without repository activity. So each script looks at the fixture list and
decides for itself whether there is work to do.

| Workflow | Script | Schedule (UTC) | What it does |
|---|---|---|---|
| Predict next matchweek (`predict.yml`) | `run_week.py` | Daily at 06:00 | Refreshes fixtures and training data, forecasts the next matchweek if it is due, backfills, summarises |
| Update results (`results.yml`) | `update_results.py` | Every 15 minutes | Pulls final scores for fixtures that kicked off more than 2 h ago |

Both can also be started by hand from the Actions tab, with a "Dry run" box.

### Predict next matchweek

`run_week.py` runs eight steps in order: fetch fixtures and results, ingest match
results, check team names, report staleness, decide, forecast the round (only if due),
backfill, summary. The summary goes to the run page and starts with **ACTED** or
**SKIPPED** and the reason. A skip exits 0; the first failing step exits 1.

The decision, in brief. The round is the upcoming fixtures of the matchweek of the next
kickoff, within 6 days of it. The run forecasts it only if:

- **A.** No fixture of that matchweek has kicked off. Forecasts are never written or
  rewritten after a matchweek starts. (A rescheduled fixture played apart from its
  matchweek is forecast as a round of its own.)
- **B.** Every fixture of an earlier matchweek that kicked off before the round has
  finished. Postponed and suspended fixtures never block.
- **C.** Some fixture in the round has no real forecast made before kickoff. Only those
  are forecast; if all have one, the run skips.

The run fits on `matches` plus any result that football-data.org has and
football-data.co.uk has not published yet. Before fitting it stops if anything in the
training data kicked off at or after the round's first kickoff, if a fixture being
forecast is in the training data, or if a fixture being forecast has already kicked off.
There is no flag to override these checks.

In a normal week, a weekend matchweek ends on Monday night and the Tuesday 06:00 run
forecasts the next one, about four days ahead. After a midweek round that ends on
Thursday night, Friday 06:00 forecasts Saturday's round, with Saturday 06:00 as the
fallback. The full rules are in the docstring of [`run_week.py`](run_week.py); day-to-day
operation is in [`docs/OPERATIONS.md`](docs/OPERATIONS.md).

### Update results

`update_results.py` asks Supabase for current-season fixtures that kicked off between
7 days and 2 hours ago and have no final status yet. Most runs find none and exit in
seconds without calling football-data.org. Otherwise it makes one API call, upserts
status and scores for the whole season into `current_fixtures`, and reports which of
the pending fixtures are now FINISHED. Free-tier scores arrive minutes to hours after
full time, so "still pending" is normal; the next run retries. It never refits the
model and never touches `predictions`.

### GitHub secrets

Add these under **Settings → Secrets and variables → Actions → New repository secret**:

| Secret | Value |
|---|---|
| `SUPABASE_URL` | Your project URL |
| `SUPABASE_KEY` | The service-role key: Supabase dashboard → Project Settings → API keys, the `sb_secret_…` secret key or the legacy `service_role` JWT |
| `FOOTBALL_DATA_API_KEY` | Your free key from football-data.org |

The service-role key bypasses row-level security. Only the Actions use it; the website
never does. If `SUPABASE_KEY` holds the publishable key by mistake, `matches` reads as
empty (the team-name check fails, saying teams never appear in `matches`) and every
upsert is rejected by RLS.

Both workflows share the concurrency group `supabase-writes`, so they never write to
Supabase at the same time. A queued run replaced by a newer one shows as cancelled;
that is harmless.

### Cost

This repository is public, so Actions minutes are free and polling every 15 minutes
costs nothing. In a private repository it would: even a run that does nothing spends
about 30 to 60 seconds on checkout, Python setup and `pip install`, and every 15 minutes
is about 2,900 runs a month, which can approach or exceed the 2,000 free minutes. The
options are a slower poll (`*/30 * * * *`) or a cron limited to match windows, such as
`*/15 12-23 * * 6,0` plus `*/15 18-23 * * 1-5` (both commented in `results.yml`). The
tradeoff is slower result updates against runner minutes.

## Deploy to Vercel

The website in `web/` is a Vite + React app with no server of its own. The browser reads
Supabase directly with `@supabase/supabase-js`. It needs two environment variables:

| Variable | Value |
|---|---|
| `VITE_SUPABASE_URL` | Your project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | The publishable key: Supabase dashboard → Project Settings → API keys, the `sb_publishable_…` key or the legacy `anon` JWT |

Both forms of the publishable key act as the `anon` role. For local development, copy
`web/.env.example` to `web/.env.local` and run `npm run dev` in `web/`.

To deploy from GitHub:

1. On vercel.com/new, import `NB00001100/PitchPredict`.
2. Framework Preset **Vite**, Root Directory **`web`**, Build Command `npm run build`,
   Output Directory `dist`.
3. Under Project Settings → Environment Variables, add the two `VITE_*` variables.
4. Deploy. From then on every push to `main` redeploys.

`web/vercel.json` already sends every route to `index.html`, so direct links such as
`/premier-league/results` work, and caches `/assets` for a year. Nothing else is needed.

**Current state.** A Vercel project, `pitchpredict-web`, is live at
https://pitchpredict-web.vercel.app with both variables set. It was deployed from the
CLI and is not connected to GitHub, so pushes to `main` do not redeploy it yet. To fix
that, open the project in the Vercel dashboard, connect `NB00001100/PitchPredict` under
Settings → Git, and set Settings → General → Root Directory to `web`. Until then, deploy
by hand with `cd web && vercel --prod`.

**Read-only by design.** `schema_frontend.sql` grants the browser key SELECT on
`current_fixtures`, `predictions` and the `matchweek_predictions` view, with one
`"public read"` policy per table and no insert, update or delete policies. `matches`
has row-level security on and no policies, so the browser cannot read the training
data at all.

**Keys that never go in `web/`:** the service-role key and `FOOTBALL_DATA_API_KEY`. Any
`VITE_*` variable is compiled into the public JavaScript, so only the publishable key
belongs there.

## How to verify

1. **Forecasting.** Add the three secrets and push. In Actions → **Predict next
   matchweek** → Run workflow, tick "Dry run" for the first run, then run it for real.
   The run summary says ACTED or SKIPPED and why. Check what has been stored:

   ```sql
   select matchweek, count(*), max(predicted_at)
   from predictions where is_backfill = false
   group by 1 order by 1 desc;
   ```

   SKIPPED is the honest outcome on any day when the next matchweek is already
   forecast. With matchweeks 1 to 5 finished and matchweek 6 already forecast, the first
   real run will skip ("matchweek 6 already forecast" or "matchweek 6 is under way") and
   backfill nothing new. The first ACTED run comes after matchweek 6 finishes, and adds
   a new `matchweek` row to the query above.

2. **Results.** During or after a match, run Actions → **Update results** → Run
   workflow. Fixtures that kicked off more than 2 hours ago should get scores and status
   FINISHED (if football-data.org has them yet):

   ```sql
   select matchweek, home_team, home_goals, away_goals, away_team, status, updated_at
   from current_fixtures
   where kickoff > now() - interval '3 days'
   order by kickoff;
   ```

   Outside match windows the run says there are no fixtures awaiting a result and makes
   no API call.

3. **Website.** Deploy to Vercel and load the site. The Premier League page shows the
   next matchweek's forecasts, and its Results view shows predicted against actual
   results with hits graded. If the page shows a configuration error instead, the two
   `VITE_*` variables are missing from the Vercel project.

## Repository layout

| File | Purpose |
|---|---|
| `dixon_coles.py` | The model |
| `shrinkage.py` | Promoted-team prior and the two-stage fit |
| `backtest.py` | Walk-forward harness, metrics, baselines, report |
| `optimize.py` | Hyperparameter grid search; stacking stub |
| `run_week.py` | The daily pipeline; decides whether a matchweek is due (see `docs/OPERATIONS.md`) |
| `update_results.py` | Pulls final scores every 15 minutes; never touches forecasts |
| `fit_predict.py` | Production fit and stored predictions |
| `backfill_predictions.py` | After-the-fact forecasts for finished fixtures that lack a real one |
| `seasons.py`, `teams.py` | Current season from the date; fixture -> model team names and their check |
| `season_holdout.py` | Previous-seasons-only test for one season |
| `ingest_matches.py`, `fetch_fixtures.py` | Data ingestion |
| `db.py` | Supabase loaders |
| `schema.sql`, `schema_predictions.sql` | Table DDL |
| `schema_frontend.sql` | Read-only browser access (RLS policies) and the `matchweek_predictions` view |
| `test_run_week.py`, `test_update_results.py` | Tests for the decision rules and the results poller |
| `.github/workflows/` | `predict.yml` (daily) and `results.yml` (every 15 minutes) |
| `web/` | The website (Vite + React) |
| `model_config.json` | Tuned hyperparameters |
| `backtest_report.md` | Full evaluation results |
