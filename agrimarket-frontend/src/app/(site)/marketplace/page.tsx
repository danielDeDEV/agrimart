'use client';

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Filter, LayoutGrid, List, PackageSearch, Search, SlidersHorizontal, X } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { cn, formatCurrency, formatNumber } from '@/lib/utils';
import { listingPhotos } from '@/lib/images';
import { useSettings } from '@/components/settings-provider';
import {
  Badge, Button, EmptyState, ErrorState, Input, Label, Pagination,
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SmartImage, Switch,
} from '@/components/ui';
import { ListingCard, ListingCardSkeleton } from '@/components/shared/listing-card';
import type { ApiResponse } from '@/lib/api';
import type { Category, Listing, Region } from '@/lib/types';
import Link from 'next/link';

const SORTS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'price_low', label: 'Price: low to high' },
  { value: 'price_high', label: 'Price: high to low' },
  { value: 'quantity', label: 'Largest quantity' },
  { value: 'popular', label: 'Most viewed' },
];

const ALL = 'all';

function MarketplaceView() {
  const site = useSettings();
  const router = useRouter();
  const params = useSearchParams();

  const filters = {
    search: params.get('search') ?? '',
    categoryId: params.get('categoryId') ?? '',
    regionId: params.get('regionId') ?? '',
    qualityGrade: params.get('qualityGrade') ?? '',
    minPrice: params.get('minPrice') ?? '',
    maxPrice: params.get('maxPrice') ?? '',
    isOrganic: params.get('isOrganic') === 'true',
    sort: params.get('sort') ?? 'newest',
    page: Number(params.get('page') ?? 1),
  };

  /**
   * An empty page means two very different things: "your filters found
   * nothing" or "nobody has listed produce yet". On a platform's first days
   * the second is the common one, and telling a visitor to widen their price
   * range when there is nothing to find reads as though the site is broken.
   */
  const hasFilters = Boolean(
    filters.search || filters.categoryId || filters.regionId || filters.qualityGrade ||
    filters.minPrice || filters.maxPrice || filters.isOrganic
  );

  const [listings, setListings] = React.useState<Listing[]>([]);
  const [meta, setMeta] = React.useState<ApiResponse['meta']>();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [regions, setRegions] = React.useState<Region[]>([]);
  const [searchDraft, setSearchDraft] = React.useState(filters.search);
  const [view, setView] = React.useState<'grid' | 'list'>('grid');
  const [filtersOpen, setFiltersOpen] = React.useState(false);

  React.useEffect(() => {
    api.get<Category[]>('/reference/categories', { withCounts: true }).then((r) => setCategories(r.data)).catch(() => {});
    api.get<Region[]>('/reference/regions').then((r) => setRegions(r.data)).catch(() => {});
  }, []);

  React.useEffect(() => setSearchDraft(filters.search), [filters.search]);

  const queryString = params.toString();

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const query = Object.fromEntries(new URLSearchParams(queryString));
      const res = await api.get<Listing[]>('/listings', { limit: 12, ...query });
      setListings(res.data);
      setMeta(res.meta);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const update = (patch: Record<string, string | boolean | number | undefined>) => {
    const next = new URLSearchParams(params.toString());
    Object.entries(patch).forEach(([key, value]) => {
      if (value === undefined || value === '' || value === false || value === ALL) next.delete(key);
      else next.set(key, String(value));
    });
    if (!('page' in patch)) next.delete('page');
    router.push(`/marketplace?${next.toString()}`, { scroll: false });
  };

  const activeCategory = categories.find((c) => String(c.id) === filters.categoryId);
  const activeRegion = regions.find((r) => String(r.id) === filters.regionId);
  const activeFilterCount = [
    filters.categoryId, filters.regionId, filters.qualityGrade, filters.minPrice, filters.maxPrice, filters.isOrganic,
  ].filter(Boolean).length;

  const filterPanel = (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label>Category</Label>
        <div className="space-y-1">
          <button
            onClick={() => update({ categoryId: undefined })}
            className={cn(
              'flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors',
              !filters.categoryId ? 'bg-primary-50 font-semibold text-primary-800 dark:bg-primary-950/60 dark:text-primary-200' : 'hover:bg-muted'
            )}
          >
            All produce
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => update({ categoryId: c.id })}
              className={cn(
                'flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors',
                filters.categoryId === String(c.id)
                  ? 'bg-primary-50 font-semibold text-primary-800 dark:bg-primary-950/60 dark:text-primary-200'
                  : 'hover:bg-muted'
              )}
            >
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: c.color }} />
                {c.name}
              </span>
              <span className="text-xs text-muted-foreground">{c.listingCount ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Region</Label>
        <Select value={filters.regionId || ALL} onValueChange={(v) => update({ regionId: v })}>
          <SelectTrigger>
            <SelectValue placeholder="All regions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All regions</SelectItem>
            {regions.map((r) => (
              <SelectItem key={r.id} value={String(r.id)}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Price per unit (GHS)</Label>
        <div className="grid grid-cols-2 gap-2">
          <Input
            type="number"
            placeholder="Min"
            defaultValue={filters.minPrice}
            onBlur={(e) => update({ minPrice: e.target.value })}
          />
          <Input
            type="number"
            placeholder="Max"
            defaultValue={filters.maxPrice}
            onBlur={(e) => update({ maxPrice: e.target.value })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Quality grade</Label>
        <div className="grid grid-cols-4 gap-1.5">
          {['', 'A', 'B', 'C'].map((grade) => (
            <button
              key={grade || 'any'}
              onClick={() => update({ qualityGrade: grade })}
              className={cn(
                'rounded-lg border-2 py-2 text-sm font-semibold transition-colors',
                filters.qualityGrade === grade
                  ? 'border-primary bg-primary text-white'
                  : 'border-border hover:border-primary/40'
              )}
            >
              {grade || 'Any'}
            </button>
          ))}
        </div>
      </div>

      <label className="flex cursor-pointer items-center justify-between rounded-xl border p-3">
        <span className="text-sm font-medium">Organic only</span>
        <Switch checked={filters.isOrganic} onCheckedChange={(v) => update({ isOrganic: v })} />
      </label>

      {activeFilterCount > 0 && (
        <Button variant="ghost" className="w-full" onClick={() => router.push('/marketplace')}>
          <X /> Clear all filters
        </Button>
      )}
    </div>
  );

  return (
    <div>
      {/* Header band */}
      <section className="relative overflow-hidden border-b">
        <div className="absolute inset-0 mesh-bg" />
        <div className="container-wide relative py-10 lg:py-14">
          <Badge variant="success" className="mb-3">
            {formatNumber(meta?.total ?? 0)} live listings
          </Badge>
          <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Marketplace</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Buy directly from Ghanaian farms. Every listing shows the farmer, grade, quantity and location —
            and many are posted straight from a feature phone.
          </p>

          <form
            className="mt-7 flex max-w-2xl gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              update({ search: searchDraft.trim() });
            }}
          >
            <Input
              value={searchDraft}
              onChange={(e) => setSearchDraft(e.target.value)}
              placeholder="Search by produce, location or listing code…"
              icon={<Search />}
              className="h-12 bg-card"
            />
            <Button type="submit" size="lg" variant="gradient">
              Search
            </Button>
          </form>

          <div className="no-scrollbar mt-5 flex gap-2 overflow-x-auto pb-1">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => update({ categoryId: filters.categoryId === String(c.id) ? undefined : c.id })}
                className={cn(
                  'flex shrink-0 items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all',
                  filters.categoryId === String(c.id)
                    ? 'border-primary bg-primary text-white shadow-glow'
                    : 'bg-card hover:border-primary/40 hover:shadow-soft'
                )}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.color }} />
                {c.name}
              </button>
            ))}
          </div>
        </div>
      </section>

      <div className="container-wide grid gap-8 py-10 lg:grid-cols-[260px_1fr]">
        {/* Sidebar filters */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 rounded-2xl border bg-card p-5 shadow-soft">
            <h2 className="mb-5 flex items-center gap-2 font-semibold">
              <SlidersHorizontal className="h-4 w-4" /> Filters
            </h2>
            {filterPanel}
          </div>
        </aside>

        <div className="min-w-0">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" className="lg:hidden" onClick={() => setFiltersOpen((v) => !v)}>
                <Filter /> Filters {activeFilterCount > 0 && `(${activeFilterCount})`}
              </Button>
              {filters.search && (
                <Badge variant="secondary" className="cursor-pointer" onClick={() => update({ search: '' })}>
                  “{filters.search}” <X />
                </Badge>
              )}
              {activeCategory && (
                <Badge variant="secondary" className="cursor-pointer" onClick={() => update({ categoryId: undefined })}>
                  {activeCategory.name} <X />
                </Badge>
              )}
              {activeRegion && (
                <Badge variant="secondary" className="cursor-pointer" onClick={() => update({ regionId: undefined })}>
                  {activeRegion.name} <X />
                </Badge>
              )}
              {!loading && (
                <span className="text-sm text-muted-foreground">
                  {formatNumber(meta?.total ?? 0)} result{meta?.total === 1 ? '' : 's'}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Select value={filters.sort} onValueChange={(v) => update({ sort: v })}>
                <SelectTrigger className="h-9 w-[190px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORTS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="hidden rounded-lg border p-0.5 sm:flex">
                <Button variant={view === 'grid' ? 'secondary' : 'ghost'} size="icon-sm" onClick={() => setView('grid')} aria-label="Grid view">
                  <LayoutGrid />
                </Button>
                <Button variant={view === 'list' ? 'secondary' : 'ghost'} size="icon-sm" onClick={() => setView('list')} aria-label="List view">
                  <List />
                </Button>
              </div>
            </div>
          </div>

          {filtersOpen && <div className="mt-4 rounded-2xl border bg-card p-5 shadow-soft lg:hidden">{filterPanel}</div>}

          {/* Results */}
          <div className="mt-6">
            {error ? (
              <ErrorState message={error} onRetry={load} />
            ) : loading ? (
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {Array.from({ length: 9 }).map((_, i) => (
                  <ListingCardSkeleton key={i} />
                ))}
              </div>
            ) : listings.length === 0 ? (
              <EmptyState
                icon={<PackageSearch />}
                title={hasFilters ? 'No listings match those filters' : 'No produce listed yet'}
                description={
                  hasFilters
                    ? 'Try widening your price range or choosing a different region. New produce is listed every day.'
                    : `The marketplace is new. Farmers list produce by dialling ${site.ussdCode} on any phone — the first harvests will appear here as they do.`
                }
                action={
                  hasFilters ? (
                    <Button variant="outline" onClick={() => router.push('/marketplace')}>
                      Clear filters
                    </Button>
                  ) : (
                    <Button variant="gradient" onClick={() => router.push('/register')}>
                      Sell your harvest
                    </Button>
                  )
                }
              />
            ) : view === 'grid' ? (
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {listings.map((listing) => (
                  <ListingCard key={listing.id} listing={listing} />
                ))}
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
                {listings.map((listing) => (
                  <Link
                    key={listing.id}
                    href={`/marketplace/${listing.code}`}
                    className="flex items-center gap-4 border-b p-4 transition-colors last:border-0 hover:bg-muted/50"
                  >
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl">
                      <SmartImage sizes="64px" src={listingPhotos(listing).cover} alt={listing.produce?.name ?? 'Produce'} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{listing.produce?.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {listing.farmer?.fullName} · {listing.location || listing.region?.name} · Grade {listing.qualityGrade}
                      </p>
                    </div>
                    <div className="hidden text-right sm:block">
                      <p className="text-sm font-semibold">{formatNumber(listing.quantityRemaining)} {listing.unit}</p>
                      <p className="text-xs text-muted-foreground">available</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-primary-700 dark:text-primary-400">
                        {formatCurrency(listing.pricePerUnit, { decimals: 0 })}
                      </p>
                      <p className="text-xs text-muted-foreground">per {listing.unit}</p>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {meta && (
              <Pagination
                className="mt-6 rounded-2xl border bg-card"
                page={meta.page}
                totalPages={meta.totalPages}
                total={meta.total}
                limit={meta.limit}
                onPageChange={(page) => {
                  update({ page });
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function MarketplacePage() {
  return (
    <React.Suspense fallback={<div className="container-wide py-20"><div className="h-96 animate-pulse rounded-2xl bg-muted" /></div>}>
      <MarketplaceView />
    </React.Suspense>
  );
}
