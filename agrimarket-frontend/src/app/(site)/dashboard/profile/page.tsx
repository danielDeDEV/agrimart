'use client';

import * as React from 'react';
import { BadgeCheck, Camera, Save, Star } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDate, initials } from '@/lib/utils';
import { BUSINESS_TYPES, CHANNEL_META, MOMO_PROVIDERS } from '@/lib/constants';
import {
  Avatar, AvatarFallback, AvatarImage, Badge, Button, Card, Input, Label, PageHeader, Select, SelectContent,
  SelectItem, SelectTrigger, SelectValue, Textarea,
} from '@/components/ui';
import type { District, Region, User } from '@/lib/types';

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const [regions, setRegions] = React.useState<Region[]>([]);
  const [districts, setDistricts] = React.useState<District[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const [form, setForm] = React.useState({
    fullName: '', email: '', phone: '', regionId: '', districtId: '', community: '', gender: '', bio: '',
    farmSize: '', farmingExperience: '', cooperative: '', primaryCrops: '',
    businessName: '', businessType: '', momoNumber: '', momoProvider: '',
  });

  React.useEffect(() => {
    if (!user) return;
    setForm({
      fullName: user.fullName ?? '',
      email: user.email ?? '',
      phone: user.phone ?? '',
      regionId: user.regionId ? String(user.regionId) : '',
      districtId: user.districtId ? String(user.districtId) : '',
      community: user.community ?? '',
      gender: user.gender ?? '',
      bio: user.bio ?? '',
      farmSize: user.farmSize ? String(user.farmSize) : '',
      farmingExperience: user.farmingExperience ? String(user.farmingExperience) : '',
      cooperative: user.cooperative ?? '',
      primaryCrops: (user.primaryCrops ?? []).join(', '),
      businessName: user.businessName ?? '',
      businessType: user.businessType ?? '',
      momoNumber: user.momoNumber ?? '',
      momoProvider: user.momoProvider ?? '',
    });
  }, [user]);

  React.useEffect(() => {
    api.get<Region[]>('/reference/regions').then((r) => setRegions(r.data)).catch(() => {});
  }, []);

  React.useEffect(() => {
    if (!form.regionId) return setDistricts([]);
    api.get<District[]>('/reference/districts', { regionId: form.regionId }).then((r) => setDistricts(r.data)).catch(() => {});
  }, [form.regionId]);

  if (!user) return null;
  const isFarmer = user.role !== 'buyer';
  const set = (key: keyof typeof form, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        email: form.email || null,
        regionId: form.regionId ? Number(form.regionId) : null,
        districtId: form.districtId ? Number(form.districtId) : null,
        gender: form.gender || null,
        farmSize: form.farmSize ? Number(form.farmSize) : null,
        farmingExperience: form.farmingExperience ? Number(form.farmingExperience) : null,
        primaryCrops: form.primaryCrops.split(',').map((c) => c.trim()).filter(Boolean),
        businessType: form.businessType || null,
        momoProvider: form.momoProvider || null,
      };
      const res = await api.patch<User>('/users/me', payload);
      updateUser(res.data);
      toast.success('Profile saved');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async (file?: File) => {
    if (!file) return;
    const body = new FormData();
    body.append('avatar', file);
    setUploading(true);
    try {
      const res = await api.upload<{ avatarUrl: string }>('/users/me/avatar', body);
      updateUser({ avatarUrl: res.data.avatarUrl });
      toast.success('Photo updated');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  return (
    <form onSubmit={save} className="space-y-6">
      <PageHeader title="Profile" description="What buyers and farmers see when they trade with you." action={<Button type="submit" variant="gradient" loading={saving}>{!saving && <Save />} Save changes</Button>} />

      <Card className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
        <div className="relative">
          <Avatar className="h-24 w-24 text-2xl">
            {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.fullName} />}
            <AvatarFallback className="text-2xl">{initials(user.fullName)}</AvatarFallback>
          </Avatar>
          <label className="absolute -bottom-1 -right-1 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-2 border-background bg-primary text-white shadow-soft hover:bg-primary-700">
            <Camera className="h-4 w-4" />
            <input type="file" accept="image/*" className="sr-only" disabled={uploading} onChange={(e) => uploadAvatar(e.target.files?.[0])} />
          </label>
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-xl font-bold">
            {user.fullName} {user.isVerifiedSeller && <BadgeCheck className="h-5 w-5 fill-primary text-white" />}
          </p>
          <p className="text-muted-foreground">{user.phone}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="success" className="capitalize">{user.role}</Badge>
            <Badge variant="outline"><Star className="fill-gold-400 text-gold-400" /> {Number(user.ratingAvg).toFixed(1)} ({user.ratingCount})</Badge>
            <Badge variant="outline">Joined via {CHANNEL_META[user.registrationChannel]?.label ?? user.registrationChannel}</Badge>
            <Badge variant="outline">Member since {formatDate(user.createdAt)}</Badge>
          </div>
        </div>
      </Card>

      <Card className="space-y-5 p-6">
        <h2 className="font-semibold">Personal details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2"><Label required>Full name</Label><Input value={form.fullName} onChange={(e) => set('fullName', e.target.value)} /></div>
          <div className="space-y-2"><Label>Phone number</Label><Input value={form.phone} onChange={(e) => set('phone', e.target.value)} inputMode="tel" /></div>
          <div className="space-y-2"><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} /></div>
          <div className="space-y-2">
            <Label>Gender</Label>
            <Select value={form.gender} onValueChange={(v) => set('gender', v)}>
              <SelectTrigger><SelectValue placeholder="Prefer not to say" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
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
          <div className="space-y-2"><Label>Town / community</Label><Input value={form.community} onChange={(e) => set('community', e.target.value)} /></div>
        </div>
        <div className="space-y-2"><Label>About you</Label><Textarea rows={3} value={form.bio} onChange={(e) => set('bio', e.target.value)} placeholder={isFarmer ? 'What you grow, how long you have farmed, what makes your produce good' : 'What you buy and in what volumes'} /></div>
      </Card>

      {isFarmer ? (
        <Card className="space-y-5 p-6">
          <h2 className="font-semibold">Farm</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2"><Label>Farm size</Label><Input type="number" value={form.farmSize} onChange={(e) => set('farmSize', e.target.value)} suffix="acres" /></div>
            <div className="space-y-2"><Label>Years farming</Label><Input type="number" value={form.farmingExperience} onChange={(e) => set('farmingExperience', e.target.value)} suffix="yrs" /></div>
            <div className="space-y-2"><Label>Cooperative</Label><Input value={form.cooperative} onChange={(e) => set('cooperative', e.target.value)} placeholder="Optional" /></div>
          </div>
          <div className="space-y-2"><Label>Main crops</Label><Input value={form.primaryCrops} onChange={(e) => set('primaryCrops', e.target.value)} placeholder="Maize, cowpea, yam" /></div>
        </Card>
      ) : (
        <Card className="space-y-5 p-6">
          <h2 className="font-semibold">Business</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label>Business name</Label><Input value={form.businessName} onChange={(e) => set('businessName', e.target.value)} /></div>
            <div className="space-y-2">
              <Label>Business type</Label>
              <Select value={form.businessType} onValueChange={(v) => set('businessType', v)}>
                <SelectTrigger><SelectValue placeholder="Choose" /></SelectTrigger>
                <SelectContent>{BUSINESS_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </Card>
      )}

      <Card className="space-y-5 p-6">
        <h2 className="font-semibold">Mobile money for payouts</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Network</Label>
            <Select value={form.momoProvider} onValueChange={(v) => set('momoProvider', v)}>
              <SelectTrigger><SelectValue placeholder="Choose network" /></SelectTrigger>
              <SelectContent>{MOMO_PROVIDERS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>MoMo number</Label><Input value={form.momoNumber} onChange={(e) => set('momoNumber', e.target.value)} inputMode="tel" placeholder={user.phone} /></div>
        </div>
      </Card>
    </form>
  );
}
