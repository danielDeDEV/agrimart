'use client';

import * as React from 'react';
import { AlertTriangle, BadgeCheck, Banknote, ImagePlus, Info, Phone, ShieldAlert, X } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { useSettings } from '@/components/settings-provider';
import { acceptPhotos } from '@/lib/images';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { formatPhone, telHref } from '@/lib/settings';
import {
  Badge, Button, Card, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader,
  DialogTitle, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea,
} from '@/components/ui';
import type { Order } from '@/lib/types';

const MAX_FILES = 4;

const METHODS = [
  { value: 'momo', label: 'Mobile money' },
  { value: 'cash', label: 'Cash' },
  { value: 'bank', label: 'Bank transfer' },
];

const PROBLEMS = [
  { value: 'payment', label: 'Payment problem' },
  { value: 'order', label: 'Goods or delivery problem' },
];

/** Thumbnails of the screenshots attached to a payment or a report. */
function Evidence({ images, label }: { images: string[]; label: string }) {
  if (!images?.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {images.map((src, i) => (
        <a
          key={src}
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="relative h-20 w-20 overflow-hidden rounded-lg border transition hover:ring-2 hover:ring-primary/40"
          title={`${label} ${i + 1} — open full size`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={`${label} ${i + 1}`} className="h-full w-full object-cover" />
        </a>
      ))}
    </div>
  );
}

/** A small file picker shared by both dialogs. */
function AttachmentPicker({
  files,
  setFiles,
  hint,
}: {
  files: File[];
  setFiles: React.Dispatch<React.SetStateAction<File[]>>;
  hint: string;
}) {
  const [previews, setPreviews] = React.useState<string[]>([]);

  React.useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  const add = (list: FileList | null) => {
    const { accepted, rejected } = acceptPhotos(list);
    if (rejected) toast.error('Screenshots must be JPG, PNG or WEBP images under 5MB');
    setFiles((prev) => [...prev, ...accepted].slice(0, MAX_FILES));
  };

  return (
    <div className="space-y-2">
      <Label>Screenshots (up to {MAX_FILES})</Label>
      <div className="grid grid-cols-4 gap-2">
        {previews.map((src, i) => (
          <div key={src} className="group relative aspect-square overflow-hidden rounded-lg border">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt={`Attachment ${i + 1}`} className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
              className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900/75 text-white hover:bg-red-600"
              aria-label={`Remove attachment ${i + 1}`}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        {files.length < MAX_FILES && (
          <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed text-muted-foreground transition-colors hover:border-primary hover:text-primary">
            <ImagePlus className="h-5 w-5" />
            <span className="text-[10px] font-medium">Add</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              className="sr-only"
              onChange={(e) => {
                add(e.target.files);
                e.target.value = '';
              }}
            />
          </label>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

/**
 * Payment and problem reporting for one order.
 *
 * AgriMart does not process payments: the buyer pays the farmer directly by
 * mobile money or cash. This panel makes that plain, lets the buyer record
 * what they paid with evidence, lets the farmer confirm the money arrived, and
 * gives either side a way to send the support desk screenshots when something
 * goes wrong.
 */
export function OrderPaymentPanel({
  order,
  isFarmer,
  onUpdated,
}: {
  order: Order;
  isFarmer: boolean;
  onUpdated: (order: Order) => void;
}) {
  const site = useSettings();
  const [payOpen, setPayOpen] = React.useState(false);
  const [reportOpen, setReportOpen] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const [payment, setPayment] = React.useState({ reference: '', method: order.paymentMethod || 'momo', note: '' });
  const [payFiles, setPayFiles] = React.useState<File[]>([]);
  const [report, setReport] = React.useState({ category: 'order', message: '' });
  const [reportFiles, setReportFiles] = React.useState<File[]>([]);

  const proof = order.paymentProof;
  const other = isFarmer ? order.buyer : order.farmer;
  const open = !['completed', 'cancelled', 'rejected'].includes(order.status);
  const canRecordPayment = !isFarmer && open && order.paymentStatus !== 'paid';
  const canConfirmPayment = isFarmer && open && order.status !== 'pending' && order.paymentStatus !== 'paid';

  const recordPayment = async () => {
    if (!payment.reference.trim() && !payFiles.length) {
      return toast.error('Add the transaction reference or a screenshot');
    }
    const body = new FormData();
    body.append('reference', payment.reference.trim());
    body.append('method', payment.method);
    if (payment.note.trim()) body.append('note', payment.note.trim());
    payFiles.forEach((file) => body.append('attachments', file));

    setBusy(true);
    try {
      const res = await api.upload<Order>(`/orders/${order.id}/payment`, body);
      onUpdated(res.data);
      toast.success(res.message);
      setPayOpen(false);
      setPayFiles([]);
      setPayment({ reference: '', method: order.paymentMethod || 'momo', note: '' });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const confirmPayment = async () => {
    setBusy(true);
    try {
      const res = await api.patch<Order>(`/orders/${order.id}/status`, {
        status: 'paid',
        note: 'Farmer confirmed the payment arrived',
      });
      onUpdated(res.data);
      toast.success('Payment confirmed');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const sendReport = async () => {
    if (report.message.trim().length < 10) return toast.error('Please describe the problem in a sentence or two');
    const body = new FormData();
    body.append('category', report.category);
    body.append('message', report.message.trim());
    reportFiles.forEach((file) => body.append('attachments', file));

    setBusy(true);
    try {
      const res = await api.upload<{ order: Order; ticket: { code: string } }>(`/orders/${order.id}/report`, body);
      onUpdated(res.data.order);
      toast.success(res.message, { duration: 8000 });
      setReportOpen(false);
      setReportFiles([]);
      setReport({ category: 'order', message: '' });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Card className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 font-semibold"><Banknote className="h-4 w-4 text-primary" /> Payment</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {order.paymentStatus === 'paid'
                ? 'The farmer has confirmed this payment.'
                : proof
                  ? 'The buyer recorded a payment. The farmer confirms once the money is in their account.'
                  : 'Not paid yet.'}
            </p>
          </div>
          <Badge variant={order.paymentStatus === 'paid' ? 'success' : proof ? 'warning' : 'outline'}>
            {order.paymentStatus === 'paid' ? 'Confirmed' : proof ? 'Awaiting confirmation' : 'Unpaid'}
          </Badge>
        </div>

        {/* The platform never holds the money — say so before anyone pays */}
        <div className="mt-4 flex gap-2 rounded-xl border border-dashed bg-muted/40 p-3 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p>
            {site.shortName} does not hold or transfer money. Pay the {isFarmer ? 'agreed amount is paid to you' : 'farmer'} directly
            by mobile money or cash, and agree collection first.{' '}
            {other?.phone ? (
              <>
                Speak to {other.fullName?.split(' ')[0]} on{' '}
                <a href={telHref(other.phone)} className="font-semibold text-foreground hover:underline">{formatPhone(other.phone)}</a>{' '}
                before sending anything.
              </>
            ) : (
              'Speak to the other party before sending anything.'
            )}{' '}
            Keep your mobile-money confirmation — if anything goes wrong, it is the evidence we review.
          </p>
        </div>

        {proof && (
          <div className="mt-4 rounded-xl border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="font-semibold">
                {formatCurrency(proof.amount ?? order.totalAmount)} by {METHODS.find((m) => m.value === proof.method)?.label ?? proof.method}
              </span>
              <span className="text-xs text-muted-foreground">{proof.recordedAt ? formatDateTime(proof.recordedAt) : null}</span>
            </div>
            {proof.reference && (
              <p className="mt-1 text-sm">
                Reference <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs">{proof.reference}</code>
              </p>
            )}
            {proof.note && <p className="mt-1 text-sm text-muted-foreground">{proof.note}</p>}
            <Evidence images={proof.images ?? []} label="Payment screenshot" />
            {canConfirmPayment && (
              <p className="mt-3 text-xs text-muted-foreground">
                Check your own mobile-money messages for this reference before confirming.
              </p>
            )}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          {canRecordPayment && (
            <Button variant="gradient" onClick={() => setPayOpen(true)}>
              <Banknote /> {proof ? 'Update payment details' : 'I have paid'}
            </Button>
          )}
          {canConfirmPayment && (
            <Button variant="gradient" loading={busy} onClick={confirmPayment}>
              <BadgeCheck /> Confirm payment received
            </Button>
          )}
          {other?.phone && (
            <Button variant="outline" asChild>
              <a href={telHref(other.phone)}><Phone /> Call {isFarmer ? 'buyer' : 'farmer'}</a>
            </Button>
          )}
          {open && (
            <Button variant="outline" className="text-destructive" onClick={() => setReportOpen(true)}>
              <ShieldAlert /> Report a problem
            </Button>
          )}
        </div>
      </Card>

      {/* ── Record a payment ─────────────────────────────────────────── */}
      <Dialog open={payOpen} onOpenChange={(o) => !o && setPayOpen(false)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Record your payment</DialogTitle>
            <DialogDescription>
              This tells the farmer what to look for. It does not move any money — you pay them directly.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>How you paid</Label>
                <Select value={payment.method} onValueChange={(v) => setPayment((p) => ({ ...p, method: v as Order['paymentMethod'] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Transaction reference</Label>
                <Input
                  value={payment.reference}
                  onChange={(e) => setPayment((p) => ({ ...p, reference: e.target.value }))}
                  placeholder="e.g. MP240919.1423.A12345"
                  className="font-mono"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Note for the farmer</Label>
              <Textarea
                rows={2}
                value={payment.note}
                onChange={(e) => setPayment((p) => ({ ...p, note: e.target.value }))}
                placeholder="e.g. Sent from 0244123456 at 2pm, balance on collection"
              />
            </div>
            <AttachmentPicker
              files={payFiles}
              setFiles={setPayFiles}
              hint="A screenshot of the mobile-money confirmation is the strongest proof."
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>Cancel</Button>
            <Button variant="gradient" loading={busy} onClick={recordPayment}>Send to farmer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Report a problem ─────────────────────────────────────────── */}
      <Dialog open={reportOpen} onOpenChange={(o) => !o && setReportOpen(false)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Report a problem with {order.code}</DialogTitle>
            <DialogDescription>
              This opens a support ticket with your screenshots attached and puts the order on hold while we look into it.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label required>What went wrong?</Label>
              <Select value={report.category} onValueChange={(v) => setReport((r) => ({ ...r, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROBLEMS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label required>Tell us what happened</Label>
              <Textarea
                rows={4}
                value={report.message}
                onChange={(e) => setReport((r) => ({ ...r, message: e.target.value }))}
                placeholder="e.g. I sent GHS 650 by MoMo on Friday and the farmer says nothing arrived. Reference MP240919.1423.A12345."
              />
            </div>
            <AttachmentPicker
              files={reportFiles}
              setFiles={setReportFiles}
              hint="Attach the mobile-money message, a photo of the goods, or anything else that shows the problem."
            />
            <p className="flex gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              Our team sees both sides of the order and contacts you on {formatPhone(site.supportPhone)}.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setReportOpen(false)}>Cancel</Button>
            <Button variant="destructive" loading={busy} onClick={sendReport}>Send report</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
