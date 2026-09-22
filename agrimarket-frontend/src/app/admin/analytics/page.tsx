'use client';

import * as React from 'react';
import Link from 'next/link';
import { Banknote, Check, ClipboardList, Download, MapPinned, Smile, Smartphone, Truck, Users } from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { cn, formatCompact, formatCurrency, formatNumber } from '@/lib/utils';
import { Button, Card, ErrorState, PageHeader, Skeleton, StatCard } from '@/components/ui';
import { ChartCard, ChartLegend, useChartTheme } from '@/components/charts/chart-kit';
import { TrendChart } from '@/components/charts/trend-chart';
import { BarList } from '@/components/charts/bar-list';
import { CHANNEL_SLOTS, ShareBar } from '@/components/charts/share-bar';

interface Analytics {
  participation: { registeredFarmers: number; farmersWithListings: number; farmersWithSales: number; listingRate: number; saleRate: number };
  income: { totalPaidToFarmers: number; averagePerSellingFarmer: number; sellingFarmers: number; topEarners: { farmerId: number; earned: number; sales: number }[] };
  priceTransparency: { produce: string; lowest: number; highest: number; average: number; spread: number; spreadPercent: number }[];
  channelReach: { listings: { ussd: number; web: number; sms: number }; registrations: { ussd: number; web: number }; offlineShare: number };
  survey: {
    responses: number; incomeBefore: number; incomeAfter: number; incomeChangePercent: number; buyersBefore: number; buyersAfter: number;
    lossBefore: number; lossAfter: number; satisfaction: number; travelCostSaved: number;
  };
  monthlyGmv: { month: string; gmv: number; orders: number; sellers: number }[];
  regionParticipation: { region: string; orders: number }[];
}

/** Two shades of one hue from the documented sequential ramp: before (light) → after (slot 1). */
const DUMBBELL = {
  light: { before: '#86b6ef', after: '#2a78d6' },
  dark: { before: '#184f95', after: '#3987e5' },
};

const monthLabel = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
};

