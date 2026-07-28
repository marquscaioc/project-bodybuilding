import { describe, it, expect } from 'vitest';
import type { Row } from '@/types';
import { buildInitialRows } from './constants';
import { displayScores, totalPoints } from './scoring';
import {
  buildInitialRowsV2,
  consensusV2,
  differentialV2,
  displayScoresV2,
  isScoredV2,
  rowPointsV2,
  totalPointsV2,
  v1RowToV2,
  v2RowToV1,
  verdictV2,
  type RowV2,
  type SignedMargin,
} from './scoringV2';

/** Every row swept to the same signed margin. */
function sweep(margin: SignedMargin): RowV2[] {
  return buildInitialRowsV2().map((r) => ({ ...r, margin }));
}

function setMargins(pairs: Record<string, SignedMargin>): RowV2[] {
  return buildInitialRowsV2().map((r) =>
    r.id in pairs ? { ...r, margin: pairs[r.id] } : r,
  );
}

/** The Kai vs Samson fixture from scoring.test.ts, as signed margins. */
function kaiVsSamson(): RowV2[] {
  return setMargins({
    FDB: 2,
    FLS: -2,
    SC: -2,
    RDB: 3,
    RLS: -2,
    ST: -3,
    'AB+T': 3,
    MM: -2,
    muscularity: 1,
    conditioning: 3,
    shape: -2,
    flaws: 1,
  });
}

/** Panel helper: N desks, each identified by slug, each with a raw differential. */
function desks(diffs: number[]): Array<{ slug: string; diff: number }> {
  return diffs.map((diff, i) => ({ slug: `desk${i}`, diff }));
}

describe('rowPointsV2', () => {
  it('sends a positive margin to A and a negative one to B', () => {
    expect(rowPointsV2({ id: 'x', label: 'x', type: 'pose', margin: 3 })).toEqual({
      a: 6,
      b: 0,
    });
    expect(rowPointsV2({ id: 'x', label: 'x', type: 'pose', margin: -3 })).toEqual({
      a: 0,
      b: 6,
    });
  });

  it('weights poses x2 and categories x1', () => {
    expect(rowPointsV2({ id: 'x', label: 'x', type: 'category', margin: 4 })).toEqual({
      a: 4,
      b: 0,
    });
    expect(rowPointsV2({ id: 'x', label: 'x', type: 'category', margin: -4 })).toEqual({
      a: 0,
      b: 4,
    });
  });

  it('scores a deliberate zero as nothing for either side — on poses too', () => {
    expect(rowPointsV2({ id: 'x', label: 'x', type: 'pose', margin: 0 })).toEqual({
      a: 0,
      b: 0,
    });
    expect(rowPointsV2({ id: 'x', label: 'x', type: 'category', margin: 0 })).toEqual({
      a: 0,
      b: 0,
    });
  });

  it('scores an unjudged row as nothing', () => {
    expect(rowPointsV2({ id: 'x', label: 'x', type: 'pose', margin: null })).toEqual({
      a: 0,
      b: 0,
    });
  });
});

describe('isScoredV2', () => {
  it('separates "not judged yet" from "judged as even"', () => {
    expect(isScoredV2(buildInitialRowsV2())).toBe(false);
    expect(isScoredV2(sweep(0))).toBe(true);
  });
});

describe('differentialV2', () => {
  it('is the signed A-minus-B differential in points', () => {
    expect(differentialV2(sweep(1))).toBe(20);
    expect(differentialV2(sweep(-1))).toBe(-20);
    expect(differentialV2(sweep(4))).toBe(80);
    expect(differentialV2(sweep(0))).toBe(0);
  });

  it('equals the sum of the weights when every row is won by the minimum', () => {
    // 8 poses x2 + 4 categories x1 = MAX_DIFFERENTIAL_V2
    expect(differentialV2(sweep(1))).toBe(20);
  });
});

