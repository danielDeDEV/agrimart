export const SITE = {
  name: 'AgriMart Ghana',
  shortName: 'AgriMart',
  tagline: 'Every farmer, every market, every price — on any phone.',
  description:
    'An integrated USSD, SMS and web platform that connects Ghanaian smallholder farmers directly to buyers, with live market prices and no internet required.',
  ussdCode: process.env.NEXT_PUBLIC_USSD_CODE || '*920*1234#',
  /**
   * Two-way SMS needs a short code from the gateway. Empty means we only
   * send alerts out, and the pages say so rather than promising keywords.
   */
  smsShortCode: process.env.NEXT_PUBLIC_SMS_SHORTCODE || '',
  supportPhone: process.env.NEXT_PUBLIC_SUPPORT_PHONE || '0302 000 000',
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@agrimart.gh',
  address: 'Agric Ridge, Accra, Ghana',
};

/** True when farmers can text keywords in, not just receive alerts. */
export const HAS_SMS_SHORTCODE = !!SITE.smsShortCode;

export const ORDER_STATUS = {
  pending: { label: 'Pending', color: 'amber', description: 'Waiting for the farmer to respond' },
  accepted: { label: 'Accepted', color: 'blue', description: 'The farmer accepted this order' },
  rejected: { label: 'Declined', color: 'red', description: 'The farmer could not fulfil this order' },
  paid: { label: 'Paid', color: 'violet', description: 'Payment received' },
  in_transit: { label: 'In transit', color: 'cyan', description: 'On the way to the buyer' },
  delivered: { label: 'Delivered', color: 'teal', description: 'Goods handed over' },
  completed: { label: 'Completed', color: 'green', description: 'Deal closed and settled' },
  cancelled: { label: 'Cancelled', color: 'slate', description: 'Cancelled before completion' },
  disputed: { label: 'Disputed', color: 'red', description: 'Under review by the support desk' },
} as const;

export const LISTING_STATUS = {
  pending: { label: 'Pending review', color: 'amber' },
  active: { label: 'Live', color: 'green' },
  reserved: { label: 'Reserved', color: 'blue' },
  sold: { label: 'Sold out', color: 'slate' },
  expired: { label: 'Expired', color: 'slate' },
  rejected: { label: 'Rejected', color: 'red' },
  withdrawn: { label: 'Withdrawn', color: 'slate' },
} as const;

export const CHANNEL_META = {
  ussd: { label: 'USSD', color: 'green', icon: 'Smartphone', description: 'Feature phone, no internet' },
  sms: { label: 'SMS', color: 'violet', icon: 'MessageSquare', description: 'Text message commands' },
  web: { label: 'Web', color: 'blue', icon: 'Globe', description: 'Website or smartphone browser' },
  agent: { label: 'Field agent', color: 'amber', icon: 'UserCheck', description: 'Registered in person' },
  seed: { label: 'System', color: 'slate', icon: 'Settings', description: 'Created by the platform' },
} as const;

export const QUALITY_GRADES = {
  A: { label: 'Grade A', description: 'Premium — uniform, firm, unblemished', color: 'green' },
  B: { label: 'Grade B', description: 'Good — minor cosmetic defects, sound', color: 'amber' },
  C: { label: 'Grade C', description: 'Fair — best for immediate processing', color: 'slate' },
} as const;

export const LANGUAGES = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'tw', label: 'Twi', native: 'Twi' },
  { code: 'ee', label: 'Ewe', native: 'Eʋegbe' },
  { code: 'dag', label: 'Dagbani', native: 'Dagbanli' },
  { code: 'ha', label: 'Hausa', native: 'Hausa' },
];

export const BUSINESS_TYPES = [
  { value: 'aggregator', label: 'Aggregator' },
  { value: 'wholesaler', label: 'Wholesaler' },
  { value: 'retailer', label: 'Retailer' },
  { value: 'processor', label: 'Processor' },
  { value: 'exporter', label: 'Exporter' },
  { value: 'individual', label: 'Individual buyer' },
];

export const MOMO_PROVIDERS = [
  { value: 'mtn', label: 'MTN MoMo' },
  { value: 'telecel', label: 'Telecel Cash' },
  { value: 'airteltigo', label: 'AirtelTigo Money' },
];

export const TIP_CATEGORIES = [
  { value: 'planting', label: 'Planting' },
  { value: 'pest_control', label: 'Pest control' },
  { value: 'harvesting', label: 'Harvesting' },
  { value: 'storage', label: 'Storage' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'finance', label: 'Finance' },
  { value: 'weather', label: 'Weather' },
  { value: 'livestock', label: 'Livestock' },
];

export const SUPPORT_CATEGORIES = [
  { value: 'account', label: 'My account' },
  { value: 'listing', label: 'Listings' },
  { value: 'order', label: 'Orders' },
  { value: 'payment', label: 'Payments' },
  { value: 'ussd', label: 'USSD service' },
  { value: 'sms', label: 'SMS messages' },
  { value: 'technical', label: 'Technical problem' },
  { value: 'other', label: 'Something else' },
];

/** Tailwind classes per semantic colour, so badges stay consistent site-wide. */
export const BADGE_COLORS: Record<string, string> = {
  green: 'bg-primary-100 text-primary-800 border-primary-200 dark:bg-primary-950 dark:text-primary-300 dark:border-primary-900',
  amber: 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-900',
  red: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-900',
  blue: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-900',
  violet: 'bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-950 dark:text-violet-300 dark:border-violet-900',
  cyan: 'bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-950 dark:text-cyan-300 dark:border-cyan-900',
  teal: 'bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-950 dark:text-teal-300 dark:border-teal-900',
  slate: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
};

/**
 * Categorical chart palette — the documented, validated reference palette.
 * Slot order is the colour-blind safety mechanism: assign in order, never cycle,
 * never re-order. Validated against this site's card surfaces (#ffffff light,
 * #0e1b16 dark). Light slots 3–5 sit below 3:1 on white, so every multi-series
 * chart must carry a legend and a table view (ChartCard provides both).
 */
export const CHART_PALETTE = {
  light: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'],
  dark: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'],
  chrome: {
    light: { grid: '#e1e0d9', axis: '#c3c2b7', muted: '#898781', deemphasis: '#d6d4cc', surface: '#ffffff' },
    dark: { grid: '#2c2c2a', axis: '#383835', muted: '#898781', deemphasis: '#3d4a44', surface: '#0e1b16' },
  },
} as const;
