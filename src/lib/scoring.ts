import type { Row } from '@/types';
import { CATEGORY_WEIGHT, MAX_DIFFERENTIAL, POSE_WEIGHT } from './constants';

export function rowPoints(row: Row): { a: number; b: number } {
  if (!row.winner) return { a: 0, b: 0 };
  // Category ties award 1 point to each athlete. Poses cannot tie.
  if (row.winner === 'tie') {
    return row.type === 'category' ? { a: 1, b: 1 } : { a: 0, b: 0 };
  }
  if (!row.margin) return { a: 0, b: 0 };
  const weight = row.type === 'pose' ? POSE_WEIGHT : CATEGORY_WEIGHT;
  const points = row.margin * weight;
  return row.winner === 'A' ? { a: points, b: 0 } : { a: 0, b: points };
}

export function totalPoints(rows: Row[]): { a: number; b: number } {
  return rows.reduce(
    (acc, row) => {
      const p = rowPoints(row);
      return { a: acc.a + p.a, b: acc.b + p.b };
    },
    { a: 0, b: 0 },
  );
}

export function splitTotals(rows: Row[]): {
  poses: { a: number; b: number };
  categories: { a: number; b: number };
} {
  const poses = totalPoints(rows.filter((r) => r.type === 'pose'));
  const categories = totalPoints(rows.filter((r) => r.type === 'category'));
  return { poses, categories };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export function displayScores(rows: Row[]): { a: number; b: number } {
  const { a, b } = totalPoints(rows);
  const diff = a - b;
  const aDisplay = 50 + (diff / MAX_DIFFERENTIAL) * 50;
  const bDisplay = 100 - aDisplay;
  return { a: round1(aDisplay), b: round1(bDisplay) };
}

export type Verdict =
  | { kind: 'tie' }
  | { kind: 'winner'; side: 'A' | 'B'; margin: number };

export function verdict(rows: Row[]): Verdict {
  const { a, b } = displayScores(rows);
  if (a === b) return { kind: 'tie' };
  return a > b
    ? { kind: 'winner', side: 'A', margin: round1(a - b) }
    : { kind: 'winner', side: 'B', margin: round1(b - a) };
}
