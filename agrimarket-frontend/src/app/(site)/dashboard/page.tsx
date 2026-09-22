'use client';

import * as React from 'react';
import Link from 'next/link';
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import {
  ArrowRight, Banknote, Clock, Eye, Package, PlusCircle, Search, ShoppingBag, Star, TrendingUp, Wallet,
} from 'lucide-react';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn, formatCompact, formatCurrency, formatNumber, timeAgo } from '@/lib/utils';
import { LISTING_STATUS, ORDER_STATUS } from '@/lib/constants';
import { listingPhotos } from '@/lib/images';
import { Button, Card, EmptyState, ErrorState, Skeleton, SmartImage, StatCard, StatusBadge } from '@/components/ui';
import { ChartCard, ChartTooltipBox, axisProps, useChartTheme } from '@/components/charts/chart-kit';
import type { Listing, Order } from '@/lib/types';

interface DashboardData {
  role: string;
  stats: {
    activeListings: number;
    totalListings: number;
    soldListings: number;
    pendingOrders: number;
    activeOrders: number;
    completedOrders: number;
    unreadNotifications: number;
    revenue: number;
    spend: number;
    totalViews: number;
    walletBalance: number;
    rating: number;
  };
  monthly: { month: string; orders: number; value: number }[];
  recentOrders: Order[];
  recentListings: Listing[];
}

const monthLabel = (ym: string) => {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
};

