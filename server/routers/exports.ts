import mysql from 'mysql2/promise';
import * as XLSX from 'xlsx';
import { z } from 'zod';
import { adminProcedure, router } from '../_core/trpc';

type ExportFormat = 'csv' | 'xlsx';

const EXPORT_TARGETS = [
  { key: 'sales', label: 'Sales ledger', tables: ['sales_transactions'] },
  { key: 'inventory', label: 'Inventory ledger', tables: ['inventory'] },
  { key: 'inventory_movements', label: 'Inventory movements', tables: ['appointment_parts', 'stock_issue_requests'] },
  { key: 'expenses', label: 'Expenses ledger', tables: ['expenses'] },
  { key: 'purchase_orders', label: 'Purchase orders', tables: ['purchase_orders'] },
  { key: 'creditors', label: 'Creditors / credit sales', tables: ['credit_sales', 'payables'] },
  { key: 'cash_transactions', label: 'Cash / transaction ledger', tables: ['transactions'] },
  { key: 'workshop', label: 'Workshop ledger', tables: ['service_appointments', 'appointment_parts', 'appointment_diagnostics', 'appointment_recalls', 'workshop_jobs'] },
  { key: 'customers', label: 'Customers', tables: ['customers'] },
  { key: 'vehicles', label: 'Vehicles', tables: ['vehicles'] },
  { key: 'hr_attendance', label: 'Attendance ledger', tables: ['staff_attendance', 'staff_attendance_logs'] },
  { key: 'payroll', label: 'Payroll ledger', tables: ['payroll_runs'] },
  { key: 'staff', label: 'Staff roster and records', tables: ['staff', 'staff_documents', 'staff_training', 'staff_schedules', 'staff_performance'] },
  { key: 'tasks_training', label: 'Tasks and training', tables: ['tasks', 'staff_training'] },
  { key: 'marketing', label: 'Marketing tracker', tables: ['marketing_spend'] },
  { key: 'daily_entries', label: 'Daily entry log', tables: ['daily_entries'] },
  { key: 'audit', label: 'Audit logs', tables: ['audit_log'] },
] as const;

const TARGET_BY_KEY = new Map(EXPORT_TARGETS.map((t) => [t.key, t]));

function q(name: string) {
  return '`' + String(name).replace(/`/g, '``') + '`';
}

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
}

function normalizeCell(value: unknown) {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return value.toString('base64');
  if (typeof value === 'object') return JSON.stringify(value);
  return value as string | number | boolean;
}

function csvCell(value: unknown) {
  const s = String(normalizeCell(value));
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

function rowsToCsv(rows: Record<string, unknown>[]) {
  const cols = rows.length ? Object.keys(rows[0]) : [];
  const head = cols.map(csvCell).join(',');
  const body = rows.map((row) => cols.map((col) => csvCell(row[col])).join(',')).join('\r\n');
  return `${head}\r\n${body}\r\n`;
}

function sheetName(name: string, used: Set<string>) {
  const base = String(name).replace(/[\[\]\*\/\\?:]/g, '_').slice(0, 31) || 'Export';
  let out = base;
  let i = 1;
  while (used.has(out)) {
    const suffix = `_${i++}`;
    out = base.slice(0, 31 - suffix.length) + suffix;
  }
  used.add(out);
  return out;
}

function sanitizeFileName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'export';
}

function crc32(buf: Buffer) {
  let crc = -1;
  for (const byte of buf) {
    let c = (crc ^ byte) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ -1) >>> 0;
}

function dosDateTime(date = new Date()) {
  const year = Math.max(1980, date.getFullYear());
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { dosDate, dosTime };
}

function makeZip(files: Array<{ name: string; data: Buffer }>) {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  const { dosDate, dosTime } = dosDateTime();

  for (const file of files) {
    const name = Buffer.from(file.name);
    const data = file.data;
    const crc = crc32(data);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(dosTime, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, name, data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(dosTime, 12);
    central.writeUInt16LE(dosDate, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(data.length, 20);
    central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);

    offset += local.length + name.length + data.length;
  }

  const centralOffset = offset;
  const central = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(central.length, 12);
  end.writeUInt32LE(centralOffset, 16);
  end.writeUInt16LE(0, 20);
  return Buffer.concat([...localParts, central, end]);
}

async function connect() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  return await mysql.createConnection(process.env.DATABASE_URL);
}

async function existingTables(conn: mysql.Connection) {
  const [rows] = await conn.query<any[]>('SHOW FULL TABLES WHERE Table_type = "BASE TABLE"');
  const key = Object.keys(rows[0] ?? {}).find((k) => k.startsWith('Tables_in_'));
  return key ? rows.map((row) => String(row[key])) : [];
}

async function readTables(conn: mysql.Connection, tables: string[]) {
  const all = await existingTables(conn);
  const existing = tables.filter((table) => all.includes(table));
  const result: Array<{ table: string; rows: Record<string, unknown>[] }> = [];
  for (const table of existing) {
    const [rows] = await conn.query<Record<string, unknown>[]>(`SELECT * FROM ${q(table)}`);
    result.push({ table, rows });
  }
  return result;
}

function xlsxBuffer(data: Array<{ table: string; rows: Record<string, unknown>[] }>) {
  const wb = XLSX.utils.book_new();
  const used = new Set<string>();
  for (const part of data) {
    const rows = part.rows.map((row) => {
      const out: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(row)) out[key] = normalizeCell(value);
      return out;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, sheetName(part.table, used));
  }
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

function csvZipBuffer(data: Array<{ table: string; rows: Record<string, unknown>[] }>) {
  return makeZip(data.map((part) => ({
    name: `${part.table}.csv`,
    data: Buffer.from('\ufeff' + rowsToCsv(part.rows), 'utf8'),
  })));
}

export const exportsRouter = router({
  listTargets: adminProcedure.query(() => ({
    ledgers: EXPORT_TARGETS,
    fullBackup: { key: 'full_erp_backup', label: 'Full ERP backup' },
    formats: ['csv', 'xlsx'] as ExportFormat[],
  })),

  download: adminProcedure
    .input(z.object({
      key: z.string(),
      format: z.enum(['csv', 'xlsx']),
    }))
    .mutation(async ({ input }) => {
      const conn = await connect();
      try {
        const all = await existingTables(conn);
        const target = input.key === 'full_erp_backup'
          ? { key: 'full_erp_backup', label: 'Full ERP backup', tables: all }
          : TARGET_BY_KEY.get(input.key);
        if (!target) throw new Error(`Unknown export target: ${input.key}`);

        const data = await readTables(conn, [...target.tables]);
        const fileBase = `${sanitizeFileName(target.label)}-${stamp()}`;

        if (input.format === 'xlsx') {
          const buf = xlsxBuffer(data);
          return {
            filename: `${fileBase}.xlsx`,
            mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            base64: buf.toString('base64'),
          };
        }

        if (data.length === 1 && input.key !== 'full_erp_backup') {
          const buf = Buffer.from('\ufeff' + rowsToCsv(data[0].rows), 'utf8');
          return {
            filename: `${fileBase}.csv`,
            mime: 'text/csv;charset=utf-8',
            base64: buf.toString('base64'),
          };
        }

        const zip = csvZipBuffer(data);
        return {
          filename: `${fileBase}-csv.zip`,
          mime: 'application/zip',
          base64: zip.toString('base64'),
        };
      } finally {
        await conn.end();
      }
    }),
});
