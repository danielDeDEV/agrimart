import Link from 'next/link';
import { ArrowLeft, Search, Smartphone, TrendingUp } from 'lucide-react';
import { LogoMark } from '@/components/site/logo';
import { SITE } from '@/lib/constants';
import { getSettings } from '@/lib/settings.server';

export default async function NotFound() {
  const site = await getSettings();
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4">
      <div className="absolute inset-0 mesh-bg" />
      <div className="absolute inset-0 grid-pattern opacity-50" />
      <div className="relative max-w-lg text-center">
        <LogoMark className="mx-auto h-14 w-14 rounded-2xl" />
        <p className="mt-8 font-display text-8xl font-extrabold tracking-tight text-primary/20">404</p>
        <h1 className="mt-2 font-display text-3xl font-extrabold tracking-tight">This field is empty</h1>
        <p className="mt-3 text-muted-foreground">
          The page you were looking for has moved, sold out, or never existed. Try one of these instead.
        </p>
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          {[
            { href: '/marketplace', label: 'Marketplace', icon: Search },
            { href: '/prices', label: 'Market prices', icon: TrendingUp },
            { href: '/ussd', label: 'USSD demo', icon: Smartphone },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-2 rounded-2xl border bg-card p-4 text-sm font-semibold shadow-soft transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lift"
            >
              <item.icon className="h-5 w-5 text-primary" />
              {item.label}
            </Link>
          ))}
        </div>
        <Link href="/" className="mt-8 inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> Back to home
        </Link>
        <p className="mt-6 text-xs text-muted-foreground">No internet? Dial {site.ussdCode} on any phone.</p>
      </div>
    </div>
  );
}
