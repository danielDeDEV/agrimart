import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** GHS formatting used everywhere prices appear. */
export function formatCurrency(amount: number | string | null | undefined, options?: {
  compact?: boolean;
  decimals?: number;
  symbol?: string;
}) {
  const value = Number(amount ?? 0);
  const symbol = options?.symbol ?? 'GHS';

  if (options?.compact && Math.abs(value) >= 1000) {
    const units = [
      { threshold: 1_000_000_000, suffix: 'B' },
      { threshold: 1_000_000, suffix: 'M' },
      { threshold: 1_000, suffix: 'K' },
    ];
    const unit = units.find((u) => Math.abs(value) >= u.threshold);
    if (unit) {
      return `${symbol} ${(value / unit.threshold).toFixed(1).replace(/\.0$/, '')}${unit.suffix}`;
    }
  }

  return `${symbol} ${value.toLocaleString('en-GH', {
    minimumFractionDigits: options?.decimals ?? 2,
    maximumFractionDigits: options?.decimals ?? 2,
  })}`;
}

export function formatNumber(value: number | string | null | undefined, decimals = 0) {
  return Number(value ?? 0).toLocaleString('en-GH', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatCompact(value: number | string | null | undefined) {
  const n = Number(value ?? 0);
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(Math.round(n));
}

export function formatDate(date: string | Date | null | undefined, style: 'short' | 'long' | 'day' = 'short') {
  if (!date) return '—';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '—';

  if (style === 'long') {
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  }
  if (style === 'day') {
    return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
  }
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(date: string | Date | null | undefined) {
  if (!date) return '—';
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}, ${d.toLocaleTimeString(
    'en-GB',
    { hour: '2-digit', minute: '2-digit' }
  )}`;
}

/** "3 hours ago" — used on activity feeds and notification lists. */
export function timeAgo(date: string | Date | null | undefined) {
  if (!date) return '';
  const then = new Date(date).getTime();
  if (Number.isNaN(then)) return '';

  const seconds = Math.floor((Date.now() - then) / 1000);
  if (seconds < 60) return 'just now';

  const units: [number, string][] = [
    [60, 'minute'],
    [3600, 'hour'],
    [86400, 'day'],
    [604800, 'week'],
    [2592000, 'month'],
    [31536000, 'year'],
  ];

  let unitIndex = units.length - 1;
  for (let i = 0; i < units.length; i++) {
    if (seconds < (units[i + 1]?.[0] ?? Infinity)) {
      unitIndex = i;
      break;
    }
  }

  const [divisor, label] = units[unitIndex];
  const count = Math.floor(seconds / divisor);
  return `${count} ${label}${count === 1 ? '' : 's'} ago`;
}

/** Local 0XXXXXXXXX form, matching how the API stores numbers. */
export function normalizePhone(input: string) {
  let p = String(input || '').replace(/[\s\-()+]/g, '');
  if (p.startsWith('00')) p = p.slice(2);
  if (p.startsWith('233')) p = `0${p.slice(3)}`;
  if (p.length === 9 && !p.startsWith('0')) p = `0${p}`;
  return p;
}

export function isValidGhanaPhone(input: string) {
  return /^0(2[0-9]|5[0-9])\d{7}$/.test(normalizePhone(input));
}

export function formatPhone(input: string) {
  const p = normalizePhone(input);
  return p.length === 10 ? `${p.slice(0, 3)} ${p.slice(3, 6)} ${p.slice(6)}` : p;
}

export function initials(name?: string | null) {
  if (!name) return '?';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/** Deterministic pleasant colour for an avatar or produce tile without a photo. */
export function colorFromString(input: string) {
  const palettes = [
    'from-emerald-500 to-green-700',
    'from-amber-500 to-orange-600',
    'from-lime-500 to-emerald-600',
    'from-teal-500 to-cyan-700',
    'from-orange-500 to-red-600',
    'from-green-600 to-teal-700',
    'from-yellow-500 to-amber-600',
    'from-cyan-600 to-blue-700',
  ];
  let hash = 0;
  for (let i = 0; i < input.length; i++) hash = input.charCodeAt(i) + ((hash << 5) - hash);
  return palettes[Math.abs(hash) % palettes.length];
}

export function truncate(text: string | null | undefined, length = 120) {
  if (!text) return '';
  return text.length <= length ? text : `${text.slice(0, length).trimEnd()}…`;
}

export function titleCase(input: string | null | undefined) {
  if (!input) return '';
  return input
    .replace(/[_-]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function percentChange(current: number, previous: number) {
  if (!previous) return 0;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function debounce<T extends (...args: never[]) => void>(fn: T, delay = 300) {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
