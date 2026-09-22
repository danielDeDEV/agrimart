'use client';

import * as React from 'react';
import Link from 'next/link';
import { Heart } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { Button, Card, EmptyState, ErrorState, PageHeader } from '@/components/ui';
import { ListingCard, ListingCardSkeleton } from '@/components/shared/listing-card';
import type { Listing } from '@/lib/types';

export default function SavedListingsPage() {
  const [listings, setListings] = React.useState<Listing[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    setLoading(true);
    api
      .get<Listing[]>('/listings/favorites', { limit: 60 })
      .then((res) => { setListings(res.data.map((l) => ({ ...l, isFavorited: true }))); setError(null); })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => load(), [load]);

  return (
    <div className="space-y-6">
      <PageHeader title="Saved listings" description="Produce you have bookmarked to compare or order later." />
      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : loading ? (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <ListingCardSkeleton key={i} />)}</div>
      ) : listings.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Heart />}
            title="Nothing saved yet"
            description="Tap the heart on any listing to keep it here."
            action={<Button variant="outline" asChild><Link href="/marketplace">Browse marketplace</Link></Button>}
          />
        </Card>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {listings.map((listing) => <ListingCard key={listing.id} listing={listing} />)}
        </div>
      )}
    </div>
  );
}
