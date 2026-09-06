'use client';

import Image from 'next/image';
import { useEffect, useRef } from 'react';

const DEREK_TRACKS = [
  '/audio/cornball/best-arms-derek.m4a',
  '/audio/cornball/bigger-and-blacker-ai.m4a',
  '/audio/cornball/bigger-and-blacker-mikme.m4a',
  '/audio/cornball/dont-pull-it-out-derek.m4a',
  '/audio/cornball/frikcing-hard.m4a',
  '/audio/cornball/get-out.m4a',
  '/audio/cornball/i-own-the-position.m4a',
  '/audio/cornball/you-wanna-die-today-derek.m4a',
] as const;

function pickTrackIndex(previousIndex: number) {
  if (previousIndex < 0) return Math.floor(Math.random() * DEREK_TRACKS.length);

  const candidate = Math.floor(Math.random() * (DEREK_TRACKS.length - 1));
  return candidate >= previousIndex ? candidate + 1 : candidate;
}

export function CornballButton() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const previousTrackRef = useRef(-1);

  useEffect(() => {
    const audio = audioRef.current;
    return () => {
      audio?.pause();
    };
  }, []);

  function handleClick() {
    const audio = audioRef.current;
    if (!audio) return;

    const trackIndex = pickTrackIndex(previousTrackRef.current);
    const track = DEREK_TRACKS[trackIndex];
    previousTrackRef.current = trackIndex;

    audio.pause();
    audio.src = track;
    audio.currentTime = 0;
    void audio.play().catch(() => undefined);

    window.dispatchEvent(
      new CustomEvent('cornball:click', { detail: { track, trackIndex } }),
    );
  }

  return (
    <>
      <button
        type="button"
        className="cornball-button"
        onClick={handleClick}
        aria-label="Play Cornball audio"
        title="Play a random Derek clip"
      >
        <Image
          src="/buttons/cornball-button.png"
          alt=""
          width={160}
          height={160}
          sizes="(max-width: 640px) 96px, 136px"
          loading="eager"
          draggable={false}
        />
      </button>
      <audio ref={audioRef} preload="none" hidden />
    </>
  );
}
