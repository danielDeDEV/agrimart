'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  Bell, CheckCheck, HandCoins, LifeBuoy, MessageSquare, Package, ShoppingCart, Sprout, Trash2, TrendingUp, UserCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage, type ApiResponse } from '@/lib/api';
import { useSocketEvent } from '@/lib/socket';
import { cn, formatDateTime, timeAgo, titleCase } from '@/lib/utils';
import {
  Badge, Button, Card, EmptyState, ErrorState, PageHeader, Pagination, Skeleton, StatusBadge,
} from '@/components/ui';
import type { Notification, SmsMessage } from '@/lib/types';

const TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  order: ShoppingCart,
  offer: HandCoins,
  listing: Sprout,
  payment: Package,
  price: TrendingUp,
  support: LifeBuoy,
  account: UserCheck,
  system: Bell,
};

const SMS_STATUS = {
  delivered: { label: 'Delivered', color: 'green' },
  sent: { label: 'Sent', color: 'blue' },
  queued: { label: 'Queued', color: 'amber' },
  sending: { label: 'Sending', color: 'amber' },
  failed: { label: 'Failed', color: 'red' },
  rejected: { label: 'Rejected', color: 'red' },
};

export default function NotificationsPage() {
  const [tab, setTab] = React.useState<'app' | 'sms'>('app');
  const [items, setItems] = React.useState<Notification[]>([]);
  const [sms, setSms] = React.useState<SmsMessage[]>([]);
  const [meta, setMeta] = React.useState<ApiResponse['meta']>();
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (tab === 'app') {
        const res = await api.get<Notification[]>('/notifications', { page, limit: 20 });
        setItems(res.data);
        setMeta(res.meta);
      } else {
        const res = await api.get<SmsMessage[]>('/sms/mine', { page, limit: 20 });
        setSms(res.data);
        setMeta(res.meta);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [tab, page]);

  React.useEffect(() => {
    void load();
  }, [load]);

  useSocketEvent<Notification>('notification', (n) => {
    if (tab === 'app' && page === 1) setItems((prev) => [n, ...prev]);
  });

  const markAll = async () => {
    try {
      await api.patch('/notifications/read', {});
      setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
      toast.success('All caught up');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const markOne = async (n: Notification) => {
    if (n.isRead) return;
    setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, isRead: true } : x)));
    api.patch('/notifications/read', { ids: [n.id] }).catch(() => {});
  };

  const remove = async (n: Notification) => {
    setItems((prev) => prev.filter((x) => x.id !== n.id));
    api.delete(`/notifications/${n.id}`).catch(() => {});
  };

  const unread = items.filter((n) => !n.isRead).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Everything that happened on your account, and every SMS we sent your phone."
        action={tab === 'app' && unread > 0 ? <Button variant="outline" onClick={markAll}><CheckCheck /> Mark all read</Button> : undefined}
      />

      <div className="inline-flex rounded-xl bg-muted p-1">
        {([['app', 'In-app'], ['sms', 'SMS inbox']] as const).map(([value, label]) => (
          <button
            key={value}
            onClick={() => { setTab(value); setPage(1); }}
            className={cn('flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-medium transition-all', tab === value ? 'bg-background shadow-soft' : 'text-muted-foreground hover:text-foreground')}
          >
            {value === 'app' ? <Bell className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />} {label}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        {error ? (
          <ErrorState message={error} onRetry={load} />
        ) : loading ? (
          <div className="space-y-3 p-5">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
        ) : tab === 'app' ? (
          items.length === 0 ? (
            <EmptyState icon={<Bell />} title="You're all caught up" description="New orders, offers and price alerts will appear here." />
          ) : (
            <ul className="divide-y">
              {items.map((n) => {
                const Icon = TYPE_ICON[n.type] ?? Bell;
                const content = (
                  <div className={cn('group flex gap-4 px-5 py-4 transition-colors hover:bg-muted/40', !n.isRead && 'bg-primary-50/50 dark:bg-primary-950/20')}>
                    <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', n.isRead ? 'bg-muted text-muted-foreground' : 'bg-primary text-white')}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn('text-sm', n.isRead ? 'font-medium' : 'font-bold')}>{n.title}</p>
                        <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(n.createdAt)}</span>
                      </div>
                      <p className="mt-0.5 text-sm text-muted-foreground">{n.message}</p>
                      {n.priority === 'high' && <Badge variant="warning" size="sm" className="mt-1.5">Needs attention</Badge>}
                    </div>
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); remove(n); }}
                      className="self-center rounded-lg p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-destructive group-hover:opacity-100"
                      aria-label="Delete notification"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
                return (
                  <li key={n.id} onClick={() => markOne(n)}>
                    {n.link ? <Link href={n.link}>{content}</Link> : content}
                  </li>
                );
              })}
            </ul>
          )
        ) : sms.length === 0 ? (
          <EmptyState icon={<MessageSquare />} title="No SMS yet" description="Order alerts, price digests and confirmations will be listed here." />
        ) : (
          <ul className="divide-y">
            {sms.map((m) => (
              <li key={m.id} className="px-5 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" size="sm">{m.direction === 'inbound' ? 'You sent' : 'AgriMart'}</Badge>
                    <span className="text-xs text-muted-foreground">{titleCase(m.type)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={m.status} map={SMS_STATUS} />
                    <span className="text-xs text-muted-foreground">{formatDateTime(m.createdAt)}</span>
                  </div>
                </div>
                <p className="mt-2 max-w-2xl rounded-2xl rounded-tl-sm bg-muted px-4 py-2.5 font-mono text-[13px] leading-relaxed">{m.message}</p>
              </li>
            ))}
          </ul>
        )}
        {meta && !loading && <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} limit={meta.limit} onPageChange={setPage} />}
      </Card>
    </div>
  );
}
