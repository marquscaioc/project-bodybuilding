'use client';

import { useEffect, useRef, useState } from 'react';

export type HeightLookupState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'found'; heightCm: number; page?: string }
  | { status: 'not-found' }
  | { status: 'error' };

/**
 * Debounced Wikipedia height lookup. Skips when the name is too short or
 * when the user has manually pinned a height (caller decides via `enabled`).
 */
export function useHeightLookup(
  name: string,
  enabled: boolean,
  onFound: (cm: number) => void,
): HeightLookupState {
  const [state, setState] = useState<HeightLookupState>({ status: 'idle' });
  const lastQueriedRef = useRef<string>('');
  const onFoundRef = useRef(onFound);
  onFoundRef.current = onFound;

  useEffect(() => {
    const trimmed = name.trim();
    if (!enabled || trimmed.length < 3) {
      console.info('[height-lookup] skipping', { name, enabled, len: trimmed.length });
      setState({ status: 'idle' });
      return;
    }
    if (trimmed === lastQueriedRef.current) {
      console.info('[height-lookup] already queried', trimmed);
      return;
    }

    const ctrl = new AbortController();
    const timer = setTimeout(async () => {
      lastQueriedRef.current = trimmed;
      setState({ status: 'loading' });
      console.info('[height-lookup] querying', trimmed);
      try {
        const res = await fetch(
          `/api/athlete-height?name=${encodeURIComponent(trimmed)}`,
          { signal: ctrl.signal },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as {
          heightCm: number | null;
          page?: string;
        };
        console.info('[height-lookup] result', trimmed, data);
        if (data.heightCm) {
          setState({ status: 'found', heightCm: data.heightCm, page: data.page });
          onFoundRef.current(data.heightCm);
        } else {
          setState({ status: 'not-found' });
        }
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        console.warn('[height-lookup] failed', trimmed, err);
        setState({ status: 'error' });
      }
    }, 700);

    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [name, enabled]);

  return state;
}
