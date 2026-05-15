'use client';

import type { BodyBox, FaceBox, Pose } from '@/types';
import { detectFace } from './faceDetect';
import { detectPose } from './poseDetect';
import { loadImage } from './loadImage';

export type ProcessedPhoto = {
  /** data: URL of the background-removed cutout (transparent PNG), OR
   *  the raw image data URL when the AI pipeline failed (see aiFailed). */
  cutoutUrl: string;
  /** Face bounding box in cutout pixel coordinates, or null if undetected. */
  face: FaceBox | null;
  /** Tight bounding box around the visible subject (full image when AI failed). */
  body: BodyBox;
  /** 33 MediaPipe pose landmarks, or null if no body detected. */
  pose: Pose | null;
  /** True when bg-removal / face / pose all failed and we're showing the raw photo. */
  aiFailed?: boolean;
  /** Diagnostic message when aiFailed = true. */
  aiError?: string;
};

export type ProgressStage =
  | 'removing-bg'
  | 'measuring-body'
  | 'detecting-face'
  | 'detecting-pose'
  | 'done';

/**
 * Pin the model + WASM CDN explicitly so @imgly/background-removal
 * doesn't try to derive the path via import.meta.url (which webpack-
 * bundled chunks resolve unpredictably). Latest known-good is 1.7.0.
 */
const IMGLY_PUBLIC_PATH =
  'https://staticimgly.com/@imgly/background-removal-data/1.7.0/dist/';

export async function processPhoto(
  file: File,
  onProgress?: (stage: ProgressStage) => void,
): Promise<ProcessedPhoto> {
  // Quick environment check — WASM is required by every model below.
  if (typeof WebAssembly === 'undefined') {
    onProgress?.('done');
    return await rawPhotoFallback(file, 'WebAssembly not available in this browser');
  }

  try {
    onProgress?.('removing-bg');
    const { removeBackground } = await import('@imgly/background-removal');
    const cutoutBlob = await removeBackground(file, {
      publicPath: IMGLY_PUBLIC_PATH,
      debug: false,
      // Run inference on the main thread instead of spawning a Web Worker —
      // production webpack mangles the worker URL constructor (`new d.U` in
      // the trace), causing TypeError: e.replace is not a function.
      proxyToWorker: false,
      device: 'cpu',
      progress: (key, current, total) => {
        if (current === total) console.info(`[imgly] loaded ${key}`);
      },
    });
    const cutoutUrl = await blobToDataUrl(cutoutBlob);

    onProgress?.('measuring-body');
    const body = await computeBodyBoundingBox(cutoutUrl);

    onProgress?.('detecting-face');
    const face = await detectFace(cutoutUrl);

    onProgress?.('detecting-pose');
    const pose = await detectPose(cutoutUrl);

    onProgress?.('done');
    return { cutoutUrl, face, body, pose };
  } catch (err) {
    console.warn('AI processing failed, using raw photo as fallback', err);
    onProgress?.('done');
    return await rawPhotoFallback(file, (err as Error)?.message ?? String(err));
  }
}

async function rawPhotoFallback(file: File, message: string): Promise<ProcessedPhoto> {
  const cutoutUrl = await blobToDataUrl(file);
  const img = await loadImage(cutoutUrl);
  const w = img.naturalWidth || 1;
  const h = img.naturalHeight || 1;
  return {
    cutoutUrl,
    face: null,
    body: { x: 0, y: 0, width: w, height: h, imgW: w, imgH: h },
    pose: null,
    aiFailed: true,
    aiError: message,
  };
}

/**
 * Scan the cutout's alpha channel and return the tight bounding box
 * around all visible (non-transparent) pixels. Used as a fallback when
 * pose/face detection fails.
 */
async function computeBodyBoundingBox(dataUrl: string): Promise<BodyBox> {
  const img = await loadImage(dataUrl);
  const w = img.naturalWidth;
  const h = img.naturalHeight;

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: false });
  if (!ctx) {
    return { x: 0, y: 0, width: w, height: h, imgW: w, imgH: h };
  }
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, w, h).data;

  const ALPHA_THRESHOLD = 24;
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < h; y++) {
    const rowStart = y * w * 4;
    for (let x = 0; x < w; x++) {
      const a = data[rowStart + x * 4 + 3];
      if (a > ALPHA_THRESHOLD) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0) {
    return { x: 0, y: 0, width: w, height: h, imgW: w, imgH: h };
  }

  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
    imgW: w,
    imgH: h,
  };
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('Failed to read processed blob'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('FileReader error'));
    reader.readAsDataURL(blob);
  });
}
