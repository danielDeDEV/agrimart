'use client';

import * as React from 'react';
import {
  AlertTriangle, CalendarClock, Check, CheckCircle2, Copy, Megaphone, MessageSquare, RadioTower, Search, Send,
  Users, Wallet, XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage, type ApiResponse } from '@/lib/api';
import { cn, formatCurrency, formatDate, formatDateTime, formatNumber, titleCase } from '@/lib/utils';
import {
  Badge, Button, Card, EmptyState, ErrorState, Input, Label, PageHeader, Pagination, Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue, Skeleton, StatCard, StatusBadge, TableSkeleton, Tabs, TabsContent, TabsList, TabsTrigger, Textarea,
} from '@/components/ui';
import { ChartCard } from '@/components/charts/chart-kit';
import { TrendChart } from '@/components/charts/trend-chart';
import { BarList } from '@/components/charts/bar-list';
import { NETWORK_SLOTS, ShareBar } from '@/components/charts/share-bar';
import type { Broadcast, Region, SmsMessage } from '@/lib/types';

interface SmsStats {
  total: number; delivered: number; failed: number; inbound: number; deliveryRate: number; cost: number;
  byType: { type: string; count: number }[];
  byNetwork: { network: string; count: number }[];
  daily: { date: string; total: number; inbound: number; outbound: number }[];
}

interface GatewayStatus {
  provider: string;
  enabled: boolean;
  senderId: string;
  shortCode: string | null;
  ussdServiceCode: string;
  environment: 'sandbox' | 'live' | null;
  username: string | null;
  configured: boolean;
  publicUrl: string;
  isLocalUrl: boolean;
  secretSet: boolean;
  callbacks: { ussd: string; inboundSms: string; deliveryReports: string };
  balance: number | null;
  currency: string;
  error: string | null;
  note: string | null;
  safeMode: boolean;
  allowlist: string[];
}

const ALL = 'all';
const SMS_STATUS = {
  delivered: { label: 'Delivered', color: 'green' }, sent: { label: 'Sent', color: 'blue' }, queued: { label: 'Queued', color: 'amber' },
  sending: { label: 'Sending', color: 'amber' }, failed: { label: 'Failed', color: 'red' }, rejected: { label: 'Rejected', color: 'red' },
  skipped: { label: 'Skipped (safe mode)', color: 'slate' },
};
const BROADCAST_STATUS = {
  draft: { label: 'Draft', color: 'slate' }, scheduled: { label: 'Scheduled', color: 'blue' }, sending: { label: 'Sending', color: 'amber' },
  sent: { label: 'Sent', color: 'green' }, failed: { label: 'Failed', color: 'red' }, cancelled: { label: 'Cancelled', color: 'slate' },
};
const AUDIENCES = [
  { value: 'all', label: 'Everyone' }, { value: 'farmers', label: 'All farmers' }, { value: 'buyers', label: 'All buyers' },
  { value: 'agents', label: 'Field agents' }, { value: 'region', label: 'Everyone in a region' }, { value: 'custom', label: 'Specific numbers' },
];
const segments = (text: string) => (text.length <= 160 ? 1 : Math.ceil(text.length / 153));
const shortDate = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

