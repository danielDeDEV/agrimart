import type { Metadata, Viewport } from 'next';
import { Providers } from '@/components/providers';
import { getSettings } from '@/lib/settings.server';
import { SITE_URL } from '@/lib/site-url';
import './globals.css';

/** Titles and descriptions follow the platform name an administrator set. */
export async function generateMetadata(): Promise<Metadata> {
  const site = await getSettings();
  return {
    // Absolute URLs for share cards, canonical links and the sitemap
    metadataBase: new URL(SITE_URL),
    title: {
      default: `${site.name} — ${site.tagline}`,
      template: `%s · ${site.shortName}`,
    },
    applicationName: site.name,
    alternates: { canonical: '/' },
    description: site.description,
    keywords: [
      'Ghana agriculture', 'USSD marketplace', 'farm produce Ghana', 'market prices Ghana',
      'smallholder farmers', 'SMS agriculture', 'agritech Ghana', 'maize prices', 'Techiman market',
    ],
    authors: [{ name: site.name }],
    openGraph: {
      type: 'website',
      locale: 'en_GH',
      url: SITE_URL,
      title: `${site.name} — ${site.tagline}`,
      description: site.description,
      siteName: site.name,
    },
    twitter: {
      card: 'summary_large_image',
      title: `${site.name} — ${site.tagline}`,
      description: site.description,
    },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
    },
  };
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#15803d' },
    { media: '(prefers-color-scheme: dark)', color: '#052e16' },
  ],
  width: 'device-width',
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Read once per request and hand down, so client pages show the same values
  const settings = await getSettings();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Fonts load as an ordinary stylesheet rather than through next/font,
            so a slow or blocked connection to Google never stalls compilation —
            the system font stack in globals.css covers the page until they arrive. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@500;600;700;800&display=swap"
        />
      </head>
      <body className="min-h-screen font-sans">
        <Providers settings={settings}>{children}</Providers>
      </body>
    </html>
  );
}
