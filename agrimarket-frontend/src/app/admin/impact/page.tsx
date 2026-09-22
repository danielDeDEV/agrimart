'use client';

import * as React from 'react';
import Link from 'next/link';
import { BarChart3, ClipboardList, PlusCircle, Search } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage, type ApiResponse } from '@/lib/api';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import {
  Badge, Button, Card, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, EmptyState,
  ErrorState, Input, Label, PageHeader, Pagination, Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  Switch, TableSkeleton, Textarea,
} from '@/components/ui';
import type { ImpactRecord, User } from '@/lib/types';

const ALL = 'all';
const blank = {
  userId: '', period: `${new Date().getFullYear()}-Q${Math.floor(new Date().getMonth() / 3) + 1}`, surveyType: 'endline',
  monthlyIncomeBefore: '', monthlyIncomeAfter: '', buyersReachedBefore: '', buyersReachedAfter: '',
  marketsAccessedBefore: '', marketsAccessedAfter: '', postHarvestLossBefore: '', postHarvestLossAfter: '',
  travelCostSaved: '', satisfactionScore: '4', collectionMethod: 'field_agent', feedback: '',
  soldThroughPlatform: true, usesUssd: true, usesSms: true, usesWeb: false, wouldRecommend: true,
};
type Form = typeof blank;

