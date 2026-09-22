import Link from 'next/link';
import { Facebook, Mail, MapPin, MessageSquare, Phone, Smartphone, Twitter } from 'lucide-react';
import { Logo } from './logo';
import { getSettings } from '@/lib/settings.server';
import { formatPhone } from '@/lib/settings';

const COLUMNS = [
  {
    title: 'Marketplace',
    links: [
      { href: '/marketplace', label: 'Browse produce' },
      { href: '/marketplace?sort=price_low', label: 'Best prices' },
      { href: '/prices', label: 'Market prices' },
      { href: '/register?role=farmer', label: 'Sell your harvest' },
      { href: '/register?role=buyer', label: 'Buy in bulk' },
    ],
  },
  {
    title: 'Channels',
    links: [
      { href: '/ussd', label: 'USSD service' },
      { href: '/how-it-works', label: 'How it works' },
      { href: '/tips', label: 'Farm guides' },
      { href: '/about', label: 'About the project' },
    ],
  },
  {
    title: 'Support',
    links: [
      { href: '/contact', label: 'Contact us' },
      { href: '/faq', label: 'Frequently asked questions' },
      { href: '/contact#report', label: 'Report a problem' },
      { href: '/privacy', label: 'Privacy policy' },
      { href: '/terms', label: 'Terms of use' },
      { href: '/credits', label: 'Photo credits' },
    ],
  },
];

export async function Footer() {
  const site = await getSettings();

  return (
    <footer className="relative mt-24 overflow-hidden border-t bg-gradient-to-b from-background to-muted/40">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

      {/* Channel strip — the three ways to reach the platform */}
      <div className="container-wide grid gap-4 border-b py-10 sm:grid-cols-3">
        {[
          {
            icon: Smartphone,
            title: 'USSD',
            value: site.ussdCode,
            hint: 'Any phone, no internet, no data cost',
          },
          {
            icon: MessageSquare,
            title: 'SMS',
            value: site.smsShortCode ? `Text to ${site.smsShortCode}` : 'Alerts by text message',
            hint: site.smsShortCode
              ? 'PRICE MAIZE · SELL MAIZE 20 450 · HELP'
              : 'Orders · offers · payments · daily prices',
          },
          {
            icon: Phone,
            title: 'Call us',
            value: formatPhone(site.supportPhone),
            hint: 'Monday to Saturday, 7am – 7pm',
          },
        ].map((item) => (
          <div
            key={item.title}
            className="group flex items-start gap-4 rounded-2xl border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-soft"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700 transition-colors group-hover:bg-primary group-hover:text-white dark:bg-primary-950/60 dark:text-primary-300">
              <item.icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{item.title}</p>
              <p className="mt-0.5 font-mono text-base font-bold tracking-tight">{item.value}</p>
              <p className="mt-1 text-xs text-muted-foreground">{item.hint}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="container-wide grid gap-10 py-12 lg:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="max-w-sm">
          <Logo />
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            AgriMart connects smallholder farmers across Ghana directly to buyers — over USSD, SMS
            and the web — so a farmer without a smartphone still knows what their harvest is worth.
          </p>
          <div className="mt-5 space-y-2 text-sm text-muted-foreground">
            <p className="flex items-center gap-2">
              <MapPin className="h-4 w-4 shrink-0 text-primary" /> {site.address}
            </p>
            <p className="flex items-center gap-2">
              <Mail className="h-4 w-4 shrink-0 text-primary" />
              <a href={`mailto:${site.supportEmail}`} className="hover:text-foreground hover:underline">
                {site.supportEmail}
              </a>
            </p>
          </div>
          <div className="mt-5 flex gap-2">
            {[
              { icon: Facebook, label: 'Facebook' },
              { icon: Twitter, label: 'X' },
            ].map((social) => (
              <span
                key={social.label}
                className="flex h-9 w-9 items-center justify-center rounded-lg border bg-card text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                aria-label={social.label}
              >
                <social.icon className="h-4 w-4" />
              </span>
            ))}
          </div>
        </div>

        {COLUMNS.map((column) => (
          <div key={column.title}>
            <h3 className="text-sm font-bold uppercase tracking-wider">{column.title}</h3>
            <ul className="mt-4 space-y-2.5">
              {column.links.map((link) => (
                <li key={link.href + link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-primary"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t">
        <div className="container-wide flex flex-col items-center justify-between gap-3 py-5 text-xs text-muted-foreground sm:flex-row">
          <p>
            © {new Date().getFullYear()} {site.name}. Built for Ghanaian smallholder farmers.
          </p>
          <p className="flex items-center gap-1.5">
            Market price data sourced from field agents and
            <span className="font-semibold text-foreground">MoFA</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
