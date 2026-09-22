import type { Metadata } from 'next';
import { cache } from 'react';
import { getSettings } from '@/lib/settings.server';
import { absoluteUrl } from '@/lib/site-url';
import { listingDescription, listingJsonLd, imageUrl, jsonLdScript, type SeoListing } from '@/lib/listing-seo';

/**
 * Describes a listing to search engines and messaging apps.
 *
 * The page itself is interactive — offers, orders, a photo gallery — so it
 * runs in the browser and cannot tell a crawler anything. This server layout
 * wraps it with the real title, the photo and the price, which is what turns a
 * pasted WhatsApp link into something worth opening.
 */

/** One fetch per request, shared by the metadata and the structured data. */
const getListing = cache(async (code: string): Promise<SeoListing | null> => {
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
  try {
    const res = await fetch(`${base}/listings/${encodeURIComponent(code)}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const body = await res.json();
    return body?.data?.listing ?? null;
  } catch {
    // A listing page still renders in the browser when the API is slow;
    // it simply falls back to the site-wide title.
    return null;
  }
});

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const [listing, site] = await Promise.all([getListing(code), getSettings()]);
  if (!listing) return { title: 'Produce listing' };

  const title = listing.title || `${listing.produce?.name ?? 'Produce'} for sale`;
  const description = listingDescription(listing, site);
  const image = imageUrl(listing.coverImage) || imageUrl(listing.produce?.imageUrl);
  const url = absoluteUrl(`/marketplace/${listing.code}`);

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'website',
      url,
      title: `${title} · ${site.shortName}`,
      description,
      ...(image ? { images: [{ url: image, alt: title }] } : {}),
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title: `${title} · ${site.shortName}`,
      description,
      ...(image ? { images: [image] } : {}),
    },
    // A sold or withdrawn listing should stop attracting search traffic
    robots: listing.status === 'active' ? { index: true, follow: true } : { index: false, follow: true },
  };
}

export default async function ListingLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const [listing, site] = await Promise.all([getListing(code), getSettings()]);

  return (
    <>
      {listing && <script {...jsonLdScript(listingJsonLd(listing, site))} />}
      {children}
    </>
  );
}
