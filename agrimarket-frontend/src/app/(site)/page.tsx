'use client';

import * as React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  ArrowRight, BarChart3, Banknote, CheckCircle2, Globe, Handshake, LineChart,
  MessageSquare, Package, PhoneCall, Quote, Search, ShieldCheck, Smartphone,
  Sparkles, Sprout, Store, TrendingUp, Truck, Users, Wheat,
} from 'lucide-react';
import { api } from '@/lib/api';
import { cn, formatCompact, formatCurrency } from '@/lib/utils';
import { HAS_SMS_SHORTCODE, SITE } from '@/lib/constants';
import { formatPhone, telHref } from '@/lib/settings';
import { useSettings } from '@/components/settings-provider';
import { Badge, Button, Card, SectionHeading, Skeleton, SmartImage, TrendPill } from '@/components/ui';
import { Apple, Bean, Beef, Carrot, Fish, Nut, Salad, TreePine } from 'lucide-react';
import { PriceTicker } from '@/components/shared/price-ticker';
import { ChartCard } from '@/components/charts/chart-kit';
import { BarList } from '@/components/charts/bar-list';
import { UssdSimulator } from '@/components/shared/ussd-simulator';
import { ListingCard, ListingCardSkeleton } from '@/components/shared/listing-card';
import type { Category, Listing, PublicStats } from '@/lib/types';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0 },
};

/** Category icon names stored in the database, resolved to lucide components. */
const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Wheat, Bean, Carrot, Salad, Apple, TreePine, Beef, Fish, Nut,
};

interface MarketSnapshot {
  topMovers: {
    produce: { id: number; name: string; slug: string; imageUrl?: string | null };
    market: string;
    avgPrice: number;
    unit: string;
    changePercent: number;
    trend: string;
  }[];
  busiestRegions: { region: string | null; regionId: number; listings: number }[];
}

