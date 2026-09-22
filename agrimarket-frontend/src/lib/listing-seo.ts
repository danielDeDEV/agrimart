import { absoluteUrl } from './site-url';
import type { SiteSettings } from './settings';

/**
 * What a listing looks like to a search engine or a messaging app.
 *
 * The listing page itself is interactive (offers, orders, photo gallery), so it
 * is a client component and cannot describe itself to a crawler. This builds
 * that description server-side: the page title and share card, plus the
 * Product data Google needs to show a price and availability in results.
 *
 * It matters commercially: most produce here is shared as a link in WhatsApp,
 * and a link with a photo, a price and a place gets opened.
 */

export interface SeoListing {
  code: string;
  title?: string | null;
  description?: string | null;
  coverImage?: string | null;
  images?: string[] | null;
  pricePerUnit?: number | string | null;
  unit?: string | null;
  quantityRemaining?: number | string | null;
  status?: string | null;
  qualityGrade?: string | null;
  isOrganic?: boolean | null;
  location?: string | null;
  createdAt?: string | null;
  expiresAt?: string | null;
  produce?: { name?: string | null; imageUrl?: string | null } | null;
  region?: { name?: string | null } | null;
  farmer?: { fullName?: string | null; ratingAvg?: number | string | null; ratingCount?: number | null } | null;
}

const money = (value: unknown) => Number(value ?? 0).toLocaleString('en-GH', { maximumFractionDigits: 2 });

/** An absolute URL for an image that may be a library path or an upload. */
export function imageUrl(path?: string | null): string | undefined {
  if (!path) return undefined;
  if (/^https?:\/\//i.test(path)) return path;
  return absoluteUrl(path);
}

/** The sentence under the title in a search result or a chat preview. */
export function listingDescription(listing: SeoListing, site: SiteSettings): string {
  const produce = listing.produce?.name || 'Produce';
  const where = listing.region?.name ? ` in ${listing.region.name}` : '';
  const qty = listing.quantityRemaining ? `${money(listing.quantityRemaining)} ${listing.unit} available` : 'Available now';
  const price = listing.pricePerUnit ? `GHS ${money(listing.pricePerUnit)} per ${listing.unit}` : 'Ask for a price';
  const grade = listing.qualityGrade ? ` Grade ${listing.qualityGrade}.` : '';
  const organic = listing.isOrganic ? ' Organically grown.' : '';

  const own = listing.description?.trim();
  if (own) return `${own.slice(0, 150)}${own.length > 150 ? '…' : ''}`;

  return `${produce}${where} — ${qty} at ${price}.${grade}${organic} Buy direct from the farmer on ${site.shortName}, or dial ${site.ussdCode} on any phone.`;
}

/**
 * Schema.org Product data. `availability` follows the listing's own status, so
 * a sold or withdrawn listing does not keep advertising stock it no longer has.
 */
export function listingJsonLd(listing: SeoListing, site: SiteSettings) {
  const available = listing.status === 'active';
  const photos = [listing.coverImage, ...(listing.images ?? [])].map(imageUrl).filter(Boolean) as string[];

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: listing.title || `${listing.produce?.name ?? 'Produce'} — ${listing.code}`,
    sku: listing.code,
    description: listingDescription(listing, site),
    ...(photos.length ? { image: photos.slice(0, 5) } : {}),
    ...(listing.produce?.name ? { category: listing.produce.name } : {}),
    offers: {
      '@type': 'Offer',
      url: absoluteUrl(`/marketplace/${listing.code}`),
      priceCurrency: 'GHS',
      price: Number(listing.pricePerUnit ?? 0),
      availability: available ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      ...(listing.expiresAt ? { priceValidUntil: String(listing.expiresAt).slice(0, 10) } : {}),
      seller: {
        '@type': 'Organization',
        name: listing.farmer?.fullName || site.name,
        ...(listing.region?.name
          ? { address: { '@type': 'PostalAddress', addressRegion: listing.region.name, addressCountry: 'GH' } }
          : {}),
      },
    },
    ...(Number(listing.farmer?.ratingCount ?? 0) > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: Number(listing.farmer?.ratingAvg ?? 0).toFixed(1),
            reviewCount: Number(listing.farmer?.ratingCount ?? 0),
          },
        }
      : {}),
  };
}

/** Who runs the platform — used once, on the home page. */
export function organisationJsonLd(site: SiteSettings) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: site.name,
    description: site.description,
    url: absoluteUrl('/'),
    logo: absoluteUrl('/icon.svg'),
    areaServed: { '@type': 'Country', name: 'Ghana' },
    ...(site.supportPhone
      ? {
          contactPoint: {
            '@type': 'ContactPoint',
            telephone: `+233${site.supportPhone.replace(/\D/g, '').replace(/^0/, '')}`,
            contactType: 'customer support',
            areaServed: 'GH',
            availableLanguage: ['English'],
          },
        }
      : {}),
    ...(site.address ? { address: { '@type': 'PostalAddress', streetAddress: site.address, addressCountry: 'GH' } } : {}),
  };
}

/** The site's search box, so Google can offer it directly in results. */
export function websiteJsonLd(site: SiteSettings) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: site.name,
    url: absoluteUrl('/'),
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${absoluteUrl('/marketplace')}?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  };
}

/** Renders one of the objects above into the page. */
export const jsonLdScript = (data: unknown) => ({
  type: 'application/ld+json',
  dangerouslySetInnerHTML: { __html: JSON.stringify(data).replace(/</g, '\\u003c') },
});
