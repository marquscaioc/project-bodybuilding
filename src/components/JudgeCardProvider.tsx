'use client';

import { useEffect, useRef } from 'react';
import { useScorecard } from '@/lib/store';
import { HOST_SLUG } from '@/lib/show';
import type { JudgeCardRow } from '@/lib/types/db';
import type { Athlete, Match } from '@/types';

const DEBOUNCE_MS = 500;
const MATCHUP_POLL_MS = 2_000;

/**
 * Two-way sync for one live desk through authenticated server routes.
 *
 * Render this *inside* a ScorecardStoreProvider (e.g. via ScorecardPage's
 * `sync` prop) so it shares the exact store the scorecard UI writes to:
 *   • On mount: fetch the authorized judge_cards[slug] and hydrate the store.
 *   • On store change: debounced authenticated upsert for the same slug.
 *
 * A desk has a single authorized writer. The host reads all cards through its
 * own protected endpoint.
 */
export function JudgeCardSync({
  slug,
  displayName,
}: {
  slug: string;
  displayName: string;
}) {
  // Select individually — zustand v5 (useSyncExternalStore) throws an
  // infinite-loop error if a selector returns a fresh object every render.
  // Actions are stable; the four data fields change only on edits.
  const setName = useScorecard((s) => s.setName);
  const setRow = useScorecard((s) => s.setRow);
  const setCurrentPose = useScorecard((s) => s.setCurrentPose);
  const athleteA = useScorecard((s) => s.athleteA);
  const athleteB = useScorecard((s) => s.athleteB);
  const rows = useScorecard((s) => s.rows);
  const currentPoseId = useScorecard((s) => s.currentPoseId);

  const hydratedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── 1. Hydrate from Supabase on mount ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const response = await fetch(`/api/judge-card?slug=${encodeURIComponent(slug)}`, {
        cache: 'no-store',
      });
      if (cancelled) return;
      if (response.ok) {
        const { card } = await response.json() as { card: JudgeCardRow | null };
        if (card) {
          hydrateStoreFromRow(card, { setName, setRow, setCurrentPose });
        }
      }
      hydratedRef.current = true;
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // Dylan owns the matchup names. Other desks only mirror those two fields;
  // their points, pose tab, height adjustments and local UI state stay intact.
  useEffect(() => {
    if (slug === HOST_SLUG) return;
    let cancelled = false;

    async function loadNames() {
      const response = await fetch('/api/matchup', { cache: 'no-store' });
      if (cancelled || !response.ok) return;
      const matchup = await response.json() as { athleteA: string; athleteB: string };
      if (matchup.athleteA !== athleteA.name) setName('A', matchup.athleteA);
      if (matchup.athleteB !== athleteB.name) setName('B', matchup.athleteB);
    }

    void loadNames();
    const interval = window.setInterval(loadNames, MATCHUP_POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [athleteA.name, athleteB.name, setName, slug]);

  // ── 2. Persist local changes to Supabase, debounced ──
  useEffect(() => {
    if (!hydratedRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const response = await fetch('/api/judge-card', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          displayName,
          athleteA: stripPhotos(athleteA),
          athleteB: stripPhotos(athleteB),
          rows,
          currentPoseId,
        }),
      });
      if (!response.ok) console.warn('judge_card save failed', response.status);
    }, DEBOUNCE_MS);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [athleteA, athleteB, rows, currentPoseId, slug, displayName]);

  return null;
}

/**
 * Drop the heavy per-pose `photos` before syncing an athlete to judge_cards.
 * Shared photos now travel through show_photos (Storage URLs); the scorecard
 * row only needs names/height, keeping it small.
 */
function stripPhotos(athlete: Athlete): Athlete {
  if (!athlete.photos) return athlete;
  const rest = { ...athlete };
  delete rest.photos;
  return rest;
}

/** Apply DB row values to the in-memory store (rows/names/pose only). */
function hydrateStoreFromRow(
  row: JudgeCardRow,
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
  if (row.athlete_a?.name) actions.setName('A', row.athlete_a.name);
  if (row.athlete_b?.name) actions.setName('B', row.athlete_b.name);
  if (Array.isArray(row.rows)) {
    for (const r of row.rows) {
      actions.setRow(r.id, r.winner ?? null, r.margin ?? null);
    }
  }
  if (row.current_pose_id) actions.setCurrentPose(row.current_pose_id);
}