export default function HomePage() {
  const site = useSettings();
  const [stats, setStats] = React.useState<PublicStats | null>(null);
  const [listings, setListings] = React.useState<Listing[]>([]);
  const [categories, setCategories] = React.useState<Category[]>([]);
  const [loadingListings, setLoadingListings] = React.useState(true);
  const [snapshot, setSnapshot] = React.useState<MarketSnapshot | null>(null);

  React.useEffect(() => {
    api.get<PublicStats>('/stats/public').then((r) => setStats(r.data)).catch(() => {});
    api
      .get<Listing[]>('/listings/featured', { limit: 8 })
      .then((r) => setListings(r.data ?? []))
      .catch(() => {})
      .finally(() => setLoadingListings(false));
    api
      .get<Category[]>('/reference/categories', { withCounts: true })
      .then((r) => setCategories(r.data ?? []))
      .catch(() => {});
    api
      .get<MarketSnapshot>('/stats/market-snapshot')
      .then((r) => setSnapshot(r.data))
      .catch(() => {});
  }, []);

  return (
    <>
      {/* ══════════════════ Hero ══════════════════ */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 mesh-bg" />
        <div className="absolute inset-0 grid-pattern opacity-60" />
        <div className="pointer-events-none absolute -left-40 top-10 h-80 w-80 rounded-full bg-primary-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -right-32 top-40 h-96 w-96 rounded-full bg-gold-400/15 blur-3xl" />

        <div className="container-wide relative grid items-center gap-14 py-16 lg:grid-cols-[1.1fr_0.9fr] lg:py-24">
          <motion.div initial="hidden" animate="show" variants={fadeUp} transition={{ duration: 0.6 }}>
            <Badge variant="outline" className="mb-5 border-primary/30 bg-primary-50/80 py-1.5 pl-1.5 pr-3 backdrop-blur dark:bg-primary-950/60">
              <span className="mr-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold text-white">NEW</span>
              <span className="text-primary-800 dark:text-primary-200">
                Live prices from {stats?.markets ?? 29} markets across Ghana
              </span>
            </Badge>

            <h1 className="text-balance font-display text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
              Sell your harvest at the
              <span className="gradient-text"> right price</span>, from any phone.
            </h1>

            <p className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground">
              AgriMart connects Ghanaian smallholder farmers straight to buyers. List produce and
              check today&apos;s market prices by dialling{' '}
              <code className="rounded-md bg-primary-100 px-1.5 py-0.5 font-mono text-base font-bold text-primary-800 dark:bg-primary-950 dark:text-primary-200">
                {site.ussdCode}
              </code>{' '}
              — no smartphone, no data bundle, no middleman setting your price.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" variant="gradient" asChild>
                <Link href="/register?role=farmer">
                  <Sprout /> Start selling free
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link href="/marketplace">
                  <Search /> Browse produce
                </Link>
              </Button>
              <Button size="lg" variant="ghost" asChild>
                <Link href="/ussd">
                  <Smartphone /> Try the USSD demo
                </Link>
              </Button>
            </div>

            <dl className="mt-12 grid grid-cols-2 gap-6 sm:grid-cols-4">
              {[
                { label: 'Farmers', value: stats?.farmers, icon: Users },
                { label: 'Live listings', value: stats?.activeListings, icon: Package },
                { label: 'Markets tracked', value: stats?.markets, icon: Store },
                { label: 'Traded value', value: stats?.tradeValue, icon: Banknote, currency: true },
              ].map((stat, i) => (
                <motion.div
                  key={stat.label}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + i * 0.08 }}
                >
                  <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <stat.icon className="h-3.5 w-3.5 text-primary" />
                    {stat.label}
                  </dt>
                  <dd className="mt-1 whitespace-nowrap font-display text-2xl font-extrabold tracking-tight xl:text-[1.75rem]">
                    {stat.value === undefined ? (
                      <span className="inline-block h-8 w-16 animate-pulse rounded bg-muted" />
                    ) : stat.currency ? (
                      formatCurrency(stat.value, { compact: true, decimals: 0 })
                    ) : (
                      formatCompact(stat.value)
                    )}
                  </dd>
                </motion.div>
              ))}
            </dl>
          </motion.div>

          {/* Hero handset */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.15 }}
            className="relative mx-auto w-full max-w-sm"
          >
            <div className="absolute -inset-6 rounded-[3rem] bg-gradient-to-tr from-primary-500/20 via-transparent to-gold-400/20 blur-2xl" />
            <div className="relative">
              <UssdSimulator compact showLog={false} defaultPhone={site.ussdDemoPhone} />
            </div>

          </motion.div>
        </div>
      </section>

      <PriceTicker />

      {/* ══════════════════ Three channels ══════════════════ */}
      <section className="container-wide py-20 lg:py-28">
        <SectionHeading
          align="center"
          eyebrow="Built for every phone"
          title="Three ways in. One marketplace."
          description="Roughly half of Ghana's smallholders farm without a smartphone. The platform meets them where they are — so the farmer on a Nokia and the exporter in Accra trade in the same market."
        />

        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {[
            {
              icon: Smartphone,
              tag: 'No internet needed',
              title: 'USSD',
              code: site.ussdCode,
              description:
                'Dial the short code on any handset. List produce, check today’s prices, accept orders and withdraw earnings — entirely through a numbered menu.',
              points: ['Works on feature phones', 'Simple numbered menu', 'No data charges'],
              accent: 'from-primary-500 to-primary-700',
            },
            {
              icon: MessageSquare,
              tag: site.smsShortCode ? 'Two-way messaging' : 'Straight to the handset',
              title: 'SMS',
              code: site.smsShortCode ? `Text ${site.smsShortCode}` : 'Automatic alerts',
              description: site.smsShortCode
                ? 'Every order, offer and price alert arrives as a text. Reply with simple keywords to list produce or pull a price without opening a menu at all.'
                : 'Every order, offer and price alert arrives as a text message — no app, no data, nothing to check. Replies come straight to your phone.',
              points: site.smsShortCode
                ? ['PRICE MAIZE', 'SELL MAIZE 20 450', 'Daily 6:30am price digest']
                : ['Order and offer alerts', 'Daily 6:30am price digest', 'Price alerts you set yourself'],
              accent: 'from-violet-500 to-violet-700',
            },
            {
              icon: Globe,
              tag: 'Full experience',
              title: 'Web',
              code: 'agrimart.gh',
              description:
                'Buyers, aggregators and exporters get photographs, price history charts, farmer ratings and bulk ordering — the depth a trading desk needs.',
              points: ['Price trend charts', 'Verified seller badges', 'Bulk negotiation'],
              accent: 'from-blue-500 to-blue-700',
            },
          ].map((channel, i) => (
            <motion.div
              key={channel.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
            >
              <Card hover className="group relative h-full overflow-hidden p-7">
                <div
                  className={cn(
                    'absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br opacity-10 blur-2xl transition-opacity duration-500 group-hover:opacity-25',
                    channel.accent
                  )}
                />
                <div
                  className={cn(
                    'flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br text-white shadow-soft',
                    channel.accent
                  )}
                >
                  <channel.icon className="h-6 w-6" />
                </div>

                <Badge variant="secondary" size="sm" className="mt-5">
                  {channel.tag}
                </Badge>
                <h3 className="mt-3 font-display text-2xl font-bold">{channel.title}</h3>
                <p className="mt-1 font-mono text-sm font-bold text-primary-700 dark:text-primary-400">
                  {channel.code}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{channel.description}</p>

                <ul className="mt-5 space-y-2">
                  {channel.points.map((point) => (
                    <li key={point} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                      <span className="text-muted-foreground">{point}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ══════════════════ Categories ══════════════════ */}
      <section className="border-y bg-muted/30 py-20 lg:py-24">
        <div className="container-wide">
          <SectionHeading
            eyebrow="What is trading"
            title="Every crop Ghana grows"
            description="From maize and yam to cocoa, shea and tilapia — with local names so a farmer recognises the crop they actually planted."
            action={
              <Button variant="outline" asChild>
                <Link href="/marketplace">
                  All produce <ArrowRight />
                </Link>
              </Button>
            }
          />

          <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {(categories.length ? categories : Array.from({ length: 10 })).map((category, i) => {
              if (!category) {
                return <div key={i} className="h-44 animate-pulse rounded-2xl bg-muted" />;
              }
              const c = category as Category;
              return (
                <motion.div
                  key={c.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.04 }}
                >
                  <Link
                    href={`/marketplace?categoryId=${c.id}`}
                    className="group relative flex h-44 flex-col justify-end overflow-hidden rounded-2xl border bg-muted shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="absolute inset-0 transition-transform duration-500 group-hover:scale-110">
                      <SmartImage
                        src={c.imageUrl}
                        alt={c.name}
                        rounded="rounded-none"
                        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                      />
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/35 to-slate-950/5" />
                    <span
                      className="absolute left-3 top-3 flex h-9 w-9 items-center justify-center rounded-xl text-white shadow-soft ring-2 ring-white/25 transition-transform duration-300 group-hover:scale-110"
                      style={{ backgroundColor: c.color }}
                    >
                      {React.createElement(CATEGORY_ICONS[c.icon] ?? Wheat, { className: 'h-[18px] w-[18px]' })}
                    </span>
                    <div className="relative p-4 text-white">
                      <h3 className="text-sm font-bold leading-tight drop-shadow-sm">{c.name}</h3>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-white/80">
                        {c.listingCount ?? 0} listing{c.listingCount === 1 ? '' : 's'}
                        <ArrowRight className="h-3 w-3 -translate-x-1 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100" />
                      </p>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
            {categories.length > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: categories.length * 0.04 }}
              >
                <Link
                  href="/marketplace"
                  className="group flex h-44 flex-col justify-between rounded-2xl bg-gradient-to-br from-primary-600 to-primary-800 p-4 text-white shadow-soft transition-all duration-300 hover:-translate-y-1 hover:shadow-lift focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 ring-2 ring-white/25">
                    <ArrowRight className="h-[18px] w-[18px] transition-transform duration-300 group-hover:translate-x-0.5" />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold leading-tight">All produce</h3>
                    <p className="mt-0.5 text-xs text-white/80">
                      {categories.reduce((sum, c) => sum + (c.listingCount ?? 0), 0)} live listings
                    </p>
                  </div>
                </Link>
              </motion.div>
            )}
          </div>
        </div>
      </section>

      {/* ══════════════════ Featured listings ══════════════════ */}
      <section className="container-wide py-20 lg:py-24">
        <SectionHeading
          eyebrow="Fresh from the farm"
          title="Available right now"
          description="Live listings posted by verified farmers — many of them straight from a feature phone in the field."
          action={
            <Button variant="outline" asChild>
              <Link href="/marketplace">
                Browse marketplace <ArrowRight />
              </Link>
            </Button>
          }
        />

        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {loadingListings
            ? Array.from({ length: 8 }).map((_, i) => <ListingCardSkeleton key={i} />)
            : listings.map((listing) => <ListingCard key={listing.id} listing={listing} />)}
        </div>
      </section>

      {/* ══════════════════ USSD walkthrough ══════════════════ */}
      <section className="relative overflow-hidden border-y bg-field-gradient py-20 text-white lg:py-28">
        <div className="absolute inset-0 opacity-[0.07] [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:32px_32px]" />
        <div className="pointer-events-none absolute -right-20 top-0 h-96 w-96 rounded-full bg-gold-400/10 blur-3xl" />

        <div className="container-wide relative grid items-center gap-14 lg:grid-cols-2">
          <div>
            <Badge className="mb-5 border-white/20 bg-white/10 text-white backdrop-blur">
              <Sparkles /> Try it yourself
            </Badge>
            <h2 className="text-balance font-display text-3xl font-extrabold leading-tight sm:text-4xl lg:text-5xl">
              This is what a farmer in Ejura sees.
            </h2>
            <p className="mt-5 max-w-xl text-pretty text-lg leading-relaxed text-white/70">
              The handset beside this text is not a picture. It calls the same USSD engine our telecom
              gateway calls — dial the code, register, list a bag of maize and watch it appear in the
              marketplace seconds later.
            </p>

            <ol className="mt-9 space-y-5">
              {[
                { step: '1', title: 'Dial the short code', text: `${site.ussdCode} works on any network, any handset.` },
                { step: '2', title: 'Register once, free', text: 'Name, region, district and a 4-digit PIN. Under a minute.' },
                { step: '3', title: 'List or check prices', text: 'Pick a crop, enter quantity and price — with today’s market rate shown as you type.' },
                { step: '4', title: 'Get the SMS', text: 'Buyers call you directly. Every order, offer and payment arrives as a text.' },
              ].map((item) => (
                <li key={item.step} className="flex gap-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 font-display text-sm font-bold ring-1 ring-white/20">
                    {item.step}
                  </span>
                  <div>
                    <p className="font-semibold">{item.title}</p>
                    <p className="mt-0.5 text-sm text-white/60">{item.text}</p>
                  </div>
                </li>
              ))}
            </ol>

            <Button size="lg" variant="gold" className="mt-9" asChild>
              <Link href="/ussd">
                Open the full simulator <ArrowRight />
              </Link>
            </Button>
          </div>

          {/* "dark" switches this panel to the dark theme tokens so the simulator's
              labels and inputs stay legible on the green band in either site theme */}
          <div className="dark rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-foreground backdrop-blur-sm sm:p-8">
            <UssdSimulator compact showLog={false} defaultPhone={site.ussdDemoPhone} />
          </div>
        </div>
      </section>

      {/* ══════════════════ Why it matters ══════════════════ */}
      <section className="container-wide py-20 lg:py-28">
        <SectionHeading
          align="center"
          eyebrow="The problem we are solving"
          title="A farmer who knows the price is a farmer who keeps the margin"
          description="Smallholders produce most of Ghana's food but capture the smallest share of its value — largely because they sell without knowing what their harvest is worth elsewhere."
        />

        <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: LineChart,
              stat: '30–40%',
              title: 'Price spread between markets',
              text: 'The same bag of maize routinely sells for a third more in Accra than at the farmgate in Tamale. Farmers rarely see that gap before they sell.',
            },
            {
              icon: Truck,
              stat: '15–30%',
              title: 'Lost after harvest',
              text: 'Produce spoils waiting for a buyer who never comes. A listing that reaches buyers the same day is the cheapest storage there is.',
            },
            {
              icon: Handshake,
              stat: '1–2',
              title: 'Buyers most farmers know',
              text: 'When you only know one aggregator, that aggregator sets your price. Reach changes the negotiation completely.',
            },
            {
              icon: ShieldCheck,
              stat: '100%',
              title: 'Of trades recorded',
              text: 'Every order creates a dated record of what was sold, to whom, at what price — the evidence rural banks ask for before lending.',
            },
          ].map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
            >
              <Card hover className="h-full p-6">
                <item.icon className="h-7 w-7 text-primary" />
                <p className="mt-4 font-display text-3xl font-extrabold tracking-tight text-primary-700 dark:text-primary-400">
                  {item.stat}
                </p>
                <h3 className="mt-1 font-semibold leading-tight">{item.title}</h3>
                <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground">{item.text}</p>
              </Card>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ══════════════════ Market pulse (live data) ══════════════════ */}
      <section className="border-y bg-muted/30 py-20 lg:py-24">
        <div className="container-wide">
          <SectionHeading
            eyebrow="Live from the markets"
            title="This week's market pulse"
            description="Drawn from the same price records farmers receive by SMS: the biggest price moves of the last seven days, and where produce is being listed right now."
            action={
              <Button variant="outline" asChild>
                <Link href="/prices">
                  All market prices <ArrowRight />
                </Link>
              </Button>
            }
          />

          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            <Card className="overflow-hidden">
              <div className="border-b px-5 py-4">
                <h3 className="font-semibold">Biggest price moves</h3>
                <p className="text-sm text-muted-foreground">Change against the previous record at the same market.</p>
              </div>
              {!snapshot ? (
                <div className="space-y-3 p-5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12" />
                  ))}
                </div>
              ) : snapshot.topMovers.length === 0 ? (
                <p className="p-5 text-sm text-muted-foreground">No price records this week yet.</p>
              ) : (
                <ul className="divide-y">
                  {snapshot.topMovers.map((m, i) => (
                    <li key={`${m.produce?.id}-${m.market}-${i}`}>
                      <Link
                        href={`/prices?produce=${m.produce?.id}`}
                        className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-muted/50"
                      >
                        <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl">
                          <SmartImage sizes="44px" src={m.produce?.imageUrl} alt={m.produce?.name ?? 'Produce'} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold">{m.produce?.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{m.market}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold tabular-nums">
                            {formatCurrency(m.avgPrice, { decimals: 0 })}
                            <span className="text-xs font-normal text-muted-foreground">/{m.unit}</span>
                          </p>
                          <TrendPill value={m.changePercent} />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <ChartCard
              title="Where produce is listed"
              description="Live listings in the busiest regions."
              table={{
                columns: [
                  { key: 'label', label: 'Region' },
                  { key: 'value', label: 'Live listings', align: 'right' },
                ],
                rows: (snapshot?.busiestRegions ?? []).map((r) => ({ label: r.region ?? 'Unassigned', value: r.listings })),
              }}
            >
              {!snapshot ? (
                <Skeleton className="mx-3 h-48" />
              ) : (
                <BarList
                  valueLabel="live listings"
                  items={snapshot.busiestRegions.map((r) => ({ label: r.region ?? 'Unassigned', value: r.listings }))}
                />
              )}
            </ChartCard>
          </div>
        </div>
      </section>

      {/* ══════════════════ CTA ══════════════════ */}
      <section className="container-wide py-20 lg:py-28">
        <div className="relative overflow-hidden rounded-3xl bg-grain-gradient p-10 text-white shadow-lift sm:p-16">
          <div className="absolute inset-0 opacity-10 [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:28px_28px]" />
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/15 blur-3xl" />

          <div className="relative grid items-center gap-10 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <h2 className="text-balance font-display text-3xl font-extrabold leading-tight sm:text-4xl lg:text-5xl">
                Your next harvest deserves a bigger market.
              </h2>
              <p className="mt-5 max-w-xl text-pretty text-lg text-white/85">
                Registration is free, takes a minute, and works on the phone already in your pocket.
                Nothing is deducted until your produce actually sells.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button size="lg" className="bg-white text-primary-800 hover:bg-white/90" asChild>
                  <Link href="/register?role=farmer">
                    <Sprout /> I want to sell
                  </Link>
                </Button>
                <Button size="lg" className="bg-slate-900/30 text-white ring-1 ring-white/30 hover:bg-slate-900/50" asChild>
                  <Link href="/register?role=buyer">
                    <Store /> I want to buy
                  </Link>
                </Button>
              </div>
            </div>

            <div className="rounded-2xl bg-slate-950/25 p-6 ring-1 ring-white/20 backdrop-blur-sm">
              <p className="text-sm font-semibold uppercase tracking-wider text-white/70">Or simply dial</p>
              <p className="mt-2 font-mono text-3xl font-extrabold tracking-wider sm:text-4xl">{site.ussdCode}</p>
              <p className="mt-3 text-sm text-white/70">
                Works on MTN, Telecel and AirtelTigo. No internet connection required, and no charge
                to list your produce.
              </p>
              <div className="mt-5 flex items-center gap-2 border-t border-white/20 pt-5 text-sm">
                <PhoneCall className="h-4 w-4 shrink-0" />
                <span className="text-white/80">Need help? Call {formatPhone(site.supportPhone)}</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
