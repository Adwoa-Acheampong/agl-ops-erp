#!/usr/bin/env node
/**
 * Load the cleaned product workbook into the live `inventory` table.
 *
 *   node scripts/import-inventory.mjs --dry-run            # preview, writes nothing
 *   node scripts/import-inventory.mjs                      # upsert into DATABASE_URL
 *   node scripts/import-inventory.mjs --file=AGL_Product_List_1.xlsx
 *
 * Inventory is the "ledger" — a constant the rest of the app reads from —
 * so this is an idempotent UPSERT keyed on the UNIQUE `item_code`
 * (= the workbook's PART NUMBER). Re-running re-applies the file as the
 * source of truth for the columns it owns (name, category, price,
 * quantity, fitment, notes) WITHOUT clobbering the columns an operator
 * maintains in the UI (min_stock_level, supplier, last_restock_date,
 * vehicleMake) — those are deliberately left out of both the INSERT and
 * the ON DUPLICATE UPDATE so a re-run never nulls them.
 *
 * Drift-safe: the real column list is the intersection of the columns we
 * map below and what `SHOW COLUMNS FROM inventory` reports live, so a DB
 * that's behind on migrations gets the subset it can take instead of a
 * hard "Unknown column" failure.
 *
 * xlsx note: the ESM namespace import of `xlsx` omits the fs-backed
 * `readFile`, so we pull the CJS build via createRequire — same trick the
 * inspect helper uses.
 *
 * Connectivity note: cPanel's MariaDB only listens on localhost, so the
 * real (non-dry-run) import has to run ON the server inside the node
 * venv, where DATABASE_URL is populated. `--dry-run` works anywhere and
 * only touches the DB if DATABASE_URL happens to be reachable.
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { getDbConnection } from './_db.mjs';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const TABLE = 'inventory';

// ──────────────────────── CLI args ────────────────────────
const argv = process.argv.slice(2);
const hasFlag = (name) => argv.includes(`--${name}`);
const getOpt = (name, def = null) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : def; // strip "--name="
};
const positional = argv.filter((a) => !a.startsWith('--'));

const DRY_RUN = hasFlag('dry-run');
// --verify runs the real upsert inside a transaction and then ROLLs BACK,
// so it exercises the full write path (and reports inserted/updated
// counts) against the live schema without persisting anything. Ideal as a
// pre-flight on the server before the real run.
const VERIFY = hasFlag('verify');
const FILE = getOpt('file', positional[0] || 'AGL_Product_List_1.xlsx');
const SHEET = getOpt('sheet', null);
const SAMPLE = Math.max(0, parseInt(getOpt('limit', '15'), 10) || 0);

// ──────────────────────── Read workbook ────────────────────────
const abs = path.resolve(process.cwd(), FILE);
if (!fs.existsSync(abs)) {
  console.error(`No such file: ${abs}`);
  console.error('Pass the workbook path, e.g. --file=AGL_Product_List_1.xlsx');
  process.exit(2);
}

const wb = XLSX.readFile(abs, { cellDates: true });
const sheetName = SHEET || wb.SheetNames.find((n) => /product/i.test(n)) || wb.SheetNames[0];
const ws = wb.Sheets[sheetName];
if (!ws) {
  console.error(`Sheet ${JSON.stringify(sheetName)} not found. Available: ${JSON.stringify(wb.SheetNames)}`);
  process.exit(2);
}
const rawRows = XLSX.utils.sheet_to_json(ws, { defval: null, raw: false });

// ──────────────────────── Column access (header-drift tolerant) ──────
// Normalise header names (lowercase, collapse whitespace) so a stray
// trailing space or case change in the spreadsheet header doesn't drop a
// whole column on the floor.
const norm = (s) => String(s).toLowerCase().replace(/\s+/g, ' ').trim();
const keyMap = new Map();
for (const k of Object.keys(rawRows[0] ?? {})) keyMap.set(norm(k), k);

/** First non-empty value among the given header aliases, trimmed. */
function pick(row, ...names) {
  for (const n of names) {
    const actual = keyMap.get(norm(n));
    if (actual != null) {
      const v = row[actual];
      if (v != null && String(v).trim() !== '') return String(v).trim();
    }
  }
  return null;
}

