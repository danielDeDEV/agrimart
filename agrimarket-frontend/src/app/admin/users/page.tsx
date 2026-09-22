'use client';

import * as React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { BadgeCheck, Ban, CheckCircle2, Download, Eye, MoreHorizontal, Search, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage, type ApiResponse } from '@/lib/api';
import { csvFilename, exportTable } from '@/lib/export-csv';
import { cn, formatDate, formatPhone, initials, timeAgo } from '@/lib/utils';
import { CHANNEL_META } from '@/lib/constants';
import {
  Avatar, AvatarFallback, Badge, Button, Card, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader,
  DialogTitle, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
  EmptyState, ErrorState, Input, Label, PageHeader, Pagination, Select, SelectContent, SelectItem, SelectTrigger,
  SelectValue, StatusBadge, TableSkeleton, Textarea,
} from '@/components/ui';
import type { Region, User } from '@/lib/types';

const USER_STATUS = {
  active: { label: 'Active', color: 'green' },
  pending: { label: 'Pending', color: 'amber' },
  suspended: { label: 'Suspended', color: 'red' },
  banned: { label: 'Banned', color: 'slate' },
};
const ALL = 'all';

function UsersView() {
  const params = useSearchParams();
  const [role, setRole] = React.useState('');
  const [status, setStatus] = React.useState('');
  const [channel, setChannel] = React.useState('');
  const [regionId, setRegionId] = React.useState('');
  const [search, setSearch] = React.useState(params.get('search') ?? '');
  const [query, setQuery] = React.useState(params.get('search') ?? '');
  const [page, setPage] = React.useState(1);
  const [users, setUsers] = React.useState<User[]>([]);
  const [meta, setMeta] = React.useState<ApiResponse['meta']>();
  const [regions, setRegions] = React.useState<Region[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [suspending, setSuspending] = React.useState<User | null>(null);
  const [reason, setReason] = React.useState('');
  const [creating, setCreating] = React.useState(false);
  const [newUser, setNewUser] = React.useState({ fullName: '', phone: '', email: '', role: 'farmer', regionId: '', community: '' });
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    api.get<Region[]>('/reference/regions').then((r) => setRegions(r.data)).catch(() => {});
  }, []);

  const [exporting, setExporting] = React.useState(false);

  /** Downloads the accounts the current filters match — for reporting and reconciliation. */
  const exportCsv = async () => {
    setExporting(true);
    try {
      const count = await exportTable<User>({
        endpoint: '/admin/users',
        params: {
          role: role || undefined, status: status || undefined, channel: channel || undefined,
          regionId: regionId || undefined, search: query || undefined,
        },
        filename: csvFilename('users'),
        columns: [
          { header: 'Name', value: (u) => u.fullName },
          { header: 'Phone', value: (u) => u.phone },
          { header: 'Email', value: (u) => u.email ?? '' },
          { header: 'Role', value: (u) => u.role },
          { header: 'Status', value: (u) => u.status },
          { header: 'Region', value: (u) => u.region?.name ?? '' },
          { header: 'Community', value: (u) => u.community ?? '' },
          { header: 'Registered via', value: (u) => u.registrationChannel },
          { header: 'Verified seller', value: (u) => (u.isVerifiedSeller ? 'yes' : 'no') },
          { header: 'Wallet (GHS)', value: (u) => Number(u.walletBalance ?? 0) },
          { header: 'Rating', value: (u) => Number(u.ratingAvg ?? 0) },
          { header: 'Joined', value: (u) => u.createdAt.slice(0, 10) },
        ],
      });
      toast.success(`${count.toLocaleString()} accounts exported`);
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
      const res = await api.get<User[]>('/admin/users', {
        role: role || undefined, status: status || undefined, channel: channel || undefined,
        regionId: regionId || undefined, search: query || undefined, page, limit: 20,
      });
      setUsers(res.data);
      setMeta(res.meta);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [role, status, channel, regionId, query, page]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const patch = async (user: User, body: Record<string, unknown>, message: string) => {
    setBusy(true);
    try {
      await api.patch(`/admin/users/${user.id}`, body);
      toast.success(message);
      setSuspending(null);
      setReason('');
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const createUser = async () => {
    if (newUser.fullName.trim().length < 3) return toast.error('Enter a full name');
    if (!newUser.phone.trim()) return toast.error('Enter a phone number');
    setBusy(true);
    try {
      const res = await api.post<{ user: User; temporaryPassword?: string }>('/admin/users', {
        ...newUser, regionId: newUser.regionId ? Number(newUser.regionId) : undefined, email: newUser.email || undefined,
      });
      toast.success(`Account created for ${res.data.user.fullName}`, {
        description: res.data.temporaryPassword ? `Temporary password ${res.data.temporaryPassword} was sent by SMS.` : undefined,
        duration: 10000,
      });
      setCreating(false);
      setNewUser({ fullName: '', phone: '', email: '', role: 'farmer', regionId: '', community: '' });
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const reset = (fn: () => void) => { fn(); setPage(1); };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Farmers, buyers and field agents across every channel."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" loading={exporting} onClick={exportCsv}><Download /> Export CSV</Button>
            <Button variant="gradient" onClick={() => setCreating(true)}><UserPlus /> Register a user</Button>
          </div>
        }
      />

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-xl bg-muted p-1">
            {([['', 'All'], ['farmer', 'Farmers'], ['buyer', 'Buyers'], ['agent', 'Agents']] as const).map(([value, label]) => (
              <button key={label} onClick={() => reset(() => setRole(value))} className={cn('rounded-lg px-3.5 py-1.5 text-sm font-medium', role === value ? 'bg-background shadow-soft' : 'text-muted-foreground hover:text-foreground')}>
                {label}
              </button>
            ))}
          </div>
          <Select value={status || ALL} onValueChange={(v) => reset(() => setStatus(v === ALL ? '' : v))}>
            <SelectTrigger className="h-10 w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Any status</SelectItem>
              {Object.entries(USER_STATUS).map(([v, m]) => <SelectItem key={v} value={v}>{m.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={channel || ALL} onValueChange={(v) => reset(() => setChannel(v === ALL ? '' : v))}>
            <SelectTrigger className="h-10 w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Any channel</SelectItem>
              {(['ussd', 'web', 'sms', 'agent'] as const).map((c) => <SelectItem key={c} value={c}>{CHANNEL_META[c].label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={regionId || ALL} onValueChange={(v) => reset(() => setRegionId(v === ALL ? '' : v))}>
            <SelectTrigger className="h-10 w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All regions</SelectItem>
              {regions.map((r) => <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <form className="ml-auto" onSubmit={(e) => { e.preventDefault(); reset(() => setQuery(search.trim())); }}>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, phone, email, business" icon={<Search />} className="h-10 w-64" />
          </form>
        </div>
      </Card>

      <Card className="overflow-hidden">
        {error ? (
          <ErrorState message={error} onRetry={load} />
        ) : loading ? (
          <TableSkeleton rows={8} cols={6} />
        ) : users.length === 0 ? (
          <EmptyState icon={<Users />} title="No users match these filters" />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr><th>User</th><th>Role</th><th>Location</th><th>Joined via</th><th>Last seen</th><th>Status</th><th className="w-10" /></tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <Link href={`/admin/users/${u.id}`} className="flex items-center gap-3">
                          <Avatar className="h-9 w-9"><AvatarFallback>{initials(u.fullName)}</AvatarFallback></Avatar>
                          <div className="min-w-0">
                            <p className="flex items-center gap-1 font-medium hover:text-primary">
                              {u.fullName} {u.isVerifiedSeller && <BadgeCheck className="h-4 w-4 fill-primary text-white" />}
                            </p>
                            <p className="text-xs text-muted-foreground">{formatPhone(u.phone)}{u.businessName ? ` · ${u.businessName}` : ''}</p>
                          </div>
                        </Link>
                      </td>
                      <td><Badge variant={u.role === 'farmer' ? 'success' : u.role === 'buyer' ? 'info' : 'warning'} size="sm" className="capitalize">{u.role}</Badge></td>
                      <td className="text-sm">
                        <p>{u.region?.name ?? '—'}</p>
                        <p className="text-xs text-muted-foreground">{u.community ?? u.district?.name ?? ''}</p>
                      </td>
                      <td><Badge variant="outline" size="sm">{CHANNEL_META[u.registrationChannel]?.label ?? u.registrationChannel}</Badge></td>
                      <td className="whitespace-nowrap text-xs text-muted-foreground">
                        {u.lastLoginAt || u.lastUssdAt ? timeAgo((u.lastLoginAt ?? '') > (u.lastUssdAt ?? '') ? u.lastLoginAt : u.lastUssdAt) : `joined ${formatDate(u.createdAt)}`}
                      </td>
                      <td><StatusBadge status={u.status} map={USER_STATUS} /></td>
                      <td>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="User actions"><MoreHorizontal /></Button></DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild><Link href={`/admin/users/${u.id}`}><Eye /> View profile</Link></DropdownMenuItem>
                            {u.role !== 'buyer' && (
                              <DropdownMenuItem onClick={() => patch(u, { isVerifiedSeller: !u.isVerifiedSeller }, u.isVerifiedSeller ? 'Verification removed' : 'Seller verified')}>
                                <BadgeCheck /> {u.isVerifiedSeller ? 'Remove verification' : 'Verify seller'}
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            {u.status === 'active' ? (
                              <DropdownMenuItem destructive onClick={() => setSuspending(u)}><Ban /> Suspend</DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => patch(u, { status: 'active', suspendedReason: null }, 'Account reactivated')}><CheckCircle2 /> Reactivate</DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {meta && <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} limit={meta.limit} onPageChange={setPage} />}
          </>
        )}
      </Card>

      <Dialog open={!!suspending} onOpenChange={(o) => !o && setSuspending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspend {suspending?.fullName}?</DialogTitle>
            <DialogDescription>They will be signed out, blocked on USSD and web, and told the reason by SMS.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label required>Reason</Label>
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Repeated failure to honour accepted orders" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspending(null)}>Cancel</Button>
            <Button variant="destructive" loading={busy} disabled={!reason.trim()} onClick={() => suspending && patch(suspending, { status: 'suspended', suspendedReason: reason.trim() }, 'Account suspended')}>
              Suspend account
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Register a user</DialogTitle>
            <DialogDescription>For field registrations. The person receives an SMS with sign-in details and can set a USSD PIN by dialling in.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label required>Full name</Label><Input value={newUser.fullName} onChange={(e) => setNewUser((f) => ({ ...f, fullName: e.target.value }))} /></div>
              <div className="space-y-2"><Label required>Phone</Label><Input value={newUser.phone} onChange={(e) => setNewUser((f) => ({ ...f, phone: e.target.value }))} inputMode="tel" /></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={newUser.role} onValueChange={(v) => setNewUser((f) => ({ ...f, role: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="farmer">Farmer</SelectItem>
                    <SelectItem value="buyer">Buyer</SelectItem>
                    <SelectItem value="agent">Field agent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Email</Label><Input value={newUser.email} onChange={(e) => setNewUser((f) => ({ ...f, email: e.target.value }))} placeholder="Optional" /></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Region</Label>
                <Select value={newUser.regionId} onValueChange={(v) => setNewUser((f) => ({ ...f, regionId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Region" /></SelectTrigger>
                  <SelectContent>{regions.map((r) => <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Community</Label><Input value={newUser.community} onChange={(e) => setNewUser((f) => ({ ...f, community: e.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreating(false)}>Cancel</Button>
            <Button variant="gradient" loading={busy} onClick={createUser}>Create account</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminUsersPage() {
  return (
    <React.Suspense fallback={<TableSkeleton rows={8} cols={6} />}>
      <UsersView />
    </React.Suspense>
  );
}
