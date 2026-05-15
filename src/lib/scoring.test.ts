import { describe, it, expect } from 'vitest';
import type { Row } from '@/types';
import { buildInitialRows } from './constants';
import { displayScores, rowPoints, totalPoints, verdict } from './scoring';

function applyKaiVsSamson(): Row[] {
  const rows = buildInitialRows();
  const set = (id: string, winner: 'A' | 'B', margin: 1 | 2 | 3 | 4) => {
    const r = rows.find((x) => x.id === id);
    if (!r) throw new Error(`row ${id} not found`);
    r.winner = winner;
    r.margin = margin;
  };
  // Poses (A = Kai, B = Samson)
  set('FDB', 'A', 2);
  set('FLS', 'B', 2);
  set('SC', 'B', 2);
  set('RDB', 'A', 3);
  set('RLS', 'B', 2);
  set('ST', 'B', 3);
  set('AB+T', 'A', 3);
  set('MM', 'B', 2);
  // Categories
  set('muscularity', 'A', 1);
  set('conditioning', 'A', 3);
  set('shape', 'B', 2);
  set('flaws', 'A', 1);
  return rows;
}

describe('rowPoints', () => {
  it('returns zero when winner or margin is missing', () => {
    expect(
      rowPoints({ id: 'x', label: 'x', type: 'pose', winner: null, margin: 3 }),
    ).toEqual({ a: 0, b: 0 });
    expect(
      rowPoints({ id: 'x', label: 'x', type: 'pose', winner: 'A', margin: null }),
    ).toEqual({ a: 0, b: 0 });
  });

  it('weights poses x2, categories x1', () => {
    expect(
      rowPoints({ id: 'x', label: 'x', type: 'pose', winner: 'A', margin: 3 }),
    ).toEqual({ a: 6, b: 0 });
    expect(
      rowPoints({ id: 'x', label: 'x', type: 'category', winner: 'B', margin: 4 }),
    ).toEqual({ a: 0, b: 4 });
  });
});

describe('totalPoints — Kai vs Samson fixture', () => {
  it('Kai = 21, Samson = 24', () => {
    const rows = applyKaiVsSamson();
    expect(totalPoints(rows)).toEqual({ a: 21, b: 24 });
  });
});

describe('displayScores — Kai vs Samson fixture', () => {
  it('A = 48.1, B = 51.9', () => {
    const rows = applyKaiVsSamson();
    expect(displayScores(rows)).toEqual({ a: 48.1, b: 51.9 });
  });

  it('empty card = 50/50', () => {
    expect(displayScores(buildInitialRows())).toEqual({ a: 50, b: 50 });
  });

  it('perfect sweep for A = 100/0', () => {
    const rows = buildInitialRows();
    rows.forEach((r) => {
      r.winner = 'A';
      r.margin = 4;
    });
    expect(displayScores(rows)).toEqual({ a: 100, b: 0 });
  });
});

describe('verdict', () => {
  it('Samson wins by 3.8 in the fixture', () => {
    expect(verdict(applyKaiVsSamson())).toEqual({
      kind: 'winner',
      side: 'B',
      margin: 3.8,
    });
  });

  it('declares tie at 50/50', () => {
    expect(verdict(buildInitialRows())).toEqual({ kind: 'tie' });
  });
});

describe('category ties', () => {
  it('awards 1 point to each athlete on a tied category row', () => {
    const rows = buildInitialRows();
    const muscularity = rows.find((r) => r.id === 'muscularity')!;
    muscularity.winner = 'tie';
    expect(rowPoints(muscularity)).toEqual({ a: 1, b: 1 });
  });

  it('does NOT award points if a pose row is somehow set to tie', () => {
    const rows = buildInitialRows();
    const fdb = rows.find((r) => r.id === 'FDB')!;
    fdb.winner = 'tie';
    expect(rowPoints(fdb)).toEqual({ a: 0, b: 0 });
  });

  it('keeps differential at 0 for an all-tied scorecard, totals = 4 each', () => {
    const rows = buildInitialRows();
    rows.forEach((r) => {
      if (r.type === 'category') r.winner = 'tie';
    });
    expect(totalPoints(rows)).toEqual({ a: 4, b: 4 });
    expect(displayScores(rows)).toEqual({ a: 50, b: 50 });
  });
});
