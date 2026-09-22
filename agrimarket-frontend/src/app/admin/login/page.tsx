'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, Mail, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { LogoMark } from '@/components/site/logo';
import { Button, Input, Label, PasswordInput } from '@/components/ui';

function AdminLoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { login, loading, user, ready } = useAuth();
  const [identifier, setIdentifier] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const next = params.get('next');
  const destination = next && next.startsWith('/admin') && next !== '/admin/login' ? next : '/admin';

  React.useEffect(() => {
    if (ready && user) router.replace(destination);
  }, [ready, user, router, destination]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const admin = await login(identifier.trim(), password);
      toast.success(`Signed in as ${admin.fullName}`);
      router.replace(destination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-12">
      <div className="pointer-events-none absolute inset-0 opacity-[0.05] [background-image:linear-gradient(to_right,white_1px,transparent_1px),linear-gradient(to_bottom,white_1px,transparent_1px)] [background-size:48px_48px]" />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[500px] w-[700px] -translate-x-1/2 rounded-full bg-primary-600/20 blur-3xl" />

      <div className="relative w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <LogoMark className="h-14 w-14 rounded-2xl" />
          <h1 className="mt-5 font-display text-2xl font-extrabold text-white">AgriMart administration</h1>
          <p className="mt-1.5 flex items-center gap-1.5 text-sm text-slate-400">
            <ShieldCheck className="h-4 w-4 text-primary-400" /> Restricted to authorised staff
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-900/80 p-7 shadow-2xl backdrop-blur-xl">
          <form onSubmit={submit} className="space-y-5">
            <div className="space-y-2">
              <Label className="text-slate-300">Staff email or phone</Label>
              <Input
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="admin@agrimart.gh"
                icon={<Mail />}
                autoComplete="username"
                className="border-slate-700 bg-slate-950 text-white placeholder:text-slate-500"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">Password</Label>
              <PasswordInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                icon={<Lock />}
                autoComplete="current-password"
                className="border-slate-700 bg-slate-950 text-white"
                toggleClassName="text-slate-400 hover:text-white"
              />
            </div>

            {error && <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}

            <Button type="submit" variant="gradient" size="lg" className="w-full" loading={loading}>
              {!loading && <ShieldCheck />} Sign in to console
            </Button>
          </form>

          <p className="mt-6 border-t border-white/5 pt-5 text-center text-xs leading-relaxed text-slate-500">
            Every sign-in attempt is recorded in the audit log. Farmers and buyers should use the{' '}
            <Link href="/login" className="font-semibold text-primary-400 hover:underline">public sign-in</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <React.Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
      <AdminLoginForm />
    </React.Suspense>
  );
}
