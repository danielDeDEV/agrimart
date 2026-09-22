/**
 * The website's own public address.
 *
 * Search engines, share cards and the sitemap all need absolute URLs, and a
 * relative one silently produces links to localhost in production. Set
 * NEXT_PUBLIC_SITE_URL at build time (it is baked into the bundle); the
 * Vercel/Netlify variables are honoured as a fallback so a preview deploy
 * still links to itself.
 */
const fromEnv =
  process.env.NEXT_PUBLIC_SITE_URL ||
  (process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : '') ||
  process.env.URL || // Netlify
  'http://localhost:3000';

export const SITE_URL = fromEnv.replace(/\/$/, '');

/** Absolute URL for a path on this site. */
export const absoluteUrl = (path = '/') => `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
