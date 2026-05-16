'use client';

import { useEffect, useRef, useState } from 'react';
import clsx from 'clsx';
import type { Athlete, BodyBox, FaceBox, Pose, Side, SizeMode } from '@/types';
import { useScorecard } from '@/lib/store';
import { processPhoto, type ProgressStage } from '@/lib/processPhoto';
import { POSE } from '@/lib/poseDetect';
import { POSES } from '@/lib/constants';
import { useHeightLookup } from '@/lib/useHeightLookup';
import { ImporterDialog } from './ImporterDialog';

/**
 * Sizing model:
 *  1. Auto-fit:  scale each cutout's body bounding box to fill BODY_FILL_FRAC
 *                of the slot vertically — bodies fill the frame head-to-toe.
 *  2. Height ratio: when both real-world heights are known, multiply the
 *                shorter athlete's scale by `myHeight / max(heightA, heightB)`,
 *                so the taller one visibly stands taller.
 *  3. Manual:    each athlete has a `sizeAdjust` slider (0.5–1.5) for fine
 *                nudges on top of the auto-fit + height-ratio result.
 *
 * Athletes are ground-aligned to the stage floor and pulled inward toward
 * the centerline so they read as a real lineup, not two solo shots.
 */
const BODY_FILL_FRAC = 0.82;
/** Fallback: body bbox bottom anchors here when no face/pose. */
const GROUND_LINE = 0.97;
/** Fallback: face center anchors here when pose isn't detected. */
const HEAD_VERTICAL_POS = 0.13;
/**
 * Head-as-metric scale: face height as a fraction of slot height.
 * Combined with the heightCm ratio multiplier on top.
 */
const FACE_AS_METRIC_FRAC = 0.10;
/**
 * Pose torso (shoulder→hip) target as a fraction of slot height.
 * Torso ≈ 28-30% of full body height, body fills 82% of slot
 * → torso fills ≈ 0.24 of slot.
 */
const TORSO_FRAC = 0.24;

/** Minimum visibility for a MediaPipe pose landmark to be trusted (0..1). */
const POSE_MIN_VIS = 0.35;
/**
 * Horizontal pull toward the stage centerline (0 = centered in own slot, 0.5 = on the divider).
 * Higher values put the two athletes shoulder-to-shoulder on the centerline.
 */
const BODY_INWARD_BIAS = 0.08;
/** Manual size slider bounds. */
const SIZE_MIN = 0.5;
const SIZE_MAX = 1.5;
const SIZE_STEP = 0.02;

export function AthletePhotos() {
  const [importerOpen, setImporterOpen] = useState(false);
  const sizeMode = useScorecard((s) => s.sizeMode ?? 'auto');
  const setSizeMode = useScorecard((s) => s.setSizeMode);

  return (
    <section
      aria-label="Athlete comparison stage"
      className="relative isolate w-full overflow-hidden border border-[var(--rule)] bg-black"
    >
      {/* Shared stage backdrop spans the whole comparison area. */}
      <div
        aria-hidden
        className="absolute inset-0 bg-cover bg-center opacity-90"
        style={{ backgroundImage: 'url(/backgrounds/detroit.png)' }}
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-black/60"
      />

      <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 border-b border-[var(--rule)] bg-black/70 px-3 py-2 backdrop-blur">
        <span className="font-display text-[0.65rem] uppercase tracking-[0.3em] text-[var(--fg-dim)]">
          Comparison Stage
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <SizeModeToggle value={sizeMode} onChange={setSizeMode} />
          <button
            type="button"
            onClick={() => setImporterOpen(true)}
            className="border border-[var(--accent)] bg-transparent px-3 py-1 font-display text-[0.65rem] uppercase tracking-[0.25em] text-[var(--accent)] transition hover:bg-[var(--accent)] hover:text-[var(--strip-fg)]"
          >
            Import from gallery URL
          </button>
        </div>
      </div>

      <PoseTabs />

      <div className="relative grid grid-cols-2 gap-px aspect-[16/10] sm:aspect-[16/9]">
        <PhotoSlot side="A" />
        <PhotoSlot side="B" />

        <div className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2">
          <span className="rounded border border-[var(--accent)]/60 bg-black/60 px-3 py-1 font-display text-sm uppercase tracking-[0.4em] text-[var(--accent)] backdrop-blur-sm sm:text-base">
            vs
          </span>
        </div>
      </div>

      <NameStrip />

      <ImporterDialog open={importerOpen} onClose={() => setImporterOpen(false)} />
    </section>
  );
}

