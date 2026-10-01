-- Model forecasts for upcoming fixtures. predicted_at is part of the key so each
-- run records a new forecast rather than overwriting (skill by lead time later).

create table if not exists predictions (
  fixture_id     bigint not null,         -- current_fixtures.id
  model_version  text not null,           -- e.g. 'dc-xi0.0018'
  predicted_at   timestamptz not null default now(),
  matchweek      int  not null,
  home_team      text not null,           -- as named in current_fixtures
  away_team      text not null,
  p_home         numeric not null,
  p_draw         numeric not null,
  p_away         numeric not null,
  exp_home_goals numeric,
  exp_away_goals numeric,
  modal_score    text,                    -- e.g. '2-1'
  primary key (fixture_id, model_version, predicted_at)
);

-- No policies: only the service-role key (which bypasses RLS) can read or write.
alter table predictions enable row level security;
