'use client';

import * as React from 'react';
import Link from 'next/link';
import { Check, CheckCircle2, Clock, ExternalLink, Footprints, Phone, Search, Smartphone, Timer, Users } from 'lucide-react';
import { api, errorMessage, type ApiResponse } from '@/lib/api';
import { cn, formatDate, formatDateTime, formatNumber, titleCase } from '@/lib/utils';
import { SITE } from '@/lib/constants';
import { useSettings } from '@/components/settings-provider';
import {
  Badge, Button, Card, Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, EmptyState, ErrorState,
  Input, PageHeader, Pagination, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Skeleton, StatCard,
  StatusBadge, Switch, TableSkeleton,
} from '@/components/ui';
import { ChartCard } from '@/components/charts/chart-kit';
import { TrendChart } from '@/components/charts/trend-chart';
import { BarList } from '@/components/charts/bar-list';
import { NETWORK_SLOTS, ShareBar } from '@/components/charts/share-bar';
import type { UssdSession } from '@/lib/types';

interface UssdAnalytics {
  totals: { sessions: number; completed: number; timedOut: number; uniqueUsers: number; completionRate: number; avgSteps: number; avgDurationSeconds: number };
  outcomes: { outcome: string; count: number }[];
  byNetwork: { network: string; count: number }[];
  daily: { date: string; sessions: number }[];
}

const ALL = 'all';
const SESSION_STATUS = {
  active: { label: 'Active', color: 'blue' }, completed: { label: 'Completed', color: 'green' }, timeout: { label: 'Timed out', color: 'amber' },
  aborted: { label: 'Abandoned', color: 'slate' }, error: { label: 'Error', color: 'red' },
};
const shortDate = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

