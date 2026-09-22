'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  AlertTriangle, ArrowRight, Banknote, Check, LifeBuoy, MessageSquare, Package, ShoppingCart, Smartphone, Users,
} from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { cn, formatCompact, formatCurrency, formatDate, formatNumber, initials, timeAgo } from '@/lib/utils';
import { CHANNEL_META, ORDER_STATUS } from '@/lib/constants';
import { Avatar, AvatarFallback, Badge, Button, Card, ErrorState, PageHeader, Skeleton, StatCard, StatusBadge } from '@/components/ui';
import { ChartCard } from '@/components/charts/chart-kit';
import { TrendChart } from '@/components/charts/trend-chart';
import { BarList } from '@/components/charts/bar-list';
import { CHANNEL_SLOTS, ShareBar } from '@/components/charts/share-bar';
import type { Order, User } from '@/lib/types';

interface Kpi { total: number; new?: number; growth?: number; period?: number; active?: number; pending?: number; completed?: number }

interface AdminDashboard {
  period: { days: number };
  kpis: {
    users: Kpi;
    farmers: number;
    buyers: number;
    listings: Kpi;
    orders: Kpi;
    gmv: Kpi;
    commission: number;
    ussd: { total: number; period: number };
    sms: { sent: number; cost: number };
    attention: { openTickets: number; pendingModeration: number };
  };
  charts: {
    dailyOrders: { date: string; orders: number; value: number }[];
    dailyUsers: { date: string; users: number }[];
    channelMix: { channel: string; count: number }[];
    registrationMix: { channel: string; count: number }[];
    topProduce: { produce: { name: string }; count: number }[];
    byRegion: { region: string; count: number }[];
  };
  recentOrders: Order[];
  recentUsers: (User & { region?: { name: string } })[];
}

const RANGES = [7, 30, 90, 365];
const shortDate = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

