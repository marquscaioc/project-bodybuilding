'use client';

import type { Row } from '@/types';
import { getBuiltinJudge } from './builtinJudges';
import { v1RowToV2, type RowV2 } from './scoringV2';

/**
 * Pull existing V1 cards out of localStorage so the lab can score the exact
 * same judge calls with the new engine. Read-only: the lab never writes back
 * to a `scorecard:*` key.
 */

const PREFIX = 'scorecard:';

export type ImportableCard = {
  storageKey: string;
  label: string;
  nameA: string;
  nameB: string;
  rows: Row[];
  judgedCount: number;
};

/** `scorecard:judge:xavier` -> "Xavier · desk"; `scorecard:marcus` -> "Marcus · solo". */
function labelFor(storageKey: string): string {
  const id = storageKey.slice(PREFIX.length);
  const isDesk = id.startsWith('judge:');
  const slug = isDesk ? id.slice('judge:'.length) : id;
  const name = getBuiltinJudge(slug)?.name ?? slug;
  return `${name} · ${isDesk ? 'desk' : 'solo'}`;
}

function parseCard(storageKey: string, raw: string): ImportableCard | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const state = (parsed as { state?: Record<string, unknown> } | null)?.state;
  if (!state || !Array.isArray(state.rows)) return null;

  const rows = state.rows as Row[];
  const judgedCount = rows.filter((r) => r?.winner != null).length;
  const athleteA = state.athleteA as { name?: string } | undefined;
  const athleteB = state.athleteB as { name?: string } | undefined;

  return {
    storageKey,
    label: labelFor(storageKey),
    nameA: athleteA?.name ?? 'Athlete A',
    nameB: athleteB?.name ?? 'Athlete B',
    rows,
    judgedCount,
  };
}

/** Every saved V1 card in this browser that has at least one row judged. */
export function findImportableCards(): ImportableCard[] {
  if (typeof window === 'undefined') return [];
  const found: ImportableCard[] = [];
  for (let i = 0; i < window.localStorage.length; i += 1) {
    const key = window.localStorage.key(i);
    if (!key?.startsWith(PREFIX)) continue;
    const raw = window.localStorage.getItem(key);
    if (!raw) continue;
    const card = parseCard(key, raw);
    if (card && card.judgedCount > 0) found.push(card);
  }
  return found.sort((a, b) => a.label.localeCompare(b.label));
}

/** Convert an imported V1 card into the lab's signed-margin rows. */
export function toLabRows(card: ImportableCard): RowV2[] {
  return card.rows.map(v1RowToV2);
}
