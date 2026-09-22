'use client';

import * as React from 'react';
import Link from 'next/link';
import { ArrowDownRight, ArrowUpRight, Minus, Radio } from 'lucide-react';
import { api } from '@/lib/api';
import { cn, formatCurrency } from '@/lib/utils';
import type { NationalPrice } from '@/lib/types';

/**
 * A live price strip. Duplicated once so the CSS marquee loops seamlessly, and
 * paused on hover so a farmer can actually read a row they care about.
 */
export function PriceTicker({ className }: { className?: string }) {
  const [prices, setPrices] = React.useState<NationalPrice[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    api
      .get<NationalPrice[]>('/prices/national', { limit: 14 })
      .then((res) => {
        if (!cancelled) setPrices(res.data ?? []);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className={cn('border-y bg-muted/40', className)}>
        <div className="container-wide flex h-12 items-center gap-6 overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-4 w-36 shrink-0 animate-pulse rounded bg-muted" />
          ))}
        </div>
      </div>
    );
  }

  if (!prices.length) return null;

  const row = [...prices, ...prices];

  return (
    <div className={cn('relative border-y bg-card/60 backdrop-blur', className)}>
      <div className="container-wide flex items-center gap-4">
        <span className="z-10 flex shrink-0 items-center gap-1.5 bg-card/95 py-3 pr-3 text-xs font-bold uppercase tracking-wider text-primary">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-pulse-ring rounded-full bg-primary" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
          <Radio className="hidden h-3.5 w-3.5 sm:inline" />
          Today
        </span>

        <div className="group relative flex-1 overflow-hidden py-3">
          <div className="flex w-max animate-marquee gap-8 group-hover:[animation-play-state:paused]">
            {row.map((price, index) => {
              const Icon = price.trend === 'up' ? ArrowUpRight : price.trend === 'down' ? ArrowDownRight : Minus;
              const tone =
                price.trend === 'up'
                  ? 'text-primary-600 dark:text-primary-400'
                  : price.trend === 'down'
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-muted-foreground';

              return (
                <Link
                  key={`${price.produceId}-${index}`}
                  href={`/prices?produce=${price.produceId}`}
                  className="flex shrink-0 items-center gap-2 text-sm transition-opacity hover:opacity-80"
                >
                  <span className="font-semibold">{price.produce?.name}</span>
                  <span className="text-muted-foreground">
                    {formatCurrency(price.avgPrice, { decimals: 0 })}/{price.unit}
                  </span>
                  <span className={cn('flex items-center gap-0.5 text-xs font-bold', tone)}>
                    <Icon className="h-3 w-3" />
                    {Math.abs(price.changePercent).toFixed(1)}%
                  </span>
                </Link>
              );
            })}
          </div>
          <div className="pointer-events-none absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-card to-transparent" />
        </div>

        <Link
          href="/prices"
          className="hidden shrink-0 bg-card/95 py-3 pl-3 text-xs font-semibold text-primary hover:underline sm:block"
        >
          All prices →
        </Link>
      </div>
    </div>
  );
}
