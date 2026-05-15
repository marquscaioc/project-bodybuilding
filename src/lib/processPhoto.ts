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

/**
 * The webpack production build mangles @imgly's internal chunk URL
 * resolution (`new __webpack_require__.U(...)` gets a numeric chunk ID
 * and crashes on `.replace`). Dev mode dodges this because it doesn't
 * re-bundle the package. To replicate dev behavior in production we
 * load the package at runtime from esm.sh — a CDN that serves npm
 * packages as native ES modules with bare-import resolution. The
 * import() goes through `new Function` to hide it from webpack's
 * static analysis so it stays a real dynamic import at runtime.
 */
const IMGLY_CDN_ENTRY =
  'https://esm.sh/@imgly/background-removal@1.7.0?bundle';

let imglyPromise: Promise<typeof import('@imgly/background-removal')> | null = null;

function loadImglyFromCdn(): Promise<typeof import('@imgly/background-removal')> {
  if (imglyPromise) return imglyPromise;
  // `new Function` creates a function in global scope; webpack can't
  // statically analyze the import() inside, so it stays a true browser
  // dynamic import at runtime instead of being rewritten to chunk loading.
  const dynamicImport = new Function('u', 'return import(u)') as (
    u: string,
  ) => Promise<unknown>;
  imglyPromise = dynamicImport(IMGLY_CDN_ENTRY).then(
    (mod) => mod as typeof import('@imgly/background-removal'),
  ).catch((err) => {
    imglyPromise = null;
    throw err;
  });
  return imglyPromise;
}

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
    // Load via runtime CDN to bypass production webpack chunk-URL mangling.
    const { removeBackground } = await loadImglyFromCdn();
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

/**
 * When @imgly bg-removal fails (webpack chunk URL bug in production),
 * still run face + pose detection against the raw photo. MediaPipe
 * doesn't go through webpack chunk loading so it works fine. The
 * cutout image will have its original background, but ankle-aligned
 * ground line + face anchoring still apply.
 */
async function rawPhotoFallback(file: File, message: string): Promise<ProcessedPhoto> {
  const cutoutUrl = await blobToDataUrl(file);
  const img = await loadImage(cutoutUrl);
  const w = img.naturalWidth || 1;
  const h = img.naturalHeight || 1;

  // Best-effort detection on the raw image. Either may fail independently;
  // each is wrapped so one failure doesn't kill the other.
  let face = null;
  let pose = null;
  try {
    face = await detectFace(cutoutUrl);
  } catch (e) {
    console.warn('face detection on raw fallback failed', e);
  }
  try {
    pose = await detectPose(cutoutUrl);
  } catch (e) {
    console.warn('pose detection on raw fallback failed', e);
  }

  return {
    cutoutUrl,
    face,
    body: { x: 0, y: 0, width: w, height: h, imgW: w, imgH: h },
    pose,
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
