import type { Metadata } from 'next';
import { getSettings } from '@/lib/settings.server';
import { absoluteUrl } from '@/lib/site-url';

/**
 * The guides index is a search entry point for farmers who have never heard of the platform.
 */
export async function generateMetadata(): Promise<Metadata> {
  const site = await getSettings();
  const title = 'Farm guides';
  const description = `Practical guides for Ghanaian smallholder farmers: when to sell, how to store, what buyers look for, and how to get a better price. Free from ${site.shortName}.`;
  return {
    title,
    description,
    alternates: { canonical: absoluteUrl('/tips') },
    openGraph: { type: 'website', url: absoluteUrl('/tips'), title: `${title} · ${site.shortName}`, description },
    twitter: { card: 'summary_large_image', title: `${title} · ${site.shortName}`, description },
  };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
