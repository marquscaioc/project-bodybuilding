# Shared pose photos: Host-curated, identical on every judge desk

**Date:** 2026-06-23
**Status:** Approved (pending user review of this written doc)
**Scope:** `project-bodybuilding/` — the live multi-judge show (`/desk`, `/host`)

## Background

In the live show, each judge takes a desk (`/desk`) and scores the matchup; the
Host desk (`project-bodybuilding`, `HOST_SLUG`) also runs the `/host` reveal
console. Today the comparison-stage photos (`AthletePhotos`) are **per-judge and
local**: every judge uploads their own images into their own Zustand store
(localStorage), and nothing about the images is shared. Judges can therefore be
scoring against different photos.

The Host wants to **curate one photo per pose, per athlete**, and have the
**exact same image appear on every judge's desk**. The Host is both host and
judge: it curates the photos *and* scores against them like everyone else.

Decisions locked in brainstorming:
- **Judges are view-only.** They see the Host's photos; they cannot upload,
  replace, remove, or reposition. (Same image guaranteed everywhere.)
- **Host curates photos only; it does not drive the active pose.** Each judge
  navigates the pose tabs (FDB, SC, …) on their own.
- **Transport: Supabase Storage.** Full-resolution cutouts live in a public
  bucket; only small URL-pointers + positioning metadata travel through the DB.

## Goals

1. The Host can set/replace/remove a cutout for each `(poseId, side)` on its
   `/desk`, using the existing upload + background-removal + auto-positioning
   pipeline unchanged.
