# Project: Bodybuilding

Live scorecards for head-to-head bodybuilding comparisons. The application supports solo cards, protected judge desks, host-controlled athlete photos, realtime Supabase synchronization and PNG exports.

## Stack

- Next.js 16 App Router, React 19 and strict TypeScript
- Tailwind CSS 3 and a custom theme system
- Zustand 5 for isolated local scorecard state
- Supabase Realtime and Storage for the live show
- MediaPipe and IMG.LY for photo analysis and background removal
- Vitest 5 for scoring rules

## Local development

Requirements: Node.js 20.9 or newer and npm.

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Development-only fallback access codes are available when the server variables are absent; production refuses to use those fallbacks.

## Environment

| Variable | Scope | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public | Browser-safe Supabase key |
| `SUPABASE_SECRET_KEY` | Server | Preferred private key for new Supabase projects; never expose to the browser |
| `SUPABASE_SERVICE_ROLE_KEY` | Server | Legacy private key accepted in place of `SUPABASE_SECRET_KEY` |
| `GATE_PASSWORD` | Server | Password for solo scorecard routes |
| `GATE_SECRET` | Server | HMAC secret for signed session cookies |
| `JUDGE_CODE_DYLAN` | Server | Project: Bodybuilding owner access; also controls Superchat |
| `JUDGE_CODE_SUPERSETMAN` | Server | Supersetman desk access |
| `JUDGE_CODE_EPZERONINE` | Server | EPzeronine desk access |
| `JUDGE_CODE_MARXMAXMUSCLE` | Server | Marx Max Muscle desk access |
| `JUDGE_CODE_XAVIER` | Server | Xavier desk access |
| `JUDGE_CODE_MARCUS` | Server | Marcus desk access |

Each judge code resolves to a single server-signed identity. Dylan is the only identity authorized for both Project: Bodybuilding and Superchat. Use unique, high-entropy values for all server variables in production.

## Manual Super Chat access

Dylan opens `/host/superchats`, creates an invitation, and posts its link in YouTube chat. The viewer requests access and posts the generated `PB-XXXXXX` code in chat. Dylan approves that exact request, after which the browser receives a signed private session for only its own scorecard. Invitations can be closed or reopened from the same host desk.

## Public live vote

`/vote` is the open audience ballot. Viewers enter only a username—there is no account or approval step—then pick Athlete A, a tie, or Athlete B with the same 1–4 point margin used on the judge cards. Each pose or category is locked after its first submission, and each username can create only one ballot per matchup. Vote totals and weighted 0–100 crowd averages refresh live.

Dylan's Project: Bodybuilding desk is the canonical source for both athlete names. Changes propagate to every judge desk, private Super Chat scorecard, and audience ballot; the other desks display those names as read-only. Changing either athlete starts a clean audience ballot without destroying the previous result.

## Quality checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm audit
```

The service health endpoint is `GET /api/health`.

## Scoring model

Each winner receives `margin × weight` for the row:

| Axis | Rows | Weight |
| --- | ---: | ---: |
| Poses | 8 | ×2 |
| Categories | 4 | ×1 |

Margins run from 1 (tight call) to 4 (different tier). The point differential is normalized to a 0–100 display that always totals 100.

## Docker

The production image uses the Next.js standalone output and runs as an unprivileged user:

```bash
docker build -t project-bodybuilding .
docker run --rm -p 3000:3000 --env-file .env.local project-bodybuilding
```

## Data setup

Apply the SQL files under `supabase/migrations` in order. Migration `0004` removes public access to judge scorecards; authenticated server routes become the only read/write path. Migration `0005` adds the private manual Super Chat invitation and claim flow. Migrations `0006` and `0007` add the server-mediated public live vote and its 1–4 point aggregation. Migration `0008` locks submitted audience choices and prevents duplicate usernames per matchup. Migration `0009` makes Dylan's athlete names canonical across judge and fan cards. The shared show-photo manifest and its public Storage bucket remain readable by the judging clients.
