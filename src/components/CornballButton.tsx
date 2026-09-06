'use client';

import Image from 'next/image';

export function CornballButton() {
  function handleClick() {
    window.dispatchEvent(new CustomEvent('cornball:click'));
  }

  return (
    <button
      type="button"
      className="cornball-button"
      onClick={handleClick}
      aria-label="Play Cornball audio"
      title="Cornball audio coming soon"
    >
      <Image
        src="/buttons/cornball-button.png"
        alt=""
        width={160}
        height={160}
        sizes="(max-width: 640px) 96px, 136px"
        draggable={false}
      />
    </button>
  );
}
