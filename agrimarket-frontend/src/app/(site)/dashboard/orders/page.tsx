'use client';

import * as React from 'react';
import Link from 'next/link';
import { Search, ShoppingBag } from 'lucide-react';
import { api, errorMessage, type ApiResponse } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn, formatCurrency, formatDate, formatNumber } from '@/lib/utils';
import { CHANNEL_META, ORDER_STATUS } from '@/lib/constants';
import {
  Badge, Button, EmptyState, ErrorState, Input, PageHeader, Pagination, Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue, SmartImage, StatusBadge, TableSkeleton,
} from '@/components/ui';
import type { Order } from '@/lib/types';

const ALL = 'all';

export default function OrdersPage() {
  const { user } = useAuth();
  const [role, setRole] = React.useState<'' | 'buying' | 'selling'>(user?.role === 'buyer' ? 'buying' : '');
  const [status, setStatus] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [orders, setOrders] = React.useState<Order[]>([]);
  const [meta, setMeta] = React.useState<ApiResponse['meta']>();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<Order[]>('/orders', {
        role: role || undefined,
        status: status || undefined,
        search: query || undefined,
        page,
        limit: 12,
      });
      setOrders(res.data);
      setMeta(res.meta);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [role, status, query, page]);

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <PageHeader title="Orders" description="Track every sale and purchase. Each status change is also sent to you by SMS." />

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-xl bg-muted p-1">
          {([['', 'All'], ['selling', 'Selling'], ['buying', 'Buying']] as const).map(([value, label]) => (
            <button
              key={label}
              onClick={() => { setRole(value); setPage(1); }}
              className={cn('rounded-lg px-4 py-1.5 text-sm font-medium transition-all', role === value ? 'bg-background shadow-soft' : 'text-muted-foreground hover:text-foreground')}
            >
              {label}
            </button>
          ))}
        </div>
        <Select value={status || ALL} onValueChange={(v) => { setStatus(v === ALL ? '' : v); setPage(1); }}>
          <SelectTrigger className="h-10 w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Any status</SelectItem>
            {Object.entries(ORDER_STATUS).map(([value, meta]) => <SelectItem key={value} value={value}>{meta.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <form onSubmit={(e) => { e.preventDefault(); setQuery(search.trim()); setPage(1); }} className="ml-auto">
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Order code" icon={<Search />} className="h-10 w-48" />
        </form>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-soft">
        {error ? (
          <ErrorState message={error} onRetry={load} />
        ) : loading ? (
          <TableSkeleton rows={6} cols={5} />
        ) : orders.length === 0 ? (
          <EmptyState
            icon={<ShoppingBag />}
            title="No orders found"
            description="Orders you place or receive will appear here."
            action={<Button variant="outline" asChild><Link href="/marketplace">Browse the marketplace</Link></Button>}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Trading with</th>
                    <th className="text-right">Quantity</th>
                    <th className="text-right">Total</th>
                    <th>Status</th>
                    <th>Placed</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => {
                    const selling = order.farmerId === user?.id;
                    const other = selling ? order.buyer : order.farmer;
                    return (
                      <tr key={order.id}>
                        <td>
                          <Link href={`/dashboard/orders/${order.code}`} className="flex items-center gap-3">
                            <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg">
                              <SmartImage sizes="40px" src={order.listing?.produce?.imageUrl} alt={order.listing?.produce?.name ?? 'Produce'} />
                            </div>
                            <div>
                              <p className="font-semibold hover:text-primary">{order.listing?.produce?.name}</p>
                              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <code className="font-mono">{order.code}</code>
                                <Badge variant={selling ? 'success' : 'info'} size="sm">{selling ? 'Selling' : 'Buying'}</Badge>
                              </p>
                            </div>
                          </Link>
                        </td>
                        <td>
                          <p className="font-medium">{other?.businessName || other?.fullName}</p>
                          <p className="text-xs text-muted-foreground">via {CHANNEL_META[order.source]?.label ?? order.source}</p>
                        </td>
                        <td className="text-right tabular-nums">{formatNumber(order.quantity)} {order.unit}</td>
                        <td className="text-right font-semibold tabular-nums">{formatCurrency(order.totalAmount, { decimals: 0 })}</td>
                        <td><StatusBadge status={order.status} map={ORDER_STATUS} /></td>
                        <td className="whitespace-nowrap text-muted-foreground">{formatDate(order.createdAt)}</td>
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
    </div>
  );
}