export default function SurveyRecordsPage() {
  const [surveyType, setSurveyType] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [rows, setRows] = React.useState<ImpactRecord[]>([]);
  const [meta, setMeta] = React.useState<ApiResponse['meta']>();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState<Form>({ ...blank });
  const [farmerSearch, setFarmerSearch] = React.useState('');
  const [farmers, setFarmers] = React.useState<User[]>([]);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<ImpactRecord[]>('/admin/impact', { surveyType: surveyType || undefined, page, limit: 20 });
      setRows(res.data);
      setMeta(res.meta);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [surveyType, page]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const findFarmers = async () => {
    try {
      const res = await api.get<User[]>('/admin/users', { role: 'farmer', search: farmerSearch || undefined, limit: 8 });
      setFarmers(res.data);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));
  const num = (v: string) => (v === '' ? undefined : Number(v));

  const save = async () => {
    if (!form.userId) return toast.error('Choose the farmer surveyed');
    setBusy(true);
    try {
      await api.post('/admin/impact', {
        ...form,
        userId: Number(form.userId),
        monthlyIncomeBefore: num(form.monthlyIncomeBefore), monthlyIncomeAfter: num(form.monthlyIncomeAfter),
        buyersReachedBefore: num(form.buyersReachedBefore), buyersReachedAfter: num(form.buyersReachedAfter),
        marketsAccessedBefore: num(form.marketsAccessedBefore), marketsAccessedAfter: num(form.marketsAccessedAfter),
        postHarvestLossBefore: num(form.postHarvestLossBefore), postHarvestLossAfter: num(form.postHarvestLossAfter),
        travelCostSaved: num(form.travelCostSaved), satisfactionScore: num(form.satisfactionScore),
        feedback: form.feedback || undefined,
      });
      toast.success('Survey response saved');
      setOpen(false);
      setForm({ ...blank });
      setFarmers([]);
      setFarmerSearch('');
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const pair = (label: string, before: keyof Form, after: keyof Form, suffix?: string) => (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="grid grid-cols-2 gap-2">
        <Input type="number" placeholder="Before" value={String(form[before])} onChange={(e) => set(before, e.target.value as never)} suffix={suffix} />
        <Input type="number" placeholder="After" value={String(form[after])} onChange={(e) => set(after, e.target.value as never)} suffix={suffix} />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Survey records"
        description="Baseline, midline and endline responses collected from farmers. These feed the impact analytics."
        action={<div className="flex gap-2"><Button variant="outline" asChild><Link href="/admin/analytics"><BarChart3 /> View analytics</Link></Button><Button variant="gradient" onClick={() => setOpen(true)}><PlusCircle /> Record survey</Button></div>}
      />

      <div className="flex w-fit rounded-xl bg-muted p-1">
        {['', 'baseline', 'midline', 'endline'].map((t) => (
          <button key={t || 'all'} onClick={() => { setSurveyType(t); setPage(1); }} className={cn('rounded-lg px-4 py-1.5 text-sm font-medium capitalize', surveyType === t ? 'bg-background shadow-soft' : 'text-muted-foreground hover:text-foreground')}>{t || 'All'}</button>
        ))}
      </div>

      <Card className="overflow-hidden">
        {error ? <ErrorState message={error} onRetry={load} /> : loading ? <TableSkeleton rows={8} cols={6} /> : rows.length === 0 ? <EmptyState icon={<ClipboardList />} title="No survey responses yet" /> : (
          <>
            <div className="overflow-x-auto"><table className="data-table">
              <thead><tr><th>Farmer</th><th>Survey</th><th className="text-right">Income before → after</th><th className="text-right">Change</th><th className="text-right">Buyers</th><th className="text-right">Loss</th><th className="text-right">Satisfaction</th><th>Collected</th></tr></thead>
              <tbody>{rows.map((r) => (
                <tr key={r.id}>
                  <td><Link href={`/admin/users/${r.userId}`} className="font-medium hover:text-primary">{r.farmer?.fullName}</Link><p className="text-xs text-muted-foreground">{r.farmer?.region?.name}</p></td>
                  <td><Badge variant="outline" size="sm" className="capitalize">{r.surveyType}</Badge><p className="text-xs text-muted-foreground">{r.period}</p></td>
                  <td className="whitespace-nowrap text-right tabular-nums text-sm">{formatCurrency(r.monthlyIncomeBefore, { decimals: 0 })} → {formatCurrency(r.monthlyIncomeAfter, { decimals: 0 })}</td>
                  <td className="text-right font-semibold tabular-nums">{r.incomeChangePercent != null ? `${Number(r.incomeChangePercent) > 0 ? '+' : ''}${Number(r.incomeChangePercent).toFixed(0)}%` : '—'}</td>
                  <td className="text-right tabular-nums">{r.buyersReachedBefore} → {r.buyersReachedAfter}</td>
                  <td className="text-right tabular-nums">{r.postHarvestLossBefore ?? '—'}% → {r.postHarvestLossAfter ?? '—'}%</td>
                  <td className="text-right tabular-nums">{r.satisfactionScore ?? '—'}/5</td>
                  <td className="whitespace-nowrap text-xs text-muted-foreground">{formatDate(r.createdAt)}</td>
                </tr>
              ))}</tbody>
            </table></div>
            {meta && <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} limit={meta.limit} onPageChange={setPage} />}
          </>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Record a survey response</DialogTitle>
            <DialogDescription>Enter what the farmer reported before joining and now. Income change is calculated automatically.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label required>Farmer</Label>
              <div className="flex gap-2">
                <Input value={farmerSearch} onChange={(e) => setFarmerSearch(e.target.value)} placeholder="Search name or phone" icon={<Search />} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void findFarmers(); } }} />
                <Button variant="outline" onClick={findFarmers}>Find</Button>
              </div>
              {farmers.length > 0 && (
                <Select value={form.userId} onValueChange={(v) => set('userId', v)}>
                  <SelectTrigger><SelectValue placeholder="Choose farmer" /></SelectTrigger>
                  <SelectContent>{farmers.map((f) => <SelectItem key={f.id} value={String(f.id)}>{f.fullName} · {f.phone}</SelectItem>)}</SelectContent>
                </Select>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2"><Label>Survey</Label>
                <Select value={form.surveyType} onValueChange={(v) => set('surveyType', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{['baseline', 'midline', 'endline'].map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Period</Label><Input value={form.period} onChange={(e) => set('period', e.target.value)} placeholder="2026-Q3" /></div>
              <div className="space-y-2"><Label>Method</Label>
                <Select value={form.collectionMethod} onValueChange={(v) => set('collectionMethod', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{[['field_agent', 'Field agent'], ['phone', 'Phone call'], ['ussd', 'USSD'], ['sms', 'SMS'], ['web', 'Web']].map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {pair('Monthly income (GHS)', 'monthlyIncomeBefore', 'monthlyIncomeAfter')}
              {pair('Buyers reached', 'buyersReachedBefore', 'buyersReachedAfter')}
              {pair('Markets accessed', 'marketsAccessedBefore', 'marketsAccessedAfter')}
              {pair('Post-harvest loss', 'postHarvestLossBefore', 'postHarvestLossAfter', '%')}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Travel cost saved (GHS)</Label><Input type="number" value={form.travelCostSaved} onChange={(e) => set('travelCostSaved', e.target.value)} /></div>
              <div className="space-y-2"><Label>Satisfaction (1–5)</Label>
                <Select value={form.satisfactionScore} onValueChange={(v) => set('satisfactionScore', v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{['1', '2', '3', '4', '5'].map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              {([['soldThroughPlatform', 'Sold on platform'], ['usesUssd', 'Uses USSD'], ['usesSms', 'Uses SMS'], ['usesWeb', 'Uses web'], ['wouldRecommend', 'Would recommend']] as const).map(([key, label]) => (
                <label key={key} className="flex items-center justify-between rounded-xl border p-2.5 text-sm">{label}<Switch checked={form[key]} onCheckedChange={(v) => set(key, v)} /></label>
              ))}
            </div>
            <div className="space-y-2"><Label>Farmer’s own words</Label><Textarea rows={3} value={form.feedback} onChange={(e) => set('feedback', e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="gradient" loading={busy} onClick={save}>Save response</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
