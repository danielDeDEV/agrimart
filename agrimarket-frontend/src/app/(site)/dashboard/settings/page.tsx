'use client';

import * as React from 'react';
import { KeyRound, Lock, MessageSquare, Moon, Smartphone, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useTheme } from '@/components/providers';
import { SITE } from '@/lib/constants';
import { useSettings } from '@/components/settings-provider';
import {
  Button, Card, Label, PageHeader, PasswordInput, Select, SelectContent, SelectItem, SelectTrigger, SelectValue, Switch,
} from '@/components/ui';
import type { User } from '@/lib/types';

export default function SettingsPage() {
  const site = useSettings();
  const { user, updateUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const [password, setPassword] = React.useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [pin, setPin] = React.useState({ currentPin: '', pin: '', confirm: '' });
  const [busy, setBusy] = React.useState<string | null>(null);

  if (!user) return null;

  const savePreference = async (patch: Partial<User>) => {
    updateUser(patch);
    try {
      await api.patch('/users/me', patch);
      toast.success('Preference saved');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.newPassword.length < 8) return toast.error('Use at least 8 characters');
    if (password.newPassword !== password.confirm) return toast.error('Passwords do not match');
    setBusy('password');
    try {
      await api.patch('/auth/password', { currentPassword: password.currentPassword, newPassword: password.newPassword });
      toast.success('Password updated');
      setPassword({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const changePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^\d{4}$/.test(pin.pin)) return toast.error('Your PIN must be exactly 4 digits');
    if (pin.pin !== pin.confirm) return toast.error('PINs do not match');
    setBusy('pin');
    try {
      const res = await api.patch('/auth/pin', { pin: pin.pin, currentPin: pin.currentPin || undefined });
      toast.success(res.message);
      setPin({ currentPin: '', pin: '', confirm: '' });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const digits = (value: string) => value.replace(/\D/g, '').slice(0, 4);

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Notifications, language, security and your USSD PIN." />

      <Card className="divide-y">
        <div className="p-6"><h2 className="font-semibold">Notifications &amp; display</h2></div>
        {[
          { icon: MessageSquare, title: 'SMS notifications', text: 'Price digests, tips and reminders. Order, payment and security texts always come through.', key: 'smsNotifications' as const },
          { icon: TrendingUp, title: 'Price alerts', text: 'SMS when a market price crosses one of your targets.', key: 'priceAlerts' as const },
        ].map((row) => (
          <label key={row.key} className="flex cursor-pointer items-center gap-4 p-6">
            <row.icon className="h-5 w-5 shrink-0 text-primary" />
            <div className="flex-1">
              <p className="font-medium">{row.title}</p>
              <p className="text-sm text-muted-foreground">{row.text}</p>
            </div>
            <Switch checked={!!user[row.key]} onCheckedChange={(v) => savePreference({ [row.key]: v })} />
          </label>
        ))}
        <div className="flex flex-wrap items-center gap-4 p-6">
          <Moon className="h-5 w-5 shrink-0 text-primary" />
          <div className="flex-1">
            <p className="font-medium">Appearance</p>
            <p className="text-sm text-muted-foreground">Light, dark, or follow your device.</p>
          </div>
          <Select value={theme} onValueChange={(v) => setTheme(v as 'light' | 'dark' | 'system')}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
              <SelectItem value="system">System</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-6">
          <h2 className="flex items-center gap-2 font-semibold"><KeyRound className="h-4 w-4 text-primary" /> USSD PIN</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Used when you sell, order or withdraw by dialling {site.ussdCode}. Leave the current PIN empty if you have never set one.
          </p>
          <form onSubmit={changePin} className="mt-5 space-y-4">
            <div className="space-y-2"><Label>Current PIN</Label><PasswordInput value={pin.currentPin} onChange={(e) => setPin((p) => ({ ...p, currentPin: digits(e.target.value) }))} inputMode="numeric" className="font-mono tracking-[0.4em]" /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label required>New PIN</Label><PasswordInput value={pin.pin} onChange={(e) => setPin((p) => ({ ...p, pin: digits(e.target.value) }))} inputMode="numeric" className="font-mono tracking-[0.4em]" /></div>
              <div className="space-y-2"><Label required>Confirm</Label><PasswordInput value={pin.confirm} onChange={(e) => setPin((p) => ({ ...p, confirm: digits(e.target.value) }))} inputMode="numeric" className="font-mono tracking-[0.4em]" /></div>
            </div>
            <Button type="submit" variant="gradient" loading={busy === 'pin'}><Smartphone /> Save PIN</Button>
          </form>
        </Card>

        <Card className="p-6">
          <h2 className="flex items-center gap-2 font-semibold"><Lock className="h-4 w-4 text-primary" /> Web password</h2>
          <p className="mt-1 text-sm text-muted-foreground">Registered over USSD? Leave the current password empty to set your first one.</p>
          <form onSubmit={changePassword} className="mt-5 space-y-4">
            <div className="space-y-2"><Label>Current password</Label><PasswordInput value={password.currentPassword} onChange={(e) => setPassword((p) => ({ ...p, currentPassword: e.target.value }))} autoComplete="current-password" /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label required>New password</Label><PasswordInput value={password.newPassword} onChange={(e) => setPassword((p) => ({ ...p, newPassword: e.target.value }))} autoComplete="new-password" /></div>
              <div className="space-y-2"><Label required>Confirm</Label><PasswordInput value={password.confirm} onChange={(e) => setPassword((p) => ({ ...p, confirm: e.target.value }))} autoComplete="new-password" /></div>
            </div>
            <Button type="submit" variant="gradient" loading={busy === 'password'}><Lock /> Update password</Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
