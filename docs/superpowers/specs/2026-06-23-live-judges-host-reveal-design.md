# Live multi-judge show with host reveal + consensus

Date: 2026-06-23

## Goal

Turn the seven built-in judge "desks" into live cloud tenants. Each judge logs
in (pick desk + one shared code), scores the same matchup on their own device,
and the **Project Bodybuilding** desk — who is both a judge and the host — can
reveal everyone's scorecards at the end and auto-compute a consensus average of
each judge's 0–100 call.

## Decisions (locked)

- **Login:** pick your desk from the roster, then enter one **shared access
  code**. Branding loads from the existing `builtinJudges` registry.
- **Scope:** all 7 desks get a login + live card. Project Bodybuilding is host.
- **Consensus:** average of each judge's **0–100 call** per side (B = 100 − A),
  plus each judge's individual call shown. Only scored judges are averaged.
- **Reveal:** host-screen theater (no DB write). Cards start face-down; the
  host flips them when ready on stream.
- **Soft gate:** shared code is client-side; `judge_cards` allows anon
  read/write. Not a security boundary — same posture as the existing
  `PasswordGate`.

## Data model

New table `public.judge_cards`, one row per judge **slug** (mirrors
`scorecards` but keyed by slug, no auth user):

```
slug            text primary key      -- e.g. 'supersetman'
display_name    text not null default ''
athlete_a       jsonb not null default '{"name":"Athlete A"}'
athlete_b       jsonb not null default '{"name":"Athlete B"}'
rows            jsonb not null default '[]'
current_pose_id text not null default 'FDB'
updated_at      timestamptz not null default now()
```

- `updated_at` auto-bump trigger (reuse `public.touch_updated_at`).
- RLS enabled; anon (and authenticated) may `select`/`insert`/`update` any row.
  Rows are created lazily by the first upsert from a desk.
- Added to the `supabase_realtime` publication so the host board updates live.

Migration: `supabase/migrations/0002_judge_cards.sql`. Types mirrored in
`src/lib/types/db.ts` (`JudgeCardRow` + `judge_cards` in `Database`).

## Components / routes

- **`src/lib/show.ts`** — `SHOW_CODE` constant, localStorage keys, and helpers
  `getJudgeSession()` / `setJudgeSession(slug)` / `clearJudgeSession()`.
- **`src/components/JudgeCardProvider.tsx`** — wraps `ScorecardStoreProvider`
  with two-way Supabase sync keyed by slug. Mirrors `CloudScorecardProvider`
  but **realtime ON** (the host must see remote writes; a judge ignores its own
  echoes via an updated_at guard).
- **`/login`** (redesigned) — broadcast roster of the 7 desks → tap → shared
  code field → store session → route to `/desk` (host also sees a Host console
  link).
- **`/desk`** — reads `judgeSlug` from localStorage (else → `/login`); renders
  that judge's themed `ScorecardPage` wrapped in `JudgeCardProvider(slug)`.
  Footer control bar: which desk you are, "Switch desk" (sign out), and — for
  project-bodybuilding only — a "Host console" link.
- **`/host`** — project-bodybuilding only (else → `/login`). Realtime board of
  all 7 desks face-down (logo + scored/waiting). "Reveal" flips to each judge's
  0–100 call + raw points, then animates the consensus + winner banner.

## Math

In `src/lib/scoring.ts` (covered by `scoring.test.ts`):

```
consensus(cards) -> {
  perJudge: { slug, scored, pointsA, pointsB, displayA, displayB }[],
  scoredCount,
  consensusA, consensusB,        // mean of displayA over scored judges; B = 100 - A
  verdict                        // winner side + margin, or DEAD HEAT
}
```

Scoring is by **side** (left = A / right = B); names are labels. The host's own
card supplies the athlete labels shown on the consensus.

## Replacements / cleanup

The username `/login` → `/me` → `/live` flow was the first cut of this idea and
is superseded. Remove `src/app/me/`, `src/app/live/`, and the orphaned
`CloudScorecardProvider` + `VisibilityToggle`. Leave the `profiles`/`scorecards`
tables and `/auth/*` routes dormant (not dropped). Home "Judging Panel" tiles
and a new "Enter the live show" CTA point into the new `/login` flow.

## Verification

`tsc --noEmit`, `next lint`, `next build`, a `scoring.test.ts` case for
`consensus`, and a headless screenshot pass of `/login`, `/desk`, `/host`.
