'use client';

import * as React from 'react';
import Link from 'next/link';
import {
  ArrowRight, CheckCircle2, ChevronRight, Globe2, KeyRound, ListOrdered, MessageSquare, Radio,
  ShieldCheck, Smartphone, WifiOff,
} from 'lucide-react';
import { api } from '@/lib/api';
import { HAS_SMS_SHORTCODE, SITE } from '@/lib/constants';
import { useSettings } from '@/components/settings-provider';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger, Badge, Button, Card, SectionHeading,
} from '@/components/ui';
import { UssdSimulator } from '@/components/shared/ussd-simulator';

interface MenuNode {
  key: string;
  label: string;
  description: string;
  steps: string[];
}

/**
 * The simulator is a sandbox: it opens the demo account and walks any other
 * number through registration without saving it. A registered account is
 * refused, so nobody can sit here guessing a farmer's PIN.
 */
const demoAccounts = (demoPhone: string) =>
  demoPhone
    ? [
        { label: 'Demo account', phone: demoPhone, note: 'PIN 1357 — produce to sell, orders to accept' },
        { label: 'Any other number', phone: '', note: 'Walks through registration, saving nothing' },
      ]
    : [
        { label: 'Type any number', phone: '', note: 'Walks through registration exactly as a farmer would' },
        { label: 'Nothing is saved', phone: '', note: 'No account is created and no SMS is sent' },
      ];

/** What a farmer can text in — only possible once the gateway gives us a short code. */
const SMS_COMMANDS = [
  { command: 'PRICE MAIZE', result: "Today's maize prices from markets near you" },
  { command: 'SELL MAIZE 20 450', result: 'Lists 20 bags of maize at GHS 450 each' },
  { command: 'BALANCE', result: 'Your wallet balance and how to withdraw' },
  { command: 'HELP', result: 'Commands and the support line' },
  { command: 'STOP / START', result: 'Opt out of, or back into, marketing SMS' },
];

/** What the platform texts out, which needs no short code. */
const SMS_ALERTS = [
  { command: 'New order', result: 'Quantity, total and the buyer’s number, the moment they order' },
  { command: 'Offer received', result: 'The price offered, so you can accept or counter on USSD' },
  { command: 'Payment', result: 'Confirmation when your wallet is credited' },
  { command: 'Daily prices', result: 'The 6:30am digest for the crops you sell' },
  { command: 'Price alert', result: 'When your crop hits the price you set' },
  { command: 'STOP', result: 'Reply STOP to any message to pause price and marketing texts' },
];

