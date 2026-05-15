/** @type {import('next').NextConfig} */
const nextConfig = {
  // @imgly/background-removal pulls in onnxruntime-web/onnxruntime-node which
  // ship as ESM with `import.meta` and `createRequire`. Webpack needs to be
  // told to handle .mjs as ESM and not try to bundle the node-only variant.
  experimental: {
    serverComponentsExternalPackages: ['@imgly/background-removal', 'onnxruntime-node'],
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
