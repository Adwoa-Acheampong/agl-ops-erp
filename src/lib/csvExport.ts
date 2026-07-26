/**
 * Tiny CSV export helper.
 *
 * Quotes any field that contains a comma, double-quote, newline, or carriage
 * return. Doubles up internal double-quotes per RFC 4180. Triggers a browser
 * download via a blob URL — no extra dependencies required.
 */

export type CsvColumn<Row> = {
  /** Header text in the first row of the CSV. */
  header: string;
  /** Pure function returning the cell value for this column from a row. */
  value: (row: Row) => string | number | boolean | null | undefined;
};

const CELL_RE = /[",\r\n]/;

function csvCell(raw: string | number | boolean | null | undefined): string {
  if (raw === null || raw === undefined) return '';
  const s = typeof raw === 'string' ? raw : String(raw);
  if (CELL_RE.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function rowsToCsv<Row>(rows: Row[], columns: CsvColumn<Row>[]): string {
  const head = columns.map((c) => csvCell(c.header)).join(',');
  const body = rows
    .map((row) => columns.map((c) => csvCell(c.value(row))).join(','))
    .join('\r\n');
  return `${head}\r\n${body}\r\n`;
}

/**
 * Trigger a download of `csv` named `<filename>-<YYYY-MM-DD>.csv` in the user's browser.
 * Adds a UTF-8 BOM so Excel reads accented characters correctly.
 */
export function downloadCsv(filename: string, csv: string) {
  const stamp = new Date().toISOString().slice(0, 10);
  const fullName = filename.endsWith('.csv') ? filename : `${filename}-${stamp}.csv`;
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fullName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Convenience: build CSV text from rows + columns and immediately download it. */
export function exportRowsToCsv<Row>(
  filename: string,
  rows: Row[],
  columns: CsvColumn<Row>[],
) {
  downloadCsv(filename, rowsToCsv(rows, columns));
}
