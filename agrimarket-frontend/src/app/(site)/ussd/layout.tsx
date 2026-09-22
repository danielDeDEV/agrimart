import type { Metadata } from 'next';
import { getSettings } from '@/lib/settings.server';
import { absoluteUrl } from '@/lib/site-url';

/**
 * The USSD page explains the whole point of the platform, so a shared link should say so.
 */
export async function generateMetadata(): Promise<Metadata> {
  const site = await getSettings();
  const title = `Use ${site.shortName} on any phone`;
  const description = `Dial ${site.ussdCode} to sell produce, check market prices and receive orders — no smartphone, no internet and no data cost. Try the live demonstration first.`;
  return {
    title,
    description,
    alternates: { canonical: absoluteUrl('/ussd') },
    openGraph: { type: 'website', url: absoluteUrl('/ussd'), title: `${title} · ${site.shortName}`, description },
    twitter: { card: 'summary_large_image', title: `${title} · ${site.shortName}`, description },
  };
}

export default function Layout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
