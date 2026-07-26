import { desc, lt } from "drizzle-orm";
import { auditLog } from "../drizzle/schema";
import { getDb } from "./db";

/**
 * Persistent audit log with an in-memory ring as a short-lived fallback.
 * Production reads from the audit_log table so events survive restarts.
 */

export interface AuditEntry {
  id: string;
  at: Date;
  userId: string | null;
  userName: string | null;
  action: string; // e.g. "sales.create"
  category: "mutation" | "auth" | "access";
  meta?: Record<string, any>;
  ip?: string | null;
}

const MAX_ENTRIES = 500;
const log: AuditEntry[] = [];

export function recordAudit(entry: Omit<AuditEntry, "id" | "at">): AuditEntry {
  const full: AuditEntry = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: new Date(),
    ...entry,
  };
  log.unshift(full);
  if (log.length > MAX_ENTRIES) log.length = MAX_ENTRIES;
  void persistAudit(full);
  return full;
}

export function getAudit(limit = 100): AuditEntry[] {
  return log.slice(0, limit);
}

export async function listAudit(limit = 100): Promise<AuditEntry[]> {
  const db = await getDb();
  if (!db) return getAudit(limit);

  const rows = await db
    .select()
    .from(auditLog)
    .orderBy(desc(auditLog.at))
    .limit(limit);

  return rows.map((row) => ({
    id: String(row.id),
    at: row.at,
    userId: row.userId ?? null,
    userName: row.userName ?? null,
    action: row.action,
    category: row.category,
    meta: (row.meta ?? undefined) as Record<string, any> | undefined,
    ip: row.ip ?? null,
  }));
}

export async function pruneAudit(keepDays = 90): Promise<{ deleted: number; cutoff: Date }> {
  const days = Math.max(7, Math.floor(keepDays));
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const db = await getDb();
  if (!db) return { deleted: 0, cutoff };

  const result: any = await db.delete(auditLog).where(lt(auditLog.at, cutoff));
  const deleted = Number(result?.[0]?.affectedRows ?? result?.affectedRows ?? 0);
  return { deleted, cutoff };
}

export function clearAudit() {
  log.length = 0;
}

async function persistAudit(entry: AuditEntry) {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(auditLog).values({
      at: entry.at,
      userId: entry.userId,
      userName: entry.userName,
      action: entry.action.slice(0, 120),
      category: entry.category,
      meta: entry.meta ?? null,
      ip: entry.ip ?? null,
    });
  } catch (error) {
    console.warn("[audit] failed to persist event", error);
  }
}
