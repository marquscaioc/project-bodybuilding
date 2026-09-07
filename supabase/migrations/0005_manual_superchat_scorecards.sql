-- Manual Super Chat invitations, browser claims, and private fan scorecards.
-- Every table is server-only: browsers interact through authenticated API routes.

create table if not exists public.superchat_invites (
  id             uuid primary key default gen_random_uuid(),
  claim_token    text not null unique,
  display_name   text not null,
  amount         numeric(12, 2) not null default 0 check (amount >= 0),
  currency       text not null default 'BRL' check (currency ~ '^[A-Z]{3}$'),
  note           text not null default '',
  status         text not null default 'active'
                 check (status in ('active', 'claimed', 'closed')),
  expires_at     timestamptz not null default (now() + interval '12 hours'),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create table if not exists public.fan_scorecards (
  id              uuid primary key default gen_random_uuid(),
  invite_id       uuid not null unique references public.superchat_invites(id) on delete cascade,
  display_name    text not null,
  athlete_a       jsonb not null default '{"name": "Athlete A"}'::jsonb,
  athlete_b       jsonb not null default '{"name": "Athlete B"}'::jsonb,
  rows            jsonb not null default '[]'::jsonb,
  current_pose_id text not null default 'FDB',
  locked          boolean not null default false,
  updated_at      timestamptz not null default now()
);

create table if not exists public.superchat_claims (
  id                uuid primary key default gen_random_uuid(),
  invite_id         uuid not null references public.superchat_invites(id) on delete cascade,
  verification_code text not null unique,
  status            text not null default 'pending'
                    check (status in ('pending', 'approved', 'rejected')),
  created_at        timestamptz not null default now(),
  reviewed_at       timestamptz
);

-- Only one browser may be approved for an invitation.
create unique index if not exists one_approved_claim_per_invite
  on public.superchat_claims (invite_id)
  where status = 'approved';

create index if not exists superchat_invites_created_at_idx
  on public.superchat_invites (created_at desc);

create index if not exists superchat_claims_invite_id_idx
  on public.superchat_claims (invite_id, created_at desc);

drop trigger if exists touch_superchat_invites_updated_at on public.superchat_invites;
create trigger touch_superchat_invites_updated_at
  before update on public.superchat_invites
  for each row execute function public.touch_updated_at();

drop trigger if exists touch_fan_scorecards_updated_at on public.fan_scorecards;
create trigger touch_fan_scorecards_updated_at
  before update on public.fan_scorecards
  for each row execute function public.touch_updated_at();

alter table public.superchat_invites enable row level security;
alter table public.fan_scorecards enable row level security;
alter table public.superchat_claims enable row level security;

revoke all on table public.superchat_invites from anon, authenticated;
revoke all on table public.fan_scorecards from anon, authenticated;
revoke all on table public.superchat_claims from anon, authenticated;

grant all on table public.superchat_invites to service_role;
grant all on table public.fan_scorecards to service_role;
grant all on table public.superchat_claims to service_role;
