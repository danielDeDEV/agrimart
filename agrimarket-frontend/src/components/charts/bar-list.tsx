'use client';

import * as React from 'react';
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartTooltipBox, axisProps, useChartTheme } from './chart-kit';

export interface BarListItem {
  label: string;
  value: number;
  hint?: string;
}

/**
 * Horizontal bars for comparing magnitude across nominal categories — one
 * series, so every bar takes slot 1 (or the single highlighted bar does, with
 * the rest de-emphasised). Values sit at the bar tips; bars are 18px thick with
 * a 4px rounded data end and a square baseline.
 */
export function BarList({
  items,
  valueFormat = (v) => v.toLocaleString('en-GH'),
  valueLabel = 'value',
  highlight,
  labelWidth = 130,
}: {
  items: BarListItem[];
  valueFormat?: (value: number) => string;
  valueLabel?: string;
  /** Index of one bar to emphasise; omit to colour every bar with slot 1. */
  highlight?: number;
  labelWidth?: number;
}) {
  const theme = useChartTheme();
  const height = Math.max(160, items.length * 34 + 36);

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={items} layout="vertical" margin={{ top: 4, right: 56, bottom: 4, left: 4 }} barCategoryGap={8}>
          <CartesianGrid horizontal={false} stroke={theme.grid} strokeWidth={1} />
          <XAxis type="number" {...axisProps(theme)} allowDecimals={false} tickFormatter={(v: number) => valueFormat(v)} />
          <YAxis
            type="category"
            dataKey="label"
            {...axisProps(theme)}
            axisLine={false}
            width={labelWidth}
            tick={({ x, y, payload }: { x: number; y: number; payload: { value: string } }) => {
              // a plain <text> never wraps, unlike the default tick
              const name = String(payload.value);
              return (
                <text x={x} y={y} dy={4} textAnchor="end" fontSize={12} fill={theme.muted}>
                  {name.length > 18 ? `${name.slice(0, 17)}…` : name}
                </text>
              );
            }}
          />
          <Tooltip
            cursor={{ fill: theme.grid, fillOpacity: 0.4 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const item = payload[0].payload as BarListItem;
              return (
                <ChartTooltipBox
                  title={item.hint ? `${item.label} · ${item.hint}` : item.label}
                  rows={[{ label: valueLabel, value: valueFormat(item.value) }]}
                />
              );
            }}
          />
          <Bar
            dataKey="value"
            barSize={18}
            isAnimationActive={false}
            shape={(props: unknown) => {
              const { x, y, width, height: h, index } = props as { x: number; y: number; width: number; height: number; index: number };
              const fill = highlight === undefined || highlight === index ? theme.slot(0) : theme.deemphasis;
              const r = Math.max(0, Math.min(4, width / 2));
              if (width <= 0) return <g />;
              return (
                <path
                  d={`M${x},${y} H${x + width - r} Q${x + width},${y} ${x + width},${y + r} V${y + h - r} Q${x + width},${y + h} ${x + width - r},${y + h} H${x} Z`}
                  fill={fill}
                />
              );
            }}
          >
            <LabelList dataKey="value" position="right" offset={8} fontSize={12} className="fill-foreground" formatter={(v: number) => valueFormat(v)} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
