/**
 * Persisted configuration for a user-created judge.
 * Lives in localStorage under "custom-judges" so each browser keeps its own roster.
 */
export type CustomJudgeConfig = {
  /** Stable slug used in the URL (`/j/{id}`) and as the per-judge store key. */
  id: string;
  /** Brand text shown in the page header eyebrow. */
  name: string;
  /** Top line of the title block (large display text). */
  brandLine1: string;
  /** Bottom line of the title block (smaller, accented). */
  brandLine2: string;
  /** Optional logo as a data URL (uploaded image, downscaled). */
  logoDataUrl?: string;
  // ─── 5-color mosaic palette + base bg/fg ───
  /** Page background base color. */
  bg: string;
  /** Top radial-glow tint that sits above the bg. */
  bgGlow: string;
  /** Foreground text color. */
  fg: string;
  /** Primary accent — poses-table header strip. */
  mosaic1: string;
  /** Secondary accent — categories-table header strip. */
  mosaic2: string;
  /** Tertiary accent — title-block underline + final-score border. */
  mosaic3: string;
  /** Companion swatch (decorative). */
  mosaic4: string;
  /** Deep gradient companion — title-block + final-score backdrop gradient. */
  mosaic5: string;
  createdAt: number;
};
