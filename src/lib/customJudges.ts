'use client';

import type { CustomJudgeConfig } from '@/types/customJudge';

export const CUSTOM_JUDGES_STORAGE_KEY = 'custom-judges';
export const CUSTOM_JUDGES_EVENT = 'custom-judges-changed';

export function loadCustomJudges(): CustomJudgeConfig[] {
  if (typeof window === 'undefined') return [];
  const raw = localStorage.getItem(CUSTOM_JUDGES_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as CustomJudgeConfig[]) : [];
  } catch {
    return [];
  }
}

export function getCustomJudge(id: string): CustomJudgeConfig | undefined {
  return loadCustomJudges().find((j) => j.id === id);
}

function notifyChanged() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event(CUSTOM_JUDGES_EVENT));
}

export function upsertCustomJudge(config: CustomJudgeConfig) {
  const list = loadCustomJudges();
  const idx = list.findIndex((j) => j.id === config.id);
  if (idx >= 0) list[idx] = config;
  else list.push(config);
  localStorage.setItem(CUSTOM_JUDGES_STORAGE_KEY, JSON.stringify(list));
  notifyChanged();
}

export function deleteCustomJudge(id: string) {
  const next = loadCustomJudges().filter((j) => j.id !== id);
  localStorage.setItem(CUSTOM_JUDGES_STORAGE_KEY, JSON.stringify(next));
  // Also clear that judge's scoring state from localStorage.
  try {
    localStorage.removeItem(`scorecard:${id}`);
  } catch {
    /* ignore */
  }
  notifyChanged();
}

/** Convert a name into a URL-safe slug. */
export function slugifyName(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
  return base || `judge-${Date.now().toString(36)}`;
}

/**
 * Resize an uploaded logo client-side (longest side → maxDim) and re-encode
 * as JPEG to keep the data URL small enough for localStorage (~5MB cap).
 */
export async function fileToCompressedDataUrl(
  file: File,
  maxDim = 400,
  quality = 0.85,
): Promise<string> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error('Failed to read logo image'));
    i.src = URL.createObjectURL(file);
  });
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D not available');
  ctx.drawImage(img, 0, 0, w, h);
  // Use PNG when source has transparency (alpha channel survives bg-removed cutouts);
  // otherwise JPEG for size.
  const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');
  return c.toDataURL(isPng ? 'image/png' : 'image/jpeg', quality);
}

/**
 * Map a CustomJudgeConfig palette → CSS-variable style object that can be
 * applied directly to a .theme-wrap element. Inline vars override anything
 * a class would set, so this works for both custom judges and overrides.
 */
export function paletteToStyle(config: CustomJudgeConfig): React.CSSProperties {
  return {
    // Base palette
    '--bg': config.bg,
    '--bg-glow': config.bgGlow,
    '--fg': config.fg,
    '--fg-dim': mixColors(config.fg, config.bg, 0.45),
    '--fg-mute': mixColors(config.fg, config.bg, 0.7),
    // Rules / borders derived from primary accent
    '--rule': hexToRgba(config.mosaic1, 0.28),
    '--rule-strong': hexToRgba(config.mosaic1, 0.55),
    '--rule-soft': hexToRgba(config.mosaic1, 0.1),
    // Strip
    '--strip-bg': config.mosaic1,
    '--strip-fg': config.bg,
    // Accent
    '--accent': config.mosaic3,
    '--accent-soft': hexToRgba(config.mosaic3, 0.2),
    // Sides
    '--side-a': config.mosaic1,
    '--side-b': config.mosaic2,
    // Mosaic palette
    '--mosaic-1': config.mosaic1,
    '--mosaic-2': config.mosaic2,
    '--mosaic-3': config.mosaic3,
    '--mosaic-4': config.mosaic4,
    '--mosaic-5': config.mosaic5,
  } as React.CSSProperties;
}

/** Convert #RRGGBB to rgba(r, g, b, a). Falls back to the input if not a hex. */
function hexToRgba(hex: string, alpha: number): string {
  const m = hex.match(/^#?([0-9a-f]{6})$/i);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 0xff;
  const g = (n >> 8) & 0xff;
  const b = n & 0xff;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Linearly interpolate two hex colors. t=0 → a, t=1 → b. */
function mixColors(a: string, b: string, t: number): string {
  const ra = parseHex(a);
  const rb = parseHex(b);
  if (!ra || !rb) return a;
  const r = Math.round(ra.r + (rb.r - ra.r) * t);
  const g = Math.round(ra.g + (rb.g - ra.g) * t);
  const bl = Math.round(ra.b + (rb.b - ra.b) * t);
  return `rgb(${r}, ${g}, ${bl})`;
}
function parseHex(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.match(/^#?([0-9a-f]{6})$/i);
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 0xff, g: (n >> 8) & 0xff, b: n & 0xff };
}
