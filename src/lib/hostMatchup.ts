import 'server-only';

import { HOST_SLUG } from '@/lib/show';
import { getSupabaseAdmin } from '@/lib/supabase/admin';
import type { Athlete } from '@/types';

export type HostMatchup = {
  athleteA: Athlete;
  athleteB: Athlete;
  currentPoseId: string;
  updatedAt: string | null;
};

const FALLBACK_A: Athlete = { name: 'Athlete A' };
const FALLBACK_B: Athlete = { name: 'Athlete B' };

/** Dylan's desk is the single source of truth for the active matchup. */
export async function getHostMatchup(): Promise<HostMatchup> {
  const { data, error } = await getSupabaseAdmin()
    .from('judge_cards')
    .select('athlete_a, athlete_b, current_pose_id, updated_at')
    .eq('slug', HOST_SLUG)
    .maybeSingle();

  if (error) throw error;
  return {
    athleteA: normalizeAthlete(data?.athlete_a, FALLBACK_A),
    athleteB: normalizeAthlete(data?.athlete_b, FALLBACK_B),
    currentPoseId: data?.current_pose_id ?? 'FDB',
    updatedAt: data?.updated_at ?? null,
  };
}

/** Keep desk-specific metadata but force the canonical Host name. */
export function withHostName(local: Athlete, host: Athlete): Athlete {
  return { ...local, name: host.name };
}

function normalizeAthlete(value: Athlete | null | undefined, fallback: Athlete): Athlete {
  const name = value?.name?.trim();
  return { ...(value ?? fallback), name: name ? name.slice(0, 80) : fallback.name };
}
