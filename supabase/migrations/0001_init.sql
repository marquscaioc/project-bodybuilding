-- ─────────────────────────────────────────────────────────────────────
-- Project Bodybuilding scorecard — initial schema
--
-- One signed-in user = one judge. Each judge owns a profile (brand +
-- palette + visibility flag) and a single live scorecard. Other judges
-- can read each other's scorecards only when is_visible = true.
-- ─────────────────────────────────────────────────────────────────────

-- ─── 1. profiles: judge identity, branding, palette, visibility ───
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  brand_line_1 text not null default '',
  brand_line_2 text not null default 'Scorecard',
  logo_url text,
  bg text not null default '#0a0a0a',
  bg_glow text not null default '#181818',
  fg text not null default '#f5f5f5',
  mosaic_1 text not null default '#e10600',
  mosaic_2 text not null default '#ff8a3d',
  mosaic_3 text not null default '#ffc94e',
  mosaic_4 text not null default '#ffaecd',
  mosaic_5 text not null default '#2a0e1c',
  is_visible boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ─── 2. scorecards: per-user scoring state, athletes, rows ───
create table if not exists public.scorecards (
  user_id uuid primary key references auth.users(id) on delete cascade,
  athlete_a jsonb not null default '{"name": "Athlete A"}'::jsonb,
  athlete_b jsonb not null default '{"name": "Athlete B"}'::jsonb,
  rows jsonb not null default '[]'::jsonb,
  current_pose_id text not null default 'FDB',
  updated_at timestamptz not null default now()
);

-- ─── 3. updated_at auto-bump trigger ───
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_profiles_updated_at on public.profiles;
create trigger touch_profiles_updated_at
  before update on public.profiles
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_scorecards_updated_at on public.scorecards;
create trigger touch_scorecards_updated_at
  before update on public.scorecards
  for each row execute function public.touch_updated_at();

-- ─── 4. auto-create profile + scorecard on user signup ───
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(split_part(new.email, '@', 1), ''));
  insert into public.scorecards (user_id) values (new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── 5. Row Level Security ───
alter table public.profiles enable row level security;
alter table public.scorecards enable row level security;

-- Profiles: any authenticated user can read all profiles (so /live can render
-- branding + names of every judge in the room). Only owner can write own row.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select
  on public.profiles for select to authenticated
  using (true);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own
  on public.profiles for insert to authenticated
  with check (auth.uid() = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
  on public.profiles for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Scorecards: a row is readable if it belongs to YOU, OR if its owner has
-- is_visible = true on their profile. Only owner can write.
drop policy if exists scorecards_select on public.scorecards;
create policy scorecards_select
  on public.scorecards for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.profiles p
      where p.id = scorecards.user_id and p.is_visible = true
    )
  );

drop policy if exists scorecards_insert_own on public.scorecards;
create policy scorecards_insert_own
  on public.scorecards for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists scorecards_update_own on public.scorecards;
create policy scorecards_update_own
  on public.scorecards for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── 6. Realtime publication: stream changes to profiles + scorecards ───
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles'
  ) then
    alter publication supabase_realtime add table public.profiles;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'scorecards'
  ) then
    alter publication supabase_realtime add table public.scorecards;
  end if;
end $$;
