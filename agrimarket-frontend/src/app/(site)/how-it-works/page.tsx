import Link from 'next/link';
import type { Metadata } from 'next';
import {
  ArrowRight, BadgeCheck, Banknote, Bell, CheckCircle2, ClipboardList, HandCoins, LineChart,
  MessageSquare, PackageCheck, Phone, Search, ShoppingCart, Smartphone, Sprout, Store, Truck, UserPlus,
} from 'lucide-react';
import { getSettings } from '@/lib/settings.server';
import { formatPhone, telHref, type SiteSettings } from '@/lib/settings';
import { Badge, Button, Card, SectionHeading } from '@/components/ui';

export const metadata: Metadata = {
  title: 'How it works',
  description: 'How farmers and buyers trade on AgriMart Ghana over USSD, SMS and the web.',
};

const farmerSteps = (site: SiteSettings) => [
  { icon: UserPlus, title: 'Register in a minute', text: `Dial ${site.ussdCode}, or sign up on this website. Name, region, district and a 4-digit PIN — that is all.` },
  { icon: LineChart, title: 'Check what markets pay', text: 'See today’s wholesale price in Techiman, Kumasi, Tamale and Accra before you decide where and when to sell.' },
  { icon: ClipboardList, title: 'List your produce', text: 'Pick the crop, enter quantity, unit and price. The current market rate is shown on screen as you type your price.' },
  { icon: Bell, title: 'Buyers contact you', text: 'Your listing is visible nationwide immediately. Every order and offer arrives as an SMS within seconds.' },
  { icon: HandCoins, title: 'Accept, decline or negotiate', text: 'Respond from the USSD menu or your dashboard. Counter an offer if the price is not right.' },
  { icon: Banknote, title: 'Get paid to MoMo', text: 'Completed sales credit your AgriMart wallet. Withdraw to MTN MoMo, Telecel Cash or AirtelTigo Money.' },
];

const BUYER_STEPS = [
  { icon: Search, title: 'Search by crop and region', text: 'Filter live listings by produce, grade, region, price and quantity. Sort cheapest first.' },
  { icon: BadgeCheck, title: 'Check the farmer', text: 'Ratings from previous buyers, verified-seller badges and completed trade counts on every profile.' },
  { icon: ShoppingCart, title: 'Order or make an offer', text: 'Buy at the listed price or propose your own. The farmer is alerted by SMS instantly.' },
  { icon: Truck, title: 'Arrange collection', text: 'Collect yourself, send a transporter, or agree delivery. The farmer’s number unlocks once you trade.' },
  { icon: PackageCheck, title: 'Confirm receipt', text: 'Mark the order complete once the goods are in hand. That releases payment and lets you rate the farmer.' },
];

const LIFECYCLE = [
  { status: 'Pending', text: 'Buyer placed the order; farmer notified by SMS' },
  { status: 'Accepted', text: 'Farmer confirmed stock and price' },
  { status: 'In transit', text: 'Goods collected or on the way' },
  { status: 'Delivered', text: 'Goods handed over to the buyer' },
  { status: 'Completed', text: 'Buyer confirmed; farmer’s wallet credited' },
];

