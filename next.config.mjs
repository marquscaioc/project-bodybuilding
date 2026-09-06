import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const isVercelBuild = Boolean(process.env.VERCEL);

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Vercel supplies its own build adapter; standalone remains enabled for Docker/self-hosting.
  output: isVercelBuild ? undefined : 'standalone',
  poweredByHeader: false,
  compress: true,
  turbopack: {
    root: projectRoot,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
