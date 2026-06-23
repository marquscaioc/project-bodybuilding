-- ─────────────────────────────────────────────────────────────────────
-- Project Bodybuilding — shared pose photos (Host-curated)
--
-- The Host desk (project-bodybuilding) uploads each pose's cutout to the
-- `show-photos` Storage bucket and writes a small URL + positioning manifest
-- into this table. Every other judge desk reads it read-only, in realtime, so
-- the whole panel scores the exact same images.
--
-- The manifest holds ONLY public Storage URLs + detection metadata (face/body/
-- pose boxes, manual offsets) — never base64 — so realtime payloads stay tiny.
--
-- Same posture as judge_cards: NOT a security boundary. Gating is the
-- client-side show code; RLS is permissive for anon.
-- ─────────────────────────────────────────────────────────────────────

create table if not exists public.show_photos (
  show_code   text primary key,
  poses       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);

-- Reuse the updated_at auto-bump trigger function from 0001_init.sql.
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_show_photos_updated_at on public.show_photos;
create trigger touch_show_photos_updated_at
  before update on public.show_photos
  for each row execute function public.touch_updated_at();

-- ─── Row Level Security: permissive for anon + authenticated ───
alter table public.show_photos enable row level security;

drop policy if exists show_photos_select on public.show_photos;
create policy show_photos_select
  on public.show_photos for select
  to anon, authenticated
  using (true);

drop policy if exists show_photos_insert on public.show_photos;
create policy show_photos_insert
  on public.show_photos for insert
  to anon, authenticated
  with check (true);

drop policy if exists show_photos_update on public.show_photos;
create policy show_photos_update
  on public.show_photos for update
  to anon, authenticated
  using (true)
  with check (true);

-- ─── Realtime: stream the manifest to every judge desk ───
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'show_photos'
  ) then
    alter publication supabase_realtime add table public.show_photos;
  end if;
end $$;

-- ─── Storage: public bucket for the cutout images ───
insert into storage.buckets (id, name, public)
values ('show-photos', 'show-photos', true)
on conflict (id) do nothing;

-- Object policies: public read; anon may write (mirrors the show's soft gate).
drop policy if exists show_photos_obj_select on storage.objects;
create policy show_photos_obj_select
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'show-photos');

drop policy if exists show_photos_obj_insert on storage.objects;
create policy show_photos_obj_insert
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'show-photos');

drop policy if exists show_photos_obj_update on storage.objects;
create policy show_photos_obj_update
  on storage.objects for update
  to anon, authenticated
  using (bucket_id = 'show-photos')
  with check (bucket_id = 'show-photos');

drop policy if exists show_photos_obj_delete on storage.objects;
create policy show_photos_obj_delete
  on storage.objects for delete
  to anon, authenticated
  using (bucket_id = 'show-photos');
