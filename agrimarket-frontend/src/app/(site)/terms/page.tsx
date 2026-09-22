import type { Metadata } from 'next';
import { LegalPage } from '@/components/site/legal-page';
import { SITE } from '@/lib/constants';
import { getSettings } from '@/lib/settings.server';

export const metadata: Metadata = { title: 'Terms of use' };

export default async function TermsPage() {
  const site = await getSettings();
  return (
    <LegalPage
      title="Terms of use"
      updated="14 September 2026"
      intro={`These terms govern your use of ${site.name} over the web, USSD and SMS. By registering or trading on the platform you agree to them.`}
      sections={[
        {
          heading: 'The service',
          paragraphs: [
            `${SITE.name} is a marketplace that connects sellers and buyers of agricultural produce and publishes market price information. We are not a party to the sale itself; contracts of sale are between the farmer and the buyer.`,
          ],
        },
        {
          heading: 'Accounts',
          paragraphs: [
            'You must register with a phone number you own. You are responsible for keeping your PIN and password secret and for activity on your account.',
            'We may suspend accounts that post false listings, fail to honour accepted orders, or abuse other users.',
          ],
        },
        {
          heading: 'Listings',
          paragraphs: [
            'Listings must describe produce you actually hold or will harvest, with an honest quantity, grade and price. Prohibited items include produce that is contaminated, stolen, or restricted by law.',
            'We may remove listings that break these terms and will tell you why by SMS.',
          ],
        },
        {
          heading: 'Orders, fees and payments',
          paragraphs: [
            'An order becomes binding once the farmer accepts it. Registration and listing are free. A commission of 3% of the order subtotal is deducted from the farmer’s proceeds when an order completes.',
            'Wallet withdrawals to mobile money carry a 1% fee and a GHS 10 minimum.',
          ],
        },
        {
          heading: 'Market price information',
          paragraphs: [
            'Prices are gathered from field agents, MoFA reports and market surveys and are published for guidance. Actual prices vary by quality, quantity and day, and we do not guarantee that any buyer will pay a published price.',
          ],
        },
        {
          heading: 'Disputes',
          paragraphs: [
            'If an order goes wrong, mark it as disputed or contact support. We will review the recorded order history and help both parties reach a resolution, but final responsibility for the goods and payment rests with the trading parties.',
          ],
        },
        {
          heading: 'Changes',
          paragraphs: [
            'We may update these terms. Material changes will be announced by SMS and on this page at least 14 days before they take effect.',
          ],
        },
      ]}
    />
  );
}