export default function UssdMonitorPage() {
  const site = useSettings();
  const [days, setDays] = React.useState(30);
  const [analytics, setAnalytics] = React.useState<UssdAnalytics | null>(null);
  const [rows, setRows] = React.useState<UssdSession[]>([]);
  const [meta, setMeta] = React.useState<ApiResponse['meta']>();
  const [page, setPage] = React.useState(1);
  const [status, setStatus] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [phoneQuery, setPhoneQuery] = React.useState('');
  const [includeSimulated, setIncludeSimulated] = React.useState(true);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [replay, setReplay] = React.useState<UssdSession | null>(null);

  React.useEffect(() => {
    api.get<UssdAnalytics>('/admin/ussd/analytics', { days }).then((r) => setAnalytics(r.data)).catch(() => {});
  }, [days]);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<UssdSession[]>('/admin/ussd/sessions', {
        status: status || undefined, phone: phoneQuery || undefined, includeSimulated: includeSimulated ? 'true' : undefined, page, limit: 20,
      });
      setRows(res.data);
      setMeta(res.meta);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [status, phoneQuery, includeSimulated, page]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const openReplay = async (row: UssdSession) => {
    setReplay(row);
    try {
      const res = await api.get<UssdSession>(`/admin/ussd/sessions/${row.id}`);
      setReplay(res.data);
    } catch {
      /* keep the summary row */
    }
  };

  const t = analytics?.totals;
  const networkItems = (analytics?.byNetwork ?? []).map((n) => ({ key: n.network, label: n.network, value: n.count, slot: NETWORK_SLOTS[n.network] ?? 5 }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="USSD monitor"
        description={`Live sessions on ${site.ussdCode}. Analytics exclude simulator traffic; the session list can include it.`}
        action={<Button variant="outline" asChild><Link href="/ussd" target="_blank"><Smartphone /> Open simulator <ExternalLink /></Link></Button>}
      />

      <div className="flex w-fit rounded-xl border bg-card p-1 shadow-soft" role="group" aria-label="Date range">
        {[7, 30, 90].map((d) => (
          <button key={d} onClick={() => setDays(d)} className={cn('flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium', days === d ? 'bg-muted' : 'text-muted-foreground hover:text-foreground')}>
            {days === d && <Check className="h-4 w-4 stroke-[3]" />}{d} days
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Sessions" value={t ? formatNumber(t.sessions) : ''} hint={t ? `${formatNumber(t.uniqueUsers)} unique numbers` : undefined} icon={<Phone />} loading={!t} />
        <StatCard label="Completion rate" value={t ? `${t.completionRate}%` : ''} hint={t ? `${formatNumber(t.timedOut)} timed out` : undefined} icon={<CheckCircle2 />} accent="blue" loading={!t} />
        <StatCard label="Average steps" value={t ? t.avgSteps.toFixed(1) : ''} hint="screens per session" icon={<Footprints />} accent="gold" loading={!t} />
        <StatCard label="Average duration" value={t ? `${t.avgDurationSeconds}s` : ''} hint="completed sessions" icon={<Timer />} accent="violet" loading={!t} />
      </div>

      <ChartCard
        title="Sessions per day"
        table={{ columns: [{ key: 'date', label: 'Date', format: (v) => formatDate(String(v)) }, { key: 'sessions', label: 'Sessions', align: 'right' }], rows: [...(analytics?.daily ?? [])].reverse() as unknown as Record<string, unknown>[] }}
      >
        {!analytics ? <Skeleton className="mx-3 h-[240px]" /> : (
          <TrendChart height={240} data={analytics.daily as unknown as Record<string, unknown>[]} xKey="date" xFormat={shortDate} series={[{ key: 'sessions', label: 'Sessions', slot: 0 }]} />
        )}
      </ChartCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <ChartCard title="What sessions achieved" description="Completed sessions by outcome."
          table={{ columns: [{ key: 'label', label: 'Outcome' }, { key: 'value', label: 'Sessions', align: 'right' }], rows: (analytics?.outcomes ?? []).map((o) => ({ label: titleCase(o.outcome), value: o.count })) }}>
          {!analytics ? <Skeleton className="mx-3 h-48" /> : <BarList valueLabel="sessions" items={[...analytics.outcomes].sort((a, b) => b.count - a.count).map((o) => ({ label: titleCase(o.outcome), value: o.count }))} />}
        </ChartCard>
        <ChartCard title="Sessions by network"
          table={{ columns: [{ key: 'label', label: 'Network' }, { key: 'value', label: 'Sessions', align: 'right' }], rows: networkItems as unknown as Record<string, unknown>[] }}>
          {!analytics ? <Skeleton className="mx-3 h-24" /> : <ShareBar items={networkItems} />}
        </ChartCard>
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b p-4">
          <h2 className="mr-auto font-semibold">Sessions</h2>
          <label className="flex items-center gap-2 text-sm"><Switch checked={includeSimulated} onCheckedChange={(v) => { setIncludeSimulated(v); setPage(1); }} /> Include simulator</label>
          <Select value={status || ALL} onValueChange={(v) => { setStatus(v === ALL ? '' : v); setPage(1); }}>
            <SelectTrigger className="h-10 w-40"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value={ALL}>Any status</SelectItem>{Object.entries(SESSION_STATUS).map(([v, m]) => <SelectItem key={v} value={v}>{m.label}</SelectItem>)}</SelectContent>
          </Select>
          <form onSubmit={(e) => { e.preventDefault(); setPhoneQuery(phone.trim()); setPage(1); }}>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone number" icon={<Search />} className="h-10 w-48" />
          </form>
        </div>
        {error ? <ErrorState message={error} onRetry={load} /> : loading ? <TableSkeleton rows={8} cols={6} /> : rows.length === 0 ? <EmptyState icon={<Smartphone />} title="No sessions match" /> : (
          <>
            <div className="overflow-x-auto"><table className="data-table">
              <thead><tr><th>Caller</th><th>Last screen</th><th>Outcome</th><th className="text-right">Steps</th><th className="text-right">Duration</th><th>Status</th><th>Started</th></tr></thead>
              <tbody>{rows.map((s) => (
                <tr key={s.id} className="cursor-pointer" onClick={() => openReplay(s)}>
                  <td><p className="font-mono text-sm">{s.phone}</p><p className="text-xs text-muted-foreground">{s.user?.fullName ?? 'Unregistered'} · {s.network}{s.isSimulated && ' · simulator'}</p></td>
                  <td><code className="text-xs">{s.state}</code></td>
                  <td>{s.outcome ? <Badge variant="success" size="sm">{titleCase(s.outcome)}</Badge> : <span className="text-muted-foreground">—</span>}</td>
                  <td className="text-right tabular-nums">{s.stepCount}</td>
                  <td className="text-right tabular-nums">{s.durationSeconds}s</td>
                  <td><StatusBadge status={s.status} map={SESSION_STATUS} /></td>
                  <td className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(s.createdAt)}</td>
                </tr>
              ))}</tbody>
            </table></div>
            {meta && <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} limit={meta.limit} onPageChange={setPage} />}
          </>
        )}
      </Card>

      <Dialog open={!!replay} onOpenChange={(o) => !o && setReplay(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Session replay</DialogTitle>
            <DialogDescription>{replay?.phone} · {replay?.user?.fullName ?? 'Unregistered caller'} · {replay && formatDateTime(replay.createdAt)}</DialogDescription>
          </DialogHeader>
          {replay && (
            <div className="space-y-3">
              {(replay.history ?? []).length === 0 ? (
                <p className="rounded-xl bg-muted/60 p-4 text-sm text-muted-foreground">No screen transcript was recorded for this session.</p>
              ) : (
                replay.history.map((h) => (
                  <div key={h.step} className="space-y-1.5">
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="flex h-5 w-5 items-center justify-center rounded bg-muted text-[10px] font-bold text-foreground">{h.step}</span>
                      pressed <code className="rounded bg-primary-50 px-1.5 font-mono font-bold text-primary-700 dark:bg-primary-950 dark:text-primary-300">{h.input}</code>
                      <Clock className="ml-auto h-3 w-3" /> {new Date(h.at).toLocaleTimeString('en-GB')}
                    </p>
                    <pre className="ussd-screen whitespace-pre-wrap break-words rounded-xl p-3 text-[12px]">{h.output.replace(/^(CON|END) /, '')}</pre>
                  </div>
                ))
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
