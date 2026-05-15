# Scoring accuracy: half-step margins + multi-judge averaging

**Date:** 2026-05-14
**Status:** Approved (pending user review of this written doc)
**Scope:** `project-bodybuilding/` — the Chow's Scorecard app

## Background

The current scoring system uses a coarse 1–4 integer margin scale, with a single judge per match. The host (Chow) wants the math to be "more accurate." Brainstorming surfaced four candidate accuracy levers — granularity, per-row weights, multi-judge aggregation, display-curve reshaping. The user picked **finer granularity** and, in the same conversation, expanded scope to add **N-judge support with an averaged third spreadsheet**.

The accepted shape: half-step margins (1, 1.5, 2, 2.5, 3, 3.5, 4) for finer per-row resolution, plus a multi-judge model where each judge fills their own scorecard and a separate "Average" view aggregates them.

## Goals

1. Increase per-row resolution from 4 integer levels to 7 levels (whole + half).
2. Support 1 to N judges per match, with editable judge names and add/remove controls.
3. Provide a read-only averaged spreadsheet that aggregates all judges' scorecards into a single derived view.
4. Preserve backward-compatibility for any scorecard where all judges happened to use whole-number margins — the existing Kai vs Samson fixture must still produce 48.1 / 51.9.

## Non-goals

- Per-pose or per-category weighting beyond the existing ×2 / ×1 weights.
- Reshaping the linear differential → 0–100 display curve.
- Persisting matches across sessions (local storage / history). Each match is in-memory.
- Real-time judge collaboration (no backend; judges fill cards on the same device by switching tabs).

## Data model

```ts
// types/index.ts

export type Athlete = { name: string; imageUrl?: string };

export type RowType = 'pose' | 'category';
export type Side = 'A' | 'B';
export type Outcome = Side | 'tie';

// Widened from 1 | 2 | 3 | 4
export type Margin = 1 | 1.5 | 2 | 2.5 | 3 | 3.5 | 4;

export type Row = {
  id: string;
  label: string;
  type: RowType;
  winner: Outcome | null;
  margin: Margin | null;
};

export type Judge = {
  id: string;              // uuid (crypto.randomUUID)
  name: string;            // editable, default "Judge N"
  rows: Row[];             // 12 rows, full scorecard
};

export type Match = {
  athleteA: Athlete;       // shared across all judges
  athleteB: Athlete;       // shared across all judges
  judges: Judge[];         // length >= 1
  activeJudgeId: string;   // which tab is currently active (judge id, or '__average__')
  averageGeneratedAt: number | null; // ms timestamp; null = not generated
};
```

**Shared vs per-judge:**
- Athletes are shared. Both/all judges score the same matchup. Renaming "Kai" on one tab renames it everywhere.
- Rows are per-judge. Each judge picks their own winner + margin on each row.

## Math

### Single-judge scoring (unchanged structure)

`points = margin * weight`, where pose weight = 2, category weight = 1. Half-step margins flow through naturally — points become fractional (e.g. category margin 1.5 → 1.5 points). Tie state on a category row still awards 1 point to each athlete. Max differential remains 80. The 0–100 display formula is unchanged.

### Multi-judge averaging

New pure function `averageScorecards(judges: Judge[])`:

```ts
// For each row id, average each judge's points contribution per side.
// Then sum across rows to get total averaged points per side.
// Feed into the existing displayScores formula.

export function averageScorecards(judges: Judge[]): {
  rows: Array<{
    id: string;
    label: string;
    type: RowType;
    aPoints: number;   // averaged across all judges
    bPoints: number;
  }>;
  totals: { a: number; b: number };
  display: { a: number; b: number };
  verdict: Verdict;
};
```

