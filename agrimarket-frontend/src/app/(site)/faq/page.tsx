import Link from 'next/link';
import type { Metadata } from 'next';
import { getSettings } from '@/lib/settings.server';
import { formatPhone, type SiteSettings } from '@/lib/settings';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger, Badge, Button, Card,
} from '@/components/ui';

export const metadata: Metadata = {
  title: 'Frequently asked questions',
  description: 'Answers about selling, buying, prices, payments and the USSD service on AgriMart Ghana.',
};

const groups = (site: SiteSettings) => [
  {
    title: 'Getting started',
    items: [
      { q: 'Do I need a smartphone or internet?', a: `No. Dial ${site.ussdCode} on any phone, on MTN, Telecel or AirtelTigo. Registration, selling, checking prices, accepting orders and withdrawals all work through the USSD menu without internet.` },
      { q: 'How much does it cost to join?', a: `Nothing. Registration and listing produce are free. The platform keeps ${(site.commissionRate * 100).toFixed(0)}% of a sale only when an order is completed.` },
      { q: 'Can I use the same account on the website?', a: 'Yes. Your phone number is your account on every channel. If you registered over USSD, use "Forgot password" on the sign-in page to set a web password with a code we text you.' },
      { q: 'What language is the service in?', a: 'The USSD menu, SMS messages and the website are all in English.' },
    ],
  },
  {
    title: 'Selling produce',
    items: [
      { q: 'How do I know what price to ask?', a: 'When you enter your price on USSD, the current market rate for that crop is shown on the same screen. On the website, the Market Prices page shows every tracked market and how prices have moved over the last three months.' },
      { q: 'How long does a listing stay live?', a: `Perishable produce such as tomatoes and leafy vegetables stays live for ${site.perishableDays} days; storable crops like maize and beans for ${site.listingDays} days. You can mark a listing sold or remove it at any time.` },
      { q: 'What happens when a buyer orders?', a: 'You receive an SMS straight away with the quantity, total and the buyer’s phone number. Accept or decline from My Orders on the USSD menu or your dashboard. If you do not respond within two hours we send a reminder.' },
      { q: 'What do the quality grades mean?', a: 'Grade A is uniform, firm and unblemished. Grade B has minor cosmetic defects but is sound. Grade C is for immediate processing. Honest grading earns better ratings and repeat buyers.' },
    ],
  },
  {
    title: 'Buying & payments',
    items: [
      { q: 'How do I pay a farmer?', a: 'Agree the method when you order — mobile money, cash on pickup or bank transfer. Once you confirm the goods are received, the order completes and the farmer’s wallet is credited.' },
      { q: 'How do farmers withdraw their earnings?', a: `From My Account → Wallet on USSD, or the Wallet page on the website. Withdrawals go to MTN MoMo, Telecel Cash or AirtelTigo Money. The minimum is GHS ${site.minWithdrawal} and the fee is ${(site.withdrawalFeeRate * 100).toFixed(0)}%.` },
      { q: 'What if something goes wrong with an order?', a: 'Either party can mark the order as disputed. Our support desk reviews the recorded order timeline and contacts both sides. Call the support line or open a ticket with the order code.' },
      { q: 'Can I negotiate the price?', a: 'Yes, on listings marked negotiable. Make an offer and the farmer can accept, decline or send a counter price. An accepted offer becomes an order automatically.' },
    ],
  },
  {
    title: 'SMS & alerts',
    items: [
      site.smsShortCode
        ? { q: 'What SMS commands can I use?', a: `Text ${site.smsShortCode} with PRICE MAIZE for today's prices, SELL MAIZE 20 450 to list 20 bags at GHS 450, BALANCE for your wallet, HELP for support, or STOP to pause marketing messages.` }
        : { q: 'Can I text the service?', a: `We send alerts by SMS — orders, offers, payments and the daily price digest — but texting commands back needs a short code we do not have yet. Use the USSD menu on ${site.ussdCode} for anything you want to do. Reply STOP to any message to pause price and marketing texts.` },
      { q: 'How do price alerts work?', a: 'Choose a crop and a target price. When a market records a price at or beyond your target, we send you an SMS — at most once a day per alert.' },
      { q: 'Will I get too many messages?', a: 'Order, payment and security messages always come through. Price digests and tips can be switched off by texting STOP or changing SMS settings in My Account.' },
    ],
  },
];

export default async function FaqPage() {
  const site = await getSettings();
  const GROUPS = groups(site);
  return (
    <>
      <section className="relative overflow-hidden border-b">
        <div className="absolute inset-0 mesh-bg" />
        <div className="container-wide relative py-14 text-center lg:py-20">
          <Badge variant="success" className="mb-4">Help centre</Badge>
          <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-5xl">Frequently asked questions</h1>
          <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
            Straight answers about selling, buying, payments and the USSD service.
          </p>
        </div>
      </section>

      <section className="container-wide grid max-w-5xl gap-8 py-14">
        {GROUPS.map((group) => (
          <div key={group.title}>
            <h2 className="font-display text-xl font-bold">{group.title}</h2>
            <Accordion type="single" collapsible className="mt-4 rounded-2xl border bg-card px-6 shadow-soft">
              {group.items.map((item) => (
                <AccordionItem key={item.q} value={item.q} className="last:border-0">
                  <AccordionTrigger>{item.q}</AccordionTrigger>
                  <AccordionContent>{item.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        ))}

        <Card className="flex flex-col items-start justify-between gap-4 p-6 sm:flex-row sm:items-center">
          <div>
            <p className="font-semibold">Still stuck?</p>
            <p className="text-sm text-muted-foreground">Call {formatPhone(site.supportPhone)} or send us a message.</p>
          </div>
          <Button variant="gradient" asChild><Link href="/contact">Contact support</Link></Button>
        </Card>
      </section>
    </>
  );
}
