# Operations

How the data behind the website stays current, and what to do when it doesn't.

## What runs, and when

Two GitHub Actions workflows, both scheduled in UTC:

| Workflow | Script | Schedule | Job |
|---|---|---|---|
| Predict next matchweek (`.github/workflows/predict.yml`) | `run_week.py` | 06:00 daily | Forecast the next matchweek once it is due |
| Update results (`.github/workflows/results.yml`) | `update_results.py` | Every 15 minutes | Pull in final scores |

Neither is timed to a deadline. GitHub's cron can start late or be skipped under load,
so each script looks at the data and decides whether there is anything to do. Most runs
of both decide there isn't.

Both workflows use the concurrency group `supabase-writes`, so they never write to
Supabase at the same time; one waits for the other. If a newer run of the same group is
queued behind a waiting one, the waiting one is cancelled. That is harmless: the newer
run does the same work.

### The daily run

`run_week.py` forecasts each matchweek exactly once, as soon as the one before it has
been played. A typical week:

- A weekend matchweek ends on Monday night. The **Tuesday** 06:00 run sees it is
  finished and forecasts the next one, about four days before its first kickoff.
- Wednesday to Saturday the run skips: that matchweek is already forecast.
- After a midweek round that ends on Thursday night, the **Friday** 06:00 run forecasts
  Saturday's round. If Friday's run is late or skipped, Saturday 06:00 is the fallback.

A missed day costs nothing as long as one run lands before the matchweek's first
kickoff. If none does, the matchweek is never forecast for real; the backfill covers it
after the fact, flagged `is_backfill`.

The decision rules (full text in the docstring of `run_week.py`, tested in
`test_run_week.py`):

- **The round** is the upcoming fixtures of the matchweek of the earliest future
  SCHEDULED/TIMED kickoff, within 6 days of that kickoff.
- **A. The matchweek is not under way.** Once any fixture of the matchweek has kicked
  off, its forecasts are never written or rewritten. Exception: a rescheduled fixture
  played apart from its matchweek is forecast as a round of its own, fitted on
  everything played before it.
- **B. Everything before the round has finished.** Every fixture of another matchweek
  that kicked off before the round must be FINISHED (CANCELLED and AWARDED count as
  done). POSTPONED and SUSPENDED fixtures never block.
- **C. Not forecast yet.** Only round fixtures without a real (non-backfill) forecast
  made before kickoff are forecast. If all have one, the run skips.

The steps run in order. The first one that fails stops the run with exit code 1 and the
workflow shows as failed (GitHub emails you). A decision to skip is not a failure.

1. **Fetch fixtures and results** from football-data.org into `current_fixtures`
   (`fetch_fixtures.py`).
2. **Ingest match results** from football-data.co.uk into `matches`, the model's
   training data (`ingest_matches.py`).
3. **Check team names:** every team in this season's fixtures must map to a model name
   (`teams.py`).
4. **Report staleness:** compares the number of finished fixtures with the
   current-season rows in `matches`.
5. **Decide:** applies the rules above and prints ACTED or SKIPPED with the reason.
6. **Forecast the round,** only if step 5 said so. The training set is `matches` plus
   any FINISHED result in `current_fixtures` that football-data.co.uk has not published
   yet. Before fitting, three checks stop the run if violated: nothing in the training
   data kicked off at or after the round's first kickoff; no fixture being forecast is in
   the training data; every fixture being forecast kicks off after now.
7. **Backfill:** adds a forecast for any finished fixture that never got a real
   pre-kickoff one (`backfill_predictions.py`).
8. **Summary:** ACTED or SKIPPED and why, the next round, how many forecasts were
   written, and any warnings. The same summary appears on the workflow run page.

Every write is an upsert, so if a run fails partway, fix the cause and run it again.
There is no flag to force a forecast or to override the checks.

### The results poller

`update_results.py` asks Supabase for current-season fixtures that kicked off between
7 days and 2 hours ago (UTC) whose status is not FINISHED, POSTPONED, CANCELLED,
SUSPENDED or AWARDED.

