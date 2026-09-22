import { cache } from 'react';
import { DEFAULT_SETTINGS, toSiteSettings, type SiteSettings } from './settings';

/**
 * Live platform settings for server-rendered pages.
 *
 * Read fresh on each request so an administrator's change shows immediately,
 * and cached within a request so one page never asks twice. If the API is
 * unreachable the page still renders, with the built-in defaults.
 */
export const getSettings = cache(async (): Promise<SiteSettings> => {
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
  try {
    const res = await fetch(`${base}/settings/public`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return DEFAULT_SETTINGS;
    const body = await res.json();
    return toSiteSettings(body?.data);
  } catch {
    return DEFAULT_SETTINGS;
  }
});
