import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { t } from "../_core/trpc";
import { db } from "../db";
import { tenants } from "../../drizzle/schema";

/**
 * Resolve tenant id from the authenticated user (per the comment in
 * src/lib/trpc.ts — "tenant id is derived server-side from the
 * authenticated user's email"). The earlier `x-tenant-id` header
 * approach was spoofable and is no longer trusted.
 *
 * Order of resolution:
 *   1. Tenant whose ownerEmail matches the user's email.
 *   2. Tenant with id=1 (single-tenant deployments — AGL itself).
 *   3. UNAUTHORIZED.
 */
export const tenantMiddleware = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user?.email) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Not signed in" });
  }
  let tenantId = await resolveTenantIdForUser(ctx.user.email);
  if (!tenantId) {
    // Fallback to the default (single-tenant) tenant. Multi-tenant orgs
    // should ensure every user's email matches a tenant.ownerEmail.
    const [t1] = await db.select({ id: tenants.id }).from(tenants).where(eq(tenants.id, 1)).limit(1);
    tenantId = t1?.id ?? null;
  }
  if (!tenantId) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "No tenant associated with this account" });
  }
  return next({ ctx: { ...ctx, user: ctx.user!, tenantId } });
});

export async function resolveTenantIdForUser(email: string | null | undefined) {
  if (!email) return null;
  const lowerEmail = email.toLowerCase();
  const [tenant] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.ownerEmail, lowerEmail))
    .limit(1);
  return tenant?.id ?? null;
}
