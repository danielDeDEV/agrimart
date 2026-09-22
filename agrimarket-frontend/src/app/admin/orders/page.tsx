'use client';

import * as React from 'react';
import Link from 'next/link';
import { CheckCircle2, Circle, Download, Search, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage, type ApiResponse } from '@/lib/api';
import { csvFilename, exportTable } from '@/lib/export-csv';
import { cn, formatCurrency, formatDateTime, formatNumber, titleCase } from '@/lib/utils';
import { CHANNEL_META, ORDER_STATUS } from '@/lib/constants';
import {
  Badge, Button, Card, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, EmptyState,
  ErrorState, Input, Label, PageHeader, Pagination, Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  StatusBadge, TableSkeleton, Textarea,
} from '@/components/ui';
import type { Order, OrderStatus } from '@/lib/types';

const ALL = 'all';

/** Mirrors the backend transition graph so the console only offers legal moves. */
const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['accepted', 'rejected', 'cancelled'],
  accepted: ['paid', 'in_transit', 'delivered', 'cancelled', 'disputed'],
  paid: ['in_transit', 'delivered', 'disputed', 'cancelled'],
  in_transit: ['delivered', 'disputed'],
  delivered: ['completed', 'disputed'],
  completed: [],
  rejected: [],
  cancelled: [],
  disputed: ['completed', 'cancelled'],
};