- For each row id (all judges have identical row ids), compute `rowPoints` for each judge, then average the `.a` and `.b` independently across judges.
- A row where judges disagree on the winner naturally yields fractional points on **both** sides (e.g. Judge1 gives A=4, Judge2 gives B=2 → averaged row has A=2, B=1).
- Total points are the sum of averaged row points per side. Differential and display use the existing formula.
- For 1 judge, the function returns that judge's scorecard unchanged (identity).
- For 0 judges, undefined behavior — caller must guarantee `judges.length >= 1`. UI enforces this.

### Reproducibility

The math remains computable by any viewer from the displayed rows: each row in the Average view shows averaged A and B points. Anyone can verify by re-averaging the judges' visible spreadsheets.

## UI

### Tabs

Tab strip lives at the top of the scorecard frame, above the title block:

```
┌────────────────────────────────────────────────────────────┐
│ [● Judge 1 ×] [Judge 2 ×] [Judge 3 ×] [+ Add Judge]  │ Average ✱ │
└────────────────────────────────────────────────────────────┘
```

- Active tab: accent underline + bold name.
- Judge name editable inline (click name → `<input>` swap on focus → blur saves).
- × removes that judge. Disabled when only 1 judge remains.
- "+ Add Judge" appends a new judge with default name `Judge ${judges.length + 1}` and an empty 12-row scorecard.
- Average tab is right-aligned with a visual divider. Visible always; disabled-styled when `judges.length < 2`.

### Active card content

When a judge tab is active: render the existing `Scorecard` (TitleBlock + ScoreTable for poses, ScoreTable for categories, FinalScore) bound to that judge's rows.

When the Average tab is active:
- If `averageGeneratedAt == null` → centered empty state: "Generate Average" button + caption "Computes the averaged spreadsheet from all judges' scorecards."
- If `averageGeneratedAt != null` → render `AverageScorecard` component (read-only): two tables (poses, categories) showing per-row averaged A and B points, total rows, then a `FinalScore`-style block at the bottom for the averaged 0–100 score. At the top: "Generated at HH:MM:SS" + a "Regenerate" button.
- If any judge's rows have been edited since `averageGeneratedAt` → show a small "STALE" badge on the Average tab and highlight the Regenerate button in accent red.

### Picker (CellPicker)

Two-row layout to accommodate 7 margins + tie + clear:

```
┌─────┬─────┬─────┬─────┬─────┬───┐
│  1  │  2  │  3  │  4  │ TIE │ × │   ← row 1 (whole steps)
├─────┼─────┼─────┼─────┴─────┴───┤
│ 1.5 │ 2.5 │ 3.5 │                ←  row 2 (half steps)
└─────┴─────┴─────┘
```

- Row 1: whole margins + TIE (categories only) + clear (×). Same buttons as today.
- Row 2: half margins only. Narrower (3 cells, right-of-row empty space).
- TIE only renders on category rows. × always renders.
- Cell display unchanged: fractional values (e.g. "2.5") render in tabular Bebas Neue.

When rendered inside `AverageScorecard`, cells are non-interactive — they display the averaged number but clicking does nothing (no popover opens).

### Reset semantics

- `Reset` button clears the **active judge's** rows. Athletes, judge list, and judge names are preserved.
- `Reset` only operates on judge tabs. On the Average tab, the Reset button is hidden.

## File map

### New files

| File | Purpose |
|---|---|
| `src/components/JudgeTabs.tsx` | Tab strip: judge tabs (editable name, ×), Add Judge button, Average tab with stale indicator |
| `src/components/AverageScorecard.tsx` | Read-only averaged view: empty state with Generate button, then averaged tables + final score + Regenerate button |

### Modified files