2. Every non-Host desk renders the Host's current photo set read-only, in
   realtime, positioned identically (same auto-fit + the Host's manual nudges).
3. Image bytes never travel through Postgres/realtime — only Storage URLs plus
   small detection metadata. Realtime payloads stay well under limits.
4. Solo/playground routes (`/xavier`, `/marcus`, `/open`, …) are unchanged:
   still locally editable, no sharing.

## Non-goals

- Judges editing or overriding the shared photos.
- Host controlling which pose each judge is viewing (pose navigation stays
  per-judge).
- Sharing scores via this channel (scores already flow through `judge_cards`).
- Image compression / downscaling (we chose max quality via Storage; cutouts
  upload at their native resolution).
- Auth / real security. Same permissive "shared room" posture as `judge_cards`.

## Data model

### Storage

Public bucket **`show-photos`**. Deterministic object path, overwritten on
re-upload:

```
{showCode}/{poseId}/{side}.png        e.g. projectbb/FDB/A.png
```

Public read for everyone; insert/update/delete allowed for `anon` (soft-gate
posture). Cutouts are transparent PNGs (alpha preserved).

### Table `show_photos` (migration `0003_show_photos.sql`)

One row per show, single writer (the Host). The manifest holds **URLs +
positioning metadata only** — no base64.

```sql
create table public.show_photos (
  show_code   text primary key,
  poses       jsonb not null default '{}'::jsonb,
  updated_at  timestamptz not null default now()
);
```

`poses` shape (TypeScript mirror in `lib/types/db.ts`):

```ts
type SharedPhoto = {
  url: string;        // public Storage URL, cache-busted (?v=<client upload ms>)
  face?: FaceBox;     // detection metadata, original-pixel space (unchanged)
  body?: BodyBox;
  pose?: Pose;        // 33 MediaPipe landmarks (already normalized)
  offsetX?: number;   // Host's manual nudge (slot-width fraction)
  offsetY?: number;
};

type ShowPhotosPoses = {
  [poseId: string]: { A?: SharedPhoto; B?: SharedPhoto };
};

export type ShowPhotosRow = {
  show_code: string;
  poses: ShowPhotosPoses;
  updated_at: string;
};
```

Metadata note: `ScaledCutout` sizes the `<img>` from `body.imgW/imgH` and the
face/body/pose pixel coords — all in the cutout's original pixel space. The
browser resamples the actual file to that CSS size, so the shared image renders
**identically** to the Host's, positioning and all. Metadata is carried verbatim
from the Host's `processPhoto` result; nothing is recomputed on the judge side.

RLS: permissive `select`/`insert`/`update` for `anon, authenticated`, mirroring
`judge_cards`. Table added to the `supabase_realtime` publication. `updated_at`
auto-bump via the shared `touch_updated_at()` trigger.

## Sync architecture

### `lib/showPhotos.ts` (new, pure + Storage helpers)

- `SHOW_PHOTOS_BUCKET = 'show-photos'`.
- `dataUrlToBlob(dataUrl): Blob` — decode a `data:` URL into a Blob for upload.
- `uploadCutout(showCode, poseId, side, dataUrl): Promise<string>` — convert →
  `storage.from(BUCKET).upload(path, blob, { upsert: true, contentType })` →
  return `getPublicUrl(path)` with a `?v=<ms>` cache-buster.
- `toSharedPhoto(photo: AthletePhoto, url): SharedPhoto` and
  `applySharedPhoto(...)` mapping helpers (store ⇄ manifest).
- Mapping is pure and unit-tested; upload is thin glue over the Supabase client.

### `components/ShowPhotosSync.tsx` (new)

Rendered inside the `/desk` store provider (alongside `JudgeCardSync`), so it
shares the exact store the scorecard UI writes to. Props: `{ showCode, isHost }`.
Renders `null`.

**Host mode (`isHost`, write-only):**
- Subscribes to `athleteA.photos`, `athleteB.photos`, and both sides'
  per-pose offsets via individual selectors (zustand v5 — never return fresh
  objects; same rule as `JudgeCardSync`).
- On change, debounced (`UPLOAD_DEBOUNCE_MS = 600`): for each `(poseId, side)`
  photo whose `imageUrl` (data URL) hasn't been uploaded yet, upload to Storage;
  cache the `dataUrl → url` mapping in a `ref` to avoid re-uploading unchanged
  images. Removed photos → that side set to `undefined` in the manifest
  (Storage object left in place; harmless, optionally deleted).
- Upsert the whole `show_photos` row for `show_code`.
- Does **not** read the manifest back into its own store (Host's store is the
  source of truth — prevents a write↔read loop).
- Best-effort: an upload/upsert failure is logged and surfaced as a small
  per-slot "sync falhou" badge; the local photo is retained and retried on the
  next change.

**Judge mode (`!isHost`, read-only):**
- On mount: `select * from show_photos where show_code = …` → hydrate the store
  via `setPhoto(side, poseId, { imageUrl: url, face, body, pose })` and
  `setPhotoOffset(side, poseId, offsetX, offsetY)`.
- Realtime: subscribe to `show_photos` changes for this `show_code`; on any
  event, **re-SELECT via REST and re-hydrate** (realtime-as-signal, same pattern
  as `/host`), so correctness never depends on the realtime payload contents.
- Reconciles removals: if a `(poseId, side)` is absent in the manifest but
  present in the store, `clearPhoto(side, poseId)`.

### `JudgeCardSync` change

Stop pushing `photos` to `judge_cards`. The upsert sends `athlete_a`/`athlete_b`
with the `photos` field stripped (names/height/etc. preserved). Photos now flow
exclusively through `show_photos`. Keeps `judge_cards` rows small.

## UI

### `AthletePhotos` gains a `readOnly` prop (default `false`)

When `readOnly`:
- Hide the "Import from gallery URL" button.
- `PhotoSlot`: no click-to-upload, no drag-to-reposition, no
  Replace/Remove/Reset-pos buttons, no `<input type=file>`, no drop handling.
  Pointer handlers become no-ops; cursor is default.
- `EmptyState` becomes passive: heading "Aguardando foto do Host", no
  "Drop photo or click" affordance.
- `PoseTabs` stay interactive (judges navigate poses); the A/B indicator dots
  still reflect whether a shared photo exists for each pose.

`ScaledCutout`, sizing math, the stage backdrop, and the name strip are
unchanged.

### Threading `photosReadOnly`

`ScorecardPageProps` gains `photosReadOnly?: boolean` → forwarded through
`ScorecardPageBody` → `AthletePhotos`.

- `/desk`: `photosReadOnly = slug !== HOST_SLUG`; `sync` becomes
  `<><JudgeCardSync …/><ShowPhotosSync showCode={SHOW_CODE} isHost={slug === HOST_SLUG} /></>`.
- All other callers omit the prop → `false` → today's behavior.

## File map

### New files

| File | Purpose |
|---|---|
| `supabase/migrations/0003_show_photos.sql` | `show_photos` table, permissive RLS, realtime publication, `show-photos` Storage bucket + object policies |
| `src/lib/showPhotos.ts` | Bucket constant, `dataUrlToBlob`, `uploadCutout`, store⇄manifest mapping helpers |
| `src/lib/showPhotos.test.ts` | Vitest for the pure helpers (mapping + data-URL decode) |
| `src/components/ShowPhotosSync.tsx` | Host write / judge read realtime bridge |

### Modified files

| File | Change |
|---|---|
| `src/lib/types/db.ts` | Add `SharedPhoto`, `ShowPhotosPoses`, `ShowPhotosRow`; register `show_photos` in `Database['public']['Tables']` |
| `src/components/AthletePhotos.tsx` | Add `readOnly` prop; gate all editing affordances and the importer on it; passive empty state |
| `src/components/ScorecardPage.tsx` | Add `photosReadOnly` prop; forward to `AthletePhotos` |
| `src/app/desk/page.tsx` | Compute `photosReadOnly`; render `ShowPhotosSync` next to `JudgeCardSync` |
| `src/components/JudgeCardProvider.tsx` | Strip `photos` from the `judge_cards` upsert payload |

### Untouched

`processPhoto.ts`, `faceDetect.ts`, `poseDetect.ts`, sizing constants,
`scoring.ts`, `/host`, solo theme routes, `globals.css`.

## Provisioning (deploy step)

`0003` (table + bucket + policies) must be applied to Supabase project
`kpsrzzircgilykhzajka`. This needs the owner `sbp_` token (via the Management
API `POST /v1/projects/{ref}/database/query`, same path used for `0002`) or the
dashboard. The client code ships independently and starts working once
provisioned. Bucket creation is expressible in SQL:

```sql
insert into storage.buckets (id, name, public)
values ('show-photos', 'show-photos', true)
on conflict (id) do nothing;
-- + permissive storage.objects policies for anon on bucket_id = 'show-photos'
```

## Test plan

- **Unit (`src/lib/showPhotos.test.ts`, vitest `npm test`):**
  - `dataUrlToBlob` round-trips a tiny PNG data URL → Blob of expected
    type/size.
  - `toSharedPhoto` maps an `AthletePhoto` + url → `SharedPhoto` carrying
    `face/body/pose/offsetX/offsetY` verbatim.
  - `applySharedPhoto` reconstructs the store-shaped photo from a manifest entry.
  - Existing `scoring.test.ts` stays green (no scoring change).
- **Type/lint/build:** `npx tsc --noEmit`, `npm run build` green.
- **Manual / visual (screenshot + CDP workflow):** seed `pbb-judge-slug` for the
  Host, upload a pose photo on `/desk`; in a second long-lived tab seeded as a
  different judge, confirm the same image renders read-only with identical
  framing and updates in realtime. Capture the browser console to catch React
  #185 / client crashes.

## Error handling & edge cases

- **Upload fails:** keep the local photo, log, show per-slot badge, retry on next
  change. Manifest is only written after a successful upload of changed images.
- **Supabase paused / judge offline:** judge stage shows the passive empty state;
  realtime reconnect + REST refetch re-hydrate on resume.
- **Stale browser cache after replace:** a `?v=<client upload ms>` cache-buster
  (stamped by the Host at upload time) on the stored URL forces judges to fetch
  the new image.
- **Rapid Host nudging:** debounce coalesces; only the final offset is pushed.
- **Photo removed by Host:** manifest side → `undefined`; judges `clearPhoto`.
- **Loop safety:** Host is write-only into `show_photos`; judges are read-only.
  No desk both reads and writes the same channel.

## Acceptance checklist

- [ ] `0003_show_photos.sql` applied; bucket `show-photos` public + writable by anon.
- [ ] Host can set/replace/remove a cutout per `(poseId, side)` on `/desk`.
- [ ] A second judge desk shows the identical image, read-only, with the Host's
      framing, updating in realtime.
- [ ] Judge desk has no upload/replace/remove/drag affordances; pose tabs still navigate.
- [ ] Realtime payloads carry URLs + metadata only (no base64); `judge_cards` no
      longer carries `photos`.
- [ ] Solo routes (`/xavier`, `/open`, …) unchanged — locally editable.
- [ ] `npm test`, `npx tsc --noEmit`, `npm run build` all green.
