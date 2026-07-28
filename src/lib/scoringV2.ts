/**
 * Experimental scoring engine (V2) — the signed-margin algorithm.
 *
 * Lives alongside `scoring.ts`, which still runs the live show. Nothing here is
 * imported by /desk or /host; only the /lab testbed touches it.
 *
 * What differs from V1:
 *   1. One signed differential per row instead of winner + margin, with a real
 *      zero. A judge can finally say "these two are even" — on poses too.
 *   2. MAX_DIFFERENTIAL is the sum of the weights, not four times it. Win every
 *      row by the minimum margin and you score 100.
 *   3. The panel takes a trimmed mean (drop high and low) pooled in points
 *      space, not a plain mean of already-clipped displays.
 *   4. The panel prints its own uncertainty and refuses verdicts the spread
 *      cannot support.
 */

import type { Row, RowType } from '@/types';
import { CATEGORIES, CATEGORY_WEIGHT, POSE_WEIGHT, POSES } from './constants';

/** A single signed call. Positive favours Athlete A, negative Athlete B. */
export type SignedMargin = -4 | -3 | -2 | -1 | 0 | 1 | 2 | 3 | 4;

/** Every value a judge can pick, low to high — the ruler, in order. */
export const SIGNED_MARGINS: SignedMargin[] = [-4, -3, -2, -1, 0, 1, 2, 3, 4];

export type RowV2 = {
  id: string;
  label: string;
  type: RowType;
  /** null = not judged yet. 0 = judged, and they are even. */
  margin: SignedMargin | null;
};

/**
 * Σ weights = 8 poses x2 + 4 categories x1. Sweeping every row at the minimum
 * margin lands exactly here, which is what makes the 0-100 scale explainable
 * in one sentence. Recalibrate to 2.5σ of real differentials once 30+ cards
 * have been recorded.
 */
export const MAX_DIFFERENTIAL_V2 = 20;

/** Two-sided 95% normal critical value, used for the too-close-to-call gate. */
export const CONFIDENCE_Z = 1.96;

