# Scoring Accuracy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add half-step margins (1, 1.5, 2, 2.5, 3, 3.5, 4) and N-judge support with a derived "Average" scorecard view.

**Architecture:** All client-side. The store holds an array of `Judge` objects (each with their own 12 rows) plus a shared `athleteA` / `athleteB`. Components render the *active* judge's card via a `useActiveJudge` hook. A pure `averageScorecards()` function in `scoring.ts` produces the averaged view from the judges array. UI gains a tab strip on top of the existing scorecard frame.

**Tech Stack:** Next.js 14 (App Router), TypeScript strict, Tailwind, Zustand, Vitest, html-to-image.

**Spec reference:** `docs/superpowers/specs/2026-05-14-scoring-accuracy-design.md`

**Working directory for all commands:** `C:\Users\Caio\Desktop\PROJECT BB\project-bodybuilding`

---

## Task 0: Initialize git and baseline commit

The project isn't a git repo yet. We need git working before we can do per-task commits.

**Files:**
- Create: `.gitignore` (only if missing)

- [ ] **Step 1: Verify git repo state**

Run from `project-bodybuilding/`:

```bash
git rev-parse --is-inside-work-tree 2>/dev/null || echo "NOT A REPO"
```

Expected: `NOT A REPO` (then continue). If it prints `true`, skip to Step 4.

- [ ] **Step 2: Initialize git**

```bash
git init -b main
```

Expected: `Initialized empty Git repository in ...`.

- [ ] **Step 3: Verify .gitignore exists and ignores node_modules + .next**

The Next.js scaffold should have created `.gitignore`. Check:

```bash
cat .gitignore | grep -E "^(node_modules|\.next)$"
```

Expected: both `node_modules` and `.next` listed. If not, append them:

```bash
printf "\nnode_modules\n.next\n" >> .gitignore
```

- [ ] **Step 4: Stage everything and commit baseline**

```bash
git add -A
git status --short | head -20
git commit -m "chore: baseline before scoring-accuracy work"
```

Expected: a single commit with all current files.

---

## Task 1: Widen `Margin` type to half-steps

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Update the Margin type**

Open `src/types/index.ts`. Replace the `Margin` declaration:

```ts
// Before:
export type Margin = 1 | 2 | 3 | 4;

// After:
export type Margin = 1 | 1.5 | 2 | 2.5 | 3 | 3.5 | 4;
```

- [ ] **Step 2: Type-check the project**

```bash
npx tsc --noEmit
```

Expected: no errors. (The existing code uses `row.margin * weight` which is just numeric multiplication — fractional margins flow through unchanged.)

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(types): widen Margin to include half-steps"
```

---

## Task 2: Add half-step scoring tests (TDD verification)

**Files:**
- Modify: `src/lib/scoring.test.ts`

- [ ] **Step 1: Add 3 new tests at the bottom of the file**

Open `src/lib/scoring.test.ts`. Add at the end of the file (after the `describe('category ties', ...)` block):

```ts
describe('half-step margins', () => {
  it('pose with margin 2.5 awards 5 points to the winner', () => {
    expect(
      rowPoints({ id: 'x', label: 'x', type: 'pose', winner: 'A', margin: 2.5 }),
    ).toEqual({ a: 5, b: 0 });
  });

  it('category with margin 1.5 awards 1.5 points to the winner', () => {
    expect(
      rowPoints({ id: 'x', label: 'x', type: 'category', winner: 'B', margin: 1.5 }),
    ).toEqual({ a: 0, b: 1.5 });
  });

  it('FDB bumped from 2 to 2.5 shifts display from 48.1/51.9 to 48.4/51.6', () => {
    const rows = buildInitialRows();
    const set = (id: string, winner: 'A' | 'B', margin: 1 | 1.5 | 2 | 2.5 | 3 | 3.5 | 4) => {
      const r = rows.find((x) => x.id === id)!;
      r.winner = winner;
      r.margin = margin;
    };
    // Same as Kai vs Samson fixture, but FDB is 2.5 instead of 2.
    set('FDB', 'A', 2.5);
    set('FLS', 'B', 2);
    set('SC', 'B', 2);
    set('RDB', 'A', 3);
    set('RLS', 'B', 2);
    set('ST', 'B', 3);
    set('AB+T', 'A', 3);
    set('MM', 'B', 2);
    set('muscularity', 'A', 1);
    set('conditioning', 'A', 3);
    set('shape', 'B', 2);
    set('flaws', 'A', 1);

    expect(totalPoints(rows)).toEqual({ a: 21.5, b: 24 });
    expect(displayScores(rows)).toEqual({ a: 48.4, b: 51.6 });
  });
});
```

- [ ] **Step 2: Run tests to confirm they pass**

```bash
npm test
```

Expected: all 14 tests pass (was 11; added 3). The pre-existing Kai vs Samson regression test still produces 48.1 / 51.9.

- [ ] **Step 3: Commit**

```bash
git add src/lib/scoring.test.ts
git commit -m "test(scoring): cover half-step margins"
```

---

## Task 3: Two-row CellPicker UI

The picker currently shows: `1 | 2 | 3 | 4 | (TIE) | ×`. Add a second row with `1.5 | 2.5 | 3.5`.

**Files:**
- Modify: `src/components/CellPicker.tsx`

- [ ] **Step 1: Replace the picker layout**

Open `src/components/CellPicker.tsx`. Find the `MARGINS` constant near the top:

```ts
const MARGINS: Margin[] = [1, 2, 3, 4];
```

Replace with two arrays:

```ts
const WHOLE_MARGINS: Margin[] = [1, 2, 3, 4];
const HALF_MARGINS: Margin[] = [1.5, 2.5, 3.5];
```

Then in the JSX, find the `<div className="absolute left-1/2 top-full ...">` popover. Replace its inner `<div className="flex">...</div>` with a two-row container:

```tsx
<div className="absolute left-1/2 top-full z-30 mt-1 -translate-x-1/2 rounded-md border border-white/30 bg-[#111] shadow-[0_18px_36px_-8px_rgba(0,0,0,0.7)]">
  <div className="flex border-b border-white/15">
    {WHOLE_MARGINS.map((m, i) => {
      const selected = isWinnerSide && row.margin === m;
      return (
        <button
          key={m}
          type="button"
          onClick={() => commitMargin(m)}
          className={clsx(
            'flex h-12 w-12 items-center justify-center font-display text-2xl text-[var(--fg)] transition hover:bg-[var(--accent)] hover:text-white',
            i > 0 && 'border-l border-white/20',
            selected && 'bg-[var(--accent)] text-white',
          )}
        >
          {m}
        </button>
      );
    })}
    {canTie && (
      <button
        type="button"
        onClick={commitTie}
        className={clsx(
          'flex h-12 w-14 items-center justify-center border-l border-white/20 font-display text-base uppercase tracking-[0.2em] transition hover:bg-[var(--accent)] hover:text-white',
          isTie ? 'bg-[var(--accent)] text-white' : 'text-[var(--fg)]',
        )}
        title="Tied row (1 point each)"
      >
        Tie
      </button>
    )}
    <button
      type="button"
      onClick={clear}
      className="flex h-12 w-10 items-center justify-center border-l border-white/20 text-sm uppercase tracking-widest text-[var(--fg-dim)] transition hover:bg-white/10 hover:text-[var(--fg)]"
      title="Clear"
    >
      ×
    </button>
  </div>
  <div className="flex">
    {HALF_MARGINS.map((m, i) => {
      const selected = isWinnerSide && row.margin === m;
      return (
        <button
          key={m}
          type="button"
          onClick={() => commitMargin(m)}
          className={clsx(
            'flex h-10 w-12 items-center justify-center font-display text-xl text-[var(--fg-dim)] transition hover:bg-[var(--accent)] hover:text-white',
            i > 0 && 'border-l border-white/15',
            selected && 'bg-[var(--accent)] text-white',
          )}
        >
          {m}
        </button>
      );
    })}
  </div>
