-- PitchPredict data layer: historical results + current-season schedule.

create table if not exists matches (
  id          text primary key,      -- '{yyyymmdd}-{home}-{away}', slugified
  season      text not null,         -- e.g. '2024-2025'
  matchweek   int,                   -- null (not in football-data.co.uk)
  kickoff     timestamptz not null,  -- UK local date + time, stored as UTC
  home_team   text not null,
  away_team   text not null,
  home_goals  int,                   -- FTHG
  away_goals  int,                   -- FTAG
  result      char(1),               -- FTR: 'H'/'D'/'A'
  -- Closing odds for the market baseline (evaluation only, not a model feature).
  -- Source preference: AvgC* -> Avg* -> B365C* -> B365*.
  odds_home   numeric,
  odds_draw   numeric,
  odds_away   numeric,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);
create index if not exists idx_matches_season  on matches(season);
create index if not exists idx_matches_kickoff on matches(kickoff);

create table if not exists current_fixtures (
  id          bigint primary key,     -- football-data.org match id
  season      text not null,          -- '2026-2027'
  matchweek   int  not null,          -- API 'matchday' (1..38)
  kickoff     timestamptz not null,   -- API 'utcDate'
  status      text not null,          -- SCHEDULED/TIMED/IN_PLAY/PAUSED/FINISHED/POSTPONED/SUSPENDED/CANCELLED
  home_team   text not null,          -- homeTeam.shortName
  away_team   text not null,          -- awayTeam.shortName
  home_tla    text,
  away_tla    text,
  home_goals  int,                    -- score.fullTime.home (null until FINISHED)
  away_goals  int,
  updated_at  timestamptz default now()
);
create index if not exists idx_fixtures_matchweek on current_fixtures(matchweek);
create index if not exists idx_fixtures_status    on current_fixtures(status);
create index if not exists idx_fixtures_kickoff   on current_fixtures(kickoff);

-- No policies: only the service-role key (which bypasses RLS) can read or write.
alter table matches          enable row level security;
alter table current_fixtures enable row level security;

create or replace view current_matchweek
with (security_invoker = true) as
select min(matchweek) as matchweek
from current_fixtures
where status not in ('FINISHED','CANCELLED');
