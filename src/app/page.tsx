'use client';

import { FormEvent, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { setJudgeSession } from '@/lib/show';
import banner from '../../public/backgrounds/project-bodybuilding-banner.png';
import channelLogo from '../../public/logos/project-bodybuilding.jpg';

export default function HomePage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState(false);
  const [unlocking, setUnlocking] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (unlocking) return;

    setError(false);
    setUnlocking(true);

    try {
      const response = await fetch('/api/show-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });

      if (response.ok) {
        const session = await response.json() as { principal: string };
        setJudgeSession(session.principal);
        router.push('/desk');
        return;
      }
    } catch {
      // The same message covers invalid credentials and transient network errors.
    }

    setError(true);
    setUnlocking(false);
    inputRef.current?.focus();
    inputRef.current?.select();
  }

  return (
    <main className="home-hero">
      <Image
        src={banner}
        alt="Bodybuilders posing under stage lights"
        fill
        priority
        placeholder="blur"
        sizes="100vw"
        className="home-hero-image"
      />
      <div className="home-hero-shade" aria-hidden="true" />
      <div className="home-hero-grain" aria-hidden="true" />

      <a href="#access" className="skip-link">
        Skip to access
      </a>

      <header className="home-header">
        <Link href="/" className="home-wordmark" aria-label="Project: Bodybuilding home">
          <Image src={channelLogo} alt="" width={36} height={36} priority />
          <span className="home-wordmark-text">PROJECT: <strong>BODYBUILDING</strong></span>
        </Link>
        <Link href="/vote" className="home-live-link">
          <span className="home-live-dot" aria-hidden="true" />
          Live audience vote
        </Link>
      </header>

      <section id="access" className="home-content" aria-labelledby="home-title">
        <div className="home-copy">
          <p className="home-kicker">Head-to-head judging system</p>
          <h1 id="home-title">REAL SCORECARD.</h1>
          <p className="home-summary">
            Compare every pose, score every margin and crown the winner from one focused card.
          </p>
        </div>

        <form className="home-access" onSubmit={submit} noValidate>
          <label htmlFor="access-code">Access code</label>
          <div className="home-access-row">
            <input
              ref={inputRef}
              id="access-code"
              type="password"
              autoComplete="current-password"
              value={code}
              onChange={(event) => {
                setCode(event.target.value);
                if (error) setError(false);
              }}
              aria-invalid={error}
              aria-describedby="access-status"
              placeholder="Enter code"
            />
            <button type="submit" disabled={unlocking || code.length === 0}>
              {unlocking ? 'Opening…' : 'Enter my desk'}
            </button>
          </div>
          <p id="access-status" className={error ? 'is-error' : undefined} aria-live="polite">
            {error ? 'Access denied. Check the code and try again.' : 'Your code opens only your assigned scorecard.'}
          </p>
        </form>
      </section>

      <footer className="home-footer">
        <span>Live scoring platform</span>
        <span>Developed by Chow Cuck · {new Date().getFullYear()}</span>
      </footer>
    </main>
  );
}
