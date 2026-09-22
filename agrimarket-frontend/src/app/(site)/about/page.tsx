import Link from 'next/link';
import type { Metadata } from 'next';
import {
  ArrowRight, BarChart3, Database, MessageSquare, Radio, Smartphone, Target, TrendingUp, Users,
} from 'lucide-react';
import { SITE } from '@/lib/constants';
import { getSettings } from '@/lib/settings.server';
import { Badge, Button, Card, SectionHeading } from '@/components/ui';

export const metadata: Metadata = {
  title: 'About the project',
  description:
    'AgriMart Ghana: an integrated USSD/SMS web-based platform built to improve market access for smallholder farmers.',
};

const OBJECTIVES = [
  {
    icon: Smartphone,
    title: 'USSD interface for offline farmers',
    text: 'A USSD service that lets farmers register, list produce and reach market services with no internet connection, on any handset.',
    delivered: 'Full menu tree: registration, selling, prices, listings, buying, orders, account and help — through a numbered menu, PIN-protected.',
  },
  {
    icon: MessageSquare,
    title: 'SMS communication between farmers and buyers',
    text: 'An SMS notification system so farmers and buyers hear about orders, offers and payments the moment they happen.',
    delivered: 'Transactional alerts, keyword commands (PRICE, SELL, BALANCE), broadcasts, reminders and delivery tracking across four gateway providers.',
  },
  {
    icon: TrendingUp,
    title: 'Real-time market price information',
    text: 'Public, current price data from physical markets to reduce information asymmetry and improve selling decisions.',
    delivered: 'Price board across 29 markets, trend history, market comparison, price alerts and a 06:30 daily SMS digest.',
  },
  {
    icon: Database,
    title: 'A backend that manages transactions efficiently',
    text: 'A system that manages users, listings, orders, payments and every channel interaction reliably.',
    delivered: 'Transactional order handling, wallet ledger, audit trail, scheduled jobs, realtime sockets and an administration console.',
  },
  {
    icon: BarChart3,
    title: 'Evaluating effect on participation and income',
    text: 'Measure whether the platform actually increases market participation and income for smallholder farmers.',
    delivered: 'Impact analytics comparing baseline and endline surveys with live platform data: participation rates, income change and channel reach.',
  },
];

export default async function AboutPage() {
  const site = await getSettings();
  return (
    <>
      <section className="relative overflow-hidden border-b">
        <div className="absolute inset-0 mesh-bg" />
        <div className="container-wide relative grid gap-12 py-16 lg:grid-cols-[1.3fr_1fr] lg:py-24">
          <div>
            <Badge variant="success" className="mb-4">About the project</Badge>
            <h1 className="text-balance font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
              Development of an integrated USSD/SMS web-based platform for smallholder farmers in Ghana
            </h1>
            <p className="mt-6 text-pretty text-lg leading-relaxed text-muted-foreground">
              Smallholder farmers grow most of Ghana&apos;s food, yet they sell with the least information in
              the chain. Buyers know prices across markets; farmers usually know one price — the one the
              buyer standing in front of them offers. AgriMart was built to close that gap on the phones
              farmers already own.
            </p>
            <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">
              Research on market information systems consistently finds that better access to prices and
              communication technology increases farmers&apos; participation in markets and the income they
              earn from them. This platform puts that finding into practice and measures the result.
            </p>
          </div>

          <Card className="self-center p-7">
            <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Design principles</p>
            <ul className="mt-5 space-y-5">
              {[
                { icon: Radio, title: 'Offline first', text: 'Every core action works over USSD. The web adds depth, never exclusivity.' },
                { icon: Users, title: 'One identity', text: 'A phone number is the account on every channel, so no farmer is split in two.' },
                { icon: Target, title: 'Measured, not assumed', text: 'Impact is evaluated against baseline surveys, not declared.' },
              ].map((item) => (
                <li key={item.title} className="flex gap-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700 dark:bg-primary-950/60 dark:text-primary-300">
                    <item.icon className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-semibold">{item.title}</p>
                    <p className="text-sm text-muted-foreground">{item.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </section>

      <section className="container-wide py-20">
        <SectionHeading
          eyebrow="Study objectives"
          title="Five objectives, each built into the platform"
          description="Every objective of the study maps to a working part of the system you can use today."
        />
        <div className="mt-12 space-y-4">
          {OBJECTIVES.map((objective, i) => (
            <Card key={objective.title} hover className="grid gap-5 p-6 md:grid-cols-[auto_1fr_1fr] md:items-start">
              <div className="flex items-center gap-4 md:flex-col md:items-start">
                <span className="font-display text-4xl font-extrabold text-primary/25">{i + 1}</span>
                <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-white">
                  <objective.icon className="h-5 w-5" />
                </span>
              </div>
              <div>
                <h3 className="text-lg font-semibold">{objective.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{objective.text}</p>
              </div>
              <div className="rounded-xl bg-primary-50/70 p-4 dark:bg-primary-950/40">
                <p className="text-xs font-bold uppercase tracking-wider text-primary-700 dark:text-primary-300">What was built</p>
                <p className="mt-1.5 text-sm leading-relaxed">{objective.delivered}</p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      <section className="container-wide pb-8">
        <Card className="flex flex-col items-start justify-between gap-6 p-8 md:flex-row md:items-center">
          <div>
            <h2 className="font-display text-2xl font-bold">See it working</h2>
            <p className="mt-1 text-muted-foreground">
              Dial {site.ussdCode} in the simulator, or browse live produce in the marketplace.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" asChild><Link href="/ussd">USSD simulator</Link></Button>
            <Button variant="gradient" asChild><Link href="/marketplace">Marketplace <ArrowRight /></Link></Button>
          </div>
        </Card>
      </section>
    </>
  );
}
