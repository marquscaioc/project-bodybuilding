# Signed-margin scoring lab (`/lab`) — design

**Date:** 2026-07-27
**Status:** approved, ready for implementation

## Problem

The live scoring engine (`src/lib/scoring.ts`) cannot express "these two are even."

A judge picks a **winner** plus a **margin** of 1–4. On a category row a tie is
possible but it is a special case that awards `1 + 1`; on a pose row a tie is not
representable at all. When a judge genuinely thinks a pose is dead even, the
system forces a lie in one direction or the other. That is thrown-away
information, and it is the largest single source of noise in the card.

Three further problems are rescaling problems rather than lost information, but
they compound the first:

1. `MAX_DIFFERENTIAL = 80` (Σweights × 4) means real cards use ~17 of the 100
   display points. Every verdict looks like a coin flip.
2. `consensus()` takes a plain mean of the desks' 0–100 calls, so one rogue desk
   swings the panel by several display points.
3. The panel reports a single number with no sense of whether the desks agree.
   A 0.1 "win" reads as precision that the spread does not support.

## Goal

A **testbed**, not a migration. A new route where the alternative engine can be
driven by hand, compared against the live engine on identical judge calls, and
stress-tested at panel level — while `/desk`, `/host` and the live show keep
running the current algorithm untouched.

## Non-goals

- Changing anything about the live scoring path.
- Inverse-variance desk weights and judge-severity calibration (many-facet
  Rasch). Deferred until historical cards exist; the spec author's own call.
- Writing to Supabase. The lab reads `judge_cards`; it never writes.
- Half-point margins. Considered and rejected for now: integer margins plus a
  zero is the change that adds information; 0.5 steps only subdivide it.

## Architecture

Purely additive. Eight new files, one new route, not linked from anywhere — you
reach `/lab` by typing the URL. Deleting the folder restores the previous state
exactly.

```
src/lib/scoringV2.ts                  engine + V1<->V2 converters
src/lib/scoringV2.test.ts             vitest, written before the engine
src/lib/storeV2.ts                    zustand, key 'scorecard-v2:lab'
src/components/lab/MarginRuler.tsx    the -4..0..+4 picker
src/components/lab/LabCard.tsx        12 rows + live totals
src/components/lab/ComparePanel.tsx   V1 vs V2 on the same card
src/components/lab/PanelSim.tsx       7-desk simulator
src/app/lab/page.tsx                  the page
```

Untouched: `scoring.ts`, `types/index.ts`, `store.ts`, `CellPicker.tsx`,
`ScorecardPage.tsx`, `/desk`, `/host`, every judge route, the DB schema.

## The engine

### Signed margin

```ts
export type SignedMargin = -4|-3|-2|-1|0|1|2|3|4;   // positive = Athlete A
export type RowV2 = {
  id: string; label: string; type: RowType;
  margin: SignedMargin | null;                       // null = not yet judged
};

export function rowPointsV2(row: RowV2) {
  const w = row.type === 'pose' ? POSE_WEIGHT : CATEGORY_WEIGHT;
  const d = (row.margin ?? 0) * w;
  return d >= 0 ? { a: d, b: 0 } : { a: 0, b: -d };
}
```

`0` is a first-class value meaning dead even, and it is available on **poses and
categories alike**. The `1 + 1` category special case disappears.

`null` (untouched) and `0` (deliberately even) both contribute zero points but
are distinct: `scored` is defined as "some row has a non-null margin", so a
card of deliberate zeros counts as scored while a blank card does not.

### Fixed denominator, still linear

```ts
export const MAX_DIFFERENTIAL_V2 = 20;   // Σweights × 1 = 8*2 + 4*1
const aDisplay = 50 + 50 * Math.max(-1, Math.min(1, diff / MAX_DIFFERENTIAL_V2));
```

One sentence a viewer understands: **win every row by at least the minimum
margin and you score 100.** Range use goes from ~17 points to ~68. Clipping is
handled by the clamp; recalibrate the denominator to 2.5σ of real differentials
once 30+ cards exist.

### Consensus: trimmed mean, pooled in points space

```ts
const pts = scored.map(j => j.diff).sort((x, y) => x - y);
const core = pts.length >= 5 ? pts.slice(1, -1) : pts;
const meanDiff = core.reduce((s, v) => s + v, 0) / core.length;
```

