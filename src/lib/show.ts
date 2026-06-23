'use client';

/**
 * Live-show session: which judge desk this browser is signed in as.
 *
 * The "login" is a soft gate — pick a desk + type the shared show code. We
 * store the chosen slug in localStorage; the desk + host pages read it to
 * decide who you are. This is NOT security (the code ships in the client),
 * just enough to keep casual viewers from grabbing a desk. Same posture as
 * the legacy PasswordGate.
 */

import { BUILTIN_JUDGES } from './builtinJudges';

/** Shared access code every judge types after picking their desk. */
export const SHOW_CODE = 'projectbb';

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

/** Sign this browser in as a desk. */
export function setJudgeSession(slug: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SESSION_KEY, slug);
}

/** Sign out (switch desk). */
export function clearJudgeSession(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(SESSION_KEY);
}
