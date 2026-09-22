'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { useChartTheme } from './chart-kit';

export interface ShareItem {
  key: string;
  label: string;
  value: number;
  /** Fixed palette slot per entity so a channel keeps its colour on every chart. */
  slot: number;
}

/**
 * Part-to-whole as a single horizontal stacked bar (≤ 6 segments). Segments are
 * separated by a 2px surface gap rather than strokes; the legend below carries
 * every label with its value and share, so identity never relies on colour.
 */
export function ShareBar({
  items,
  valueFormat = (v) => v.toLocaleString('en-GH'),
  className,
}: {
  items: ShareItem[];
  valueFormat?: (value: number) => string;
  className?: string;
}) {
  const theme = useChartTheme();
  const [hovered, setHovered] = React.useState<string | null>(null);
  const total = items.reduce((sum, i) => sum + i.value, 0);
  const visible = items.filter((i) => i.value > 0);
  const active = visible.find((i) => i.key === hovered);

  if (!total) return <p className="px-3 py-6 text-sm text-muted-foreground">No data for this period.</p>;

  return (
    <div className={cn('px-3', className)}>
      <div className="mb-2 h-5 text-sm" aria-live="polite">
        {active ? (
          <span>
            <span className="font-semibold tabular-nums">{valueFormat(active.value)}</span>{' '}
            <span className="text-muted-foreground">{active.label} · {((active.value / total) * 100).toFixed(1)}%</span>
          </span>
        ) : (
          <span className="text-muted-foreground">Total {valueFormat(total)}</span>
        )}
      </div>

      <div className="flex h-5 w-full gap-[2px] overflow-hidden rounded" role="img" aria-label="Share breakdown">
        {visible.map((item) => (
          <button
            key={item.key}
            type="button"
            onMouseEnter={() => setHovered(item.key)}
            onMouseLeave={() => setHovered(null)}
            onFocus={() => setHovered(item.key)}
            onBlur={() => setHovered(null)}
            className="h-full min-w-[3px] transition-opacity focus-visible:outline-none"
            style={{
              width: `${(item.value / total) * 100}%`,
              backgroundColor: theme.slot(item.slot),
              opacity: hovered && hovered !== item.key ? 0.45 : 1,
            }}
            aria-label={`${item.label}: ${valueFormat(item.value)}`}
          />
        ))}
      </div>

      <ul className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {items.map((item) => (
          <li
            key={item.key}
            className="flex items-center justify-between gap-3 text-sm"
            onMouseEnter={() => setHovered(item.key)}
            onMouseLeave={() => setHovered(null)}
          >
            <span className="flex min-w-0 items-center gap-2">
              <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: theme.slot(item.slot) }} />
              <span className="truncate">{item.label}</span>
            </span>
            <span className="shrink-0 tabular-nums text-muted-foreground">
              <span className="font-semibold text-foreground">{valueFormat(item.value)}</span> · {((item.value / total) * 100).toFixed(0)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Stable colour slot per channel, shared by every channel chart in the app. */
export const CHANNEL_SLOTS: Record<string, number> = { ussd: 0, web: 1, sms: 2, agent: 3, seed: 4 };

/** Stable colour slot per mobile network. */
export const NETWORK_SLOTS: Record<string, number> = { MTN: 0, Telecel: 1, AirtelTigo: 2, Glo: 3, Unknown: 4 };
