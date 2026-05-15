'use client';

import { createContext, createElement, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';
import { create, useStore as useZustandStore } from 'zustand';
import type { StoreApi } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AthletePhoto, Margin, Match, Outcome, Side } from '@/types';
import { buildInitialRows, POSES } from './constants';

const DEFAULT_POSE_ID = POSES[0]?.id ?? 'FDB';

export type State = Match & {
  setName: (side: Side, name: string) => void;
  setHeight: (side: Side, heightCm: number | undefined, source: 'auto' | 'manual') => void;
  setSizeAdjust: (side: Side, sizeAdjust: number) => void;

  setPhoto: (side: Side, poseId: string, photo: AthletePhoto) => void;
  clearPhoto: (side: Side, poseId: string) => void;
  setPhotoOffset: (
    side: Side,
    poseId: string,
    offsetX: number | undefined,
    offsetY: number | undefined,
  ) => void;
  setCurrentPose: (poseId: string) => void;

  setWinner: (rowId: string, winner: Outcome | null) => void;
  setMargin: (rowId: string, margin: Margin | null) => void;
  setRow: (rowId: string, winner: Outcome | null, margin: Margin | null) => void;

  reset: () => void;
  resetAll: () => void;
};

function defaultState(): Match {
  return {
    athleteA: { name: 'Athlete A' },
    athleteB: { name: 'Athlete B' },
    rows: buildInitialRows(),
    currentPoseId: DEFAULT_POSE_ID,
  };
}

/**
 * Build a fresh Zustand store scoped to a single judge.
 * Each judge gets their own localStorage key so scoring data, photos,
 * names, and per-pose nudges all stay isolated across judges.
 */
function createScorecardStore(judgeId: string) {
  return create<State>()(
    persist(
      (set) => ({
        ...defaultState(),

        setName: (side, name) =>
          set((s) => {
            const a = s.athleteA;
            const b = s.athleteB;
            const clearAuto = (athlete: typeof a) =>
              athlete.heightSource === 'manual'
                ? { ...athlete, name }
                : { ...athlete, name, heightCm: undefined, heightSource: undefined };
            return side === 'A'
              ? { athleteA: clearAuto(a) }
              : { athleteB: clearAuto(b) };
          }),

        setHeight: (side, heightCm, source) =>
          set((s) =>
            side === 'A'
              ? { athleteA: { ...s.athleteA, heightCm, heightSource: source } }
              : { athleteB: { ...s.athleteB, heightCm, heightSource: source } },
          ),

        setSizeAdjust: (side, sizeAdjust) =>
          set((s) =>
            side === 'A'
              ? { athleteA: { ...s.athleteA, sizeAdjust } }
              : { athleteB: { ...s.athleteB, sizeAdjust } },
          ),

        setPhoto: (side, poseId, photo) =>
          set((s) => {
            const target = side === 'A' ? s.athleteA : s.athleteB;
            const updatedPhotos = { ...(target.photos ?? {}), [poseId]: photo };
            return side === 'A'
              ? { athleteA: { ...target, photos: updatedPhotos } }
              : { athleteB: { ...target, photos: updatedPhotos } };
          }),

        clearPhoto: (side, poseId) =>
          set((s) => {
            const target = side === 'A' ? s.athleteA : s.athleteB;
            if (!target.photos?.[poseId]) return {};
            const rest = { ...target.photos };
            delete rest[poseId];
            return side === 'A'
              ? { athleteA: { ...target, photos: rest } }
              : { athleteB: { ...target, photos: rest } };
          }),

        setPhotoOffset: (side, poseId, offsetX, offsetY) =>
          set((s) => {
            const target = side === 'A' ? s.athleteA : s.athleteB;
            const existing = target.photos?.[poseId];
            if (!existing) return {};
            const updated: AthletePhoto = { ...existing, offsetX, offsetY };
            const photos = { ...target.photos, [poseId]: updated };
            return side === 'A'
              ? { athleteA: { ...target, photos } }
              : { athleteB: { ...target, photos } };
          }),

        setCurrentPose: (poseId) => set({ currentPoseId: poseId }),

        setWinner: (rowId, winner) =>
          set((s) => ({
            rows: s.rows.map((r) => (r.id === rowId ? { ...r, winner } : r)),
          })),

        setMargin: (rowId, margin) =>
          set((s) => ({
            rows: s.rows.map((r) => (r.id === rowId ? { ...r, margin } : r)),
          })),

        setRow: (rowId, winner, margin) =>
          set((s) => ({
            rows: s.rows.map((r) => (r.id === rowId ? { ...r, winner, margin } : r)),
          })),

        reset: () => set({ rows: buildInitialRows() }),

        resetAll: () => set(defaultState()),
      }),
      {
        name: `scorecard:${judgeId}`,
        storage: createJSONStorage(() => localStorage),
        // Persist only the Match data — actions are recreated on hydrate.
        partialize: (state) => ({
          athleteA: state.athleteA,
          athleteB: state.athleteB,
          rows: state.rows,
          currentPoseId: state.currentPoseId,
        }),
        version: 1,
        skipHydration: false,
      },
    ),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// React context wiring
// Each ScorecardPage creates a store for its judge and provides it through
// context. Consumers keep the existing `useScorecard(s => ...)` API.
// ─────────────────────────────────────────────────────────────────────────────

const ScorecardStoreContext = createContext<StoreApi<State> | null>(null);

export function ScorecardStoreProvider({
  judgeId,
  children,
}: {
  judgeId: string;
  children: ReactNode;
}) {
  // Memo by judgeId so switching judges (or routes) gives a fresh hydrated store.
  const store = useMemo(() => createScorecardStore(judgeId), [judgeId]);
  return createElement(
    ScorecardStoreContext.Provider,
    { value: store },
    children,
  );
}

/**
 * Read from / dispatch to the active judge's scorecard store.
 *
 * Drop-in replacement for the previous global `useScorecard` — same selector
 * API, but the underlying store is the one provided by the nearest
 * `ScorecardStoreProvider` in the tree.
 */
export function useScorecard<T>(selector: (state: State) => T): T {
  const store = useContext(ScorecardStoreContext);
  if (!store) {
    throw new Error('useScorecard must be used inside <ScorecardStoreProvider>');
  }
  return useZustandStore(store, selector);
}
