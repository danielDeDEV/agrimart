import type { MetadataRoute } from 'next';
import { SITE_URL, absoluteUrl } from '@/lib/site-url';

/**
 * Search engines are welcome on the public marketplace and price pages, and
 * nowhere near the admin console or a signed-in farmer's dashboard.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin', '/admin/', '/dashboard', '/dashboard/', '/login', '/register', '/forgot-password'],
      },
    ],
    sitemap: absoluteUrl('/sitemap.xml'),
    host: SITE_URL,
  };
}
