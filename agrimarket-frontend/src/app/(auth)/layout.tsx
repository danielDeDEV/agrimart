import Link from 'next/link';
import { CheckCircle2, Smartphone } from 'lucide-react';
import { AuthProvider } from '@/lib/auth';
import { Logo } from '@/components/site/logo';
import { ThemeToggle } from '@/components/site/theme-toggle';
import { SITE } from '@/lib/constants';
import { getSettings } from '@/lib/settings.server';

/**
 * Split-screen shell for sign-in and registration. Uses the public "user" realm;
 * administrators sign in separately at /admin/login.
 */
export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const site = await getSettings();
  return (
    <AuthProvider realm="user">
      <div className="grid min-h-screen lg:grid-cols-[1fr_1.05fr]">
        {/* Brand panel */}
        <aside className="relative hidden overflow-hidden bg-field-gradient p-12 text-white lg:flex lg:flex-col">
          <div className="absolute inset-0 opacity-[0.07] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:30px_30px]" />
          <div className="pointer-events-none absolute -right-24 top-1/3 h-96 w-96 rounded-full bg-gold-400/15 blur-3xl" />
          <div className="pointer-events-none absolute -left-24 bottom-0 h-80 w-80 rounded-full bg-primary-400/20 blur-3xl" />

          <div className="relative">
            <Logo variant="light" />
          </div>

          <div className="relative mt-auto max-w-md">
            <h2 className="font-display text-4xl font-extrabold leading-tight">
              Know the price.
              <br />
              <span className="text-gold-300">Keep the margin.</span>
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-white/70">
              Join thousands of Ghanaian farmers and buyers trading directly — over the web, SMS, or a
              simple USSD code.
            </p>

            <ul className="mt-8 space-y-3">
              {[
                'Free to register, no listing fees',
                'Live prices from markets nationwide',
                'SMS alerts for every order and offer',
                'Payouts straight to mobile money',
              ].map((point) => (
                <li key={point} className="flex items-center gap-3 text-white/85">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-gold-300" />
                  {point}
                </li>
              ))}
            </ul>

            <div className="mt-10 flex items-center gap-4 rounded-2xl bg-white/[0.06] p-5 ring-1 ring-white/15 backdrop-blur-sm">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gold-400/20 text-gold-300">
                <Smartphone className="h-6 w-6" />
              </span>
              <div>
                <p className="text-sm text-white/60">No smartphone? Register by dialling</p>
                <p className="font-mono text-2xl font-extrabold tracking-wider">{site.ussdCode}</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Form panel */}
        <main className="relative flex flex-col">
          <div className="absolute inset-0 mesh-bg opacity-60 lg:hidden" />
          <div className="relative flex items-center justify-between p-5 sm:p-8">
            <div className="lg:hidden">
              <Logo />
            </div>
            <Link href="/" className="hidden text-sm font-medium text-muted-foreground hover:text-foreground lg:inline">
              ← Back to website
            </Link>
            <ThemeToggle />
          </div>
          <div className="relative flex flex-1 items-center justify-center px-5 pb-12 sm:px-8">
            <div className="w-full max-w-md">{children}</div>
          </div>
        </main>
      </div>
    </AuthProvider>
  );
}