export default function UssdPage() {
  const site = useSettings();
  const [menu, setMenu] = React.useState<MenuNode[]>([]);

  React.useEffect(() => {
    api
      .get<{ serviceCode: string; tree: MenuNode[] }>('/ussd/menu')
      .then((res) => setMenu(res.data.tree))
      .catch(() => {});
  }, []);

  return (
    <>
      <section className="relative overflow-hidden border-b">
        <div className="absolute inset-0 mesh-bg" />
        <div className="absolute inset-0 grid-pattern opacity-50" />
        <div className="container-wide relative py-14 lg:py-20">
          <div className="max-w-3xl">
            <Badge variant="success" className="mb-4">
              <Radio /> Live — connected to the real USSD engine
            </Badge>
            <h1 className="text-balance font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
              The USSD service, on a phone you can press
            </h1>
            <p className="mt-5 text-pretty text-lg leading-relaxed text-muted-foreground">
              Most smallholder farmers trade from a basic handset. Dial{' '}
              <code className="rounded bg-primary-100 px-1.5 py-0.5 font-mono font-bold text-primary-800 dark:bg-primary-950 dark:text-primary-200">
                {site.ussdCode}
              </code>{' '}
              below exactly as they would. It runs the live USSD engine, screen for screen — as a safe
              demonstration: nothing here is saved and no SMS is sent.
            </p>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            {[
              { icon: WifiOff, text: 'No internet needed' },
              { icon: Smartphone, text: 'Any handset, any network' },
              { icon: ListOrdered, text: 'Simple numbered menu' },
              { icon: KeyRound, text: 'PIN-protected transactions' },
            ].map((item) => (
              <span
                key={item.text}
                className="flex items-center gap-2 rounded-full border bg-card px-4 py-2 text-sm font-medium shadow-soft"
              >
                <item.icon className="h-4 w-4 text-primary" />
                {item.text}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="container-wide py-14">
        <div className="mb-8 grid gap-4 sm:grid-cols-2">
          {demoAccounts(site.ussdDemoPhone).map((account) => (
            <Card key={account.label} className="flex items-center gap-4 p-4">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700 dark:bg-primary-950/60 dark:text-primary-300">
                <Smartphone className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="font-semibold">{account.label}</p>
                <p className="text-sm text-muted-foreground">
                  {account.phone ? (
                    <code className="font-mono font-bold text-foreground">{account.phone}</code>
                  ) : null}{' '}
                  {account.note}
                </p>
              </div>
            </Card>
          ))}
        </div>

        <UssdSimulator defaultPhone={site.ussdDemoPhone} />
      </section>

      <section className="border-y bg-muted/30 py-16 lg:py-20">
        <div className="container-wide grid gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading
              eyebrow="Menu map"
              title="Everything a farmer can do"
              description="Seven numbered options cover the full trading cycle. Long lists page with 99 for next and 98 for previous; 0 always goes back."
            />

            <Accordion type="single" collapsible defaultValue="1" className="mt-8 rounded-2xl border bg-card px-5 shadow-soft">
              {menu.map((node) => (
                <AccordionItem key={node.key} value={node.key} className="last:border-0">
                  <AccordionTrigger>
                    <span className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-mono text-sm font-bold text-white">
                        {node.key}
                      </span>
                      <span>
                        <span className="block font-semibold">{node.label}</span>
                        <span className="block text-xs font-normal text-muted-foreground">{node.description}</span>
                      </span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    <ol className="flex flex-wrap items-center gap-1.5 pl-11">
                      {node.steps.map((step, i) => (
                        <li key={step} className="flex items-center gap-1.5">
                          <span className="rounded-lg bg-muted px-2.5 py-1 text-xs font-medium text-foreground">{step}</span>
                          {i < node.steps.length - 1 && <ChevronRight className="h-3.5 w-3.5" />}
                        </li>
                      ))}
                    </ol>
                  </AccordionContent>
                </AccordionItem>
              ))}
              {!menu.length &&
                Array.from({ length: 7 }).map((_, i) => <div key={i} className="my-4 h-10 animate-pulse rounded-lg bg-muted" />)}
            </Accordion>
          </div>

          <div>
            <SectionHeading
              eyebrow={site.smsShortCode ? 'SMS keywords' : 'SMS alerts'}
              title={site.smsShortCode ? 'Or just send a text' : 'Everything important also arrives by text'}
              description={site.smsShortCode
                ? `When a USSD session drops on a weak signal, farmers can text the same actions to ${site.smsShortCode}.`
                : 'Orders, offers, payments and the daily price digest reach the farmer as plain text messages, so nothing is missed between USSD sessions.'}
            />

            <Card className="mt-8 overflow-hidden">
              <div className="flex items-center gap-2 border-b bg-muted/50 px-5 py-3">
                <MessageSquare className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">
                  {site.smsShortCode ? `Send to ${site.smsShortCode}` : 'What the platform texts you'}
                </span>
              </div>
              <ul className="divide-y">
                {(site.smsShortCode ? SMS_COMMANDS : SMS_ALERTS).map((item) => (
                  <li key={item.command} className="flex flex-col gap-1 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                    <code className="font-mono text-sm font-bold text-primary-700 dark:text-primary-400">{item.command}</code>
                    <span className="text-sm text-muted-foreground">{item.result}</span>
                  </li>
                ))}
              </ul>
            </Card>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {[
                {
                  icon: ShieldCheck,
                  title: 'PIN on every transaction',
                  text: 'Selling, ordering and withdrawals ask for the 4-digit PIN. Three wrong attempts end the session.',
                },
                {
                  icon: Globe2,
                  title: 'One account, every channel',
                  text: 'Your phone number is your identity — register over USSD, sign in on the web later with the same account.',
                },
              ].map((item) => (
                <Card key={item.title} className="p-5">
                  <item.icon className="h-6 w-6 text-primary" />
                  <p className="mt-3 font-semibold">{item.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.text}</p>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="container-wide py-16">
        <Card className="flex flex-col items-start justify-between gap-6 bg-gradient-to-r from-primary-50 to-gold-50 p-8 dark:from-primary-950/40 dark:to-gold-900/10 md:flex-row md:items-center">
          <div>
            <h2 className="font-display text-2xl font-bold">Prefer the full website?</h2>
            <p className="mt-1 text-muted-foreground">
              Photographs, price charts and bulk negotiation — the same account you just used on USSD.
            </p>
            <ul className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
              {['Price history charts', 'Farmer ratings', 'Order tracking'].map((f) => (
                <li key={f} className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-primary" /> {f}
                </li>
              ))}
            </ul>
          </div>
          <Button size="lg" variant="gradient" asChild>
            <Link href="/register">
              Create a web account <ArrowRight />
            </Link>
          </Button>
        </Card>
      </section>
    </>
  );
}
