import type { Metadata } from 'next';
import { getSettings } from '@/lib/settings.server';
import { absoluteUrl } from '@/lib/site-url';

/**
 * A contact page shared in a message should show the support line directly in the preview.
 */
export async function generateMetadata(): Promise<Metadata> {
  const site = await getSettings();
  const title = 'Contact us';
  const description = `Talk to the ${site.shortName} team: call ${site.supportPhone}, email ${site.supportEmail}, or send a message and we will come back to you.`;
  return {
    title,
    description,
    alternates: { canonical: absoluteUrl('/contact') },
    openGraph: { type: 'website', url: absoluteUrl('/contact'), title: `${title} · ${site.shortName}`, description },
    twitter: { card: 'summary_large_image', title: `${title} · ${site.shortName}`, description },
  };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
