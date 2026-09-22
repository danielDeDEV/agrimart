'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, KeyRound, Lock, Phone, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { api, errorMessage } from '@/lib/api';
import { isValidGhanaPhone } from '@/lib/utils';
import { Button, Input, Label, PasswordInput } from '@/components/ui';

type Stage = 'phone' | 'code' | 'reset';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [stage, setStage] = React.useState<Stage>('phone');
  const [purpose, setPurpose] = React.useState<'reset_password' | 'reset_pin'>('reset_password');
  const [phone, setPhone] = React.useState('');
  const [code, setCode] = React.useState('');
  const [devCode, setDevCode] = React.useState<string | null>(null);
  const [resetToken, setResetToken] = React.useState('');
  const [secret, setSecret] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  const requestCode = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!isValidGhanaPhone(phone)) return toast.error('Enter the phone number on your account');
    setBusy(true);
    try {
      const res = await api.post<{ devCode?: string }>('/auth/otp/request', { phone, purpose });
      setDevCode(res.data.devCode ?? null);
      toast.success(res.message);
      setStage('code');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api.post<{ resetToken: string }>('/auth/otp/verify', { phone, code, purpose });
      setResetToken(res.data.resetToken);
      setStage('reset');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const reset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (purpose === 'reset_password') {
      if (secret.length < 8) return toast.error('Use at least 8 characters');
      if (secret !== confirm) return toast.error('Passwords do not match');
    } else if (!/^\d{4}$/.test(secret)) {
      return toast.error('Your PIN must be exactly 4 digits');
    }

    setBusy(true);
    try {
      await api.post('/auth/password/reset', {
        resetToken,
        ...(purpose === 'reset_password' ? { password: secret } : { pin: secret }),
      });
      toast.success(purpose === 'reset_password' ? 'Password updated — sign in now' : 'PIN updated — dial the USSD code to use it');
      router.push('/login');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="animate-fade-up">
      <Link href="/login" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to sign in
      </Link>

      <span className="mt-6 flex h-12 w-12 items-center justify-center rounded-xl bg-primary-50 text-primary-700 dark:bg-primary-950/60 dark:text-primary-300">
        <ShieldCheck className="h-6 w-6" />
      </span>
      <h1 className="mt-4 font-display text-3xl font-extrabold tracking-tight">
        {stage === 'reset' ? (purpose === 'reset_password' ? 'Choose a new password' : 'Choose a new PIN') : 'Reset your access'}
      </h1>
      <p className="mt-2 text-muted-foreground">
        {stage === 'phone' && 'We will text a 6-digit code to the phone number on your account.'}
        {stage === 'code' && `Enter the code we sent to ${phone}. It expires in 10 minutes.`}
        {stage === 'reset' && 'Almost done.'}
      </p>

      {stage === 'phone' && (
        <form onSubmit={requestCode} className="mt-8 space-y-5">
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
            {([['reset_password', 'Web password'], ['reset_pin', 'USSD PIN']] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setPurpose(value)}
                className={`rounded-lg py-2 text-sm font-semibold transition-all ${purpose === value ? 'bg-background shadow-soft' : 'text-muted-foreground'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            <Label>Phone number</Label>
            <Input icon={<Phone />} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0244 123 456" inputMode="tel" />
          </div>
          <Button type="submit" variant="gradient" size="lg" className="w-full" loading={busy}>Send code</Button>
        </form>
      )}

      {stage === 'code' && (
        <form onSubmit={verify} className="mt-8 space-y-5">
          <div className="space-y-2">
            <Label>Verification code</Label>
            <Input
              icon={<KeyRound />}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              inputMode="numeric"
              placeholder="6 digits"
              className="font-mono text-lg tracking-[0.5em]"
              autoFocus
            />
          </div>
          {devCode && (
            <p className="rounded-xl bg-gold-50 p-3 text-xs text-gold-800 dark:bg-gold-900/20 dark:text-gold-200">
              Development mode (SMS provider is mock): your code is <code className="font-mono font-bold">{devCode}</code>
            </p>
          )}
          <Button type="submit" variant="gradient" size="lg" className="w-full" loading={busy} disabled={code.length !== 6}>Verify code</Button>
          <button type="button" onClick={() => requestCode()} className="w-full text-sm font-semibold text-primary hover:underline">
            Send a new code
          </button>
        </form>
      )}

      {stage === 'reset' && (
        <form onSubmit={reset} className="mt-8 space-y-5">
          {purpose === 'reset_password' ? (
            <>
              <div className="space-y-2">
                <Label>New password</Label>
                <PasswordInput icon={<Lock />} value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="At least 8 characters" autoComplete="new-password" />
              </div>
              <div className="space-y-2">
                <Label>Confirm password</Label>
                <PasswordInput icon={<Lock />} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
              </div>
            </>
          ) : (
            <div className="space-y-2">
              <Label>New 4-digit PIN</Label>
              <Input icon={<KeyRound />} value={secret} onChange={(e) => setSecret(e.target.value.replace(/\D/g, '').slice(0, 4))} inputMode="numeric" className="font-mono text-lg tracking-[0.5em]" />
            </div>
          )}
          <Button type="submit" variant="gradient" size="lg" className="w-full" loading={busy}>Save</Button>
        </form>
      )}
    </div>
  );
}
