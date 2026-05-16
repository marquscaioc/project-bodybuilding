/**
 * A bounding box in original image pixels, with the source image's
 * natural dimensions captured so we can compute scale factors later.
 */
export type BBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  imgW: number;
  imgH: number;
};

/** Face bounding box (forehead to chin), used as the head-size metric. */
export type FaceBox = BBox;

/** Tight bounding box around the visible subject in a bg-removed cutout. */
export type BodyBox = BBox;

/**
 * Single MediaPipe pose landmark.
 * x, y are normalized to 0..1 across the source image.
 * visibility is the model's confidence the landmark is in-frame and unoccluded.
 */
export type PoseLandmark = { x: number; y: number; visibility: number };

/**
 * Full body pose: 33 MediaPipe landmarks.
 * Useful indices: 11=L_shoulder, 12=R_shoulder, 23=L_hip, 24=R_hip,
 * 25=L_knee, 26=R_knee, 27=L_ankle, 28=R_ankle.
 */
export type Pose = {
  landmarks: PoseLandmark[];
  imgW: number;
  imgH: number;
};

/**
 * One processed photo: bg-removed cutout + detection metadata.
 * Stored per pose under Athlete.photos so each athlete can have a
 * distinct photo for FDB, SC, RDB, etc.
 */
export type AthletePhoto = {
  /** data: URL of the bg-removed cutout (transparent PNG). */
  imageUrl: string;
  face?: FaceBox;
  body?: BodyBox;
  /** MediaPipe BodyPose landmarks for this photo (not the pose category). */
  pose?: Pose;
  /** Manual X offset added to the auto-positioned cutout, as a fraction of slot width. */
  offsetX?: number;
  /** Manual Y offset added to the auto-positioned cutout, as a fraction of slot height. */
  offsetY?: number;
};

export type Athlete = {
  name: string;
  /** Real-world height in centimeters. */
  heightCm?: number;
  /** 'auto' = looked up from web; 'manual' = user-edited. Manual values are sticky. */
  heightSource?: 'auto' | 'manual';
  /** Manual size multiplier on top of auto-fit (default 1.0; range 0.5–1.5). */
  sizeAdjust?: number;
  /** Photos keyed by pose ID (FDB, FLS, SC, RDB, RLS, ST, AB+T, MM). */
  photos?: Record<string, AthletePhoto>;
};

export type RowType = 'pose' | 'category';

export type Side = 'A' | 'B';

export type Margin = 1 | 2 | 3 | 4;

export type Outcome = Side | 'tie';

export type Row = {
  id: string;
  label: string;
  type: RowType;
  winner: Outcome | null;
  margin: Margin | null;
};

/**
 * Auto-sizing strategy for the comparison stage.
 *  - 'auto' (default): pose + body bbox when bg-removal succeeded; head fallback when it didn't.
 *  - 'head': always scale by detected face height (crop-invariant). Falls back to body bbox if no face was detected.
 */
export type SizeMode = 'auto' | 'head';

export type Match = {
  athleteA: Athlete;
  athleteB: Athlete;
  rows: Row[];
  /** Which pose tab is currently displayed in the comparison stage. */
  currentPoseId: string;
  /** How both athletes should be auto-sized. Defaults to 'auto'. */
  sizeMode?: SizeMode;
};
