-- ─────────────────────────────────────────────────────────────────────
-- Project Bodybuilding — live judge desks (slug-keyed, no auth)
--
-- Each of the built-in judge "desks" (project-bodybuilding, supersetman,
-- epzeronine, marxmaxmuscle, xavier, marcus, superchat) owns one row keyed
-- by its slug. A judge logs in with a shared code (client-side soft gate),
-- scores on /desk, and their card cloud-syncs here. The host console (/host)
-- reads every row in realtime and reveals + averages them.
--
-- This is NOT a security boundary: the shared code lives in the client and
-- RLS is permissive for the anon role. It mirrors the existing PasswordGate
-- posture — enough to keep casual viewers from scribbling on the cards.
-- ─────────────────────────────────────────────────────────────────────

create table if not exists public.judge_cards (
  slug            text primary key,
  display_name    text not null default '',
  athlete_a       jsonb not null default '{"name": "Athlete A"}'::jsonb,
  athlete_b       jsonb not null default '{"name": "Athlete B"}'::jsonb,
  rows            jsonb not null default '[]'::jsonb,
  current_pose_id text not null default 'FDB',
  updated_at      timestamptz not null default now()
);

-- Reuse the updated_at auto-bump trigger function from 0001_init.sql.
-- (Re-create defensively in case 0002 is applied to a fresh DB.)
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_judge_cards_updated_at on public.judge_cards;
create trigger touch_judge_cards_updated_at
  before update on public.judge_cards
  for each row execute function public.touch_updated_at();

-- ─── Row Level Security: permissive for anon + authenticated ───
-- The whole point is an unauthenticated, shared "room". Anyone may read every
-- desk (the host aggregates them) and upsert any desk (a judge writes their
-- own; the app picks which slug). Gating is done client-side by the show code.
alter table public.judge_cards enable row level security;

drop policy if exists judge_cards_select on public.judge_cards;
create policy judge_cards_select
  on public.judge_cards for select
  to anon, authenticated
  using (true);

drop policy if exists judge_cards_insert on public.judge_cards;
create policy judge_cards_insert
  on public.judge_cards for insert
  to anon, authenticated
  with check (true);

drop policy if exists judge_cards_update on public.judge_cards;
create policy judge_cards_update
  on public.judge_cards for update
  to anon, authenticated
  using (true)
  with check (true);

-- ─── Realtime: stream every desk change to the host board ───
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'judge_cards'
  ) then
    alter publication supabase_realtime add table public.judge_cards;
  end if;
end $$;