| File | Change |
|---|---|
| `src/types/index.ts` | `Margin` widened to 7 values; add `Judge`; restructure `Match` (`judges[]`, `activeJudgeId`, `averageGeneratedAt`) |
| `src/lib/store.ts` | Restructure: actions now operate on the active judge. Add `addJudge`, `removeJudge`, `renameJudge`, `setActiveJudge`, `markAverageGenerated`, `invalidateAverage` |
| `src/lib/scoring.ts` | Add `averageScorecards(judges)`. Existing functions unchanged (already accept fractional margins) |
| `src/lib/scoring.test.ts` | Keep fixture; add half-step tests; add averaging tests (1 judge identity, 2 judges, 3 judges with disagreement, all-tied categories across judges) |
| `src/components/CellPicker.tsx` | Two-row layout; new `readOnly` prop (default false) to disable popover when used in average view |
| `src/components/ScoreTable.tsx` | Accept optional `readOnly` prop forwarded to CellPicker; otherwise unchanged |
| `src/components/Scorecard.tsx` | Wrap in JudgeTabs; render active judge's card OR `AverageScorecard` depending on `activeJudgeId` |
| `src/app/page.tsx` | Minor: title bar unchanged; `Reset` button hides on Average tab |

### Untouched

`globals.css`, `TitleBlock.tsx`, `FinalScore.tsx`, `ResetButton.tsx`, `ExportButton.tsx` (export captures whatever tab is currently visible, which is the desired behavior).

## Test plan

All tests in `src/lib/scoring.test.ts`. Vitest, run with `npm test`.

### Half-step tests (new)

- `rowPoints` with `margin: 2.5` on a pose row → `{ a: 5, b: 0 }`.
- `rowPoints` with `margin: 1.5` on a category row → `{ a: 1.5, b: 0 }`.
- `displayScores` with a fixture identical to Kai vs Samson except FDB's margin is bumped 2 → 2.5: totals `{ a: 21.5, b: 24 }`, display `{ a: 48.4, b: 51.6 }`. (Verifies fractional flow through to display.)

### Multi-judge averaging tests (new)

- 1 judge: `averageScorecards([judge])` returns row points and totals identical to that judge's single-judge scorecard.
- 2 judges agree on every row: average equals either judge's card.
- 2 judges disagree on FDB (J1 says A wins margin 2, J2 says B wins margin 1): averaged FDB row → `{ aPoints: 2, bPoints: 1 }`. Other rows averaged correctly.
- 3 judges: at least one row where judges split A/B/A or 'tie'; verify averaged points sum.
- All-tied category card across 2 judges: averaged category totals = `{ a: 4, b: 4 }` (1 per row × 4 rows, averaged with another all-tied = same).

### Regression

- Existing Kai vs Samson fixture must still produce `{ a: 21, b: 24 }` / `{ a: 48.1, b: 51.9 }` / `Samson by 3.8`. This is the canonical proof the half-step change is backward-compatible.

## Open questions

These are decisions to make during implementation, not blockers:

1. **"Clear all judges" affordance.** Currently no way to reset back to "1 default judge". Default decision: leave it out; user can × judges manually. Revisit if it feels missing.
2. **PNG export on the Average tab.** Should export work on the average view? Default decision: yes — `ExportButton` captures whatever frame is on screen. The averaged spreadsheet exports as-is.
3. **Persistence on add/remove.** When you add Judge 2 mid-card, Judge 1's progress is preserved. When you × Judge 1, all of Judge 1's rows are lost (no undo). Acceptable for v1.
4. **Stale detection cost.** Naive approach: every store update for any judge row invalidates `averageGeneratedAt`. Cheap enough at 12 rows × N judges.

## Migration

No persisted data exists (no local storage, no DB). The change is purely in-memory.

## Acceptance checklist

- [ ] `Margin` type covers all 7 values; picker shows them in two rows.
- [ ] Reference fixture (Kai vs Samson) still produces 48.1 / 51.9 / Samson by 3.8.
- [ ] Half-step tests pass.
- [ ] Add/remove/rename judges works; minimum 1 judge enforced.
- [ ] Average tab disabled below 2 judges; empty state until first generation.
- [ ] Average view shows averaged per-row points and an averaged final 0–100 score.
- [ ] STALE indicator appears when any judge edits after generation; clears on Regenerate.
- [ ] Active judge's reset clears only their rows.
- [ ] Build (`npm run build`) and tests (`npm test`) green.
