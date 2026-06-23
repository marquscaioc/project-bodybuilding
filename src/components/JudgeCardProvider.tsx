'use client';

import { useEffect, useRef } from 'react';
import { useScorecard } from '@/lib/store';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import type { JudgeCardRow } from '@/lib/types/db';
import type { Athlete, Match } from '@/types';

const DEBOUNCE_MS = 500;

/**
 * Two-way Supabase sync for one live desk, keyed by judge slug (not auth user).
 *
 * Render this *inside* a ScorecardStoreProvider (e.g. via ScorecardPage's
 * `sync` prop) so it shares the exact store the scorecard UI writes to:
 *   • On mount: fetch judge_cards[slug] and hydrate the store.
 *   • On store change: debounced upsert back to judge_cards[slug].
 *
 * A desk has a single writer (the judge sitting at it), so we don't subscribe
 * to realtime here — the host console runs its own realtime query over every
 * row instead.
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
      const supabase = getSupabaseBrowser();
      const { data, error } = await supabase
        .from('judge_cards')
        .select('*')
        .eq('slug', slug)
        .maybeSingle();
      if (cancelled) return;
      if (!error && data) {
        hydrateStoreFromRow(data, { setName, setRow, setCurrentPose });
      }
      hydratedRef.current = true;
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  // ── 2. Persist local changes to Supabase, debounced ──
  useEffect(() => {
    if (!hydratedRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const supabase = getSupabaseBrowser();
      const { error } = await supabase.from('judge_cards').upsert({
        slug,
        display_name: displayName,
        athlete_a: stripPhotos(athleteA),
        athlete_b: stripPhotos(athleteB),
        rows,
        current_pose_id: currentPoseId,
      });
      if (error) console.warn('judge_card upsert failed', error);
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