describe('displayScoresV2', () => {
  it('gives exactly 100/0 for a minimum-margin sweep — the promise to the viewer', () => {
    expect(displayScoresV2(sweep(1))).toEqual({ a: 100, b: 0 });
    expect(displayScoresV2(sweep(-1))).toEqual({ a: 0, b: 100 });
  });

  it('clamps rather than overflowing past the ends', () => {
    expect(displayScoresV2(sweep(4))).toEqual({ a: 100, b: 0 });
    expect(displayScoresV2(sweep(-4))).toEqual({ a: 0, b: 100 });
  });

  it('reads 50/50 for a blank card and for an all-even card', () => {
    expect(displayScoresV2(buildInitialRowsV2())).toEqual({ a: 50, b: 50 });
    expect(displayScoresV2(sweep(0))).toEqual({ a: 50, b: 50 });
  });

  it('uses far more of the range than V1 on identical calls', () => {
    const v2 = displayScoresV2(kaiVsSamson());
    const v1 = displayScores(kaiVsSamson().map(v2RowToV1));
    expect(v2).toEqual({ a: 42.5, b: 57.5 });
    expect(v1).toEqual({ a: 48.1, b: 51.9 });
  });
});

describe('V1 parity on raw points', () => {
  it('scores the same raw points as V1 when no row is even', () => {
    const rows = kaiVsSamson();
    expect(totalPointsV2(rows)).toEqual({ a: 21, b: 24 });
    expect(totalPoints(rows.map(v2RowToV1))).toEqual({ a: 21, b: 24 });
  });
});

describe('verdictV2', () => {
  it('names the winner by the display margin', () => {
    expect(verdictV2(kaiVsSamson())).toEqual({
      kind: 'winner',
      side: 'B',
      margin: 15,
    });
  });

  it('calls a dead heat a tie', () => {
    expect(verdictV2(sweep(0))).toEqual({ kind: 'tie' });
  });
});

describe('converters', () => {
  it('maps a V1 row onto a signed margin', () => {
    const base = { id: 'x', label: 'x', type: 'pose' as const };
    expect(v1RowToV2({ ...base, winner: null, margin: null }).margin).toBe(null);
    expect(v1RowToV2({ ...base, winner: 'tie', margin: null }).margin).toBe(0);
    expect(v1RowToV2({ ...base, winner: 'A', margin: 3 }).margin).toBe(3);
    expect(v1RowToV2({ ...base, winner: 'B', margin: 2 }).margin).toBe(-2);
    // A side picked but no margin scores nothing in V1 — that is an even call.
    expect(v1RowToV2({ ...base, winner: 'A', margin: null }).margin).toBe(0);
  });

  it('maps a signed margin back onto a V1 row, losing "even" on poses', () => {
    const pose = { id: 'x', label: 'x', type: 'pose' as const };
    const cat = { id: 'y', label: 'y', type: 'category' as const };
    expect(v2RowToV1({ ...pose, margin: 3 })).toMatchObject({ winner: 'A', margin: 3 });
    expect(v2RowToV1({ ...pose, margin: -3 })).toMatchObject({ winner: 'B', margin: 3 });
    expect(v2RowToV1({ ...cat, margin: 0 })).toMatchObject({ winner: 'tie', margin: null });
    // V1 has no way to say two poses are equal, so the call is simply dropped.
    expect(v2RowToV1({ ...pose, margin: 0 })).toMatchObject({ winner: null, margin: null });
    expect(v2RowToV1({ ...pose, margin: null })).toMatchObject({ winner: null, margin: null });
  });

  it('round-trips a V1 card through V2 without changing its V1 score', () => {
    const rows: Row[] = buildInitialRows().map((r, i) => ({
      ...r,
      winner: i % 2 === 0 ? ('A' as const) : ('B' as const),
      margin: ((i % 4) + 1) as 1 | 2 | 3 | 4,
    }));
    const back = rows.map(v1RowToV2).map(v2RowToV1);
    expect(totalPoints(back)).toEqual(totalPoints(rows));
  });
});

