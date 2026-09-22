'use client';

import * as React from 'react';
import { ImageOff, ImagePlus, Pencil, PlusCircle, RotateCcw, Store, Tags, Trash2, Wheat } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { acceptPhotos } from '@/lib/images';
import {
  Badge, Button, Card, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input,
  Label, PageHeader, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SmartImage, Switch, TableSkeleton,
  Tabs, TabsContent, TabsList, TabsTrigger, Textarea,
} from '@/components/ui';
import type { Category, Market, Produce, Region } from '@/lib/types';

type Kind = 'produce' | 'categories' | 'markets';
type FormState = Record<string, string | boolean>;

const blank: Record<Kind, FormState> = {
  produce: { name: '', categoryId: '', localNames: '', defaultUnit: 'bag', units: 'bag, kg', isPerishable: false, isActive: true, description: '' },
  categories: { name: '', description: '', color: '#16a34a', icon: 'Wheat', sortOrder: '0', isActive: true },
  markets: { name: '', regionId: '', type: 'wholesale', marketDays: '', description: '', isMajor: false, isActive: true },
};

export default function CatalogPage() {
  const [produce, setProduce] = React.useState<Produce[]>([]);
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [markets, setMarkets] = React.useState<Market[]>([]);
  const [regions, setRegions] = React.useState<Region[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [editor, setEditor] = React.useState<{ kind: Kind; id?: number; form: FormState; imageUrl?: string | null } | null>(null);
  const [busy, setBusy] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const [p, c, m, r] = await Promise.all([
        api.get<Produce[]>('/reference/produce'),
        api.get<Category[]>('/reference/categories', { withCounts: true }),
        api.get<Market[]>('/reference/markets'),
        api.get<Region[]>('/reference/regions'),
      ]);
      setProduce(p.data);
      setCategories(c.data);
      setMarkets(m.data);
      setRegions(r.data);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const open = (kind: Kind, record?: Produce | Category | Market) => {
    if (!record) return setEditor({ kind, form: { ...blank[kind] } });
    const r = record as unknown as Record<string, unknown>;
    const form: FormState = {};
    Object.keys(blank[kind]).forEach((key) => {
      const value = r[key];
      if (key === 'units') form[key] = Array.isArray(value) ? value.join(', ') : '';
      else if (typeof blank[kind][key] === 'boolean') form[key] = Boolean(value);
      else form[key] = value === null || value === undefined ? '' : String(value);
    });
    setEditor({ kind, id: Number(r.id), form, imageUrl: (r.imageUrl as string | null | undefined) ?? null });
  };

  const set = (key: string, value: string | boolean) => setEditor((e) => (e ? { ...e, form: { ...e.form, [key]: value } } : e));

  const save = async () => {
    if (!editor) return;
    const { kind, id, form } = editor;
    if (String(form.name).trim().length < 2) return toast.error('Enter a name');

    const body: Record<string, unknown> = { ...form };
    if (kind === 'produce') {
      if (!form.categoryId) return toast.error('Choose a category');
      body.categoryId = Number(form.categoryId);
      body.units = String(form.units).split(',').map((u) => u.trim()).filter(Boolean);
    }
    if (kind === 'markets') {
      if (!form.regionId) return toast.error('Choose a region');
      body.regionId = Number(form.regionId);
    }
    if (kind === 'categories') body.sortOrder = Number(form.sortOrder || 0);

    setBusy(true);
    try {
      if (id) await api.patch(`/reference/${kind}/${id}`, body);
      else await api.post(`/reference/${kind}`, body);
      toast.success(id ? 'Saved' : 'Created');
      setEditor(null);
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (kind: Kind, id: number, name: string) => {
    if (!window.confirm(`Delete "${name}"? Records still in use cannot be deleted — deactivate them instead.`)) return;
    try {
      await api.delete(`/reference/${kind}/${id}`);
      toast.success('Deleted');
      await load();
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const categoryName = (id: number) => categories.find((c) => c.id === id)?.name ?? '—';

  return (
    <div className="space-y-6">
      <PageHeader title="Produce & markets" description="The reference data behind every USSD menu, listing form and price board. Menu order on USSD follows the list order below." />

      <Tabs defaultValue="produce">
        <TabsList>
          <TabsTrigger value="produce"><Wheat /> Produce ({produce.length})</TabsTrigger>
          <TabsTrigger value="categories"><Tags /> Categories ({categories.length})</TabsTrigger>
          <TabsTrigger value="markets"><Store /> Markets ({markets.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="produce">
          <Card className="overflow-hidden">
            <div className="flex justify-end border-b p-3"><Button size="sm" variant="gradient" onClick={() => open('produce')}><PlusCircle /> Add produce</Button></div>
            {loading ? <TableSkeleton rows={10} cols={5} /> : (
              <div className="overflow-x-auto"><table className="data-table">
                <thead><tr><th>Produce</th><th>Category</th><th>Units</th><th>Local names</th><th>Flags</th><th /></tr></thead>
                <tbody>{produce.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <button type="button" onClick={() => open('produce', p)} className="group flex items-center gap-3 text-left">
                        <div className="relative h-10 w-12 shrink-0 overflow-hidden rounded-lg ring-primary/40 transition group-hover:ring-2"><SmartImage sizes="48px" src={p.imageUrl} alt={p.name} /></div>
                        <span>
                          <span className="block font-medium group-hover:text-primary">{p.name}</span>
                          <PhotoStatus url={p.imageUrl} />
                        </span>
                      </button>
                    </td>
                    <td className="text-sm">{categoryName(p.categoryId)}</td>
                    <td className="text-xs text-muted-foreground">{(p.units ?? []).join(', ')}</td>
                    <td className="max-w-[220px] truncate text-xs text-muted-foreground" title={p.localNames}>{p.localNames || '—'}</td>
                    <td className="space-x-1">{p.isPerishable && <Badge variant="warning" size="sm">Perishable</Badge>}</td>
                    <td><div className="flex gap-1"><Button variant="ghost" size="icon-sm" aria-label="Edit" onClick={() => open('produce', p)}><Pencil /></Button><Button variant="ghost" size="icon-sm" aria-label="Delete" onClick={() => remove('produce', p.id, p.name)}><Trash2 /></Button></div></td>
                  </tr>
                ))}</tbody>
              </table></div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="categories">
          <Card className="overflow-hidden">
            <div className="flex justify-end border-b p-3"><Button size="sm" variant="gradient" onClick={() => open('categories')}><PlusCircle /> Add category</Button></div>
            {loading ? <TableSkeleton rows={6} cols={4} /> : (
              <div className="overflow-x-auto"><table className="data-table">
                <thead><tr><th>Category</th><th>Description</th><th className="text-right">Live listings</th><th className="text-right">Order</th><th /></tr></thead>
                <tbody>{categories.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <button type="button" onClick={() => open('categories', c)} className="group flex items-center gap-3 text-left">
                        <div className="relative h-10 w-14 shrink-0 overflow-hidden rounded-lg ring-primary/40 transition group-hover:ring-2"><SmartImage sizes="56px" src={c.imageUrl} alt={c.name} /></div>
                        <span>
                          <span className="flex items-center gap-2 font-medium group-hover:text-primary"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} /> {c.name}</span>
                          <PhotoStatus url={c.imageUrl} />
                        </span>
                      </button>
                    </td>
                    <td className="max-w-md text-sm text-muted-foreground">{c.description}</td>
                    <td className="text-right tabular-nums">{c.listingCount ?? 0}</td>
                    <td className="text-right tabular-nums">{(c as Category & { sortOrder?: number }).sortOrder ?? 0}</td>
                    <td><div className="flex gap-1"><Button variant="ghost" size="icon-sm" aria-label="Edit" onClick={() => open('categories', c)}><Pencil /></Button><Button variant="ghost" size="icon-sm" aria-label="Delete" onClick={() => remove('categories', c.id, c.name)}><Trash2 /></Button></div></td>
                  </tr>
                ))}</tbody>
              </table></div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="markets">
          <Card className="overflow-hidden">
            <div className="flex justify-end border-b p-3"><Button size="sm" variant="gradient" onClick={() => open('markets')}><PlusCircle /> Add market</Button></div>
            {loading ? <TableSkeleton rows={10} cols={5} /> : (
              <div className="overflow-x-auto"><table className="data-table">
                <thead><tr><th>Market</th><th>Region</th><th>Type</th><th>Market days</th><th /></tr></thead>
                <tbody>{markets.map((m) => (
                  <tr key={m.id}>
                    <td><p className="flex items-center gap-2 font-medium">{m.name} {m.isMajor && <Badge variant="gold" size="sm">Major</Badge>}</p>{m.description && <p className="max-w-md truncate text-xs text-muted-foreground">{m.description}</p>}</td>
                    <td className="text-sm">{m.region?.name}</td>
                    <td className="capitalize">{m.type}</td>
                    <td className="text-sm text-muted-foreground">{m.marketDays || '—'}</td>
                    <td><div className="flex gap-1"><Button variant="ghost" size="icon-sm" aria-label="Edit" onClick={() => open('markets', m)}><Pencil /></Button><Button variant="ghost" size="icon-sm" aria-label="Delete" onClick={() => remove('markets', m.id, m.name)}><Trash2 /></Button></div></td>
                  </tr>
                ))}</tbody>
              </table></div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!editor} onOpenChange={(o) => !o && setEditor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editor?.id ? 'Edit' : 'Add'} {editor?.kind === 'categories' ? 'category' : editor?.kind === 'markets' ? 'market' : 'produce'}</DialogTitle>
            <DialogDescription>Changes appear on USSD menus and the website immediately.</DialogDescription>
          </DialogHeader>
          {editor && (
            <div className="space-y-4">
              <div className="space-y-2"><Label required>Name</Label><Input value={String(editor.form.name)} onChange={(e) => set('name', e.target.value)} /></div>

              {(editor.kind === 'produce' || editor.kind === 'categories') && (
                <CatalogPhoto
                  kind={editor.kind}
                  id={editor.id}
                  name={String(editor.form.name) || 'this item'}
                  imageUrl={editor.imageUrl}
                  onChange={(url) => {
                    setEditor((e) => (e ? { ...e, imageUrl: url } : e));
                    void load();
                  }}
                />
              )}

              {editor.kind === 'produce' && (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2"><Label required>Category</Label>
                      <Select value={String(editor.form.categoryId)} onValueChange={(v) => set('categoryId', v)}>
                        <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
                        <SelectContent>{categories.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2"><Label>Default unit</Label><Input value={String(editor.form.defaultUnit)} onChange={(e) => set('defaultUnit', e.target.value)} /></div>
                  </div>
                  <div className="space-y-2"><Label>Units traded (comma separated)</Label><Input value={String(editor.form.units)} onChange={(e) => set('units', e.target.value)} /></div>
                  <div className="space-y-2"><Label>Local names</Label><Input value={String(editor.form.localNames)} onChange={(e) => set('localNames', e.target.value)} placeholder="Aburo (Twi), Bli (Ewe)" /></div>
                  <label className="flex items-center justify-between rounded-xl border p-3 text-sm font-medium">Perishable (7-day listings)<Switch checked={Boolean(editor.form.isPerishable)} onCheckedChange={(v) => set('isPerishable', v)} /></label>
                </>
              )}

              {editor.kind === 'categories' && (
                <>
                  <div className="space-y-2"><Label>Description</Label><Textarea rows={2} value={String(editor.form.description)} onChange={(e) => set('description', e.target.value)} /></div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2"><Label>Colour</Label><Input type="color" value={String(editor.form.color)} onChange={(e) => set('color', e.target.value)} className="h-11 p-1" /></div>
                    <div className="space-y-2"><Label>Icon name</Label><Input value={String(editor.form.icon)} onChange={(e) => set('icon', e.target.value)} /></div>
                    <div className="space-y-2"><Label>Menu order</Label><Input type="number" value={String(editor.form.sortOrder)} onChange={(e) => set('sortOrder', e.target.value)} /></div>
                  </div>
                </>
              )}

              {editor.kind === 'markets' && (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2"><Label required>Region</Label>
                      <Select value={String(editor.form.regionId)} onValueChange={(v) => set('regionId', v)}>
                        <SelectTrigger><SelectValue placeholder="Region" /></SelectTrigger>
                        <SelectContent>{regions.map((r) => <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2"><Label>Type</Label>
                      <Select value={String(editor.form.type)} onValueChange={(v) => set('type', v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{['wholesale', 'retail', 'farmgate', 'export'].map((t) => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2"><Label>Market days</Label><Input value={String(editor.form.marketDays)} onChange={(e) => set('marketDays', e.target.value)} placeholder="Wednesday, Saturday" /></div>
                  <div className="space-y-2"><Label>Description</Label><Textarea rows={2} value={String(editor.form.description)} onChange={(e) => set('description', e.target.value)} /></div>
                  <label className="flex items-center justify-between rounded-xl border p-3 text-sm font-medium">Major market (shown first)<Switch checked={Boolean(editor.form.isMajor)} onCheckedChange={(v) => set('isMajor', v)} /></label>
                </>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditor(null)}>Cancel</Button>
            <Button variant="gradient" loading={busy} onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Where a catalogue photo comes from, shown under the name in the tables. */
function PhotoStatus({ url }: { url?: string | null }) {
  if (!url) return <span className="text-xs font-medium text-amber-600 dark:text-amber-400">No photo — add one</span>;
  if (url.includes('/uploads/')) return <span className="text-xs text-primary">Custom photo</span>;
  return <span className="text-xs text-muted-foreground">Library photo</span>;
}

/**
 * Photo manager for a produce type or category. Listings without the farmer's
 * own photos show the produce photo, so a change here updates all of them.
 */
function CatalogPhoto({
  kind,
  id,
  name,
  imageUrl,
  onChange,
}: {
  kind: 'produce' | 'categories';
  id?: number;
  name: string;
  imageUrl?: string | null;
  onChange: (url: string | null) => void;
}) {
  const [busy, setBusy] = React.useState<'upload' | 'reset' | null>(null);
  const fileInput = React.useRef<HTMLInputElement>(null);

  if (!id) {
    return (
      <p className="rounded-xl border border-dashed p-3 text-xs text-muted-foreground">
        Save first, then add a photo. Crops already in the photo library get their picture automatically.
      </p>
    );
  }

  const uploadPhoto = async (list: FileList | null) => {
    const { accepted, rejected } = acceptPhotos(list);
    if (rejected || !accepted.length) {
      toast.error('Choose a JPG, PNG or WEBP photo under 5MB');
      return;
    }
    const body = new FormData();
    body.append('image', accepted[0]);
    setBusy('upload');
    try {
      const res = await api.upload<{ imageUrl: string | null }>(`/reference/${kind}/${id}/image`, body);
      toast.success(res.message || 'Photo updated');
      onChange(res.data.imageUrl);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const resetPhoto = async () => {
    setBusy('reset');
    try {
      const res = await api.delete<{ imageUrl: string | null }>(`/reference/${kind}/${id}/image`);
      toast.success(res.message || 'Photo reset');
      onChange(res.data.imageUrl);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex items-center gap-4 rounded-xl border p-3">
      <div className="relative h-20 w-28 shrink-0 overflow-hidden rounded-lg bg-muted">
        {imageUrl ? (
          <SmartImage src={imageUrl} alt={name} sizes="112px" />
        ) : (
          <span className="flex h-full items-center justify-center text-muted-foreground"><ImageOff className="h-6 w-6" /></span>
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-xs text-muted-foreground">
          {kind === 'produce'
            ? 'Shown on every listing of this crop that has no photo of its own, including all USSD and SMS listings.'
            : 'Shown on the homepage category tiles.'}
        </p>
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            onChange={(e) => {
              void uploadPhoto(e.target.files);
              e.target.value = '';
            }}
          />
          <Button size="sm" variant="outline" loading={busy === 'upload'} disabled={!!busy} onClick={() => fileInput.current?.click()}>
            <ImagePlus /> Upload photo
          </Button>
          {imageUrl?.includes('/uploads/') && (
            <Button size="sm" variant="ghost" loading={busy === 'reset'} disabled={!!busy} onClick={resetPhoto}>
              <RotateCcw /> Use library photo
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
