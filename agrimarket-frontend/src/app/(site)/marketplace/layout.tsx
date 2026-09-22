import type { Metadata } from 'next';
import { getSettings } from '@/lib/settings.server';
import { absoluteUrl } from '@/lib/site-url';

/**
 * The marketplace is the page buyers search for, so it needs its own title and share card rather than the site-wide one.
 */
export async function generateMetadata(): Promise<Metadata> {
  const site = await getSettings();
  const title = 'Buy produce direct from farmers';
  const description = `Fresh maize, tomatoes, yam, cassava and more from smallholder farmers across Ghana. Compare prices, see what is in stock today and buy direct — no middlemen. ${site.shortName}.`;
  return {
    title,
    description,
    alternates: { canonical: absoluteUrl('/marketplace') },
    openGraph: { type: 'website', url: absoluteUrl('/marketplace'), title: `${title} · ${site.shortName}`, description },
    twitter: { card: 'summary_large_image', title: `${title} · ${site.shortName}`, description },
  };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
