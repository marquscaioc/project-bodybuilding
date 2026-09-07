-- Dylan's Project: Bodybuilding desk owns the athlete names for the entire
-- live show. Seed every desk, reject drift on non-Host writes, and propagate
-- Host name changes to judge and approved Super Chat cards.
insert into public.judge_cards (slug, display_name)
values
  ('project-bodybuilding', 'Project: Bodybuilding'),
  ('supersetman', 'Supersetman'),
  ('epzeronine', 'EPzeronine'),
  ('marxmaxmuscle', 'Marx Max Muscle'),
  ('xavier', 'Xavier'),
  ('marcus', 'Marcus'),
  ('superchat', 'Superchat')
on conflict (slug) do nothing;

create or replace function public.use_host_matchup_names()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  host_a jsonb;
  host_b jsonb;
begin
  if new.slug = 'project-bodybuilding' then
    return new;
  end if;

  select athlete_a, athlete_b into host_a, host_b
  from public.judge_cards
  where slug = 'project-bodybuilding';

  if host_a is not null then
    new.athlete_a = jsonb_set(new.athlete_a, '{name}', host_a -> 'name', true);
    new.athlete_b = jsonb_set(new.athlete_b, '{name}', host_b -> 'name', true);
  end if;
  return new;
end;
$$;

drop trigger if exists use_host_matchup_names on public.judge_cards;
create trigger use_host_matchup_names
  before insert or update of athlete_a, athlete_b on public.judge_cards
  for each row execute function public.use_host_matchup_names();

create or replace function public.propagate_host_matchup_names()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.slug <> 'project-bodybuilding' then
    return new;
  end if;

  update public.judge_cards
  set
    athlete_a = jsonb_set(athlete_a, '{name}', new.athlete_a -> 'name', true),
    athlete_b = jsonb_set(athlete_b, '{name}', new.athlete_b -> 'name', true)
  where slug <> 'project-bodybuilding'
    and (
      athlete_a ->> 'name' is distinct from new.athlete_a ->> 'name'
      or athlete_b ->> 'name' is distinct from new.athlete_b ->> 'name'
    );

  update public.fan_scorecards
  set
    athlete_a = jsonb_set(athlete_a, '{name}', new.athlete_a -> 'name', true),
    athlete_b = jsonb_set(athlete_b, '{name}', new.athlete_b -> 'name', true)
  where athlete_a ->> 'name' is distinct from new.athlete_a ->> 'name'
     or athlete_b ->> 'name' is distinct from new.athlete_b ->> 'name';

  return new;
end;
$$;

drop trigger if exists propagate_host_matchup_names on public.judge_cards;
create trigger propagate_host_matchup_names
  after insert or update of athlete_a, athlete_b on public.judge_cards
  for each row execute function public.propagate_host_matchup_names();

-- Bring any existing desk/card into line immediately.
update public.judge_cards target
set
  athlete_a = jsonb_set(target.athlete_a, '{name}', host.athlete_a -> 'name', true),
  athlete_b = jsonb_set(target.athlete_b, '{name}', host.athlete_b -> 'name', true)
from public.judge_cards host
where host.slug = 'project-bodybuilding'
  and target.slug <> host.slug;

update public.fan_scorecards target
set
  athlete_a = jsonb_set(target.athlete_a, '{name}', host.athlete_a -> 'name', true),
  athlete_b = jsonb_set(target.athlete_b, '{name}', host.athlete_b -> 'name', true)
from public.judge_cards host
where host.slug = 'project-bodybuilding';
