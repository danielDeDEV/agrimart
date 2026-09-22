import type { MetadataRoute } from 'next';
import { absoluteUrl } from '@/lib/site-url';

/**
 * The public map of the site: the fixed pages plus whatever produce and farm
 * guides are live right now. Built on request, and if the API cannot be
 * reached the fixed pages are still published rather than failing the route.
 */

const STATIC_ROUTES: Array<[path: string, changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'], priority: number]> = [
  ['/', 'daily', 1],
  ['/marketplace', 'hourly', 0.9],
  ['/prices', 'hourly', 0.9],
  ['/ussd', 'monthly', 0.8],
  ['/how-it-works', 'monthly', 0.7],
  ['/tips', 'weekly', 0.7],
  ['/about', 'monthly', 0.5],
  ['/contact', 'monthly', 0.5],
  ['/faq', 'monthly', 0.5],
  ['/credits', 'yearly', 0.2],
  ['/terms', 'yearly', 0.2],
  ['/privacy', 'yearly', 0.2],
];

async function fetchList(path: string): Promise<Array<Record<string, unknown>>> {
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
  try {
    const res = await fetch(`${base}${path}`, { cache: 'no-store', signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const body = await res.json();
    const data = body?.data;
    return Array.isArray(data) ? data : Array.isArray(data?.rows) ? data.rows : [];
  } catch {
    return [];
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const entries: MetadataRoute.Sitemap = STATIC_ROUTES.map(([path, changeFrequency, priority]) => ({
    url: absoluteUrl(path),
    lastModified: now,
    changeFrequency,
    priority,
  }));

  const [listings, tips] = await Promise.all([
    fetchList('/listings?limit=200&status=active'),
    fetchList('/tips?limit=100'),
  ]);

  listings.forEach((l) => {
    const code = typeof l.code === 'string' ? l.code : null;
    if (!code) return;
    entries.push({
      url: absoluteUrl(`/marketplace/${code}`),
      lastModified: l.updatedAt ? new Date(String(l.updatedAt)) : now,
      changeFrequency: 'daily',
      priority: 0.6,
    });
  });

  tips.forEach((t) => {
    const slug = typeof t.slug === 'string' ? t.slug : null;
    if (!slug) return;
    entries.push({
      url: absoluteUrl(`/tips/${slug}`),
      lastModified: t.updatedAt ? new Date(String(t.updatedAt)) : now,
      changeFrequency: 'monthly',
      priority: 0.5,
    });
  });

  return entries;
}