// ──────────────────────── Transform helpers ────────────────────────
const truncate = (s, n) => (s == null ? null : s.length > n ? s.slice(0, n) : s);

/** Parse a money/quantity cell → number, or null when unparseable. */
function num(v) {
  if (v == null) return null;
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse a YEAR RANGE cell into {yearMin, yearMax}.
 *   "2004–2015" / "2004-2015"  → 2004..2015
 *   "2016~" / "2016+" / "2016 onwards" → 2016..null  (open-ended)
 *   "2010"                     → 2010..2010 (single model year)
 *   ""                         → null..null
 * en-dash (–), em-dash (—) and tilde (~) are all handled.
 */
function parseYearRange(raw) {
  if (raw == null) return { yearMin: null, yearMax: null };
  const s = String(raw).trim();
  if (!s) return { yearMin: null, yearMax: null };
  const years = (s.match(/\d{4}/g) || []).map(Number).filter((y) => y >= 1900 && y <= 2100);
  if (years.length === 0) return { yearMin: null, yearMax: null };
  if (years.length === 1) {
    const openEnded = /[~+]\s*$/.test(s) || /[-–—]\s*$/.test(s) || /onwards?|present|current/i.test(s);
    return { yearMin: years[0], yearMax: openEnded ? null : years[0] };
  }
  return { yearMin: Math.min(...years), yearMax: Math.max(...years) };
}

// ──────────────────────── Build records ────────────────────────
// Keys here are the EXACT live `inventory` column names so we can map
// straight into the INSERT. Columns an operator owns in the UI
// (min_stock_level, supplier, last_restock_date, vehicleMake) are
// intentionally absent — DB defaults fill them on insert, and they're
// preserved untouched on update.
const CANDIDATE_COLS = [
  'item_code', 'item_name', 'category', 'unit_price', 'quantity',
  'cleanDescription', 'vehicleModel', 'yearMin', 'yearMax', 'engineCapacity', 'notes',
];

const byCode = new Map(); // item_code → record (last row wins on in-file dupes)
const skipped = [];        // rows with no PART NUMBER (can't key an upsert)
const dupeCodes = [];      // in-file duplicate PART NUMBERs (collapsed)

for (const row of rawRows) {
  const partNumber = pick(row, 'PART NUMBER', 'PART NO', 'PART#', 'PARTNUMBER');
  if (!partNumber) { skipped.push(row); continue; }

  const brand = pick(row, 'BRAND');
  const description = pick(row, 'DESCRIPTION', 'DESC');
  const { yearMin, yearMax } = parseYearRange(pick(row, 'YEAR RANGE', 'YEAR', 'YEARS'));
  const crossRef = pick(row, 'CROSS REFERENCE', 'CROSS REF', 'CROSS-REFERENCE');

  const item_code = truncate(partNumber, 50);
  const rec = {
    item_code,
    // item_name is NOT NULL: brand + description, falling back to the
    // part number so we always have something.
    item_name: truncate([brand, description].filter(Boolean).join(' ') || partNumber, 255),
    // category is NOT NULL: default rather than fail the row.
    category: truncate(pick(row, 'CATEGORY', 'CAT') || 'Uncategorized', 100),
    // unit_price is NOT NULL with no DB default — must always be set.
    unit_price: num(pick(row, 'PRICE (GHS)', 'PRICE', 'PRICE(GHS)')) ?? 0,
    quantity: num(pick(row, 'STOCK QTY', 'STOCK', 'QTY', 'QUANTITY')) ?? 0,
    cleanDescription: truncate(description, 255),
    vehicleModel: truncate(pick(row, 'VEHICLE APPLICATION', 'VEHICLE', 'APPLICATION'), 255),
    yearMin,
    yearMax,
    engineCapacity: truncate(pick(row, 'ENGINE', 'ENGINE CAPACITY'), 64),
    notes: crossRef ? `Cross-ref: ${crossRef}` : null,
  };

  if (byCode.has(item_code)) dupeCodes.push(item_code);
  byCode.set(item_code, rec);
}

const records = [...byCode.values()];

// ──────────────────────── Report ────────────────────────
console.log(`File   : ${abs}`);
console.log(`Sheet  : ${JSON.stringify(sheetName)}  (raw rows: ${rawRows.length})`);
console.log(`Parsed : ${records.length} unique item(s)`);
console.log(`Skipped: ${skipped.length} row(s) with no PART NUMBER`);
console.log(`In-file duplicate codes collapsed (last wins): ${dupeCodes.length}`);
if (dupeCodes.length) {
  console.log('  ' + [...new Set(dupeCodes)].sort().join(', '));
}

if (SAMPLE > 0) {
  console.log(`\n— Sample of first ${Math.min(SAMPLE, records.length)} transformed record(s) —`);
  for (const r of records.slice(0, SAMPLE)) console.log('  ' + JSON.stringify(r));
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
      console.log(`[dry-run] current inventory row count: ${n}`);
      await conn.end();
    } catch (e) {
      console.log(`\n[dry-run] DB not reachable from here (${e.code || e.message}); transformation preview only.`);
    }
  } else {
    console.log('\n[dry-run] DATABASE_URL not set — transformation preview only.');
    console.log('[dry-run] Run on the server (venv active) to see the live-column intersection + row count.');
  }
  console.log(`\n[dry-run] No rows written. Re-run without --dry-run to upsert ${records.length} item(s).`);
  process.exit(0);
}

