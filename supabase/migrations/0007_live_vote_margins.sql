-- Upgrade an already-provisioned database from winner-only voting to the
-- scorecard's 1–4 point margin model.
drop function if exists public.live_vote_results(text);

create function public.live_vote_results(p_matchup_key text)
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
