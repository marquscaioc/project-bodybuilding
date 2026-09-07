-- Public, username-only crowd voting for the current A/B matchup.
-- All access goes through server route handlers; browser roles cannot read or
-- mutate raw voter rows directly.

create table if not exists public.live_votes (
  id uuid primary key default gen_random_uuid(),
  matchup_key text not null,
  voter_id uuid not null,
  username text not null,
  votes jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint live_votes_matchup_key_length check (char_length(matchup_key) between 8 and 96),
  constraint live_votes_username_length check (char_length(username) between 2 and 32),
  constraint live_votes_votes_object check (jsonb_typeof(votes) = 'object'),
  constraint live_votes_one_ballot unique (matchup_key, voter_id)
);

create index if not exists live_votes_matchup_updated_idx
  on public.live_votes (matchup_key, updated_at desc);

drop trigger if exists touch_live_votes_updated_at on public.live_votes;
create trigger touch_live_votes_updated_at
  before update on public.live_votes
  for each row execute function public.touch_updated_at();

alter table public.live_votes enable row level security;
revoke all on table public.live_votes from anon, authenticated;
grant all on table public.live_votes to service_role;

-- Aggregate in Postgres so the API remains accurate beyond PostgREST's
-- default row limit and never has to expose voter identifiers.
create or replace function public.live_vote_results(p_matchup_key text)
returns table (
  row_id text,
  vote_count bigint,
  votes_a bigint,
  votes_b bigint,
  ties bigint,
  average_a numeric,
  distribution jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  with ballots as (
    select ballot.key as row_id, ballot.value #>> '{}' as choice
    from public.live_votes vote
    cross join lateral jsonb_each(vote.votes) as ballot(key, value)
    where vote.matchup_key = p_matchup_key
  )
  select
    row_id,
    count(*) as vote_count,
    count(*) filter (where choice like 'A_') as votes_a,
    count(*) filter (where choice like 'B_') as votes_b,
    count(*) filter (where choice = 'tie') as ties,
    round(avg(
      case
        when choice = 'tie' then 50
        when choice like 'A_' then 50 + right(choice, 1)::int * 12.5
        else 50 - right(choice, 1)::int * 12.5
      end
    ), 1) as average_a,
    jsonb_build_object(
      'A1', count(*) filter (where choice = 'A1'),
      'A2', count(*) filter (where choice = 'A2'),
      'A3', count(*) filter (where choice = 'A3'),
      'A4', count(*) filter (where choice = 'A4'),
      'tie', count(*) filter (where choice = 'tie'),
      'B1', count(*) filter (where choice = 'B1'),
      'B2', count(*) filter (where choice = 'B2'),
      'B3', count(*) filter (where choice = 'B3'),
      'B4', count(*) filter (where choice = 'B4')
    ) as distribution
  from ballots
  where choice in ('A1', 'A2', 'A3', 'A4', 'tie', 'B1', 'B2', 'B3', 'B4')
  group by row_id;
$$;

revoke all on function public.live_vote_results(text) from public, anon, authenticated;
grant execute on function public.live_vote_results(text) to service_role;