// ──────────────────────── Real upsert ────────────────────────
if (records.length === 0) {
  console.error('\nNothing to import — no rows with a PART NUMBER.');
  process.exit(1);
}

const conn = await getDbConnection({});
try {
  const live = await liveColumns(conn);
  const cols = CANDIDATE_COLS.filter((c) => live.has(c));
  if (!cols.includes('item_code')) {
    throw new Error('live inventory table has no item_code column — cannot upsert.');
  }

  const values = records.map((r) => cols.map((c) => r[c] ?? null));
  const colList = cols.map(escId).join(', ');
  // Refresh every file-owned column on conflict; item_code is the key so
  // it never appears in the SET list.
  const updateClause = cols
    .filter((c) => c !== 'item_code')
    .map((c) => `${escId(c)}=VALUES(${escId(c)})`)
    .join(', ');

  if (VERIFY) await conn.beginTransaction();
  const [[{ n: before }]] = await conn.query(`SELECT COUNT(*) AS n FROM ${escId(TABLE)}`);
  const sql = `INSERT INTO ${escId(TABLE)} (${colList}) VALUES ? ON DUPLICATE KEY UPDATE ${updateClause}`;
  await conn.query(sql, [values]);
  const [[{ n: after }]] = await conn.query(`SELECT COUNT(*) AS n FROM ${escId(TABLE)}`);

  const inserted = after - before;
  console.log(VERIFY ? '\n[verify] upsert exercised (will roll back):' : '\nUpsert complete.');
  console.log(`  columns written : ${cols.join(', ')}`);
  console.log(`  rows submitted  : ${values.length}`);
  console.log(`  newly inserted  : ${inserted}`);
  console.log(`  updated existing: ${values.length - inserted}`);
  console.log(`  inventory total : ${after}`);

  if (VERIFY) {
    await conn.rollback();
    console.log('\n[verify] rolled back — nothing persisted. Re-run without --verify to commit.');
  }
} catch (err) {
  console.error(`\nImport FAILED: ${err.message}`);
  try { if (VERIFY) await conn.rollback(); } catch { /* connection may be gone */ }
  await conn.end();
  process.exit(1);
}
await conn.end();
process.exit(0);
