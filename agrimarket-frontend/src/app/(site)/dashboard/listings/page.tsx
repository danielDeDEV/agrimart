'use client';

import * as React from 'react';
import Link from 'next/link';
import { Camera, CheckCircle2, Eye, HandCoins, MoreHorizontal, Package, Pencil, PlusCircle, Trash2, Undo2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage, type ApiResponse } from '@/lib/api';
import { cn, formatCurrency, formatNumber, timeAgo } from '@/lib/utils';
import { CHANNEL_META, LISTING_STATUS } from '@/lib/constants';
import { listingPhotos } from '@/lib/images';
import { ListingPhotosDialog } from '@/components/shared/listing-photos-dialog';
import {
  Badge, Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
  EmptyState, ErrorState, Input, Label, PageHeader, Pagination, SmartImage, StatusBadge, TableSkeleton,
} from '@/components/ui';
import type { Listing } from '@/lib/types';

const TABS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Live' },
  { value: 'reserved', label: 'Reserved' },
  { value: 'sold', label: 'Sold' },
  { value: 'expired', label: 'Expired' },
  { value: 'withdrawn', label: 'Withdrawn' },
];

export default function MyListingsPage() {
  const [status, setStatus] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [listings, setListings] = React.useState<Listing[]>([]);
  const [meta, setMeta] = React.useState<ApiResponse['meta']>();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [editing, setEditing] = React.useState<Listing | null>(null);
  const [editForm, setEditForm] = React.useState({ pricePerUnit: '', quantityRemaining: '' });
  const [deleting, setDeleting] = React.useState<Listing | null>(null);
  const [photosFor, setPhotosFor] = React.useState<Listing | null>(null);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<Listing[]>('/listings/mine', { status: status || undefined, page, limit: 10 });
      setListings(res.data);
      setMeta(res.meta);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [status, page]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const update = async (listing: Listing, patch: Record<string, unknown>, message: string) => {
    setBusy(true);
    try {
      await api.patch(`/listings/${listing.id}`, patch);
      toast.success(message);
      await load();
      return true;
    } catch (err) {
      toast.error(errorMessage(err));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    const price = Number(editForm.pricePerUnit);
    const qty = Number(editForm.quantityRemaining);
    if (!price || price <= 0) return toast.error('Enter a valid price');
    if (qty < 0) return toast.error('Quantity cannot be negative');
    const ok = await update(editing, { pricePerUnit: price, quantityRemaining: qty }, 'Listing updated');
    if (ok) setEditing(null);
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await api.delete(`/listings/${deleting.id}`);
      toast.success('Listing removed');
      setDeleting(null);
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="My listings"
        description="Everything you have put up for sale, from the web, USSD or SMS."
        action={<Button variant="gradient" asChild><Link href="/dashboard/listings/new"><PlusCircle /> New listing</Link></Button>}
      />

      <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-xl bg-muted p-1">
        {TABS.map((tab) => (
          <button
            key={tab.value || 'all'}
            onClick={() => {
              setStatus(tab.value);
              setPage(1);
            }}
            className={cn(
              'shrink-0 rounded-lg px-4 py-1.5 text-sm font-medium transition-all',
              status === tab.value ? 'bg-background text-foreground shadow-soft' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
        {error ? (
          <ErrorState message={error} onRetry={load} />
        ) : loading ? (
          <TableSkeleton rows={5} cols={5} />
        ) : listings.length === 0 ? (
          <EmptyState
            icon={<Package />}
            title={status ? 'Nothing in this tab' : 'You have not listed anything yet'}
            description="A listing takes under a minute — or dial *920*1234# and choose 1."
            action={<Button variant="gradient" asChild><Link href="/dashboard/listings/new"><PlusCircle /> Create listing</Link></Button>}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Produce</th>
                    <th className="text-right">Price</th>
                    <th className="text-right">Stock left</th>
                    <th className="text-right">Interest</th>
                    <th>Status</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {listings.map((listing) => {
                    const channel = CHANNEL_META[listing.source];
                    const sold = Number(listing.quantity) - Number(listing.quantityRemaining);
                    const { cover, isCatalogue } = listingPhotos(listing);
                    return (
                      <tr key={listing.id}>
                        <td>
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => setPhotosFor(listing)}
                              className="group/photo relative h-11 w-11 shrink-0 overflow-hidden rounded-xl ring-primary/40 transition hover:ring-2"
                              aria-label={`Manage photos of ${listing.produce?.name ?? 'this listing'}`}
                              title={isCatalogue ? 'Showing the catalogue photo — add your own' : 'Manage photos'}
                            >
                              <SmartImage src={cover} alt={listing.produce?.name ?? 'Produce'} sizes="44px" />
                              <span className="absolute inset-0 flex items-center justify-center bg-slate-900/55 text-white opacity-0 transition-opacity group-hover/photo:opacity-100">
                                <Camera className="h-4 w-4" />
                              </span>
                            </button>
                            <div className="min-w-0">
                              <Link href={`/marketplace/${listing.code}`} className="font-semibold hover:text-primary">
                                {listing.produce?.name}
                              </Link>
                              <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                                <code className="font-mono">{listing.code}</code>
                                <Badge variant="outline" size="sm">{channel?.label ?? listing.source}</Badge>
                                {isCatalogue && (
                                  <button type="button" onClick={() => setPhotosFor(listing)} className="font-medium text-primary hover:underline">
                                    Stock photo · add yours
                                  </button>
                                )}
                                <span>{timeAgo(listing.createdAt)}</span>
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="text-right">
                          <p className="font-semibold tabular-nums">{formatCurrency(listing.pricePerUnit, { decimals: 0 })}</p>
                          <p className="text-xs text-muted-foreground">per {listing.unit}</p>
                        </td>
                        <td className="text-right">
                          <p className="font-semibold tabular-nums">{formatNumber(listing.quantityRemaining)}</p>
                          <p className="text-xs text-muted-foreground">{formatNumber(sold)} of {formatNumber(listing.quantity)} sold</p>
                        </td>
                        <td className="text-right text-xs text-muted-foreground">
                          <p className="flex items-center justify-end gap-1"><Eye className="h-3 w-3" /> {formatNumber(listing.views)}</p>
                          <p className="flex items-center justify-end gap-1"><HandCoins className="h-3 w-3" /> {listing.offerCount} offers</p>
                        </td>
                        <td>
                          <StatusBadge status={listing.status} map={LISTING_STATUS} />
                          {listing.rejectionReason && <p className="mt-1 max-w-[180px] text-xs text-destructive">{listing.rejectionReason}</p>}
                        </td>
                        <td>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon-sm" aria-label="Listing actions"><MoreHorizontal /></Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/marketplace/${listing.code}`}><Eye /> View public page</Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditing(listing);
                                  setEditForm({ pricePerUnit: String(listing.pricePerUnit), quantityRemaining: String(listing.quantityRemaining) });
                                }}
                              >
                                <Pencil /> Edit price &amp; stock
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => setPhotosFor(listing)}>
                                <Camera /> {isCatalogue ? 'Add photos' : 'Manage photos'}
                              </DropdownMenuItem>
                              {listing.status === 'active' && (
                                <DropdownMenuItem onClick={() => update(listing, { status: 'sold', quantityRemaining: 0 }, 'Marked as sold')}>
                                  <CheckCircle2 /> Mark as sold
                                </DropdownMenuItem>
                              )}
                              {['withdrawn', 'expired'].includes(listing.status) && (
                                <DropdownMenuItem onClick={() => update(listing, { status: 'active' }, 'Listing is live again')}>
                                  <Undo2 /> Relist
                                </DropdownMenuItem>
                              )}
                              {listing.status === 'active' && (
                                <DropdownMenuItem onClick={() => update(listing, { status: 'withdrawn' }, 'Listing withdrawn')}>
                                  <Undo2 /> Withdraw
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem destructive onClick={() => setDeleting(listing)}>
                                <Trash2 /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {meta && <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} limit={meta.limit} onPageChange={setPage} />}
          </>
        )}
      </div>

      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit {editing?.produce?.name}</DialogTitle>
            <DialogDescription>Buyers see the new price and stock immediately.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Price per {editing?.unit}</Label>
              <Input type="number" value={editForm.pricePerUnit} onChange={(e) => setEditForm((f) => ({ ...f, pricePerUnit: e.target.value }))} suffix="GHS" />
            </div>
            <div className="space-y-2">
              <Label>Stock remaining</Label>
              <Input type="number" value={editForm.quantityRemaining} onChange={(e) => setEditForm((f) => ({ ...f, quantityRemaining: e.target.value }))} suffix={editing?.unit.split(' ')[0]} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button variant="gradient" loading={busy} onClick={saveEdit}>Save changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ListingPhotosDialog listing={photosFor} onClose={() => setPhotosFor(null)} onSaved={() => void load()} />

      <Dialog open={!!deleting} onOpenChange={(open) => !open && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this listing?</DialogTitle>
            <DialogDescription>
              {deleting?.produce?.name} ({deleting?.code}) will be removed from the marketplace. Listings with open orders cannot be deleted.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleting(null)}>Keep it</Button>
            <Button variant="destructive" loading={busy} onClick={confirmDelete}>Delete listing</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
