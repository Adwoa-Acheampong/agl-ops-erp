import { and, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { tenants } from "../../drizzle/schema";

export const LEDGER_EDITOR_ROLES = [
  "admin",
  "owner",
  "manager",
  "operations_manager",
  "principal",
] as const;

export function hasLedgerEditorRole(role: unknown): boolean {
  return LEDGER_EDITOR_ROLES.includes(String(role ?? "").toLowerCase() as any);
}

export async function canEditLedgers(user: { email?: string | null; role?: string | null } | null | undefined, tenantId?: number): Promise<boolean> {
  if (!user) return false;
  if (hasLedgerEditorRole(user.role)) return true;
  if (!user.email) return false;

  const lowerEmail = user.email.toLowerCase();
  const where = tenantId
    ? and(eq(tenants.id, tenantId), sql`LOWER(${tenants.ownerEmail}) = ${lowerEmail}`)
    : sql`LOWER(${tenants.ownerEmail}) = ${lowerEmail}`;

  const [tenant] = await db.select({ id: tenants.id }).from(tenants).where(where).limit(1);
  return !!tenant;
}
