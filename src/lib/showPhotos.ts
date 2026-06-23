'use client';

/**
 * Shared pose photos: helpers for moving a Host-curated cutout into Supabase
 * Storage and mapping between the in-memory store photo (AthletePhoto) and the
 * small DB manifest entry (SharedPhoto).
 *
 * Only the Host writes (uploads + manifest); every other desk reads the
 * manifest and renders the images read-only. See ShowPhotosSync.
 */

import type { AthletePhoto, Side } from '@/types';
import type { SharedPhoto } from '@/lib/types/db';
import { getSupabaseBrowser } from '@/lib/supabase/client';

export const SHOW_PHOTOS_BUCKET = 'show-photos';

/** Deterministic object path so re-uploading a pose overwrites in place. */
export function cutoutPath(showCode: string, poseId: string, side: Side): string {
  return `${showCode}/${poseId}/${side}.png`;
}

/**
 * Decode a base64 `data:` URL into a Blob. Our cutouts always come from
 * FileReader.readAsDataURL (base64), so we don't handle URL-encoded payloads.
 * Works in the browser and in the Node test environment (atob is global).
 */
export function dataUrlToBlob(dataUrl: string): Blob {
  const comma = dataUrl.indexOf(',');
  const header = dataUrl.slice(0, comma);
  const base64 = dataUrl.slice(comma + 1);
  const contentType = /data:([^;]+)/.exec(header)?.[1] ?? 'application/octet-stream';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: contentType });
}

/**
 * Upload a cutout data URL to the show-photos bucket and return its public URL,
 * cache-busted so judges fetch the new image after a replace. Throws on failure
 * (the caller keeps the local photo and retries on the next change).
 */
export async function uploadCutout(
  showCode: string,
  poseId: string,
  side: Side,
  dataUrl: string,
): Promise<string> {
  const supabase = getSupabaseBrowser();
  const blob = dataUrlToBlob(dataUrl);
  const path = cutoutPath(showCode, poseId, side);
  const { error } = await supabase.storage
    .from(SHOW_PHOTOS_BUCKET)
    .upload(path, blob, { upsert: true, contentType: blob.type || 'image/png' });
  if (error) throw error;
  const { data } = supabase.storage.from(SHOW_PHOTOS_BUCKET).getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}

/** Store photo → manifest entry. Carries positioning metadata verbatim. */
export function toSharedPhoto(photo: AthletePhoto, url: string): SharedPhoto {
  return {
    url,
    face: photo.face,
    body: photo.body,
    pose: photo.pose,
    offsetX: photo.offsetX,
    offsetY: photo.offsetY,
  };
}

/** Manifest entry → store photo. The shared URL becomes the image source. */
export function fromSharedPhoto(shared: SharedPhoto): AthletePhoto {
  return {
    imageUrl: shared.url,
    face: shared.face,
    body: shared.body,
    pose: shared.pose,
    offsetX: shared.offsetX,
    offsetY: shared.offsetY,
  };
}
