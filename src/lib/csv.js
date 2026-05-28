/**
 * CSV — tiny client-side exporter
 * ──────────────────────────────────────────────────────────────────────────
 *   import { downloadCSV } from '@/lib/csv';
 *
 *   downloadCSV('orders.csv', rows, [
 *     { key: 'id',         label: 'Order ID' },
 *     { key: 'total_price',label: 'Total',    fmt: (v) => v.toFixed(2) },
 *   ]);
 *
 * No deps — works in every modern browser.
 */

function escape(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (s.includes('"') || s.includes(',') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function rowsToCSV(rows, columns) {
  const header = columns.map(c => escape(c.label ?? c.key)).join(',');
  const body = rows.map(row =>
    columns.map(c => {
      const raw = typeof c.value === 'function' ? c.value(row) : row[c.key];
      const formatted = c.fmt ? c.fmt(raw, row) : raw;
      return escape(formatted);
    }).join(',')
  ).join('\n');
  return `${header}\n${body}`;
}

export function downloadCSV(filename, rows, columns) {
  const csv = rowsToCSV(rows, columns);
  // BOM so Excel renders UTF-8 (₹, emojis) properly
  const blob = new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
