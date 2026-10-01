-- What the website reads: public, read-only access to fixtures and forecasts.

-- Forecasts for already-played matchweeks, made after the fact from data before
-- that matchweek's first kickoff (backfill_predictions.py), are flagged.
alter table predictions add column if not exists is_backfill boolean not null default false;

-- One row per fixture with its forecast, if any: a real forecast made before
-- kickoff wins over a backfilled one; among those, the latest. pick/actual/hit
-- are defined here so every consumer agrees on them.
create or replace view matchweek_predictions
with (security_invoker = true) as
select
  f.id as fixture_id, f.season, f.matchweek, f.kickoff, f.status,
  f.home_team, f.away_team, f.home_tla, f.away_tla, f.home_goals, f.away_goals,
  p.p_home, p.p_draw, p.p_away, p.exp_home_goals, p.exp_away_goals, p.modal_score,
  p.model_version, p.predicted_at, p.is_backfill,
  x.pick, x.actual,
  (x.pick = x.actual) as hit          -- null until both forecast and result exist
from current_fixtures f
left join lateral (
  select * from predictions p
  where p.fixture_id = f.id and p.predicted_at <= f.kickoff
  order by p.is_backfill asc, p.predicted_at desc
  limit 1
) p on true
cross join lateral (
  select
    case when p.p_home is null then null
         when p.p_home >= p.p_draw and p.p_home >= p.p_away then 'H'
         when p.p_away >= p.p_draw then 'A'
         else 'D' end as pick,
    case when f.status <> 'FINISHED' or f.home_goals is null then null
         when f.home_goals > f.away_goals then 'H'
         when f.home_goals < f.away_goals then 'A'
         else 'D' end as actual
) x;

-- Read-only for the browser (publishable key). No insert/update/delete policies,
-- so writes remain service-role only. matches stays private.
grant select on current_fixtures, predictions, matchweek_predictions to anon, authenticated;

drop policy if exists "public read" on current_fixtures;
create policy "public read" on current_fixtures for select to anon, authenticated using (true);

drop policy if exists "public read" on predictions;
create policy "public read" on predictions for select to anon, authenticated using (true);