export default function AdminOrdersPage() {
  const [status, setStatus] = React.useState('');
  const [source, setSource] = React.useState('');
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [rows, setRows] = React.useState<Order[]>([]);
  const [meta, setMeta] = React.useState<ApiResponse['meta']>();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [selected, setSelected] = React.useState<Order | null>(null);
  const [nextStatus, setNextStatus] = React.useState('');
  const [reason, setReason] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const [exporting, setExporting] = React.useState(false);

  /** Downloads the rows the current filters match, for accounting and reporting. */
  const exportCsv = async () => {
    setExporting(true);
    try {
      const count = await exportTable<Order>({
        endpoint: '/admin/orders',
        params: { status: status || undefined, search: query || undefined },
        filename: csvFilename('orders'),
        columns: [
          { header: 'Order', value: (o) => o.code },
          { header: 'Date', value: (o) => o.createdAt.slice(0, 10) },
          { header: 'Produce', value: (o) => o.listing?.produce?.name ?? '' },
          { header: 'Quantity', value: (o) => `${o.quantity} ${o.unit}` },
          { header: 'Unit price (GHS)', value: (o) => Number(o.unitPrice ?? 0) },
          { header: 'Total (GHS)', value: (o) => Number(o.totalAmount ?? 0) },
          { header: 'Commission (GHS)', value: (o) => Number(o.commission ?? 0) },
          { header: 'Farmer payout (GHS)', value: (o) => Number(o.farmerPayout ?? 0) },
          { header: 'Status', value: (o) => o.status },
          { header: 'Payment', value: (o) => o.paymentStatus },
          { header: 'Farmer', value: (o) => o.farmer?.fullName ?? '' },
          { header: 'Farmer phone', value: (o) => o.farmer?.phone ?? '' },
          { header: 'Buyer', value: (o) => o.buyer?.fullName ?? '' },
          { header: 'Buyer phone', value: (o) => o.buyer?.phone ?? '' },
          { header: 'Channel', value: (o) => o.source },
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
      const res = await api.get<Order[]>('/admin/orders', {
        status: status || undefined, source: source || undefined, from: from || undefined, to: to || undefined,
        search: query || undefined, page, limit: 20,
      });
      setRows(res.data);
      setMeta(res.meta);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [status, source, from, to, query, page]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const override = async () => {
    if (!selected || !nextStatus) return;
    setBusy(true);
    try {
      const res = await api.patch<Order>(`/orders/${selected.id}/status`, { status: nextStatus, reason: reason || undefined, note: reason || 'Updated by administrator' });
      toast.success(res.message, { description: 'Both parties were notified.' });
      setSelected(res.data);
      setNextStatus('');
      setReason('');
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const options = selected ? TRANSITIONS[selected.status] : [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Orders"
        description="Every trade on the platform. Open an order to see its full timeline or resolve a dispute."
        action={<Button variant="outline" loading={exporting} onClick={exportCsv}><Download /> Export CSV</Button>}
      />

      <Card className="flex flex-wrap items-end gap-3 p-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Status</Label>
          <Select value={status || ALL} onValueChange={(v) => { setStatus(v === ALL ? '' : v); setPage(1); }}>
            <SelectTrigger className="h-10 w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Any status</SelectItem>
              {Object.entries(ORDER_STATUS).map(([v, m]) => <SelectItem key={v} value={v}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Channel</Label>
          <Select value={source || ALL} onValueChange={(v) => { setSource(v === ALL ? '' : v); setPage(1); }}>
            <SelectTrigger className="h-10 w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Any</SelectItem>
              {(['ussd', 'web', 'sms'] as const).map((c) => <SelectItem key={c} value={c}>{CHANNEL_META[c].label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">From</Label><Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="h-10" /></div>
        <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">To</Label><Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="h-10" /></div>
        <form className="ml-auto" onSubmit={(e) => { e.preventDefault(); setQuery(search.trim()); setPage(1); }}>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Order code" icon={<Search />} className="h-10 w-52" />
        </form>
      </Card>

      <Card className="overflow-hidden">
        {error ? <ErrorState message={error} onRetry={load} /> : loading ? <TableSkeleton rows={8} cols={6} /> : rows.length === 0 ? (
          <EmptyState icon={<ShoppingCart />} title="No orders match" />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>Order</th><th>Buyer</th><th>Farmer</th><th className="text-right">Quantity</th><th className="text-right">Total</th><th className="text-right">Commission</th><th>Status</th><th>Placed</th></tr></thead>
                <tbody>
                  {rows.map((o) => (
                    <tr key={o.id} className="cursor-pointer" onClick={() => { setSelected(o); setNextStatus(''); setReason(''); }}>
                      <td><p className="font-medium">{o.listing?.produce?.name}</p><p className="text-xs text-muted-foreground"><code className="font-mono">{o.code}</code> · {CHANNEL_META[o.source]?.label}</p></td>
                      <td className="text-sm">{o.buyer?.businessName || o.buyer?.fullName}</td>
                      <td className="text-sm">{o.farmer?.fullName}</td>
                      <td className="text-right tabular-nums">{formatNumber(o.quantity)} {o.unit}</td>
                      <td className="text-right font-semibold tabular-nums">{formatCurrency(o.totalAmount, { decimals: 0 })}</td>
                      <td className="text-right tabular-nums text-muted-foreground">{formatCurrency(o.commission, { decimals: 2 })}</td>
                      <td><StatusBadge status={o.status} map={ORDER_STATUS} /></td>
                      <td className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(o.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {meta && <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} limit={meta.limit} onPageChange={setPage} />}
          </>
        )}
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">{selected.code} <StatusBadge status={selected.status} map={ORDER_STATUS} /></DialogTitle>
                <DialogDescription>
                  {formatNumber(selected.quantity)} {selected.unit} of {selected.listing?.produce?.name} · {formatCurrency(selected.totalAmount)} · {selected.paymentMethod} / {selected.deliveryMethod}
                </DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 sm:grid-cols-2">
                {[['Buyer', selected.buyer], ['Farmer', selected.farmer]].map(([label, party]) => {
                  const p = party as Order['buyer'];
                  return (
                    <div key={label as string} className="rounded-xl border p-3">
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label as string}</p>
                      <Link href={`/admin/users/${p?.id}`} className="mt-1 block font-semibold hover:text-primary">{p?.businessName || p?.fullName}</Link>
                      <p className="text-sm text-muted-foreground">{p?.phone}</p>
                    </div>
                  );
                })}
              </div>

              <div>
                <p className="mb-3 text-sm font-semibold">Timeline</p>
                <ol className="space-y-3">
                  {(selected.timeline ?? []).map((t, i, arr) => (
                    <li key={`${t.at}-${i}`} className="flex gap-3">
                      {i === arr.length - 1 ? <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" /> : <Circle className="h-5 w-5 shrink-0 text-border" />}
                      <div className="text-sm">
                        <p className="font-medium">{ORDER_STATUS[t.status as OrderStatus]?.label ?? titleCase(t.status)} <span className="font-normal text-muted-foreground">by {t.actor}</span></p>
                        {t.note && <p className="text-muted-foreground">{t.note}</p>}
                        <p className="text-xs text-muted-foreground">{formatDateTime(t.at)}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>

              {options.length > 0 ? (
                <div className="space-y-3 rounded-xl bg-muted/50 p-4">
                  <p className="text-sm font-semibold">Administrator action</p>
                  <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
                    <Select value={nextStatus} onValueChange={setNextStatus}>
                      <SelectTrigger><SelectValue placeholder="Move to…" /></SelectTrigger>
                      <SelectContent>{options.map((s) => <SelectItem key={s} value={s}>{ORDER_STATUS[s].label}</SelectItem>)}</SelectContent>
                    </Select>
                    <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Note or reason — sent to both parties" className="min-h-[44px]" />
                  </div>
                </div>
              ) : (
                <Badge variant="secondary">This order is closed — no further transitions.</Badge>
              )}

              <DialogFooter>
                <Button variant="outline" onClick={() => setSelected(null)}>Close</Button>
                {options.length > 0 && <Button variant="gradient" loading={busy} disabled={!nextStatus} onClick={override}>Apply</Button>}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
