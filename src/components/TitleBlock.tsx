import Image from 'next/image';

export function TitleBlock({
  line1 = "Chow's",
  line2 = 'Scorecard',
  logoSrc,
  logoAlt,
}: {
  line1?: string;
  line2?: string;
  logoSrc?: string;
  logoAlt?: string;
}) {
  return (
    <div className="title-block flex h-full flex-col justify-between gap-5 border border-[var(--rule)] bg-black p-4 sm:p-5">
      {logoSrc ? (
        <div className="flex flex-1 items-center justify-center py-2">
          <div className="logo-ring relative aspect-square w-full max-w-[240px] rounded-full p-[5px]">
            <div className="relative h-full w-full overflow-hidden rounded-full bg-black">
              <Image
                src={logoSrc}
                alt={logoAlt ?? `${line1} ${line2}`}
                fill
                sizes="240px"
                className="object-cover"
                priority
              />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col">
          <span className="title-line title-line-1 font-display uppercase tracking-[0.04em] text-[var(--fg)]">
            {line1}
          </span>
          <span className="title-line title-line-2 mt-2 inline-block w-fit max-w-full border-t-2 border-[var(--accent)] pt-2 font-display uppercase tracking-[0.14em] text-[var(--accent)]">
            {line2}
          </span>
        </div>
      )}

      <div className="flex flex-col gap-1.5 text-[0.65rem] uppercase tracking-[0.28em] text-[var(--fg-dim)]">
        <span>Pose ×2 · Category ×1</span>
        <span>Poses 1–4 · Cats Tie/2–4</span>
        <span>Differential ÷ 80 → 0–100</span>
      </div>
    </div>
  );
}
