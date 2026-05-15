'use client';

import type { FaceBox } from '@/types';
import { loadImage } from './loadImage';

/**
 * Lazy-loaded MediaPipe face detector. The vision module + WASM runtime
 * are downloaded only the first time a user uploads a photo, so the
 * initial page bundle stays small.
 */
let detectorPromise: Promise<import('@mediapipe/tasks-vision').FaceDetector> | null = null;

const VISION_WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite';

async function getDetector() {
  if (!detectorPromise) {
    detectorPromise = (async () => {
      const vision = await import('@mediapipe/tasks-vision');
      const fileset = await vision.FilesetResolver.forVisionTasks(VISION_WASM);
      return vision.FaceDetector.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
        runningMode: 'IMAGE',
        minDetectionConfidence: 0.4,
      });
    })().catch((err) => {
      detectorPromise = null;
      throw err;
    });
  }
  return detectorPromise;
}

/**
 * Detect the largest face in an image. Returns null if no face is detected.
 * Coordinates are in original image pixels (not normalized).
 */
export async function detectFace(imageUrl: string): Promise<FaceBox | null> {
  const img = await loadImage(imageUrl);
  const detector = await getDetector();
  const result = detector.detect(img);

  if (!result.detections.length) return null;

  // Pick the largest detection — handles photos with judges/audience in frame.
  const largest = result.detections.reduce((best, d) => {
    const a = d.boundingBox?.width ?? 0;
    const b = best.boundingBox?.width ?? 0;
    return a * (d.boundingBox?.height ?? 0) > b * (best.boundingBox?.height ?? 0) ? d : best;
  });

  const box = largest.boundingBox;
  if (!box) return null;

  return {
    x: box.originX,
    y: box.originY,
    width: box.width,
    height: box.height,
    imgW: img.naturalWidth,
    imgH: img.naturalHeight,
  };
}