/**
 * Horizontal tab strip for the 8 mandatory poses. Each tab shows two
 * indicator dots — A and B — that fill in once a photo is uploaded for
 * that side at that pose.
 */
function PoseTabs() {
  const currentPoseId = useScorecard((s) => s.currentPoseId);
  const setCurrentPose = useScorecard((s) => s.setCurrentPose);
  const photosA = useScorecard((s) => s.athleteA.photos);
  const photosB = useScorecard((s) => s.athleteB.photos);

  return (
    <div className="relative z-10 flex flex-wrap items-stretch border-b border-[var(--rule)] bg-black/70 backdrop-blur">
      {POSES.map((pose) => {
        const active = pose.id === currentPoseId;
        const hasA = !!photosA?.[pose.id];
        const hasB = !!photosB?.[pose.id];
        return (
          <button
            key={pose.id}
            type="button"
            onClick={() => setCurrentPose(pose.id)}
            title={pose.label}
            className={clsx(
              'group flex flex-1 min-w-[60px] flex-col items-center justify-center gap-1 border-r border-[var(--rule)] px-2 py-2 transition last:border-r-0',
              active
                ? 'bg-[var(--accent)] text-[var(--strip-fg)]'
                : 'text-[var(--fg-dim)] hover:bg-white/5 hover:text-[var(--fg)]',
            )}
          >
            <span className="font-display text-xs uppercase tracking-[0.18em] sm:text-sm">
              {pose.short}
            </span>
            <span className="flex items-center gap-1">
              <Dot filled={hasA} active={active} side="A" />
              <Dot filled={hasB} active={active} side="B" />
            </span>
          </button>
        );
      })}
    </div>
  );
}

function Dot({
  filled,
  active,
  side,
}: {
  filled: boolean;
  active: boolean;
  side: Side;
}) {
  const sideColor = side === 'A' ? 'var(--side-a)' : 'var(--side-b)';
  return (
    <span
      aria-hidden
      className={clsx(
        'inline-block h-1.5 w-1.5 rounded-full border',
        active ? 'border-[var(--strip-fg)]/60' : 'border-current opacity-50',
      )}
      style={filled ? { background: sideColor, borderColor: sideColor } : undefined}
    />
  );
}