export default function AdminDashboardPage() {
  const [days, setDays] = React.useState(30);
  const [data, setData] = React.useState<AdminDashboard | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);

  const load = React.useCallback(() => {
    setRefreshing(true);
    api
      .get<AdminDashboard>('/admin/dashboard', { days })
      .then((res) => { setData(res.data); setError(null); })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setRefreshing(false));
  }, [days]);

  React.useEffect(() => load(), [load]);

  // Merge the two daily count series onto one date axis (both are counts — one scale).
  // Declared before any early return so hook order never changes between renders.
  const activity = React.useMemo(() => {
    if (!data) return [];
    const map = new Map<string, { date: string; orders: number; users: number }>();
    data.charts.dailyOrders.forEach((d) => map.set(d.date, { date: d.date, orders: d.orders, users: 0 }));
    data.charts.dailyUsers.forEach((d) => {
      const row = map.get(d.date) ?? { date: d.date, orders: 0, users: 0 };
      row.users = d.users;
      map.set(d.date, row);
    });
    return [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
  }, [data]);

  if (error && !data) return <ErrorState message={error} onRetry={load} />;

  const k = data?.kpis;

  const channelItems = (rows: { channel: string; count: number }[] = []) =>
    rows.map((r) => ({ key: r.channel, label: CHANNEL_META[r.channel as keyof typeof CHANNEL_META]?.label ?? r.channel, value: r.count, slot: CHANNEL_SLOTS[r.channel] ?? 5 }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform overview"
        description="Trading activity across USSD, SMS and the web."
      />

      {/* Filter row scopes every figure below */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-xl border bg-card p-1 shadow-soft" role="group" aria-label="Date range">
          {RANGES.map((range) => (
            <button
              key={range}
              onClick={() => setDays(range)}
              className={cn(
                'flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors',
                days === range ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {days === range && <Check className="h-4 w-4 stroke-[3]" />}
              {range === 365 ? '12 months' : `${range} days`}
            </button>
          ))}
        </div>
        {k && (k.attention.pendingModeration > 0 || k.attention.openTickets > 0) && (
          <div className="flex flex-wrap gap-2">
            {k.attention.pendingModeration > 0 && (
              <Button variant="outline" size="sm" asChild>
                <Link href="/admin/listings?status=pending"><AlertTriangle className="text-amber-600" /> {k.attention.pendingModeration} listings to review</Link>
              </Button>
            )}
            {k.attention.openTickets > 0 && (
              <Button variant="outline" size="sm" asChild>
                <Link href="/admin/support"><LifeBuoy className="text-amber-600" /> {k.attention.openTickets} open tickets</Link>
              </Button>
            )}
          </div>
        )}
      </div>

      <div className={cn('grid gap-4 sm:grid-cols-2 xl:grid-cols-4 transition-opacity', refreshing && data && 'opacity-60')}>
        <StatCard label="Traded value" value={k ? formatCurrency(k.gmv.period, { compact: true, decimals: 0 }) : ''} trend={k?.gmv.growth} hint={`vs previous ${days} days`} icon={<Banknote />} loading={!k} />
        <StatCard label="Orders" value={k ? formatNumber(k.orders.new) : ''} trend={k?.orders.growth} hint={k ? `${k.orders.pending} pending now` : undefined} icon={<ShoppingCart />} accent="gold" loading={!k} />
        <StatCard label="New users" value={k ? formatNumber(k.users.new) : ''} trend={k?.users.growth} hint={k ? `${formatNumber(k.farmers)} farmers · ${formatNumber(k.buyers)} buyers` : undefined} icon={<Users />} accent="blue" loading={!k} />
        <StatCard label="Live listings" value={k ? formatNumber(k.listings.active) : ''} trend={k?.listings.growth} hint={k ? `${formatNumber(k.listings.new)} new in period` : undefined} icon={<Package />} accent="violet" loading={!k} />
      </div>

      <div className={cn('grid gap-4 sm:grid-cols-3 transition-opacity', refreshing && data && 'opacity-60')}>
        <StatCard label="USSD sessions" value={k ? formatNumber(k.ussd.period) : ''} hint={k ? `${formatCompact(k.ussd.total)} all time` : undefined} icon={<Smartphone />} accent="cyan" loading={!k} />
        <StatCard label="SMS sent (all time)" value={k ? formatCompact(k.sms.sent) : ''} hint={k ? `${formatCurrency(k.sms.cost, { decimals: 2 })} gateway cost` : undefined} icon={<MessageSquare />} accent="cyan" loading={!k} />
        <StatCard label="Commission earned" value={k ? formatCurrency(k.commission, { compact: true, decimals: 0 }) : ''} hint="3% of completed orders" icon={<Banknote />} accent="primary" loading={!k} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <ChartCard
          title="Daily activity"
          description="Orders placed and new user registrations per day."
          refreshing={refreshing && !!data}
          table={{
            columns: [
              { key: 'date', label: 'Date', format: (v) => formatDate(String(v)) },
              { key: 'orders', label: 'Orders', align: 'right' },
              { key: 'users', label: 'New users', align: 'right' },
            ],
            rows: [...activity].reverse() as unknown as Record<string, unknown>[],
          }}
        >
          {!data ? (
            <Skeleton className="mx-3 h-[280px]" />
          ) : (
            <TrendChart
              data={activity as unknown as Record<string, unknown>[]}
              xKey="date"
              xFormat={shortDate}
              series={[
                { key: 'orders', label: 'Orders', slot: 0 },
                { key: 'users', label: 'New users', slot: 1 },
              ]}
            />
          )}
        </ChartCard>

        <div className="space-y-6">
          <ChartCard
            title="Listings by channel"
            description="Where produce was listed from — the offline share is the study's core measure."
            refreshing={refreshing && !!data}
            table={{
              columns: [{ key: 'label', label: 'Channel' }, { key: 'value', label: 'Listings', align: 'right' }],
              rows: channelItems(data?.charts.channelMix) as unknown as Record<string, unknown>[],
            }}
          >
            {!data ? <Skeleton className="mx-3 h-24" /> : <ShareBar items={channelItems(data.charts.channelMix)} />}
          </ChartCard>

          <ChartCard
            title="Registrations by channel"
            description="How farmers and buyers first joined."
            refreshing={refreshing && !!data}
            table={{
              columns: [{ key: 'label', label: 'Channel' }, { key: 'value', label: 'Users', align: 'right' }],
              rows: channelItems(data?.charts.registrationMix) as unknown as Record<string, unknown>[],
            }}
          >
            {!data ? <Skeleton className="mx-3 h-24" /> : <ShareBar items={channelItems(data.charts.registrationMix)} />}
          </ChartCard>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="Most listed produce"
          description="Active and sold listings per crop."
          table={{
            columns: [{ key: 'label', label: 'Produce' }, { key: 'value', label: 'Listings', align: 'right' }],
            rows: (data?.charts.topProduce ?? []).map((p) => ({ label: p.produce?.name, value: p.count })),
          }}
        >
          {!data ? <Skeleton className="mx-3 h-56" /> : (
            <BarList valueLabel="listings" items={data.charts.topProduce.map((p) => ({ label: p.produce?.name ?? '—', value: p.count }))} />
          )}
        </ChartCard>

        <ChartCard
          title="Farmers by region"
          description="Registered farmers in the ten largest regions."
          table={{
            columns: [{ key: 'label', label: 'Region' }, { key: 'value', label: 'Farmers', align: 'right' }],
            rows: (data?.charts.byRegion ?? []).map((r) => ({ label: r.region, value: r.count })),
          }}
        >
          {!data ? <Skeleton className="mx-3 h-56" /> : (
            <BarList valueLabel="farmers" items={data.charts.byRegion.map((r) => ({ label: r.region, value: r.count }))} />
          )}
        </ChartCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <h2 className="font-semibold">Latest orders</h2>
            <Button variant="ghost" size="sm" asChild><Link href="/admin/orders">All orders <ArrowRight /></Link></Button>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead><tr><th>Order</th><th>Buyer → Farmer</th><th className="text-right">Total</th><th>Status</th><th>Channel</th></tr></thead>
              <tbody>
                {!data
                  ? Array.from({ length: 5 }).map((_, i) => <tr key={i}><td colSpan={5}><Skeleton className="h-6" /></td></tr>)
                  : data.recentOrders.map((o) => (
                      <tr key={o.id}>
                        <td>
                          <p className="font-medium">{o.listing?.produce?.name}</p>
                          <p className="font-mono text-xs text-muted-foreground">{o.code}</p>
                        </td>
                        <td className="text-sm">
                          <p className="truncate">{o.buyer?.businessName || o.buyer?.fullName}</p>
                          <p className="truncate text-xs text-muted-foreground">→ {o.farmer?.fullName}</p>
                        </td>
                        <td className="text-right font-semibold tabular-nums">{formatCurrency(o.totalAmount, { decimals: 0 })}</td>
                        <td><StatusBadge status={o.status} map={ORDER_STATUS} /></td>
                        <td><Badge variant="outline" size="sm">{CHANNEL_META[o.source]?.label ?? o.source}</Badge></td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <h2 className="font-semibold">Newest members</h2>
            <Button variant="ghost" size="sm" asChild><Link href="/admin/users">All users <ArrowRight /></Link></Button>
          </div>
          <ul className="divide-y">
            {!data
              ? Array.from({ length: 6 }).map((_, i) => <li key={i} className="p-4"><Skeleton className="h-10" /></li>)
              : data.recentUsers.map((u) => (
                  <li key={u.id}>
                    <Link href={`/admin/users/${u.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-muted/50">
                      <Avatar className="h-9 w-9"><AvatarFallback>{initials(u.fullName)}</AvatarFallback></Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{u.fullName}</p>
                        <p className="truncate text-xs text-muted-foreground">{u.phone} · {u.region?.name ?? 'No region'}</p>
                      </div>
                      <div className="text-right">
                        <Badge variant={u.role === 'farmer' ? 'success' : 'info'} size="sm" className="capitalize">{u.role}</Badge>
                        <p className="mt-0.5 text-[11px] text-muted-foreground">{CHANNEL_META[u.registrationChannel]?.label} · {timeAgo(u.createdAt)}</p>
                      </div>
                    </Link>
                  </li>
                ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
