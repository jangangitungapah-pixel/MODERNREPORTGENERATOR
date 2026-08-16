import {
  initOpenNextCloudflareForDev,
} from '@opennextjs/cloudflare';

initOpenNextCloudflareForDev();

const isProduction =
  process.env.NODE_ENV ===
  'production';

const securityHeaders = [
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'Referrer-Policy',
    value: 'same-origin',
  },
  {
    key: 'Permissions-Policy',
    value:
      'camera=(), microphone=(), geolocation=()',
  },
  {
    key: 'Cross-Origin-Opener-Policy',
    value: 'same-origin-allow-popups',
  },
  {
    key: 'Cross-Origin-Resource-Policy',
    value: 'same-origin',
  },
  ...(isProduction
    ? [
        {
          key: 'Strict-Transport-Security',
          value:
            'max-age=31536000; includeSubDomains',
        },
      ]
    : []),
];

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

  async headers() {
    return [
      {
        source:
          '/:path*',
        headers:
          securityHeaders,
      },
    ];
  },
};

export default nextConfig;
