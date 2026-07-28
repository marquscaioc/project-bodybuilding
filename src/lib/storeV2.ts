'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Side } from '@/types';
import { buildInitialRowsV2, type RowV2, type SignedMargin } from './scoringV2';

/**
 * The /lab sandbox card. One global store — the lab is a single workbench, not
 * a per-judge desk — under its own localStorage key so it can never collide
 * with the live `scorecard:*` cards the show runs on.
 *
 * Hydration is deferred (`skipHydration`) and kicked off by the page, which
 * keeps the server render and the first client render identical.
 */

export type LabState = {
  nameA: string;
  nameB: string;
  rows: RowV2[];
  /** Which card the rows were imported from, for the UI to echo back. */
  importedFrom: string | null;

  setName: (side: Side, name: string) => void;
  setMargin: (rowId: string, margin: SignedMargin | null) => void;
  importCard: (input: {
    rows: RowV2[];
    nameA?: string;
    nameB?: string;
    label: string;
  }) => void;
  reset: () => void;
};

function defaults() {
  return {
    nameA: 'Athlete A',
    nameB: 'Athlete B',
    rows: buildInitialRowsV2(),
    importedFrom: null,
  };
}

export const useLabCard = create<LabState>()(
  persist(
    (set) => ({
      ...defaults(),

      setName: (side, name) => set(side === 'A' ? { nameA: name } : { nameB: name }),

      setMargin: (rowId, margin) =>
        set((s) => ({
          rows: s.rows.map((r) => (r.id === rowId ? { ...r, margin } : r)),
        })),

      importCard: ({ rows, nameA, nameB, label }) =>
        set({
          rows,
          nameA: nameA?.trim() || 'Athlete A',
          nameB: nameB?.trim() || 'Athlete B',
          importedFrom: label,
        }),

      reset: () => set(defaults()),
    }),
    {
      name: 'scorecard-v2:lab',
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        nameA: s.nameA,
        nameB: s.nameB,
        rows: s.rows,
        importedFrom: s.importedFrom,
      }),
      version: 1,
      skipHydration: true,
    },
  ),
);
