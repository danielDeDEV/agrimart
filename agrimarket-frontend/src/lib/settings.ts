import { SITE } from './constants';

/**
 * Platform settings an administrator edits under Admin → Settings. The website
 * reads them live, so changing the support line or the USSD code updates every
 * page and message without a redeploy. SITE holds the fallbacks used before the
 * API answers (and if it cannot be reached).
 */
export interface SiteSettings {
  name: string;
  shortName: string;
  tagline: string;
  description: string;
  supportPhone: string;
  supportEmail: string;
  address: string;
  ussdCode: string;
  smsShortCode: string;
  /** The one account the website's phone simulator may open. */
  ussdDemoPhone: string;
  commissionRate: number;
  minWithdrawal: number;
  withdrawalFeeRate: number;
  maxListingPhotos: number;
  listingDays: number;
  perishableDays: number;
  maintenanceMode: boolean;
  registrationOpen: boolean;
}

/** "AgriMart Ghana" → "AgriMart": the short form used in page titles. */
const toShortName = (name: string) => name.replace(/\s+Ghana$/i, '').trim() || name;

export const DEFAULT_SETTINGS: SiteSettings = {
  name: SITE.name,
  shortName: SITE.shortName,
  tagline: SITE.tagline,
  description: SITE.description,
  supportPhone: SITE.supportPhone,
  supportEmail: SITE.supportEmail,
  address: SITE.address,
  ussdCode: SITE.ussdCode,
  smsShortCode: SITE.smsShortCode,
  ussdDemoPhone: '',
  commissionRate: 0.03,
  minWithdrawal: 10,
  withdrawalFeeRate: 0.01,
  maxListingPhotos: 5,
  listingDays: 45,
  perishableDays: 7,
  maintenanceMode: false,
  registrationOpen: true,
};

const text = (value: unknown, fallback: string) => {
  const s = typeof value === 'string' ? value.trim() : '';
  return s || fallback;
};
const num = (value: unknown, fallback: number) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};
const bool = (value: unknown, fallback: boolean) => (typeof value === 'boolean' ? value : fallback);

/** Turns the API's snake_case settings into the shape the pages use. */
export function toSiteSettings(data: Record<string, unknown> | null | undefined): SiteSettings {
  if (!data) return DEFAULT_SETTINGS;
  const name = text(data.platform_name, DEFAULT_SETTINGS.name);
  return {
    name,
    shortName: toShortName(name),
    tagline: text(data.platform_tagline, DEFAULT_SETTINGS.tagline),
    description: DEFAULT_SETTINGS.description,
    supportPhone: text(data.support_phone, DEFAULT_SETTINGS.supportPhone),
    supportEmail: text(data.support_email, DEFAULT_SETTINGS.supportEmail),
    address: text(data.office_address, DEFAULT_SETTINGS.address),
    ussdCode: text(data.ussd_code, DEFAULT_SETTINGS.ussdCode),
    // Empty on purpose when the platform has no inbound short code
    smsShortCode: typeof data.sms_short_code === 'string' ? data.sms_short_code.trim() : '',
    // Empty on purpose when the platform has no demo account, so it must not
    // fall back to one that no longer exists
    ussdDemoPhone: typeof data.ussd_demo_phone === 'string' ? data.ussd_demo_phone.trim() : DEFAULT_SETTINGS.ussdDemoPhone,
    commissionRate: num(data.commission_rate, DEFAULT_SETTINGS.commissionRate),
    minWithdrawal: num(data.min_withdrawal, DEFAULT_SETTINGS.minWithdrawal),
    withdrawalFeeRate: num(data.withdrawal_fee_rate, DEFAULT_SETTINGS.withdrawalFeeRate),
    maxListingPhotos: num(data.max_listing_images, DEFAULT_SETTINGS.maxListingPhotos),
    listingDays: num(data.listing_expiry_days, DEFAULT_SETTINGS.listingDays),
    perishableDays: num(data.perishable_expiry_days, DEFAULT_SETTINGS.perishableDays),
    maintenanceMode: bool(data.maintenance_mode, false),
    registrationOpen: bool(data.registration_open, true),
  };
}

/** "0579990000" → "057 999 0000". */
export const formatPhone = (phone: string) => {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10 && digits.startsWith('0')) {
    return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
  }
  return phone;
};

/** A tel: link that works from a handset. */
export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;
