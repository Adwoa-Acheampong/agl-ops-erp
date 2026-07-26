#!/usr/bin/env node
/**
 * Second-pass attendance cleanup. The first pass (fix-staff-attendance.mjs)
 * deduplicated the 586 raw rows into 293 sessions, but two classes of
 * data quality issue remained:
 *
 *   1. 34 rows had BOTH clock_in_time AND clock_out_time null — pure
 *      orphans carrying no information. Delete them.
 *   2. The March import shipped `hours_worked` + `clock_out_time` but
 *      no `clock_in_time` for any row. Back-compute the missing IN
 *      from `clock_out - hours_worked` so the late-detection logic has
 *      something to fire on.
 *
 * After this pass:
 *   • Every surviving row has at least one real punch.
 *   • Most March rows gain a synthesised clock_in_time (flagged in
 *     notes so the audit trail is honest about the imputation).
 *   • is_late is recomputed against the 08:00 threshold using whichever
 *     clock_in_time is present (real or synthesised).
 *
 *   node scripts/fix-staff-attendance-2.mjs [--dry-run]
 */
import 'dotenv/config';
import mysql from 'mysql2/promise';

const DRY = process.argv.includes('--dry-run');
const LATE_THRESHOLD = '08:00';

function pad(n) { return String(n).padStart(2, '0'); }
function hhmmFromHours(timeStr, hoursWorked) {
  if (!timeStr || hoursWorked == null) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(String(timeStr));
  if (!m) return null;
  const outMin = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  const inMin  = outMin - Math.round(Number(hoursWorked) * 60);
  if (!Number.isFinite(inMin) || inMin < 0 || inMin >= 24 * 60) return null;
  const h = Math.floor(inMin / 60);
  const mm = inMin % 60;
  return `${pad(h)}:${pad(mm)}`;
}

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required. Set it in your environment or .env before running this cleanup.');
}

const conn = await mysql.createConnection({
  uri: process.env.DATABASE_URL,
});

// 1. Identify orphans (both punches null).
const [orphans] = await conn.query(
  "SELECT id FROM staff_attendance WHERE clock_in_time IS NULL AND clock_out_time IS NULL"
);
console.log(`Orphan rows (will delete): ${orphans.length}`);

// 2. Identify back-computable rows (clock_in null but clock_out + hours present).
const [backCompute] = await conn.query(
  "SELECT id, clock_out_time, hours_worked, clock_in_date, staff_name FROM staff_attendance " +
  "WHERE clock_in_time IS NULL AND clock_out_time IS NOT NULL AND hours_worked IS NOT NULL"
);
const computed = backCompute.map((r) => ({
  id: r.id,
  clock_in_time: hhmmFromHours(r.clock_out_time, r.hours_worked),
  note: `imputed clock-in from clock-out (${r.clock_out_time}) − hours (${r.hours_worked})`,
})).filter(x => x.clock_in_time);
console.log(`Back-computable clock-ins: ${computed.length}`);

// 3. Recompute is_late from whichever clock_in_time we end up with.
const [allRows] = await conn.query(
  "SELECT id, clock_in_time FROM staff_attendance WHERE clock_in_time IS NOT NULL"
);
const lateRecount = allRows.filter(r => String(r.clock_in_time) > LATE_THRESHOLD).length;
console.log(`Rows that will be marked late post-cleanup: ${lateRecount}`);

if (DRY) { console.log('\nDry run — no writes.'); await conn.end(); process.exit(0); }

await conn.beginTransaction();
try {
  if (orphans.length) {
    const ids = orphans.map(r => r.id);
    const CHUNK = 200;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const slice = ids.slice(i, i + CHUNK);
      await conn.query(`DELETE FROM staff_attendance WHERE id IN (${slice.map(() => '?').join(',')})`, slice);
    }
  }
  for (const c of computed) {
    // Append the imputation note to whatever notes string is already there.
    await conn.query(
      "UPDATE staff_attendance SET clock_in_time = ?, " +
      "notes = TRIM(BOTH ' | ' FROM CONCAT(COALESCE(notes, ''), ' | ', ?)) " +
      "WHERE id = ?",
      [c.clock_in_time, c.note, c.id]
    );
  }
  // Recompute is_late for every row that has a clock_in_time.
  await conn.query(
    "UPDATE staff_attendance SET is_late = (clock_in_time > ?) WHERE clock_in_time IS NOT NULL",
    [LATE_THRESHOLD]
  );
  // Force is_late = 0 where clock_in_time is null — we can't claim "late" without a punch.
  await conn.query("UPDATE staff_attendance SET is_late = 0 WHERE clock_in_time IS NULL");
  await conn.commit();
  console.log('\nDone. Committed.');
} catch (err) {
  await conn.rollback();
  console.error('Rolled back —', err.message);
  process.exitCode = 1;
}
await conn.end();
