import type { Metadata } from 'next';
import { cache } from 'react';
import { getSettings } from '@/lib/settings.server';
import { absoluteUrl } from '@/lib/site-url';
import { imageUrl, jsonLdScript } from '@/lib/listing-seo';

/**
 * Farm guides are the platform's public face in search: a farmer looking up
 * "when to sell tomatoes in Ghana" should find this page, not a competitor.
 * The article itself is interactive (saving, sharing), so its description for
 * crawlers is built here on the server.
 */

interface Tip {
  title?: string | null;
  slug?: string | null;
  excerpt?: string | null;
  category?: string | null;
  author?: string | null;
  imageUrl?: string | null;
  readMinutes?: number | null;
  publishedAt?: string | null;
  updatedAt?: string | null;
}

const getTip = cache(async (slug: string): Promise<Tip | null> => {
  const base = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';
  try {
    const res = await fetch(`${base}/tips/${encodeURIComponent(slug)}`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(4000),
    });
    if (!res.ok) return null;
    const body = await res.json();
    return body?.data?.tip ?? body?.data ?? null;
  } catch {
    return null;
  }
});

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const [tip, site] = await Promise.all([getTip(slug), getSettings()]);
  if (!tip?.title) return { title: 'Farm guide' };

  const description = tip.excerpt?.trim() || `A practical guide for Ghanaian farmers from ${site.name}.`;
  const url = absoluteUrl(`/tips/${slug}`);
  const image = imageUrl(tip.imageUrl);

  return {
    title: tip.title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      url,
      title: tip.title,
      description,
      publishedTime: tip.publishedAt ?? undefined,
      modifiedTime: tip.updatedAt ?? undefined,
      authors: tip.author ? [tip.author] : undefined,
      ...(image ? { images: [{ url: image, alt: tip.title }] } : {}),
    },
    twitter: { card: image ? 'summary_large_image' : 'summary', title: tip.title, description },
  };
}

export default async function TipLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [tip, site] = await Promise.all([getTip(slug), getSettings()]);

  const jsonLd = tip?.title && {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: tip.title,
    description: tip.excerpt ?? undefined,
    url: absoluteUrl(`/tips/${slug}`),
    datePublished: tip.publishedAt ?? undefined,
    dateModified: tip.updatedAt ?? tip.publishedAt ?? undefined,
    author: { '@type': 'Organization', name: tip.author || site.name },
    publisher: {
      '@type': 'Organization',
      name: site.name,
      logo: { '@type': 'ImageObject', url: absoluteUrl('/icon.svg') },
    },
    ...(tip.imageUrl ? { image: imageUrl(tip.imageUrl) } : {}),
    inLanguage: 'en-GH',
  };

  return (
    <>
      {jsonLd && <script {...jsonLdScript(jsonLd)} />}
      {children}
    </>
  );
}