</div>
```

The whole-step row keeps the TIE + × buttons (only the picker numbers split into two rows). The half-step row is shorter (3 cells, narrower height) so it visually signals "optional precision".

- [ ] **Step 2: Manual smoke check in dev server**

If dev server isn't running:

```bash
npm run dev
```

Open `http://localhost:3000`, click any cell. Verify:
- Top row shows `1 2 3 4 [TIE if category] ×`
- Bottom row shows `1.5 2.5 3.5`
- Clicking `2.5` sets the cell to `2.5` and closes the picker
- The cell displays `2.5` afterward

- [ ] **Step 3: Run `npm run build` to catch any TS/lint errors**

```bash
npm run build
```

Expected: clean build.

- [ ] **Step 4: Commit**

```bash
git add src/components/CellPicker.tsx
git commit -m "feat(picker): two-row layout with half-step margins"
```

---

## Task 4: Add `Judge` type and restructure `Match`

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Replace the file contents**

Replace `src/types/index.ts` entirely with:

```ts
export type Athlete = {
  name: string;
  imageUrl?: string;
};

export type RowType = 'pose' | 'category';

export type Side = 'A' | 'B';

export type Outcome = Side | 'tie';

export type Margin = 1 | 1.5 | 2 | 2.5 | 3 | 3.5 | 4;

export type Row = {
  id: string;
  label: string;
  type: RowType;
  winner: Outcome | null;
  margin: Margin | null;
};

export type Judge = {
  id: string;
  name: string;
  rows: Row[];
};

// Sentinel value for `activeJudgeId` when the Average tab is selected.
export const AVERAGE_TAB_ID = '__average__' as const;
export type ActiveTabId = string; // either a Judge id or AVERAGE_TAB_ID

export type Match = {
  athleteA: Athlete;
  athleteB: Athlete;
  judges: Judge[];               // length >= 1
  activeJudgeId: ActiveTabId;
  averageGeneratedAt: number | null; // ms epoch; null = not generated
};
```

- [ ] **Step 2: Type-check (will fail — that's expected; the store hasn't been updated yet)**

```bash
npx tsc --noEmit
```

Expected: errors in `src/lib/store.ts` referring to `rows` not on `Match`. That's fine — the next task fixes the store. Do NOT commit yet — leave this and Task 5 in one commit so the codebase doesn't go through a broken state.

---

## Task 5: Rewrite the store for multi-judge

**Files:**
- Modify: `src/lib/store.ts`

- [ ] **Step 1: Replace the file contents**

Replace `src/lib/store.ts` entirely with:

