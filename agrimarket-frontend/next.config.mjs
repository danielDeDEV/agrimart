import { PHASE_PRODUCTION_BUILD } from 'next/constants.js';

/**
 * Photos are served by the API (listing uploads, avatars, catalogue images),
 * so whatever host NEXT_PUBLIC_API_URL points at must be allowed here too —
 * otherwise every uploaded photo 400s in production while working locally.
 */
const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || '';

const isLocal = (url) => /localhost|127\.0\.0\.1/.test(url);

/**
 * A production build with a localhost API is the classic deployment mistake:
 * it compiles, it deploys, and then every page on the live site fails to load
 * its data. NEXT_PUBLIC_* values are baked in at build time, so the build is
 * the only moment it can be caught — and only the build, so that `next start`
 * and `next dev` still run normally on a laptop.
 */
function assertDeployable() {
  if (process.env.SKIP_ENV_CHECK) return;

  const problems = [];
  if (isLocal(apiUrl)) {
    problems.push(`NEXT_PUBLIC_API_URL is ${apiUrl} — set it to the API's public address before building.`);
  }
  if (!siteUrl) {
    problems.push('NEXT_PUBLIC_SITE_URL is not set — the sitemap, share cards and canonical links need it.');
  } else if (isLocal(siteUrl)) {
    problems.push(`NEXT_PUBLIC_SITE_URL is ${siteUrl} — set it to this website's public address.`);
  }
  if (!problems.length) return;

  console.error('\n\x1b[31m  This build is not configured for production\x1b[0m');
  problems.forEach((problem) => console.error(`   - ${problem}`));
  console.error('\n  Put them in agrimarket-frontend/.env.local and build again.');
  console.error('  To build for this machine instead, run: npm run build:local\n');
  process.exit(1);
}

/** The API's own host, so Next/Image will serve photos uploaded by farmers. */
function apiImagePatterns() {
  try {
    const { protocol, hostname, port } = new URL(apiUrl);
    return [{ protocol: protocol.replace(':', ''), hostname, ...(port ? { port } : {}) }];
  } catch {
    return [];
  }
}

// Locked down: no framing, no sniffing, and a referrer policy that does not
// leak a farmer's dashboard URL to other sites. Widen these here if a
// third-party widget is ever added.
const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(self), interest-cohort=()' },
  // Only meaningful over https, where the browser applies it
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  images: {
    remotePatterns: [
      // Catalogue photos are served from public/images. These hosts only cover
      // older databases that still link to Wikimedia Commons directly.
      { protocol: 'https', hostname: 'commons.wikimedia.org' },
      { protocol: 'https', hostname: 'upload.wikimedia.org' },
      // Listing and avatar uploads served by the API, wherever it is deployed
      ...apiImagePatterns(),
      { protocol: 'http', hostname: 'localhost', port: '5000' },
      { protocol: 'http', hostname: '127.0.0.1', port: '5000' },
    ],
  },
  eslint: { ignoreDuringBuilds: true },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default (phase) => {
  if (phase === PHASE_PRODUCTION_BUILD) assertDeployable();
  return nextConfig;
};
