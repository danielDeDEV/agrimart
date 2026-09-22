'use client';

import * as React from 'react';
import { Area, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartLegend, ChartTooltipBox, axisProps, useChartTheme } from './chart-kit';

export interface TrendSeries {
  key: string;
  label: string;
  /** Fixed palette slot for this entity — never derived from its position in a filtered list. */
  slot: number;
}

/**
 * Time-series line chart. 2px lines, a 10% area wash for a single series, a
 * crosshair that snaps to the nearest date, and one tooltip listing every
 * series. Two or more series get a legend; one series is named by its card title.
 */
export function TrendChart({
  data,
  xKey,
  series,
  height = 280,
  valueFormat = (v) => v.toLocaleString('en-GH'),
  xFormat = (v) => v,
}: {
  data: Record<string, unknown>[];
  xKey: string;
  series: TrendSeries[];
  height?: number;
  valueFormat?: (value: number) => string;
  xFormat?: (value: string) => string;
}) {
  const theme = useChartTheme();
  const single = series.length === 1;

  return (
    <div>
      {!single && (
        <ChartLegend
          className="px-3 pb-2"
          items={series.map((s) => ({ label: s.label, color: theme.slot(s.slot), shape: 'line' }))}
        />
      )}
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 12, right: 20, bottom: 4, left: 4 }}>
            <CartesianGrid vertical={false} stroke={theme.grid} strokeWidth={1} />
            <XAxis dataKey={xKey} {...axisProps(theme)} minTickGap={32} tickFormatter={(v: string) => xFormat(String(v))} />
            <YAxis {...axisProps(theme)} axisLine={false} width={52} allowDecimals={false} tickFormatter={(v: number) => valueFormat(v)} />
            <Tooltip
              cursor={{ stroke: theme.axis, strokeWidth: 1 }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0].payload as Record<string, unknown>;
                return (
                  <ChartTooltipBox
                    title={xFormat(String(label))}
                    rows={series.map((s) => ({
                      label: s.label,
                      value: valueFormat(Number(row[s.key] ?? 0)),
                      color: theme.slot(s.slot),
                    }))}
                  />
                );
              }}
            />
            {single && (
              <Area
                dataKey={series[0].key}
                stroke="none"
                fill={theme.slot(series[0].slot)}
                fillOpacity={0.1}
                isAnimationActive={false}
                activeDot={false}
              />
            )}
            {series.map((s) => (
              <Line
                key={s.key}
                dataKey={s.key}
                stroke={theme.slot(s.slot)}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                dot={false}
                activeDot={{ r: 4, fill: theme.slot(s.slot), stroke: theme.surface, strokeWidth: 2 }}
                isAnimationActive={false}
              />
            ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
