'use client';

import * as React from 'react';
import Link from 'next/link';
import { BookOpen, ExternalLink, Megaphone, Pencil, PlusCircle, Star, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { cn, formatDate, formatNumber } from '@/lib/utils';
import { TIP_CATEGORIES } from '@/lib/constants';
import {
  Badge, Button, Card, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, EmptyState,
  Input, Label, PageHeader, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch, TableSkeleton, Textarea,
} from '@/components/ui';
import type { FarmingTip } from '@/lib/types';

const blank = { title: '', excerpt: '', content: '', smsVersion: '', category: 'planting', readMinutes: '3', author: 'AgriMart Extension Desk', isPublished: true, isFeatured: false };
type Form = typeof blank;

export default function AdminTipsPage() {
  const [tips, setTips] = React.useState<FarmingTip[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [editor, setEditor] = React.useState<{ id?: number; form: Form } | null>(null);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(() => {
    setLoading(true);
    api.get<FarmingTip[]>('/admin/tips', { limit: 100 }).then((r) => setTips(r.data)).catch((err) => toast.error(errorMessage(err))).finally(() => setLoading(false));
  }, []);

  React.useEffect(() => load(), [load]);

  const edit = async (tip: FarmingTip) => {
    try {
      const res = await api.get<FarmingTip>(`/admin/tips/${tip.id}`);
      const t = res.data;
      setEditor({ id: t.id, form: { title: t.title, excerpt: t.excerpt ?? '', content: t.content, smsVersion: t.smsVersion ?? '', category: t.category, readMinutes: String(t.readMinutes), author: t.author, isPublished: t.isPublished, isFeatured: t.isFeatured } });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setEditor((e) => (e ? { ...e, form: { ...e.form, [key]: value } } : e));

  const save = async () => {
    if (!editor) return;
    const f = editor.form;
    if (f.title.trim().length < 5) return toast.error('Write a title');
    if (f.content.trim().length < 50) return toast.error('The article is too short');
    setBusy(true);
    try {
      const body = { ...f, readMinutes: Number(f.readMinutes) || 3, smsVersion: f.smsVersion || null };
      if (editor.id) await api.patch(`/admin/tips/${editor.id}`, body);
      else await api.post('/admin/tips', body);
      toast.success(editor.id ? 'Guide updated' : 'Guide published');
      setEditor(null);
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const broadcast = async (tip: FarmingTip) => {
    if (!tip.smsVersion) return toast.error('Add an SMS version to this guide first');
    if (!window.confirm(`Send "${tip.title}" by SMS to farmers${tip.region ? ` in ${tip.region.name}` : ' nationwide'}?`)) return;
    try {
      const res = await api.post(`/admin/tips/${tip.id}/broadcast`);
      toast.success(res.message);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const remove = async (tip: FarmingTip) => {
    if (!window.confirm(`Delete "${tip.title}"?`)) return;
    try {
      await api.delete(`/admin/tips/${tip.id}`);
      toast.success('Guide deleted');
      load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const smsLength = editor?.form.smsVersion.length ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Farm guides" description="Agronomy and market advice for the website, with a short SMS version pushed to farmers without internet." action={<Button variant="gradient" onClick={() => setEditor({ form: { ...blank } })}><PlusCircle /> New guide</Button>} />

      <Card className="overflow-hidden">
        {loading ? <TableSkeleton rows={6} cols={5} /> : tips.length === 0 ? <EmptyState icon={<BookOpen />} title="No guides yet" /> : (
          <div className="overflow-x-auto"><table className="data-table">
            <thead><tr><th>Guide</th><th>Category</th><th className="text-right">Readers</th><th>SMS</th><th>Status</th><th /></tr></thead>
            <tbody>{tips.map((t) => (
              <tr key={t.id}>
                <td className="max-w-md"><p className="flex items-center gap-1.5 font-medium">{t.isFeatured && <Star className="h-3.5 w-3.5 shrink-0 fill-gold-400 text-gold-400" />}{t.title}</p><p className="truncate text-xs text-muted-foreground">{t.author} · {formatDate(t.publishedAt)}</p></td>
                <td className="capitalize">{t.category.replace('_', ' ')}</td>
                <td className="text-right tabular-nums">{formatNumber(t.views)}</td>
                <td>{t.smsVersion ? <Badge variant="success" size="sm">Ready</Badge> : <Badge variant="outline" size="sm">None</Badge>}</td>
                <td><Badge variant={t.isPublished ? 'success' : 'secondary'} size="sm">{t.isPublished ? 'Published' : 'Draft'}</Badge></td>
                <td>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon-sm" asChild aria-label="View"><Link href={`/tips/${t.slug}`} target="_blank"><ExternalLink /></Link></Button>
                    <Button variant="ghost" size="icon-sm" aria-label="Send by SMS" onClick={() => broadcast(t)}><Megaphone /></Button>
                    <Button variant="ghost" size="icon-sm" aria-label="Edit" onClick={() => edit(t)}><Pencil /></Button>
                    <Button variant="ghost" size="icon-sm" aria-label="Delete" onClick={() => remove(t)}><Trash2 /></Button>
                  </div>
                </td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </Card>

      <Dialog open={!!editor} onOpenChange={(o) => !o && setEditor(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editor?.id ? 'Edit guide' : 'New guide'}</DialogTitle>
            <DialogDescription>Use blank lines between paragraphs and **double asterisks** for bold lead-ins.</DialogDescription>
          </DialogHeader>
          {editor && (
            <div className="space-y-4">
              <div className="space-y-2"><Label required>Title</Label><Input value={editor.form.title} onChange={(e) => set('title', e.target.value)} /></div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2"><Label>Category</Label>
                  <Select value={editor.form.category} onValueChange={(v) => set('category', v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{TIP_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2"><Label>Reading time (min)</Label><Input type="number" value={editor.form.readMinutes} onChange={(e) => set('readMinutes', e.target.value)} /></div>
                <div className="space-y-2"><Label>Author</Label><Input value={editor.form.author} onChange={(e) => set('author', e.target.value)} /></div>
              </div>
              <div className="space-y-2"><Label>Summary</Label><Textarea rows={2} maxLength={300} value={editor.form.excerpt} onChange={(e) => set('excerpt', e.target.value)} /></div>
              <div className="space-y-2"><Label required>Article</Label><Textarea rows={12} value={editor.form.content} onChange={(e) => set('content', e.target.value)} className="font-mono text-[13px]" /></div>
              <div className="space-y-2">
                <Label>SMS version</Label>
                <Textarea rows={3} maxLength={320} value={editor.form.smsVersion} onChange={(e) => set('smsVersion', e.target.value)} className="font-mono text-sm" placeholder="AgriMart TIP: …" />
                <p className={cn('text-right text-xs', smsLength > 160 ? 'text-amber-700 dark:text-amber-400' : 'text-muted-foreground')}>{smsLength}/320 characters · {smsLength <= 160 ? 1 : 2} SMS segment(s)</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex items-center justify-between rounded-xl border p-3 text-sm font-medium">Published<Switch checked={editor.form.isPublished} onCheckedChange={(v) => set('isPublished', v)} /></label>
                <label className="flex items-center justify-between rounded-xl border p-3 text-sm font-medium">Featured<Switch checked={editor.form.isFeatured} onCheckedChange={(v) => set('isFeatured', v)} /></label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditor(null)}>Cancel</Button>
            <Button variant="gradient" loading={busy} onClick={save}>Save guide</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