describe('consensusV2 — trimmed mean', () => {
  it('drops the high and the low desk before averaging', () => {
    // Six desks agree on A by 2; one rogue desk swings 20 points to B.
    const result = consensusV2(desks([2, 2, 2, 2, 2, 2, -20]));
    expect(result.scoredCount).toBe(7);
    expect(result.meanDiff).toBeCloseTo(2, 10);
    // The plain mean would have handed the win to B.
    expect(result.simpleMeanDiff).toBeCloseTo(-8 / 7, 10);
    expect(result.consensusA).toBe(55);
    expect(result.trimmed).toEqual(['desk6', 'desk5']);
  });

  it('does not trim below five scored desks', () => {
    const result = consensusV2(desks([10, 2, 2, 2]));
    expect(result.meanDiff).toBeCloseTo(4, 10);
    expect(result.trimmed).toEqual([]);
  });

  it('trims exactly one desk from each end at five desks', () => {
    const result = consensusV2(desks([-10, 1, 2, 3, 10]));
    expect(result.meanDiff).toBeCloseTo(2, 10);
    expect(result.trimmed).toEqual(['desk0', 'desk4']);
  });

  it('pools raw points, so a saturated desk still carries its full weight', () => {
    // Desk A saturates its own card at 100; desk B reads 40.
    const result = consensusV2(desks([40, -4]));
    expect(result.meanDiff).toBeCloseTo(18, 10);
    // Averaging the displayed 100 and 40 would have given 70.
    expect(result.consensusA).toBe(95);
  });

  it('clamps the consensus display to the ends', () => {
    expect(consensusV2(desks([60, 40, 80])).consensusA).toBe(100);
    expect(consensusV2(desks([-60, -40, -80])).consensusA).toBe(0);
  });
});

describe('consensusV2 — uncertainty', () => {
  it('refuses to call a verdict the spread cannot support', () => {
    const result = consensusV2(desks([-1, 0, 1, 2, 3]));
    expect(result.meanDiff).toBeCloseTo(1, 10);
    expect(result.sd).toBeCloseTo(1.5811, 4);
    expect(result.sem).toBeCloseTo(0.7071, 4);
    expect(result.tooClose).toBe(true);
    expect(result.verdict).toEqual({ kind: 'tooClose' });
  });

  it('calls a verdict when the lead clears 1.96 SEM', () => {
    const result = consensusV2(desks([6, 7, 8, 9, 10]));
    expect(result.meanDiff).toBeCloseTo(8, 10);
    expect(result.tooClose).toBe(false);
    expect(result.verdict).toEqual({ kind: 'winner', side: 'A', margin: 40 });
  });

  it('reports zero spread when every desk agrees exactly', () => {
    const result = consensusV2(desks([8, 8, 8, 8, 8]));
    expect(result.sd).toBe(0);
    expect(result.sem).toBe(0);
    expect(result.tooClose).toBe(false);
    expect(result.consensusA).toBe(70);
  });

  it('does not call a single desk too close to call', () => {
    const result = consensusV2(desks([1]));
    expect(result.sd).toBe(0);
    expect(result.sem).toBe(0);
    expect(result.tooClose).toBe(false);
    expect(result.meanDiff).toBe(1);
  });

  it('sits at 50/50 with no desks scored', () => {
    const result = consensusV2([]);
    expect(result.scoredCount).toBe(0);
    expect(result.consensusA).toBe(50);
    expect(result.consensusB).toBe(50);
    expect(result.tooClose).toBe(false);
    expect(result.verdict).toEqual({ kind: 'tie' });
  });
});

describe('the information V1 throws away', () => {
  it('scores an all-even pose card differently from V1', () => {
    // Every pose dead even; A takes all four categories by 2.
    const rows = buildInitialRowsV2().map((r) => ({
      ...r,
      margin: (r.type === 'pose' ? 0 : 2) as SignedMargin,
    }));
    expect(displayScoresV2(rows)).toEqual({ a: 70, b: 30 });
    // V1 cannot record the even poses at all, and its wide denominator flattens
    // what is left.
    expect(displayScores(rows.map(v2RowToV1))).toEqual({ a: 55, b: 45 });
  });
});
