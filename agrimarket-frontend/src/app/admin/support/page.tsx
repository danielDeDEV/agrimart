'use client';

import * as React from 'react';
import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Clock, Inbox, LifeBuoy, Phone, Search, Send, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { cn, formatCurrency, formatDateTime, timeAgo, titleCase } from '@/lib/utils';
import {
  Badge, Button, Card, EmptyState, Input, Label, PageHeader, Select, SelectContent, SelectItem, SelectTrigger,
  SelectValue, Skeleton, StatCard, StatusBadge, Textarea,
} from '@/components/ui';
import type { SupportTicket } from '@/lib/types';

const ALL = 'all';
const TICKET_STATUS = {
  open: { label: 'Open', color: 'amber' }, in_progress: { label: 'In progress', color: 'blue' },
  resolved: { label: 'Resolved', color: 'green' }, closed: { label: 'Closed', color: 'slate' },
};
const PRIORITY = { urgent: 'destructive', high: 'warning', normal: 'secondary', low: 'outline' } as const;

export default function SupportDeskPage() {
  const [stats, setStats] = React.useState<{ open: number; inProgress: number; resolved: number; urgent: number } | null>(null);
  const [tickets, setTickets] = React.useState<SupportTicket[]>([]);
  const [status, setStatus] = React.useState('open');
  const [search, setSearch] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [loading, setLoading] = React.useState(true);
  const [selectedId, setSelectedId] = React.useState<number | null>(null);
  const [reply, setReply] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [list, s] = await Promise.all([
        api.get<SupportTicket[]>('/admin/support', { status: status || undefined, search: query || undefined, limit: 100 }),
        api.get<{ open: number; inProgress: number; resolved: number; urgent: number }>('/admin/support/stats'),
      ]);
      setTickets(list.data);
      setStats(s.data);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [status, query]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const selected = tickets.find((t) => t.id === selectedId) ?? null;

  const update = async (body: Record<string, unknown>, message: string) => {
    if (!selected) return;
    setBusy(true);
    try {
      await api.patch(`/admin/support/${selected.id}`, body);
      toast.success(message);
      setReply('');
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Support desk" description="Tickets from the website, the USSD help menu and SMS. Replies are sent to the farmer by SMS." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Open" value={stats?.open ?? ''} icon={<Inbox />} accent="gold" loading={!stats} />
        <StatCard label="In progress" value={stats?.inProgress ?? ''} icon={<Clock />} accent="blue" loading={!stats} />
        <StatCard label="Urgent & unresolved" value={stats?.urgent ?? ''} icon={<AlertTriangle />} accent="red" loading={!stats} />
        <StatCard label="Resolved" value={stats?.resolved ?? ''} icon={<CheckCircle2 />} loading={!stats} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <Card className="flex max-h-[720px] flex-col overflow-hidden">
          <div className="space-y-2 border-b p-3">
            <Select value={status || ALL} onValueChange={(v) => setStatus(v === ALL ? '' : v)}>
              <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value={ALL}>All tickets</SelectItem>{Object.entries(TICKET_STATUS).map(([v, m]) => <SelectItem key={v} value={v}>{m.label}</SelectItem>)}</SelectContent>
            </Select>
            <form onSubmit={(e) => { e.preventDefault(); setQuery(search.trim()); }}>
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Code, subject, phone" icon={<Search />} className="h-10" />
            </form>
          </div>
          <div className="flex-1 overflow-y-auto">
            {loading ? <div className="space-y-2 p-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-16" />)}</div> : tickets.length === 0 ? (
              <EmptyState icon={<LifeBuoy />} title="Inbox zero" description="No tickets in this view." />
            ) : (
              <ul className="divide-y">{tickets.map((t) => (
                <li key={t.id}>
                  <button onClick={() => { setSelectedId(t.id); setReply(''); }} className={cn('w-full px-4 py-3 text-left transition-colors hover:bg-muted/50', selectedId === t.id && 'bg-primary-50 dark:bg-primary-950/40')}>
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-sm font-semibold">{t.subject}</p>
                      <Badge variant={PRIORITY[t.priority]} size="sm" className="capitalize">{t.priority}</Badge>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{t.user?.fullName ?? t.name ?? t.phone} · {titleCase(t.category)} · {t.channel}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{t.code} · {timeAgo(t.createdAt)}</p>
                  </button>
                </li>
              ))}</ul>
            )}
          </div>
        </Card>

        <Card className="p-6">
          {!selected ? (
            <EmptyState icon={<LifeBuoy />} title="Select a ticket" description="Choose a ticket on the left to read and reply." />
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs text-muted-foreground">{selected.code}</p>
                  <h2 className="text-xl font-bold">{selected.subject}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {selected.user ? <Link href={`/admin/users/${selected.user.id}`} className="font-medium text-foreground hover:text-primary">{selected.user.fullName}</Link> : selected.name ?? 'Guest'}
                    {' · '}{selected.phone}{selected.email ? ` · ${selected.email}` : ''} · {formatDateTime(selected.createdAt)}
                  </p>
                </div>
                <StatusBadge status={selected.status} map={TICKET_STATUS} />
              </div>

              <div className="flex flex-wrap gap-2">
                <Badge variant="outline">{titleCase(selected.category)}</Badge>
                <Badge variant="outline">{selected.channel === 'ussd' ? <Smartphone /> : null} via {selected.channel}</Badge>
                {selected.phone && <Button size="sm" variant="subtle" asChild><a href={`tel:${selected.phone}`}><Phone /> Call</a></Button>}
              </div>

              <div className="rounded-xl bg-muted/60 p-4 text-sm leading-relaxed whitespace-pre-wrap">{selected.message}</div>

              {!!selected.attachments?.length && (
                <div className="mt-4">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Evidence sent by the {selected.user?.role === 'farmer' ? 'farmer' : 'buyer'}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selected.attachments.map((src, i) => (
                      <a
                        key={src}
                        href={src}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="relative h-24 w-24 overflow-hidden rounded-lg border transition hover:ring-2 hover:ring-primary/40"
                        title="Open full size"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={src} alt={`Attachment ${i + 1}`} className="h-full w-full object-cover" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {selected.order && (
                <div className="mt-4 rounded-xl border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Order in question</p>
                      <Link href={`/admin/orders?search=${selected.order.code}`} className="font-mono font-semibold hover:text-primary">
                        {selected.order.code}
                      </Link>
                      <span className="ml-2 text-sm text-muted-foreground">
                        {formatCurrency(selected.order.totalAmount)} · {titleCase(selected.order.status)}
                      </span>
                    </div>
                  </div>
                  {selected.order.paymentProof ? (
                    <div className="mt-3 text-sm">
                      <p className="text-muted-foreground">
                        Buyer recorded {formatCurrency(selected.order.paymentProof.amount ?? selected.order.totalAmount)}
                        {selected.order.paymentProof.method ? ` by ${selected.order.paymentProof.method}` : ''}
                        {selected.order.paymentProof.reference ? ` — ref ${selected.order.paymentProof.reference}` : ''}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(selected.order.paymentProof.images ?? []).map((src, i) => (
                          <a key={src} href={src} target="_blank" rel="noopener noreferrer" className="relative h-20 w-20 overflow-hidden rounded-lg border hover:ring-2 hover:ring-primary/40">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={src} alt={`Payment proof ${i + 1}`} className="h-full w-full object-cover" />
                          </a>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">No payment was recorded against this order.</p>
                  )}
                </div>
              )}

              {selected.response && (
                <div className="rounded-xl border-l-4 border-primary bg-primary-50/60 p-4 text-sm dark:bg-primary-950/30">
                  <p className="text-xs font-bold uppercase tracking-wider text-primary-700 dark:text-primary-300">Previous reply</p>
                  <p className="mt-1">{selected.response}</p>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={selected.status} onValueChange={(v) => update({ status: v }, 'Status updated')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.entries(TICKET_STATUS).map(([v, m]) => <SelectItem key={v} value={v}>{m.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Priority</Label>
                  <Select value={selected.priority} onValueChange={(v) => update({ priority: v }, 'Priority updated')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{Object.keys(PRIORITY).map((v) => <SelectItem key={v} value={v} className="capitalize">{v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Reply</Label>
                <Textarea rows={5} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Your reply is sent by SMS (first 220 characters) and shown in the user's dashboard." />
                <p className="text-right text-xs text-muted-foreground">{reply.length} characters</p>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" loading={busy} disabled={!reply.trim()} onClick={() => update({ response: reply.trim(), status: 'in_progress' }, 'Reply sent')}>Reply &amp; keep open</Button>
                <Button variant="gradient" loading={busy} disabled={!reply.trim()} onClick={() => update({ response: reply.trim(), status: 'resolved' }, 'Reply sent and ticket resolved')}><Send /> Reply &amp; resolve</Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