```ts
'use client';

import { create } from 'zustand';
import type { ActiveTabId, Athlete, Judge, Margin, Match, Outcome, Side } from '@/types';
import { AVERAGE_TAB_ID } from '@/types';
import { buildInitialRows } from './constants';

function newId(): string {
  // crypto.randomUUID is available in modern browsers and Node 19+.
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 10);
}

function newJudge(name: string): Judge {
  return { id: newId(), name, rows: buildInitialRows() };
}

type State = Match & {
  setName: (side: Side, name: string) => void;
  setImage: (side: Side, imageUrl: string | undefined) => void;

  // Operates on the active judge. No-op if Average tab is active.
  setRow: (rowId: string, winner: Outcome | null, margin: Margin | null) => void;

  // Judge management
  addJudge: () => void;
  removeJudge: (judgeId: string) => void;
  renameJudge: (judgeId: string, name: string) => void;
  setActiveJudge: (id: ActiveTabId) => void;

  // Average lifecycle
  markAverageGenerated: () => void;

  // Reset clears the active judge's rows. No-op on Average tab.
  reset: () => void;
};

const firstJudge = newJudge('Judge 1');

export const useScorecard = create<State>((set, get) => ({
  athleteA: { name: 'Athlete A' },
  athleteB: { name: 'Athlete B' },
  judges: [firstJudge],
  activeJudgeId: firstJudge.id,
  averageGeneratedAt: null,

  setName: (side, name) =>
    set((s) =>
      side === 'A'
        ? { athleteA: { ...s.athleteA, name } }
        : { athleteB: { ...s.athleteB, name } },
    ),

  setImage: (side, imageUrl) =>
    set((s) =>
      side === 'A'
        ? { athleteA: { ...s.athleteA, imageUrl } }
        : { athleteB: { ...s.athleteB, imageUrl } },
    ),

  setRow: (rowId, winner, margin) =>
    set((s) => {
      if (s.activeJudgeId === AVERAGE_TAB_ID) return {};
      return {
        judges: s.judges.map((j) =>
          j.id === s.activeJudgeId
            ? {
                ...j,
                rows: j.rows.map((r) =>
                  r.id === rowId ? { ...r, winner, margin } : r,
                ),
              }
            : j,
        ),
        // Any edit invalidates the cached "average generated" timestamp.
        averageGeneratedAt: null,
      };
    }),

  addJudge: () =>
    set((s) => {
      const j = newJudge(`Judge ${s.judges.length + 1}`);
      return { judges: [...s.judges, j], averageGeneratedAt: null };
    }),

  removeJudge: (judgeId) =>
    set((s) => {
      if (s.judges.length <= 1) return {};
      const remaining = s.judges.filter((j) => j.id !== judgeId);
      const newActive =
        s.activeJudgeId === judgeId
          ? remaining[0].id
          : s.activeJudgeId;
      return {
        judges: remaining,
        activeJudgeId: newActive,
        averageGeneratedAt: null,
      };
    }),

  renameJudge: (judgeId, name) =>
    set((s) => ({
      judges: s.judges.map((j) => (j.id === judgeId ? { ...j, name } : j)),
    })),

  setActiveJudge: (id) => set({ activeJudgeId: id }),

  markAverageGenerated: () => set({ averageGeneratedAt: Date.now() }),

  reset: () =>
    set((s) => {
      if (s.activeJudgeId === AVERAGE_TAB_ID) return {};
      return {
        judges: s.judges.map((j) =>
          j.id === s.activeJudgeId ? { ...j, rows: buildInitialRows() } : j,
        ),
        averageGeneratedAt: null,
      };
    }),
}));

// --- Selectors ---

export function useActiveJudge(): Judge | null {
  return useScorecard((s) => {
    if (s.activeJudgeId === AVERAGE_TAB_ID) return null;
    return s.judges.find((j) => j.id === s.activeJudgeId) ?? null;
  });
}

export function useActiveRows() {
  // Returns the active judge's rows, or [] when on Average tab.
  return useScorecard((s) => {
    if (s.activeJudgeId === AVERAGE_TAB_ID) return [];
    return s.judges.find((j) => j.id === s.activeJudgeId)?.rows ?? [];
  });
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: errors are now in components that read `s.rows` directly. Specifically:
- `src/components/Scorecard.tsx`
- `src/components/ScoreTable.tsx`
- `src/components/TotalsPanel.tsx` (if still imported anywhere)
- `src/components/FinalScore.tsx`

That's fine — Task 7 fixes them.

---

## Task 6: Add `averageScorecards` function with tests (TDD)

**Files:**
- Modify: `src/lib/scoring.test.ts` (add tests first)
- Modify: `src/lib/scoring.ts` (add function)

- [ ] **Step 1: Add the failing tests**

At the end of `src/lib/scoring.test.ts`, add:

```ts
import type { Judge } from '@/types';
import { averageScorecards } from './scoring';

function makeJudge(name: string, edits: Array<[string, 'A' | 'B' | 'tie', 1 | 1.5 | 2 | 2.5 | 3 | 3.5 | 4 | null]>): Judge {
  const rows = buildInitialRows();
  for (const [id, winner, margin] of edits) {
    const r = rows.find((x) => x.id === id);
    if (!r) throw new Error(`row ${id} not found`);
    r.winner = winner;
    r.margin = margin;
  }
  return { id: name, name, rows };
}

describe('averageScorecards', () => {
  it('with 1 judge, returns that judge\'s scorecard verbatim', () => {
    const j = makeJudge('J1', [
      ['FDB', 'A', 2],
      ['muscularity', 'B', 3],
    ]);
    const out = averageScorecards([j]);
    const fdb = out.rows.find((r) => r.id === 'FDB')!;
    const musc = out.rows.find((r) => r.id === 'muscularity')!;
    expect(fdb).toMatchObject({ aPoints: 4, bPoints: 0 });
    expect(musc).toMatchObject({ aPoints: 0, bPoints: 3 });
    expect(out.totals).toEqual({ a: 4, b: 3 });
  });

  it('with 2 judges agreeing, average equals either card', () => {
    const j1 = makeJudge('J1', [['FDB', 'A', 2]]);
    const j2 = makeJudge('J2', [['FDB', 'A', 2]]);
    const out = averageScorecards([j1, j2]);
    const fdb = out.rows.find((r) => r.id === 'FDB')!;
    expect(fdb).toMatchObject({ aPoints: 4, bPoints: 0 });
    expect(out.totals).toEqual({ a: 4, b: 0 });
  });

  it('with 2 judges disagreeing on FDB winner, both sides get fractional points', () => {
    // J1: A wins margin 2 (A=4, B=0); J2: B wins margin 1 (A=0, B=2)
    // Average: A=2, B=1
    const j1 = makeJudge('J1', [['FDB', 'A', 2]]);
    const j2 = makeJudge('J2', [['FDB', 'B', 1]]);
    const out = averageScorecards([j1, j2]);
    const fdb = out.rows.find((r) => r.id === 'FDB')!;
    expect(fdb).toMatchObject({ aPoints: 2, bPoints: 1 });
    expect(out.totals).toEqual({ a: 2, b: 1 });
  });

  it('with 3 judges (A, B, A) on a category, averages cleanly', () => {
    // Category margin: J1 A x1 = (1,0); J2 B x2 = (0,2); J3 A x3 = (3,0)
    // Average: A=(1+0+3)/3 = 1.333..., B=(0+2+0)/3 = 0.666...
    const j1 = makeJudge('J1', [['conditioning', 'A', 1]]);
    const j2 = makeJudge('J2', [['conditioning', 'B', 2]]);
    const j3 = makeJudge('J3', [['conditioning', 'A', 3]]);
    const out = averageScorecards([j1, j2, j3]);
    const cond = out.rows.find((r) => r.id === 'conditioning')!;
    expect(cond.aPoints).toBeCloseTo(4 / 3, 6);
    expect(cond.bPoints).toBeCloseTo(2 / 3, 6);
  });

  it('display scores follow the same 0–100 mapping', () => {
    // Single judge mirroring Kai vs Samson; expect display 48.1/51.9.
    const j = makeJudge('J1', [
      ['FDB', 'A', 2],
      ['FLS', 'B', 2],
      ['SC', 'B', 2],
      ['RDB', 'A', 3],
      ['RLS', 'B', 2],
      ['ST', 'B', 3],
      ['AB+T', 'A', 3],
      ['MM', 'B', 2],
      ['muscularity', 'A', 1],
      ['conditioning', 'A', 3],
      ['shape', 'B', 2],
      ['flaws', 'A', 1],
    ]);
    const out = averageScorecards([j]);
    expect(out.totals).toEqual({ a: 21, b: 24 });
    expect(out.display).toEqual({ a: 48.1, b: 51.9 });
  });
});
```

- [ ] **Step 2: Run tests; expect failures because the function doesn't exist yet**

```bash
npm test
```

Expected: failures referencing `averageScorecards` is not exported.

- [ ] **Step 3: Add the function to `src/lib/scoring.ts`**

Append to `src/lib/scoring.ts`:

```ts
import type { Judge, RowType } from '@/types';

