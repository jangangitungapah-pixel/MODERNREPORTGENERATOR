import {
  initOpenNextCloudflareForDev,
} from '@opennextjs/cloudflare';

initOpenNextCloudflareForDev();

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Keep Turbopack scoped to this repo even when
  // another package-lock exists higher in C:\Users.
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
