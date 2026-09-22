'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ImagePlus, Info, Leaf, Lightbulb, Loader2, MapPin, Send, TrendingUp, X, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { cn, formatCurrency } from '@/lib/utils';
import { QUALITY_GRADES } from '@/lib/constants';
import {
  Button, Card, Input, Label, PageHeader, Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
  SmartImage, Switch, Textarea,
} from '@/components/ui';
import { MAX_LISTING_PHOTOS, acceptPhotos } from '@/lib/images';
import type { Category, District, Produce, Region } from '@/lib/types';

interface Compare {
  best?: { market: string; avgPrice: number; unit: string };
  worst?: { market: string; avgPrice: number; unit: string };
  markets: { avgPrice: number; unit: string }[];
}

export default function NewListingPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [categories, setCategories] = React.useState<Category[]>([]);
  const [produceList, setProduceList] = React.useState<Produce[]>([]);
  const [regions, setRegions] = React.useState<Region[]>([]);
  const [districts, setDistricts] = React.useState<District[]>([]);
  const [compare, setCompare] = React.useState<Compare | null>(null);
  const [priceLoading, setPriceLoading] = React.useState(false);

  const [categoryId, setCategoryId] = React.useState('');
  const [form, setForm] = React.useState({
    produceId: '',
    unit: '',
    quantity: '',
    pricePerUnit: '',
    minOrderQuantity: '1',
    qualityGrade: 'A',
    harvestDate: new Date().toISOString().slice(0, 10),
    description: '',
    regionId: user?.regionId ? String(user.regionId) : '',
    districtId: user?.districtId ? String(user.districtId) : '',
    location: user?.community ?? '',
    negotiable: true,
    isOrganic: false,
    isUrgent: false,
  });
  const [files, setFiles] = React.useState<File[]>([]);
  const [previews, setPreviews] = React.useState<string[]>([]);
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    api.get<Category[]>('/reference/categories').then((r) => setCategories(r.data)).catch(() => {});
    api.get<Region[]>('/reference/regions').then((r) => setRegions(r.data)).catch(() => {});
  }, []);

  React.useEffect(() => {
    api
      .get<Produce[]>('/reference/produce', { categoryId: categoryId || undefined })
      .then((r) => setProduceList(r.data))
      .catch(() => {});
  }, [categoryId]);

  React.useEffect(() => {
    if (!form.regionId) return setDistricts([]);
    api.get<District[]>('/reference/districts', { regionId: form.regionId }).then((r) => setDistricts(r.data)).catch(() => {});
  }, [form.regionId]);

  // Show the prevailing market price while the farmer sets theirs
  React.useEffect(() => {
    if (!form.produceId) return setCompare(null);
    setPriceLoading(true);
    api
      .get<Compare>('/prices/compare', { produceId: form.produceId })
      .then((r) => setCompare(r.data))
      .catch(() => setCompare(null))
      .finally(() => setPriceLoading(false));
  }, [form.produceId]);

  React.useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));

  const selectedProduce = produceList.find((p) => String(p.id) === form.produceId);
  const units = selectedProduce?.units?.length ? selectedProduce.units : selectedProduce ? [selectedProduce.defaultUnit] : [];
  const marketAverage = compare?.markets.length
    ? compare.markets.reduce((sum, m) => sum + Number(m.avgPrice), 0) / compare.markets.length
    : null;
  const priceNum = Number(form.pricePerUnit);
  const vsMarket = marketAverage && priceNum ? ((priceNum - marketAverage) / marketAverage) * 100 : null;
  const total = Number(form.quantity || 0) * priceNum;

  const onFiles = (list: FileList | null) => {
    const { accepted, rejected } = acceptPhotos(list);
    if (rejected) toast.error('Images must be JPG, PNG or WEBP and under 5MB');
    setFiles((prev) => [...prev, ...accepted].slice(0, MAX_LISTING_PHOTOS));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.produceId) return toast.error('Choose what you are selling');
    if (!Number(form.quantity) || Number(form.quantity) <= 0) return toast.error('Enter how much you have');
    if (!priceNum || priceNum <= 0) return toast.error('Enter your price per unit');

    const body = new FormData();
    Object.entries(form).forEach(([key, value]) => {
      if (value !== '' && value !== null && value !== undefined) body.append(key, String(value));
    });
    if (!form.unit && selectedProduce) body.set('unit', selectedProduce.defaultUnit);
    files.forEach((file) => body.append('images', file));

    setSubmitting(true);
    try {
      const res = await api.upload<{ code: string }>('/listings', body);
      toast.success('Your listing is live', { description: `${res.data.code} — we have sent you a confirmation SMS.` });
      router.push('/dashboard/listings');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <Link href="/dashboard/listings" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> My listings
      </Link>
      <PageHeader title="List produce for sale" description="Buyers across Ghana see your listing the moment you publish it." />

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card className="space-y-5 p-6">
            <h2 className="font-semibold">What are you selling?</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={categoryId || 'all'} onValueChange={(v) => { setCategoryId(v === 'all' ? '' : v); set('produceId', ''); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All categories</SelectItem>
                    {categories.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label required>Produce</Label>
                <Select value={form.produceId} onValueChange={(v) => { set('produceId', v); set('unit', ''); }}>
                  <SelectTrigger><SelectValue placeholder="Choose produce" /></SelectTrigger>
                  <SelectContent>
                    {produceList.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {selectedProduce && (
              <div className="flex items-center gap-3 rounded-xl bg-muted/60 p-3">
                <div className="relative h-14 w-[4.5rem] shrink-0 overflow-hidden rounded-lg">
                  <SmartImage src={previews[0] ?? selectedProduce.imageUrl} alt={selectedProduce.name} sizes="72px" />
                </div>
                <div className="min-w-0 text-sm">
                  <p className="font-semibold">{selectedProduce.name}</p>
                  <p className="text-xs text-primary">
                    {files.length ? 'Your first photo is the cover.' : 'Buyers see this photo unless you add your own below.'}
                  </p>
                  {selectedProduce.localNames && <p className="truncate text-xs text-muted-foreground">{selectedProduce.localNames}</p>}
                  {selectedProduce.isPerishable && <p className="text-xs text-amber-700 dark:text-amber-400">Perishable — listing stays live for 7 days</p>}
                </div>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label required>Unit</Label>
                <Select value={form.unit || selectedProduce?.defaultUnit || ''} onValueChange={(v) => set('unit', v)} disabled={!units.length}>
                  <SelectTrigger><SelectValue placeholder="Unit" /></SelectTrigger>
                  <SelectContent>
                    {units.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label required>Quantity</Label>
                <Input type="number" min="0" value={form.quantity} onChange={(e) => set('quantity', e.target.value)} placeholder="e.g. 25" />
              </div>
              <div className="space-y-2">
                <Label>Minimum order</Label>
                <Input type="number" min="1" value={form.minOrderQuantity} onChange={(e) => set('minOrderQuantity', e.target.value)} />
              </div>
            </div>
          </Card>

          <Card className="space-y-5 p-6">
            <h2 className="font-semibold">Price &amp; quality</h2>
            <div className="space-y-2">
              <Label required>Price per {form.unit || selectedProduce?.defaultUnit || 'unit'}</Label>
              <Input type="number" min="0" value={form.pricePerUnit} onChange={(e) => set('pricePerUnit', e.target.value)} suffix="GHS" placeholder="e.g. 750" className="text-lg font-semibold" />
              {vsMarket !== null && (
                <p className={cn('text-xs font-medium', Math.abs(vsMarket) <= 10 ? 'text-primary-700 dark:text-primary-400' : 'text-amber-700 dark:text-amber-400')}>
                  {Math.abs(vsMarket) < 1
                    ? 'In line with the national market average.'
                    : `${Math.abs(vsMarket).toFixed(0)}% ${vsMarket > 0 ? 'above' : 'below'} the national market average.`}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Quality grade</Label>
              <div className="grid gap-2 sm:grid-cols-3">
                {(Object.entries(QUALITY_GRADES) as [keyof typeof QUALITY_GRADES, (typeof QUALITY_GRADES)['A']][]).map(([grade, meta]) => (
                  <button
                    type="button"
                    key={grade}
                    onClick={() => set('qualityGrade', grade)}
                    className={cn(
                      'rounded-xl border-2 p-3 text-left transition-all',
                      form.qualityGrade === grade ? 'border-primary bg-primary-50/70 dark:bg-primary-950/40' : 'hover:border-primary/40'
                    )}
                  >
                    <p className="font-semibold">{meta.label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{meta.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { key: 'negotiable' as const, label: 'Open to offers', icon: Info },
                { key: 'isOrganic' as const, label: 'Organic', icon: Leaf },
                { key: 'isUrgent' as const, label: 'Urgent sale', icon: Zap },
              ].map((toggle) => (
                <label key={toggle.key} className="flex cursor-pointer items-center justify-between gap-2 rounded-xl border p-3">
                  <span className="flex items-center gap-2 text-sm font-medium"><toggle.icon className="h-4 w-4 text-muted-foreground" /> {toggle.label}</span>
                  <Switch checked={form[toggle.key]} onCheckedChange={(v) => set(toggle.key, v)} />
                </label>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Harvest date</Label>
                <Input type="date" value={form.harvestDate} onChange={(e) => set('harvestDate', e.target.value)} max={new Date().toISOString().slice(0, 10)} />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea rows={4} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Variety, moisture, packaging, collection times, whether you can deliver…" />
            </div>
          </Card>

          <Card className="space-y-5 p-6">
            <h2 className="font-semibold">Photos &amp; location</h2>
            <div>
              <Label>Photos (up to {MAX_LISTING_PHOTOS})</Label>
              <div className="mt-2 grid grid-cols-3 gap-3 sm:grid-cols-5">
                {previews.map((src, i) => (
                  <div key={src} className="group relative aspect-square overflow-hidden rounded-xl border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={src} alt={`Upload ${i + 1}`} className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                      className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-slate-900/70 text-white opacity-0 transition-opacity group-hover:opacity-100"
                      aria-label="Remove photo"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
                {files.length < MAX_LISTING_PHOTOS && (
                  <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed text-muted-foreground transition-colors hover:border-primary hover:text-primary">
                    <ImagePlus className="h-6 w-6" />
                    <span className="text-xs font-medium">Add photo</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      className="sr-only"
                      onChange={(e) => {
                        onFiles(e.target.files);
                        e.target.value = '';
                      }}
                    />
                  </label>
                )}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                No photo? Buyers see our catalogue picture of {selectedProduce ? selectedProduce.name.toLowerCase() : 'the crop'} — you can add your own later from My listings.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Region</Label>
                <Select value={form.regionId} onValueChange={(v) => { set('regionId', v); set('districtId', ''); }}>
                  <SelectTrigger><SelectValue placeholder="Region" /></SelectTrigger>
                  <SelectContent>{regions.map((r) => <SelectItem key={r.id} value={String(r.id)}>{r.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>District</Label>
                <Select value={form.districtId} onValueChange={(v) => set('districtId', v)} disabled={!districts.length}>
                  <SelectTrigger><SelectValue placeholder="District" /></SelectTrigger>
                  <SelectContent>{districts.map((d) => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Town / community</Label>
                <Input icon={<MapPin />} value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="Ejura" />
              </div>
            </div>
          </Card>
        </div>

        {/* Side panel: market guidance + summary */}
        <div className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <Card className="p-5">
            <h3 className="flex items-center gap-2 font-semibold"><TrendingUp className="h-4 w-4 text-primary" /> Market guide</h3>
            {!form.produceId ? (
              <p className="mt-3 text-sm text-muted-foreground">Choose a produce to see what markets are paying today.</p>
            ) : priceLoading ? (
              <div className="mt-4 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : !compare?.markets.length ? (
              <p className="mt-3 text-sm text-muted-foreground">No recent price records for this crop yet.</p>
            ) : (
              <dl className="mt-4 space-y-3 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">National average</dt>
                  <dd className="font-semibold tabular-nums">{formatCurrency(marketAverage, { decimals: 0 })}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Highest · {compare.best?.market}</dt>
                  <dd className="font-semibold tabular-nums">{formatCurrency(compare.best?.avgPrice, { decimals: 0 })}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Lowest · {compare.worst?.market}</dt>
                  <dd className="font-semibold tabular-nums">{formatCurrency(compare.worst?.avgPrice, { decimals: 0 })}</dd>
                </div>
                <p className="flex gap-2 rounded-lg bg-primary-50 p-2.5 text-xs text-primary-800 dark:bg-primary-950/50 dark:text-primary-200">
                  <Lightbulb className="h-4 w-4 shrink-0" /> Prices are per {compare.markets[0]?.unit}. Buyers compare, so a price near the average sells fastest.
                </p>
              </dl>
            )}
          </Card>

          <Card className="p-5">
            <h3 className="font-semibold">Summary</h3>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Produce</dt><dd className="font-medium">{selectedProduce?.name ?? '—'}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Quantity</dt><dd className="font-medium">{form.quantity || '—'} {form.unit || selectedProduce?.defaultUnit}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Grade</dt><dd className="font-medium">{form.qualityGrade}</dd></div>
              <div className="flex justify-between border-t pt-3"><dt className="font-medium">Total value</dt><dd className="font-display text-xl font-extrabold text-primary-700 dark:text-primary-400">{formatCurrency(total, { decimals: 0 })}</dd></div>
            </dl>
            <p className="mt-3 text-xs text-muted-foreground">Free to list. 3% is deducted only when a sale completes.</p>
            <Button type="submit" variant="gradient" size="lg" className="mt-4 w-full" loading={submitting}>
              {!submitting && <Send />} Publish listing
            </Button>
          </Card>
        </div>
      </div>
    </form>
  );
}
