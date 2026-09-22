'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  BadgeCheck, Clock, Eye, Heart, Leaf, MapPin, Package, Smartphone, Star, Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn, formatCurrency, formatNumber, timeAgo } from '@/lib/utils';
import { QUALITY_GRADES } from '@/lib/constants';
import { listingPhotos } from '@/lib/images';
import { Badge, SmartImage } from '@/components/ui';
import type { Listing } from '@/lib/types';

export function ListingCard({
  listing,
  className,
  compact = false,
}: {
  listing: Listing;
  className?: string;
  compact?: boolean;
}) {
  const { isAuthenticated } = useAuth();
  const [favorited, setFavorited] = React.useState(!!listing.isFavorited);
  const [saving, setSaving] = React.useState(false);

  const { cover: image, isCatalogue } = listingPhotos(listing);
  const produceName = listing.produce?.name || 'Produce';
  const soldOut = listing.status === 'sold' || Number(listing.quantityRemaining) <= 0;

  const toggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!isAuthenticated) {
      toast.error('Sign in to save listings', {
        description: 'Saved listings appear in your dashboard.',
        action: { label: 'Sign in', onClick: () => (window.location.href = '/login') },
      });
      return;
    }

    setSaving(true);
    const next = !favorited;
    setFavorited(next); // optimistic — the heart should feel instant
    try {
      await api.post(`/listings/${listing.id}/favorite`);
      toast.success(next ? 'Saved to your listings' : 'Removed from saved listings');
    } catch (err) {
      setFavorited(!next);
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Link
      href={`/marketplace/${listing.code}`}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-2xl border bg-card shadow-soft transition-all duration-300',
        'hover:-translate-y-1 hover:border-primary/40 hover:shadow-lift',
        soldOut && 'opacity-75',
        className
      )}
    >
      <div className={cn('relative w-full overflow-hidden bg-muted', compact ? 'h-36' : 'h-48')}>
        <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-105">
          <SmartImage
            src={image}
            alt={produceName}
            rounded="rounded-none"
            sizes={compact ? '(max-width: 640px) 100vw, 280px' : '(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 360px'}
          />
        </div>

        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
          <div className="flex flex-wrap gap-1.5">
            {listing.isFeatured && (
              <Badge variant="gold" size="sm" className="shadow-sm">
                <Star className="fill-current" /> Featured
              </Badge>
            )}
            {listing.isOrganic && (
              <Badge variant="success" size="sm" className="shadow-sm">
                <Leaf /> Organic
              </Badge>
            )}
            {listing.isUrgent && !soldOut && (
              <Badge variant="destructive" size="sm" className="shadow-sm">
                <Zap /> Urgent
              </Badge>
            )}
          </div>

          <button
            onClick={toggleFavorite}
            disabled={saving}
            aria-label={favorited ? 'Remove from saved' : 'Save this listing'}
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-full backdrop-blur-md transition-all',
              favorited
                ? 'bg-red-500 text-white'
                : 'bg-white/80 text-slate-700 hover:bg-white hover:text-red-500 dark:bg-slate-900/70 dark:text-slate-200'
            )}
          >
            <Heart className={cn('h-4 w-4', favorited && 'fill-current')} />
          </button>
        </div>

        {soldOut && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-950/55">
            <span className="rounded-lg bg-white px-3 py-1.5 text-sm font-bold uppercase tracking-wide text-slate-900">
              Sold out
            </span>
          </div>
        )}

        {!soldOut && (listing.source === 'ussd' || isCatalogue) && (
          <div className="absolute inset-x-3 bottom-3 flex items-end justify-between gap-2">
            {listing.source === 'ussd' ? (
              <Badge variant="secondary" size="sm" className="bg-slate-900/80 text-white shadow-sm backdrop-blur-sm">
                <Smartphone /> Listed by USSD
              </Badge>
            ) : <span />}
            {isCatalogue && (
              <span
                className="rounded-md bg-slate-900/60 px-1.5 py-0.5 text-[10px] font-medium text-white/90 backdrop-blur-sm"
                title={`Representative photo of ${produceName.toLowerCase()} — the farmer has not added their own yet`}
              >
                Catalogue photo
              </span>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate font-semibold leading-tight transition-colors group-hover:text-primary">
              {produceName}
            </h3>
            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" />
              {listing.location || listing.region?.name || 'Ghana'}
            </p>
          </div>
          <Badge variant="outline" size="sm" className="shrink-0">
            {QUALITY_GRADES[listing.qualityGrade]?.label ?? listing.qualityGrade}
          </Badge>
        </div>

        <div className="mt-3 flex items-end justify-between gap-2">
          <div>
            <p className="text-xl font-bold tracking-tight text-primary-700 dark:text-primary-400">
              {formatCurrency(listing.pricePerUnit, { decimals: 0 })}
            </p>
            <p className="text-xs text-muted-foreground">per {listing.unit}</p>
          </div>
          <div className="text-right">
            <p className="flex items-center justify-end gap-1 text-sm font-semibold">
              <Package className="h-3.5 w-3.5 text-muted-foreground" />
              {formatNumber(listing.quantityRemaining)}
            </p>
            <p className="text-xs text-muted-foreground">{listing.unit} left</p>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 border-t pt-3 text-xs text-muted-foreground">
          <span className="flex min-w-0 items-center gap-1.5">
            <span className="truncate font-medium text-foreground">{listing.farmer?.fullName ?? 'Farmer'}</span>
            {listing.farmer?.isVerifiedSeller && (
              <BadgeCheck className="h-3.5 w-3.5 shrink-0 fill-primary text-white" aria-label="Verified seller" />
            )}
          </span>
          <span className="flex shrink-0 items-center gap-3">
            <span className="flex items-center gap-1">
              <Eye className="h-3 w-3" /> {formatNumber(listing.views)}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" /> {timeAgo(listing.createdAt).replace(' ago', '')}
            </span>
          </span>
        </div>
      </div>
    </Link>
  );
}

export function ListingCardSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
      <div className={cn('w-full animate-pulse bg-muted', compact ? 'h-36' : 'h-48')} />
      <div className="space-y-3 p-4">
        <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
        <div className="h-3 w-1/2 animate-pulse rounded bg-muted" />
        <div className="flex justify-between pt-2">
          <div className="h-7 w-24 animate-pulse rounded bg-muted" />
          <div className="h-7 w-16 animate-pulse rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}