function PhotoSlot({ side }: { side: Side }) {
  const athlete = useScorecard((s) => (side === 'A' ? s.athleteA : s.athleteB));
  const currentPoseId = useScorecard((s) => s.currentPoseId);
  const setPhoto = useScorecard((s) => s.setPhoto);
  const clearPhoto = useScorecard((s) => s.clearPhoto);
  const setPhotoOffset = useScorecard((s) => s.setPhotoOffset);

  const photo = athlete.photos?.[currentPoseId];

  const inputRef = useRef<HTMLInputElement>(null);
  const slotRef = useRef<HTMLDivElement>(null);
  const [fileDragging, setFileDragging] = useState(false);
  const [progress, setProgress] = useState<ProgressStage | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Pointer-based drag-to-reposition.
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    baseOffsetX: number;
    baseOffsetY: number;
    didDrag: boolean;
  } | null>(null);
  const [livePreview, setLivePreview] = useState<{ x: number; y: number } | null>(
    null,
  );
  const DRAG_THRESHOLD_PX = 5;

  function handlePointerDown(e: React.PointerEvent) {
    if (!photo || isLoading) return;
    dragStateRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      baseOffsetX: photo.offsetX ?? 0,
      baseOffsetY: photo.offsetY ?? 0,
      didDrag: false,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent) {
    const ds = dragStateRef.current;
    if (!ds || ds.pointerId !== e.pointerId) return;
    const dx = e.clientX - ds.startX;
    const dy = e.clientY - ds.startY;
    if (!ds.didDrag && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
    ds.didDrag = true;
    const rect = slotRef.current?.getBoundingClientRect();
    if (!rect) return;
    setLivePreview({
      x: ds.baseOffsetX + dx / rect.width,
      y: ds.baseOffsetY + dy / rect.height,
    });
  }

  function handlePointerUp(e: React.PointerEvent) {
    const ds = dragStateRef.current;
    if (!ds || ds.pointerId !== e.pointerId) return;
    if (ds.didDrag && livePreview) {
      setPhotoOffset(side, currentPoseId, livePreview.x, livePreview.y);
    }
    dragStateRef.current = null;
    setLivePreview(null);
  }

  function resetOffset(e: React.MouseEvent) {
    e.stopPropagation();
    setPhotoOffset(side, currentPoseId, undefined, undefined);
  }

  async function handleFile(file: File | undefined) {
    if (!file || !file.type.startsWith('image/')) return;
    setError(null);
    setProgress('removing-bg');
    const targetPoseId = currentPoseId;
    try {
      const { cutoutUrl, face, body, pose, aiFailed, aiError } = await processPhoto(
        file,
        setProgress,
      );
      setPhoto(side, targetPoseId, {
        imageUrl: cutoutUrl,
        face: face ?? undefined,
        body,
        pose: pose ?? undefined,
      });
      if (aiFailed) {
        setError(`AI unavailable (${aiError}) — uploaded raw. Disable wallet extensions or try Incognito.`);
      }
    } catch (e) {
      console.error(e);
      setError('Processing failed — try another photo');
    } finally {
      setProgress(null);
    }
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation();
    clearPhoto(side, currentPoseId);
  }

  const isLoading = progress !== null;
  const hasImage = !!photo?.imageUrl;

  // Live offset = drag preview while dragging, else committed value from store.
  const liveOffsetX = livePreview?.x ?? photo?.offsetX ?? 0;
  const liveOffsetY = livePreview?.y ?? photo?.offsetY ?? 0;
  const isOffsetActive =
    Math.abs(liveOffsetX) > 0.001 || Math.abs(liveOffsetY) > 0.001;

  return (
    <div
      ref={slotRef}
      onClick={() => {
        if (isLoading || hasImage) return;
        inputRef.current?.click();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!isLoading) setFileDragging(true);
      }}
      onDragLeave={() => setFileDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setFileDragging(false);
        if (!isLoading) handleFile(e.dataTransfer.files?.[0]);
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      className={clsx(
        'group relative h-full w-full overflow-hidden transition select-none',
        hasImage
          ? livePreview
            ? 'cursor-grabbing'
            : 'cursor-grab'
          : 'cursor-pointer',
        fileDragging && 'ring-2 ring-[var(--accent)]',
      )}
      role="button"
      tabIndex={0}
      aria-label={
        hasImage ? `Drag to reposition ${athlete.name}` : `Upload photo for ${athlete.name}`
      }
    >
      {hasImage ? (
        <ScaledCutout
          imageUrl={photo!.imageUrl}
          body={photo!.body}
          face={photo!.face}
          pose={photo!.pose}
          side={side}
          offsetX={liveOffsetX}
          offsetY={liveOffsetY}
        />
      ) : (
        <EmptyState side={side} />
      )}

      {isLoading && <LoadingOverlay stage={progress} />}

      {hasImage && !isLoading && (
        <div className="pointer-events-none absolute right-2 top-2 flex gap-1 opacity-0 transition group-hover:opacity-100">
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              inputRef.current?.click();
            }}
            className="pointer-events-auto border border-white/40 bg-black/70 px-2 py-1 font-display text-[0.6rem] uppercase tracking-[0.25em] text-white hover:bg-white hover:text-black"
          >
            Replace
          </button>
          {isOffsetActive && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={resetOffset}
              title="Reset position"
              className="pointer-events-auto border border-white/40 bg-black/70 px-2 py-1 font-display text-[0.6rem] uppercase tracking-[0.25em] text-white hover:bg-white hover:text-black"
            >
              Reset pos
            </button>
          )}
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={clear}
            className="pointer-events-auto border border-white/40 bg-black/70 px-2 py-1 font-display text-[0.6rem] uppercase tracking-[0.25em] text-white hover:bg-[var(--accent)] hover:text-black"
          >
            Remove
          </button>
        </div>
      )}

      {hasImage && !isLoading && (
        <div className="pointer-events-none absolute bottom-2 left-2 font-display text-[0.55rem] uppercase tracking-[0.25em] text-white/40 opacity-0 transition group-hover:opacity-100">
          drag to nudge
        </div>
      )}

      {error && !isLoading && (
        <div className="absolute inset-x-0 bottom-0 bg-[var(--accent)]/80 px-3 py-1 text-center text-[0.65rem] uppercase tracking-[0.25em] text-black">
          {error}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0])}
      />
    </div>
  );
}

