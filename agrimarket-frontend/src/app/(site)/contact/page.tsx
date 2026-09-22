'use client';

import * as React from 'react';
import { CheckCircle2, Clock, Mail, MapPin, MessageSquare, Phone, Send, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { HAS_SMS_SHORTCODE, SITE, SUPPORT_CATEGORIES } from '@/lib/constants';
import { formatPhone, telHref } from '@/lib/settings';
import { useSettings } from '@/components/settings-provider';
import {
  Badge, Button, Card, Input, Label, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Textarea,
} from '@/components/ui';

export default function ContactPage() {
  const site = useSettings();
  const { user } = useAuth();
  const [form, setForm] = React.useState({ name: '', phone: '', email: '', category: 'other', subject: '', message: '' });
  const [sending, setSending] = React.useState(false);
  const [reference, setReference] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (user) {
      setForm((f) => ({ ...f, name: f.name || user.fullName, phone: f.phone || user.phone, email: f.email || user.email || '' }));
    }
  }, [user]);

  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.subject.trim().length < 3) return toast.error('Give your message a subject');
    if (form.message.trim().length < 10) return toast.error('Tell us a little more so we can help');

    setSending(true);
    try {
      const res = await api.post<{ code: string }>('/support', form);
      setReference(res.data.code);
      toast.success(res.message);
      setForm((f) => ({ ...f, subject: '', message: '' }));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <section className="relative overflow-hidden border-b">
        <div className="absolute inset-0 mesh-bg" />
        <div className="container-wide relative py-14 lg:py-20">
          <Badge variant="success" className="mb-4">We reply within 24 hours</Badge>
          <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">Contact &amp; support</h1>
          <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
            A question about an order, a problem with the USSD menu, or a partnership idea — reach us on
            whichever channel suits you.
          </p>
        </div>
      </section>

      <section className="container-wide grid gap-10 py-14 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-4">
          {[
            { icon: Phone, title: 'Call the support line', value: formatPhone(site.supportPhone), hint: 'Monday to Saturday, 7am – 7pm', href: telHref(site.supportPhone) },
            { icon: Smartphone, title: 'USSD help menu', value: site.ussdCode, hint: 'Choose 7 for Help & Support' },
            ...(site.smsShortCode
              ? [{ icon: MessageSquare, title: 'SMS', value: `Text HELP to ${site.smsShortCode}`, hint: 'Replies within minutes' }]
              : []),
            { icon: Mail, title: 'Email', value: site.supportEmail, hint: 'For partnerships and detailed issues', href: `mailto:${site.supportEmail}` },
            { icon: MapPin, title: 'Office', value: site.address, hint: 'Visits by appointment' },
          ].map((item) => {
            const content = (
              <Card hover className="flex items-start gap-4 p-5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700 dark:bg-primary-950/60 dark:text-primary-300">
                  <item.icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{item.title}</p>
                  <p className="mt-0.5 break-words font-semibold">{item.value}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" /> {item.hint}</p>
                </div>
              </Card>
            );
            return item.href ? <a key={item.title} href={item.href} className="block">{content}</a> : <div key={item.title}>{content}</div>;
          })}
        </div>

        <Card id="report" className="p-6 sm:p-8">
          {reference ? (
            <div className="flex flex-col items-center py-10 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-100 text-primary-700 dark:bg-primary-950">
                <CheckCircle2 className="h-8 w-8" />
              </span>
              <h2 className="mt-5 text-2xl font-bold">Message received</h2>
              <p className="mt-2 max-w-sm text-muted-foreground">
                Your reference is <code className="rounded bg-muted px-1.5 py-0.5 font-mono font-bold text-foreground">{reference}</code>.
                We have sent it to your phone by SMS as well.
              </p>
              <Button variant="outline" className="mt-6" onClick={() => setReference(null)}>Send another message</Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-5">
              <div>
                <h2 className="text-xl font-bold">Send us a message</h2>
                <p className="mt-1 text-sm text-muted-foreground">Every message gets a reference number you can quote.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Your name</Label>
                  <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Kwame Mensah" />
                </div>
                <div className="space-y-2">
                  <Label>Phone number</Label>
                  <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="0244 123 456" inputMode="tel" />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="Optional" />
                </div>
                <div className="space-y-2">
                  <Label>Topic</Label>
                  <Select value={form.category} onValueChange={(v) => set('category', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SUPPORT_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label required>Subject</Label>
                <Input value={form.subject} onChange={(e) => set('subject', e.target.value)} placeholder="e.g. My listing is not showing" />
              </div>
              <div className="space-y-2">
                <Label required>Message</Label>
                <Textarea rows={6} value={form.message} onChange={(e) => set('message', e.target.value)} placeholder="Include any order or listing code (ORD-… or LST-…) so we can find it quickly." />
              </div>
              <Button type="submit" size="lg" variant="gradient" className="w-full" loading={sending}>
                {!sending && <Send />} Send message
              </Button>
            </form>
          )}
        </Card>
      </section>
    </>
  );
}
