#!/usr/bin/env node
/**
 * Buff every inventory item's quantity (qty on hand) up to a target so that
 * downstream stock consumption — the Workshop "add part" flow, which checks
 *   if (onHand < qty) -> "Insufficient stock for X: N on hand."
 * (server/routers/appointments.ts) — never trips over a 0/low balance after
 * a fresh catalogue import (import-inventory-v2.mjs lands most rows at
 * quantity 0 because the product list has no STOCK QTY).
 *
 *   node scripts/buff-inventory.mjs --dry-run        # preview, writes nothing
 *   node scripts/buff-inventory.mjs --verify         # real UPDATE, then ROLLBACK
 *   node scripts/buff-inventory.mjs                  # commit (FLOOR mode, default)
 *   node scripts/buff-inventory.mjs --set            # commit, force ALL rows to the target
 *   node scripts/buff-inventory.mjs --to=100         # use a different target
 *
 * Two modes:
 *   • FLOOR (default): quantity = GREATEST(quantity, TARGET). Raises only
 *     the under-stocked rows; never knocks down an item that already holds
 *     more than the target. This is the safe "give everything enough
 *     headroom" option.
 *   • --set: quantity = TARGET for EVERY row, unconditionally. The literal
 *     "set all qty on hand to 50" — will also REDUCE any item currently
 *     above the target, so use it knowingly.
 *
 * Touches only `quantity`. min_stock_level, unit_price, supplier, etc. are
 * left exactly as they are. Transaction-wrapped; --verify rolls back.
 */
import 'dotenv/config';
import { getDbConnection } from './_db.mjs';

const TABLE = 'inventory';

const argv = process.argv.slice(2);
const hasFlag = (name) => argv.includes(`--${name}`);
const getOpt = (name, def = null) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : def;
};

const DRY_RUN = hasFlag('dry-run');
const VERIFY = hasFlag('verify');
const SET_ALL = hasFlag('set'); // force every row to TARGET (may reduce)
const TARGET = Number.parseFloat(getOpt('to', '50'));
if (!Number.isFinite(TARGET) || TARGET < 0) {
  console.error(`--to must be a non-negative number (got ${JSON.stringify(getOpt('to', '50'))}).`);
  process.exit(2);
}

const escId = (s) => '`' + String(s).replace(/`/g, '``') + '`';
const T = escId(TABLE);
const mode = SET_ALL ? 'SET-ALL' : 'FLOOR';

const conn = await getDbConnection({});
try {
  // Snapshot the impact before touching anything.
  const [[{ total }]] = await conn.query(`SELECT COUNT(*) AS total FROM ${T}`);
  const [[{ below }]] = await conn.query(
    `SELECT COUNT(*) AS below FROM ${T} WHERE quantity < ?`, [TARGET]);
  const [[{ above }]] = await conn.query(
    `SELECT COUNT(*) AS above FROM ${T} WHERE quantity > ?`, [TARGET]);

  const willChange = SET_ALL ? (total - (total - below - above)) : below; // SET-ALL changes everything != TARGET
  const setAllChanged = below + above; // rows not already exactly TARGET

  console.log(`Table   : ${TABLE}`);
  console.log(`Mode    : ${mode}   target qty = ${TARGET}`);
  console.log(`Rows    : ${total} total  |  ${below} below target  |  ${above} above target`);
  if (SET_ALL) {
    console.log(`Plan    : set quantity = ${TARGET} on ALL ${total} rows (${setAllChanged} actually change; ${above} of them REDUCED).`);
  } else {
    console.log(`Plan    : raise the ${below} under-stocked row(s) up to ${TARGET}; leave the other ${total - below} unchanged.`);
  }

  if (DRY_RUN) {
    console.log(`\n[dry-run] No rows written. Re-run without --dry-run to apply.`);
    await conn.end();
    process.exit(0);
  }

  const sql = SET_ALL
    ? `UPDATE ${T} SET quantity = ?`
    : `UPDATE ${T} SET quantity = GREATEST(quantity, ?) WHERE quantity < ?`;
  const params = SET_ALL ? [TARGET] : [TARGET, TARGET];

  await conn.beginTransaction();
  const [res] = await conn.query(sql, params);

  const [[{ stillBelow }]] = await conn.query(
    `SELECT COUNT(*) AS stillBelow FROM ${T} WHERE quantity < ?`, [TARGET]);

  console.log(VERIFY ? '\n[verify] UPDATE exercised (will roll back):' : '\nBuff complete.');
  console.log(`  rows matched/affected : ${res.affectedRows}`);
  console.log(`  rows still below ${TARGET}   : ${stillBelow}  (expected 0)`);

  if (VERIFY) {
    await conn.rollback();
    console.log('\n[verify] rolled back — nothing persisted. Re-run without --verify to commit.');
  } else {
    await conn.commit();
    console.log(`\nAll inventory now has qty on hand >= ${TARGET}. Stock deductions will no longer hit "Insufficient stock".`);
  }
} catch (err) {
  console.error(`\nBuff FAILED: ${err.message}`);
  try { await conn.rollback(); } catch { /* connection may be gone */ }
  await conn.end();
  process.exit(1);
}
await conn.end();
process.exit(0);