- **None** (most runs): it says so and exits in seconds, with no API call.
- **Some:** it makes one call to football-data.org, which upserts status and scores for
  every fixture of the season into `current_fixtures`, then reports which of the pending
  fixtures are now FINISHED and which are still pending. Free-tier scores arrive
  minutes to hours after full time, so "still pending" is normal; the next run retries.

It never refits the model and never touches `predictions`. A fixture still not final
7 days after kickoff drops out of its window; it is logged and left to the daily run's
fetch.

## Running it by hand

```bash
.venv/bin/python run_week.py --dry-run        # every step reads, nothing is written
.venv/bin/python run_week.py                  # the real thing
.venv/bin/python update_results.py --dry-run  # which fixtures await a result; no API call
.venv/bin/python update_results.py            # the real thing
```

With `--dry-run`, a forecast that is due is computed and printed but not written.

Each script still runs on its own and accepts `--dry-run`: `fetch_fixtures.py`,
`ingest_matches.py`, `fit_predict.py` and `backfill_predictions.py`. `fit_predict.py`
run standalone uses its own date window (`--days`, default 8) instead of the decision
rules, so it can write forecasts for a matchweek already under way; prefer
`run_week.py`. `python teams.py` runs only the team-name check.

To run either workflow on GitHub: open the **Actions** tab, choose **Predict next
matchweek** or **Update results**, click **Run workflow**, and tick "Dry run" if you want
one.

## One-time setup on GitHub

1. Push the repository, including `.github/workflows/predict.yml` and `results.yml`.
2. Go to **Settings → Secrets and variables → Actions → New repository secret** and add
   these three, with the same values as in your local `.env`:
   - `SUPABASE_URL`
   - `SUPABASE_KEY`: the service-role key (Supabase dashboard → Project Settings → API
     keys: the `sb_secret_…` key or the legacy `service_role` JWT). It bypasses
     row-level security and is used only by Actions, never by the website. With the
     publishable key here, `matches` reads as empty (the team-name check fails, saying
     teams never appear in `matches`) and writes are rejected.
   - `FOOTBALL_DATA_API_KEY`
3. Go to **Actions → Predict next matchweek → Run workflow** and do one dry run, then
   one real run. Read the summary on the run page. Do the same for **Update results**.

**Keep the repository active.** GitHub turns off scheduled workflows in a repository
that has had no activity for 60 days. If that happens, the Actions tab shows a banner
with a button to turn them back on. Any commit also resets the 60-day clock.

**Cost.** In this public repository Actions minutes are free. In a private one, the
15-minute poll (about 2,900 runs a month at 30 to 60 seconds each) can approach or
exceed the 2,000 free minutes; `results.yml` has commented alternatives that poll less
often or only in match windows. See the README's Weekly automation section.

## What the warnings mean

| Message | Meaning | Action |
|---|---|---|
| `SKIPPED: matchweek N is under way` | A fixture of the next matchweek has kicked off. Its forecasts are frozen. | None. Anything left without a forecast is backfilled after it is played. |
| `SKIPPED: waiting for N earlier fixture(s) to finish` | An earlier fixture is still SCHEDULED, TIMED, IN_PLAY or PAUSED, so its result is not in yet. The fixtures are listed. | Usually none: the score arrives and a later run forecasts. If a listed fixture is stuck, check its status at football-data.org. |
| `SKIPPED: matchweek N already forecast` | Every fixture of the next round has a real pre-kickoff forecast. | None. This is most days. |
| `SKIPPED: no dated fixtures left to play` | No SCHEDULED/TIMED fixture kicks off in the future: the season is over, or only undated postponements remain. | None. |
| `matches is N result(s) behind current_fixtures` | football-data.co.uk hasn't published the latest results yet; the API has. A forecast this run adds those results to its training data from `current_fixtures`. The backfill waits for the CSV. | Usually none. If it persists for more than a few days, compare the missing matches with the CSV. |
| `matches has N more ... results than current_fixtures` | The two sources disagree, for example over an abandoned or rescheduled match. | Look at it by hand. |
| `N finished fixture(s) not backfilled yet` | A backfill would have trained on data missing earlier results, so it was held back instead of being written with the wrong inputs. | None; a later run fills it in once `matches` catches up. |
| `Team-name check FAILED` (the run fails) | A fixture team has no mapping, or maps to a name that isn't in `matches`. The message lists exactly which names are affected. If every team is affected, `SUPABASE_KEY` is probably the publishable key. | Edit `teams.py` (see the checklist below), or fix the secret. |
| Ratings `WARNING`s in step 6 | The fit looks odd but is still plausible, for example a big club outside the top five attacks. | Have a look; the run continues. |
| `N fixture(s) kicked off more than 7 days ago and are still not final` (`update_results.py`) | The poller has given up on them. | Check them at football-data.org. The daily run's fetch updates them whenever the API does. |

