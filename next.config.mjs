import {
  initOpenNextCloudflareForDev,
} from '@opennextjs/cloudflare';

initOpenNextCloudflareForDev();

const isProduction =
  process.env.NODE_ENV ===
  'production';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Keep Turbopack scoped to this repo even when
  // another package-lock exists higher in C:\Users.
  turbopack: {
    root: process.cwd(),
  },

  // Next.js 16 keeps development output in .next/dev.
  // Production validation must not consume mutable dev-generated types.
  typescript: {
    tsconfigPath:
      isProduction
        ? 'tsconfig.build.json'
        : 'tsconfig.json',
  },
};

export default nextConfig;
