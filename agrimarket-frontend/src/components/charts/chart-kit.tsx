'use client';

import * as React from 'react';
import { BarChart3, Table2 } from 'lucide-react';
import { useTheme } from '@/components/providers';
import { CHART_PALETTE } from '@/lib/constants';
import { cn } from '@/lib/utils';

/**
 * Shared chart foundation.
 *
 * Colours are resolved to hex per theme here rather than via CSS variables,
 * because SVG presentation attributes do not reliably resolve var() in every
 * browser. Series colours follow the entity: callers pass a stable slot index
 * per series, so filtering never repaints the survivors.
 */
export function useChartTheme() {
  const { resolved } = useTheme();
  const mode: 'light' | 'dark' = resolved === 'dark' ? 'dark' : 'light';
  const chrome = CHART_PALETTE.chrome[mode];

  return React.useMemo(
    () => ({
      mode,
      series: CHART_PALETTE[mode] as readonly string[],
      slot: (index: number) => CHART_PALETTE[mode][index % CHART_PALETTE[mode].length],
      ...chrome,
      tick: { fill: chrome.muted, fontSize: 12 },
    }),
    [mode, chrome]
  );
}

/** Axis props shared by every cartesian chart: hairline, solid, recessive. */
export function axisProps(theme: ReturnType<typeof useChartTheme>) {
  return {
    stroke: theme.axis,
    strokeWidth: 1,
    tick: theme.tick,
    tickLine: false,
    axisLine: { stroke: theme.axis, strokeWidth: 1 },
  } as const;
}

/* ── Tooltip ─────────────────────────────────────────────────────────── */

export interface TooltipRow {
  label: string;
  value: string;
  color?: string;
  shape?: 'line' | 'rect';
}

/** Values lead (strong), series names follow; rows keyed by a short line of the series colour. */
export function ChartTooltipBox({ title, rows }: { title?: string; rows: TooltipRow[] }) {
  if (!rows.length) return null;
  return (
    <div className="min-w-[160px] rounded-xl border bg-popover px-3.5 py-2.5 text-popover-foreground shadow-lift">
      {title && <p className="mb-1.5 text-xs font-medium text-muted-foreground">{title}</p>}
      <ul className="space-y-1">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center gap-2.5">
            {row.color && (
              <span
                aria-hidden
                className={cn('shrink-0', row.shape === 'rect' ? 'h-2.5 w-2.5 rounded-sm' : 'h-0.5 w-3 rounded-full')}
                style={{ backgroundColor: row.color }}
              />
            )}
            <span className="text-sm font-semibold tabular-nums">{row.value}</span>
            <span className="truncate text-xs text-muted-foreground">{row.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Legend ──────────────────────────────────────────────────────────── */

export function ChartLegend({
  items,
  className,
}: {
  items: { label: string; color: string; shape?: 'line' | 'rect' }[];
  className?: string;
}) {
  return (
    <ul className={cn('flex flex-wrap items-center gap-x-4 gap-y-1.5', className)}>
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-2 text-xs text-muted-foreground">
          <span
            aria-hidden
            className={cn('shrink-0', item.shape === 'line' ? 'h-0.5 w-4 rounded-full' : 'h-2.5 w-2.5 rounded-sm')}
            style={{ backgroundColor: item.color }}
          />
          <span className="text-foreground">{item.label}</span>
        </li>
      ))}
    </ul>
  );
}

/* ── Card with chart / table toggle ──────────────────────────────────── */

export interface TableColumn {
  key: string;
  label: string;
  align?: 'left' | 'right';
  format?: (value: unknown, row: Record<string, unknown>) => React.ReactNode;
}

/**
 * Every chart ships a table twin — the accessible equivalent, and the relief
 * channel for palette slots that sit below 3:1 on the light surface.
 */
export function ChartCard({
  title,
  description,
  action,
  legend,
  table,
  refreshing,
  children,
  className,
  empty,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  legend?: React.ReactNode;
  table?: { columns: TableColumn[]; rows: Record<string, unknown>[] };
  refreshing?: boolean;
  children: React.ReactNode;
  className?: string;
  empty?: React.ReactNode;
}) {
  const [view, setView] = React.useState<'chart' | 'table'>('chart');

  return (
    <section className={cn('rounded-2xl border bg-card shadow-soft', className)}>
      <header className="flex flex-wrap items-start justify-between gap-3 px-5 pb-2 pt-5">
        <div className="min-w-0">
          <h3 className="font-semibold leading-tight">{title}</h3>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        <div className="flex items-center gap-2">
          {action}
          {table && (
            <div className="flex rounded-lg border p-0.5" role="tablist" aria-label="Chart view">
              {(['chart', 'table'] as const).map((mode) => (
                <button
                  key={mode}
                  role="tab"
                  aria-selected={view === mode}
                  onClick={() => setView(mode)}
                  className={cn(
                    'flex h-7 w-8 items-center justify-center rounded-md transition-colors',
                    view === mode ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
                  )}
                  title={mode === 'chart' ? 'Chart view' : 'Table view'}
                >
                  {mode === 'chart' ? <BarChart3 className="h-3.5 w-3.5" /> : <Table2 className="h-3.5 w-3.5" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {legend && view === 'chart' && <div className="px-5 pb-1">{legend}</div>}

      <div className={cn('px-2 pb-4 transition-opacity duration-300', refreshing && 'opacity-50')}>
        {empty ? (
          <div className="px-3">{empty}</div>
        ) : view === 'chart' || !table ? (
          children
        ) : (
          <div className="max-h-[420px] overflow-auto px-3">
            <table className="data-table">
              <thead>
                <tr>
                  {table.columns.map((col) => (
                    <th key={col.key} className={cn(col.align === 'right' && 'text-right')}>{col.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row, i) => (
                  <tr key={i}>
                    {table.columns.map((col) => (
                      <td key={col.key} className={cn('tabular-nums', col.align === 'right' && 'text-right')}>
                        {col.format ? col.format(row[col.key], row) : String(row[col.key] ?? '—')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
