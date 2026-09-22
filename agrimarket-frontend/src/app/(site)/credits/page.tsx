import Link from 'next/link';
import type { Metadata } from 'next';
import { ExternalLink } from 'lucide-react';
import { SITE } from '@/lib/constants';
import { getSettings } from '@/lib/settings.server';
import { PHOTO_CREDITS, type PhotoCredit } from '@/lib/photo-credits';
import { Badge, SmartImage } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Photo credits',
  description: `Credits and licences for the produce and category photos used on ${SITE.name}.`,
};

function CreditCard({ credit }: { credit: PhotoCredit }) {
  return (
    <li className="group overflow-hidden rounded-2xl border bg-card shadow-soft transition-shadow hover:shadow-lift">
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-105">
          <SmartImage
            src={credit.image}
            alt={credit.name}
            rounded="rounded-none"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 33vw, 20vw"
          />
        </div>
      </div>
      <div className="space-y-1 p-3 text-xs">
        <p className="text-sm font-semibold text-foreground">{credit.name}</p>
        <p className="truncate text-muted-foreground" title={credit.author}>Photo: {credit.author}</p>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {credit.licenseUrl ? (
            <a href={credit.licenseUrl} target="_blank" rel="noopener noreferrer license" className="font-medium text-primary hover:underline">
              {credit.license}
            </a>
          ) : (
            <span className="font-medium">{credit.license}</span>
          )}
          <span aria-hidden className="text-muted-foreground">·</span>
          <a
            href={credit.source}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 text-muted-foreground hover:text-foreground hover:underline"
          >
            Source <ExternalLink className="h-3 w-3" />
          </a>
        </p>
      </div>
    </li>
  );
}

export default async function CreditsPage() {
  const site = await getSettings();
  const categories = PHOTO_CREDITS.filter((c) => c.kind === 'category');
  const produce = PHOTO_CREDITS.filter((c) => c.kind === 'produce');

  return (
    <>
      <section className="relative overflow-hidden border-b">
        <div className="absolute inset-0 mesh-bg" />
        <div className="container-wide relative max-w-3xl py-14">
          <Badge variant="secondary" className="mb-4">{PHOTO_CREDITS.length} photos</Badge>
          <h1 className="font-display text-4xl font-extrabold tracking-tight">Photo credits</h1>
          <p className="mt-4 text-lg leading-relaxed text-muted-foreground">
            Farmers who sell by USSD or SMS cannot send pictures, so every crop on {site.shortName} has a catalogue
            photo that buyers see until the farmer adds their own. These photos come from Wikimedia Commons and are
            used under the free licences listed here. They were resized and cropped to fit the site.
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Photographer and want a credit corrected? <Link href="/contact" className="font-medium text-primary hover:underline">Contact us</Link>.
          </p>
        </div>
      </section>

      <div className="container-wide space-y-12 py-12">
        <section>
          <h2 className="font-display text-xl font-bold">Categories</h2>
          <ul className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {categories.map((credit) => <CreditCard key={credit.image} credit={credit} />)}
          </ul>
        </section>
        <section>
          <h2 className="font-display text-xl font-bold">Produce</h2>
          <ul className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {produce.map((credit) => <CreditCard key={credit.image} credit={credit} />)}
          </ul>
        </section>
      </div>
    </>
  );
}