export type AveragedRow = {
  id: string;
  label: string;
  type: RowType;
  aPoints: number;
  bPoints: number;
};

export type AverageResult = {
  rows: AveragedRow[];
  totals: { a: number; b: number };
  display: { a: number; b: number };
  verdict: Verdict;
};

export function averageScorecards(judges: Judge[]): AverageResult {
  if (judges.length === 0) {
    throw new Error('averageScorecards requires at least one judge');
  }

  // Use the first judge's rows as the canonical row template (id/label/type are stable across judges).
  const template = judges[0].rows;

  const rows: AveragedRow[] = template.map((tpl) => {
    let aSum = 0;
    let bSum = 0;
    for (const j of judges) {
      const r = j.rows.find((x) => x.id === tpl.id);
      if (!r) continue;
      const p = rowPoints(r);
      aSum += p.a;
      bSum += p.b;
    }
    return {
      id: tpl.id,
      label: tpl.label,
      type: tpl.type,
      aPoints: aSum / judges.length,
      bPoints: bSum / judges.length,
    };
  });

  const totals = rows.reduce(
    (acc, r) => ({ a: acc.a + r.aPoints, b: acc.b + r.bPoints }),
    { a: 0, b: 0 },
  );

  // Reuse the display formula by constructing a synthetic Row[] that already encodes the totals
  // — but it's simpler to inline the same math here for clarity and avoid synthetic rows.
  const diff = totals.a - totals.b;
  const aDisplay = 50 + (diff / MAX_DIFFERENTIAL) * 50;
  const bDisplay = 100 - aDisplay;
  const display = { a: round1(aDisplay), b: round1(bDisplay) };

  const v: Verdict =
    display.a === display.b
      ? { kind: 'tie' }
      : display.a > display.b
        ? { kind: 'winner', side: 'A', margin: round1(display.a - display.b) }
        : { kind: 'winner', side: 'B', margin: round1(display.b - display.a) };

  return { rows, totals, display, verdict: v };
}
```

Note: `round1` is currently a private function inside `scoring.ts`. Since `averageScorecards` is in the same file, this works. Verify the existing `round1` declaration is above the new function or that hoisting handles it (it's a `function` declaration so it does).

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: all tests pass (was 14 from Task 2; +5 from this task = 19).

- [ ] **Step 5: Type-check**

```bash
npx tsc --noEmit
```

Expected: errors still in components (Task 7 fixes them). No new errors in `scoring.ts` or `store.ts`.

---

## Task 7: Wire components to read from the active judge

The components currently read `s.rows` directly. Update them to use the new `useActiveRows()` hook (and `useActiveJudge()` where the judge object is needed).

**Files:**
- Modify: `src/components/Scorecard.tsx`
- Modify: `src/components/ScoreTable.tsx`
- Modify: `src/components/FinalScore.tsx`
- Modify: `src/components/CellPicker.tsx`

- [ ] **Step 1: Update `Scorecard.tsx`**

Replace `src/components/Scorecard.tsx` with:

```tsx
'use client';

import { forwardRef } from 'react';
import { useActiveRows } from '@/lib/store';
import { ScoreTable } from './ScoreTable';
import { FinalScore } from './FinalScore';
import { TitleBlock } from './TitleBlock';

