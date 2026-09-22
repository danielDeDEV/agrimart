'use client';

import * as React from 'react';
import { ImagePlus, LifeBuoy, Paperclip, Phone, Send, X } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { formatDateTime, titleCase } from '@/lib/utils';
import { SUPPORT_CATEGORIES } from '@/lib/constants';
import { acceptPhotos } from '@/lib/images';
import { formatPhone, telHref } from '@/lib/settings';
import { useSettings } from '@/components/settings-provider';
import {
  Button, Card, EmptyState, Input, Label, PageHeader, Select, SelectContent, SelectItem, SelectTrigger,
  SelectValue, Skeleton, StatusBadge, Textarea,
} from '@/components/ui';
import type { SupportTicket } from '@/lib/types';

const TICKET_STATUS = {
  open: { label: 'Open', color: 'amber' },
  in_progress: { label: 'In progress', color: 'blue' },
  resolved: { label: 'Resolved', color: 'green' },
  closed: { label: 'Closed', color: 'slate' },
};

export default function SupportPage() {
  const site = useSettings();
  const [tickets, setTickets] = React.useState<SupportTicket[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [form, setForm] = React.useState({ category: 'order', subject: '', message: '' });
  const [sending, setSending] = React.useState(false);
  // Screenshots often explain a problem faster than a paragraph does
  const [files, setFiles] = React.useState<File[]>([]);
  const [previews, setPreviews] = React.useState<string[]>([]);

  React.useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  const load = React.useCallback(() => {
    api.get<SupportTicket[]>('/support/mine').then((r) => setTickets(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, []);

  React.useEffect(() => load(), [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.subject.trim().length < 3) return toast.error('Add a subject');
    if (form.message.trim().length < 10) return toast.error('Describe the problem in a little more detail');
    setSending(true);
    try {
      const body = new FormData();
      Object.entries(form).forEach(([key, value]) => body.append(key, value));
      files.forEach((file) => body.append('attachments', file));
      const res = await api.upload('/support', body);
      toast.success(res.message);
      setForm({ category: 'order', subject: '', message: '' });
      setFiles([]);
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Support"
        description="Open a ticket and our team replies by SMS and here, usually within a day."
        action={<Button variant="outline" asChild><a href={telHref(site.supportPhone)}><Phone /> {formatPhone(site.supportPhone)}</a></Button>}
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_1.2fr]">
        <Card className="p-6">
          <h2 className="font-semibold">New ticket</h2>
          <form onSubmit={submit} className="mt-5 space-y-4">
            <div className="space-y-2">
              <Label>Topic</Label>
              <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{SUPPORT_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label required>Subject</Label><Input value={form.subject} onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))} placeholder="e.g. Buyer has not collected ORD-…" /></div>
            <div className="space-y-2"><Label required>Details</Label><Textarea rows={6} value={form.message} onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))} /></div>
            <div className="space-y-2">
              <Label>Screenshots (up to 4)</Label>
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
                {files.length < 4 && (
                  <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed text-muted-foreground transition-colors hover:border-primary hover:text-primary">
                    <ImagePlus className="h-5 w-5" />
                    <span className="text-[10px] font-medium">Add</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      className="sr-only"
                      onChange={(e) => {
                        const { accepted, rejected } = acceptPhotos(e.target.files);
                        if (rejected) toast.error('Screenshots must be JPG, PNG or WEBP images under 5MB');
                        setFiles((prev) => [...prev, ...accepted].slice(0, 4));
                        e.target.value = '';
                      }}
                    />
                  </label>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                A mobile-money confirmation or a photo of the goods helps us settle a dispute faster.
              </p>
            </div>
            <Button type="submit" variant="gradient" className="w-full" loading={sending}>{!sending && <Send />} Submit ticket</Button>
          </form>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b px-5 py-4"><h2 className="font-semibold">Your tickets</h2></div>
          {loading ? (
            <div className="space-y-3 p-5">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
          ) : tickets.length === 0 ? (
            <EmptyState icon={<LifeBuoy />} title="No tickets" description="Tickets you open — on the web or via USSD — appear here." />
          ) : (
            <ul className="divide-y">
              {tickets.map((t) => (
                <li key={t.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold">{t.subject}</p>
                      <p className="text-xs text-muted-foreground"><code className="font-mono">{t.code}</code> · {titleCase(t.category)} · via {t.channel} · {formatDateTime(t.createdAt)}</p>
                    </div>
                    <StatusBadge status={t.status} map={TICKET_STATUS} />
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{t.message}</p>
                  {t.order && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      About order <code className="font-mono">{t.order.code}</code>
                    </p>
                  )}
                  {!!t.attachments?.length && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                      {t.attachments.map((src, i) => (
                        <a key={src} href={src} target="_blank" rel="noopener noreferrer" className="relative h-14 w-14 overflow-hidden rounded-lg border hover:ring-2 hover:ring-primary/40">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={src} alt={`Attachment ${i + 1}`} className="h-full w-full object-cover" />
                        </a>
                      ))}
                    </div>
                  )}
                  {t.response && (
                    <div className="mt-3 rounded-xl border-l-4 border-primary bg-primary-50/60 p-3 text-sm dark:bg-primary-950/30">
                      <p className="text-xs font-bold uppercase tracking-wider text-primary-700 dark:text-primary-300">AgriMart support</p>
                      <p className="mt-1">{t.response}</p>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
