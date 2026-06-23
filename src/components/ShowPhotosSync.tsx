'use client';

import { useEffect, useRef } from 'react';
import { useScorecard } from '@/lib/store';
import { getSupabaseBrowser } from '@/lib/supabase/client';
import { fromSharedPhoto, toSharedPhoto, uploadCutout } from '@/lib/showPhotos';
import type { ShowPhotosPoses } from '@/lib/types/db';
import type { AthletePhoto, Side } from '@/types';

/**
 * Shared pose photos bridge for one live desk.
 *
 * Render this inside the desk's ScorecardStoreProvider (via ScorecardPage's
 * `sync` prop) so it shares the exact store the comparison stage reads.
 *   • Host desk  → writes its curated cutouts to Storage + the show_photos
 *                  manifest (single writer, never reads back).
 *   • Judge desk → subscribes to the manifest and hydrates the store read-only,
 *                  so every panelist sees the Host's exact images.
 */
export function ShowPhotosSync({
  showCode,
  isHost,
}: {
  showCode: string;
  isHost: boolean;
}) {
  // isHost is fixed by login for the life of the desk, so the branch is stable.
  return isHost ? (
    <HostPhotosWriter showCode={showCode} />
  ) : (
    <JudgePhotosReader showCode={showCode} />
  );
}

const PUSH_DEBOUNCE_MS = 600;

function HostPhotosWriter({ showCode }: { showCode: string }) {
  // Individual selectors only — zustand v5 throws on object-returning selectors.
  const photosA = useScorecard((s) => s.athleteA.photos);
  const photosB = useScorecard((s) => s.athleteB.photos);

  // local data-URL → uploaded public URL, so unchanged images aren't re-uploaded.
  const uploadedRef = useRef<Map<string, string>>(new Map());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void pushManifest(showCode, photosA, photosB, uploadedRef.current);
    }, PUSH_DEBOUNCE_MS);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [showCode, photosA, photosB]);

  return null;
}

/** Rebuild the whole manifest from current store photos and upsert it. */
async function pushManifest(
  showCode: string,
  photosA: Record<string, AthletePhoto> | undefined,
  photosB: Record<string, AthletePhoto> | undefined,
  uploaded: Map<string, string>,
) {
  const poses: ShowPhotosPoses = {};

  async function place(side: Side, photos?: Record<string, AthletePhoto>) {
    if (!photos) return;
    for (const [poseId, photo] of Object.entries(photos)) {
      if (!photo?.imageUrl) continue;
      let url = uploaded.get(photo.imageUrl);
      if (!url) {
        try {
          url = await uploadCutout(showCode, poseId, side, photo.imageUrl);
          uploaded.set(photo.imageUrl, url);
        } catch (e) {
          console.warn('show photo upload failed', poseId, side, e);
          continue; // keep the local photo; retried on the next change
        }
      }
      (poses[poseId] ??= {})[side] = toSharedPhoto(photo, url);
    }
  }

  await place('A', photosA);
  await place('B', photosB);

  const { error } = await getSupabaseBrowser()
    .from('show_photos')
    .upsert({ show_code: showCode, poses });
  if (error) console.warn('show_photos upsert failed', error);
}

function JudgePhotosReader({ showCode }: { showCode: string }) {
  const setPhoto = useScorecard((s) => s.setPhoto);
  const clearPhoto = useScorecard((s) => s.clearPhoto);

  // Which `${side}:${poseId}` we've applied, so we can clear ones the Host removes.
  const appliedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    let cancelled = false;

    function applyManifest(poses: ShowPhotosPoses) {
      const next = new Set<string>();
      for (const [poseId, sides] of Object.entries(poses)) {
        (['A', 'B'] as Side[]).forEach((side) => {
          const shared = sides?.[side];
          if (!shared?.url) return;
          next.add(`${side}:${poseId}`);
          // fromSharedPhoto already includes the Host's offsets, so setPhoto
          // alone restores image + framing.
          setPhoto(side, poseId, fromSharedPhoto(shared));
        });
      }
      for (const key of appliedRef.current) {
        if (!next.has(key)) {
          const [side, poseId] = key.split(':') as [Side, string];
          clearPhoto(side, poseId);
        }
      }
      appliedRef.current = next;
    }

    async function load() {
      const { data, error } = await supabase
        .from('show_photos')
        .select('*')
        .eq('show_code', showCode)
        .maybeSingle();
      if (cancelled || error) return;
      applyManifest((data?.poses ?? {}) as ShowPhotosPoses);
    }

    load();

    // Realtime is just a signal — refetch over REST so correctness never
    // depends on the change payload.
    const channel = supabase
      .channel(`show-photos-${showCode}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'show_photos',
          filter: `show_code=eq.${showCode}`,
        },
        () => load(),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCode]);

  return null;
}
