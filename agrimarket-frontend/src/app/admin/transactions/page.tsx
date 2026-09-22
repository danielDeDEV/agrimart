'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowDownLeft, ArrowUpRight, Banknote, CheckCircle2, Download, Search, Wallet, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage, type ApiResponse } from '@/lib/api';
import { csvFilename, exportTable } from '@/lib/export-csv';
import { cn, formatCurrency, formatDateTime, titleCase } from '@/lib/utils';
import {
  Button, Card, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, EmptyState,
  ErrorState, Input, Label, PageHeader, Pagination, Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  StatCard, StatusBadge, TableSkeleton,
} from '@/components/ui';
import type { Transaction } from '@/lib/types';

const ALL = 'all';
const TX_STATUS = {
  success: { label: 'Successful', color: 'green' },
  processing: { label: 'Processing', color: 'blue' },
  pending: { label: 'Pending', color: 'amber' },
  failed: { label: 'Failed', color: 'red' },
  reversed: { label: 'Reversed', color: 'slate' },
};
const TYPES = ['payment', 'payout', 'commission', 'refund', 'topup', 'withdrawal', 'reversal'];

export default function AdminTransactionsPage() {
  const [type, setType] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [rows, setRows] = React.useState<Transaction[]>([]);
  const [meta, setMeta] = React.useState<ApiResponse['meta']>();
  const [totals, setTotals] = React.useState<{ inflow: number; outflow: number; commission: number } | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [failing, setFailing] = React.useState<Transaction | null>(null);
  const [reason, setReason] = React.useState('');
  const [busyId, setBusyId] = React.useState<number | null>(null);

  const [exporting, setExporting] = React.useState(false);

  /** Downloads the rows the current filters match, for accounting and reporting. */
  const exportCsv = async () => {
    setExporting(true);
    try {
      const count = await exportTable<Transaction>({
        endpoint: '/admin/transactions',
        params: { type: type || undefined, status: status || undefined, search: query || undefined },
        filename: csvFilename('transactions'),
        columns: [
          { header: 'Reference', value: (tx) => tx.reference },
          { header: 'Date', value: (tx) => tx.createdAt.slice(0, 10) },
          { header: 'Account', value: (tx) => tx.user?.fullName ?? '' },
          { header: 'Phone', value: (tx) => tx.user?.phone ?? '' },
          { header: 'Type', value: (tx) => tx.type },
          { header: 'Direction', value: (tx) => tx.direction },
          { header: 'Amount (GHS)', value: (tx) => Number(tx.amount ?? 0) },
          { header: 'Fee (GHS)', value: (tx) => Number(tx.fee ?? 0) },
          { header: 'Net (GHS)', value: (tx) => Number(tx.netAmount ?? 0) },
          { header: 'Method', value: (tx) => tx.method },
          { header: 'Provider', value: (tx) => tx.provider },
          { header: 'Status', value: (tx) => tx.status },
          { header: 'Order', value: (tx) => tx.order?.code ?? '' },
          { header: 'Description', value: (tx) => tx.description ?? '' },
        ],
      });
      toast.success(`${count.toLocaleString()} rows exported`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<Transaction[]>('/admin/transactions', { type: type || undefined, status: status || undefined, search: query || undefined, page, limit: 20 });
      setRows(res.data);
      setMeta(res.meta);
      try { setTotals(JSON.parse(res.message)); } catch { setTotals(null); }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [type, status, query, page]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const settle = async (tx: Transaction, next: 'success' | 'failed' | 'reversed', failureReason?: string) => {
    setBusyId(tx.id);
    try {
      const res = await api.patch(`/admin/transactions/${tx.id}`, { status: next, failureReason });
      toast.success(res.message, { description: next !== 'success' && tx.direction === 'debit' ? 'The amount was returned to the user’s wallet.' : undefined });
      setFailing(null);
      setReason('');
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transactions"
        description="The wallet ledger: sale payouts, withdrawals to mobile money and platform commission."
        action={<Button variant="outline" loading={exporting} onClick={exportCsv}><Download /> Export CSV</Button>}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Credited to wallets" value={totals ? formatCurrency(totals.inflow, { compact: true, decimals: 0 }) : ''} icon={<ArrowDownLeft />} loading={!totals} />
        <StatCard label="Paid out" value={totals ? formatCurrency(totals.outflow, { compact: true, decimals: 0 }) : ''} icon={<ArrowUpRight />} accent="gold" loading={!totals} />
        <StatCard label="Commission earned" value={totals ? formatCurrency(totals.commission, { compact: true, decimals: 0 }) : ''} icon={<Banknote />} accent="blue" loading={!totals} />
      </div>

      <Card className="flex flex-wrap items-center gap-3 p-4">
        <Select value={type || ALL} onValueChange={(v) => { setType(v === ALL ? '' : v); setPage(1); }}>
          <SelectTrigger className="h-10 w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All types</SelectItem>
            {TYPES.map((t) => <SelectItem key={t} value={t}>{titleCase(t)}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={status || ALL} onValueChange={(v) => { setStatus(v === ALL ? '' : v); setPage(1); }}>
          <SelectTrigger className="h-10 w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Any status</SelectItem>
            {Object.entries(TX_STATUS).map(([v, m]) => <SelectItem key={v} value={v}>{m.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <form className="ml-auto" onSubmit={(e) => { e.preventDefault(); setQuery(search.trim()); setPage(1); }}>
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Reference" icon={<Search />} className="h-10 w-52" />
        </form>
      </Card>

      <Card className="overflow-hidden">
        {error ? <ErrorState message={error} onRetry={load} /> : loading ? <TableSkeleton rows={8} cols={6} /> : rows.length === 0 ? (
          <EmptyState icon={<Wallet />} title="No transactions match" />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead><tr><th>Reference</th><th>User</th><th>Type</th><th className="text-right">Amount</th><th>Destination</th><th>Status</th><th>Date</th><th /></tr></thead>
                <tbody>
                  {rows.map((tx) => {
                    const actionable = ['pending', 'processing'].includes(tx.status);
                    return (
                      <tr key={tx.id}>
                        <td><code className="font-mono text-xs">{tx.reference}</code>{tx.order && <p className="text-xs text-muted-foreground">{tx.order.code}</p>}</td>
                        <td className="text-sm"><Link href={`/admin/users/${tx.userId}`} className="hover:text-primary">{tx.user?.fullName}</Link><p className="text-xs text-muted-foreground capitalize">{tx.user?.role}</p></td>
                        <td>{titleCase(tx.type)}</td>
                        <td className={cn('text-right font-semibold tabular-nums')}>{tx.direction === 'credit' ? '+' : '−'} {formatCurrency(tx.amount)}{Number(tx.fee) > 0 && <p className="text-xs font-normal text-muted-foreground">fee {formatCurrency(tx.fee)}</p>}</td>
                        <td className="text-xs text-muted-foreground">{tx.method.toUpperCase()} · {tx.provider}</td>
                        <td><StatusBadge status={tx.status} map={TX_STATUS} /></td>
                        <td className="whitespace-nowrap text-xs text-muted-foreground">{formatDateTime(tx.createdAt)}</td>
                        <td>
                          {actionable && (
                            <div className="flex gap-1">
                              <Button size="sm" variant="subtle" loading={busyId === tx.id} onClick={() => settle(tx, 'success')}><CheckCircle2 /> Paid</Button>
                              <Button size="sm" variant="ghost" onClick={() => setFailing(tx)}><XCircle /> Fail</Button>
                            </div>
                          )}
                        </td>
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

      <Dialog open={!!failing} onOpenChange={(o) => !o && setFailing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark {failing?.reference} as failed</DialogTitle>
            <DialogDescription>{formatCurrency(failing?.amount)} goes back to {failing?.user?.fullName}’s wallet.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2"><Label>Reason</Label><Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. MoMo number not registered" /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFailing(null)}>Cancel</Button>
            <Button variant="destructive" loading={busyId === failing?.id} onClick={() => failing && settle(failing, 'failed', reason || undefined)}>Mark failed</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