export default function SmsCentrePage() {
  const [days, setDays] = React.useState(30);
  const [stats, setStats] = React.useState<SmsStats | null>(null);

  const [log, setLog] = React.useState<SmsMessage[]>([]);
  const [logMeta, setLogMeta] = React.useState<ApiResponse['meta']>();
  const [logPage, setLogPage] = React.useState(1);
  const [logFilters, setLogFilters] = React.useState({ direction: '', status: '', type: '', search: '' });
  const [logQuery, setLogQuery] = React.useState('');
  const [logLoading, setLogLoading] = React.useState(true);
  const [logError, setLogError] = React.useState<string | null>(null);

  const [broadcasts, setBroadcasts] = React.useState<Broadcast[]>([]);
  const [regions, setRegions] = React.useState<Region[]>([]);
  const [campaign, setCampaign] = React.useState({ title: '', message: '', audience: 'farmers', regionId: '', phones: '', scheduledAt: '' });
  const [preview, setPreview] = React.useState<{ recipientCount: number; segments: number; estimatedCost: number } | null>(null);
  const [single, setSingle] = React.useState({ phone: '', message: '' });
  const [busy, setBusy] = React.useState<string | null>(null);
  const [gateway, setGateway] = React.useState<GatewayStatus | null>(null);

  React.useEffect(() => {
    api.get<Region[]>('/reference/regions').then((r) => setRegions(r.data)).catch(() => {});
  }, []);

  React.useEffect(() => {
    api.get<SmsStats>('/admin/sms/stats', { days }).then((r) => setStats(r.data)).catch(() => {});
  }, [days]);

  React.useEffect(() => {
    api.get<GatewayStatus>('/admin/sms/gateway').then((r) => setGateway(r.data)).catch(() => {});
  }, []);

  const loadLog = React.useCallback(async () => {
    setLogLoading(true);
    setLogError(null);
    try {
      const res = await api.get<SmsMessage[]>('/admin/sms', {
        direction: logFilters.direction || undefined, status: logFilters.status || undefined, type: logFilters.type || undefined,
        search: logQuery || undefined, page: logPage, limit: 25,
      });
      setLog(res.data);
      setLogMeta(res.meta);
    } catch (err) {
      setLogError(errorMessage(err));
    } finally {
      setLogLoading(false);
    }
  }, [logFilters.direction, logFilters.status, logFilters.type, logQuery, logPage]);

  React.useEffect(() => {
    void loadLog();
  }, [loadLog]);

  const loadBroadcasts = React.useCallback(() => {
    api.get<Broadcast[]>('/admin/broadcasts').then((r) => setBroadcasts(r.data)).catch(() => {});
  }, []);
  React.useEffect(() => loadBroadcasts(), [loadBroadcasts]);

  const audiencePayload = () => ({
    audience: campaign.audience,
    filters: campaign.audience === 'region'
      ? { regionId: Number(campaign.regionId) }
      : campaign.audience === 'custom'
        ? { phones: campaign.phones.split(/[\s,;]+/).filter(Boolean) }
        : {},
  });

  // Live recipient count and cost as the audience or message changes
  React.useEffect(() => {
    if (campaign.audience === 'region' && !campaign.regionId) return setPreview(null);
    const timer = setTimeout(() => {
      api.post<{ recipientCount: number; segments: number; estimatedCost: number }>('/admin/broadcasts/preview', { ...audiencePayload(), message: campaign.message })
        .then((r) => setPreview(r.data))
        .catch(() => setPreview(null));
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign.audience, campaign.regionId, campaign.phones, campaign.message]);

  const sendCampaign = async () => {
    if (!campaign.title.trim()) return toast.error('Give the campaign a title');
    if (campaign.message.trim().length < 5) return toast.error('Write the message');
    if (!preview?.recipientCount) return toast.error('This audience has no reachable recipients');
    if (!window.confirm(`Send to ${preview.recipientCount} recipients (~${formatCurrency(preview.estimatedCost)})?`)) return;

    setBusy('campaign');
    try {
      const res = await api.post('/admin/broadcasts', {
        title: campaign.title, message: campaign.message, ...audiencePayload(),
        scheduledAt: campaign.scheduledAt ? new Date(campaign.scheduledAt).toISOString() : undefined,
      });
      toast.success(res.message);
      setCampaign((c) => ({ ...c, title: '', message: '', scheduledAt: '' }));
      loadBroadcasts();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const sendSingle = async () => {
    setBusy('single');
    try {
      const res = await api.post('/admin/sms/send', single);
      toast.success(res.message);
      setSingle({ phone: '', message: '' });
      void loadLog();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const networkItems = (stats?.byNetwork ?? []).map((n) => ({ key: n.network, label: n.network, value: n.count, slot: NETWORK_SLOTS[n.network] ?? 5 }));

  return (
    <div className="space-y-6">
      <PageHeader title="SMS centre" description="Every message the platform sends and receives, campaign broadcasts, and gateway health." />

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="log">Message log</TabsTrigger>
          <TabsTrigger value="broadcast"><Megaphone /> Broadcasts</TabsTrigger>
          <TabsTrigger value="send"><Send /> Send one</TabsTrigger>
          <TabsTrigger value="gateway"><RadioTower /> Gateway</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="flex rounded-xl border bg-card p-1 shadow-soft w-fit" role="group" aria-label="Date range">
            {[7, 30, 90].map((d) => (
              <button key={d} onClick={() => setDays(d)} className={cn('flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm font-medium', days === d ? 'bg-muted' : 'text-muted-foreground hover:text-foreground')}>
                {days === d && <Check className="h-4 w-4 stroke-[3]" />}{d} days
              </button>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Messages sent" value={stats ? formatNumber(stats.total) : ''} icon={<Send />} loading={!stats} />
            <StatCard label="Delivery rate" value={stats ? `${stats.deliveryRate}%` : ''} hint={stats ? `${formatNumber(stats.failed)} failed` : undefined} icon={<CheckCircle2 />} accent="blue" loading={!stats} />
            <StatCard label="Inbound from farmers" value={stats ? formatNumber(stats.inbound) : ''} hint="keyword commands" icon={<MessageSquare />} accent="gold" loading={!stats} />
            <StatCard label="Gateway cost" value={stats ? formatCurrency(stats.cost) : ''} icon={<Wallet />} accent="violet" loading={!stats} />
          </div>

          <ChartCard
            title="Daily message volume"
            description="Outbound alerts and inbound farmer messages per day."
            table={{
              columns: [
                { key: 'date', label: 'Date', format: (v) => formatDate(String(v)) },
                { key: 'outbound', label: 'Outbound', align: 'right' },
                { key: 'inbound', label: 'Inbound', align: 'right' },
              ],
              rows: [...(stats?.daily ?? [])].reverse() as unknown as Record<string, unknown>[],
            }}
          >
            {!stats ? <Skeleton className="mx-3 h-[260px]" /> : (
              <TrendChart data={stats.daily as unknown as Record<string, unknown>[]} xKey="date" xFormat={shortDate}
                series={[{ key: 'outbound', label: 'Outbound', slot: 0 }, { key: 'inbound', label: 'Inbound', slot: 1 }]} />
            )}
          </ChartCard>

          <div className="grid gap-6 lg:grid-cols-2">
            <ChartCard title="Messages by purpose" description="Outbound messages in the period."
              table={{ columns: [{ key: 'label', label: 'Type' }, { key: 'value', label: 'Messages', align: 'right' }], rows: (stats?.byType ?? []).map((t) => ({ label: titleCase(t.type), value: t.count })) }}>
              {!stats ? <Skeleton className="mx-3 h-56" /> : <BarList valueLabel="messages" items={[...stats.byType].sort((a, b) => b.count - a.count).map((t) => ({ label: titleCase(t.type), value: t.count }))} />}
            </ChartCard>
            <ChartCard title="Messages by network" description="Recipient mobile network, detected from the number prefix."
              table={{ columns: [{ key: 'label', label: 'Network' }, { key: 'value', label: 'Messages', align: 'right' }], rows: networkItems as unknown as Record<string, unknown>[] }}>
              {!stats ? <Skeleton className="mx-3 h-24" /> : <ShareBar items={networkItems} />}
            </ChartCard>
          </div>
        </TabsContent>

        <TabsContent value="log" className="space-y-4">
          <Card className="flex flex-wrap items-center gap-3 p-4">
            {([['direction', 'Any direction', ['outbound', 'inbound']], ['status', 'Any status', Object.keys(SMS_STATUS)], ['type', 'Any type', ['otp', 'welcome', 'listing', 'order', 'offer', 'payment', 'price_alert', 'price_digest', 'broadcast', 'reminder', 'support', 'system', 'inbound_command']]] as const).map(([key, placeholder, values]) => (
              <Select key={key} value={logFilters[key] || ALL} onValueChange={(v) => { setLogFilters((f) => ({ ...f, [key]: v === ALL ? '' : v })); setLogPage(1); }}>
                <SelectTrigger className="h-10 w-40"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value={ALL}>{placeholder}</SelectItem>{values.map((v) => <SelectItem key={v} value={v}>{titleCase(v)}</SelectItem>)}</SelectContent>
              </Select>
            ))}
            <form className="ml-auto" onSubmit={(e) => { e.preventDefault(); setLogQuery(logFilters.search.trim()); setLogPage(1); }}>
              <Input value={logFilters.search} onChange={(e) => setLogFilters((f) => ({ ...f, search: e.target.value }))} placeholder="Number or text" icon={<Search />} className="h-10 w-56" />
            </form>
          </Card>
          <Card className="overflow-hidden">
            {logError ? <ErrorState message={logError} onRetry={loadLog} /> : logLoading ? <TableSkeleton rows={10} cols={5} /> : log.length === 0 ? <EmptyState icon={<MessageSquare />} title="No messages match" /> : (
              <>
                <div className="overflow-x-auto"><table className="data-table">
                  <thead><tr><th>Recipient</th><th>Message</th><th>Type</th><th>Status</th><th className="text-right">Cost</th><th>Sent</th></tr></thead>
                  <tbody>{log.map((m) => (
                    <tr key={m.id}>
                      <td className="whitespace-nowrap"><p className="font-mono text-sm">{m.direction === 'inbound' ? m.sender : m.recipient}</p><p className="text-xs text-muted-foreground">{m.user?.fullName ?? '—'} · {m.network}</p></td>
                      <td className="max-w-md"><p className="line-clamp-2 text-sm">{m.message}</p>{m.errorMessage && <p className="text-xs text-destructive">{m.errorMessage}</p>}</td>
                      <td><Badge variant={m.direction === 'inbound' ? 'info' : 'outline'} size="sm">{titleCase(m.type)}</Badge></td>
                      <td><StatusBadge status={m.status} map={SMS_STATUS} /></td>
                      <td className="text-right tabular-nums text-xs">{Number(m.cost).toFixed(3)}</td>
                      <td className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(m.createdAt)}</td>
                    </tr>
                  ))}</tbody>
                </table></div>
                {logMeta && <Pagination page={logMeta.page} totalPages={logMeta.totalPages} total={logMeta.total} limit={logMeta.limit} onPageChange={setLogPage} />}
              </>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="broadcast">
          <div className="grid gap-6 xl:grid-cols-[1fr_1.1fr]">
            <Card className="space-y-4 p-6">
              <h2 className="flex items-center gap-2 font-semibold"><Megaphone className="h-4 w-4 text-primary" /> New campaign</h2>
              <div className="space-y-2"><Label required>Title (internal)</Label><Input value={campaign.title} onChange={(e) => setCampaign((c) => ({ ...c, title: e.target.value }))} placeholder="Techiman market day reminder" /></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label>Audience</Label>
                  <Select value={campaign.audience} onValueChange={(v) => setCampaign((c) => ({ ...c, audience: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{AUDIENCES.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                {campaign.audience === 'region' && (
                  <div className="space-y-2"><Label required>Region</Label>
                    <Select value={campaign.regionId} onValueChange={(v) => setCampaign((c) => ({ ...c, regionId: v }))}>
                      <SelectTrigger><SelectValue placeholder="Region" /></SelectTrigger>
                      <SelectContent>{regions.map((r) => <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              {campaign.audience === 'custom' && (
                <div className="space-y-2"><Label>Phone numbers</Label><Textarea rows={2} value={campaign.phones} onChange={(e) => setCampaign((c) => ({ ...c, phones: e.target.value }))} placeholder="0244123456, 0209876543" /></div>
              )}
              <div className="space-y-2">
                <Label required>Message</Label>
                <Textarea rows={5} maxLength={640} value={campaign.message} onChange={(e) => setCampaign((c) => ({ ...c, message: e.target.value }))} placeholder="AgriMart: …" className="font-mono text-sm" />
                <p className={cn('text-right text-xs', campaign.message.length > 160 ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground')}>
                  {campaign.message.length} characters · {segments(campaign.message)} segment{segments(campaign.message) === 1 ? '' : 's'} per recipient
                </p>
              </div>
              <div className="space-y-2"><Label>Schedule (optional)</Label><Input type="datetime-local" value={campaign.scheduledAt} onChange={(e) => setCampaign((c) => ({ ...c, scheduledAt: e.target.value }))} /></div>

              <div className="grid grid-cols-3 gap-3 rounded-xl bg-muted/60 p-4 text-center">
                <div><p className="text-xs text-muted-foreground">Recipients</p><p className="text-lg font-bold tabular-nums">{preview ? formatNumber(preview.recipientCount) : '—'}</p></div>
                <div><p className="text-xs text-muted-foreground">Segments</p><p className="text-lg font-bold tabular-nums">{preview ? preview.segments : '—'}</p></div>
                <div><p className="text-xs text-muted-foreground">Est. cost</p><p className="text-lg font-bold tabular-nums">{preview ? formatCurrency(preview.estimatedCost) : '—'}</p></div>
              </div>
              <Button variant="gradient" className="w-full" loading={busy === 'campaign'} onClick={sendCampaign}>
                {campaign.scheduledAt ? <><CalendarClock /> Schedule campaign</> : <><Users /> Send now</>}
              </Button>
            </Card>

            <Card className="overflow-hidden">
              <div className="border-b px-5 py-4"><h2 className="font-semibold">Campaign history</h2></div>
              {broadcasts.length === 0 ? <EmptyState icon={<Megaphone />} title="No campaigns yet" /> : (
                <ul className="divide-y">{broadcasts.map((b) => (
                  <li key={b.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div><p className="font-semibold">{b.title}</p><p className="text-xs text-muted-foreground">{titleCase(b.audience)} · by {b.creator?.fullName} · {formatDateTime(b.scheduledAt ?? b.createdAt)}</p></div>
                      <StatusBadge status={b.status} map={BROADCAST_STATUS} />
                    </div>
                    <p className="mt-2 line-clamp-2 font-mono text-xs text-muted-foreground">{b.message}</p>
                    <p className="mt-2 flex flex-wrap gap-x-4 text-xs">
                      <span><span className="font-semibold tabular-nums">{formatNumber(b.recipientCount)}</span> recipients</span>
                      <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-primary" /> {formatNumber(b.sentCount)} sent</span>
                      {b.failedCount > 0 && <span className="flex items-center gap-1"><XCircle className="h-3 w-3 text-destructive" /> {formatNumber(b.failedCount)} failed</span>}
                      <span className="text-muted-foreground">{formatCurrency(b.estimatedCost)}</span>
                    </p>
                  </li>
                ))}</ul>
              )}
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="send">
          <Card className="max-w-xl space-y-4 p-6">
            <h2 className="font-semibold">Send a single SMS</h2>
            {gateway && (
              <p className="rounded-xl border bg-muted/50 p-3 text-sm text-muted-foreground">
                {gateway.provider === 'mock'
                  ? 'Mock mode: the message is written to the log but not sent to any phone.'
                  : gateway.safeMode
                    ? `Sends through Africa's Talking. Safe mode is on, so only ${gateway.allowlist.join(', ')} will actually receive it — other numbers are logged as Skipped.`
                    : `Sends a real SMS through Africa's Talking${gateway.senderId ? ` from ${gateway.senderId}` : ''}. Each segment costs credit.`}
              </p>
            )}
            <div className="space-y-2"><Label required>Phone number</Label><Input value={single.phone} onChange={(e) => setSingle((s) => ({ ...s, phone: e.target.value }))} placeholder="0244123456" inputMode="tel" /></div>
            <div className="space-y-2">
              <Label required>Message</Label>
              <Textarea rows={4} maxLength={640} value={single.message} onChange={(e) => setSingle((s) => ({ ...s, message: e.target.value }))} className="font-mono text-sm" />
              <p className="text-right text-xs text-muted-foreground">{single.message.length} characters · {segments(single.message)} segment(s)</p>
            </div>
            <Button variant="gradient" loading={busy === 'single'} disabled={!single.phone || single.message.trim().length < 2} onClick={sendSingle}><Send /> Send</Button>
          </Card>
        </TabsContent>

        <TabsContent value="gateway" className="space-y-6">
          <GatewayPanel status={gateway} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/** Copies text and tells the person it worked — clipboard failures are silent otherwise. */
async function copyText(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(`${label} copied`);
  } catch {
    toast.error('Could not copy. Select the text and copy it by hand.');
  }
}

function CallbackRow({ label, url, hint }: { label: string; url: string; hint: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3">
      <div className="min-w-0">
        <p className="text-sm font-semibold">{label}</p>
        <p className="truncate font-mono text-xs text-muted-foreground" title={url}>{url}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
      </div>
      <Button size="sm" variant="outline" onClick={() => copyText(url, label)}><Copy /> Copy</Button>
    </div>
  );
}

/**
 * Everything an administrator needs to point Africa's Talking at this server:
 * what is configured, how much credit is left, and the three callback URLs.
 */
function GatewayPanel({ status }: { status: GatewayStatus | null }) {
  if (!status) return <Skeleton className="h-64" />;

  const isMock = status.provider === 'mock';
  const rows: { label: string; value: React.ReactNode }[] = [
    { label: 'Provider', value: isMock ? 'Mock (messages are logged, not sent)' : titleCase(status.provider.replace('africastalking', "Africa's Talking")) },
    ...(status.environment ? [{ label: 'Environment', value: status.environment === 'sandbox' ? 'Sandbox (test numbers only)' : 'Live' }] : []),
    ...(status.username ? [{ label: 'Account username', value: status.username }] : []),
    { label: 'Sender ID', value: status.senderId },
    ...(status.shortCode ? [{ label: 'SMS short code', value: status.shortCode }] : []),
    { label: 'USSD service code', value: <span className="font-mono">{status.ussdServiceCode}</span> },
    { label: 'Sending', value: status.enabled ? 'Enabled' : 'Disabled (SMS_ENABLED=false)' },
    {
      label: 'Credit left',
      value: status.balance === null
        ? (isMock ? 'Not applicable' : status.note ? 'See dashboard' : 'Unknown')
        : `${status.currency} ${formatNumber(status.balance)}`,
    },
  ];

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h3 className="flex items-center gap-2 font-semibold"><RadioTower className="h-4 w-4 text-primary" /> Gateway</h3>
          <dl className="mt-4 space-y-2.5 text-sm">
            {rows.map((row) => (
              <div key={row.label} className="flex items-start justify-between gap-4 border-b pb-2.5 last:border-0">
                <dt className="text-muted-foreground">{row.label}</dt>
                <dd className="text-right font-medium">{row.value}</dd>
              </div>
            ))}
          </dl>

          {!status.configured && (
            <p className="mt-4 flex gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              No API key. Add <code className="font-mono">AT_API_KEY</code> to agrimarket-backend/.env and restart the API.
            </p>
          )}
          {status.safeMode && (
            <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm">
              <p className="font-semibold text-foreground">Safe mode is on</p>
              <p className="mt-1 text-muted-foreground">
                Only {status.allowlist.join(', ')} {status.allowlist.length === 1 ? 'receives' : 'receive'} real messages.
                Everyone else&apos;s messages are logged as <em>Skipped</em> and never reach the gateway, so demo accounts
                cost nothing. Clear <code className="font-mono">SMS_ALLOWLIST</code> in .env when your farmers are real.
              </p>
            </div>
          )}
          {status.note && !status.error && (
            <p className="mt-4 text-sm text-muted-foreground">{status.note}</p>
          )}
          {status.error && (
            <p className="mt-3 flex gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
              <XCircle className="mt-0.5 h-4 w-4 shrink-0" /> {status.error}
            </p>
          )}
          {isMock && (
            <p className="mt-4 text-sm text-muted-foreground">
              Set <code className="font-mono">SMS_PROVIDER=africastalking</code> in agrimarket-backend/.env to send real messages.
            </p>
          )}
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold">Callback URLs</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Paste these into your Africa&apos;s Talking dashboard so the gateway can reach this server.
          </p>
          <div className="mt-4 space-y-3">
            <CallbackRow label="USSD callback" url={status.callbacks.ussd} hint="USSD → your service code → Callback URL" />
            <CallbackRow label="Incoming SMS" url={status.callbacks.inboundSms} hint="SMS → Inbox → Callback URL (needs a short code)" />
            <CallbackRow label="Delivery reports" url={status.callbacks.deliveryReports} hint="SMS → Delivery reports → Callback URL" />
          </div>

          {status.isLocalUrl && (
            <p className="mt-4 flex gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              These point at this computer, which Africa&apos;s Talking cannot reach. Run <code className="mx-1 font-mono">ngrok http 5000</code>
              and set <code className="mx-1 font-mono">PUBLIC_URL</code> in .env to the address it prints.
            </p>
          )}
          {!status.secretSet && (
            <p className="mt-3 text-sm text-muted-foreground">
              Tip: set <code className="font-mono">GATEWAY_SECRET</code> in .env and the URLs above will include it, so only
              Africa&apos;s Talking can post to them.
            </p>
          )}
        </Card>
      </div>
    </>
  );
}
