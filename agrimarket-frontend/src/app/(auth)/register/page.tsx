'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, Building2, Check, KeyRound, Lock, Mail, MapPin, Phone, Sprout, Store, User,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import { cn, isValidGhanaPhone } from '@/lib/utils';
import { BUSINESS_TYPES } from '@/lib/constants';
import { useSettings } from '@/components/settings-provider';
import { formatPhone, telHref } from '@/lib/settings';
import {
  Button, Input, Label, PasswordInput, Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui';
import type { District, Region } from '@/lib/types';

type Role = 'farmer' | 'buyer';

const STEPS = ['Account type', 'Your details', 'Location', 'Security'];

function RegisterForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { register, loading, user, ready } = useAuth();

  const [step, setStep] = React.useState(0);
  const [role, setRole] = React.useState<Role>((params.get('role') as Role) === 'buyer' ? 'buyer' : 'farmer');
  const [form, setForm] = React.useState({
    fullName: '',
    phone: '',
    email: '',
    businessName: '',
    businessType: '',
    regionId: '',
    districtId: '',
    community: '',
    password: '',
    confirmPassword: '',
    pin: '',
  });
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [regions, setRegions] = React.useState<Region[]>([]);
  const [districts, setDistricts] = React.useState<District[]>([]);

  React.useEffect(() => {
    if (ready && user) router.replace('/dashboard');
  }, [ready, user, router]);

  React.useEffect(() => {
    api.get<Region[]>('/reference/regions').then((r) => setRegions(r.data)).catch(() => {});
  }, []);

  React.useEffect(() => {
    if (!form.regionId) {
      setDistricts([]);
      return;
    }
    api
      .get<District[]>('/reference/districts', { regionId: form.regionId })
      .then((r) => setDistricts(r.data))
      .catch(() => {});
  }, [form.regionId]);

  const set = (key: keyof typeof form, value: string) => {
    setForm((f) => ({ ...f, [key]: value, ...(key === 'regionId' ? { districtId: '' } : {}) }));
    setErrors((e) => ({ ...e, [key]: '' }));
  };

  const validate = (target: number) => {
    const next: Record<string, string> = {};
    if (target === 1) {
      if (form.fullName.trim().length < 3) next.fullName = 'Enter your full name';
      if (!isValidGhanaPhone(form.phone)) next.phone = 'Enter a valid Ghana number, e.g. 0244123456';
      if (form.email && !/^\S+@\S+\.\S+$/.test(form.email)) next.email = 'Enter a valid email address';
      if (role === 'buyer' && !form.businessType) next.businessType = 'Choose your business type';
    }
    if (target === 2) {
      if (!form.regionId) next.regionId = 'Choose your region';
    }
    if (target === 3) {
      if (form.password.length < 8) next.password = 'Use at least 8 characters';
      if (form.password !== form.confirmPassword) next.confirmPassword = 'Passwords do not match';
      if (form.pin && !/^\d{4}$/.test(form.pin)) next.pin = 'Your PIN must be exactly 4 digits';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const goNext = () => {
    if (!validate(step)) return;
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step < STEPS.length - 1) {
      goNext();
      return;
    }
    if (!validate(3)) return;

    try {
      const created = await register({
        role,
        fullName: form.fullName.trim(),
        phone: form.phone,
        email: form.email || undefined,
        password: form.password,
        pin: form.pin || undefined,
        regionId: form.regionId ? Number(form.regionId) : undefined,
        districtId: form.districtId ? Number(form.districtId) : undefined,
        community: form.community || undefined,
        businessName: form.businessName || undefined,
        businessType: form.businessType || undefined,
      });
      toast.success(`Welcome to AgriMart, ${created.fullName.split(' ')[0]}!`, {
        description: 'A welcome SMS is on its way to your phone.',
      });
      router.replace(role === 'farmer' ? '/dashboard/listings/new' : '/marketplace');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Registration failed');
    }
  };

  return (
    <div className="animate-fade-up">
      <h1 className="font-display text-3xl font-extrabold tracking-tight">Create your account</h1>
      <p className="mt-2 text-muted-foreground">Free forever. It takes about a minute.</p>

      {/* progress */}
      <div className="mt-7 flex items-center gap-2">
        {STEPS.map((label, i) => (
          <div key={label} className="flex flex-1 flex-col gap-1.5">
            <div className={cn('h-1.5 rounded-full transition-colors duration-300', i <= step ? 'bg-primary' : 'bg-muted')} />
            <span
              className={cn(
                'hidden text-[11px] font-semibold sm:block',
                i === step ? 'text-foreground' : 'text-muted-foreground'
              )}
            >
              {label}
            </span>
          </div>
        ))}
      </div>

      <form onSubmit={onSubmit} className="mt-8">
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.2 }}
            className="space-y-5"
          >
            {step === 0 && (
              <div className="grid gap-4">
                {([
                  {
                    value: 'farmer',
                    icon: Sprout,
                    title: 'I am a farmer',
                    text: 'List produce, receive orders and see what markets are paying.',
                  },
                  {
                    value: 'buyer',
                    icon: Store,
                    title: 'I am a buyer',
                    text: 'Source directly from farms — aggregators, traders, processors, exporters.',
                  },
                ] as const).map((option) => (
                  <button
                    type="button"
                    key={option.value}
                    onClick={() => setRole(option.value)}
                    className={cn(
                      'group relative flex items-start gap-4 rounded-2xl border-2 p-5 text-left transition-all',
                      role === option.value
                        ? 'border-primary bg-primary-50/70 shadow-glow dark:bg-primary-950/40'
                        : 'border-border hover:border-primary/40 hover:bg-muted/50'
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-colors',
                        role === option.value ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
                      )}
                    >
                      <option.icon className="h-6 w-6" />
                    </span>
                    <span>
                      <span className="block font-semibold">{option.title}</span>
                      <span className="mt-1 block text-sm text-muted-foreground">{option.text}</span>
                    </span>
                    {role === option.value && (
                      <span className="absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}

            {step === 1 && (
              <>
                <Field label="Full name" error={errors.fullName} required>
                  <Input
                    icon={<User />}
                    placeholder="Kwame Mensah"
                    value={form.fullName}
                    onChange={(e) => set('fullName', e.target.value)}
                    error={!!errors.fullName}
                    autoComplete="name"
                  />
                </Field>
                <Field
                  label="Phone number"
                  error={errors.phone}
                  hint="This is your login and where we send order alerts."
                  required
                >
                  <Input
                    icon={<Phone />}
                    placeholder="0244 123 456"
                    inputMode="tel"
                    value={form.phone}
                    onChange={(e) => set('phone', e.target.value)}
                    error={!!errors.phone}
                    autoComplete="tel"
                  />
                </Field>
                <Field label="Email (optional)" error={errors.email}>
                  <Input
                    icon={<Mail />}
                    type="email"
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={(e) => set('email', e.target.value)}
                    error={!!errors.email}
                    autoComplete="email"
                  />
                </Field>
                {role === 'buyer' && (
                  <>
                    <Field label="Business name">
                      <Input
                        icon={<Building2 />}
                        placeholder="Golden Harvest Trading"
                        value={form.businessName}
                        onChange={(e) => set('businessName', e.target.value)}
                      />
                    </Field>
                    <Field label="Business type" error={errors.businessType} required>
                      <Select value={form.businessType} onValueChange={(v) => set('businessType', v)}>
                        <SelectTrigger className={cn(errors.businessType && 'border-destructive')}>
                          <SelectValue placeholder="Choose one" />
                        </SelectTrigger>
                        <SelectContent>
                          {BUSINESS_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </Field>
                  </>
                )}
              </>
            )}

            {step === 2 && (
              <>
                <Field label="Region" error={errors.regionId} required>
                  <Select value={form.regionId} onValueChange={(v) => set('regionId', v)}>
                    <SelectTrigger className={cn(errors.regionId && 'border-destructive')}>
                      <SelectValue placeholder="Choose your region" />
                    </SelectTrigger>
                    <SelectContent>
                      {regions.map((r) => (
                        <SelectItem key={r.id} value={String(r.id)}>
                          {r.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="District">
                  <Select
                    value={form.districtId}
                    onValueChange={(v) => set('districtId', v)}
                    disabled={!districts.length}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={form.regionId ? 'Choose your district' : 'Choose a region first'} />
                    </SelectTrigger>
                    <SelectContent>
                      {districts.map((d) => (
                        <SelectItem key={d.id} value={String(d.id)}>
                          {d.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Town or community" hint="Helps nearby buyers find you.">
                  <Input
                    icon={<MapPin />}
                    placeholder="Ejura"
                    value={form.community}
                    onChange={(e) => set('community', e.target.value)}
                  />
                </Field>
              </>
            )}

            {step === 3 && (
              <>
                <Field label="Password" error={errors.password} required>
                  <PasswordInput
                    icon={<Lock />}
                    placeholder="At least 8 characters"
                    value={form.password}
                    onChange={(e) => set('password', e.target.value)}
                    error={!!errors.password}
                    autoComplete="new-password"
                  />
                </Field>
                <Field label="Confirm password" error={errors.confirmPassword} required>
                  <PasswordInput
                    icon={<Lock />}
                    placeholder="Type it again"
                    value={form.confirmPassword}
                    onChange={(e) => set('confirmPassword', e.target.value)}
                    error={!!errors.confirmPassword}
                    autoComplete="new-password"
                  />
                </Field>
                <Field
                  label="USSD PIN (optional)"
                  error={errors.pin}
                  hint="A 4-digit PIN lets you use this same account by dialling the USSD code."
                >
                  <Input
                    icon={<KeyRound />}
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="4 digits"
                    value={form.pin}
                    onChange={(e) => set('pin', e.target.value.replace(/\D/g, ''))}
                    error={!!errors.pin}
                    className="font-mono tracking-[0.4em]"
                  />
                </Field>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  By creating an account you agree to our{' '}
                  <Link href="/terms" className="font-semibold text-primary hover:underline">
                    Terms
                  </Link>{' '}
                  and{' '}
                  <Link href="/privacy" className="font-semibold text-primary hover:underline">
                    Privacy Policy
                  </Link>
                  .
                </p>
              </>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="mt-8 flex gap-3">
          {step > 0 && (
            <Button type="button" variant="outline" size="lg" onClick={() => setStep((s) => s - 1)}>
              <ArrowLeft /> Back
            </Button>
          )}
          <Button type="submit" variant="gradient" size="lg" className="flex-1" loading={loading}>
            {step < STEPS.length - 1 ? (
              <>
                Continue <ArrowRight />
              </>
            ) : (
              'Create account'
            )}
          </Button>
        </div>
      </form>

      <p className="mt-8 text-center text-sm text-muted-foreground">
        Already registered?{' '}
        <Link href="/login" className="font-semibold text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

function Field({
  label,
  error,
  hint,
  required,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label required={required}>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs font-medium text-destructive">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/** Shown when an administrator has paused new sign-ups. */
function RegistrationClosed() {
  const site = useSettings();
  return (
    <div className="rounded-2xl border bg-card p-8 text-center shadow-soft">
      <h1 className="font-display text-2xl font-bold">Sign-ups are paused</h1>
      <p className="mt-3 text-muted-foreground">
        We are not accepting new accounts right now. Please check back soon, or call{' '}
        <a href={telHref(site.supportPhone)} className="font-semibold text-primary hover:underline">
          {formatPhone(site.supportPhone)}
        </a>{' '}
        if you need help.
      </p>
      <p className="mt-4 text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-primary hover:underline">Sign in</Link>
      </p>
    </div>
  );
}

function RegisterGate() {
  const site = useSettings();
  return site.registrationOpen ? <RegisterForm /> : <RegistrationClosed />;
}

export default function RegisterPage() {
  return (
    <React.Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-muted" />}>
      <RegisterGate />
    </React.Suspense>
  );
}
