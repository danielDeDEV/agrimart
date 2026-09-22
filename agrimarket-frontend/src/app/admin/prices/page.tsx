'use client';

import * as React from 'react';
import { ClipboardList, Pencil, PlusCircle, Save, Trash2, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage, type ApiResponse } from '@/lib/api';
import { formatCurrency, formatDate, titleCase } from '@/lib/utils';
import {
  Badge, Button, Card, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, EmptyState,
  ErrorState, Input, Label, PageHeader, Pagination, Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  TableSkeleton, Tabs, TabsContent, TabsList, TabsTrigger, TrendPill,
} from '@/components/ui';
import type { Market, MarketPrice, Produce } from '@/lib/types';

const ALL = 'all';
const SOURCES = ['agent', 'moFA', 'survey', 'admin', 'esoko'];
const today = () => new Date().toISOString().slice(0, 10);

type Draft = { id?: number; produceId: string; marketId: string; unit: string; minPrice: string; maxPrice: string; priceType: string; priceDate: string; source: string; notes: string };
const emptyDraft = (): Draft => ({ produceId: '', marketId: '', unit: '', minPrice: '', maxPrice: '', priceType: 'wholesale', priceDate: today(), source: 'agent', notes: '' });

export default function AdminPricesPage() {
  const [produce, setProduce] = React.useState<Produce[]>([]);
  const [markets, setMarkets] = React.useState<Market[]>([]);

  // records tab
  const [filters, setFilters] = React.useState({ produceId: '', marketId: '', source: '' });
  const [page, setPage] = React.useState(1);
  const [rows, setRows] = React.useState<MarketPrice[]>([]);
  const [meta, setMeta] = React.useState<ApiResponse['meta']>();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [draft, setDraft] = React.useState<Draft | null>(null);
  const [busy, setBusy] = React.useState(false);

  // market-day entry tab
  const [dayMarket, setDayMarket] = React.useState('');
  const [dayDate, setDayDate] = React.useState(today());
  const [daySource, setDaySource] = React.useState('agent');
  const [grid, setGrid] = React.useState<Record<number, { min: string; max: string }>>({});

  React.useEffect(() => {
    api.get<Produce[]>('/reference/produce').then((r) => setProduce(r.data)).catch(() => {});
    api.get<Market[]>('/reference/markets').then((r) => setMarkets(r.data)).catch(() => {});
  }, []);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<MarketPrice[]>('/prices/admin/all', {
        produceId: filters.produceId || undefined, marketId: filters.marketId || undefined, source: filters.source || undefined, page, limit: 25,
      });
      setRows(res.data);
      setMeta(res.meta);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [filters, page]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const saveDraft = async () => {
    if (!draft) return;
    if (!draft.produceId || !draft.marketId) return toast.error('Choose produce and market');
    const min = Number(draft.minPrice);
    const max = Number(draft.maxPrice);
    if (!min || !max) return toast.error('Enter the lowest and highest prices');
    if (min > max) return toast.error('Lowest price cannot exceed the highest');
    const unit = draft.unit || produce.find((p) => String(p.id) === draft.produceId)?.defaultUnit || 'bag';
    const body = { ...draft, produceId: Number(draft.produceId), marketId: Number(draft.marketId), minPrice: min, maxPrice: max, avgPrice: (min + max) / 2, unit };

    setBusy(true);
    try {
      if (draft.id) await api.patch(`/prices/${draft.id}`, body);
      else await api.post('/prices', body);
      toast.success(draft.id ? 'Price updated' : 'Price recorded', { description: draft.id ? undefined : 'Matching price alerts were checked and sent.' });
      setDraft(null);
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (row: MarketPrice) => {
    if (!window.confirm(`Delete the ${row.produce?.name} price at ${row.market?.name} on ${formatDate(row.priceDate)}?`)) return;
    try {
      await api.delete(`/prices/${row.id}`);
      toast.success('Price record deleted');
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const submitDay = async () => {
    if (!dayMarket) return toast.error('Choose the market');
    const entries = Object.entries(grid)
      .filter(([, v]) => Number(v.min) > 0 && Number(v.max) > 0)
      .map(([produceId, v]) => {
        const p = produce.find((x) => x.id === Number(produceId));
        const min = Number(v.min);
        const max = Number(v.max);
        return { produceId: Number(produceId), marketId: Number(dayMarket), unit: p?.defaultUnit, minPrice: Math.min(min, max), maxPrice: Math.max(min, max), avgPrice: (min + max) / 2, priceDate: dayDate, source: daySource, priceType: 'wholesale' };
      });
    if (!entries.length) return toast.error('Enter at least one produce price');

    setBusy(true);
    try {
      const res = await api.post<{ created: number; failed: number }>('/prices/bulk', { prices: entries });
      toast.success(`${res.data.created} prices recorded${res.data.failed ? `, ${res.data.failed} failed` : ''}`);
      setGrid({});
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const setDraftField = (key: keyof Draft, value: string) => setDraft((d) => (d ? { ...d, [key]: value } : d));
  const draftProduce = produce.find((p) => String(p.id) === draft?.produceId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Market prices"
        description="Record the prices farmers see on USSD, SMS and the website. Each new record is checked against price alerts immediately."
        action={<Button variant="gradient" onClick={() => setDraft(emptyDraft())}><PlusCircle /> Record a price</Button>}
      />

      <Tabs defaultValue="records">
        <TabsList>
          <TabsTrigger value="records"><TrendingUp /> Price records</TabsTrigger>
          <TabsTrigger value="day"><ClipboardList /> Market-day entry</TabsTrigger>
        </TabsList>

        <TabsContent value="records" className="space-y-4">
          <Card className="flex flex-wrap items-center gap-3 p-4">
            <Select value={filters.produceId || ALL} onValueChange={(v) => { setFilters((f) => ({ ...f, produceId: v === ALL ? '' : v })); setPage(1); }}>
              <SelectTrigger className="h-10 w-48"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value={ALL}>All produce</SelectItem>{produce.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={filters.marketId || ALL} onValueChange={(v) => { setFilters((f) => ({ ...f, marketId: v === ALL ? '' : v })); setPage(1); }}>
              <SelectTrigger className="h-10 w-56"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value={ALL}>All markets</SelectItem>{markets.map((m) => <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={filters.source || ALL} onValueChange={(v) => { setFilters((f) => ({ ...f, source: v === ALL ? '' : v })); setPage(1); }}>
              <SelectTrigger className="h-10 w-40"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value={ALL}>Any source</SelectItem>{SOURCES.map((s) => <SelectItem key={s} value={s}>{s === 'moFA' ? 'MoFA' : titleCase(s)}</SelectItem>)}</SelectContent>
            </Select>
          </Card>

          <Card className="overflow-hidden">
            {error ? <ErrorState message={error} onRetry={load} /> : loading ? <TableSkeleton rows={10} cols={7} /> : rows.length === 0 ? (
              <EmptyState icon={<TrendingUp />} title="No price records match" />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="data-table">
                    <thead><tr><th>Date</th><th>Produce</th><th>Market</th><th className="text-right">Low – high</th><th className="text-right">Average</th><th className="text-right">Change</th><th>Source</th><th /></tr></thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.id}>
                          <td className="whitespace-nowrap">{formatDate(r.priceDate)}</td>
                          <td><p className="font-medium">{r.produce?.name}</p><p className="text-xs text-muted-foreground">{r.unit} · {r.priceType}</p></td>
                          <td className="text-sm">{r.market?.name}<p className="text-xs text-muted-foreground">{r.region?.name}</p></td>
                          <td className="text-right tabular-nums text-muted-foreground">{Math.round(r.minPrice).toLocaleString('en-GH')} – {Math.round(r.maxPrice).toLocaleString('en-GH')}</td>
                          <td className="text-right font-semibold tabular-nums">{formatCurrency(r.avgPrice, { decimals: 0 })}</td>
                          <td className="text-right"><TrendPill value={Number(r.changePercent)} /></td>
                          <td><Badge variant="outline" size="sm">{r.source === 'moFA' ? 'MoFA' : titleCase(r.source)}</Badge></td>
                          <td>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon-sm" aria-label="Edit" onClick={() => setDraft({ id: r.id, produceId: String(r.produceId), marketId: String(r.marketId), unit: r.unit, minPrice: String(r.minPrice), maxPrice: String(r.maxPrice), priceType: r.priceType, priceDate: r.priceDate, source: r.source, notes: '' })}><Pencil /></Button>
                              <Button variant="ghost" size="icon-sm" aria-label="Delete" onClick={() => remove(r)}><Trash2 /></Button>
                            </div>
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
        </TabsContent>

        <TabsContent value="day" className="space-y-4">
          <Card className="flex flex-wrap items-end gap-3 p-4">
            <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Market</Label>
              <Select value={dayMarket} onValueChange={setDayMarket}>
                <SelectTrigger className="h-10 w-64"><SelectValue placeholder="Choose market" /></SelectTrigger>
                <SelectContent>{markets.map((m) => <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Date</Label><Input type="date" value={dayDate} max={today()} onChange={(e) => setDayDate(e.target.value)} className="h-10" /></div>
            <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">Source</Label>
              <Select value={daySource} onValueChange={setDaySource}>
                <SelectTrigger className="h-10 w-36"><SelectValue /></SelectTrigger>
                <SelectContent>{SOURCES.map((s) => <SelectItem key={s} value={s}>{s === 'moFA' ? 'MoFA' : titleCase(s)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">Fill in only the crops you surveyed. Blank rows are skipped.</p>
            <Button variant="gradient" className="ml-auto" loading={busy} onClick={submitDay}><Save /> Save {Object.values(grid).filter((v) => Number(v.min) > 0 && Number(v.max) > 0).length} prices</Button>
          </Card>

          <Card className="overflow-hidden">
            <div className="max-h-[640px] overflow-auto">
              <table className="data-table">
                <thead className="sticky top-0 z-10"><tr><th>Produce</th><th>Unit</th><th className="w-40">Lowest (GHS)</th><th className="w-40">Highest (GHS)</th></tr></thead>
                <tbody>
                  {produce.map((p) => (
                    <tr key={p.id}>
                      <td className="font-medium">{p.name}</td>
                      <td className="text-sm text-muted-foreground">{p.defaultUnit}</td>
                      <td><Input type="number" min="0" className="h-9" value={grid[p.id]?.min ?? ''} onChange={(e) => setGrid((g) => ({ ...g, [p.id]: { min: e.target.value, max: g[p.id]?.max ?? '' } }))} /></td>
                      <td><Input type="number" min="0" className="h-9" value={grid[p.id]?.max ?? ''} onChange={(e) => setGrid((g) => ({ ...g, [p.id]: { min: g[p.id]?.min ?? '', max: e.target.value } }))} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{draft?.id ? 'Edit price record' : 'Record a market price'}</DialogTitle>
            <DialogDescription>The average is taken as the midpoint of the lowest and highest price observed.</DialogDescription>
          </DialogHeader>
          {draft && (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label required>Produce</Label>
                  <Select value={draft.produceId} onValueChange={(v) => setDraftField('produceId', v)}>
                    <SelectTrigger><SelectValue placeholder="Produce" /></SelectTrigger>
                    <SelectContent>{produce.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label required>Market</Label>
                  <Select value={draft.marketId} onValueChange={(v) => setDraftField('marketId', v)}>
                    <SelectTrigger><SelectValue placeholder="Market" /></SelectTrigger>
                    <SelectContent>{markets.map((m) => <SelectItem key={m.id} value={String(m.id)}>{m.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2"><Label>Unit</Label>
                  <Select value={draft.unit || draftProduce?.defaultUnit || ''} onValueChange={(v) => setDraftField('unit', v)} disabled={!draftProduce}>
                    <SelectTrigger><SelectValue placeholder="Unit" /></SelectTrigger>
                    <SelectContent>{(draftProduce?.units ?? []).map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label required>Lowest</Label><Input type="number" value={draft.minPrice} onChange={(e) => setDraftField('minPrice', e.target.value)} /></div>
                <div className="space-y-2"><Label required>Highest</Label><Input type="number" value={draft.maxPrice} onChange={(e) => setDraftField('maxPrice', e.target.value)} /></div>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2"><Label>Date</Label><Input type="date" value={draft.priceDate} max={today()} onChange={(e) => setDraftField('priceDate', e.target.value)} /></div>
                <div className="space-y-2"><Label>Price type</Label>
                  <Select value={draft.priceType} onValueChange={(v) => setDraftField('priceType', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="wholesale">Wholesale</SelectItem><SelectItem value="retail">Retail</SelectItem><SelectItem value="farmgate">Farmgate</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Source</Label>
                  <Select value={draft.source} onValueChange={(v) => setDraftField('source', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{SOURCES.map((s) => <SelectItem key={s} value={s}>{s === 'moFA' ? 'MoFA' : titleCase(s)}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>Cancel</Button>
            <Button variant="gradient" loading={busy} onClick={saveDraft}>{draft?.id ? 'Save changes' : 'Record price'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
