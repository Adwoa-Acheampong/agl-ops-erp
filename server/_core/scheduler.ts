/**
 * WS5-B — Lightweight in-process scheduler.
 *
 * Runs registered jobs on a fixed interval. The nightly document-expiry
 * scan dispatches 30-day and 7-day pre-expiry reminders to HR admins
 * via the notify dispatcher (email + WhatsApp).
 *
 * Boot from server/_core/index.ts:
 *
 *   import { startScheduler } from './scheduler';
 *   startScheduler();
 */
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db';
import { staffDocuments, staff, tenants } from '../../drizzle/schema';
import { dispatchEmail, dispatchWhatsapp } from './dispatch';

const ONE_HOUR_MS = 3_600_000;

/** Run hourly, but each job decides if it actually has work to do
 *  based on what's already been dispatched today. */
const JOBS: Array<{ id: string; tickMs: number; lastRun: number; run: () => Promise<void> }> = [
  { id: 'doc-expiry', tickMs: ONE_HOUR_MS, lastRun: 0, run: scanDocumentExpiries },
];

let _timer: NodeJS.Timeout | null = null;

export function startScheduler() {
  if (_timer) return;
  // Fire once shortly after boot so the first day's expiries are
  // visible without waiting an hour, then settle onto the cadence.
  _timer = setInterval(tick, 60_000);
  setTimeout(tick, 5_000);
}

export function stopScheduler() {
  if (_timer) { clearInterval(_timer); _timer = null; }
}

async function tick() {
  const now = Date.now();
  for (const job of JOBS) {
    if (now - job.lastRun < job.tickMs) continue;
    job.lastRun = now;
    try { await job.run(); }
    catch (e) { /* eslint-disable-next-line no-console */ console.error(`[scheduler:${job.id}]`, e); }
  }
}

// In-memory de-dupe — only fire one reminder per (document, threshold)
// per process lifetime. A persistent store will live in the next pass.
const _sentMarker = new Set<string>();

async function scanDocumentExpiries() {
  const horizon = new Date();
  horizon.setDate(horizon.getDate() + 31);
  const rows = await db
    .select({ doc: staffDocuments, staffName: staff.name, tenantId: staffDocuments.tenantId })
    .from(staffDocuments)
    .innerJoin(staff, eq(staffDocuments.staffId, staff.id))
    .where(and(
      sql`${staffDocuments.expiresAt} IS NOT NULL`,
      sql`${staffDocuments.expiresAt} <= ${horizon}`,
    ));
  if (rows.length === 0) return;

  // Build a map of HR-admin contacts per tenant. We pick a manager or
  // admin role; fall back to env when none on file.
  const tenantsList = await db.select().from(tenants);
  const adminQ = await db.select().from(staff).where(sql`${staff.role} IN ('owner','manager','accountant')`);
  const adminsByTenant = new Map<number, { name: string; email?: string | null; phone?: string | null }>();
  for (const a of adminQ) {
    if (!adminsByTenant.has(a.tenantId)) adminsByTenant.set(a.tenantId, { name: a.name, email: a.email, phone: a.phone });
  }
  const envEmail = process.env.HR_ADMIN_EMAIL;
  const envPhone = process.env.HR_ADMIN_WHATSAPP;

  for (const r of rows) {
    const exp = r.doc.expiresAt ? new Date(r.doc.expiresAt) : null;
    if (!exp) continue;
    const days = Math.floor((exp.getTime() - Date.now()) / 86_400_000);
    const threshold = days < 0 ? 'expired' : days <= 7 ? '7d' : days <= 30 ? '30d' : null;
    if (!threshold) continue;
    const markerKey = `${r.doc.id}:${threshold}`;
    if (_sentMarker.has(markerKey)) continue;
    _sentMarker.add(markerKey);

    const tenant = tenantsList.find((t: any) => t.id === r.tenantId);
    const admin  = adminsByTenant.get(r.tenantId);
    const subject = `[AGL OPS] Document ${threshold === 'expired' ? 'expired' : `expiring in ${days}d`} — ${r.staffName}`;
    const body = [
      `${r.staffName} · ${String(r.doc.docType).replace(/_/g, ' ')}`,
      `File: ${r.doc.filename}`,
      `Expires: ${exp.toLocaleDateString()} (${days < 0 ? `${Math.abs(days)} days ago` : `in ${days} days`})`,
      `Tenant: ${tenant?.businessName ?? '—'}`,
      ``,
      `Open the HR Documents tab to action.`,
    ].join('\n');

    const emailTo = admin?.email ?? envEmail;
    const phoneTo = admin?.phone ?? envPhone;
    if (emailTo) await dispatchEmail({ to: emailTo, subject, body });
    if (phoneTo) await dispatchWhatsapp({ to: phoneTo, body });
  }
}
