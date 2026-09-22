import type { Metadata } from 'next';
import { LegalPage } from '@/components/site/legal-page';
import { SITE } from '@/lib/constants';
import { formatPhone, telHref } from '@/lib/settings';
import { getSettings } from '@/lib/settings.server';

export const metadata: Metadata = { title: 'Privacy policy' };

export default async function PrivacyPage() {
  const site = await getSettings();
  return (
    <LegalPage
      title="Privacy policy"
      updated="14 September 2026"
      intro={`How ${site.name} collects, uses and protects the personal information of farmers, buyers and visitors, in line with Ghana's Data Protection Act, 2012 (Act 843).`}
      sections={[
        {
          heading: 'Information we collect',
          paragraphs: [
            'When you register we collect your name, phone number, region, district and community, and optionally your email address, farm size, crops and business details.',
            'When you use the platform we record your listings, orders, offers, price alerts, USSD session steps and the SMS messages sent to and from your number.',
            'Your USSD PIN and web password are stored only as one-way hashes. Our staff cannot see them.',
          ],
        },
        {
          heading: 'How we use it',
          paragraphs: [
            'To operate the marketplace: publishing your listings, connecting you with buyers or farmers, and sending order, offer, payment and security messages.',
            'To send price information and farming guidance you have opted into. You can stop these at any time by texting STOP or changing your SMS settings.',
            'To evaluate whether the platform improves market access and income. Evaluation reports use aggregated, anonymised figures only.',
          ],
        },
        {
          heading: 'What other users can see',
          paragraphs: [
            'Buyers see a farmer’s name, community, region, rating and listings. A phone number is shown only to signed-in users, so that trading partners can call each other.',
            'We never sell personal information or share it with advertisers.',
          ],
        },
        {
          heading: 'Service providers',
          paragraphs: [
            'Messages are delivered through licensed SMS and USSD aggregators, and payouts through mobile money operators. They receive only what is needed to deliver a message or payment.',
          ],
        },
        {
          heading: 'Retention and security',
          paragraphs: [
            'Order and transaction records are kept for seven years to meet financial record-keeping requirements. Other data is deleted or anonymised within 12 months of account closure.',
            'Access to administrative tools is restricted, separately authenticated and recorded in an audit log.',
          ],
        },
        {
          heading: 'Your rights',
          paragraphs: [
            `You may request a copy of your data, ask for corrections, or ask us to close your account by calling ${formatPhone(site.supportPhone)} or emailing ${site.supportEmail}.`,
          ],
        },
      ]}
    />
  );
}
