import type { Metadata } from 'next';
import { getSettings } from '@/lib/settings.server';
import { absoluteUrl } from '@/lib/site-url';

/**
 * Price pages are what farmers search for by crop and market, and the page itself is interactive, so its description belongs here.
 */
export async function generateMetadata(): Promise<Metadata> {
  const site = await getSettings();
  const title = 'Today\'s market prices';
  const description = `Live wholesale prices for maize, tomatoes, yam, rice and other crops across Ghanaian markets, collected by field agents. Free to check on ${site.shortName}, or dial ${site.ussdCode} on any phone.`;
  return {
    title,
    description,
    alternates: { canonical: absoluteUrl('/prices') },
    openGraph: { type: 'website', url: absoluteUrl('/prices'), title: `${title} · ${site.shortName}`, description },
    twitter: { card: 'summary_large_image', title: `${title} · ${site.shortName}`, description },
  };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
