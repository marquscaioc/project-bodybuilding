/** @type {import('next').NextConfig} */
const nextConfig = {
  // @imgly/background-removal is loaded at runtime from esm.sh (see
  // src/lib/processPhoto.ts) so webpack never touches it. No need to
  // transpile or externalize. Keeping onnxruntime-node out of server
  // bundles in case any indirect dep still pulls it.
  experimental: {
    serverComponentsExternalPackages: ['onnxruntime-node'],
  },
  webpack: (config, { isServer }) => {
    // Treat .mjs files as ESM modules so `import.meta` parses cleanly.
    config.module.rules.push({
      test: /\.m?js$/,
      type: 'javascript/auto',
      resolve: { fullySpecified: false },
    });

    // onnxruntime ships a node fallback; never bundle it for either side.
    config.resolve.alias = {
      ...config.resolve.alias,
      'onnxruntime-node$': false,
    };

    if (!isServer) {
      // The browser-side build of onnxruntime references node built-ins it
      // never actually executes — fallback them to false so webpack doesn't
      // try to polyfill or fail.
      config.resolve.fallback = {
        ...(config.resolve.fallback ?? {}),
        fs: false,
        path: false,
        crypto: false,
        os: false,
      };
    }

    return config;
  },
};

export default nextConfig;
