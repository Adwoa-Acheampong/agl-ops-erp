#!/usr/bin/env node
/**
 * Load the v2 product/service workbook (AGL_Product_List_2.xlsx) into the
 * live `inventory` table.
 *
 *   node scripts/import-inventory-v2.mjs --dry-run   # preview, writes nothing
 *   node scripts/import-inventory-v2.mjs --verify    # real upsert, then ROLLBACK
 *   node scripts/import-inventory-v2.mjs             # commit
 *
 * WHY everything lands in `inventory`
 * -----------------------------------
 * Both the Sales form (SalesPage) and the Workshop parts picker
 * (WorkshopPage) build their dropdowns from `trpc.inventory.list` — i.e.
 * straight off this table. The `service_catalog` table exists but its
 * router is an empty stub, so it feeds nothing yet. To make BOTH parts and
 * service types selectable in those dropdowns today, every row goes into
 * `inventory`; service rows are tagged `category = 'SERVICE'`, which the
 * dropdown shows in its sublabel so they're easy to tell apart.
 *
 * Idempotent UPSERT keyed on the UNIQUE `item_code`:
 *   - Rows WITH a PART NUMBER use it as item_code.
 *   - Rows WITHOUT one (services, the odd part) get a STABLE synthetic
 *     code derived from category + name/description (e.g. "SVC-OIL-CHANGE").
 *     Content-based, so a re-import upserts the same row instead of
 *     duplicating — as long as that row's text doesn't change.
 *
 * v2 columns vs the live `inventory` shape:
 *   PART NUMBER          -> item_code (synthetic when blank)
 *   BRAND + PART NAME/DESCRIPTION -> item_name
 *   DESCRIPTION          -> cleanDescription
 *   CATEGORY             -> category               (now includes "SERVICE")
 *   RETAIL PRICE (GHS)   -> unit_price             (blank -> 0.00; NOT NULL)
 *   STOCK QTY            -> quantity               (blank -> 0)
 *   CAR BRAND            -> vehicleMake            (new in v2)
 *   VEHICLE APPLICATION  -> vehicleModel
 *   YEAR RANGE           -> yearMin / yearMax
 *   ENGINE               -> engineCapacity
 *   CROSS REFERENCE + MATERIAL + SIZE + WHOLESALE PRICE -> notes (no own columns)
 *   STATUS               -> dropped (quantity is the source of truth on hand)
 *
 * Preserved on re-run (never nulled): min_stock_level, supplier,
 * last_restock_date — operator-owned in the UI, so they're left out of
 * both the INSERT and the ON DUPLICATE UPDATE.
 *
 * Drift-safe: the real column list is the intersection of what we map and
 * what `SHOW COLUMNS FROM inventory` reports live. Must run ON the cPanel
 * server (its MariaDB is localhost-only); --dry-run works anywhere.
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
// --verify runs the real upsert inside a transaction and then ROLLs BACK:
// exercises the full write path against the live schema without
// persisting. Ideal pre-flight on the server before the real run.
const VERIFY = hasFlag('verify');
// --replace makes this a full REPLACE of the catalog: after upserting the
// file, any inventory row whose item_code isn't in the file is deleted
// (FK children in inventory_fitment cleared first). Use it to swap out an
// older product list. Off by default so a plain run only adds/updates.
const REPLACE = hasFlag('replace');
const FILE = getOpt('file', positional[0] || 'AGL_Product_List_2.xlsx');
const SHEET = getOpt('sheet', null);
const SAMPLE = Math.max(0, parseInt(getOpt('limit', '15'), 10) || 0);

// ──────────────────────── Read workbook ────────────────────────
const abs = path.resolve(process.cwd(), FILE);
if (!fs.existsSync(abs)) {
  console.error(`No such file: ${abs}`);
  console.error('Pass the workbook path, e.g. --file=AGL_Product_List_2.xlsx');
  process.exit(2);
}

const wb = XLSX.readFile(abs, { cellDates: true });
const sheetName = SHEET || wb.SheetNames.find((n) => /product|service/i.test(n)) || wb.SheetNames[0];
const ws = wb.Sheets[sheetName];
if (!ws) {
  console.error(`Sheet ${JSON.stringify(sheetName)} not found. Available: ${JSON.stringify(wb.SheetNames)}`);
  process.exit(2);
}
const rawRows = XLSX.utils.sheet_to_json(ws, { defval: null, raw: false });

// ──────────────────────── Column access (header-drift tolerant) ──────
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

function num(v) {
  if (v == null) return null;
  const n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

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

/** Uppercase A-Z0-9 slug; runs of other chars collapse to a single dash. */
function slug(s) {
  return String(s)
    .toUpperCase()
    .normalize('NFKD')
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Short, readable category prefix for synthetic codes. */
function categoryPrefix(category) {
  const c = slug(category || '');
  if (c === 'SERVICE' || c.startsWith('SERVICE')) return 'SVC';
  return c.replace(/-/g, '').slice(0, 4) || 'ITEM';
}

/** Build a stable synthetic item_code for a row with no PART NUMBER. */
function syntheticCode(category, label) {
  const code = `${categoryPrefix(category)}-${slug(label || 'item')}`;
  return truncate(code, 50).replace(/-+$/, '');
}

// ──────────────────────── Build records ────────────────────────
// Keys = exact live `inventory` column names. min_stock_level / supplier /
// last_restock_date are intentionally absent (operator-owned).
const CANDIDATE_COLS = [
  'item_code', 'item_name', 'category', 'unit_price', 'quantity',
  'cleanDescription', 'vehicleMake', 'vehicleModel', 'yearMin', 'yearMax',
  'engineCapacity', 'notes',
];

const byCode = new Map(); // item_code -> record (last row wins on in-file dupes)
const dupeCodes = [];
let realCoded = 0;        // rows that had a real PART NUMBER
let synthCoded = 0;       // rows given a synthetic code
const byCategory = new Map();

for (const row of rawRows) {
  // A row is meaningful if it has *some* identifying text. Skip only the
  // truly empty rows (no category, no description, no part number).
  const category = pick(row, 'CATEGORY', 'CAT');
  const description = pick(row, 'DESCRIPTION', 'DESC');
  const partNumber = pick(row, 'PART NUMBER', 'PART NO', 'PART#', 'PARTNUMBER');
  const partName = pick(row, 'PART NAME', 'PARTNAME');
  if (!category && !description && !partNumber && !partName) continue;

  const brand = pick(row, 'BRAND');
  const carBrand = pick(row, 'CAR BRAND', 'CARBRAND', 'MAKE');
  const crossRef = pick(row, 'CROSS REFERENCE', 'CROSS REF', 'CROSS-REFERENCE');
  const material = pick(row, 'MATERIAL');
  const size = pick(row, 'SIZE');
  const wholesale = pick(row, 'WHOLESALE PRICE (GHS)', 'WHOLESALE PRICE', 'WHOLESALE');
  const { yearMin, yearMax } = parseYearRange(pick(row, 'YEAR RANGE', 'YEAR', 'YEARS'));

  // For SERVICE rows the DESCRIPTION column holds a repeated section
  // banner ("MECHANICAL LABOUR PRICE LIST"), not a real description — the
  // service's actual name lives in PART NAME. So services name from PART
  // NAME only and get no cleanDescription.
  const isService = /service/i.test(category || '');

  // Human-readable name: brand + (part name or description), falling back
  // to the part number. Always non-empty (item_name is NOT NULL).
  const nameCore = partName || (isService ? null : description);
  const item_name = truncate([brand, nameCore].filter(Boolean).join(' ') || partNumber || 'Item', 255);

  // item_code: real part number, else a stable synthetic one.
  let item_code;
  if (partNumber) {
    item_code = truncate(partNumber, 50);
    realCoded++;
  } else {
    item_code = syntheticCode(category, nameCore || brand);
    synthCoded++;
  }

  // Homeless-but-useful columns get folded into notes.
  const noteParts = [];
  if (crossRef) noteParts.push(`Cross-ref: ${crossRef}`);
  if (material) noteParts.push(`Material: ${material}`);
  if (size) noteParts.push(`Size: ${size}`);
  if (wholesale) noteParts.push(`Wholesale: GHS ${wholesale}`);

  const rec = {
    item_code,
    item_name,
    category: truncate(category || 'Uncategorized', 100),
    unit_price: num(pick(row, 'RETAIL PRICE (GHS)', 'RETAIL PRICE', 'RETAIL', 'PRICE (GHS)', 'PRICE')) ?? 0,
    quantity: num(pick(row, 'STOCK QTY', 'STOCK', 'QTY', 'QUANTITY')) ?? 0,
    cleanDescription: isService ? null : truncate(description, 255),
    vehicleMake: truncate(carBrand, 120),
    vehicleModel: truncate(pick(row, 'VEHICLE APPLICATION', 'VEHICLE', 'APPLICATION'), 255),
    yearMin,
    yearMax,
    engineCapacity: truncate(pick(row, 'ENGINE', 'ENGINE CAPACITY'), 64),
    notes: noteParts.length ? noteParts.join(' | ') : null,
  };

  if (byCode.has(item_code)) dupeCodes.push(item_code);
  byCode.set(item_code, rec);
  byCategory.set(rec.category, (byCategory.get(rec.category) || 0) + 1);
}

const records = [...byCode.values()];

// ──────────────────────── Report ────────────────────────
console.log(`File   : ${abs}`);
console.log(`Sheet  : ${JSON.stringify(sheetName)}  (raw rows: ${rawRows.length})`);
console.log(`Parsed : ${records.length} unique item(s)  [real codes: ${realCoded}, synthetic codes: ${synthCoded}]`);
console.log(`In-file duplicate codes collapsed (last wins): ${dupeCodes.length}`);
if (dupeCodes.length) console.log('  ' + [...new Set(dupeCodes)].sort().join(', '));
console.log('By category:');
for (const [cat, n] of [...byCategory.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${cat.padEnd(16)} ${n}`);
}

if (SAMPLE > 0) {
  console.log(`\n— Sample of first ${Math.min(SAMPLE, records.length)} transformed record(s) —`);
  for (const r of records.slice(0, SAMPLE)) console.log('  ' + JSON.stringify(r));
  const services = records.filter((r) => /service/i.test(r.category));
  if (services.length) {
    console.log(`\n— Sample SERVICE rows (${services.length} total) —`);
    for (const r of services.slice(0, 8)) console.log('  ' + JSON.stringify(r));
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
  console.error('\nNothing to import.');
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
  const codes = records.map((r) => r.item_code);
  const colList = cols.map(escId).join(', ');
  const updateClause = cols
    .filter((c) => c !== 'item_code')
    .map((c) => `${escId(c)}=VALUES(${escId(c)})`)
    .join(', ');

  // One atomic transaction wraps upsert + (optional) prune so the table is
  // never left half-replaced. --verify rolls it back; otherwise we commit.
  await conn.beginTransaction();

  const [[{ n: before }]] = await conn.query(`SELECT COUNT(*) AS n FROM ${escId(TABLE)}`);
  const sql = `INSERT INTO ${escId(TABLE)} (${colList}) VALUES ? ON DUPLICATE KEY UPDATE ${updateClause}`;
  await conn.query(sql, [values]);
  const [[{ n: mid }]] = await conn.query(`SELECT COUNT(*) AS n FROM ${escId(TABLE)}`);

  let pruned = 0;
  if (REPLACE) {
    // Delete FK children of rows we're about to remove, then the rows
    // whose code isn't in the new file.
    const [ft] = await conn.query("SHOW TABLES LIKE 'inventory_fitment'");
    if (ft.length) {
      await conn.query(
        `DELETE f FROM \`inventory_fitment\` f
           JOIN ${escId(TABLE)} i ON i.id = f.inventoryItemId
          WHERE i.item_code NOT IN (?)`,
        [codes],
      );
    }
    const [del] = await conn.query(`DELETE FROM ${escId(TABLE)} WHERE item_code NOT IN (?)`, [codes]);
    pruned = del.affectedRows || 0;
  }

  const [[{ n: after }]] = await conn.query(`SELECT COUNT(*) AS n FROM ${escId(TABLE)}`);
  const insertedNew = mid - before;

  console.log(VERIFY ? '\n[verify] upsert exercised (will roll back):' : '\nUpsert complete.');
  console.log(`  columns written : ${cols.join(', ')}`);
  console.log(`  rows submitted  : ${values.length}`);
  console.log(`  newly inserted  : ${insertedNew}`);
  console.log(`  updated existing: ${values.length - insertedNew}`);
  if (REPLACE) console.log(`  pruned (not in file): ${pruned}`);
  console.log(`  inventory total : ${after}`);

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
