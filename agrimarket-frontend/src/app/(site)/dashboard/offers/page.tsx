'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeftRight, Check, HandCoins, Undo2, X } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn, formatCurrency, formatNumber, timeAgo } from '@/lib/utils';
import {
  Button, Card, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, EmptyState,
  ErrorState, Input, Label, PageHeader, Skeleton, SmartImage, StatusBadge, Textarea,
} from '@/components/ui';
import type { Offer } from '@/lib/types';

const OFFER_STATUS = {
  pending: { label: 'Awaiting reply', color: 'amber' },
  countered: { label: 'Countered', color: 'blue' },
  accepted: { label: 'Accepted', color: 'green' },
  rejected: { label: 'Declined', color: 'red' },
  withdrawn: { label: 'Withdrawn', color: 'slate' },
  expired: { label: 'Expired', color: 'slate' },
};

export default function OffersPage() {
  const { user } = useAuth();
  const [tab, setTab] = React.useState<'received' | 'sent'>(user?.role === 'buyer' ? 'sent' : 'received');
  const [offers, setOffers] = React.useState<Offer[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [busyId, setBusyId] = React.useState<number | null>(null);
  const [countering, setCountering] = React.useState<Offer | null>(null);
  const [counter, setCounter] = React.useState({ price: '', message: '' });

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<Offer[]>('/offers', { role: tab, limit: 50 });
      setOffers(res.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [tab]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const respond = async (offer: Offer, action: string, extra: Record<string, unknown> = {}) => {
    setBusyId(offer.id);
    try {
      const res = await api.patch(`/offers/${offer.id}`, { action, ...extra });
      toast.success(res.message);
      setCountering(null);
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const acceptCounter = async (offer: Offer) => {
    setBusyId(offer.id);
    try {
      const res = await api.post(`/offers/${offer.id}/accept-counter`);
      toast.success(res.message);
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Offers" description="Negotiate price before committing to an order. Accepted offers become orders automatically." />

      <div className="inline-flex rounded-xl bg-muted p-1">
        {([['received', 'Received on my listings'], ['sent', 'Offers I made']] as const).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={cn('rounded-lg px-4 py-1.5 text-sm font-medium transition-all', tab === value ? 'bg-background shadow-soft' : 'text-muted-foreground hover:text-foreground')}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : loading ? (
        <div className="grid gap-4 lg:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-44" />)}</div>
      ) : offers.length === 0 ? (
        <Card><EmptyState icon={<HandCoins />} title="No offers here yet" description={tab === 'received' ? 'Buyers can make offers on listings marked negotiable.' : 'Make an offer from any negotiable listing in the marketplace.'} /></Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {offers.map((offer) => {
            const asking = Number(offer.listing?.pricePerUnit ?? 0);
            const diff = asking ? ((Number(offer.offerPrice) - asking) / asking) * 100 : 0;
            const open = ['pending', 'countered'].includes(offer.status);
            const counterparty = tab === 'received' ? offer.buyer : offer.farmer;

            return (
              <Card key={offer.id} className="p-5">
                <div className="flex items-start gap-3">
                  <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl">
                    <SmartImage sizes="48px" src={offer.listing?.produce?.imageUrl} alt={offer.listing?.produce?.name ?? 'Produce'} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <Link href={`/marketplace/${offer.listing?.code}`} className="font-semibold hover:text-primary">{offer.listing?.produce?.name}</Link>
                      <StatusBadge status={offer.status} map={OFFER_STATUS} />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {tab === 'received' ? 'From' : 'To'} {counterparty?.businessName || counterparty?.fullName} · {timeAgo(offer.createdAt)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-3 rounded-xl bg-muted/50 p-3 text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Asking</p>
                    <p className="font-semibold tabular-nums">{formatCurrency(asking, { decimals: 0 })}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Offered</p>
                    <p className="font-semibold tabular-nums">{formatCurrency(offer.offerPrice, { decimals: 0 })}</p>
                    <p className="text-xs text-muted-foreground">{diff > 0 ? '+' : ''}{diff.toFixed(0)}%</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Quantity</p>
                    <p className="font-semibold tabular-nums">{formatNumber(offer.quantity)} {offer.unit}</p>
                  </div>
                </div>

                {offer.message && <p className="mt-3 rounded-lg border-l-2 border-primary/40 pl-3 text-sm italic text-muted-foreground">“{offer.message}”</p>}
                {offer.status === 'countered' && offer.counterPrice && (
                  <p className="mt-3 flex items-center gap-2 rounded-lg bg-blue-50 p-3 text-sm text-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
                    <ArrowLeftRight className="h-4 w-4 shrink-0" /> Farmer countered at <strong>{formatCurrency(offer.counterPrice, { decimals: 0 })}</strong> per {offer.unit}
                  </p>
                )}

                {open && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {tab === 'received' && offer.status === 'pending' && (
                      <>
                        <Button size="sm" variant="gradient" loading={busyId === offer.id} onClick={() => respond(offer, 'accept')}><Check /> Accept</Button>
                        <Button size="sm" variant="outline" onClick={() => { setCountering(offer); setCounter({ price: String(asking), message: '' }); }}><ArrowLeftRight /> Counter</Button>
                        <Button size="sm" variant="ghost" onClick={() => respond(offer, 'reject')}><X /> Decline</Button>
                      </>
                    )}
                    {tab === 'sent' && offer.status === 'countered' && (
                      <Button size="sm" variant="gradient" loading={busyId === offer.id} onClick={() => acceptCounter(offer)}><Check /> Accept counter</Button>
                    )}
                    {tab === 'sent' && (
                      <Button size="sm" variant="ghost" onClick={() => respond(offer, 'withdraw')}><Undo2 /> Withdraw</Button>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!countering} onOpenChange={(o) => !o && setCountering(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Counter offer</DialogTitle>
            <DialogDescription>
              The buyer offered {formatCurrency(countering?.offerPrice, { decimals: 0 })} per {countering?.unit}. Propose your price.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label required>Your price per {countering?.unit}</Label>
              <Input type="number" value={counter.price} onChange={(e) => setCounter((c) => ({ ...c, price: e.target.value }))} suffix="GHS" />
            </div>
            <div className="space-y-2">
              <Label>Message</Label>
              <Textarea rows={3} value={counter.message} onChange={(e) => setCounter((c) => ({ ...c, message: e.target.value }))} placeholder="e.g. I can do this price for the full quantity" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCountering(null)}>Cancel</Button>
            <Button
              variant="gradient"
              loading={busyId === countering?.id}
              onClick={() => countering && respond(countering, 'counter', { counterPrice: Number(counter.price), counterMessage: counter.message || undefined })}
            >
              Send counter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
