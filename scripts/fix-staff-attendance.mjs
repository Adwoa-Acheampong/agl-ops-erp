#!/usr/bin/env node
/**
 * Clean up the historical `staff_attendance` table imported from the
 * master Excel sheet. Three classes of breakage were observed:
 *
 *   1. Every session was imported TWICE — once with role='mechanic'
 *      (clock-in row) and once with role='unknown' (clock-out row).
 *      The two halves need to be merged into a single session row.
 *   2. Staff names land in mixed casing + diminutives + formal forms
 *      ("CHRIS" / "Chris" / "Christopher" / "Nana Kojo" / "Benjamin").
 *      Normalise to the canonical AGL roster.
 *   3. `is_late` flag fired on the wrong threshold (220/264 for March,
 *      14/316 for April). Recompute against the policy (clock-in > 08:00).
 *      `hours_worked` was null on most rows — derive from in/out times.
 *
 *   node scripts/fix-staff-attendance.mjs [--dry-run]
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';

const DRY = process.argv.includes('--dry-run');

// Canonical roster → role mapping. Lowercase keys; match against the
// normalized form of staff_name. Anything outside this map falls back
// to the original name and a role of 'mechanic'.
const ROSTER = {
  // Mechanics
  'chris':        { canonical: 'Chris',    role: 'mechanic' },
  'christopher':  { canonical: 'Chris',    role: 'mechanic' },
  'kojo':         { canonical: 'Kojo',     role: 'mechanic' },
  'nana kojo':    { canonical: 'Kojo',     role: 'mechanic' },
  'appiah':       { canonical: 'Appiah',   role: 'mechanic' },
  'fatawu':       { canonical: 'Fatawu',   role: 'mechanic' },
  // Sales reps
  'yvonne':       { canonical: 'Yvonne',   role: 'sales_rep' },
  'bright':       { canonical: 'Bright',   role: 'sales_rep' },
  'ben':          { canonical: 'Ben',      role: 'sales_rep' },
  'benjamin':     { canonical: 'Ben',      role: 'sales_rep' },
  'abigail':      { canonical: 'Abigail',  role: 'sales_rep' },
  'miracle':      { canonical: 'Miracle',  role: 'sales_rep' },
};

function normaliseName(raw) {
  const key = String(raw ?? '').trim().toLowerCase();
  if (ROSTER[key]) return ROSTER[key];
  // Fallback — title-case the first character of each word but keep
  // the (apparently unknown) name on the ledger so we don't drop it.
  const canonical = key.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  return { canonical, role: 'mechanic' };
}

/** Coerce a clock-time string to "HH:MM". Returns null if unparseable. */
function normaliseTime(raw) {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const m = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(s);
  if (!m) return null;
  const h = Math.max(0, Math.min(23, parseInt(m[1], 10)));
  const mm = Math.max(0, Math.min(59, parseInt(m[2], 10)));
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

/** Hours between two HH:MM strings. */
function hoursBetween(start, end) {
  if (!start || !end) return null;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const ms = (eh * 60 + em) - (sh * 60 + sm);
  if (ms <= 0) return null;
  return Number((ms / 60).toFixed(2));
}

const LATE_THRESHOLD = '08:00';
function isLate(clockIn) {
  if (!clockIn) return false;
  return clockIn > LATE_THRESHOLD;
}

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required. Set it in your environment or .env before running this cleanup.');
}

const conn = await mysql.createConnection({
  uri: process.env.DATABASE_URL,
});

const [rows] = await conn.query(
  "SELECT id, staff_name, role, clock_in_date, clock_in_time, clock_out_time, hours_worked, is_late, notes FROM staff_attendance ORDER BY clock_in_date, staff_name, id"
);
console.log(`Loaded ${rows.length} raw rows.`);

// Group by (canonicalName + date), then merge the in/out halves into one.
const groups = new Map();
for (const r of rows) {
  const { canonical, role } = normaliseName(r.staff_name);
  const date = r.clock_in_date instanceof Date
    ? r.clock_in_date.toISOString().slice(0, 10)
    : String(r.clock_in_date).slice(0, 10);
  const key = `${canonical}__${date}`;
  if (!groups.has(key)) groups.set(key, { canonical, role, date, ids: [], in: null, out: null, hours: null, notes: null });
  const g = groups.get(key);
  g.ids.push(r.id);
  const ci = normaliseTime(r.clock_in_time);
  const co = normaliseTime(r.clock_out_time);
  if (ci && !g.in)  g.in  = ci;
  if (co && !g.out) g.out = co;
  if (r.hours_worked != null && g.hours == null) g.hours = Number(r.hours_worked);
  if (r.notes && !g.notes) g.notes = r.notes;
}

console.log(`Merged into ${groups.size} unique sessions.`);

let preserveCount = 0, deleteCount = 0, lateCount = 0;
const updates = [];   // [id, payload]
const deletes = [];   // [id]

for (const g of groups.values()) {
  // Pick the lowest id as the survivor; the rest get deleted.
  g.ids.sort((a, b) => a - b);
  const keepId = g.ids[0];
  const dropIds = g.ids.slice(1);
  // Compute hours if we have both endpoints and DB didn't have a value.
  const hours = g.hours != null ? g.hours : hoursBetween(g.in, g.out);
  const late = isLate(g.in);
  if (late) lateCount += 1;
  updates.push([keepId, {
    staff_name: g.canonical,
    role:       g.role,
    clock_in_time:  g.in,
    clock_out_time: g.out,
    hours_worked:   hours,
    is_late:        late ? 1 : 0,
    notes:          g.notes,
  }]);
  preserveCount += 1;
  for (const id of dropIds) deletes.push(id);
  deleteCount += dropIds.length;
}

console.log(`\nPlan: update ${preserveCount} rows · delete ${deleteCount} duplicates · ${lateCount} late sessions.`);

if (DRY) { console.log('\nDry run — no writes performed.'); await conn.end(); process.exit(0); }

await conn.beginTransaction();
try {
  for (const [id, p] of updates) {
    await conn.query(
      `UPDATE staff_attendance
         SET staff_name=?, role=?, clock_in_time=?, clock_out_time=?, hours_worked=?, is_late=?, notes=?
       WHERE id=?`,
      [p.staff_name, p.role, p.clock_in_time, p.clock_out_time, p.hours_worked, p.is_late, p.notes, id]
    );
  }
  if (deletes.length) {
    // Chunk the deletes so we don't blow MAX_ALLOWED_PACKET on big runs.
    const CHUNK = 200;
    for (let i = 0; i < deletes.length; i += CHUNK) {
      const slice = deletes.slice(i, i + CHUNK);
      await conn.query(`DELETE FROM staff_attendance WHERE id IN (${slice.map(() => '?').join(',')})`, slice);
    }
  }
  await conn.commit();
  console.log('\nDone. Committed.');
} catch (err) {
  await conn.rollback();
  console.error('Rolled back —', err.message);
  process.exitCode = 1;
}
await conn.end();
