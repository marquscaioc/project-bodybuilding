'use client';

import { useEffect, useRef } from 'react';
import { useScorecard } from '@/lib/store';
import type { FanScorecardRow } from '@/lib/types/db';
import type { Athlete, Match } from '@/types';

const DEBOUNCE_MS = 500;

/** Syncs the current browser's approved fan card. The API derives its ID from the signed cookie. */
export function FanCardSync() {
  const setName = useScorecard((state) => state.setName);
  const setRow = useScorecard((state) => state.setRow);
  const setCurrentPose = useScorecard((state) => state.setCurrentPose);
  const athleteA = useScorecard((state) => state.athleteA);
  const athleteB = useScorecard((state) => state.athleteB);
  const rows = useScorecard((state) => state.rows);
  const currentPoseId = useScorecard((state) => state.currentPoseId);
  const hydratedRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function hydrate() {
      const response = await fetch('/api/fan-scorecard', { cache: 'no-store' });
      if (cancelled) return;
      if (response.ok) {
        const { card } = await response.json() as { card: FanScorecardRow };
        hydrateStore(card, { setName, setRow, setCurrentPose });
      }
      hydratedRef.current = true;
    }
    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [setCurrentPose, setName, setRow]);

  useEffect(() => {
    if (!hydratedRef.current) return;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(async () => {
      const response = await fetch('/api/fan-scorecard', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          athleteA: stripPhotos(athleteA),
          athleteB: stripPhotos(athleteB),
          rows,
          currentPoseId,
        }),
      });
      if (!response.ok) console.warn('fan scorecard save failed', response.status);
    }, DEBOUNCE_MS);
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [athleteA, athleteB, currentPoseId, rows]);

  return null;
}

function stripPhotos(athlete: Athlete): Athlete {
  const copy = { ...athlete };
  delete copy.photos;
  return copy;
}

function hydrateStore(
  card: FanScorecardRow,
  actions: {
    setName: (side: 'A' | 'B', name: string) => void;
    setRow: (
      rowId: string,
      winner: Match['rows'][number]['winner'],
      margin: Match['rows'][number]['margin'],
    ) => void;
    setCurrentPose: (id: string) => void;
  },
) {
  if (card.athlete_a?.name) actions.setName('A', card.athlete_a.name);
  if (card.athlete_b?.name) actions.setName('B', card.athlete_b.name);
  for (const row of card.rows ?? []) {
    actions.setRow(row.id, row.winner ?? null, row.margin ?? null);
  }
  if (card.current_pose_id) actions.setCurrentPose(card.current_pose_id);
}
