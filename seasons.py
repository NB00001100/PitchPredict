"""Which Premier League season is current, derived from today's date.

A PL season starts in August: August-December belong to the season starting that
year, January-July to the season that started the year before. So on 2026-10-01 the
current season is 2026-2027, and on 2027-08-01 it becomes 2027-2028 automatically.

Set SEASON_START_YEAR (e.g. 2026) to pin the season by hand, for example to re-run
an old season or if the league calendar ever shifts.
"""

from datetime import datetime, timezone

SEASON_START_YEAR = None  # override: start year of the season to treat as current
FIRST_SEASON_YEAR = 2021  # oldest season loaded into `matches` (2021-2022)


def season_start_year(today=None):
    """Start year of the current season (the override if set, else from the date)."""
    if SEASON_START_YEAR is not None:
        return int(SEASON_START_YEAR)
    today = today or datetime.now(timezone.utc)
    return today.year if today.month >= 8 else today.year - 1


def season_label(year):
    """2026 -> '2026-2027' (the format used in matches.season and current_fixtures.season)."""
    return f"{year}-{year + 1}"


def season_code(year):
    """2026 -> '2627' (football-data.co.uk's folder name for the season CSV)."""
    return f"{year % 100:02d}{(year + 1) % 100:02d}"


CURRENT_SEASON_YEAR = season_start_year()
CURRENT_SEASON = season_label(CURRENT_SEASON_YEAR)
PREVIOUS_SEASON = season_label(CURRENT_SEASON_YEAR - 1)
