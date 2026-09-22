'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, LogIn, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth';
import { Button, Input, Label, PasswordInput, Separator } from '@/components/ui';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { login, loading, user, ready } = useAuth();

  const [identifier, setIdentifier] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  const next = params.get('next');
  const destination = next && next.startsWith('/') && !next.startsWith('/admin') ? next : '/dashboard';

  React.useEffect(() => {
    if (ready && user) router.replace(destination);
  }, [ready, user, router, destination]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!identifier.trim() || !password) {
      setError('Enter your phone number or email and your password.');
      return;
    }

    try {
      const signedIn = await login(identifier.trim(), password);
      toast.success(`Welcome back, ${signedIn.fullName.split(' ')[0]}`);
      router.replace(destination);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    }
  };

  return (
    <div className="animate-fade-up">
      <h1 className="font-display text-3xl font-extrabold tracking-tight">Welcome back</h1>
      <p className="mt-2 text-muted-foreground">Sign in to manage your listings, orders and price alerts.</p>

      <form onSubmit={onSubmit} className="mt-8 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="identifier">Phone number or email</Label>
          <Input
            id="identifier"
            autoComplete="username"
            placeholder="0244 123 456"
            icon={<Phone />}
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            error={!!error}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot-password" className="text-xs font-semibold text-primary hover:underline">
              Forgot password?
            </Link>
          </div>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            placeholder="••••••••"
            icon={<Lock />}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={!!error}
          />
        </div>

        {error && (
          <p className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" variant="gradient" size="lg" className="w-full" loading={loading}>
          {!loading && <LogIn />} Sign in
        </Button>
      </form>

      <div className="my-8 flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">New here?</span>
        <Separator className="flex-1" />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Button variant="outline" asChild>
          <Link href="/register?role=farmer">Join as a farmer</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/register?role=buyer">Join as a buyer</Link>
        </Button>
      </div>

      <p className="mt-8 rounded-xl bg-muted/60 p-4 text-xs leading-relaxed text-muted-foreground">
        Registered over USSD and never set a web password? Use{' '}
        <Link href="/forgot-password" className="font-semibold text-primary hover:underline">
          password reset
        </Link>{' '}
        with your phone number — we will text you a code.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <React.Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-muted" />}>
      <LoginForm />
    </React.Suspense>
  );
}