export default function DashboardOverview() {
  const { user } = useAuth();
  const theme = useChartTheme();
  const [data, setData] = React.useState<DashboardData | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(() => {
    setError(null);
    api
      .get<DashboardData>('/users/me/dashboard')
      .then((res) => setData(res.data))
      .catch((err) => setError(errorMessage(err)));
  }, []);

  React.useEffect(() => load(), [load]);

  if (error) return <ErrorState message={error} onRetry={load} />;

  const isFarmer = user?.role !== 'buyer';
  const s = data?.stats;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const monthly = (data?.monthly ?? []).map((m) => ({ ...m, label: monthLabel(m.month) }));

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl bg-field-gradient p-6 text-white shadow-lift sm:p-8">
        <div className="absolute inset-0 opacity-[0.08] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:24px_24px]" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm text-white/70">{greeting},</p>
            <h1 className="mt-1 font-display text-3xl font-extrabold">{user?.fullName.split(' ')[0]}</h1>
            <p className="mt-2 max-w-md text-white/75">
              {isFarmer
                ? s?.pendingOrders
                  ? `You have ${s.pendingOrders} order${s.pendingOrders === 1 ? '' : 's'} waiting for your response.`
                  : 'Your listings are live. Buyers are browsing the marketplace now.'
                : 'Find produce direct from farms across Ghana.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isFarmer ? (
              <Button className="bg-white text-primary-800 hover:bg-white/90" asChild>
                <Link href="/dashboard/listings/new"><PlusCircle /> New listing</Link>
              </Button>
            ) : (
              <Button className="bg-white text-primary-800 hover:bg-white/90" asChild>
                <Link href="/marketplace"><Search /> Browse produce</Link>
              </Button>
            )}
            <Button className="bg-white/10 text-white ring-1 ring-white/25 hover:bg-white/20" asChild>
              <Link href="/prices"><TrendingUp /> Today&apos;s prices</Link>
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {isFarmer ? (
          <>
            <StatCard label="Earned on AgriMart" value={s ? formatCurrency(s.revenue, { compact: true, decimals: 0 }) : ''} hint="from completed sales" icon={<Banknote />} loading={!s} />
            <StatCard label="Live listings" value={s ? formatNumber(s.activeListings) : ''} hint={s ? `${s.soldListings} sold out` : undefined} icon={<Package />} accent="gold" loading={!s} />
            <StatCard label="Awaiting your response" value={s ? formatNumber(s.pendingOrders) : ''} hint={s ? `${s.activeOrders} in progress` : undefined} icon={<Clock />} accent="blue" loading={!s} />
            <StatCard label="Listing views" value={s ? formatCompact(s.totalViews) : ''} hint={s ? `Rating ${s.rating.toFixed(1)} / 5` : undefined} icon={<Eye />} accent="violet" loading={!s} />
          </>
        ) : (
          <>
            <StatCard label="Spent on produce" value={s ? formatCurrency(s.spend, { compact: true, decimals: 0 }) : ''} hint="completed orders" icon={<Banknote />} loading={!s} />
            <StatCard label="Orders in progress" value={s ? formatNumber(s.activeOrders) : ''} hint={s ? `${s.pendingOrders} pending` : undefined} icon={<ShoppingBag />} accent="gold" loading={!s} />
            <StatCard label="Completed orders" value={s ? formatNumber(s.completedOrders) : ''} icon={<Star />} accent="blue" loading={!s} />
            <StatCard label="Wallet" value={s ? formatCurrency(s.walletBalance, { decimals: 0 }) : ''} icon={<Wallet />} accent="violet" loading={!s} />
          </>
        )}
      </div>

      <ChartCard
        title="Trade value by month"
        description="Total value of your orders (buying and selling) over the last six months, in GHS."
        empty={data && !monthly.length ? <EmptyState title="No orders yet" description="Your monthly trade will appear here after your first order." /> : undefined}
        table={{
          columns: [
            { key: 'label', label: 'Month' },
            { key: 'orders', label: 'Orders', align: 'right' },
            { key: 'value', label: 'Value', align: 'right', format: (v) => formatCurrency(Number(v), { decimals: 0 }) },
          ],
          rows: monthly as unknown as Record<string, unknown>[],
        }}
      >
        {!data ? (
          <Skeleton className="mx-3 h-[260px]" />
        ) : (
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthly} margin={{ top: 24, right: 16, bottom: 4, left: 4 }}>
                <CartesianGrid vertical={false} stroke={theme.grid} strokeWidth={1} />
                <XAxis dataKey="label" {...axisProps(theme)} />
                <YAxis {...axisProps(theme)} axisLine={false} width={56} tickFormatter={(v: number) => formatCompact(v)} />
                <Tooltip
                  cursor={{ fill: theme.grid, fillOpacity: 0.4 }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const row = payload[0].payload as (typeof monthly)[number];
                    return (
                      <ChartTooltipBox
                        title={row.label}
                        rows={[
                          { label: 'trade value', value: formatCurrency(row.value, { decimals: 0 }), color: theme.slot(0), shape: 'rect' },
                          { label: 'orders', value: formatNumber(row.orders) },
                        ]}
                      />
                    );
                  }}
                />
                <Bar dataKey="value" fill={theme.slot(0)} barSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false} activeBar={{ fillOpacity: 0.85 }}>
                  <LabelList
                    dataKey="value"
                    content={({ x, y, width, index, value }) =>
                      index === monthly.length - 1 ? (
                        <text x={Number(x) + Number(width) / 2} y={Number(y) - 8} textAnchor="middle" fontSize={12} fontWeight={600} className="fill-foreground">
                          {formatCompact(Number(value))}
                        </text>
                      ) : null
                    }
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </ChartCard>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <div className="flex items-center justify-between border-b px-5 py-4">
            <h2 className="font-semibold">Recent orders</h2>
            <Button variant="ghost" size="sm" asChild><Link href="/dashboard/orders">View all <ArrowRight /></Link></Button>
          </div>
          {!data ? (
            <div className="space-y-3 p-5">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : data.recentOrders.length === 0 ? (
            <EmptyState icon={<ShoppingBag />} title="No orders yet" description={isFarmer ? 'Orders appear here when buyers purchase your produce.' : 'Place your first order from the marketplace.'} />
          ) : (
            <ul className="divide-y">
              {data.recentOrders.map((order) => {
                const selling = order.farmerId === user?.id;
                return (
                  <li key={order.id}>
                    <Link href={`/dashboard/orders/${order.code}`} className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-muted/50">
                      <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl">
                        <SmartImage sizes="44px" src={order.listing?.produce?.imageUrl} alt={order.listing?.produce?.name ?? 'Produce'} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {order.listing?.produce?.name} · {formatNumber(order.quantity)} {order.unit}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {selling ? `Sold to ${order.buyer?.fullName}` : `From ${order.farmer?.fullName}`} · {timeAgo(order.createdAt)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold tabular-nums">{formatCurrency(order.totalAmount, { decimals: 0 })}</p>
                        <StatusBadge status={order.status} map={ORDER_STATUS} className="mt-0.5" />
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between border-b px-5 py-4">
            <h2 className="font-semibold">{isFarmer ? 'Your latest listings' : 'Listings you posted'}</h2>
            <Button variant="ghost" size="sm" asChild><Link href="/dashboard/listings">Manage <ArrowRight /></Link></Button>
          </div>
          {!data ? (
            <div className="space-y-3 p-5">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : data.recentListings.length === 0 ? (
            <EmptyState
              icon={<Package />}
              title="No listings yet"
              description="List your produce once and buyers across Ghana can find it."
              action={<Button variant="gradient" asChild><Link href="/dashboard/listings/new"><PlusCircle /> Create a listing</Link></Button>}
            />
          ) : (
            <ul className="divide-y">
              {data.recentListings.map((listing) => (
                <li key={listing.id}>
                  <Link href={`/marketplace/${listing.code}`} className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-muted/50">
                    <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl">
                      <SmartImage sizes="44px" src={listingPhotos(listing).cover} alt={listing.produce?.name ?? 'Produce'} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{listing.produce?.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {formatNumber(listing.quantityRemaining)} of {formatNumber(listing.quantity)} {listing.unit} left · {formatNumber(listing.views)} views
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold tabular-nums">{formatCurrency(listing.pricePerUnit, { decimals: 0 })}</p>
                      <StatusBadge status={listing.status} map={LISTING_STATUS} className={cn('mt-0.5')} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
