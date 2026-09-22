'use client';

import * as React from 'react';
import Link from 'next/link';
import { BellRing, LineChart, PlusCircle, Smartphone, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { formatCurrency, timeAgo } from '@/lib/utils';
import {
  Badge, Button, Card, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
  EmptyState, ErrorState, Input, Label, PageHeader, Select, SelectContent, SelectItem, SelectTrigger,
  SelectValue, Skeleton, SmartImage,
} from '@/components/ui';
import type { PriceAlert, Produce } from '@/lib/types';

export default function AlertsPage() {
  const [alerts, setAlerts] = React.useState<PriceAlert[]>([]);
  const [produce, setProduce] = React.useState<Produce[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({ produceId: '', targetPrice: '', direction: 'above', channel: 'both' });
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(() => {
    api
      .get<PriceAlert[]>('/prices/alerts')
      .then((res) => { setAlerts(res.data); setError(null); })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    load();
    api.get<Produce[]>('/reference/produce').then((r) => setProduce(r.data)).catch(() => {});
  }, [load]);

  const create = async () => {
    if (!form.produceId) return toast.error('Choose a produce');
    if (!Number(form.targetPrice)) return toast.error('Enter a target price');
    setBusy(true);
    try {
      const res = await api.post('/prices/alerts', { ...form, produceId: Number(form.produceId), targetPrice: Number(form.targetPrice) });
      toast.success(res.message);
      setOpen(false);
      setForm({ produceId: '', targetPrice: '', direction: 'above', channel: 'both' });
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (alert: PriceAlert) => {
    try {
      await api.delete(`/prices/alerts/${alert.id}`);
      setAlerts((prev) => prev.filter((a) => a.id !== alert.id));
      toast.success('Alert removed');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const selected = produce.find((p) => String(p.id) === form.produceId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Price alerts"
        description="Get an SMS the moment a market price crosses your target — so you sell at the right time, not the first time."
        action={<Button variant="gradient" onClick={() => setOpen(true)}><PlusCircle /> New alert</Button>}
      />

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : loading ? (
        <div className="grid gap-4 md:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
      ) : alerts.length === 0 ? (
        <Card>
          <EmptyState
            icon={<BellRing />}
            title="No price alerts yet"
            description="Set a target for the crops you grow or buy. You can also create alerts from the USSD prices menu."
            action={<Button variant="outline" asChild><Link href="/prices"><LineChart /> Check today’s prices</Link></Button>}
          />
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {alerts.map((alert) => (
            <Card key={alert.id} className="flex items-center gap-4 p-5">
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl">
                <SmartImage sizes="56px" src={alert.produce?.imageUrl} alt={alert.produce?.name ?? 'Produce'} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{alert.produce?.name}</p>
                <p className="text-sm">
                  {alert.direction === 'above' ? 'At or above' : 'At or below'}{' '}
                  <span className="font-bold tabular-nums">{formatCurrency(alert.targetPrice, { decimals: 0 })}</span>
                  <span className="text-muted-foreground"> per {alert.unit}</span>
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <Badge variant={alert.isActive ? 'success' : 'secondary'} size="sm">{alert.isActive ? 'Active' : 'Paused'}</Badge>
                  <Badge variant="outline" size="sm"><Smartphone /> {alert.channel === 'in_app' ? 'In-app' : 'SMS'}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {alert.triggerCount ? `Triggered ${alert.triggerCount}× · last ${timeAgo(alert.lastTriggeredAt)}` : 'Not triggered yet'}
                  </span>
                </div>
              </div>
              <Button variant="ghost" size="icon-sm" onClick={() => remove(alert)} aria-label="Delete alert"><Trash2 /></Button>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New price alert</DialogTitle>
            <DialogDescription>We check every new market price record against your target.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label required>Produce</Label>
              <Select value={form.produceId} onValueChange={(v) => setForm((f) => ({ ...f, produceId: v }))}>
                <SelectTrigger><SelectValue placeholder="Choose produce" /></SelectTrigger>
                <SelectContent>{produce.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label required>Target price{selected ? ` per ${selected.defaultUnit}` : ''}</Label>
                <Input type="number" value={form.targetPrice} onChange={(e) => setForm((f) => ({ ...f, targetPrice: e.target.value }))} suffix="GHS" />
              </div>
              <div className="space-y-2">
                <Label>Notify when price is</Label>
                <Select value={form.direction} onValueChange={(v) => setForm((f) => ({ ...f, direction: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="above">At or above</SelectItem>
                    <SelectItem value="below">At or below</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Deliver by</Label>
              <Select value={form.channel} onValueChange={(v) => setForm((f) => ({ ...f, channel: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="both">SMS and in-app</SelectItem>
                  <SelectItem value="sms">SMS only</SelectItem>
                  <SelectItem value="in_app">In-app only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="gradient" loading={busy} onClick={create}>Create alert</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