export function buildInitialRowsV2(): RowV2[] {
  return [
    ...POSES.map((p) => ({
      id: p.id,
      label: p.label,
      type: 'pose' as const,
      margin: null,
    })),
    ...CATEGORIES.map((c) => ({
      id: c.id,
      label: c.label,
      type: 'category' as const,
      margin: null,
    })),
  ];
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export function rowWeight(type: RowType): number {
  return type === 'pose' ? POSE_WEIGHT : CATEGORY_WEIGHT;
}

// ─────────────────────────────────────────────────────────────────────────────
// One card
// ─────────────────────────────────────────────────────────────────────────────

export function rowPointsV2(row: RowV2): { a: number; b: number } {
  const d = (row.margin ?? 0) * rowWeight(row.type);
  return d >= 0 ? { a: d, b: 0 } : { a: 0, b: -d };
}

export function totalPointsV2(rows: RowV2[]): { a: number; b: number } {
  return rows.reduce(
    (acc, row) => {
      const p = rowPointsV2(row);
      return { a: acc.a + p.a, b: acc.b + p.b };
    },
    { a: 0, b: 0 },
  );
}

/** The card's signed differential in points — the currency of this system. */
export function differentialV2(rows: RowV2[]): number {
  return rows.reduce((acc, row) => acc + (row.margin ?? 0) * rowWeight(row.type), 0);
}

export function splitTotalsV2(rows: RowV2[]): {
  poses: { a: number; b: number };
  categories: { a: number; b: number };
} {
  return {
    poses: totalPointsV2(rows.filter((r) => r.type === 'pose')),
    categories: totalPointsV2(rows.filter((r) => r.type === 'category')),
  };
}

/**
 * A card counts as scored once any row has been judged. A card of deliberate
 * zeros is scored; an untouched card is not.
 */
export function isScoredV2(rows: RowV2[]): boolean {
  return rows.some((r) => r.margin !== null);
}

/** Convert a raw signed differential to the 0-100 display, clamped at the ends. */
export function diffToDisplay(diff: number): { a: number; b: number } {
  const aDisplay = 50 + 50 * clamp(diff / MAX_DIFFERENTIAL_V2, -1, 1);
  return { a: round1(aDisplay), b: round1(100 - aDisplay) };
}

export function displayScoresV2(rows: RowV2[]): { a: number; b: number } {
  return diffToDisplay(differentialV2(rows));
}

export type VerdictV2 =
  | { kind: 'tie' }
  | { kind: 'tooClose' }
  | { kind: 'winner'; side: 'A' | 'B'; margin: number };

export function verdictV2(rows: RowV2[]): VerdictV2 {
  const { a, b } = displayScoresV2(rows);
  if (a === b) return { kind: 'tie' };
  return a > b
    ? { kind: 'winner', side: 'A', margin: round1(a - b) }
    : { kind: 'winner', side: 'B', margin: round1(b - a) };
}

/** What share of the 0-100 scale this card actually used, in display points. */
export function rangeUsed(display: { a: number; b: number }): number {
  return round1(Math.abs(display.a - display.b));
}

// ─────────────────────────────────────────────────────────────────────────────
// V1 <-> V2 converters
//
// Used by the lab's compare panel and by "import my card". The V2 -> V1
// direction is deliberately lossy in one spot: V1 has no way to record two
// poses as equal, so an even pose becomes an unjudged row. That single line is
// the whole argument for the signed margin, made mechanical.
// ─────────────────────────────────────────────────────────────────────────────

export function v1RowToV2(row: Row): RowV2 {
  const base = { id: row.id, label: row.label, type: row.type };
  if (row.winner === null) return { ...base, margin: null };
  // A tie, or a side picked without a margin, both score nothing in V1.
  if (row.winner === 'tie' || !row.margin) return { ...base, margin: 0 };
  const signed = (row.winner === 'A' ? row.margin : -row.margin) as SignedMargin;
  return { ...base, margin: signed };
}

export function v2RowToV1(row: RowV2): Row {
  const base = { id: row.id, label: row.label, type: row.type };
  if (row.margin === null) return { ...base, winner: null, margin: null };
  if (row.margin === 0) {
    return row.type === 'category'
      ? { ...base, winner: 'tie', margin: null }
      : { ...base, winner: null, margin: null };
  }
  const magnitude = Math.abs(row.margin) as 1 | 2 | 3 | 4;
  return { ...base, winner: row.margin > 0 ? 'A' : 'B', margin: magnitude };
}

// ─────────────────────────────────────────────────────────────────────────────
// Panel consensus — trimmed mean, pooled in points space, with its own error bar
// ─────────────────────────────────────────────────────────────────────────────

/** One desk's contribution to the panel: its raw signed differential. */
export type DeskDiff = {
  slug: string;
  diff: number;
  /** Defaults to true. Unscored desks are dropped before any maths. */
  scored?: boolean;
};

export type ConsensusV2 = {
  perDesk: DeskDiff[];
  scoredCount: number;
  /** Mean of the trimmed core, in points. The number the panel stands behind. */
  meanDiff: number;
  /** Mean of every scored desk, untrimmed — shown for contrast. */
  simpleMeanDiff: number;
  /** Slugs dropped by the trim, low end first. Empty below five desks. */
  trimmed: string[];
  /** Sample standard deviation over ALL scored desks, not just the core. */
  sd: number;
  /** Standard error of the mean: sd / sqrt(N). */
  sem: number;
  /** True when the lead does not clear 1.96 SEM. */
  tooClose: boolean;
  consensusA: number;
  consensusB: number;
  verdict: VerdictV2;
};

/** Trimming two of four desks is vandalism; the gymnastics rule needs a panel. */
const MIN_DESKS_TO_TRIM = 5;

function sampleSd(values: number[]): number {
  if (values.length < 2) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  const variance =
    values.reduce((s, v) => s + (v - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export function consensusV2(desks: DeskDiff[]): ConsensusV2 {
  const scored = desks.filter((d) => d.scored !== false);
  const scoredCount = scored.length;

  if (scoredCount === 0) {
    return {
      perDesk: desks,
      scoredCount: 0,
      meanDiff: 0,
      simpleMeanDiff: 0,
      trimmed: [],
      sd: 0,
      sem: 0,
      tooClose: false,
      consensusA: 50,
      consensusB: 50,
      verdict: { kind: 'tie' },
    };
  }

  const sorted = [...scored].sort((x, y) => x.diff - y.diff);
  const shouldTrim = scoredCount >= MIN_DESKS_TO_TRIM;
  const core = shouldTrim ? sorted.slice(1, -1) : sorted;
  const trimmed = shouldTrim
    ? [sorted[0]!.slug, sorted[sorted.length - 1]!.slug]
    : [];

  const meanDiff = core.reduce((s, d) => s + d.diff, 0) / core.length;
  const simpleMeanDiff = scored.reduce((s, d) => s + d.diff, 0) / scoredCount;

  const sd = sampleSd(scored.map((d) => d.diff));
  const sem = sd / Math.sqrt(scoredCount);
  const tooClose = Math.abs(meanDiff) < CONFIDENCE_Z * sem;

  const display = diffToDisplay(meanDiff);

  const verdict: VerdictV2 = tooClose
    ? { kind: 'tooClose' }
    : display.a === display.b
      ? { kind: 'tie' }
      : display.a > display.b
        ? { kind: 'winner', side: 'A', margin: round1(display.a - display.b) }
        : { kind: 'winner', side: 'B', margin: round1(display.b - display.a) };

  return {
    perDesk: desks,
    scoredCount,
    meanDiff,
    simpleMeanDiff,
    trimmed,
    sd,
    sem,
    tooClose,
    consensusA: display.a,
    consensusB: display.b,
    verdict,
  };
}

/** Turn a set of V2 cards into the desk differentials the panel maths wants. */
export function cardsToDesks(
  cards: Array<{ slug: string; rows: RowV2[] }>,
): DeskDiff[] {
  return cards.map((c) => ({
    slug: c.slug,
    diff: differentialV2(c.rows),
    scored: isScoredV2(c.rows),
  }));
}
