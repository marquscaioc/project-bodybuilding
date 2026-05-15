'use client';

import type { Pose } from '@/types';
import { loadImage } from './loadImage';

/**
 * Lazy-loaded MediaPipe PoseLandmarker. Lite model (~7MB) is enough for
 * single-image bodybuilder shots and keeps first-load reasonable.
 */
let landmarkerPromise: Promise<import('@mediapipe/tasks-vision').PoseLandmarker> | null =
  null;

const VISION_WASM = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

async function getLandmarker() {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const vision = await import('@mediapipe/tasks-vision');
      const fileset = await vision.FilesetResolver.forVisionTasks(VISION_WASM);
      return vision.PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
        runningMode: 'IMAGE',
        numPoses: 1,
      });
    })().catch((err) => {
      landmarkerPromise = null;
      throw err;
    });
  }
  return landmarkerPromise;
}

/**
 * Detect the primary pose in the cutout. Returns null if MediaPipe finds
 * no body. Coordinates are normalized 0..1 across the source image.
 */
export async function detectPose(imageUrl: string): Promise<Pose | null> {
  const img = await loadImage(imageUrl);
  const landmarker = await getLandmarker();
  const result = landmarker.detect(img);

  if (!result.landmarks?.length) return null;

  const landmarks = result.landmarks[0].map((lm) => ({
    x: lm.x,
    y: lm.y,
    visibility: lm.visibility ?? 0,
  }));

  return { landmarks, imgW: img.naturalWidth, imgH: img.naturalHeight };
}

/** MediaPipe pose landmark indices. */
export const POSE = {
  NOSE: 0,
  LEFT_EYE: 2,
  RIGHT_EYE: 5,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
} as const;

export type Orientation = 'front' | 'side' | 'rear' | 'unknown';

/**
 * Classify whether a body pose is front-, side-, or rear-facing using
 * face-landmark visibility. Used to suggest a default pose tab when
 * importing photos in bulk.
 */
export function classifyOrientation(
  pose: import('@/types').Pose | null | undefined,
): Orientation {
  if (!pose) return 'unknown';
  const nose = pose.landmarks[POSE.NOSE]?.visibility ?? 0;
  const leftEye = pose.landmarks[POSE.LEFT_EYE]?.visibility ?? 0;
  const rightEye = pose.landmarks[POSE.RIGHT_EYE]?.visibility ?? 0;
  const leftEar = pose.landmarks[POSE.LEFT_EAR]?.visibility ?? 0;
  const rightEar = pose.landmarks[POSE.RIGHT_EAR]?.visibility ?? 0;

  const VIS = 0.4;

  // No face landmarks visible → likely a rear view.
  if (nose < VIS && leftEye < VIS && rightEye < VIS) return 'rear';
  // Only one eye/ear visible → side profile.
  const oneEye = (leftEye >= VIS) !== (rightEye >= VIS);
  const oneEar = (leftEar >= VIS) !== (rightEar >= VIS);
  if (oneEye || oneEar) return 'side';
  return 'front';
}

/**
 * Suggest a pose-tab ID from an orientation. Generic — the user picks
 * the specific pose (FDB vs FLS, SC vs ST, RDB vs RLS) on the import
 * dialog before confirming.
 */
export function defaultPoseForOrientation(o: Orientation): string {
  switch (o) {
    case 'front':
      return 'FDB';
    case 'side':
      return 'SC';
    case 'rear':
      return 'RDB';
    default:
      return 'FDB';
  }
}
