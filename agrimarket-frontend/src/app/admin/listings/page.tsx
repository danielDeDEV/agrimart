'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Download, ExternalLink, MoreHorizontal, Package, Search, Star, Undo2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage, type ApiResponse } from '@/lib/api';
import { csvFilename, exportTable } from '@/lib/export-csv';
import { cn, formatCurrency, formatNumber, timeAgo } from '@/lib/utils';
import { CHANNEL_META, LISTING_STATUS } from '@/lib/constants';
import { listingPhotos } from '@/lib/images';
import {
  Badge, Button, Card, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, EmptyState,
  ErrorState, Input, Label, PageHeader, Pagination, Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  SmartImage, StatusBadge, TableSkeleton, Textarea,
} from '@/components/ui';
import type { Listing } from '@/lib/types';

const ALL = 'all';
const TABS = ['', 'pending', 'active', 'reserved', 'sold', 'expired', 'rejected', 'withdrawn'];

function ListingsView() {
  const params = useSearchParams();
  const [status, setStatus] = React.useState(params.get('status') ?? '');
  const [source, setSource] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [rows, setRows] = React.useState<Listing[]>([]);
  const [meta, setMeta] = React.useState<ApiResponse['meta']>();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [target, setTarget] = React.useState<{ listing: Listing; action: 'reject' | 'suspend' } | null>(null);
  const [reason, setReason] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const [exporting, setExporting] = React.useState(false);

  /** Downloads the rows the current filters match, for accounting and reporting. */
  const exportCsv = async () => {
    setExporting(true);
    try {
      const count = await exportTable<Listing>({
        endpoint: '/admin/listings',
        params: { status: status || undefined, source: source || undefined, search: query || undefined },
        filename: csvFilename('listings'),
        columns: [
          { header: 'Code', value: (l) => l.code },
          { header: 'Listed', value: (l) => l.createdAt.slice(0, 10) },
          { header: 'Produce', value: (l) => l.produce?.name ?? '' },
          { header: 'Quantity', value: (l) => `${l.quantity} ${l.unit}` },
          { header: 'Remaining', value: (l) => Number(l.quantityRemaining ?? 0) },
          { header: 'Price per unit (GHS)', value: (l) => Number(l.pricePerUnit ?? 0) },
          { header: 'Grade', value: (l) => l.qualityGrade ?? '' },
          { header: 'Status', value: (l) => l.status },
          { header: 'Farmer', value: (l) => l.farmer?.fullName ?? '' },
          { header: 'Farmer phone', value: (l) => l.farmer?.phone ?? '' },
          { header: 'Region', value: (l) => l.region?.name ?? '' },
          { header: 'Channel', value: (l) => l.source },
          { header: 'Views', value: (l) => Number(l.views ?? 0) },
        ],
      });
      toast.success(`${count.toLocaleString()} rows exported`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<Listing[]>('/admin/listings', { status: status || undefined, source: source || undefined, search: query || undefined, page, limit: 20 });
      setRows(res.data);
      setMeta(res.meta);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [status, source, query, page]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const moderate = async (listing: Listing, action: string, extra: Record<string, unknown> = {}) => {
    setBusy(true);
    try {
      const res = await api.patch(`/admin/listings/${listing.id}/moderate`, { action, ...extra });
      toast.success(res.message, { description: action !== 'feature' ? 'The farmer has been notified by SMS.' : undefined });
      setTarget(null);
      setReason('');
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
        title="Listings"
        description="Moderate produce listings from every channel. Listings publish instantly; review happens after."
        action={<Button variant="outline" loading={exporting} onClick={exportCsv}><Download /> Export CSV</Button>}
      />

      <Card className="space-y-3 p-4">
        <div className="no-scrollbar flex gap-1 overflow-x-auto rounded-xl bg-muted p-1">
          {TABS.map((t) => (
            <button key={t || 'all'} onClick={() => { setStatus(t); setPage(1); }} className={cn('shrink-0 rounded-lg px-3.5 py-1.5 text-sm font-medium', status === t ? 'bg-background shadow-soft' : 'text-muted-foreground hover:text-foreground')}>
              {t ? LISTING_STATUS[t as keyof typeof LISTING_STATUS].label : 'All'}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select value={source || ALL} onValueChange={(v) => { setSource(v === ALL ? '' : v); setPage(1); }}>
            <SelectTrigger className="h-10 w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Any channel</SelectItem>
              {(['ussd', 'web', 'sms', 'agent'] as const).map((c) => <SelectItem key={c} value={c}>{CHANNEL_META[c].label}</SelectItem>)}
            </SelectContent>
          </Select>
          <form className="ml-auto" onSubmit={(e) => { e.preventDefault(); setQuery(search.trim()); setPage(1); }}>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Code, title, location" icon={<Search />} className="h-10 w-64" />
          </form>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {error ? <ErrorState message={error} onRetry={load} /> : loading ? <TableSkeleton rows={8} cols={6} /> : rows.length === 0 ? (
          <EmptyState icon={<Package />} title="No listings here" />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>Listing</th><th>Farmer</th><th className="text-right">Price</th><th className="text-right">Stock</th><th>Channel</th><th>Status</th><th className="w-10" /></tr></thead>
                <tbody>
                  {rows.map((l) => (
                    <tr key={l.id}>
                      <td>
                        <div className="flex items-center gap-3">
                          <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg"><SmartImage sizes="40px" src={listingPhotos(l).cover} alt={l.produce?.name ?? 'Produce'} /></div>
                          <div>
                            <p className="flex items-center gap-1 font-medium">{l.produce?.name} {l.isFeatured && <Star className="h-3.5 w-3.5 fill-gold-400 text-gold-400" />}</p>
                            <p className="text-xs text-muted-foreground"><code className="font-mono">{l.code}</code> · {timeAgo(l.createdAt)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="text-sm"><Link href={`/admin/users/${l.farmerId}`} className="hover:text-primary">{l.farmer?.fullName}</Link><p className="text-xs text-muted-foreground">{l.location || l.region?.name}</p></td>
                      <td className="text-right tabular-nums">{formatCurrency(l.pricePerUnit, { decimals: 0 })}<p className="text-xs text-muted-foreground">/{l.unit}</p></td>
                      <td className="text-right tabular-nums">{formatNumber(l.quantityRemaining)}<p className="text-xs text-muted-foreground">of {formatNumber(l.quantity)}</p></td>
                      <td><Badge variant="outline" size="sm">{CHANNEL_META[l.source]?.label}</Badge></td>
                      <td><StatusBadge status={l.status} map={LISTING_STATUS} />{l.rejectionReason && <p className="mt-1 max-w-[160px] truncate text-xs text-destructive" title={l.rejectionReason}>{l.rejectionReason}</p>}</td>
                      <td>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="Moderate"><MoreHorizontal /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild><Link href={`/marketplace/${l.code}`} target="_blank"><ExternalLink /> View public page</Link></DropdownMenuItem>
                            {l.status !== 'active' && <DropdownMenuItem onClick={() => moderate(l, 'approve')}><CheckCircle2 /> Approve &amp; publish</DropdownMenuItem>}
                            <DropdownMenuItem onClick={() => moderate(l, 'feature', { isFeatured: !l.isFeatured })}><Star /> {l.isFeatured ? 'Unfeature' : 'Feature on homepage'}</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {l.status === 'active' && <DropdownMenuItem onClick={() => setTarget({ listing: l, action: 'suspend' })}><Undo2 /> Take down</DropdownMenuItem>}
                            {l.status !== 'rejected' && <DropdownMenuItem destructive onClick={() => setTarget({ listing: l, action: 'reject' })}><XCircle /> Reject</DropdownMenuItem>}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {meta && <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} limit={meta.limit} onPageChange={setPage} />}
          </>
        )}
      </Card>

      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{target?.action === 'reject' ? 'Reject' : 'Take down'} {target?.listing.code}</DialogTitle>
            <DialogDescription>{target?.listing.farmer?.fullName} receives this reason by SMS so they can fix and relist.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label required={target?.action === 'reject'}>Reason</Label>
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Price entered per kg but unit is bag" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>Cancel</Button>
            <Button variant="destructive" loading={busy} disabled={target?.action === 'reject' && !reason.trim()} onClick={() => target && moderate(target.listing, target.action, { reason: reason.trim() || undefined })}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminListingsPage() {
  return <React.Suspense fallback={<TableSkeleton />}><ListingsView /></React.Suspense>;
}
