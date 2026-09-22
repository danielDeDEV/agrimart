'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import {
  AlertTriangle, ArrowLeft, BadgeCheck, Ban, Banknote, CheckCircle2, MessageSquare, Package, Send, ShoppingCart,
  ShieldCheck, Smartphone, Star, Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn, formatCurrency, formatDate, formatDateTime, formatNumber, formatPhone, initials, titleCase } from '@/lib/utils';
import { CHANNEL_META, LISTING_STATUS, ORDER_STATUS } from '@/lib/constants';
import {
  Avatar, AvatarFallback, Badge, Button, Card, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader,
  DialogTitle, EmptyState, ErrorState, Input, Label, Skeleton, StatCard, StatusBadge, Tabs, TabsContent, TabsList,
  TabsTrigger, Textarea,
} from '@/components/ui';
import type { Listing, Order, Review, SmsMessage, Transaction, User, UssdSession } from '@/lib/types';

interface Detail {
  user: User;
  stats: { listings: number; activeListings: number; orders: number; completedOrders: number; ussdSessions: number; smsReceived: number; revenue: number; spend: number };
  listings: Listing[];
  orders: Order[];
  sessions: UssdSession[];
  messages: SmsMessage[];
  transactions: Transaction[];
  reviews: Review[];
}

export default function AdminUserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user: me } = useAuth();
  const [data, setData] = React.useState<Detail | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [smsOpen, setSmsOpen] = React.useState(false);
  const [smsText, setSmsText] = React.useState('');
  const [suspendOpen, setSuspendOpen] = React.useState(false);
  const [reason, setReason] = React.useState('');
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  // Typing the name back is the last check before something irreversible
  const [confirmName, setConfirmName] = React.useState('');

  const load = React.useCallback(() => {
    api.get<Detail>(`/admin/users/${id}`).then((r) => { setData(r.data); setError(null); }).catch((err) => setError(errorMessage(err)));
  }, [id]);

  React.useEffect(() => load(), [load]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!data) return <div className="space-y-4"><Skeleton className="h-40" /><Skeleton className="h-24" /><Skeleton className="h-80" /></div>;

  const { user, stats } = data;
  const isStaff = user.role === 'admin' || user.role === 'superadmin';
  // Administrator accounts are managed on the Admin team page, not here
  const isAdmin = me?.role === 'admin' || me?.role === 'superadmin';
  const canDelete = isAdmin && !isStaff && user.id !== me?.id;

  const patch = async (body: Record<string, unknown>, message: string) => {
    setBusy(true);
    try {
      await api.patch(`/admin/users/${user.id}`, body);
      toast.success(message);
      setSuspendOpen(false);
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  /**
   * Removing an account is permanent, so it asks for the name to be typed back.
   * Suspending is the reversible option and is what most cases call for.
   */
  const removeAccount = async () => {
    setBusy(true);
    try {
      const res = await api.delete(`/admin/users/${user.id}`);
      toast.success(res.message || 'Account deleted');
      router.push('/admin/users');
    } catch (err) {
      toast.error(errorMessage(err));
      setBusy(false);
    }
  };

  const sendSms = async () => {
    setBusy(true);
    try {
      await api.post('/admin/sms/send', { phone: user.phone, message: smsText });
      toast.success(`SMS sent to ${user.phone}`);
      setSmsOpen(false);
      setSmsText('');
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <Link href="/admin/users" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Users</Link>

      <Card className="flex flex-col gap-6 p-6 lg:flex-row lg:items-center">
        <Avatar className="h-20 w-20"><AvatarFallback className="text-2xl">{initials(user.fullName)}</AvatarFallback></Avatar>
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-2xl font-bold">{user.fullName} {user.isVerifiedSeller && <BadgeCheck className="h-6 w-6 fill-primary text-white" />}</h1>
          <p className="text-muted-foreground">{formatPhone(user.phone)}{user.email ? ` · ${user.email}` : ''}{user.businessName ? ` · ${user.businessName}` : ''}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Badge variant="success" className="capitalize">{user.role}</Badge>
            <StatusBadge status={user.status} map={{ active: { label: 'Active', color: 'green' }, suspended: { label: 'Suspended', color: 'red' }, pending: { label: 'Pending', color: 'amber' }, banned: { label: 'Banned', color: 'slate' } }} />
            <Badge variant="outline">Joined via {CHANNEL_META[user.registrationChannel]?.label} · {formatDate(user.createdAt)}</Badge>
            <Badge variant="outline">{[user.community, user.district?.name, user.region?.name].filter(Boolean).join(', ') || 'No location'}</Badge>
            <Badge variant="outline">Language: {user.language}</Badge>
            <Badge variant="outline"><Star className="fill-gold-400 text-gold-400" /> {Number(user.ratingAvg).toFixed(1)} ({user.ratingCount})</Badge>
          </div>
          {user.status === 'suspended' && (user as User & { suspendedReason?: string }).suspendedReason && (
            <p className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">Suspended: {(user as User & { suspendedReason?: string }).suspendedReason}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setSmsOpen(true)}><Send /> Send SMS</Button>
          {user.role !== 'buyer' && (
            <Button variant="outline" loading={busy} onClick={() => patch({ isVerifiedSeller: !user.isVerifiedSeller }, user.isVerifiedSeller ? 'Verification removed' : 'Seller verified')}>
              <BadgeCheck /> {user.isVerifiedSeller ? 'Unverify' : 'Verify seller'}
            </Button>
          )}
          {user.status === 'active' ? (
            <Button variant="destructive" onClick={() => setSuspendOpen(true)}><Ban /> Suspend</Button>
          ) : (
            <Button variant="gradient" loading={busy} onClick={() => patch({ status: 'active', suspendedReason: null }, 'Account reactivated')}><CheckCircle2 /> Reactivate</Button>
          )}
          {canDelete && (
            <Button variant="outline" className="text-destructive hover:bg-destructive/10" onClick={() => { setConfirmName(''); setDeleteOpen(true); }}>
              <Trash2 /> Delete account
            </Button>
          )}
          {isStaff && (
            <Button variant="outline" asChild>
              <Link href="/admin/team"><ShieldCheck /> Manage on Admin team</Link>
            </Button>
          )}
        </div>
      </Card>

      {isStaff && (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-dashed p-4 text-sm">
          <p className="text-muted-foreground">
            This is an administrator account. Roles, passwords, suspension and removal are handled on the
            Admin team page, where the rules that protect the super administrator apply.
          </p>
          <Button size="sm" variant="outline" asChild><Link href="/admin/team">Open Admin team</Link></Button>
        </Card>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Sales earned" value={formatCurrency(stats.revenue, { compact: true, decimals: 0 })} icon={<Banknote />} hint={`wallet ${formatCurrency(user.walletBalance, { decimals: 0 })}`} />
        <StatCard label="Listings" value={formatNumber(stats.listings)} hint={`${stats.activeListings} live`} icon={<Package />} accent="gold" />
        <StatCard label="Orders" value={formatNumber(stats.orders)} hint={`${stats.completedOrders} completed · spent ${formatCurrency(stats.spend, { compact: true, decimals: 0 })}`} icon={<ShoppingCart />} accent="blue" />
        <StatCard label="USSD sessions" value={formatNumber(stats.ussdSessions)} hint={`${formatNumber(stats.smsReceived)} SMS received`} icon={<Smartphone />} accent="cyan" />
      </div>

      <Tabs defaultValue="orders">
        <TabsList className="flex-wrap">
          <TabsTrigger value="orders">Orders</TabsTrigger>
          <TabsTrigger value="listings">Listings</TabsTrigger>
          <TabsTrigger value="ussd">USSD sessions</TabsTrigger>
          <TabsTrigger value="sms">SMS</TabsTrigger>
          <TabsTrigger value="money">Transactions</TabsTrigger>
          <TabsTrigger value="reviews">Reviews</TabsTrigger>
        </TabsList>

        <TabsContent value="orders">
          <Card className="overflow-hidden">
            {data.orders.length === 0 ? <EmptyState title="No orders" /> : (
              <div className="overflow-x-auto"><table className="data-table">
                <thead><tr><th>Order</th><th>Side</th><th className="text-right">Total</th><th>Status</th><th>Date</th></tr></thead>
                <tbody>{data.orders.map((o) => (
                  <tr key={o.id}>
                    <td><p className="font-medium">{o.listing?.produce?.name}</p><p className="font-mono text-xs text-muted-foreground">{o.code}</p></td>
                    <td><Badge variant={o.farmerId === user.id ? 'success' : 'info'} size="sm">{o.farmerId === user.id ? 'Selling' : 'Buying'}</Badge></td>
                    <td className="text-right tabular-nums">{formatCurrency(o.totalAmount, { decimals: 0 })}</td>
                    <td><StatusBadge status={o.status} map={ORDER_STATUS} /></td>
                    <td className="text-muted-foreground">{formatDate(o.createdAt)}</td>
                  </tr>
                ))}</tbody>
              </table></div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="listings">
          <Card className="overflow-hidden">
            {data.listings.length === 0 ? <EmptyState title="No listings" /> : (
              <div className="overflow-x-auto"><table className="data-table">
                <thead><tr><th>Listing</th><th className="text-right">Price</th><th className="text-right">Stock</th><th>Source</th><th>Status</th></tr></thead>
                <tbody>{data.listings.map((l) => (
                  <tr key={l.id}>
                    <td><Link href={`/marketplace/${l.code}`} target="_blank" className="font-medium hover:text-primary">{l.produce?.name}</Link><p className="font-mono text-xs text-muted-foreground">{l.code}</p></td>
                    <td className="text-right tabular-nums">{formatCurrency(l.pricePerUnit, { decimals: 0 })}/{l.unit}</td>
                    <td className="text-right tabular-nums">{formatNumber(l.quantityRemaining)} / {formatNumber(l.quantity)}</td>
                    <td><Badge variant="outline" size="sm">{CHANNEL_META[l.source]?.label}</Badge></td>
                    <td><StatusBadge status={l.status} map={LISTING_STATUS} /></td>
                  </tr>
                ))}</tbody>
              </table></div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="ussd">
          <Card className="overflow-hidden">
            {data.sessions.length === 0 ? <EmptyState title="No USSD sessions" /> : (
              <div className="overflow-x-auto"><table className="data-table">
                <thead><tr><th>Session</th><th>Outcome</th><th className="text-right">Steps</th><th className="text-right">Duration</th><th>Status</th><th>When</th></tr></thead>
                <tbody>{data.sessions.map((s) => (
                  <tr key={s.id}>
                    <td className="font-mono text-xs">{s.sessionId.slice(0, 22)}</td>
                    <td>{s.outcome ? titleCase(s.outcome) : '—'}</td>
                    <td className="text-right tabular-nums">{s.stepCount}</td>
                    <td className="text-right tabular-nums">{s.durationSeconds}s</td>
                    <td><Badge variant={s.status === 'completed' ? 'success' : 'secondary'} size="sm" className="capitalize">{s.status}</Badge></td>
                    <td className="whitespace-nowrap text-muted-foreground">{formatDateTime(s.createdAt)}</td>
                  </tr>
                ))}</tbody>
              </table></div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="sms">
          <Card className="divide-y">
            {data.messages.length === 0 ? <EmptyState icon={<MessageSquare />} title="No SMS" /> : data.messages.map((m) => (
              <div key={m.id} className="px-5 py-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>{titleCase(m.type)} · {m.direction}</span>
                  <span className={cn(m.status === 'failed' && 'text-destructive')}>{m.status} · {formatDateTime(m.createdAt)}</span>
                </div>
                <p className="mt-1.5 font-mono text-[13px]">{m.message}</p>
              </div>
            ))}
          </Card>
        </TabsContent>

        <TabsContent value="money">
          <Card className="overflow-hidden">
            {data.transactions.length === 0 ? <EmptyState title="No transactions" /> : (
              <div className="overflow-x-auto"><table className="data-table">
                <thead><tr><th>Reference</th><th>Type</th><th className="text-right">Amount</th><th>Status</th><th>Date</th></tr></thead>
                <tbody>{data.transactions.map((t) => (
                  <tr key={t.id}>
                    <td className="font-mono text-xs">{t.reference}</td>
                    <td>{titleCase(t.type)}</td>
                    <td className="text-right tabular-nums">{t.direction === 'credit' ? '+' : '−'} {formatCurrency(t.amount)}</td>
                    <td className="capitalize">{t.status}</td>
                    <td className="text-muted-foreground">{formatDateTime(t.createdAt)}</td>
                  </tr>
                ))}</tbody>
              </table></div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="reviews">
          <Card className="divide-y">
            {data.reviews.length === 0 ? <EmptyState icon={<Star />} title="No reviews yet" /> : data.reviews.map((r) => (
              <div key={r.id} className="px-5 py-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{r.reviewer?.fullName}</p>
                  <span className="flex">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className={cn('h-4 w-4', i < r.rating ? 'fill-gold-400 text-gold-400' : 'text-muted-foreground/30')} />)}</span>
                </div>
                {r.comment && <p className="mt-1 text-sm text-muted-foreground">{r.comment}</p>}
              </div>
            ))}
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={smsOpen} onOpenChange={setSmsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>SMS {user.fullName}</DialogTitle>
            <DialogDescription>Sent from the AgriMart sender ID to {user.phone}. Logged in the SMS centre and audit log.</DialogDescription>
          </DialogHeader>
          <Textarea rows={4} maxLength={640} value={smsText} onChange={(e) => setSmsText(e.target.value)} placeholder="AgriMart: …" />
          <p className="text-right text-xs text-muted-foreground">{smsText.length} characters · {Math.max(1, Math.ceil(smsText.length / 153))} SMS segment(s)</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSmsOpen(false)}>Cancel</Button>
            <Button variant="gradient" loading={busy} disabled={smsText.trim().length < 2} onClick={sendSms}><Send /> Send</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={(open) => !open && setDeleteOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {user.fullName}&apos;s account?</DialogTitle>
            <DialogDescription>This cannot be undone. Suspending is reversible — use that unless the account must go.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <ul className="space-y-1.5 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <li className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" /> They can no longer sign in or dial the USSD service.</li>
              {stats.activeListings > 0 && (
                <li className="flex gap-2"><Package className="mt-0.5 h-4 w-4 shrink-0 text-destructive" /> {stats.activeListings} live listing{stats.activeListings > 1 ? 's are' : ' is'} withdrawn from the marketplace.</li>
              )}
              <li className="flex gap-2"><ShoppingCart className="mt-0.5 h-4 w-4 shrink-0 text-destructive" /> Completed orders stay in the records for accounting; open orders must be settled first.</li>
            </ul>

            <div className="space-y-2">
              <Label required>Type <span className="font-semibold text-foreground">{user.fullName}</span> to confirm</Label>
              <Input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} placeholder={user.fullName} autoComplete="off" />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)}>Keep the account</Button>
            <Button
              variant="destructive"
              loading={busy}
              disabled={confirmName.trim().toLowerCase() !== user.fullName.trim().toLowerCase()}
              onClick={removeAccount}
            >
              <Trash2 /> Delete permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={suspendOpen} onOpenChange={setSuspendOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Suspend {user.fullName}?</DialogTitle>
            <DialogDescription>They will be blocked on every channel and informed by SMS.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2"><Label required>Reason</Label><Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} /></div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSuspendOpen(false)}>Cancel</Button>
            <Button variant="destructive" loading={busy} disabled={!reason.trim()} onClick={() => patch({ status: 'suspended', suspendedReason: reason.trim() }, 'Account suspended')}>Suspend</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
