import type { MetadataRoute } from 'next';
import { getSettings } from '@/lib/settings.server';

/**
 * Lets a farmer or buyer keep AgriMart on their home screen. Named from the
 * live platform settings so a rename reaches the installed app too.
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const site = await getSettings();
  return {
    name: `${site.name} — ${site.tagline}`,
    short_name: site.shortName,
    description: site.description,
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#15803d',
    orientation: 'portrait',
    categories: ['business', 'shopping', 'food'],
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
  };
}
