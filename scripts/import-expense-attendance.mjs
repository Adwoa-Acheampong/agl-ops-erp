#!/usr/bin/env node
/**
 * Import the May 2026 expense and attendance ledgers.
 *
 * Usage on cPanel:
 *   node scripts/import-expense-attendance.mjs --verify
 *   node scripts/import-expense-attendance.mjs
 *
 * Attendance ROLE cells in the workbook are intentionally ignored. Roles are
 * read from the live staff roster for the selected tenant and written into the
 * historical staff_attendance.role column from there.
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { getDbConnection } from './_db.mjs';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const argv = process.argv.slice(2);
const hasFlag = (name) => argv.includes(`--${name}`);
const getOpt = (name, def = null) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : def;
};

const DRY_RUN = hasFlag('dry-run');
const VERIFY = hasFlag('verify');
const TENANT_NAME = getOpt('tenant', 'Automobiles Ghana Limited');
const EXPENSE_FILE = getOpt('expense-file', 'AGL_May2026_Expense_Ledger.xlsx');
const ATTENDANCE_FILE = getOpt('attendance-file', 'AGL_May2026_Attendance_Ledger.xlsx');

const DEFAULT_ALIASES = new Map([
  ['benjamin', 'ben'],
  ['christopher', 'chris'],
  ['nana kojo', 'kojo'],
]);
for (const raw of argv.filter((a) => a.startsWith('--alias='))) {
  const pair = raw.slice('--alias='.length);
  const i = pair.indexOf(':');
  if (i > 0) DEFAULT_ALIASES.set(normName(pair.slice(0, i)), normName(pair.slice(i + 1)));
}

function norm(s) {
  return String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

function normName(s) {
  return norm(s).replace(/[^a-z0-9 ]/g, '');
}

function cell(row, idx) {
  if (idx < 0) return null;
  const value = row[idx];
  if (value == null) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
}

function money(value) {
  if (value == null) return null;
  const n = Number.parseFloat(String(value).replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? Number(n.toFixed(2)) : null;
}

function parseDate(value) {
  if (value == null) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  }
  const text = String(value).trim();
  let m = text.match(/^(\d{1,2})[/. -](\d{1,2})[/. -](\d{4})$/);
  if (m) {
    const d = Number(m[1]);
    const mo = Number(m[2]);
    const y = Number(m[3]);
    if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12) {
      return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
  }
  m = text.match(/^(\d{4})[/. -](\d{1,2})[/. -](\d{1,2})$/);
  if (m) return `${m[1]}-${String(Number(m[2])).padStart(2, '0')}-${String(Number(m[3])).padStart(2, '0')}`;
  return null;
}

function parseTime(value) {
  if (value == null) return null;
  const text = String(value).trim();
  if (!text) return null;
  const m = text.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const hh = Math.min(23, Math.max(0, Number(m[1])));
  const mm = Math.min(59, Math.max(0, Number(m[2])));
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function computeHours(clockIn, clockOut, explicit) {
  const fromSheet = money(explicit);
  if (fromSheet != null) return fromSheet;
  if (!clockIn || !clockOut || clockIn === '00:00' || clockOut === '00:00') return null;
  const [ah, am] = clockIn.split(':').map(Number);
  const [bh, bm] = clockOut.split(':').map(Number);
  const diff = (bh * 60 + bm) - (ah * 60 + am);
  return diff > 0 ? Number((diff / 60).toFixed(2)) : null;
}

function externalId(prefix, sheetName, rowNumber, values) {
  return crypto.createHash('sha1').update(JSON.stringify({ prefix, sheetName, rowNumber, values })).digest('hex');
}

function readSheet(file, wanted) {
  const abs = path.resolve(process.cwd(), file);
  if (!fs.existsSync(abs)) throw new Error(`Missing workbook: ${abs}`);
  const wb = XLSX.readFile(abs, { raw: false, cellDates: true });
  const sheetName = wb.SheetNames.find((n) => wanted.test(n)) || wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false });
  const headerIdx = aoa.findIndex((row) => row.some((value) => norm(value) === 'date'));
  if (headerIdx < 0) throw new Error(`Could not find DATE header in ${file}`);
  const headers = aoa[headerIdx].map(norm);
  const col = (...names) => {
    for (const name of names) {
      const i = headers.indexOf(norm(name));
      if (i >= 0) return i;
    }
    return -1;
  };
  return { sheetName, rows: aoa, headerIdx, col };
}

function parseExpenses(file) {
  const s = readSheet(file, /expense/i);
  const c = {
    date: cidx(s, 'DATE'),
    category: cidx(s, 'CATEGORY'),
    description: cidx(s, 'DESCRIPTION'),
    vendor: s.col('VENDOR / PAID TO', 'VENDOR', 'PAID TO'),
    amount: cidx(s, 'AMOUNT (GHS)', 'AMOUNT'),
    notes: s.col('NOTES', 'NOTE', 'REMARKS'),
  };
  const records = [];
  for (let i = s.headerIdx + 1; i < s.rows.length; i++) {
    const row = s.rows[i];
    const expenseDate = parseDate(cell(row, c.date));
    if (!expenseDate) continue;
    const amount = money(cell(row, c.amount));
    if (amount == null) continue;
    const values = row.map((v) => (v == null ? '' : String(v)));
    records.push({
      external_id: externalId('expense-may2026', s.sheetName, i + 1, values),
      expense_date: expenseDate,
      category: cell(row, c.category) || 'Other',
      description: cell(row, c.description) || '(no description)',
      amount,
      vendor: cell(row, c.vendor),
      notes: cell(row, c.notes),
    });
  }
  return records;
}

function cidx(sheet, ...names) {
  const idx = sheet.col(...names);
  if (idx < 0) throw new Error(`Missing required column: ${names.join(' / ')}`);
  return idx;
}

function parseAttendance(file) {
  const s = readSheet(file, /attendance/i);
  const c = {
    date: cidx(s, 'DATE'),
    staff: cidx(s, 'STAFF'),
    // ROLE is intentionally not read.
    clockIn: cidx(s, 'CLOCK IN'),
    clockOut: cidx(s, 'CLOCK OUT'),
    hours: s.col('HOURS', 'HOURS WORKED'),
  };
  const records = [];
  for (let i = s.headerIdx + 1; i < s.rows.length; i++) {
    const row = s.rows[i];
    const clockInDate = parseDate(cell(row, c.date));
    if (!clockInDate) continue;
    const sourceStaff = cell(row, c.staff);
    if (!sourceStaff) continue;
    const clockInTime = parseTime(cell(row, c.clockIn));
    const clockOutTime = parseTime(cell(row, c.clockOut));
    const hoursWorked = computeHours(clockInTime, clockOutTime, cell(row, c.hours));
    const values = row.map((v) => (v == null ? '' : String(v)));
    const notes = [];
    if (clockInTime === '00:00' || clockOutTime === '00:00') notes.push('00:00 = Not Recorded');
    records.push({
      external_id: externalId('attendance-may2026', s.sheetName, i + 1, values),
      sourceStaff,
      staffKey: normName(sourceStaff),
      clock_in_date: clockInDate,
      clock_in_time: clockInTime,
      clock_out_time: clockOutTime,
      hours_worked: hoursWorked,
      is_late: clockInTime && clockInTime !== '00:00' && clockInTime > '08:00' ? 1 : 0,
      notes: notes.length ? notes.join(' | ') : null,
    });
  }
  return records;
}

async function getColumns(conn, table) {
  const [rows] = await conn.query(`SHOW COLUMNS FROM \`${table}\``);
  return new Set(rows.map((r) => r.Field));
}

async function getTenant(conn) {
  const [rows] = await conn.query('SELECT id, businessName FROM tenants WHERE businessName = ? LIMIT 1', [TENANT_NAME]);
  if (!rows.length) throw new Error(`Tenant not found: ${TENANT_NAME}`);
  return rows[0];
}

async function getStaffMap(conn, tenantId) {
  const [rows] = await conn.query('SELECT id, name, role, status FROM staff WHERE tenantId = ?', [tenantId]);
  const byName = new Map();
  for (const row of rows) byName.set(normName(row.name), row);
  return { rows, byName };
}

function resolveStaff(record, staffMap) {
  const exact = staffMap.byName.get(record.staffKey);
  if (exact) return { member: exact, aliasUsed: false };
  const alias = DEFAULT_ALIASES.get(record.staffKey);
  const aliased = alias ? staffMap.byName.get(alias) : null;
  if (aliased) return { member: aliased, aliasUsed: true };
  return { member: null, aliasUsed: false };
}

async function upsert(conn, table, columns, records) {
  if (!records.length) return 0;
  const live = await getColumns(conn, table);
  const cols = columns.filter((c) => live.has(c));
  const updateCols = cols.filter((c) => c !== 'external_id');
  const sql =
    `INSERT INTO \`${table}\` (${cols.map((c) => `\`${c}\``).join(', ')}) VALUES ` +
    `(${cols.map(() => '?').join(', ')}) ` +
    `ON DUPLICATE KEY UPDATE ${updateCols.map((c) => `\`${c}\`=VALUES(\`${c}\`)`).join(', ')}`;
  let count = 0;
  for (const record of records) {
    await conn.query(sql, cols.map((c) => record[c] ?? null));
    count++;
  }
  return count;
}

const expenses = parseExpenses(EXPENSE_FILE);
const attendanceRaw = parseAttendance(ATTENDANCE_FILE);

console.log(`Parsed expenses: ${expenses.length}`);
console.log(`Parsed attendance: ${attendanceRaw.length}`);

if (DRY_RUN) {
  console.log('Expense sample:', expenses.slice(0, 3));
  console.log('Attendance sample:', attendanceRaw.slice(0, 3));
  process.exit(0);
}

const conn = await getDbConnection();
try {
  const tenant = await getTenant(conn);
  const staffMap = await getStaffMap(conn, tenant.id);

  const unmatched = [];
  const attendance = attendanceRaw.map((record) => {
    const { member, aliasUsed } = resolveStaff(record, staffMap);
    if (!member) {
      unmatched.push(record.sourceStaff);
      return null;
    }
    const notes = [record.notes];
    if (aliasUsed || normName(member.name) !== record.staffKey) notes.push(`Source staff: ${record.sourceStaff}`);
    return {
      external_id: record.external_id,
      staff_name: member.name,
      role: member.role,
      clock_in_date: record.clock_in_date,
      clock_in_time: record.clock_in_time,
      clock_out_time: record.clock_out_time,
      hours_worked: record.hours_worked,
      is_late: record.is_late,
      notes: notes.filter(Boolean).join(' | ') || null,
    };
  }).filter(Boolean);

  if (unmatched.length) {
    console.error('Unmatched attendance staff names:', [...new Set(unmatched)].sort().join(', '));
    console.error('Roster names:', staffMap.rows.map((r) => `${r.name} (${r.role})`).sort().join(', '));
    console.error('Add aliases with --alias=WorkbookName:RosterName or add staff to the roster, then rerun.');
    process.exit(1);
  }

  await conn.beginTransaction();
  const expenseCount = await upsert(conn, 'expenses', [
    'external_id', 'expense_date', 'category', 'description', 'amount', 'vendor', 'notes',
  ], expenses);
  const attendanceCount = await upsert(conn, 'staff_attendance', [
    'external_id', 'staff_name', 'role', 'clock_in_date', 'clock_in_time',
    'clock_out_time', 'hours_worked', 'is_late', 'notes',
  ], attendance);

  if (VERIFY) {
    await conn.rollback();
    console.log(`VERIFY OK (rolled back): expenses ${expenseCount}, attendance ${attendanceCount}`);
  } else {
    await conn.commit();
    console.log(`IMPORT OK: expenses ${expenseCount}, attendance ${attendanceCount}`);
  }
} catch (error) {
  try { await conn.rollback(); } catch {}
  console.error(error.message || error);
  process.exit(1);
} finally {
  await conn.end();
}