export default async function HowItWorksPage() {
  const site = await getSettings();
  const FARMER_STEPS = farmerSteps(site);
  return (
    <>
      <section className="relative overflow-hidden border-b">
        <div className="absolute inset-0 mesh-bg" />
        <div className="absolute inset-0 grid-pattern opacity-50" />
        <div className="container-wide relative py-16 text-center lg:py-24">
          <Badge variant="success" className="mb-4">From dialling to delivery</Badge>
          <h1 className="mx-auto max-w-3xl text-balance font-display text-4xl font-extrabold tracking-tight sm:text-5xl">
            How a harvest finds its buyer on AgriMart
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground">
            The whole trading cycle runs over three channels that share one account. A farmer can list
            from a feature phone in the field while a buyer in Accra orders from a laptop — and both see the
            same order, updated in real time.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button size="lg" variant="gradient" asChild>
              <Link href="/ussd"><Smartphone /> Try the USSD service</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/register">Create an account <ArrowRight /></Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Farmers */}
      <section className="container-wide py-20">
        <SectionHeading
          eyebrow="For farmers"
          title={<span className="flex items-center gap-3"><Sprout className="h-8 w-8 text-primary" /> Selling your produce</span>}
          description="Everything below works from the USSD menu. The website gives you the same controls plus charts and photos."
        />
        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {FARMER_STEPS.map((step, i) => (
            <Card key={step.title} hover className="relative overflow-hidden p-6">
              <span className="absolute right-5 top-4 font-display text-5xl font-extrabold text-muted/80 dark:text-muted">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 text-white shadow-soft">
                <step.icon className="h-5 w-5" />
              </span>
              <h3 className="relative mt-5 text-lg font-semibold">{step.title}</h3>
              <p className="relative mt-2 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Buyers */}
      <section className="border-y bg-muted/30 py-20">
        <div className="container-wide">
          <SectionHeading
            eyebrow="For buyers"
            title={<span className="flex items-center gap-3"><Store className="h-8 w-8 text-gold-600" /> Sourcing direct from farms</span>}
            description="Aggregators, wholesalers, processors and exporters use the website for search, comparison and bulk negotiation."
          />
          <div className="mt-12 grid gap-4 lg:grid-cols-5">
            {BUYER_STEPS.map((step, i) => (
              <div key={step.title} className="relative">
                <Card hover className="h-full p-5">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 text-white shadow-soft">
                    <step.icon className="h-5 w-5" />
                  </span>
                  <p className="mt-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Step {i + 1}</p>
                  <h3 className="mt-1 font-semibold">{step.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.text}</p>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Order lifecycle */}
      <section className="container-wide py-20">
        <div className="grid gap-12 lg:grid-cols-2">
          <div>
            <SectionHeading
              eyebrow="Order lifecycle"
              title="Every order has a clear, recorded path"
              description="Status can only move forward along this path, and each step sends an SMS to whoever needs to act next. The full history stays on the order as a dated timeline."
            />
            <ol className="relative mt-10 space-y-6 border-l-2 border-primary/20 pl-8">
              {LIFECYCLE.map((stage, i) => (
                <li key={stage.status} className="relative">
                  <span className="absolute -left-[42px] flex h-7 w-7 items-center justify-center rounded-full border-2 border-primary bg-background text-xs font-bold text-primary">
                    {i + 1}
                  </span>
                  <p className="font-semibold">{stage.status}</p>
                  <p className="text-sm text-muted-foreground">{stage.text}</p>
                </li>
              ))}
            </ol>
          </div>

          <Card className="self-start overflow-hidden">
            <div className="flex items-center gap-2 border-b bg-muted/50 px-6 py-4">
              <MessageSquare className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">SMS a farmer receives for one order</span>
            </div>
            <div className="space-y-3 p-6">
              {[
                'AgriMart: NEW ORDER ORD-7K2PQA. Nkoso Aggregators wants 20 bag (100kg) of Maize for GHS 15,200. Call 0244 551 204. Dial *920*1234# and choose 5 to accept.',
                'AgriMart: Order ORD-7K2PQA is still waiting for your response. Dial *920*1234# and choose My Orders to accept or decline.',
                'AgriMart: Order ORD-7K2PQA is complete. Amount: GHS 14,744. Thank you for trading on AgriMart.',
                'AgriMart: GHS 14,596 has been sent to your MoMo 024****204. Ref: TXN-8H3KD2PA. Thank you for selling with us.',
              ].map((sms, i) => (
                <div key={i} className="max-w-[92%] rounded-2xl rounded-tl-sm bg-muted px-4 py-3 text-sm leading-relaxed">
                  {sms}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>

      <section className="container-wide pb-8">
        <Card className="grid gap-6 bg-field-gradient p-8 text-white sm:p-12 lg:grid-cols-[1.5fr_1fr] lg:items-center">
          <div>
            <h2 className="font-display text-3xl font-extrabold">Ready when you are</h2>
            <ul className="mt-5 grid gap-2 sm:grid-cols-2">
              {['Free registration', 'No listing fees', '3% only on completed sales', 'Support six days a week'].map((item) => (
                <li key={item} className="flex items-center gap-2 text-white/85">
                  <CheckCircle2 className="h-4 w-4 text-gold-300" /> {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
            <Button size="lg" className="bg-white text-primary-800 hover:bg-white/90" asChild>
              <Link href="/register">Create free account</Link>
            </Button>
            <Button size="lg" className="bg-white/10 text-white ring-1 ring-white/25 hover:bg-white/20" asChild>
              <a href={telHref(site.supportPhone)}><Phone /> {formatPhone(site.supportPhone)}</a>
            </Button>
          </div>
        </Card>
      </section>
    </>
  );
}
