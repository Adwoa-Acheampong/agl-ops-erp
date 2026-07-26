#!/usr/bin/env node
/**
 * Load the AGL monthly sales ledger workbook (e.g.
 * AGL_May2026_Sales_Ledger.xlsx) into the live `sales_transactions` table.
 *
 *   node scripts/import-sales.mjs --file=AGL_May2026_Sales_Ledger.xlsx --dry-run
 *   node scripts/import-sales.mjs --file=AGL_May2026_Sales_Ledger.xlsx --verify
 *   node scripts/import-sales.mjs --file=AGL_May2026_Sales_Ledger.xlsx
 *
 * Modelled on import-inventory-v2.mjs (same flags, same drift-safe upsert),
 * but the ledger layout needs special handling:
 *
 *   • BANNER ROW. Row 1 is a merged title ("AUTOMOBILES GHANA LIMITED — …"),
 *     so the real headers live on row 2. We read the sheet as an array of
 *     arrays and find the header row by locating the cell that says "DATE".
 *
 *   • DD/MM/YYYY DATES. The DATE column is Ghana-style day-first text
 *     ("01/05/2026" = 1 May 2026). JS Date would misread that as 5 Jan, so
 *     we parse the components by hand and emit a MySQL 'YYYY-MM-DD' string.
 *     A row without a parseable date is treated as non-data (this is what
 *     drops the LEGEND / "TOTAL ENTRIES" footer rows automatically).
 *
 *   • COMMA THOUSANDS. UNIT (GHS) is text like "2,000" / "1,400" — num()
 *     strips the separators.
 *
 *   • MOSTLY-BLANK TOTAL. The TOTAL (GHS) column is empty on ~90% of rows,
 *     so total_amount is COMPUTED: explicit total if present, else
 *     qty × unit, else 0 (the column is NOT NULL).
 *
 *   • ENUM NORMALISATION. CHANNEL / METHOD / STATUS are mapped onto the
 *     live enum values (see *_MAP below). 'Delivery' and 'Order' are real
 *     channels after migration 0009; 'Bank' → 'Bank Transfer'; anything
 *     still unknown falls back to a safe default and the raw value is kept
 *     in NOTES so nothing is silently lost.
 *
 * Idempotent UPSERT keyed on the UNIQUE `external_id`: each row gets a
 * stable SHA-1 of (sheet name + source row number + the row's own values).
 * Re-importing the SAME workbook updates the same rows instead of
 * duplicating them. (Row number is part of the key so two genuinely
 * identical lines — same day, customer, item, qty, price — stay two rows
 * rather than collapsing into one.)
 *
 * Ledger column  ->  sales_transactions column
 *   DATE            -> transaction_date          (DD/MM/YYYY -> YYYY-MM-DD)
 *   CUSTOMER        -> customer_name
 *   SALES REP       -> sales_rep
 *   MECHANIC        -> mechanic
 *   CHANNEL         -> channel                   (normalised)
 *   VEHICLE         -> vehicle
 *   ITEM / SERVICE  -> part_service              (NOT NULL; defaults to 'Item')
 *   QTY             -> quantity
 *   UNIT (GHS)      -> unit_price
 *   TOTAL (GHS)     -> total_amount              (computed when blank)
 *   METHOD          -> payment_method            (normalised)
 *   STATUS          -> status                    (normalised)
 *   NOTES           -> notes                     (+ any preserved raw enum)
 *
 * Not in the ledger (left NULL): customer_contact, receipt_no,
 * workmanship_fee.
 *
 * Drift-safe: the real column list is the intersection of what we map and
 * what `SHOW COLUMNS FROM sales_transactions` reports live. --dry-run works
 * anywhere; the real upsert must run where the DB is reachable (on cPanel
 * its MariaDB is localhost-only).
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { getDbConnection } from './_db.mjs';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const TABLE = 'sales_transactions';

// ──────────────────────── CLI args ────────────────────────
const argv = process.argv.slice(2);
const hasFlag = (name) => argv.includes(`--${name}`);
const getOpt = (name, def = null) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : def; // strip "--name="
};
const positional = argv.filter((a) => !a.startsWith('--'));

const DRY_RUN = hasFlag('dry-run');
// --verify runs the real upsert inside a transaction and then ROLLs BACK:
// exercises the full write path against the live schema without
// persisting. Ideal pre-flight on the server before the real run.
const VERIFY = hasFlag('verify');
const FILE = getOpt('file', positional[0] || 'AGL_May2026_Sales_Ledger.xlsx');
const SHEET = getOpt('sheet', null);
const SAMPLE = Math.max(0, parseInt(getOpt('limit', '12'), 10) || 0);
// Fallbacks for blank cells. Defaults match the app's own behaviour
// (NewSaleModal defaults channel to Walk-In; import.ts defaults status to
// Completed). Override per-run if a given ledger needs different ones.
const DEFAULT_CHANNEL = getOpt('default-channel', 'Walk-In');
const DEFAULT_STATUS = getOpt('default-status', 'Completed');
const DEFAULT_METHOD = getOpt('default-method', 'Cash');

// ──────────────────────── Read workbook ────────────────────────
const abs = path.resolve(process.cwd(), FILE);
if (!fs.existsSync(abs)) {
  console.error(`No such file: ${abs}`);
  console.error('Pass the workbook path, e.g. --file=AGL_May2026_Sales_Ledger.xlsx');
  process.exit(2);
}

// raw:false so every cell arrives as the string the sheet DISPLAYS — that
// keeps the DATE column as "01/05/2026" (day-first) for our own parser
// instead of letting XLSX guess a locale, and renders "2,000" verbatim.
const wb = XLSX.readFile(abs, { raw: false });
const sheetName = SHEET || wb.SheetNames.find((n) => /sales|ledger/i.test(n)) || wb.SheetNames[0];
const ws = wb.Sheets[sheetName];
if (!ws) {
  console.error(`Sheet ${JSON.stringify(sheetName)} not found. Available: ${JSON.stringify(wb.SheetNames)}`);
  process.exit(2);
}
const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false });

// ──────────────────────── Locate header row ────────────────────────
const norm = (s) => String(s == null ? '' : s).toLowerCase().replace(/\s+/g, ' ').trim();
const headerRowIdx = aoa.findIndex((r) => (r || []).some((c) => norm(c) === 'date'));
if (headerRowIdx < 0) {
  console.error('Could not find a header row containing "DATE". Sheet layout unexpected.');
  process.exit(2);
}
const headerRowNumber = headerRowIdx + 1; // 1-based, for the external_id key
const headers = (aoa[headerRowIdx] || []).map((c) => norm(c));

/** Column index for the first header alias that exists, else -1. */
function colIdx(...aliases) {
  for (const a of aliases) {
    const i = headers.indexOf(norm(a));
    if (i >= 0) return i;
  }
  return -1;
}
const CI = {
  date:    colIdx('DATE'),
  cust:    colIdx('CUSTOMER', 'CUSTOMER NAME', 'CLIENT'),
  rep:     colIdx('SALES REP', 'REP', 'SALESPERSON'),
  mech:    colIdx('MECHANIC', 'TECHNICIAN'),
  channel: colIdx('CHANNEL', 'SOURCE'),
  vehicle: colIdx('VEHICLE', 'CAR'),
  item:    colIdx('ITEM / SERVICE', 'ITEM/SERVICE', 'ITEM', 'PART / SERVICE', 'PART/SERVICE', 'DESCRIPTION'),
  qty:     colIdx('QTY', 'QUANTITY'),
  unit:    colIdx('UNIT (GHS)', 'UNIT', 'UNIT PRICE', 'PRICE'),
  total:   colIdx('TOTAL (GHS)', 'TOTAL', 'AMOUNT'),
  method:  colIdx('METHOD', 'PAYMENT METHOD', 'PAYMENT'),
  status:  colIdx('STATUS'),
  notes:   colIdx('NOTES', 'NOTE', 'REMARKS'),
};
if (CI.date < 0 || CI.item < 0) {
  console.error(`Required columns missing. Resolved indices: ${JSON.stringify(CI)}`);
  process.exit(2);
}

