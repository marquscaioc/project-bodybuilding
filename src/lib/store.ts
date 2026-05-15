'use client';

import { create } from 'zustand';
import type { AthletePhoto, Margin, Match, Outcome, Side } from '@/types';
import { buildInitialRows, POSES } from './constants';

const DEFAULT_POSE_ID = POSES[0]?.id ?? 'FDB';

type State = Match & {
  setName: (side: Side, name: string) => void;
  setHeight: (side: Side, heightCm: number | undefined, source: 'auto' | 'manual') => void;
  setSizeAdjust: (side: Side, sizeAdjust: number) => void;

  /** Replace (or insert) the photo for a side at a given pose. */
  setPhoto: (side: Side, poseId: string, photo: AthletePhoto) => void;
  /** Remove the photo for a side at a given pose. */
  clearPhoto: (side: Side, poseId: string) => void;
  /** Update the manual X/Y offset of a stored photo. Pass undefined to reset. */
  setPhotoOffset: (
    side: Side,
    poseId: string,
    offsetX: number | undefined,
    offsetY: number | undefined,
  ) => void;
  /** Switch which pose tab is active in the comparison stage. */
  setCurrentPose: (poseId: string) => void;

  setWinner: (rowId: string, winner: Outcome | null) => void;
  setMargin: (rowId: string, margin: Margin | null) => void;
  setRow: (rowId: string, winner: Outcome | null, margin: Margin | null) => void;
  reset: () => void;
  resetAll: () => void;
};

export const useScorecard = create<State>((set) => ({
  athleteA: { name: 'Athlete A' },
  athleteB: { name: 'Athlete B' },
  rows: buildInitialRows(),
  currentPoseId: DEFAULT_POSE_ID,

  setName: (side, name) =>
    set((s) => {
      // Reset auto-detected height when the name changes; manual stays sticky.
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

  resetAll: () =>
    set({
      athleteA: { name: 'Athlete A' },
      athleteB: { name: 'Athlete B' },
      rows: buildInitialRows(),
      currentPoseId: DEFAULT_POSE_ID,
    }),
}));