/**
 * Render the cutout with a CSS transform so the body bounding box fits
 * the slot vertically (per BODY_FILL_FRAC), gets shrunk by the height ratio
 * if both real heights are known, and then nudged by the manual sizeAdjust.
 * The cutout is ground-aligned to GROUND_LINE and pulled toward the
 * stage centerline by BODY_INWARD_BIAS.
 */
function ScaledCutout({
  imageUrl,
  body,
  face,
  pose,
  side,
  offsetX = 0,
  offsetY = 0,
}: {
  imageUrl: string;
  body?: BodyBox;
  face?: FaceBox;
  pose?: Pose;
  side: Side;
  /** X offset in slot-width fractions (added on top of auto-position). */
  offsetX?: number;
  /** Y offset in slot-height fractions (added on top of auto-position). */
  offsetY?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  const heightA = useScorecard((s) => s.athleteA.heightCm);
  const heightB = useScorecard((s) => s.athleteB.heightCm);
  const sizeAdjust = useScorecard((s) =>
    side === 'A' ? s.athleteA.sizeAdjust ?? 1 : s.athleteB.sizeAdjust ?? 1,
  );
  const sizeMode = useScorecard((s) => s.sizeMode ?? 'auto');

  useResizeObserver(containerRef, (entry) =>
    setSize({ w: entry.contentRect.width, h: entry.contentRect.height }),
  );

  let transform = '';
  let imgWidth: number | undefined;
  let imgHeight: number | undefined;
  let positioned = false;
  /** Debug badge: AUTO·N (N metrics blended) or HEAD. */
  let strategy: string | null = null;
  // Manual nudge applied on top of every strategy.
  const manualTx = size ? offsetX * size.w : 0;
  const manualTy = size ? offsetY * size.h : 0;

  if (size && size.w > 0 && size.h > 0) {
    const heightRatio =
      heightA && heightB
        ? (side === 'A' ? heightA : heightB) / Math.max(heightA, heightB)
        : 1;

    const poseAnchor = pose ? extractPoseAnchor(pose) : null;
    // Raw-photo body bbox (no bg removal — covers full image). Body height
    // would equal the photo crop, so it's unreliable as a scale metric.
    const isRawPhotoBbox =
      !!body && body.x === 0 && body.y === 0 &&
      body.width === body.imgW && body.height === body.imgH;

    // Two classes of measurements:
    //
    // DIRECT: pixel-perfect estimates of the subject's full body height
    // in the source image. These agree across athletes regardless of
    // individual head/torso proportions, so they can be safely blended
    // for denoising.
    //   - body bbox height   (when bg removal gave a real cutout)
    //   - pose head-to-ankle (face bbox top → ankle midpoint)
    //
    // PROPORTIONAL: scales derived by assuming a fixed body→part ratio
    // (face ≈ 10% of body height, torso ≈ 24%). The assumption is rough
    // and varies between people — using these as primary scale makes
    // athletes with bigger/smaller heads render proportionally larger or
    // smaller. So they only fire when no DIRECT estimate is available
    // (e.g. raw-photo fallback with no pose ankles).
    const directBodyHeights: Array<{ name: string; px: number }> = [];

    if (body && !isRawPhotoBbox && body.height > 0) {
      directBodyHeights.push({ name: 'body', px: body.height });
    }
    if (poseAnchor && poseAnchor.ankleMidY != null && face) {
      const headToAnkle = poseAnchor.ankleMidY - face.y;
      if (headToAnkle > 0) {
        directBodyHeights.push({ name: 'h2a', px: headToAnkle });
      }
    }

    let baseScale: number | null = null;

    if (sizeMode === 'head' && face && face.height > 0) {
      // Forced head-as-metric. Useful when AUTO blends across photos
      // with very different crops and you want to anchor on heads only.
      baseScale = (size.h * FACE_AS_METRIC_FRAC) / face.height;
      strategy = 'HEAD';
    } else if (directBodyHeights.length > 0) {
      // Geometric mean of direct body-height estimates → denoised body
      // height, then scaled so the body fills BODY_FILL_FRAC of the slot.
      const meanBodyHeightPx = geometricMean(
        directBodyHeights.map((d) => d.px),
      );
      baseScale = (size.h * BODY_FILL_FRAC) / meanBodyHeightPx;
      strategy =
        directBodyHeights.length > 1
          ? `AUTO·${directBodyHeights.map((d) => d.name).join('+')}`
          : `AUTO·${directBodyHeights[0].name}`;
    } else {
      // No direct body-height measurement — fall back to proportional
      // metrics. This branch hits when bg removal failed AND we don't
      // have face+ankles to triangulate. We blend whatever's left so a
      // raw-photo upload still gets reasonable sizing.
      const proportional: number[] = [];
      if (face && face.height > 0) {
        proportional.push((size.h * FACE_AS_METRIC_FRAC) / face.height);
      }
      if (poseAnchor && poseAnchor.torsoLength > 0) {
        proportional.push((size.h * TORSO_FRAC) / poseAnchor.torsoLength);
      }
      if (proportional.length > 0) {
        baseScale = geometricMean(proportional);
        strategy = `FALLBACK·${proportional.length}`;
      }
    }

    if (baseScale != null) {
      const scale = baseScale * heightRatio * sizeAdjust;

      // Use whichever source has imgW/imgH (all should match for a given photo).
      const imgW = body?.imgW ?? face?.imgW ?? pose?.imgW ?? size.w;
      const imgH = body?.imgH ?? face?.imgH ?? pose?.imgH ?? size.h;
      imgWidth = imgW * scale;
      imgHeight = imgH * scale;

      // Vertical: ankle midpoint > body bbox bottom > face anchor.
      let ty: number;
      if (poseAnchor?.ankleMidY != null) {
        ty = size.h * GROUND_LINE - poseAnchor.ankleMidY * scale;
      } else if (body && !isRawPhotoBbox) {
        ty = size.h * GROUND_LINE - (body.y + body.height) * scale;
      } else if (face) {
        ty = size.h * HEAD_VERTICAL_POS - (face.y + face.height / 2) * scale;
      } else {
        ty = 0;
      }

      // Horizontal: body bbox center > face center > image center.
      let centerXImgPx: number;
      if (body && !isRawPhotoBbox) {
        centerXImgPx = body.x + body.width / 2;
      } else if (face) {
        centerXImgPx = face.x + face.width / 2;
      } else {
        centerXImgPx = imgW / 2;
      }
      const targetX =
        side === 'A'
          ? size.w * (0.5 + BODY_INWARD_BIAS)
          : size.w * (0.5 - BODY_INWARD_BIAS);
      const tx = targetX - centerXImgPx * scale;

      transform = `translate(${tx + manualTx}px, ${ty + manualTy}px)`;
      positioned = true;
    }
  }

  return (
    <div ref={containerRef} className="absolute inset-0">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt=""
        className={clsx(
          'absolute left-0 top-0 select-none',
          !positioned && 'h-full w-full object-contain object-bottom',
        )}
        style={
          positioned
            ? {
                width: imgWidth,
                height: imgHeight,
                transform,
                transformOrigin: '0 0',
              }
            : undefined
        }
        draggable={false}
      />
      {/* Subtle ground shadow so the cutout grounds onto the stage. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/80 to-transparent"
      />
      <span
        aria-hidden
        className={clsx(
          'pointer-events-none absolute left-3 top-3 font-display text-3xl uppercase tracking-[0.3em] sm:text-4xl',
          side === 'A' ? 'text-[var(--side-a)]' : 'text-[var(--side-b)]',
        )}
      >
        {side}
      </span>
      {strategy && (
        <span
          aria-hidden
          className="pointer-events-none absolute right-3 top-3 border border-white/30 bg-black/60 px-1.5 py-0.5 font-display text-[0.55rem] uppercase tracking-[0.25em] text-[var(--fg-dim)] backdrop-blur-sm"
          title={`Alignment strategy: ${strategy}`}
        >
          {strategy}
        </span>
      )}
    </div>
  );
}

/**
 * Two-state pill toggle for the stage-wide sizing strategy.
 * AUTO blends every detected metric (body bbox, face, pose torso, pose
 * head-to-ankle). HEAD forces face-as-metric for crop-invariant sizing
 * when the auto blend pushes one athlete bigger than the other.
 */
function SizeModeToggle({
  value,
  onChange,
}: {
  value: SizeMode;
  onChange: (mode: SizeMode) => void;
}) {
  const options: Array<{ id: SizeMode; label: string; hint: string }> = [
    { id: 'auto', label: 'Auto', hint: 'Blend body + face + pose' },
    { id: 'head', label: 'Head', hint: 'Force head-as-metric (crop-invariant)' },
  ];
  return (
    <div
      role="group"
      aria-label="Auto-sizing strategy"
      className="inline-flex items-center border border-[var(--rule)] bg-black/40"
    >
      <span className="border-r border-[var(--rule)] px-2 py-1 font-display text-[0.55rem] uppercase tracking-[0.3em] text-[var(--fg-mute)]">
        Auto-size
      </span>
      {options.map((o) => {
        const active = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            title={o.hint}
            aria-pressed={active}
            className={clsx(
              'px-2.5 py-1 font-display text-[0.6rem] uppercase tracking-[0.25em] transition',
              active
                ? 'bg-[var(--accent)] text-[var(--strip-fg)]'
                : 'text-[var(--fg-dim)] hover:text-[var(--fg)]',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Geometric mean of positive numbers. Robust to a single outlier
 * candidate dragging the result far from the cluster — exp(mean(log(x)))
 * downweights extremes vs. arithmetic mean.
 */
function geometricMean(values: number[]): number {
  if (values.length === 0) return 0;
  let logSum = 0;
  for (const v of values) logSum += Math.log(v);
  return Math.exp(logSum / values.length);
}

/**
 * Pull a usable shoulder/torso/ankle anchor out of the pose landmarks.
 * Returns null if shoulder or hip aren't detected; ankle is optional
 * (some photos crop at the tibia and won't have visible ankles).
 */
function extractPoseAnchor(pose: Pose): {
  shoulderMidX: number;
  shoulderMidY: number;
  torsoLength: number;
  /** Average ankle Y in image pixels, or null if ankles aren't visible. */
  ankleMidY: number | null;
  imgW: number;
  imgH: number;
} | null {
  const ls = pose.landmarks[POSE.LEFT_SHOULDER];
  const rs = pose.landmarks[POSE.RIGHT_SHOULDER];
  const lh = pose.landmarks[POSE.LEFT_HIP];
  const rh = pose.landmarks[POSE.RIGHT_HIP];
  if (!ls || !rs || !lh || !rh) return null;
  if (
    ls.visibility < POSE_MIN_VIS ||
    rs.visibility < POSE_MIN_VIS ||
    lh.visibility < POSE_MIN_VIS ||
    rh.visibility < POSE_MIN_VIS
  )
    return null;

  const shoulderMidX = ((ls.x + rs.x) / 2) * pose.imgW;
  const shoulderMidY = ((ls.y + rs.y) / 2) * pose.imgH;
  const hipMidY = ((lh.y + rh.y) / 2) * pose.imgH;
  const torsoLength = Math.abs(hipMidY - shoulderMidY);
  if (torsoLength < 8) return null; // sanity guard

  // Ankles: pick the LOWER (greater Y) of the visible ankles — that's the
  // planted foot in side poses (SC, ST) where one foot is forward/raised.
  // Falls back to the only-visible one if just one ankle is in frame.
  const la = pose.landmarks[POSE.LEFT_ANKLE];
  const ra = pose.landmarks[POSE.RIGHT_ANKLE];
  const ankleYs: number[] = [];
  if (la && la.visibility >= POSE_MIN_VIS) ankleYs.push(la.y * pose.imgH);
  if (ra && ra.visibility >= POSE_MIN_VIS) ankleYs.push(ra.y * pose.imgH);
  const ankleMidY = ankleYs.length > 0 ? Math.max(...ankleYs) : null;

  return {
    shoulderMidX,
    shoulderMidY,
    torsoLength,
    ankleMidY,
    imgW: pose.imgW,
    imgH: pose.imgH,
  };
}

function EmptyState({ side }: { side: Side }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 border border-dashed border-[var(--rule-strong)]/40 bg-black/40 p-6 text-center">
      <span
        className={clsx(
          'font-display text-7xl leading-none drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]',
          side === 'A' ? 'text-[var(--side-a)]' : 'text-[var(--side-b)]',
        )}
      >
        {side}
      </span>
      <span className="font-display text-sm uppercase tracking-[0.3em] text-[var(--fg)]">
        Drop photo or click
      </span>
      <span className="text-[0.6rem] uppercase tracking-[0.25em] text-[var(--fg-dim)]">
        Background removed automatically
      </span>
    </div>
  );
}

function LoadingOverlay({ stage }: { stage: ProgressStage | null }) {
  const label =
    stage === 'removing-bg'
      ? 'Removing background…'
      : stage === 'measuring-body'
        ? 'Measuring body…'
        : stage === 'detecting-face'
          ? 'Measuring head size…'
          : stage === 'detecting-pose'
            ? 'Detecting pose…'
            : 'Working…';
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-black/80 backdrop-blur-sm">
      <Spinner />
      <span className="font-display text-xs uppercase tracking-[0.3em] text-[var(--fg)]">
        {label}
      </span>
      <span className="text-[0.6rem] uppercase tracking-[0.25em] text-[var(--fg-mute)]">
        First run downloads model (~80MB)
      </span>
    </div>
  );
}

function Spinner() {
  return (
    <span
      aria-label="Processing"
      className="inline-block h-7 w-7 animate-spin rounded-full border-2 border-[var(--fg-mute)] border-t-[var(--accent)]"
    />
  );
}

function NameStrip() {
  const athleteA = useScorecard((s) => s.athleteA);
  const athleteB = useScorecard((s) => s.athleteB);
  return (
    <div className="relative grid grid-cols-2 border-t border-[var(--rule)] bg-black/80 backdrop-blur">
      <NameCell side="A" athlete={athleteA} />
      <NameCell side="B" athlete={athleteB} />
    </div>
  );
}

function NameCell({ side, athlete }: { side: Side; athlete: Athlete }) {
  const setHeight = useScorecard((s) => s.setHeight);
  const lookupEnabled = athlete.heightSource !== 'manual';
  const lookup = useHeightLookup(athlete.name, lookupEnabled, (cm) =>
    setHeight(side, cm, 'auto'),
  );

  const isB = side === 'B';
  return (
    <div
      className={clsx(
        'flex flex-col gap-2 px-4 py-3',
        isB && 'border-l border-[var(--rule)] items-end',
      )}
    >
      <div
        className={clsx(
          'flex flex-wrap items-center gap-2',
          isB ? 'flex-row-reverse' : 'flex-row',
        )}
      >
        <span
          className={clsx(
            'font-display text-base uppercase tracking-[0.25em] sm:text-lg',
            isB ? 'text-[var(--side-b)]' : 'text-[var(--side-a)]',
          )}
        >
          {athlete.name}
        </span>
        <HeightChip
          side={side}
          athlete={athlete}
          lookupStatus={lookup.status}
          wikiPage={lookup.status === 'found' ? lookup.page : undefined}
        />
      </div>
      <SizeAdjuster side={side} value={athlete.sizeAdjust ?? 1} reversed={isB} />
    </div>
  );
}

function SizeAdjuster({
  side,
  value,
  reversed,
}: {
  side: Side;
  value: number;
  reversed: boolean;
}) {
  const setSizeAdjust = useScorecard((s) => s.setSizeAdjust);
  const isAdjusted = Math.abs(value - 1) > 0.001;

  function bump(delta: number) {
    const next = Math.min(SIZE_MAX, Math.max(SIZE_MIN, +(value + delta).toFixed(2)));
    setSizeAdjust(side, next);
  }

  return (
    <div
      className={clsx(
        'flex items-center gap-1.5 text-[var(--fg-dim)]',
        reversed && 'flex-row-reverse',
      )}
    >
      <span className="font-display text-[0.55rem] uppercase tracking-[0.3em] text-[var(--fg-mute)]">
        Size
      </span>
      <button
        type="button"
        onClick={() => bump(-SIZE_STEP)}
        disabled={value <= SIZE_MIN + 0.001}
        className="flex h-5 w-5 items-center justify-center border border-[var(--rule)] text-xs leading-none text-[var(--fg-dim)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-30"
        aria-label="Shrink"
      >
        −
      </button>
      <input
        type="range"
        min={SIZE_MIN}
        max={SIZE_MAX}
        step={SIZE_STEP}
        value={value}
        onChange={(e) => setSizeAdjust(side, +e.target.value)}
        className="h-1 w-20 cursor-pointer accent-[var(--accent)]"
        aria-label={`Manual size for ${side}`}
      />
      <button
        type="button"
        onClick={() => bump(SIZE_STEP)}
        disabled={value >= SIZE_MAX - 0.001}
        className="flex h-5 w-5 items-center justify-center border border-[var(--rule)] text-xs leading-none text-[var(--fg-dim)] transition hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-30"
        aria-label="Enlarge"
      >
        +
      </button>
      <button
        type="button"
        onClick={() => setSizeAdjust(side, 1)}
        title="Reset to 100%"
        className={clsx(
          'min-w-[2.5rem] font-display text-[0.6rem] uppercase tracking-[0.2em] transition',
          isAdjusted
            ? 'text-[var(--accent)] hover:underline'
            : 'text-[var(--fg-mute)] cursor-default',
        )}
      >
        {Math.round(value * 100)}%
      </button>
    </div>
  );
}

function HeightChip({
  side,
  athlete,
  lookupStatus,
  wikiPage,
}: {
  side: Side;
  athlete: Athlete;
  lookupStatus: 'idle' | 'loading' | 'found' | 'not-found' | 'error';
  wikiPage?: string;
}) {
  const setHeight = useScorecard((s) => s.setHeight);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  function startEdit() {
    setDraft(athlete.heightCm ? formatFeetInches(athlete.heightCm) : '');
    setEditing(true);
  }

  function commit() {
    const cm = parseHeightInput(draft);
    if (cm) setHeight(side, cm, 'manual');
    else if (draft.trim() === '') setHeight(side, undefined, 'manual');
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        placeholder="6'2 or 188cm"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setEditing(false);
        }}
        className="w-28 border border-[var(--accent)] bg-black px-2 py-0.5 font-display text-xs uppercase tracking-[0.2em] text-[var(--fg)] outline-none"
      />
    );
  }

  const label = athlete.heightCm
    ? `${formatFeetInches(athlete.heightCm)} · ${athlete.heightCm}cm`
    : lookupStatus === 'loading'
      ? 'Detecting…'
      : lookupStatus === 'not-found'
        ? 'Add height'
        : lookupStatus === 'error'
          ? 'Lookup failed'
          : 'Add height';

  const sourceMark =
    athlete.heightSource === 'auto'
      ? 'auto'
      : athlete.heightSource === 'manual'
        ? 'manual'
        : null;

  return (
    <button
      type="button"
      onClick={startEdit}
      title={wikiPage ? `Source: Wikipedia · ${wikiPage}` : 'Click to set manually'}
      className={clsx(
        'inline-flex items-center gap-1.5 border px-2 py-0.5 font-display text-[0.6rem] uppercase tracking-[0.25em] transition',
        athlete.heightCm
          ? 'border-[var(--rule-strong)] text-[var(--fg)] hover:border-[var(--accent)] hover:text-[var(--accent)]'
          : 'border-dashed border-[var(--rule)] text-[var(--fg-dim)] hover:border-[var(--accent)] hover:text-[var(--accent)]',
      )}
    >
      {lookupStatus === 'loading' && (
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[var(--accent)]" />
      )}
      <span>{label}</span>
      {sourceMark && (
        <span className="text-[var(--fg-mute)]" aria-hidden>
          · {sourceMark}
        </span>
      )}
    </button>
  );
}

/** Parse "6'2", "6'2\"", "6 ft 2 in", "188", "188cm", "1.88m" → centimeters. */
function parseHeightInput(input: string): number | null {
  const s = input.trim().toLowerCase();
  if (!s) return null;

  // 6'2 / 6'2" / 6’2
  let m = s.match(/^(\d+)\s*['’]\s*(\d+)/);
  if (m) return Math.round((+m[1] * 12 + +m[2]) * 2.54);

  // 6 ft 2 in
  m = s.match(/^(\d+)\s*(?:ft|feet)\s*(\d+)/);
  if (m) return Math.round((+m[1] * 12 + +m[2]) * 2.54);

  // 1.88 m
  m = s.match(/^([\d.]+)\s*m\b/);
  if (m) {
    const meters = +m[1];
    if (meters > 1.2 && meters < 2.5) return Math.round(meters * 100);
  }

  // 188 / 188cm
  m = s.match(/^(\d+(?:\.\d+)?)\s*(?:cm)?$/);
  if (m) {
    const cm = +m[1];
    if (cm > 100 && cm < 250) return Math.round(cm);
  }

  return null;
}

function formatFeetInches(cm: number): string {
  const totalInches = cm / 2.54;
  const ft = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches - ft * 12);
  return `${ft}'${inches}"`;
}

/**
 * Lightweight ResizeObserver hook (avoids depending on a util library).
 */
function useResizeObserver<T extends HTMLElement>(
  ref: React.RefObject<T>,
  cb: (entry: ResizeObserverEntry) => void,
) {
  const cbRef = useRef(cb);
  cbRef.current = cb;

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) cbRef.current(entry);
    });
    ro.observe(el);
    // Seed an initial measurement immediately so the first render computes a transform.
    cbRef.current({ contentRect: el.getBoundingClientRect() } as ResizeObserverEntry);
    return () => ro.disconnect();
  }, [ref]);
}
