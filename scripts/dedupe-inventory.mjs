#!/usr/bin/env node
/**
 * Detect + merge near-duplicate inventory rows.
 *
 * Strategy:
 *   1. Group rows by a normalised signature:
 *        category|item_code|vehicleMake|vehicleModel|yearMin|yearMax
 *      (case-folded, whitespace-collapsed). If item_code is missing we
 *      fall back to a fuzzy clean-description signature.
 *   2. Within each group of size > 1:
 *        • Keep the row with the LARGEST quantity as the survivor
 *          (or the lowest id if quantities tie) so the operator's
 *          most-updated count wins.
 *        • Sum quantities from the duplicates into the survivor.
 *        • Merge supplier / notes from the others as comma-joined
 *          fallback values.
 *        • Delete the duplicate rows.
 *
 *   node scripts/dedupe-inventory.mjs [--dry-run] [--category="Spark Plugs"]
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const onlyCat = args.find(a => a.startsWith('--category='))?.split('=')[1] ?? null;

function norm(s) {
  return String(s ?? '').toLowerCase().replace(/\s+/g, ' ').replace(/[^a-z0-9 ]/g, '').trim();
}

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required. Set it in your environment or .env before running this cleanup.');
}

const conn = await mysql.createConnection({
  uri: process.env.DATABASE_URL,
});

const where = onlyCat ? 'WHERE category = ?' : '';
const params = onlyCat ? [onlyCat] : [];
const [rows] = await conn.query(
  `SELECT id, item_name, item_code, category, quantity, unit_price, supplier, notes,
          vehicleMake, vehicleModel, yearMin, yearMax, cleanDescription
   FROM inventory ${where}`,
  params
);
console.log(`Scanning ${rows.length} rows${onlyCat ? ` in "${onlyCat}"` : ''}.`);

const groups = new Map();
for (const r of rows) {
  // Primary signature: category + item_code + fitment.
  // If item_code is empty/numeric-only AND clean_description exists,
  // include a normalised description so two parts with the same part
  // number but different physical descriptions don't collapse.
  const sig = [
    norm(r.category),
    norm(r.item_code),
    norm(r.vehicleMake),
    norm(r.vehicleModel),
    r.yearMin ?? '',
    r.yearMax ?? '',
    norm(r.cleanDescription),
  ].join('|');
  if (!groups.has(sig)) groups.set(sig, []);
  groups.get(sig).push(r);
}

const dupGroups = [...groups.entries()].filter(([, v]) => v.length > 1);
console.log(`Duplicate groups: ${dupGroups.length}`);

let merged = 0, removed = 0;
await conn.beginTransaction();
try {
  for (const [, group] of dupGroups) {
    // Pick the survivor: largest quantity, lowest id as tiebreaker.
    group.sort((a, b) => (Number(b.quantity ?? 0) - Number(a.quantity ?? 0)) || (a.id - b.id));
    const keep = group[0];
    const drop = group.slice(1);

    const totalQty = group.reduce((s, r) => s + Number(r.quantity ?? 0), 0);
    const suppliers = [...new Set(group.map(r => r.supplier).filter(Boolean))];
    const notes = [...new Set(group.map(r => r.notes).filter(Boolean))];
    // Pick the best unit_price: prefer non-zero, then highest.
    const prices = group.map(r => Number(r.unit_price ?? 0)).filter(p => p > 0);
    const bestPrice = prices.length ? Math.max(...prices) : Number(keep.unit_price ?? 0);

    if (!DRY) {
      await conn.query(
        'UPDATE inventory SET quantity = ?, unit_price = ?, supplier = ?, notes = ? WHERE id = ?',
        [totalQty, bestPrice, suppliers.join(', ') || null, notes.join(' · ') || null, keep.id]
      );
      const dropIds = drop.map(r => r.id);
      if (dropIds.length) {
        await conn.query(
          `DELETE FROM inventory WHERE id IN (${dropIds.map(() => '?').join(',')})`,
          dropIds
        );
      }
    }
    merged += 1;
    removed += drop.length;
  }
  if (!DRY) await conn.commit();
  console.log(`\nDedup ${DRY ? 'plan (dry-run)' : 'complete'}:`);
  console.log(`  Groups merged: ${merged}`);
  console.log(`  Rows removed:  ${removed}`);
} catch (err) {
  await conn.rollback();
  console.error('Rolled back —', err.message);
  process.exitCode = 1;
}
await conn.end();
