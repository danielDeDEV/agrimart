'use client';

import * as React from 'react';
import { ArrowDownLeft, ArrowUpRight, Banknote, Receipt, Send, Smartphone, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage, type ApiResponse } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn, formatCurrency, formatDateTime, titleCase } from '@/lib/utils';
import { MOMO_PROVIDERS } from '@/lib/constants';
import {
  Button, Card, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, EmptyState,
  ErrorState, Input, Label, PageHeader, Pagination, Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  StatCard, StatusBadge, TableSkeleton,
} from '@/components/ui';
import type { Transaction } from '@/lib/types';

const TX_STATUS = {
  success: { label: 'Successful', color: 'green' },
  processing: { label: 'Processing', color: 'blue' },
  pending: { label: 'Pending', color: 'amber' },
  failed: { label: 'Failed', color: 'red' },
  reversed: { label: 'Reversed', color: 'slate' },
};

export default function WalletPage() {
  const { user, refresh } = useAuth();
  const [txs, setTxs] = React.useState<Transaction[]>([]);
  const [meta, setMeta] = React.useState<ApiResponse['meta']>();
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);
  const [form, setForm] = React.useState({ amount: '', momoNumber: '', momoProvider: 'mtn' });
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (user) setForm((f) => ({ ...f, momoNumber: user.momoNumber || user.phone, momoProvider: user.momoProvider || 'mtn' }));
  }, [user]);

  const load = React.useCallback(() => {
    setLoading(true);
    api
      .get<Transaction[]>('/users/me/transactions', { page, limit: 15 })
      .then((res) => { setTxs(res.data); setMeta(res.meta); setError(null); })
      .catch((err) => setError(errorMessage(err)))
      .finally(() => setLoading(false));
  }, [page]);

  React.useEffect(() => load(), [load]);

  const balance = Number(user?.walletBalance ?? 0);
  const amount = Number(form.amount);
  const fee = Number((amount * 0.01).toFixed(2));
  const earned = txs.filter((t) => t.direction === 'credit' && t.status === 'success').reduce((s, t) => s + Number(t.netAmount), 0);
  const withdrawn = txs.filter((t) => t.type === 'withdrawal').reduce((s, t) => s + Number(t.amount), 0);

  const withdraw = async () => {
    if (!amount || amount < 10) return toast.error('The minimum withdrawal is GHS 10');
    if (amount > balance) return toast.error('That is more than your balance');
    setBusy(true);
    try {
      const res = await api.post('/users/me/withdraw', { amount, momoNumber: form.momoNumber, momoProvider: form.momoProvider });
      toast.success(res.message, { description: 'A confirmation SMS is on its way.' });
      setOpen(false);
      setForm((f) => ({ ...f, amount: '' }));
      await refresh();
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Wallet"
        description="Proceeds from completed sales land here. Withdraw to mobile money any time."
        action={<Button variant="gradient" onClick={() => setOpen(true)} disabled={balance < 10}><Send /> Withdraw to MoMo</Button>}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Available balance" value={formatCurrency(balance)} icon={<Wallet />} hint="ready to withdraw" />
        <StatCard label="Credited (this page)" value={formatCurrency(earned, { decimals: 0 })} icon={<ArrowDownLeft />} accent="blue" loading={loading} />
        <StatCard label="Withdrawn (this page)" value={formatCurrency(withdrawn, { decimals: 0 })} icon={<ArrowUpRight />} accent="gold" loading={loading} />
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="font-semibold">Transactions</h2>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Smartphone className="h-3.5 w-3.5" /> Also on USSD: My Account → Wallet</p>
        </div>
        {error ? (
          <ErrorState message={error} onRetry={load} />
        ) : loading ? (
          <TableSkeleton rows={6} cols={4} />
        ) : txs.length === 0 ? (
          <EmptyState icon={<Receipt />} title="No transactions yet" description="Your first completed sale will show up here." />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr><th>Transaction</th><th>Reference</th><th className="text-right">Amount</th><th>Status</th><th>Date</th></tr>
                </thead>
                <tbody>
                  {txs.map((tx) => {
                    const credit = tx.direction === 'credit';
                    return (
                      <tr key={tx.id}>
                        <td>
                          <div className="flex items-center gap-3">
                            <span className={cn('flex h-9 w-9 items-center justify-center rounded-lg', credit ? 'bg-primary-50 text-primary-700 dark:bg-primary-950' : 'bg-muted text-muted-foreground')}>
                              {credit ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                            </span>
                            <div>
                              <p className="font-medium">{titleCase(tx.type)}</p>
                              <p className="text-xs text-muted-foreground">{tx.description}</p>
                            </div>
                          </div>
                        </td>
                        <td className="font-mono text-xs">{tx.reference}{tx.order && <p className="text-muted-foreground">{tx.order.code}</p>}</td>
                        <td className="text-right tabular-nums">
                          <p className="font-semibold">{credit ? '+' : '−'} {formatCurrency(tx.amount)}</p>
                          {Number(tx.fee) > 0 && <p className="text-xs text-muted-foreground">fee {formatCurrency(tx.fee)}</p>}
                        </td>
                        <td><StatusBadge status={tx.status} map={TX_STATUS} /></td>
                        <td className="whitespace-nowrap text-muted-foreground">{formatDateTime(tx.createdAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {meta && <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} limit={meta.limit} onPageChange={setPage} />}
          </>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Withdraw to mobile money</DialogTitle>
            <DialogDescription>Available: {formatCurrency(balance)}. Minimum GHS 10, fee 1%.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label required>Amount</Label>
              <Input type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} suffix="GHS" />
              <div className="flex gap-2">
                {[0.25, 0.5, 1].map((share) => (
                  <Button key={share} type="button" size="sm" variant="outline" onClick={() => setForm((f) => ({ ...f, amount: String(Math.floor(balance * share)) }))}>
                    {share === 1 ? 'All' : `${share * 100}%`}
                  </Button>
                ))}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Network</Label>
                <Select value={form.momoProvider} onValueChange={(v) => setForm((f) => ({ ...f, momoProvider: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{MOMO_PROVIDERS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>MoMo number</Label>
                <Input value={form.momoNumber} onChange={(e) => setForm((f) => ({ ...f, momoNumber: e.target.value }))} inputMode="tel" />
              </div>
            </div>
            {amount > 0 && (
              <div className="space-y-1 rounded-xl bg-muted/60 p-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Fee</span><span className="tabular-nums">{formatCurrency(fee)}</span></div>
                <div className="flex justify-between font-semibold"><span>You receive</span><span className="tabular-nums">{formatCurrency(Math.max(0, amount - fee))}</span></div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="gradient" loading={busy} onClick={withdraw}><Banknote /> Withdraw</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
