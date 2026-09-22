'use client';

import * as React from 'react';
import Image from 'next/image';
import { ArrowDownRight, ArrowRight, ArrowUpRight, ChevronLeft, ChevronRight, Minus } from 'lucide-react';
import { cn, colorFromString, formatNumber, initials } from '@/lib/utils';
import { BADGE_COLORS } from '@/lib/constants';
import { Button } from './button';
import { Skeleton } from './misc';

/* ══════════════════════════ Table ════════════════════════════════════ */

const Table = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="w-full overflow-x-auto">
      <table ref={ref} className={cn('data-table', className)} {...props} />
    </div>
  )
);
Table.displayName = 'Table';

const TableHeader = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => <thead ref={ref} className={className} {...props} />
);
TableHeader.displayName = 'TableHeader';

const TableBody = React.forwardRef<HTMLTableSectionElement, React.HTMLAttributes<HTMLTableSectionElement>>(
  ({ className, ...props }, ref) => <tbody ref={ref} className={className} {...props} />
);
TableBody.displayName = 'TableBody';

const TableRow = React.forwardRef<HTMLTableRowElement, React.HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => <tr ref={ref} className={className} {...props} />
);
TableRow.displayName = 'TableRow';

const TableHead = React.forwardRef<HTMLTableCellElement, React.ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => <th ref={ref} className={className} {...props} />
);
TableHead.displayName = 'TableHead';

const TableCell = React.forwardRef<HTMLTableCellElement, React.TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => <td ref={ref} className={className} {...props} />
);
TableCell.displayName = 'TableCell';

/* ══════════════════════════ SmartImage ═══════════════════════════════ */

/**
 * Produce photos come from the site's own library (/images/...) and listing
 * photos from farmers' uploads on the API. Library photos go through Next's
 * optimiser so a thumbnail never downloads the full picture. If an image is
 * missing we fall back to a gradient tile derived from the name —
 * deterministic, so the same crop always looks the same across the site.
 */
export function SmartImage({
  src,
  alt,
  className,
  fill = true,
  width,
  height,
  rounded = 'rounded-xl',
  priority,
  sizes,
}: {
  src?: string | null;
  alt: string;
  className?: string;
  fill?: boolean;
  width?: number;
  height?: number;
  rounded?: string;
  priority?: boolean;
  /** Rendered width hint for the optimiser, e.g. "48px" for a thumbnail. */
  sizes?: string;
}) {
  const [failed, setFailed] = React.useState(false);
  React.useEffect(() => setFailed(false), [src]);
  const showFallback = !src || failed;

  if (showFallback) {
    return (
      <div
        className={cn(
          'relative flex items-center justify-center overflow-hidden bg-gradient-to-br',
          colorFromString(alt),
          rounded,
          fill ? 'absolute inset-0 h-full w-full' : '',
          className
        )}
        style={!fill ? { width, height } : undefined}
        aria-label={alt}
      >
        <div className="absolute inset-0 opacity-25 [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:14px_14px]" />
        <span className="relative z-10 px-3 text-center text-lg font-black uppercase tracking-tight text-white/95 drop-shadow-sm">
          {alt.length > 14 ? initials(alt) : alt}
        </span>
      </div>
    );
  }

  // Uploads live on the API server; only the site's own files are optimised
  const isLocal = src.startsWith('/');

  return (
    <Image
      src={src}
      alt={alt}
      fill={fill}
      width={!fill ? width : undefined}
      height={!fill ? height : undefined}
      priority={priority}
      sizes={fill ? sizes ?? '(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw' : sizes}
      unoptimized={!isLocal}
      onError={() => setFailed(true)}
      className={cn('object-cover', rounded, className)}
    />
  );
}

/* ══════════════════════════ StatCard ═════════════════════════════════ */