## International breaks and postponements

- **International break:** nothing special happens. The round after the break is
  forecast by the first daily run after the matchweek before the break has finished, so
  up to two weeks ahead. Every run during the break then skips with "already forecast",
  and the website keeps showing that round.
- **Postponed match:** it stays POSTPONED (or SUSPENDED) and never blocks the next
  forecast. When it is rescheduled, the API gives it a new date and status TIMED. When
  it becomes the next kickoff it is forecast as a round of its own, fitted on everything
  played before it, keeping its original matchweek number. The SQL view
  `current_matchweek` is still in the database but nothing depends on it now.
- **A match that never got a real forecast** (runs failed, were turned off, or the
  matchweek started first): step 7 backfills it from data before its kickoff, flagged
  `is_backfill`.

## Start-of-season checklist (every August)

The season is worked out from the date: August to December is the season starting that
year, and January to July belongs to the season that started the year before. So on
1 August, every script moves to the new season without any change. Before the first
weekend:

1. **Fixtures:** run `python fetch_fixtures.py --dry-run`. It should report 380 fixtures
   for the new season. If football-data.org hasn't published them yet, the script stops
   with a clear error.
2. **Results CSV:** `ingest_matches.py` adds the new season's file automatically
   (football-data.co.uk code such as `2728`). Until the file exists it prints a warning
   and carries on.
3. **Team names:** run `python teams.py`. For each of the three promoted teams it reports:
   - a missing `TEAM_MAP` entry: add `"<football-data.org shortName>": "<football-data.co.uk name>"`;
   - a mapped name that isn't in `matches`: if the team has no Premier League history in
     the loaded seasons, also add its football-data.co.uk name to `NO_HISTORY`.

   Spell names exactly as football-data.co.uk will. Once the team's first results arrive,
   the check fails if the spelling doesn't match. Relegated teams' entries can stay.
4. **Re-tune (optional but recommended):** run `python optimize.py` (about 2.5 minutes),
   which rewrites `model_config.json`, then `python backtest.py`. A changed `xi` or
   `shrink` gives a new `model_version`.
5. **Old season's rows:** `current_fixtures` and `predictions` keep last season's rows.
   The scripts filter by season. The `matchweek_predictions` view returns all seasons,
   so make sure the website filters on its `season` column.
6. **Still hard-coded, deliberately:**
   - `seasons.FIRST_SEASON_YEAR = 2021`: history grows by one season a year and is never
     dropped.
   - `seasons.SEASON_START_YEAR = None`: set it (for example `2027`) to pin a season by
     hand.
   - The 380-fixture and 38-matchweek expectations in the validation reports.
   - The reference figures in `backtest.py --self-test` (past seasons, which don't change).
   - The season in `schema.sql` comments.
   - The README's numbers.

## Dependencies

`requirements.txt` holds what the workflows need, pinned to versions tested together;
bump them deliberately. `penaltyblog` is used only by `test_vs_penaltyblog.py`. It pulls
in about 80 packages (around 0.5 GB), so it lives in `requirements-dev.txt`:
`pip install -r requirements-dev.txt`.
