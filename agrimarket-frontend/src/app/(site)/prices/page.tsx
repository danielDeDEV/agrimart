'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Area, Bar, BarChart, CartesianGrid, ComposedChart, LabelList, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { Bell, Check, MessageSquare, Search, Store, TrendingDown, TrendingUp, Scale } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import {
  Badge, Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
  EmptyState, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Skeleton, SmartImage, StatCard, TrendPill,
} from '@/components/ui';
import { ChartCard, ChartTooltipBox, axisProps, useChartTheme } from '@/components/charts/chart-kit';
import type { Category, Market, NationalPrice, Produce } from '@/lib/types';

interface HistoryPoint {
  date: string;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
}

interface CompareRow {
  marketId: number;
  market: string;
  region: string;
  unit: string;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  changePercent: number;
  trend: string;
  priceDate: string;
}

interface CompareResult {
  markets: CompareRow[];
  best?: CompareRow;
  worst?: CompareRow;
  spread: number;
  spreadPercent: number;
}

const RANGES = [
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
  { value: 180, label: '6 months' },
];

const ALL = 'all';

function PricesView() {
  const router = useRouter();
  const params = useSearchParams();
  const { isAuthenticated } = useAuth();
  const theme = useChartTheme();

  const [board, setBoard] = React.useState<NationalPrice[]>([]);
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [markets, setMarkets] = React.useState<Market[]>([]);
  const [categoryId, setCategoryId] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [boardLoading, setBoardLoading] = React.useState(true);

  const produceParam = params.get('produce');
  const [produceId, setProduceId] = React.useState<string>(produceParam ?? '');
  const [marketId, setMarketId] = React.useState('');
  const [days, setDays] = React.useState(90);

  const [history, setHistory] = React.useState<HistoryPoint[]>([]);
  const [produce, setProduce] = React.useState<Produce | null>(null);
  const [compare, setCompare] = React.useState<CompareResult | null>(null);
  const [chartsLoaded, setChartsLoaded] = React.useState(false);
  const [refreshing, setRefreshing] = React.useState(false);

  const [alertOpen, setAlertOpen] = React.useState(false);
  const [alertForm, setAlertForm] = React.useState({ targetPrice: '', direction: 'above' });
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    api.get<Category[]>('/reference/categories').then((r) => setCategories(r.data)).catch(() => {});
    api.get<Market[]>('/reference/markets').then((r) => setMarkets(r.data)).catch(() => {});
  }, []);

  React.useEffect(() => {
    setBoardLoading(true);
    api
      .get<NationalPrice[]>('/prices/national', { limit: 60, categoryId: categoryId || undefined })
      .then((r) => {
        setBoard(r.data);
        if (!produceId && r.data.length) {
          const maize = r.data.find((p) => p.produce?.name === 'Maize');
          setProduceId(String((maize ?? r.data[0]).produceId));
        }
      })
      .catch(() => {})
      .finally(() => setBoardLoading(false));
    // produceId intentionally excluded — the board should not refetch on selection
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryId]);

  // Charts refetch together against the same filters; the previous render holds
  // at reduced opacity rather than flashing a skeleton.
  React.useEffect(() => {
    if (!produceId) return;
    let cancelled = false;
    setRefreshing(true);

    Promise.all([
      api.get<{ produce: Produce; series: HistoryPoint[] }>(`/prices/history/${produceId}`, {
        days,
        marketId: marketId || undefined,
      }),
      api.get<CompareResult>('/prices/compare', { produceId }),
    ])
      .then(([historyRes, compareRes]) => {
        if (cancelled) return;
        setHistory(historyRes.data.series);
        setProduce(historyRes.data.produce);
        setCompare(compareRes.data);
        setChartsLoaded(true);
      })
      .catch((err) => toast.error(errorMessage(err)))
      .finally(() => !cancelled && setRefreshing(false));

    return () => {
      cancelled = true;
    };
  }, [produceId, marketId, days]);

  const selectProduce = (id: number | string) => {
    setProduceId(String(id));
    setMarketId('');
    const next = new URLSearchParams(params.toString());
    next.set('produce', String(id));
    router.replace(`/prices?${next.toString()}`, { scroll: false });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const filteredBoard = board.filter((row) =>
    row.produce?.name?.toLowerCase().includes(search.trim().toLowerCase())
  );

  const selectedBoardRow = board.find((row) => String(row.produceId) === produceId);
  const unit = compare?.markets[0]?.unit ?? selectedBoardRow?.unit ?? produce?.defaultUnit ?? 'unit';

  const chartData = history.map((point) => ({
    ...point,
    range: [point.minPrice, point.maxPrice] as [number, number],
    label: formatDate(point.date),
  }));

  const first = history[0]?.avgPrice;
  const last = history[history.length - 1]?.avgPrice;
  const periodChange = first ? ((last - first) / first) * 100 : 0;

  const topMarkets = (compare?.markets ?? []).slice(0, 10);
  const barHeight = Math.max(220, topMarkets.length * 36 + 40);

  const saveAlert = async () => {
    if (!Number(alertForm.targetPrice)) return toast.error('Enter a target price');
    setSaving(true);
    try {
      const res = await api.post('/prices/alerts', {
        produceId: Number(produceId),
        targetPrice: Number(alertForm.targetPrice),
        direction: alertForm.direction,
        unit,
      });
      toast.success(res.message);
      setAlertOpen(false);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const sendDigest = async () => {
    try {
      const res = await api.post('/prices/digest/send', { produceIds: [Number(produceId)] });
      toast.success(res.message);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div>
      <section className="relative overflow-hidden border-b">
        <div className="absolute inset-0 mesh-bg" />
        <div className="container-wide relative py-10 lg:py-14">
          <Badge variant="success" className="mb-3">Updated from {markets.length || 29} markets</Badge>
          <h1 className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Market prices</h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Wholesale prices recorded by field agents and MoFA surveys. Compare markets before you load a truck —
            the same crop often sells for a third more a few hours away.
          </p>
        </div>
      </section>

      <div className="container-wide py-8">
        {/* One filter row scopes every figure and chart below it */}
        <div className="flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-4 shadow-soft">
          <div className="flex rounded-xl border p-1" role="group" aria-label="Date range">
            {RANGES.map((range) => (
              <button
                key={range.value}
                onClick={() => setDays(range.value)}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                  days === range.value ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {days === range.value && <Check className="h-4 w-4 stroke-[3]" />}
                {range.label}
              </button>
            ))}
          </div>

          <div className="min-w-[200px] flex-1 sm:flex-none">
            <Label className="mb-1.5 block text-xs text-muted-foreground">Produce</Label>
            <Select value={produceId} onValueChange={selectProduce}>
              <SelectTrigger className="h-10 sm:w-[220px]">
                <SelectValue placeholder="Choose produce" />
              </SelectTrigger>
              <SelectContent>
                {board.map((row) => (
                  <SelectItem key={row.produceId} value={String(row.produceId)}>
                    <span className="flex items-center gap-2">
                      <span className="relative h-5 w-6 shrink-0 overflow-hidden rounded">
                        <SmartImage sizes="24px" rounded="rounded" src={row.produce?.imageUrl} alt={row.produce?.name ?? 'Produce'} />
                      </span>
                      {row.produce?.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-[200px] flex-1 sm:flex-none">
            <Label className="mb-1.5 block text-xs text-muted-foreground">Trend market</Label>
            <Select value={marketId || ALL} onValueChange={(v) => setMarketId(v === ALL ? '' : v)}>
              <SelectTrigger className="h-10 sm:w-[240px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>National average</SelectItem>
                {markets.map((m) => (
                  <SelectItem key={m.id} value={String(m.id)}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="ml-auto flex flex-wrap gap-2">
            {isAuthenticated ? (
              <>
                <Button variant="outline" size="sm" onClick={sendDigest}>
                  <MessageSquare /> SMS me these prices
                </Button>
                <Button variant="subtle" size="sm" onClick={() => setAlertOpen(true)}>
                  <Bell /> Set price alert
                </Button>
              </>
            ) : (
              <Button variant="subtle" size="sm" asChild>
                <Link href="/login?next=/prices">
                  <Bell /> Sign in for price alerts
                </Link>
              </Button>
            )}
          </div>
        </div>

        {/* Headline figures */}
        <div className={cn('mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 transition-opacity', refreshing && chartsLoaded && 'opacity-60')}>
          <StatCard
            label={`${produce?.name ?? 'Produce'} national average`}
            value={selectedBoardRow ? formatCurrency(selectedBoardRow.avgPrice, { decimals: 0 }) : '—'}
            hint={`per ${unit}, ${days}-day change`}
            trend={chartsLoaded ? periodChange : undefined}
            icon={<Scale />}
            loading={!chartsLoaded}
          />
          <StatCard
            label="Highest paying market"
            value={compare?.best ? formatCurrency(compare.best.avgPrice, { decimals: 0 }) : '—'}
            hint={compare?.best?.market}
            icon={<TrendingUp />}
            loading={!chartsLoaded}
          />
          <StatCard
            label="Lowest price market"
            value={compare?.worst ? formatCurrency(compare.worst.avgPrice, { decimals: 0 }) : '—'}
            hint={compare?.worst?.market}
            icon={<TrendingDown />}
            accent="gold"
            loading={!chartsLoaded}
          />
          <StatCard
            label="Spread between markets"
            value={compare ? `${compare.spreadPercent}%` : '—'}
            hint={compare ? `${formatCurrency(compare.spread, { decimals: 0 })} per ${unit}` : undefined}
            icon={<Store />}
            accent="blue"
            loading={!chartsLoaded}
          />
        </div>

        {/* Charts */}
        <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_1fr]">
          <ChartCard
            title={`${produce?.name ?? 'Price'} trend — ${marketId ? markets.find((m) => String(m.id) === marketId)?.name : 'national average'}`}
            description={
              marketId
                ? `GHS per ${unit}, by day. The line is the average; the shaded band spans the lowest to highest price recorded that day.`
                : `GHS per ${unit}, by week. The line is the national average; the shaded band spans the cheapest to the dearest market that week.`
            }
            refreshing={refreshing && chartsLoaded}
            empty={
              chartsLoaded && !history.length ? (
                <EmptyState title="No price records in this range" description="Try a longer date range or the national average." />
              ) : undefined
            }
            table={{
              columns: [
                { key: 'date', label: 'Date', format: (v) => formatDate(String(v)) },
                { key: 'avgPrice', label: 'Average', align: 'right', format: (v) => formatCurrency(Number(v), { decimals: 0 }) },
                { key: 'minPrice', label: 'Lowest', align: 'right', format: (v) => formatCurrency(Number(v), { decimals: 0 }) },
                { key: 'maxPrice', label: 'Highest', align: 'right', format: (v) => formatCurrency(Number(v), { decimals: 0 }) },
              ],
              rows: [...history].reverse() as unknown as Record<string, unknown>[],
            }}
          >
            {!chartsLoaded ? (
              <Skeleton className="mx-3 h-[320px]" />
            ) : (
              <div className="h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 16, right: 56, bottom: 4, left: 4 }}>
                    <CartesianGrid vertical={false} stroke={theme.grid} strokeWidth={1} />
                    <XAxis dataKey="label" {...axisProps(theme)} minTickGap={36} />
                    <YAxis
                      {...axisProps(theme)}
                      axisLine={false}
                      width={64}
                      tickFormatter={(v: number) => Math.round(v).toLocaleString('en-GH')}
                      domain={['auto', 'auto']}
                    />
                    <Tooltip
                      cursor={{ stroke: theme.axis, strokeWidth: 1 }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const p = payload[0].payload as HistoryPoint & { label: string };
                        return (
                          <ChartTooltipBox
                            title={p.label}
                            rows={[
                              { label: 'Average', value: formatCurrency(p.avgPrice, { decimals: 0 }), color: theme.slot(0) },
                              { label: 'Highest', value: formatCurrency(p.maxPrice, { decimals: 0 }) },
                              { label: 'Lowest', value: formatCurrency(p.minPrice, { decimals: 0 }) },
                            ]}
                          />
                        );
                      }}
                    />
                    <Area
                      dataKey="range"
                      stroke="none"
                      fill={theme.slot(0)}
                      fillOpacity={0.1}
                      isAnimationActive={false}
                      activeDot={false}
                    />
                    <Line
                      dataKey="avgPrice"
                      stroke={theme.slot(0)}
                      strokeWidth={2}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      dot={false}
                      activeDot={{ r: 5, fill: theme.slot(0), stroke: theme.surface, strokeWidth: 2 }}
                      isAnimationActive={false}
                    >
                      <LabelList
                        dataKey="avgPrice"
                        content={({ x, y, index, value }) =>
                          index === chartData.length - 1 ? (
                            <g>
                              <circle cx={Number(x)} cy={Number(y)} r={4} fill={theme.slot(0)} stroke={theme.surface} strokeWidth={2} />
                              <text x={Number(x) + 8} y={Number(y) + 4} fontSize={12} fontWeight={600} className="fill-foreground">
                                {Math.round(Number(value)).toLocaleString('en-GH')}
                              </text>
                            </g>
                          ) : null
                        }
                      />
                    </Line>
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>

          <ChartCard
            title="Where it pays most today"
            description={`Latest average per ${unit} by market. The highest-paying market is highlighted.`}
            refreshing={refreshing && chartsLoaded}
            table={{
              columns: [
                { key: 'market', label: 'Market' },
                { key: 'region', label: 'Region' },
                { key: 'avgPrice', label: 'Average', align: 'right', format: (v) => formatCurrency(Number(v), { decimals: 0 }) },
                { key: 'changePercent', label: 'Change', align: 'right', format: (v) => <TrendPill value={Number(v)} /> },
              ],
              rows: (compare?.markets ?? []) as unknown as Record<string, unknown>[],
            }}
          >
            {!chartsLoaded ? (
              <Skeleton className="mx-3 h-[320px]" />
            ) : (
              <div style={{ height: barHeight }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topMarkets} layout="vertical" margin={{ top: 4, right: 64, bottom: 4, left: 4 }} barCategoryGap={10}>
                    <CartesianGrid horizontal={false} stroke={theme.grid} strokeWidth={1} />
                    <XAxis type="number" {...axisProps(theme)} tickFormatter={(v: number) => Math.round(v).toLocaleString('en-GH')} />
                    <YAxis
                      type="category"
                      dataKey="market"
                      {...axisProps(theme)}
                      axisLine={false}
                      width={138}
                      tick={({ x, y, payload }: { x: number; y: number; payload: { value: string } }) => {
                        // a plain <text> never wraps, unlike the default tick
                        const name = String(payload.value).replace(/\s+Market\b/i, '');
                        return (
                          <text x={x} y={y} dy={4} textAnchor="end" fontSize={12} fill={theme.muted}>
                            {name.length > 18 ? `${name.slice(0, 17)}…` : name}
                          </text>
                        );
                      }}
                    />
                    <Tooltip
                      cursor={{ fill: theme.grid, fillOpacity: 0.4 }}
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const row = payload[0].payload as CompareRow;
                        return (
                          <ChartTooltipBox
                            title={`${row.market}, ${row.region}`}
                            rows={[
                              { label: `per ${row.unit}`, value: formatCurrency(row.avgPrice, { decimals: 0 }) },
                              { label: 'range', value: `${Math.round(row.minPrice)}–${Math.round(row.maxPrice)}` },
                              { label: 'vs previous', value: `${row.changePercent > 0 ? '+' : ''}${row.changePercent}%` },
                            ]}
                          />
                        );
                      }}
                    />
                    <Bar
                      dataKey="avgPrice"
                      barSize={18}
                      radius={[0, 4, 4, 0]}
                      isAnimationActive={false}
                      shape={(props: unknown) => {
                        const { x, y, width, height, index } = props as { x: number; y: number; width: number; height: number; index: number };
                        const fill = index === 0 ? theme.slot(0) : theme.deemphasis;
                        const r = Math.min(4, width / 2);
                        return (
                          <path
                            d={`M${x},${y} H${x + width - r} Q${x + width},${y} ${x + width},${y + r} V${y + height - r} Q${x + width},${y + height} ${x + width - r},${y + height} H${x} Z`}
                            fill={fill}
                          />
                        );
                      }}
                    >
                      <LabelList
                        dataKey="avgPrice"
                        position="right"
                        offset={8}
                        className="fill-foreground"
                        fontSize={12}
                        formatter={(v: number) => Math.round(v).toLocaleString('en-GH')}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </ChartCard>
        </div>

        {/* Price board */}
        <section className="mt-10 rounded-2xl border bg-card shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5">
            <div>
              <h2 className="text-lg font-semibold">National price board</h2>
              <p className="text-sm text-muted-foreground">Latest average across every market that recorded the crop. Select a row to chart it.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Find produce" icon={<Search />} className="h-10 w-48" />
              <Select value={categoryId || ALL} onValueChange={(v) => setCategoryId(v === ALL ? '' : v)}>
                <SelectTrigger className="h-10 w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All categories</SelectItem>
                  {categories.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Produce</th>
                  <th>Unit</th>
                  <th className="text-right">Average</th>
                  <th className="text-right">Lowest – highest</th>
                  <th className="text-right">Markets</th>
                  <th className="text-right">Change</th>
                </tr>
              </thead>
              <tbody>
                {boardLoading
                  ? Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i}>
                        {Array.from({ length: 6 }).map((__, j) => <td key={j}><Skeleton className="h-5 w-full" /></td>)}
                      </tr>
                    ))
                  : filteredBoard.map((row) => (
                      <tr
                        key={`${row.produceId}-${row.unit}`}
                        onClick={() => selectProduce(row.produceId)}
                        className={cn('cursor-pointer', String(row.produceId) === produceId && 'bg-primary-50/70 dark:bg-primary-950/40')}
                      >
                        <td>
                          <span className="flex items-center gap-3">
                            <span className="relative h-9 w-11 shrink-0 overflow-hidden rounded-lg">
                              <SmartImage sizes="44px" rounded="rounded-lg" src={row.produce?.imageUrl} alt={row.produce?.name ?? 'Produce'} />
                            </span>
                            <span className="font-semibold">{row.produce?.name}</span>
                          </span>
                        </td>
                        <td className="text-muted-foreground">{row.unit}</td>
                        <td className="text-right font-semibold tabular-nums">{formatCurrency(row.avgPrice, { decimals: 0 })}</td>
                        <td className="text-right tabular-nums text-muted-foreground">
                          {Math.round(row.minPrice).toLocaleString('en-GH')} – {Math.round(row.maxPrice).toLocaleString('en-GH')}
                        </td>
                        <td className="text-right tabular-nums">{row.marketCount}</td>
                        <td className="text-right"><TrendPill value={row.changePercent} /></td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <Dialog open={alertOpen} onOpenChange={setAlertOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Price alert for {produce?.name}</DialogTitle>
            <DialogDescription>We will SMS you when any market records a price that crosses your target — at most once a day.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label required>Target price</Label>
              <Input type="number" value={alertForm.targetPrice} onChange={(e) => setAlertForm((f) => ({ ...f, targetPrice: e.target.value }))} suffix="GHS" />
            </div>
            <div className="space-y-2">
              <Label>Alert me when price is</Label>
              <Select value={alertForm.direction} onValueChange={(v) => setAlertForm((f) => ({ ...f, direction: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="above">At or above (time to sell)</SelectItem>
                  <SelectItem value="below">At or below (time to buy)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {selectedBoardRow && (
            <p className="text-sm text-muted-foreground">
              Today&apos;s national average is {formatCurrency(selectedBoardRow.avgPrice, { decimals: 0 })} per {unit}.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAlertOpen(false)}>Cancel</Button>
            <Button variant="gradient" loading={saving} onClick={saveAlert}>Save alert</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function PricesPage() {
  return (
    <React.Suspense fallback={<div className="container-wide py-20"><Skeleton className="h-96" /></div>}>
      <PricesView />
    </React.Suspense>
  );
}
