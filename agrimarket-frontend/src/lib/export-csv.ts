import { api } from './api';

/**
 * Downloads what an administrator is looking at as a spreadsheet.
 *
 * The console answers "how is the platform doing" well; a company also has to
 * reconcile payouts, report numbers to a funder, and hand a ministry a list.
 * That work happens in Excel, so every long table can leave as CSV — the rows
 * currently filtered, not just the page on screen.
 */

export type CsvColumn<T> = {
  header: string;
  /** Returns the cell. Keep it flat: a spreadsheet has no nested objects. */
  value: (row: T) => string | number | boolean | null | undefined;
};

/** Escapes one cell. Excel needs doubled quotes, and a leading =/+/- is a formula. */
function cell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((c) => cell(c.header)).join(',');
  const body = rows.map((row) => columns.map((c) => cell(c.value(row))).join(','));
  // The BOM is what makes Excel open UTF-8 (₵, é, names) correctly
  return `﻿${[header, ...body].join('\r\n')}`;
}

export function downloadCsv(filename: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** A dated, readable filename: agrimart-orders-2026-09-21.csv */
export const csvFilename = (what: string) => `agrimart-${what}-${new Date().toISOString().slice(0, 10)}.csv`;

/**
 * Fetches every row matching the current filters, a page at a time, then
 * downloads them. `max` stops a mis-click pulling the whole database into the
 * browser; the caller is told how many rows were written.
 */
export async function exportTable<T>({
  endpoint,
  params = {},
  columns,
  filename,
  max = 5000,
  pageSize = 200,
}: {
  endpoint: string;
  params?: Record<string, string | number | boolean | undefined>;
  columns: CsvColumn<T>[];
  filename: string;
  max?: number;
  pageSize?: number;
}): Promise<number> {
  const rows: T[] = [];

  for (let page = 1; rows.length < max; page++) {
    const res = await api.get<T[]>(endpoint, { ...params, page, limit: pageSize });
    const batch = Array.isArray(res.data) ? res.data : [];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }

  const trimmed = rows.slice(0, max);
  downloadCsv(filename, toCsv(trimmed, columns));
  return trimmed.length;
}