export default function ImpactAnalyticsPage() {
  const theme = useChartTheme();
  const [days, setDays] = React.useState(365);
  const [data, setData] = React.useState<Analytics | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);

  const load = React.useCallback(() => {
    setRefreshing(true);
    api.get<Analytics>('/admin/analytics', { days })
      .then((r) => { setData(r.data); setError(null); })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setRefreshing(false));
  }, [days]);

  React.useEffect(() => load(), [load]);

  if (error && !data) return <ErrorState message={error} onRetry={load} />;

  const s = data?.survey;
  const p = data?.participation;
  const shades = DUMBBELL[theme.mode];

  const measures = s ? [
    { label: 'Monthly income', before: s.incomeBefore, after: s.incomeAfter, format: (v: number) => formatCurrency(v, { decimals: 0 }), better: 'higher' },
    { label: 'Buyers reached', before: s.buyersBefore, after: s.buyersAfter, format: (v: number) => v.toFixed(1), better: 'higher' },
    { label: 'Post-harvest loss', before: s.lossBefore, after: s.lossAfter, format: (v: number) => `${v.toFixed(1)}%`, better: 'lower' },
  ] : [];

  const exportCsv = () => {
    if (!data || !s || !p) return;
    const lines = [
      ['Measure', 'Value'],
      ['Survey responses', s.responses],
      ['Average monthly income before (GHS)', s.incomeBefore],
      ['Average monthly income after (GHS)', s.incomeAfter],
      ['Income change (%)', s.incomeChangePercent],
      ['Buyers reached before', s.buyersBefore],
      ['Buyers reached after', s.buyersAfter],
      ['Post-harvest loss before (%)', s.lossBefore],
      ['Post-harvest loss after (%)', s.lossAfter],
      ['Satisfaction (1-5)', s.satisfaction],
      ['Travel cost saved (GHS, total)', s.travelCostSaved],
      ['Registered farmers', p.registeredFarmers],
      ['Farmers who listed (%)', p.listingRate],
      ['Farmers who sold (%)', p.saleRate],
      ['Paid to farmers (GHS)', data.income.totalPaidToFarmers],
      ['Average per selling farmer (GHS)', data.income.averagePerSellingFarmer],
      ['Listings via USSD/SMS (%)', data.channelReach.offlineShare],
      [],
      ['Produce', 'Lowest market avg', 'Highest market avg', 'Spread %'],
      ...data.priceTransparency.map((r) => [r.produce, r.lowest, r.highest, r.spreadPercent]),
    ];
    const csv = lines.map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `agrimarket-impact-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const listingItems = data ? [
    { key: 'ussd', label: 'USSD', value: data.channelReach.listings.ussd, slot: CHANNEL_SLOTS.ussd },
    { key: 'web', label: 'Web', value: data.channelReach.listings.web, slot: CHANNEL_SLOTS.web },
    { key: 'sms', label: 'SMS', value: data.channelReach.listings.sms, slot: CHANNEL_SLOTS.sms },
  ] : [];

  const monthly = (data?.monthlyGmv ?? []).map((m) => ({ ...m, label: monthLabel(m.month) }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Impact analytics"
        description="Study objective 5 — is the platform improving market participation and income for smallholder farmers? Survey responses are compared with live platform data."
        action={
          <div className="flex gap-2">
            <Button variant="outline" asChild><Link href="/admin/impact"><ClipboardList /> Survey records</Link></Button>
            <Button variant="gradient" onClick={exportCsv} disabled={!data}><Download /> Export CSV</Button>
          </div>
        }
      />

      <div className="flex w-fit rounded-xl border bg-card p-1 shadow-soft" role="group" aria-label="Date range">
        {[90, 180, 365, 730].map((d) => (
          <button key={d} onClick={() => setDays(d)} className={cn('flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium', days === d ? 'bg-muted' : 'text-muted-foreground hover:text-foreground')}>
            {days === d && <Check className="h-4 w-4 stroke-[3]" />}{d >= 365 ? `${d / 365} year${d > 365 ? 's' : ''}` : `${d} days`}
          </button>
        ))}
      </div>

      {/* Hero: the one number this view leads with */}
      <Card className={cn('grid gap-6 p-6 transition-opacity sm:p-8 lg:grid-cols-[1fr_1.4fr] lg:items-center', refreshing && data && 'opacity-60')}>
        <div>
          <p className="text-sm font-medium text-muted-foreground">Change in average monthly income, surveyed farmers</p>
          {s ? (
            <p className="mt-2 font-sans text-6xl font-bold tracking-tight">{s.incomeChangePercent > 0 ? '+' : ''}{s.incomeChangePercent}%</p>
          ) : <Skeleton className="mt-3 h-16 w-48" />}
          <p className="mt-2 text-sm text-muted-foreground">
            {s ? `${formatCurrency(s.incomeBefore, { decimals: 0 })} → ${formatCurrency(s.incomeAfter, { decimals: 0 })} per month, across ${formatNumber(s.responses)} survey responses.` : ' '}
          </p>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-sm font-semibold">Before and after joining</p>
            <ChartLegend items={[{ label: 'Before', color: shades.before }, { label: 'After', color: shades.after }]} />
          </div>
          <ul className="space-y-5">
            {measures.map((m) => {
              const max = Math.max(m.before, m.after) * 1.1 || 1;
              const b = (m.before / max) * 100;
              const a = (m.after / max) * 100;
              const improved = m.better === 'higher' ? m.after > m.before : m.after < m.before;
              return (
                <li key={m.label}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span>{m.label}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {m.format(m.before)} → <span className="font-semibold text-foreground">{m.format(m.after)}</span>
                      <span className="ml-1.5 text-xs">({improved ? 'improved' : 'worse'})</span>
                    </span>
                  </div>
                  {/* each measure on its own scale — small multiples, never one shared axis for different units */}
                  <div className="relative mt-2 h-4" role="img" aria-label={`${m.label}: ${m.format(m.before)} before, ${m.format(m.after)} after`}>
                    <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2" style={{ backgroundColor: theme.grid }} />
                    <div className="absolute top-1/2 h-0.5 -translate-y-1/2" style={{ left: `${Math.min(a, b)}%`, width: `${Math.abs(a - b)}%`, backgroundColor: shades.after, opacity: 0.35 }} />
                    <span className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${b}%`, backgroundColor: shades.before, boxShadow: `0 0 0 2px ${theme.surface}` }} />
                    <span className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ left: `${a}%`, backgroundColor: shades.after, boxShadow: `0 0 0 2px ${theme.surface}` }} />
                  </div>
                </li>
              );
            })}
            {!s && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-9" />)}
          </ul>
        </div>
      </Card>

      <div className={cn('grid gap-4 sm:grid-cols-2 xl:grid-cols-4 transition-opacity', refreshing && data && 'opacity-60')}>
        <StatCard label="Paid to farmers" value={data ? formatCurrency(data.income.totalPaidToFarmers, { compact: true, decimals: 0 }) : ''} hint={data ? `${formatCurrency(data.income.averagePerSellingFarmer, { decimals: 0 })} per selling farmer` : undefined} icon={<Banknote />} loading={!data} />
        <StatCard label="Listed via USSD or SMS" value={data ? `${data.channelReach.offlineShare}%` : ''} hint="of all listings — no internet used" icon={<Smartphone />} accent="blue" loading={!data} />
        <StatCard label="Farmer satisfaction" value={s ? `${s.satisfaction.toFixed(1)} / 5` : ''} hint={s ? `${formatNumber(s.responses)} responses` : undefined} icon={<Smile />} accent="gold" loading={!s} />
        <StatCard label="Travel cost avoided" value={s ? formatCurrency(s.travelCostSaved, { compact: true, decimals: 0 }) : ''} hint="reported by surveyed farmers" icon={<Truck />} accent="violet" loading={!s} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard
          title="Market participation"
          description="Of registered farmers, how many listed produce and how many completed a sale."
          table={{ columns: [{ key: 'label', label: 'Stage' }, { key: 'value', label: 'Farmers', align: 'right' }, { key: 'rate', label: 'Share', align: 'right' }], rows: p ? [
            { label: 'Registered', value: p.registeredFarmers, rate: '100%' },
            { label: 'Listed produce', value: p.farmersWithListings, rate: `${p.listingRate}%` },
            { label: 'Completed a sale', value: p.farmersWithSales, rate: `${p.saleRate}%` },
          ] : [] }}
        >
          {!p ? <Skeleton className="mx-3 h-40" /> : (
            <div className="space-y-5 px-3 py-2">
              {[
                { label: 'Registered farmers', value: p.registeredFarmers, pct: 100 },
                { label: 'Listed produce', value: p.farmersWithListings, pct: p.listingRate },
                { label: 'Completed a sale', value: p.farmersWithSales, pct: p.saleRate },
              ].map((stage) => (
                <div key={stage.label}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="flex items-center gap-2"><Users className="h-4 w-4 text-muted-foreground" /> {stage.label}</span>
                    <span className="tabular-nums"><span className="font-semibold">{formatNumber(stage.value)}</span> <span className="text-muted-foreground">· {Math.min(100, stage.pct).toFixed(0)}%</span></span>
                  </div>
                  {/* meter: fill in slot 1, unfilled track a lighter step of the same ramp */}
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full" style={{ backgroundColor: theme.mode === 'dark' ? '#184f95' : '#cde2fb' }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.min(100, stage.pct)}%`, backgroundColor: theme.slot(0) }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </ChartCard>

        <ChartCard title="Where listings come from" description="Evidence for the core claim: offline channels bring farmers into the market."
          table={{ columns: [{ key: 'label', label: 'Channel' }, { key: 'value', label: 'Listings', align: 'right' }], rows: listingItems as unknown as Record<string, unknown>[] }}>
          {!data ? <Skeleton className="mx-3 h-24" /> : <ShareBar items={listingItems} />}
        </ChartCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="Traded value by month" description="Completed orders, GHS."
          table={{ columns: [{ key: 'label', label: 'Month' }, { key: 'gmv', label: 'Value', align: 'right', format: (v) => formatCurrency(Number(v), { decimals: 0 }) }, { key: 'orders', label: 'Orders', align: 'right' }], rows: monthly as unknown as Record<string, unknown>[] }}>
          {!data ? <Skeleton className="mx-3 h-[240px]" /> : <TrendChart height={240} data={monthly as unknown as Record<string, unknown>[]} xKey="label" valueFormat={(v) => formatCompact(v)} series={[{ key: 'gmv', label: 'Traded value', slot: 0 }]} />}
        </ChartCard>
        <ChartCard title="Farmers making sales each month" description="Distinct farmers with at least one completed order."
          table={{ columns: [{ key: 'label', label: 'Month' }, { key: 'sellers', label: 'Selling farmers', align: 'right' }], rows: monthly as unknown as Record<string, unknown>[] }}>
          {!data ? <Skeleton className="mx-3 h-[240px]" /> : <TrendChart height={240} data={monthly as unknown as Record<string, unknown>[]} xKey="label" series={[{ key: 'sellers', label: 'Selling farmers', slot: 0 }]} />}
        </ChartCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="Price gap between markets" description="How much more the dearest market paid than the cheapest, per crop — the information asymmetry the price service exposes."
          table={{ columns: [
            { key: 'produce', label: 'Produce' },
            { key: 'lowest', label: 'Lowest', align: 'right', format: (v) => formatCurrency(Number(v), { decimals: 0 }) },
            { key: 'highest', label: 'Highest', align: 'right', format: (v) => formatCurrency(Number(v), { decimals: 0 }) },
            { key: 'spreadPercent', label: 'Gap', align: 'right', format: (v) => `${v}%` },
          ], rows: (data?.priceTransparency ?? []) as unknown as Record<string, unknown>[] }}>
          {!data ? <Skeleton className="mx-3 h-64" /> : <BarList valueLabel="gap" valueFormat={(v) => `${Math.round(v)}%`} items={[...data.priceTransparency].sort((a, b) => b.spreadPercent - a.spreadPercent).map((r) => ({ label: r.produce, value: r.spreadPercent }))} />}
        </ChartCard>
        <ChartCard title="Completed orders by region" description="Where trade on the platform is actually happening."
          table={{ columns: [{ key: 'region', label: 'Region' }, { key: 'orders', label: 'Orders', align: 'right' }], rows: (data?.regionParticipation ?? []) as unknown as Record<string, unknown>[] }}>
          {!data ? <Skeleton className="mx-3 h-64" /> : data.regionParticipation.length === 0 ? <p className="px-3 py-8 text-sm text-muted-foreground"><MapPinned className="mr-2 inline h-4 w-4" />No completed orders in this period.</p> : (
            <BarList valueLabel="orders" items={data.regionParticipation.map((r) => ({ label: r.region, value: r.orders }))} />
          )}
        </ChartCard>
      </div>

      <Card className="overflow-hidden">
        <div className="border-b px-5 py-4"><h2 className="font-semibold">Top-earning farmers</h2><p className="text-sm text-muted-foreground">Sale proceeds received through the platform in the period.</p></div>
        <div className="overflow-x-auto"><table className="data-table">
          <thead><tr><th>#</th><th>Farmer</th><th className="text-right">Completed sales</th><th className="text-right">Earned</th></tr></thead>
          <tbody>{(data?.income.topEarners ?? []).map((f, i) => (
            <tr key={f.farmerId}>
              <td className="tabular-nums text-muted-foreground">{i + 1}</td>
              <td><Link href={`/admin/users/${f.farmerId}`} className="font-medium hover:text-primary">Farmer #{f.farmerId}</Link></td>
              <td className="text-right tabular-nums">{f.sales}</td>
              <td className="text-right font-semibold tabular-nums">{formatCurrency(f.earned, { decimals: 0 })}</td>
            </tr>
          ))}</tbody>
        </table></div>
      </Card>
    </div>
  );
}