Drop the high and the low before averaging — the gymnastics/diving standard.
Trimming applies only at **N ≥ 5** scored desks; discarding 2 of 4 is vandalism.

**Deliberate behavioural difference from V1, accepted:** V1 averages the desks'
already-clipped 0–100 displays. V2 pools raw signed differentials and converts
**once**, at the end. A desk that saturates its own display at 100 still
contributes its full raw differential to the panel mean. Consequence: the panel
consensus is *not* the mean of the numbers shown on the desk cards. This is the
point of "pools in points space" — it is what stops the denominator change from
throwing away the very information the signed margin created.

### Uncertainty

```ts
sd  = sample standard deviation over ALL scored desks (not the trimmed core)
sem = sd / Math.sqrt(N)
tooClose = Math.abs(meanDiff) < 1.96 * sem
```

When `tooClose`, the verdict renders **TOO CLOSE TO CALL** instead of a 0.1 win.
Edge cases: `N = 1` → sd 0 → sem 0 → never too close. `N = 0` → 50/50, no
verdict.

### Converters

```ts
v1RowToV2(row)   // winner+margin  -> signed
  null winner            -> null
  'tie'                  -> 0
  'A' | 'B' with margin m -> +m | -m

v2RowToV1(row)   // signed -> winner+margin, for the comparison panel only
  null                   -> { winner: null,  margin: null }
  0, category            -> { winner: 'tie', margin: null }   // V1's 1+1
  0, pose                -> { winner: null,  margin: null }   // V1 cannot say "even"
  +m | -m                -> { winner: 'A'|'B', margin: |m| }
```

The pose-zero row of `v2RowToV1` is the whole argument made mechanical: the
round-trip is lossy in exactly the place where V1 loses information.

## UI

### Margin ruler

One ruler per row, replacing the two A/B cells:

```
Front Double Biceps    | -4 -3 -2 -1 | 0 | +1 +2 +3 +4 |
                          <-- B ------  =   ------ A -->
```

Zero sits at the centre and is visually emphasised — it is the call a judge most
often means and currently cannot make. Negative cells carry side B's tint,
positive cells side A's. Narrow screens scroll the ruler horizontally.

### Compare panel

The lab card is V2-native. The panel converts it down to V1 rows and runs both
engines on identical judge calls, showing raw points, the 0–100 score, range
use, and verdict for each, plus the delta.

**Import card** scans `localStorage` for keys matching `scorecard:*` (judge
desks and solo playgrounds alike), lists those holding data, and converts the
chosen one via `v1RowToV2`.

Reference fixture (Kai vs Samson, from `scoring.test.ts`): identical calls give
**V1 = 48.1 / 51.9** and **V2 = 42.5 / 57.5**.

### Panel simulator

Seven desks, each with an adjustable signed differential (−20…+20). Three
sources: manual, **Randomise**, and **Load live desks** (the same `judge_cards`
query `/host` runs, converted V1→V2). Output: simple mean vs trimmed mean (with
the trimmed desks marked in the grid), sd, SEM, 1.96×SEM, and the verdict —
including TOO CLOSE TO CALL.

Without this, items 3 and 4 of the proposal have no way to be tested before the
show.

## Testing

`scoringV2.test.ts`, written before the engine:

- `rowPointsV2` — signs, pose ×2 / category ×1, `0` → `{a:0,b:0}`, `null` → `{a:0,b:0}`
- sweep at ±1 → exactly 100/0 and 0/100 (the viewer-facing promise)
- sweep at ±4 → clamped to 100/0, no overflow past the ends
- blank card → 50/50; all-zero card → 50/50 but `scored: true`
- Kai vs Samson fixture → 42.5 / 57.5
- `consensusV2` — trimmed mean drops the rogue desk; no trimming below N=5;
  pooled-in-points behaviour when a desk saturates
- TOO CLOSE TO CALL threshold, and the N=1 / N=0 edges

## Risks

- **Divergence:** two engines to reason about until one wins. Mitigated by the
  lab being unlinked and read-only — it cannot affect a live show.
- **Denominator is a guess:** 20 is Σweights × 1, not a calibrated figure. The
  spec already schedules recalibration to 2.5σ after 30+ cards.
- **Saturation:** with the fixed denominator, individual desk displays clip more
  often. Intended; the panel maths sees through it because it pools raw points.
