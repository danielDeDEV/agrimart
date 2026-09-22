'use client';

import * as React from 'react';
import { ChevronDown, FileClock, Search } from 'lucide-react';
import { api, errorMessage, type ApiResponse } from '@/lib/api';
import { cn, formatDateTime } from '@/lib/utils';
import {
  Badge, Button, Card, EmptyState, ErrorState, Input, PageHeader, Pagination, Select, SelectContent, SelectItem,
  SelectTrigger, SelectValue, TableSkeleton,
} from '@/components/ui';
import type { AuditLog } from '@/lib/types';

const ALL = 'all';
const SEVERITY = { info: 'secondary', warning: 'warning', critical: 'destructive' } as const;

export default function AuditLogPage() {
  const [severity, setSeverity] = React.useState('');
  const [entity, setEntity] = React.useState('');
  const [action, setAction] = React.useState('');
  const [query, setQuery] = React.useState('');
  const [page, setPage] = React.useState(1);
  const [rows, setRows] = React.useState<AuditLog[]>([]);
  const [meta, setMeta] = React.useState<ApiResponse['meta']>();
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [expanded, setExpanded] = React.useState<number | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<AuditLog[]>('/admin/audit-logs', { severity: severity || undefined, entity: entity || undefined, action: query || undefined, page, limit: 30 });
      setRows(res.data);
      setMeta(res.meta);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [severity, entity, query, page]);

  React.useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6">
      <PageHeader title="Audit log" description="Every administrative action and admin sign-in, with who did it, from where, and what changed." />

      <Card className="flex flex-wrap items-center gap-3 p-4">
        <Select value={severity || ALL} onValueChange={(v) => { setSeverity(v === ALL ? '' : v); setPage(1); }}>
          <SelectTrigger className="h-10 w-40"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value={ALL}>Any severity</SelectItem>{Object.keys(SEVERITY).map((s) => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={entity || ALL} onValueChange={(v) => { setEntity(v === ALL ? '' : v); setPage(1); }}>
          <SelectTrigger className="h-10 w-44"><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value={ALL}>Any record type</SelectItem>{['user', 'listing', 'order', 'market_price', 'broadcast', 'sms', 'ticket', 'transaction', 'farming_tip', 'setting', 'impact_record'].map((e) => <SelectItem key={e} value={e}>{e.replace('_', ' ')}</SelectItem>)}</SelectContent>
        </Select>
        <form className="ml-auto" onSubmit={(e) => { e.preventDefault(); setQuery(action.trim()); setPage(1); }}>
          <Input value={action} onChange={(e) => setAction(e.target.value)} placeholder="Action, e.g. user.suspend" icon={<Search />} className="h-10 w-60" />
        </form>
      </Card>

      <Card className="overflow-hidden">
        {error ? <ErrorState message={error} onRetry={load} /> : loading ? <TableSkeleton rows={10} cols={5} /> : rows.length === 0 ? <EmptyState icon={<FileClock />} title="No entries match" /> : (
          <>
            <ul className="divide-y">
              {rows.map((log) => {
                const hasDiff = !!(log.oldValue || log.newValue);
                const open = expanded === log.id;
                return (
                  <li key={log.id} className="px-5 py-3.5">
                    <div className="flex flex-wrap items-start gap-3">
                      <Badge variant={SEVERITY[log.severity]} size="sm" className="mt-0.5 capitalize">{log.severity}</Badge>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm"><span className="font-semibold">{log.actorName}</span> <span className="text-muted-foreground">({log.actorRole})</span> — {log.description ?? log.action}</p>
                        <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                          <code className="font-mono">{log.action}</code>
                          {log.entity && <span>{log.entity}{log.entityId ? ` #${log.entityId}` : ''}</span>}
                          {log.ipAddress && <span>IP {log.ipAddress}</span>}
                          <span>{formatDateTime(log.createdAt)}</span>
                        </p>
                      </div>
                      {hasDiff && (
                        <Button variant="ghost" size="sm" onClick={() => setExpanded(open ? null : log.id)}>
                          Changes <ChevronDown className={cn('transition-transform', open && 'rotate-180')} />
                        </Button>
                      )}
                    </div>
                    {open && (
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        {[['Before', log.oldValue], ['After', log.newValue]].map(([label, value]) => (
                          <div key={label as string} className="rounded-xl bg-muted/60 p-3">
                            <p className="mb-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">{label as string}</p>
                            <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono text-xs">{value ? JSON.stringify(value, null, 2) : '—'}</pre>
                          </div>
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
            {meta && <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} limit={meta.limit} onPageChange={setPage} />}
          </>
        )}
      </Card>
    </div>
  );
}
