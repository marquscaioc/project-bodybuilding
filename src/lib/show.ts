/**
 * Live-show session: which judge desk this browser is signed in as.
 *
 * The access code is resolved server-side and exchanged for a signed,
 * HTTP-only cookie. localStorage remembers only the active authorized desk;
 * the cookie remains the source of truth for identity and permissions.
 */

import { BUILTIN_JUDGES } from './builtinJudges';

/** Stable public identifier for the current live show. */
export const SHOW_ID = 'projectbb';

/** The desk that doubles as the host / reveal console. */
export const HOST_SLUG = 'project-bodybuilding';

const SESSION_KEY = 'pbb-judge-slug';

/** A judge slug is valid only if it's one of the built-in desks. */
export function isValidJudgeSlug(slug: string | null | undefined): slug is string {
  return !!slug && BUILTIN_JUDGES.some((j) => j.slug === slug);
}

/** Read the signed-in desk for this browser, or null. */
export function getJudgeSession(): string | null {
  if (typeof window === 'undefined') return null;
  const slug = window.localStorage.getItem(SESSION_KEY);
  return isValidJudgeSlug(slug) ? slug : null;
}

/** Remember the active desk. Server authorization still wins. */
export function setJudgeSession(slug: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SESSION_KEY, slug);
}

/** Remove the local active-desk preference. */
export function clearJudgeSession(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(SESSION_KEY);
}
