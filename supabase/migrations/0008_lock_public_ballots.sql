-- A public identity can submit one ballot per matchup, and each row becomes
-- immutable after its first choice. New rows may still be added until the
-- viewer completes all 12 calls.
create unique index if not exists live_votes_matchup_username_unique
  on public.live_votes (matchup_key, lower(btrim(username)));

create or replace function public.lock_live_vote_choices()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.matchup_key <> new.matchup_key or old.voter_id <> new.voter_id then
    raise exception 'Ballot identity cannot be changed';
  end if;

  if exists (
    select 1
    from jsonb_each(old.votes) as prior(key, value)
    where not (new.votes ? prior.key)
      or new.votes -> prior.key is distinct from prior.value
  ) then
    raise exception 'Submitted votes are locked';
  end if;

  return new;
end;
$$;

drop trigger if exists lock_live_vote_choices on public.live_votes;
create trigger lock_live_vote_choices
  before update on public.live_votes
  for each row execute function public.lock_live_vote_choices();