export const Scorecard = forwardRef<HTMLDivElement>(function Scorecard(_, ref) {
  const rows = useActiveRows();
  const poses = rows.filter((r) => r.type === 'pose');
  const categories = rows.filter((r) => r.type === 'category');

  return (
    <div ref={ref} className="grain grid grid-cols-1 gap-5 lg:grid-cols-[280px_minmax(0,1fr)_minmax(0,1fr)] lg:gap-6">
      <TitleBlock />

      <div className="lg:col-span-1">
        <ScoreTable title="Poses" rows={poses} />
      </div>

      <div className="flex flex-col gap-5 lg:col-span-1">
        <ScoreTable title="Categories" rows={categories} />
        <FinalScore />
      </div>
    </div>
  );
});
```

(Only change: import `useActiveRows` from store; replace `useScorecard((s) => s.rows)` with `useActiveRows()`. Everything else identical.)

- [ ] **Step 2: Update `FinalScore.tsx`**

In `src/components/FinalScore.tsx`, replace this line:

```tsx
const rows = useScorecard((s) => s.rows);
```

With:

```tsx
const rows = useActiveRows();
```

And update the import line:

```tsx
import { useScorecard } from '@/lib/store';
```

becomes:

```tsx
import { useScorecard, useActiveRows } from '@/lib/store';
```

- [ ] **Step 3: `ScoreTable.tsx` — no row source change needed**

`ScoreTable` already receives `rows` as a prop (passed in by `Scorecard`), so it doesn't need changes for the active-judge wiring. But add a `readOnly` prop for use by the Average view (Task 9):

In `src/components/ScoreTable.tsx`, change the `ScoreTable` signature:

```tsx
// Before:
export function ScoreTable({
  title,
  rows,
  showHeader = true,
}: {
  title: string;
  rows: Row[];
  showHeader?: boolean;
}) {
```

To:

```tsx
export function ScoreTable({
  title,
  rows,
  showHeader = true,
  readOnly = false,
}: {
  title: string;
  rows: Row[];
  showHeader?: boolean;
  readOnly?: boolean;
}) {
```

Then find the two `<CellPicker row={r} side="A" />` and `<CellPicker row={r} side="B" />` lines and pass `readOnly`:

```tsx
<CellPicker row={r} side="A" readOnly={readOnly} />
<CellPicker row={r} side="B" readOnly={readOnly} />
```

- [ ] **Step 4: Update `CellPicker.tsx` to accept `readOnly`**

In `src/components/CellPicker.tsx`, change the function signature:

```tsx
// Before:
export function CellPicker({ row, side }: { row: Row; side: Side }) {
```

To:

```tsx
export function CellPicker({
  row,
  side,
  readOnly = false,
}: {
  row: Row;
  side: Side;
  readOnly?: boolean;
}) {
```

Then in the `<button>` that opens the popover, change `onClick={() => setOpen((v) => !v)}` to:

```tsx
onClick={() => {
  if (readOnly) return;
  setOpen((v) => !v);
}}
```

And add `disabled={readOnly}` to that button so it visually feels inert:

```tsx
<button
  type="button"
  disabled={readOnly}
  onClick={() => {
    if (readOnly) return;
    setOpen((v) => !v);
  }}
  ...
```

- [ ] **Step 5: Type-check + tests**

```bash
npx tsc --noEmit
npm test
```

Expected: no TS errors, 19/19 tests pass.

- [ ] **Step 6: Manual smoke**

```bash
npm run build
```

Expected: clean build. (No need to run dev server again — UI-level multi-judge wiring lands in Task 10.)

- [ ] **Step 7: Commit (combines Tasks 4, 5, 6, 7)**

```bash
git add src/types/index.ts src/lib/store.ts src/lib/scoring.ts src/lib/scoring.test.ts src/components/Scorecard.tsx src/components/ScoreTable.tsx src/components/FinalScore.tsx src/components/CellPicker.tsx
git commit -m "feat(store): multi-judge data model + averageScorecards

- Add Judge type and restructure Match to hold judges[]
- Rewrite Zustand store with judge management + active selection
- Add averageScorecards pure function with tests
- Components read from active judge via useActiveRows hook
- ScoreTable + CellPicker accept readOnly prop for Average view"
```

---

## Task 8: Build `JudgeTabs` component

Tab strip with editable judge names, add/remove buttons, and an Average tab that's right-aligned.

**Files:**
- Create: `src/components/JudgeTabs.tsx`

- [ ] **Step 1: Create the file**

Write to `src/components/JudgeTabs.tsx`:

```tsx
'use client';

import { useState } from 'react';
import clsx from 'clsx';
import { Plus, X } from 'lucide-react';
import { useScorecard } from '@/lib/store';
import { AVERAGE_TAB_ID } from '@/types';

function JudgeTab({
  id,
  name,
  active,
  removable,
  onSelect,
  onRename,
  onRemove,
}: {
  id: string;
  name: string;
  active: boolean;
  removable: boolean;
  onSelect: () => void;
  onRename: (next: string) => void;
  onRemove: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);

  return (
    <div
      className={clsx(
        'group relative flex items-center gap-2 border-b-2 px-3 py-2 transition',
        active
          ? 'border-[var(--accent)] text-[var(--fg)]'
          : 'border-transparent text-[var(--fg-dim)] hover:text-[var(--fg)]',
      )}
    >
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            setEditing(false);
            const trimmed = draft.trim();
            if (trimmed && trimmed !== name) onRename(trimmed);
            else setDraft(name);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') {
              setDraft(name);
              setEditing(false);
            }
          }}
          className="bg-transparent font-display text-base uppercase tracking-[0.18em] text-[var(--fg)] outline-none"
          style={{ width: `${Math.max(draft.length, 4)}ch` }}
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            if (active) setEditing(true);
            else onSelect();
          }}
          className="font-display text-base uppercase tracking-[0.18em]"
          title={active ? 'Click to rename' : `Switch to ${name}`}
        >
          {name}
        </button>
      )}
      {removable && (
        <button
          type="button"
          onClick={onRemove}
          className="text-[var(--fg-mute)] opacity-60 transition hover:text-[var(--accent)] hover:opacity-100"
          aria-label={`Remove ${name}`}
          title="Remove judge"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

export function JudgeTabs() {
  const judges = useScorecard((s) => s.judges);
  const activeId = useScorecard((s) => s.activeJudgeId);
  const averageGeneratedAt = useScorecard((s) => s.averageGeneratedAt);
  const setActive = useScorecard((s) => s.setActiveJudge);
  const addJudge = useScorecard((s) => s.addJudge);
  const removeJudge = useScorecard((s) => s.removeJudge);
  const renameJudge = useScorecard((s) => s.renameJudge);

  const averageEnabled = judges.length >= 2;
  const averageStale = averageGeneratedAt !== null && averageEnabled;

  return (
    <div className="flex flex-wrap items-center gap-1 border-b border-[var(--rule)]">
      {judges.map((j) => (
        <JudgeTab
          key={j.id}
          id={j.id}
          name={j.name}
          active={activeId === j.id}
          removable={judges.length > 1}
          onSelect={() => setActive(j.id)}
          onRename={(n) => renameJudge(j.id, n)}
          onRemove={() => removeJudge(j.id)}
        />
      ))}

      <button
        type="button"
        onClick={addJudge}
        className="ml-1 flex items-center gap-1 px-3 py-2 text-[var(--fg-dim)] transition hover:text-[var(--accent)]"
        title="Add judge"
      >
        <Plus size={14} />
        <span className="font-display text-sm uppercase tracking-[0.2em]">Add Judge</span>
      </button>

      <div className="ml-auto flex items-center">
        <div className="mx-2 h-6 w-px bg-[var(--rule)]" />
        <button
          type="button"
          disabled={!averageEnabled}
          onClick={() => setActive(AVERAGE_TAB_ID)}
          className={clsx(
            'flex items-center gap-2 border-b-2 px-3 py-2 font-display text-base uppercase tracking-[0.2em] transition',
            activeId === AVERAGE_TAB_ID
              ? 'border-[var(--accent)] text-[var(--fg)]'
              : averageEnabled
                ? 'border-transparent text-[var(--fg-dim)] hover:text-[var(--fg)]'
                : 'border-transparent text-[var(--fg-mute)] opacity-50',
          )}
          title={averageEnabled ? 'View averaged scorecard' : 'Add a second judge to enable averaging'}
        >
          Average
          {averageStale && (
            <span className="rounded bg-[var(--accent)] px-1.5 py-0.5 text-[0.6rem] font-medium text-white">
              STALE
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: No commit yet — wait until Task 10 (Scorecard wiring) so the tab strip lands together with the active-tab routing**

---

## Task 9: Build `AverageScorecard` component

The Average tab's content: empty state with "Generate" button, then the averaged spreadsheet + final score + "Regenerate" button.

**Files:**
- Create: `src/components/AverageScorecard.tsx`

- [ ] **Step 1: Create the file**

Write to `src/components/AverageScorecard.tsx`:

```tsx
'use client';

import { useMemo } from 'react';
import { useScorecard } from '@/lib/store';
import { averageScorecards } from '@/lib/scoring';
import { ScoreTable } from './ScoreTable';
import { TitleBlock } from './TitleBlock';
import type { Row } from '@/types';

function fmt(n: number): string {
  return n.toFixed(1);
}

// Convert AveragedRow back to Row shape so ScoreTable can render it (read-only).
// We synthesize a winner/margin pair purely for display: the bigger side gets
// shown but the picker is disabled so values aren't clickable.
function projectAveragedToRows(
  avg: ReturnType<typeof averageScorecards>['rows'],
): Row[] {
  // Average view replaces per-row pickers with raw averaged points,
  // so we don't need real Row objects — we render a custom table below
  // instead of going through ScoreTable for the averaged view.
  return [];
}

export function AverageScorecard() {
  const judges = useScorecard((s) => s.judges);
  const generatedAt = useScorecard((s) => s.averageGeneratedAt);
  const markGenerated = useScorecard((s) => s.markAverageGenerated);
  const athleteA = useScorecard((s) => s.athleteA.name);
  const athleteB = useScorecard((s) => s.athleteB.name);

  const result = useMemo(
    () => (generatedAt !== null ? averageScorecards(judges) : null),
    // We intentionally re-compute only when `generatedAt` changes.
    // (If a judge edits, the store invalidates `generatedAt` to null.)
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [generatedAt],
  );

  if (result === null) {
    return (
      <div className="grain grid grid-cols-1 gap-5 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-6">
        <TitleBlock />
        <div className="flex flex-col items-center justify-center gap-4 border border-[var(--rule)] bg-[var(--bg-elev)] p-12 text-center">
          <span className="eyebrow text-[var(--fg-dim)]">Average not yet computed</span>
          <button
            type="button"
            onClick={markGenerated}
            className="rounded-md border border-[var(--accent)] bg-[var(--accent)] px-5 py-3 font-display text-lg uppercase tracking-[0.2em] text-white transition hover:brightness-110"
          >
            Generate Average
          </button>
          <p className="max-w-sm text-xs uppercase tracking-[0.2em] text-[var(--fg-mute)]">
            Aggregates all judges&apos; scorecards into a single averaged
            spreadsheet.
          </p>
        </div>
      </div>
    );
  }

  const poses = result.rows.filter((r) => r.type === 'pose');
  const categories = result.rows.filter((r) => r.type === 'category');

  return (
    <div className="grain grid grid-cols-1 gap-5 lg:grid-cols-[280px_minmax(0,1fr)_minmax(0,1fr)] lg:gap-6">
      <TitleBlock />

      <div className="lg:col-span-2 flex items-center justify-between">
        <span className="text-[0.7rem] uppercase tracking-[0.3em] text-[var(--fg-dim)]">
          Generated{' '}
          <span className="text-[var(--fg)]">
            {new Date(generatedAt!).toLocaleTimeString()}
          </span>
          {' · '}
          {judges.length} judge{judges.length === 1 ? '' : 's'}
        </span>
        <button
          type="button"
          onClick={markGenerated}
          className="rounded-md border border-white/15 bg-white/5 px-3 py-2 text-sm text-[var(--fg)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          Regenerate
        </button>
      </div>

      <AveragedTable title="Poses" rows={poses} athleteA={athleteA} athleteB={athleteB} />

      <div className="flex flex-col gap-5">
        <AveragedTable title="Categories" rows={categories} athleteA={athleteA} athleteB={athleteB} />

        {/* Averaged final score panel */}
        <div className="border border-[var(--rule)] bg-black p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between border-b border-white/15 pb-2">
            <span className="eyebrow text-[var(--fg-dim)]">Averaged Final Score</span>
            <span className="text-[0.65rem] uppercase tracking-[0.3em] text-[var(--fg-mute)]">
              Across {judges.length} judge{judges.length === 1 ? '' : 's'}
            </span>
          </div>
          <div className="flex flex-col gap-3">
            <FinalRow name={athleteA} value={fmt(result.display.a)} highlight={result.verdict.kind === 'winner' && result.verdict.side === 'A'} color="var(--side-a)" />
            <div className="border-t border-white/10" />
            <FinalRow name={athleteB} value={fmt(result.display.b)} highlight={result.verdict.kind === 'winner' && result.verdict.side === 'B'} color="var(--side-b)" />
          </div>
          <div className="mt-6 border-t border-white/15 pt-4 text-center">
            {result.verdict.kind === 'tie' ? (
              <span className="font-display text-3xl uppercase tracking-[0.4em] text-[var(--accent)]">
                Dead Heat
              </span>
            ) : (
              <span className="font-display text-2xl uppercase tracking-[0.2em] text-[var(--fg)] sm:text-3xl">
                <span style={{ color: result.verdict.side === 'A' ? 'var(--side-a)' : 'var(--side-b)' }}>
                  {result.verdict.side === 'A' ? athleteA : athleteB}
                </span>{' '}
                <span className="text-[var(--fg-dim)]">wins by</span>{' '}
                <span className="text-[var(--accent)] tabular">{fmt(result.verdict.margin)}</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function AveragedTable({
  title,
  rows,
  athleteA,
  athleteB,
}: {
  title: string;
  rows: Array<{ id: string; label: string; aPoints: number; bPoints: number }>;
  athleteA: string;
  athleteB: string;
}) {
  const totalA = rows.reduce((s, r) => s + r.aPoints, 0);
  const totalB = rows.reduce((s, r) => s + r.bPoints, 0);

  return (
    <div className="flex flex-col">
      <div className="mb-2 flex items-baseline justify-between">
        <h2 className="font-display text-2xl uppercase tracking-[0.3em] text-[var(--fg)] sm:text-3xl">
          {title}
        </h2>
        <span className="text-[0.65rem] uppercase tracking-[0.3em] text-[var(--fg-mute)]">
          {rows.length} rows · averaged
        </span>
      </div>

      <div className="overflow-hidden border border-[var(--rule)]">
        <table className="w-full border-collapse">
          <colgroup>
            <col className="w-[30%]" />
            <col className="w-[35%]" />
            <col className="w-[35%]" />
          </colgroup>
          <thead>
            <tr className="bg-[var(--strip-bg)] text-[var(--strip-fg)]">
              <th className="border-r border-black/30 px-3 py-2 text-left">
                <span className="font-display text-sm uppercase tracking-[0.25em] opacity-60">Row</span>
              </th>
              <th className="border-r border-black/30 px-2 py-1.5 text-center font-display text-xl uppercase tracking-[0.15em]">
                {athleteA}
              </th>
              <th className="px-2 py-1.5 text-center font-display text-xl uppercase tracking-[0.15em]">
                {athleteB}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-[var(--rule)]">
                <th scope="row" className="border-r border-[var(--rule)] px-3 py-3 text-left align-middle">
                  <div className="flex flex-col">
                    <span className="font-display text-xl uppercase tracking-wider text-[var(--fg)]">{r.id}</span>
                    <span className="text-[0.65rem] uppercase tracking-widest text-[var(--fg-dim)]">{r.label}</span>
                  </div>
                </th>
                <td className="border-r border-[var(--rule)] px-3 py-3 text-center font-display tabular text-3xl text-[var(--side-a)]">
                  {r.aPoints === 0 ? '' : fmt(r.aPoints)}
                </td>
                <td className="px-3 py-3 text-center font-display tabular text-3xl text-[var(--side-b)]">
                  {r.bPoints === 0 ? '' : fmt(r.bPoints)}
                </td>
              </tr>
            ))}
            <tr className="border-t border-[var(--rule-strong)] bg-[var(--strip-bg)] text-[var(--strip-fg)]">
              <th scope="row" className="border-r border-black/30 px-3 py-2 text-left font-display text-lg uppercase tracking-[0.3em]">
                Total
              </th>
              <td className="border-r border-black/30 px-3 py-2 text-center font-display text-3xl tabular sm:text-4xl">
                {fmt(totalA)}
              </td>
              <td className="px-3 py-2 text-center font-display text-3xl tabular sm:text-4xl">
                {fmt(totalB)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FinalRow({
  name,
  value,
  highlight,
  color,
}: {
  name: string;
  value: string;
  highlight: boolean;
  color: string;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-baseline gap-4">
      <span
        className="font-display truncate text-2xl uppercase tracking-[0.2em] sm:text-3xl"
        style={{ color: highlight ? color : 'var(--fg)' }}
      >
        {name}
      </span>
      <span
        className="font-display tabular text-6xl leading-none sm:text-7xl"
        style={{ color: highlight ? color : 'var(--fg)' }}
      >
        {value}
      </span>
    </div>
  );
}
```

(The `projectAveragedToRows` function is a stub left in place to document why we don't reuse `ScoreTable` for the averaged view — the averaged view shows raw points per side, not winner+margin, so a bespoke `AveragedTable` is clearer than synthesizing fake `Row` objects.)

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: No commit yet — wait for Task 10**

---

## Task 10: Wire `JudgeTabs` and Average view into `Scorecard`

Make `Scorecard` switch between the active judge's card and the `AverageScorecard` based on `activeJudgeId`.

**Files:**
- Modify: `src/components/Scorecard.tsx`

- [ ] **Step 1: Replace `Scorecard.tsx` with the wired version**

Write to `src/components/Scorecard.tsx`:

```tsx
'use client';

import { forwardRef } from 'react';
import { useActiveRows, useScorecard } from '@/lib/store';
import { AVERAGE_TAB_ID } from '@/types';
import { ScoreTable } from './ScoreTable';
import { FinalScore } from './FinalScore';
import { TitleBlock } from './TitleBlock';
import { JudgeTabs } from './JudgeTabs';
import { AverageScorecard } from './AverageScorecard';

export const Scorecard = forwardRef<HTMLDivElement>(function Scorecard(_, ref) {
  const activeId = useScorecard((s) => s.activeJudgeId);
  const onAverageTab = activeId === AVERAGE_TAB_ID;

  return (
    <div ref={ref} className="flex flex-col gap-4">
      <JudgeTabs />
      {onAverageTab ? <AverageScorecard /> : <JudgeView />}
    </div>
  );
});

function JudgeView() {
  const rows = useActiveRows();
  const poses = rows.filter((r) => r.type === 'pose');
  const categories = rows.filter((r) => r.type === 'category');

  return (
    <div className="grain grid grid-cols-1 gap-5 lg:grid-cols-[280px_minmax(0,1fr)_minmax(0,1fr)] lg:gap-6">
      <TitleBlock />

      <div className="lg:col-span-1">
        <ScoreTable title="Poses" rows={poses} />
      </div>

      <div className="flex flex-col gap-5 lg:col-span-1">
        <ScoreTable title="Categories" rows={categories} />
        <FinalScore />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Hide `Reset` on the Average tab in `page.tsx`**

In `src/app/page.tsx`, replace the entire file with:

```tsx
'use client';

import { useRef } from 'react';
import { Scorecard } from '@/components/Scorecard';
import { ExportButton } from '@/components/ExportButton';
import { ResetButton } from '@/components/ResetButton';
import { useScorecard } from '@/lib/store';
import { AVERAGE_TAB_ID } from '@/types';

export default function Page() {
  const cardRef = useRef<HTMLDivElement>(null);
  const onAverageTab = useScorecard((s) => s.activeJudgeId === AVERAGE_TAB_ID);

  return (
    <main className="flex min-h-dvh flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8 lg:px-12">
      <header className="flex items-center justify-between gap-3">
        <span className="text-[0.7rem] uppercase tracking-[0.35em] text-[var(--fg-dim)]">
          Chow&apos;s Scorecard · Live
        </span>
        <div className="flex items-center gap-2">
          {!onAverageTab && <ResetButton />}
          <ExportButton targetRef={cardRef} />
        </div>
      </header>

      <Scorecard ref={cardRef} />
    </main>
  );
}
```

- [ ] **Step 3: Type-check + tests + build**

```bash
npx tsc --noEmit
npm test
npm run build
```

Expected: all green; 19/19 tests; clean build.

- [ ] **Step 4: Manual smoke**

If dev server isn't running:

```bash
npm run dev
```

In `http://localhost:3000`, verify:
1. The judge tab strip shows "Judge 1" with an underline accent and "Add Judge" + "Average" tabs.
2. Click "Add Judge" → "Judge 2" tab appears next to "Judge 1".
3. Click "Judge 1" tab name (when already active) → it becomes editable; type "Chow", press Enter; tab now reads "CHOW".
4. Click "Judge 2" → switches to that card with empty rows. Score a few rows.
5. Click "Judge 1" / "Chow" → returns to that card with their scores intact.
6. Click "Average" tab → empty state with "Generate Average" button.
7. Click Generate → averaged spreadsheet appears with averaged points per row and final score.
8. Switch back to "Chow", change a row → notice "STALE" badge appears on Average tab.
9. Click Average → result still shows but Regenerate button is highlighted.
10. Click Regenerate → STALE clears, fresh averaged values shown.
11. Click × on "Judge 2" → it disappears; Average tab disables (only 1 judge left).
12. Header "Reset" button hides when on Average tab.

- [ ] **Step 5: Commit (combines Tasks 8, 9, 10)**

```bash
git add src/components/JudgeTabs.tsx src/components/AverageScorecard.tsx src/components/Scorecard.tsx src/app/page.tsx
git commit -m "feat(ui): judge tabs + averaged scorecard view

- JudgeTabs: editable judge names, add/remove, Average tab with STALE badge
- AverageScorecard: empty state with Generate, then averaged table + final score + Regenerate
- Scorecard wires routing between active judge view and Average view
- page.tsx hides Reset on Average tab"
```

---

## Task 11: Final verification pass

- [ ] **Step 1: Run the full check suite**

```bash
npm test
npm run build
```

Expected: 19/19 tests pass; production build clean (no TS errors, no ESLint errors).

- [ ] **Step 2: End-to-end smoke against the acceptance checklist from the spec**

Open dev server (`npm run dev`), then walk through every item in the spec's acceptance checklist (`docs/superpowers/specs/2026-05-14-scoring-accuracy-design.md`, "Acceptance checklist" section). For each unchecked item, verify in the browser and tick it off.

- [ ] **Step 3: Tag the completion**

```bash
git tag -a v0.2.0 -m "Half-step margins + multi-judge averaging"
```

(No remote push — keep it local until the user wants to deploy.)

---

## Self-review notes

- **Spec coverage:** Tasks 1–2 cover half-step margins (spec §Math, §UI/Picker). Tasks 4–7 cover the data model + averaging math (spec §Data model, §Math/Multi-judge averaging). Tasks 8–10 cover tabs UI + Average view (spec §UI/Tabs, §UI/Active card content). Task 7 step 4 covers `readOnly` cell behavior (spec §UI/Picker last paragraph). Task 10 step 2 covers Reset semantics on Average tab (spec §UI/Reset semantics).
- **Acceptance items:** Margin type widening (Task 1) ✓; reference fixture preserved (verified in Task 2) ✓; half-step tests (Task 2) ✓; add/remove/rename judges (Task 8) ✓; Average tab disabled below 2 judges (Task 8) ✓; averaged per-row points + final score (Task 9) ✓; STALE indicator (Task 5 store invalidation + Task 8 badge rendering) ✓; reset only active judge (Task 5) ✓; build + tests green (Task 11) ✓.
- **Type consistency:** `Margin` type is used identically in scoring tests (Task 2) and store/picker (Task 5/Task 3). `Judge` type defined in Task 4 and consumed in Task 5 (store), Task 6 (averageScorecards), Task 8 (JudgeTabs), Task 9 (AverageScorecard). `AVERAGE_TAB_ID` defined in Task 4 and used in Task 5 (store guards), Task 8 (tab click), Task 10 (routing + Reset hide).
- **Open question on PNG export:** spec §Open questions notes that `ExportButton` captures whatever is on screen; this requires no plan-level work because the existing component already grabs the `cardRef`, which now points at the wrapping div containing tabs + active card. Average tab exports the averaged spreadsheet; judge tab exports that judge's card. Acceptable for v1.

---

Plan complete and saved to `docs/superpowers/plans/2026-05-14-scoring-accuracy.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
