# Operations

How the data behind the website stays current, and what to do when it doesn't.

## What runs, and when

`refresh.py` does the whole weekly update. GitHub Actions runs it
(`.github/workflows/refresh.yml`) at **08:00 UTC every Tuesday and Friday**:

- **Tuesday:** weekend results are in, and football-data.co.uk has usually caught up.
- **Friday:** forecasts are fresh before the weekend, and midweek results are captured.

The steps run in order. The first one that fails stops the run, and the workflow shows
as failed (GitHub emails you).

1. **Fetch fixtures and results** from football-data.org into `current_fixtures`.
2. **Ingest match results** from football-data.co.uk into `matches`, the model's
   training data.
3. **Check team names:** every team in this season's fixtures must map to a model name
   (`teams.py`).
4. **Report staleness:** compares the number of finished fixtures with the
   current-season rows in `matches`.
5. **Forecast:** fits the model, then predicts every SCHEDULED/TIMED fixture that kicks
   off in the next 8 days, whatever its matchweek.
6. **Backfill:** adds a forecast for any finished fixture that never got a real
   pre-kickoff one.
7. **Summary:** reads the `matchweek_predictions` view and reports finished fixtures,
   graded fixtures, hits, hit rate, next kickoff, and how many fixtures in the window
   have a forecast. The same summary appears on the workflow run page.

Every write is an upsert, so if a run fails partway, fix the cause and run it again.
Each run of step 5 adds a new forecast set (kept on purpose, so skill can be measured
by lead time). The website shows only the latest forecast made before kickoff, so
running twice in a day does no harm.

## Running it by hand

```bash
.venv/bin/python refresh.py --dry-run   # every step, no writes (still reads Supabase)
.venv/bin/python refresh.py             # the real thing
.venv/bin/python refresh.py --days 11   # widen the forecast window
```

Each script still runs on its own and accepts `--dry-run`: `fetch_fixtures.py`,
`ingest_matches.py`, `fit_predict.py` (also `--days`) and `backfill_predictions.py`.
`python teams.py` runs only the team-name check.

To run it on GitHub: open the **Actions** tab, choose **Refresh data**, click **Run
workflow** and tick "Dry run" if you want one.

## One-time setup on GitHub

1. Push the repository, including `.github/workflows/refresh.yml`.
2. Go to **Settings → Secrets and variables → Actions → New repository secret** and add
   these three, with the same values as in your local `.env`:
   - `SUPABASE_URL`
   - `SUPABASE_KEY` (the service-role key, which can write)
   - `FOOTBALL_DATA_API_KEY`
3. Go to **Actions → Refresh data → Run workflow** and do one dry run, then one real
   run. Read the summary on the run page.

**Keep the repository active.** GitHub turns off scheduled workflows in a repository
that has had no activity for 60 days. If that happens, the Actions tab shows a banner
with a button to turn it back on. Any commit also resets the 60-day clock.

## What the warnings mean

| Message | Meaning | Action |
|---|---|---|
| `matches is N result(s) behind current_fixtures` | football-data.co.uk hasn't published the latest results yet; the API has. This run's forecasts are fitted without those matches. | Usually none; the next run picks them up. If it persists for more than a few days, compare the listed matches with the CSV. |
| `matches has N more ... results than current_fixtures` | The two sources disagree, for example over an abandoned or rescheduled match. | Look at it by hand. |
| `N finished fixture(s) not backfilled yet` | A backfill would have trained on data that is missing earlier results, so it was held back instead of being written with the wrong inputs. | None; a later run fills it in. |
| `No SCHEDULED/TIMED fixtures kick off ... normal during an international break` | Nothing kicks off in the next 8 days. | None. The run still succeeds. |
| `Team-name check FAILED` (the run fails) | A fixture team has no mapping, or maps to a name that isn't in `matches`. The message lists exactly which names are affected. | Edit `teams.py` (see the checklist below). |
| Ratings `WARNING`s in step 5 | The fit looks odd but is still plausible, for example a big club outside the top five attacks. | Have a look; the run continues. |

## International breaks and postponements

- **International break:** the forecast step finds no fixtures, says so, and succeeds.
  The website keeps showing the last round. Forecasts for the next round appear in the
  first run within 8 days of its first kickoff, and each run before kickoff refreshes
  them.
- **Postponed match:** it stays POSTPONED and is skipped. It no longer holds back other
  forecasts, because selection goes by date, not by matchweek. When it is rescheduled,
  the API gives it a new date and status TIMED, and it is forecast like any other
  fixture, keeping its original matchweek number. The SQL view `current_matchweek` is
  still in the database but nothing depends on it now.
- **A match the refresh missed** (a run failed or was turned off): step 6 backfills it
  from data before its kickoff, flagged `is_backfill`.

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

`requirements.txt` holds what the refresh needs, pinned to versions tested together;
bump them deliberately. `penaltyblog` is used only by `test_vs_penaltyblog.py`. It pulls
in about 80 packages (around 0.5 GB), so it lives in `requirements-dev.txt`:
`pip install -r requirements-dev.txt`.
