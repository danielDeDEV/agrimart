'use client';

import * as React from 'react';
import { Info, Lock, MessageSquare, Save, Smartphone, Webhook } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage, API_URL } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { titleCase } from '@/lib/utils';
import { Badge, Button, Card, Input, Label, PageHeader, Skeleton, Switch } from '@/components/ui';

interface SettingRow {
  id: number;
  key: string;
  value: string;
  type: 'string' | 'number' | 'boolean' | 'json';
  group: string;
  label?: string;
  description?: string;
  isPublic: boolean;
  isEditable: boolean;
}

const GROUP_ORDER = ['general', 'marketplace', 'payment', 'sms', 'ussd', 'notification', 'security'];

export default function AdminSettingsPage() {
  const { user } = useAuth();
  // Every administrator may change platform settings; the audit log records who did
  const canEdit = user?.role === 'admin' || user?.role === 'superadmin';
  const [rows, setRows] = React.useState<SettingRow[]>([]);
  const [draft, setDraft] = React.useState<Record<string, string>>({});
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(() => {
    setLoading(true);
    api.get<SettingRow[]>('/admin/settings')
      .then((r) => { setRows(r.data); setDraft(Object.fromEntries(r.data.map((s) => [s.key, s.value]))); })
      .catch((err) => toast.error(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => load(), [load]);

  const changed = rows.filter((r) => draft[r.key] !== r.value);

  const save = async () => {
    setSaving(true);
    try {
      const res = await api.patch('/admin/settings', { settings: changed.map((r) => ({ key: r.key, value: draft[r.key] })) });
      toast.success(res.message);
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const groups = GROUP_ORDER.map((g) => ({ group: g, items: rows.filter((r) => r.group === g) })).filter((g) => g.items.length);
  const apiBase = API_URL.replace(/\/$/, '');

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Platform-wide configuration. Changes are recorded in the audit log."
        action={canEdit ? <Button variant="gradient" loading={saving} disabled={!changed.length} onClick={save}><Save /> Save {changed.length || ''} change{changed.length === 1 ? '' : 's'}</Button> : <Badge variant="warning"><Lock /> Read-only — sign in as an administrator</Badge>}
      />

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          {loading ? Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-48" />) : groups.map(({ group, items }) => (
            <Card key={group} className="divide-y">
              <div className="px-6 py-4"><h2 className="font-semibold">{titleCase(group)}</h2></div>
              {items.map((s) => (
                <div key={s.key} className="flex flex-wrap items-center gap-4 px-6 py-4">
                  <div className="min-w-[200px] flex-1">
                    <Label htmlFor={s.key} className="flex items-center gap-2">{s.label ?? s.key} {s.isPublic && <Badge variant="outline" size="sm">public</Badge>}</Label>
                    {s.description && <p className="mt-1 text-xs text-muted-foreground">{s.description}</p>}
                    <code className="mt-1 block text-[11px] text-muted-foreground">{s.key}</code>
                  </div>
                  {s.type === 'boolean' ? (
                    <Switch id={s.key} disabled={!canEdit || !s.isEditable} checked={draft[s.key] === 'true'} onCheckedChange={(v) => setDraft((d) => ({ ...d, [s.key]: String(v) }))} />
                  ) : (
                    <Input id={s.key} className="w-full sm:w-72" type={s.type === 'number' ? 'number' : 'text'} disabled={!canEdit || !s.isEditable} value={draft[s.key] ?? ''} onChange={(e) => setDraft((d) => ({ ...d, [s.key]: e.target.value }))} />
                  )}
                </div>
              ))}
            </Card>
          ))}
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="flex items-center gap-2 font-semibold"><Webhook className="h-4 w-4 text-primary" /> Gateway callback URLs</h2>
            <p className="mt-1 text-sm text-muted-foreground">Register these with your aggregator (Africa’s Talking, Hubtel, Nalo, mNotify). They must be reachable from the internet — use your deployed domain, or a tunnel such as ngrok while testing locally.</p>
            <dl className="mt-4 space-y-3 text-sm">
              {[
                { icon: Smartphone, label: 'USSD callback', value: `${apiBase}/ussd` },
                { icon: MessageSquare, label: 'Inbound SMS', value: `${apiBase}/sms/inbound` },
                { icon: MessageSquare, label: 'SMS delivery reports', value: `${apiBase}/sms/delivery-report` },
              ].map((row) => (
                <div key={row.label}>
                  <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><row.icon className="h-3.5 w-3.5" /> {row.label}</dt>
                  <dd className="mt-1 break-all rounded-lg bg-muted px-3 py-2 font-mono text-xs">{row.value}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card className="p-6">
            <h2 className="flex items-center gap-2 font-semibold"><Info className="h-4 w-4 text-primary" /> Provider credentials</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              API keys are never stored in the database or shown here. Set them in <code className="rounded bg-muted px-1">agrimarket-backend/.env</code> and restart the API:
            </p>
            <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-950 p-4 font-mono text-[11px] leading-relaxed text-slate-200">{`SMS_PROVIDER=africastalking   # mock | africastalking | hubtel | mnotify | twilio
AT_USERNAME=your_username
AT_API_KEY=your_api_key
SMS_SENDER_ID=AgriMart
USSD_SERVICE_CODE=*920*1234#
GATEWAY_SECRET=long_random_string`}</pre>
            <p className="mt-3 text-xs text-muted-foreground">With <code>SMS_PROVIDER=mock</code> every message is logged in the SMS centre and marked delivered, but nothing is sent or billed.</p>
          </Card>
        </div>
      </div>
    </div>
  );
}
