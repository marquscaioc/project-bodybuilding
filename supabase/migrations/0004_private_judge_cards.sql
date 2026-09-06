-- Judge scorecards are private to the server-authenticated desk session.
-- Browser clients must use /api/judge-card; only the host uses /api/host/cards.

alter table public.judge_cards enable row level security;

drop policy if exists judge_cards_select on public.judge_cards;
drop policy if exists judge_cards_insert on public.judge_cards;
drop policy if exists judge_cards_update on public.judge_cards;

revoke all on table public.judge_cards from anon, authenticated;
grant all on table public.judge_cards to service_role;
