#!/usr/bin/env node
/**
 * Inject products from AGL_Product_List_1.xlsx into the inventory table.
 *
 *   - Upsert by item_code (PART NUMBER). Existing rows get patched
 *     (price + qty + description), missing rows are inserted.
 *   - Category names normalised to the canonical UI dropdown
 *     (ENGINE OIL → Engine Oil, SPARK PLUG → Spark Plugs, …).
 *   - Vehicle fitment (VEHICLE APPLICATION / YEAR RANGE / ENGINE)
 *     written into the structured columns the schema already carries.
 *
 *   node scripts/import-products.mjs [--dry-run] [--file=path.xlsx]
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';
import xlsx from 'xlsx';
import path from 'node:path';
import fs from 'node:fs';

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const file = args.find(a => a.startsWith('--file='))?.split('=')[1]
  ?? path.resolve(process.cwd(), 'AGL_Product_List_1.xlsx');

if (!fs.existsSync(file)) { console.error('No such file:', file); process.exit(2); }

const CATEGORY_MAP = {
  'ENGINE OIL':    'Engine Oil',
  'WIPER FLUID':   'Wiper Fluid',
  'FILTER':        'Filters',
  'SPARK PLUG':    'Spark Plugs',
  'FUEL PUMP':     'Fuel Pump',
  'OXYGEN SENSOR': 'Oxygen Sensor',
};

function normCat(raw) {
  if (!raw) return 'Engine and Drivetrain';
  const k = String(raw).trim().toUpperCase();
  return CATEGORY_MAP[k] ?? String(raw).trim();
}

function parseYearRange(s) {
  if (!s) return { min: null, max: null };
  const m = String(s).match(/(\d{4})\s*[-–—to]+\s*(\d{4})/i);
  if (m) return { min: parseInt(m[1], 10), max: parseInt(m[2], 10) };
  const single = String(s).match(/(\d{4})/);
  return single ? { min: parseInt(single[1], 10), max: parseInt(single[1], 10) } : { min: null, max: null };
}

function parseMakeModel(va) {
  if (!va) return { make: null, model: null };
  const s = String(va).trim();
  if (/^various$/i.test(s)) return { make: null, model: null };
  // "Toyota Corolla", "Honda Civic 1.5L", "Ford Ranger" → first token = make, rest = model
  const parts = s.split(/\s+/);
  const make = parts[0];
  const model = parts.slice(1).join(' ') || null;
  return { make, model };
}

const wb = xlsx.readFile(file);
const sheet = wb.Sheets[wb.SheetNames[0]];
const rows = xlsx.utils.sheet_to_json(sheet, { defval: null, raw: true });
console.log(`Read ${rows.length} rows from ${path.basename(file)} · sheet "${wb.SheetNames[0]}"`);

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required. Set it in your environment or .env before running this import.');
}

const conn = await mysql.createConnection({
  uri: process.env.DATABASE_URL,
});

let inserted = 0, updated = 0, skipped = 0;
const errors = [];

await conn.beginTransaction();
try {
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const partNumber = String(r['PART NUMBER'] ?? '').trim();
    if (!partNumber) { skipped += 1; continue; }
    const category = normCat(r['CATEGORY']);
    const brand    = r['BRAND'] ? String(r['BRAND']).trim() : null;
    const desc     = r['DESCRIPTION'] ? String(r['DESCRIPTION']).trim() : null;
    const xref     = r['CROSS REFERENCE'] ? String(r['CROSS REFERENCE']).trim() : null;
    const yr       = parseYearRange(r['YEAR RANGE']);
    const { make, model } = parseMakeModel(r['VEHICLE APPLICATION']);
    const engine   = r['ENGINE'] ? String(r['ENGINE']).trim() : null;
    const price    = Number(r['PRICE (GHS)'] ?? 0) || 0;
    const qty      = r['STOCK QTY'] != null ? (parseInt(r['STOCK QTY'], 10) || 0) : 0;

    const itemName = brand
      ? `${brand} ${partNumber}${desc ? ' — ' + desc : ''}`
      : `${partNumber}${desc ? ' — ' + desc : ''}`;
    const itemCode = partNumber.slice(0, 50);
    const clean    = (desc || partNumber).slice(0, 255);

    // Build the values object explicitly so we can either INSERT or
    // UPDATE without re-keying. ItemCode is unique → ON DUPLICATE KEY.
    const noteBits = [];
    if (xref)   noteBits.push(`xref: ${xref}`);
    if (engine) noteBits.push(`engine: ${engine}`);
    const notes = noteBits.length ? noteBits.join(' · ') : null;

    if (DRY) { inserted += 1; continue; }

    // Check whether row exists; UPDATE qty + price + descriptive fields.
    // Inventory is not multi-tenant in this schema, so no tenantId guard.
    const [existing] = await conn.query(
      'SELECT id, quantity FROM inventory WHERE item_code = ? LIMIT 1',
      [itemCode]
    );
    if (existing.length > 0) {
      await conn.query(
        `UPDATE inventory SET
          item_name = ?, category = ?, quantity = ?, unit_price = ?,
          supplier = ?, notes = ?, vehicleMake = ?, vehicleModel = ?,
          yearMin = ?, yearMax = ?, engineCapacity = ?, cleanDescription = ?
        WHERE id = ?`,
        [itemName.slice(0, 255), category, qty, price, brand, notes,
         make, model, yr.min, yr.max, engine, clean, existing[0].id]
      );
      updated += 1;
    } else {
      await conn.query(
        `INSERT INTO inventory
          (item_name, item_code, category, quantity, min_stock_level, unit_price,
           supplier, notes, vehicleMake, vehicleModel, yearMin, yearMax, engineCapacity, cleanDescription)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [itemName.slice(0, 255), itemCode, category, qty, 1, price,
         brand, notes, make, model, yr.min, yr.max, engine, clean]
      );
      inserted += 1;
    }
  }
  if (!DRY) await conn.commit();
  console.log(`\nImport ${DRY ? 'plan (dry-run)' : 'complete'}:`);
  console.log(`  Inserted: ${inserted}`);
  console.log(`  Updated:  ${updated}`);
  console.log(`  Skipped:  ${skipped}`);
  if (errors.length) console.log(`  Errors:   ${errors.length}\n  ${errors.slice(0, 5).join('\n  ')}`);
} catch (err) {
  await conn.rollback();
  console.error('Rolled back —', err.message);
  process.exitCode = 1;
}
await conn.end();
