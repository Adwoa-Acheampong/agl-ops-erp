import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { router, protectedProcedure } from "../_core/trpc";
import { tenantProcedure } from "../_core/procedures";
import { db } from "../db";
import { tenants } from "../../drizzle/schema";

const createTenantSchema = z.object({
  businessName: z.string().min(1),
  ownerEmail: z.string().email(),
  subscriptionTier: z.enum(["free", "starter", "pro", "enterprise"]).default("free"),
  // Accept either spelling for backwards compatibility — DB column is
  // brandingJson (lowercase j); the original API used brandingJSON.
  brandingJSON: z.string().optional(),
  brandingJson: z.string().optional(),
  timezone: z.string().max(64).optional(),
});

const updateTenantSchema = createTenantSchema.partial().extend({
  isActive: z.boolean().optional(),
});

/**
 * Normalise the public input to the Drizzle column shape. Drops the legacy
 * `brandingJSON` alias and any undefined keys so we never overwrite a column
 * with `undefined`.
 */
function toColumnPatch(input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v === undefined) continue;
    if (k === "brandingJSON") out.brandingJson = v;
    else out[k] = v;
  }
  return out;
}

export const tenantsRouter = router({
  list: protectedProcedure.query(async () => {
    try {
      const list = await db.select().from(tenants).orderBy(desc(tenants.createdAt));
      return { success: true, tenants: list };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }),

  getById: tenantProcedure.query(async ({ ctx }) => {
    try {
      const [tenant] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, ctx.tenantId))
        .limit(1);
      if (!tenant) return { success: false, error: "Tenant not found" };
      return { success: true, tenant };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }),

  create: protectedProcedure.input(createTenantSchema).mutation(async ({ input }) => {
    try {
      const patch = toColumnPatch(input as Record<string, unknown>);
      const [{ id }] = await db.insert(tenants).values(patch as any).$returningId();
      const [created] = await db.select().from(tenants).where(eq(tenants.id, id)).limit(1);
      return { success: true, tenant: created };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }),

  update: tenantProcedure.input(updateTenantSchema).mutation(async ({ ctx, input }) => {
    try {
      const patch = toColumnPatch(input as Record<string, unknown>);
      await db
        .update(tenants)
        .set({ ...patch, updatedAt: new Date() } as any)
        .where(eq(tenants.id, ctx.tenantId));
      const [updated] = await db
        .select()
        .from(tenants)
        .where(eq(tenants.id, ctx.tenantId))
        .limit(1);
      if (!updated) return { success: false, error: "Tenant not found" };
      return { success: true, tenant: updated };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }),

  /**
   * Soft-delete a tenant by setting isActive=false. We do NOT hard-delete
   * because foreign keys from staff, customers, vehicles etc. would cascade
   * data loss. To hard-delete, set { hard: true } — protected for admins only.
   */
  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), hard: z.boolean().optional() }))
    .mutation(async ({ input, ctx }) => {
      try {
        if (ctx.user?.role !== "admin") {
          return { success: false, error: "Admin role required" };
        }
        if (input.hard) {
          await db.delete(tenants).where(eq(tenants.id, input.id));
          return { success: true, hardDeleted: true };
        }
        await db
          .update(tenants)
          // isActive column is tinyint(1) in DB — cast through any to keep
          // drizzle's number-typing of MySQL bool happy alongside our zod-
          // boolean public surface.
          .set({ isActive: 0 as unknown as boolean, updatedAt: new Date() } as any)
          .where(eq(tenants.id, input.id));
        return { success: true, hardDeleted: false };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    }),
});
