'use client';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  AlertTriangle, ArrowLeft, Banknote, CheckCircle2, Circle, MapPin, MessageSquare, Package, Phone, Star, Truck, XCircle,
} from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn, formatCurrency, formatDateTime, formatNumber, initials, titleCase } from '@/lib/utils';
import { ORDER_STATUS } from '@/lib/constants';
import {
  Avatar, AvatarFallback, Button, Card, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader,
  DialogTitle, ErrorState, Label, Skeleton, SmartImage, StatusBadge, Textarea,
} from '@/components/ui';
import type { Order, OrderStatus } from '@/lib/types';
import { OrderPaymentPanel } from '@/components/shared/order-payment-panel';
import { useSettings } from '@/components/settings-provider';

type Action = { status: OrderStatus; label: string; variant?: 'gradient' | 'outline' | 'destructive'; needsReason?: boolean; icon: React.ComponentType };

export default function OrderDetailPage() {
  const { code } = useParams<{ code: string }>();
  const { user } = useAuth();
  const site = useSettings();
  const [order, setOrder] = React.useState<Order | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState<Action | null>(null);
  const [reason, setReason] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [reviewOpen, setReviewOpen] = React.useState(false);
  const [rating, setRating] = React.useState(5);
  const [comment, setComment] = React.useState('');

  const load = React.useCallback(() => {
    api
      .get<Order>(`/orders/${code}`)
      .then((res) => { setOrder(res.data); setError(null); })
      .catch((err) => setError(errorMessage(err)));
  }, [code]);

  React.useEffect(() => load(), [load]);

  if (error) return <ErrorState message={error} onRetry={load} />;
  if (!order || !user) return <div className="space-y-4"><Skeleton className="h-10 w-1/3" /><Skeleton className="h-64" /><Skeleton className="h-48" /></div>;

  const isFarmer = order.farmerId === user.id;
  const other = isFarmer ? order.buyer : order.farmer;
  const alreadyRated = isFarmer ? order.farmerRated : order.buyerRated;

  const actions: Action[] = [];
  if (isFarmer && order.status === 'pending') {
    actions.push({ status: 'accepted', label: 'Accept order', variant: 'gradient', icon: CheckCircle2 });
    actions.push({ status: 'rejected', label: 'Decline', variant: 'outline', needsReason: true, icon: XCircle });
  }
  if (!isFarmer && order.status === 'pending') actions.push({ status: 'cancelled', label: 'Cancel order', variant: 'outline', needsReason: true, icon: XCircle });
  if (['accepted', 'paid'].includes(order.status) && isFarmer) actions.push({ status: 'in_transit', label: 'Mark in transit', variant: 'outline', icon: Truck });
  if (['accepted', 'paid', 'in_transit'].includes(order.status)) actions.push({ status: 'delivered', label: 'Mark delivered', variant: 'gradient', icon: Package });
  if (order.status === 'delivered' && !isFarmer) actions.push({ status: 'completed', label: 'Confirm receipt & complete', variant: 'gradient', icon: CheckCircle2 });

  const run = async (action: Action) => {
    if (action.needsReason && !reason.trim()) return toast.error('Please give a short reason');
    setBusy(true);
    try {
      const res = await api.patch<Order>(`/orders/${order.id}/status`, { status: action.status, reason: reason || undefined });
      setOrder(res.data);
      toast.success(res.message);
      setPending(null);
      setReason('');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const submitReview = async () => {
    setBusy(true);
    try {
      await api.post(`/orders/${order.id}/review`, { rating, comment: comment || undefined });
      toast.success('Thank you for your review');
      setReviewOpen(false);
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const timeline = order.timeline ?? [];

  return (
    <div className="space-y-6">
      <Link href="/dashboard/orders" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All orders
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="font-mono text-sm text-muted-foreground">{order.code}</p>
          <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
            {formatNumber(order.quantity)} {order.unit} of {order.listing?.produce?.name}
          </h1>
          <div className="mt-2 flex items-center gap-2">
            <StatusBadge status={order.status} map={ORDER_STATUS} />
            <span className="text-sm text-muted-foreground">{ORDER_STATUS[order.status]?.description}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => (
            <Button
              key={action.status}
              variant={action.variant}
              onClick={() => (action.needsReason ? setPending(action) : run(action))}
              loading={busy && pending === null}
            >
              <action.icon /> {action.label}
            </Button>
          ))}
          {order.status === 'completed' && !alreadyRated && (
            <Button variant="gold" onClick={() => setReviewOpen(true)}><Star /> Rate {isFarmer ? 'buyer' : 'farmer'}</Button>
          )}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Card className="overflow-hidden">
            <div className="flex items-center gap-4 border-b p-5">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl">
                <SmartImage sizes="64px" src={order.listing?.produce?.imageUrl} alt={order.listing?.produce?.name ?? 'Produce'} />
              </div>
              <div className="min-w-0">
                <Link href={`/marketplace/${order.listing?.code}`} className="font-semibold hover:text-primary">{order.listing?.produce?.name}</Link>
                <p className="text-sm text-muted-foreground">Listing {order.listing?.code}</p>
              </div>
            </div>
            <dl className="divide-y text-sm">
              {[
                ['Unit price', `${formatCurrency(order.unitPrice)} per ${order.unit}`],
                ['Quantity', `${formatNumber(order.quantity)} ${order.unit}`],
                ['Subtotal', formatCurrency(order.subtotal)],
                ['Delivery fee', formatCurrency(order.deliveryFee)],
                ...(isFarmer ? [[`Platform commission (${(site.commissionRate * 100).toFixed(0)}%)`, `− ${formatCurrency(order.commission)}`], ['You receive', formatCurrency(order.farmerPayout)]] : []),
              ].map(([label, value]) => (
                <div key={label} className="flex justify-between px-5 py-3">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className="font-medium tabular-nums">{value}</dd>
                </div>
              ))}
              <div className="flex justify-between bg-muted/40 px-5 py-4">
                <dt className="font-semibold">Order total</dt>
                <dd className="font-display text-xl font-extrabold tabular-nums">{formatCurrency(order.totalAmount)}</dd>
              </div>
            </dl>
          </Card>

          <OrderPaymentPanel order={order} isFarmer={isFarmer} onUpdated={setOrder} />

          <Card className="p-5">
            <h2 className="font-semibold">Timeline</h2>
            <ol className="mt-5 space-y-5">
              {timeline.map((entry, i) => {
                const last = i === timeline.length - 1;
                return (
                  <li key={`${entry.status}-${entry.at}`} className="relative flex gap-4">
                    {!last && <span className="absolute left-[11px] top-7 h-[calc(100%-4px)] w-px bg-border" />}
                    {last ? (
                      <CheckCircle2 className="relative h-6 w-6 shrink-0 text-primary" />
                    ) : (
                      <Circle className="relative h-6 w-6 shrink-0 fill-muted text-border" />
                    )}
                    <div>
                      <p className="font-medium">{ORDER_STATUS[entry.status as OrderStatus]?.label ?? titleCase(entry.status)}</p>
                      {entry.note && <p className="text-sm text-muted-foreground">{entry.note}</p>}
                      <p className="mt-0.5 text-xs text-muted-foreground">{formatDateTime(entry.at)} · by {entry.actor}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{isFarmer ? 'Buyer' : 'Farmer'}</p>
            <div className="mt-3 flex items-center gap-3">
              <Avatar className="h-12 w-12"><AvatarFallback>{initials(other?.fullName)}</AvatarFallback></Avatar>
              <div className="min-w-0">
                <p className="truncate font-semibold">{other?.businessName || other?.fullName}</p>
                {other?.businessName && <p className="truncate text-sm text-muted-foreground">{other.fullName}</p>}
                <p className="flex items-center gap-1 text-sm"><Star className="h-3.5 w-3.5 fill-gold-400 text-gold-400" /> {Number(other?.ratingAvg ?? 0).toFixed(1)}</p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button variant="subtle" asChild><a href={`tel:${other?.phone}`}><Phone /> Call</a></Button>
              <Button variant="outline" asChild><Link href="/dashboard/messages"><MessageSquare /> Message</Link></Button>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="font-semibold">Payment &amp; delivery</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Payment method</dt><dd className="font-medium">{({ momo: 'Mobile money', cash: 'Cash', bank: 'Bank transfer', wallet: 'Wallet' } as const)[order.paymentMethod]}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Payment status</dt><dd className="font-medium capitalize">{order.paymentStatus}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Delivery</dt><dd className="font-medium capitalize">{order.deliveryMethod}</dd></div>
              {order.deliveryAddress && <div className="flex gap-2 rounded-lg bg-muted/60 p-3"><MapPin className="h-4 w-4 shrink-0 text-primary" /> {order.deliveryAddress}</div>}
              {order.notes && <div className="rounded-lg bg-muted/60 p-3 text-muted-foreground">“{order.notes}”</div>}
            </dl>
          </Card>
        </div>
      </div>

      <Dialog open={!!pending} onOpenChange={(open) => !open && setPending(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{pending?.label}</DialogTitle>
            <DialogDescription>The other party will receive this reason by SMS.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label required>Reason</Label>
            <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Stock already sold at the market" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPending(null)}>Back</Button>
            <Button variant={pending?.status === 'accepted' ? 'gradient' : 'destructive'} loading={busy} onClick={() => pending && run(pending)}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reviewOpen} onOpenChange={setReviewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rate this {isFarmer ? 'buyer' : 'farmer'}</DialogTitle>
            <DialogDescription>Honest ratings help everyone on the marketplace trade with confidence.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-center gap-2 py-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setRating(n)} aria-label={`${n} stars`} className="transition-transform hover:scale-110">
                <Star className={cn('h-9 w-9', n <= rating ? 'fill-gold-400 text-gold-400' : 'text-muted-foreground/40')} />
              </button>
            ))}
          </div>
          <Textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="What went well? What could be better?" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewOpen(false)}>Later</Button>
            <Button variant="gradient" loading={busy} onClick={submitReview}>Submit review</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
