'use client';

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { ScorecardStoreProvider, useScorecard } from '@/lib/store';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import type { ScorecardRow } from '@/lib/types/db';
import type { Match } from '@/types';

const DEBOUNCE_MS = 600;

/**
 * Wraps ScorecardStoreProvider with two-way Supabase sync:
 *   • On mount: fetch the user's scorecard row and hydrate the store.
 *   • On store change: debounced upsert back to Supabase.
 *
 * The local Zustand store is the source of truth during a session;
 * Supabase is the persistent backing store. Realtime subscription is
 * intentionally NOT enabled here — the user is the only writer of
 * their own row, so we don't need to react to remote changes.
 */
export function CloudScorecardProvider({
  userId,
  children,
}: {
  userId: string;
  children: ReactNode;
}) {
  return (
    <ScorecardStoreProvider judgeId={`cloud:${userId}`}>
      <SyncBridge userId={userId}>{children}</SyncBridge>
    </ScorecardStoreProvider>
  );
}

function SyncBridge({
  userId,
  children,
}: {
  userId: string;
  children: ReactNode;
}) {
  const hydrate = useScorecard((s) => ({
    setName: s.setName,
    setRow: s.setRow,
    setCurrentPose: s.setCurrentPose,
  }));
  // Snapshot of all match-shape state for upsert.
  const snapshot = useScorecard((s) => ({
    athleteA: s.athleteA,
    athleteB: s.athleteB,
    rows: s.rows,
    currentPoseId: s.currentPoseId,
  }));
  const hydratedRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── 1. Hydrate from Supabase on mount ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = getSupabaseBrowser();
      const { data, error } = await supabase
        .from('scorecards')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();
      if (cancelled || error || !data) {
        hydratedRef.current = true;
        return;
      }
      hydrateStoreFromRow(data, hydrate);
      hydratedRef.current = true;
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // ── 2. Persist local changes to Supabase, debounced ──
  useEffect(() => {
    if (!hydratedRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      const supabase = getSupabaseBrowser();
      const { error } = await supabase
        .from('scorecards')
        .upsert({
          user_id: userId,
          athlete_a: snapshot.athleteA,
          athlete_b: snapshot.athleteB,
          rows: snapshot.rows,
          current_pose_id: snapshot.currentPoseId,
        });
      if (error) console.warn('scorecard upsert failed', error);
    }, DEBOUNCE_MS);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [snapshot, userId]);

  return <>{children}</>;
}

/**
 * Apply DB row values to the in-memory store. We only patch the
 * pieces the row carries; photos/face/body stay client-only.
 */
function hydrateStoreFromRow(
  row: ScorecardRow,
  actions: {
    setName: (side: 'A' | 'B', name: string) => void;
    setRow: (rowId: string, winner: Match['rows'][number]['winner'], margin: Match['rows'][number]['margin']) => void;
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