export function StatCard({
  label,
  value,
  hint,
  icon,
  trend,
  accent = 'primary',
  loading,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  trend?: number | null;
  accent?: 'primary' | 'gold' | 'blue' | 'violet' | 'red' | 'cyan';
  loading?: boolean;
  className?: string;
}) {
  const accents = {
    primary: 'from-primary-500/15 to-primary-600/5 text-primary-700 dark:text-primary-300',
    gold: 'from-gold-500/15 to-gold-600/5 text-gold-700 dark:text-gold-300',
    blue: 'from-blue-500/15 to-blue-600/5 text-blue-700 dark:text-blue-300',
    violet: 'from-violet-500/15 to-violet-600/5 text-violet-700 dark:text-violet-300',
    red: 'from-red-500/15 to-red-600/5 text-red-700 dark:text-red-300',
    cyan: 'from-cyan-500/15 to-cyan-600/5 text-cyan-700 dark:text-cyan-300',
  };

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-2xl border bg-card p-5 shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lift',
        className
      )}
    >
      <div
        className={cn(
          'pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-gradient-to-br opacity-70 blur-2xl transition-opacity duration-500 group-hover:opacity-100',
          accents[accent]
        )}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          {loading ? (
            <Skeleton className="mt-2 h-8 w-24" />
          ) : (
            <p className="mt-1.5 text-2xl font-bold tracking-tight sm:text-3xl">{value}</p>
          )}
          {(hint || trend !== undefined) && (
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              {trend !== undefined && trend !== null && <TrendPill value={trend} />}
              {hint && <span className="truncate">{hint}</span>}
            </div>
          )}
        </div>
        {icon && (
          <div
            className={cn(
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br [&_svg]:size-5',
              accents[accent]
            )}
          >
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════ TrendPill ════════════════════════════════ */

export function TrendPill({ value, suffix = '%', showZero = true }: { value: number; suffix?: string; showZero?: boolean }) {
  const rounded = Number(value ?? 0);
  const isFlat = Math.abs(rounded) < 0.05;

  if (isFlat && !showZero) return null;

  const Icon = isFlat ? Minus : rounded > 0 ? ArrowUpRight : ArrowDownRight;
  const tone = isFlat
    ? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
    : rounded > 0
      ? 'bg-primary-100 text-primary-700 dark:bg-primary-950 dark:text-primary-300'
      : 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300';

  return (
    <span className={cn('inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-bold', tone)}>
      <Icon className="h-3 w-3" />
      {isFlat ? '0' : `${Math.abs(rounded).toFixed(1)}`}
      {suffix}
    </span>
  );
}

/* ══════════════════════════ StatusBadge ══════════════════════════════ */

export function StatusBadge({
  status,
  map,
  className,
}: {
  status: string;
  map?: Record<string, { label: string; color: string }>;
  className?: string;
}) {
  const entry = map?.[status];
  const label = entry?.label ?? status.replace(/_/g, ' ');
  const color = entry?.color ?? 'slate';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize',
        BADGE_COLORS[color] ?? BADGE_COLORS.slate,
        className
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />
      {label}
    </span>
  );
}

/* ══════════════════════════ EmptyState ═══════════════════════════════ */

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-16 text-center', className)}>
      {icon && (
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground [&_svg]:size-7">
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/* ══════════════════════════ Pagination ═══════════════════════════════ */

export function Pagination({
  page,
  totalPages,
  total,
  limit,
  onPageChange,
  className,
}: {
  page: number;
  totalPages: number;
  total?: number;
  limit?: number;
  onPageChange: (page: number) => void;
  className?: string;
}) {
  if (totalPages <= 1) return null;

  const pages: (number | 'gap')[] = [];
  const window = 1;
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - window && i <= page + window)) {
      pages.push(i);
    } else if (pages[pages.length - 1] !== 'gap') {
      pages.push('gap');
    }
  }

  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3.5', className)}>
      {total !== undefined && limit !== undefined && (
        <p className="text-xs text-muted-foreground">
          Showing <span className="font-semibold text-foreground">{formatNumber((page - 1) * limit + 1)}</span>–
          <span className="font-semibold text-foreground">{formatNumber(Math.min(page * limit, total))}</span> of{' '}
          <span className="font-semibold text-foreground">{formatNumber(total)}</span>
        </p>
      )}
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft />
        </Button>
        {pages.map((p, i) =>
          p === 'gap' ? (
            <span key={`gap-${i}`} className="px-1.5 text-sm text-muted-foreground">
              …
            </span>
          ) : (
            <Button
              key={p}
              variant={p === page ? 'default' : 'ghost'}
              size="icon-sm"
              onClick={() => onPageChange(p)}
              aria-current={p === page ? 'page' : undefined}
            >
              {p}
            </Button>
          )
        )}
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
        >
          <ChevronRight />
        </Button>
      </div>
    </div>
  );
}

/* ══════════════════════════ PageHeader ═══════════════════════════════ */

export function PageHeader({
  title,
  description,
  action,
  breadcrumb,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  breadcrumb?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {breadcrumb && <div className="mb-2 text-sm text-muted-foreground">{breadcrumb}</div>}
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap gap-2">{action}</div>}
    </div>
  );
}

/* ══════════════════════════ SectionHeading ═══════════════════════════ */

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = 'left',
  className,
  action,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  align?: 'left' | 'center';
  className?: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between',
        align === 'center' && 'sm:flex-col sm:items-center',
        className
      )}
    >
      <div className={cn('max-w-2xl', align === 'center' && 'mx-auto text-center')}>
        {eyebrow && (
          <span className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary-50 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary-700 dark:bg-primary-950/60 dark:text-primary-300">
            {eyebrow}
          </span>
        )}
        <h2 className="text-balance text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
        {description && <p className="mt-3 text-pretty text-base leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/* ══════════════════════════ Loading / error ══════════════════════════ */

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={cn('h-9', c === 0 ? 'w-1/4' : 'flex-1')} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <EmptyState
      title="We could not load this"
      description={message}
      action={
        onRetry && (
          <Button variant="outline" onClick={onRetry}>
            Try again <ArrowRight />
          </Button>
        )
      }
    />
  );
}

export {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
};