// ──────────────────────── Value helpers ────────────────────────
const cell = (row, idx) => {
  if (idx < 0) return null;
  const v = row[idx];
  if (v == null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
};
const truncate = (s, n) => (s == null ? null : s.length > n ? s.slice(0, n) : s);

/** Parse a money/qty string, tolerating thousands separators and "GHS". */
function num(v) {
  if (v == null) return null;
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
}
const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Parse a Ghana-style day-first date into a MySQL 'YYYY-MM-DD' string.
 * Accepts "DD/MM/YYYY" (also '-' or '.' separators) and a couple of common
 * fallbacks. Returns null when there is no real date — which is exactly how
 * we tell a data row apart from the LEGEND / TOTAL footer rows.
 */
function parseLedgerDate(v) {
  if (v == null) return null;
  if (v instanceof Date && !isNaN(v)) {
    return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, '0')}-${String(v.getDate()).padStart(2, '0')}`;
  }
  const s = String(v).trim();
  // DD/MM/YYYY (day-first) — the ledger's native format.
  let m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/);
  if (m) {
    const d = +m[1], mo = +m[2], y = +m[3];
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    return null;
  }
  // ISO YYYY-MM-DD passthrough.
  m = s.match(/^(\d{4})[\/.\-](\d{1,2})[\/.\-](\d{1,2})$/);
  if (m) return `${m[1]}-${String(+m[2]).padStart(2, '0')}-${String(+m[3]).padStart(2, '0')}`;
  return null;
}

// ──────────────────────── Enum normalisation ────────────────────────
// Keys are lower-cased/trimmed (via norm). Values are exact live enum
// members. Unmapped non-empty values fall back to the *_DEFAULT and the
// raw text is preserved in NOTES so a human can reclassify later.
const CHANNEL_MAP = {
  'walk-in': 'Walk-In', 'walkin': 'Walk-In', 'walk in': 'Walk-In',
  'whatsapp': 'WhatsApp', 'phone': 'Phone', 'instagram': 'Instagram',
  'tiktok': 'TikTok', 'boss': 'Boss',
  'delivery': 'Delivery', 'order': 'Order', // enabled by migration 0009
};
const METHOD_MAP = {
  'cash': 'Cash', 'momo': 'MoMo', 'mobile money': 'MoMo', 'mobile-money': 'MoMo',
  'bank': 'Bank Transfer', 'bank transfer': 'Bank Transfer', 'transfer': 'Bank Transfer',
  'credit': 'Credit', 'credit (pending)': 'Credit', 'pos': 'POS', 'card': 'POS',
};
const STATUS_MAP = {
  'completed': 'Completed', 'complete': 'Completed', 'done': 'Completed', 'paid': 'Completed',
  'pending payment': 'Pending Payment', 'pending': 'Pending', 'cancelled': 'Cancelled',
  'canceled': 'Cancelled', 'queued': 'Queued', 'awaiting': 'Awaiting', 'delivered': 'Delivered',
};

// ──────────────────────── Build records ────────────────────────
const CANDIDATE_COLS = [
  'external_id', 'transaction_date', 'customer_name', 'customer_contact',
  'channel', 'vehicle', 'part_service', 'quantity', 'unit_price',
  'total_amount', 'payment_method', 'receipt_no', 'sales_rep', 'mechanic',
  'status', 'workmanship_fee', 'notes',
];

const byExtId = new Map();   // external_id -> record (last wins on collision)
let skipped = 0;             // rows without a parseable date (footer/blank)
let remappedChannel = 0, remappedMethod = 0;
const seenChannel = new Map(), seenMethod = new Map(), seenStatus = new Map();
let completedTotal = 0, pendingTotal = 0;

for (let i = headerRowIdx + 1; i < aoa.length; i++) {
  const row = aoa[i] || [];
  const sourceRowNumber = i + 1; // 1-based spreadsheet row

  const transaction_date = parseLedgerDate(cell(row, CI.date));
  if (!transaction_date) { skipped++; continue; } // footer / legend / blank

  const rawChannel = cell(row, CI.channel);
  const rawMethod = cell(row, CI.method);
  const rawStatus = cell(row, CI.status);
  const customer = cell(row, CI.cust);
  const itemRaw = cell(row, CI.item);
  const vehicle = cell(row, CI.vehicle);
  const rep = cell(row, CI.rep);
  const mech = cell(row, CI.mech);
  const noteRaw = cell(row, CI.notes);

  // Numbers
  const qty = num(cell(row, CI.qty));
  const unit = num(cell(row, CI.unit));
  const explicitTotal = num(cell(row, CI.total));
  const qtyForCalc = qty ?? 1;
  let total_amount;
  if (explicitTotal != null) total_amount = round2(explicitTotal);
  else if (unit != null) total_amount = round2(qtyForCalc * unit);
  else total_amount = 0;

  // Enum normalisation (+ preserve raw when we had to guess)
  const notePreserve = [];
  let channel = CHANNEL_MAP[norm(rawChannel)];
  if (!channel) {
    channel = DEFAULT_CHANNEL;
    if (rawChannel) { remappedChannel++; notePreserve.push(`Channel: ${rawChannel}`); }
  }
  let payment_method = METHOD_MAP[norm(rawMethod)];
  if (!payment_method) {
    // Blank method: a still-pending sale is most likely on credit.
    if (!rawMethod && /pending/i.test(rawStatus || '')) payment_method = 'Credit';
    else payment_method = DEFAULT_METHOD;
    if (rawMethod) { remappedMethod++; notePreserve.push(`Method: ${rawMethod}`); }
  }
  let status = STATUS_MAP[norm(rawStatus)] || DEFAULT_STATUS;

  seenChannel.set(channel, (seenChannel.get(channel) || 0) + 1);
  seenMethod.set(payment_method, (seenMethod.get(payment_method) || 0) + 1);
  seenStatus.set(status, (seenStatus.get(status) || 0) + 1);
  if (/pending/i.test(status)) pendingTotal += total_amount; else completedTotal += total_amount;

  const notes = [noteRaw, ...notePreserve].filter(Boolean).join(' | ') || null;

  // Stable, idempotent key: sheet + source row + the row's own values.
  const keySrc = [
    sheetName, sourceRowNumber, transaction_date, customer || '', itemRaw || '',
    qty ?? '', unit ?? '', total_amount,
  ].join('|');
  const external_id = crypto.createHash('sha1').update(keySrc).digest('hex'); // 40 chars

  const rec = {
    external_id,
    transaction_date,
    customer_name: truncate(customer, 255),
    customer_contact: null,
    channel,
    vehicle: truncate(vehicle, 255),
    part_service: itemRaw || 'Item', // NOT NULL
    quantity: qty,
    unit_price: unit,
    total_amount,
    payment_method,
    receipt_no: null,
    sales_rep: truncate(rep, 100),
    mechanic: truncate(mech, 100),
    status,
    workmanship_fee: null,
    notes: truncate(notes, 65000),
  };
  byExtId.set(external_id, rec);
}

const records = [...byExtId.values()];

// ──────────────────────── Report ────────────────────────
const fmt = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
console.log(`File   : ${abs}`);
console.log(`Sheet  : ${JSON.stringify(sheetName)}  (header on row ${headerRowNumber})`);
console.log(`Parsed : ${records.length} sales row(s)   skipped (footer/blank/no-date): ${skipped}`);
console.log(`Enum remaps -> channel: ${remappedChannel}, method: ${remappedMethod} (raw kept in NOTES)`);
console.log(`Channels : ${JSON.stringify([...seenChannel.entries()].sort((a, b) => b[1] - a[1]))}`);
console.log(`Methods  : ${JSON.stringify([...seenMethod.entries()].sort((a, b) => b[1] - a[1]))}`);
console.log(`Statuses : ${JSON.stringify([...seenStatus.entries()].sort((a, b) => b[1] - a[1]))}`);
console.log(`Amount   : completed GHS ${fmt(completedTotal)}  |  pending GHS ${fmt(pendingTotal)}  |  grand GHS ${fmt(completedTotal + pendingTotal)}`);

if (SAMPLE > 0) {
  console.log(`\n— Sample of first ${Math.min(SAMPLE, records.length)} transformed record(s) —`);
  for (const r of records.slice(0, SAMPLE)) {
    console.log('  ' + JSON.stringify({
      date: r.transaction_date, cust: r.customer_name, ch: r.channel, item: r.part_service,
      qty: r.quantity, unit: r.unit_price, total: r.total_amount, pm: r.payment_method,
      st: r.status, notes: r.notes,
    }));
  }
}

const escId = (s) => '`' + String(s).replace(/`/g, '``') + '`';

async function liveColumns(conn) {
  const [rows] = await conn.query('SHOW COLUMNS FROM ??', [TABLE]);
  return new Set(rows.map((r) => r.Field));
}

// ──────────────────────── Dry run ────────────────────────
if (DRY_RUN) {
  if (process.env.DATABASE_URL) {
    try {
      const conn = await getDbConnection({});
      const live = await liveColumns(conn);
      const cols = CANDIDATE_COLS.filter((c) => live.has(c));
      const dropped = CANDIDATE_COLS.filter((c) => !live.has(c));
      const [[{ n }]] = await conn.query(`SELECT COUNT(*) AS n FROM ${escId(TABLE)}`);
      console.log(`\n[dry-run] live columns to write: ${cols.join(', ')}`);
      if (dropped.length) console.log(`[dry-run] mapped but NOT in live table (skipped): ${dropped.join(', ')}`);
      console.log(`[dry-run] current sales_transactions row count: ${n}`);
      await conn.end();
    } catch (e) {
      console.log(`\n[dry-run] DB not reachable from here (${e.code || e.message}); transformation preview only.`);
    }
  } else {
    console.log('\n[dry-run] DATABASE_URL not set — transformation preview only.');
    console.log('[dry-run] Run on the server to see the live-column intersection + row count.');
  }
  console.log(`\n[dry-run] No rows written. Re-run without --dry-run to upsert ${records.length} row(s).`);
  process.exit(0);
}

// ──────────────────────── Real upsert ────────────────────────
if (records.length === 0) {
  console.error('\nNothing to import.');
  process.exit(1);
}

const conn = await getDbConnection({});
try {
  const live = await liveColumns(conn);
  const cols = CANDIDATE_COLS.filter((c) => live.has(c));
  if (!cols.includes('external_id')) {
    throw new Error('live sales_transactions table has no external_id column — cannot upsert idempotently.');
  }

  const values = records.map((r) => cols.map((c) => r[c] ?? null));
  const colList = cols.map(escId).join(', ');
  const updateClause = cols
    .filter((c) => c !== 'external_id')
    .map((c) => `${escId(c)}=VALUES(${escId(c)})`)
    .join(', ');

  await conn.beginTransaction();
  const [[{ n: before }]] = await conn.query(`SELECT COUNT(*) AS n FROM ${escId(TABLE)}`);
  const sql = `INSERT INTO ${escId(TABLE)} (${colList}) VALUES ? ON DUPLICATE KEY UPDATE ${updateClause}`;
  await conn.query(sql, [values]);
  const [[{ n: after }]] = await conn.query(`SELECT COUNT(*) AS n FROM ${escId(TABLE)}`);
  const insertedNew = after - before;

  console.log(VERIFY ? '\n[verify] upsert exercised (will roll back):' : '\nUpsert complete.');
  console.log(`  columns written : ${cols.join(', ')}`);
  console.log(`  rows submitted  : ${values.length}`);
  console.log(`  newly inserted  : ${insertedNew}`);
  console.log(`  updated existing: ${values.length - insertedNew}`);
  console.log(`  sales total     : ${after}`);

  if (VERIFY) {
    await conn.rollback();
    console.log('\n[verify] rolled back — nothing persisted. Re-run without --verify to commit.');
  } else {
    await conn.commit();
  }
} catch (err) {
  console.error(`\nImport FAILED: ${err.message}`);
  try { await conn.rollback(); } catch { /* connection may be gone */ }
  await conn.end();
  process.exit(1);
}
await conn.end();
process.exit(0);
