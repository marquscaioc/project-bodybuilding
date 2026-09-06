import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { CornballButton } from '@/components/CornballButton';
import './globals.css';

const geist = Geist({
  subsets: ['latin'],
  variable: '--font-geist',
  display: 'swap',
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'Project: Bodybuilding — Live Scorecard',
    template: '%s — Project: Bodybuilding',
  },
  description: 'Live, panel-based scoring for head-to-head bodybuilding comparisons.',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className={`${geist.variable} ${geistMono.variable}`}>
        {children}
        <CornballButton />
      </body>
    </html>
  );
}
