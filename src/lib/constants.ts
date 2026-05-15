import type { Row } from '@/types';

export const POSE_WEIGHT = 2;
export const CATEGORY_WEIGHT = 1;
export const MAX_DIFFERENTIAL = 80;

export const POSES: Array<{ id: string; label: string; short: string }> = [
  { id: 'FDB', short: 'FDB', label: 'Front Double Biceps' },
  { id: 'FLS', short: 'FLS', label: 'Front Lat Spread' },
  { id: 'SC', short: 'SC', label: 'Side Chest' },
  { id: 'RDB', short: 'RDB', label: 'Rear Double Biceps' },
  { id: 'RLS', short: 'RLS', label: 'Rear Lat Spread' },
  { id: 'ST', short: 'ST', label: 'Side Triceps' },
  { id: 'AB+T', short: 'AB+T', label: 'Abdominals & Thighs' },
  { id: 'MM', short: 'MM', label: 'Most Muscular' },
];

export const CATEGORIES: Array<{ id: string; label: string }> = [
  { id: 'muscularity', label: 'Muscularity' },
  { id: 'conditioning', label: 'Conditioning' },
  { id: 'shape', label: 'Shape' },
  { id: 'flaws', label: 'Flaws' },
];

export function buildInitialRows(): Row[] {
  return [
    ...POSES.map((p) => ({
      id: p.id,
      label: p.label,
      type: 'pose' as const,
      winner: null,
      margin: null,
    })),
    ...CATEGORIES.map((c) => ({
      id: c.id,
      label: c.label,
      type: 'category' as const,
      winner: null,
      margin: null,
    })),
  ];
}
