/**
 * WS4-C — Forms router. CRUD over `form_submissions` plus an approval
 * flow: a submitter records the form, a manager signs + approves, the
 * status moves through draft → submitted → approved | rejected.
 *
 * The `values` payload is stored as JSON so each form template can
 * carry its own shape without schema changes.
 */
import { z } from 'zod';
import { and, desc, eq } from 'drizzle-orm';
import { router } from '../_core/trpc';
import { tenantProcedure } from '../_core/procedures';
import { db } from '../db';
import { formSubmissions } from '../../drizzle/schema';

const STATUSES = ['draft', 'submitted', 'approved', 'rejected'] as const;

export const formsRouter = router({
  list: tenantProcedure
    .input(z.object({
      formId: z.string().optional(),
      status: z.enum(STATUSES).optional(),
      limit:  z.number().int().positive().max(500).optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      try {
        const conds: any[] = [eq(formSubmissions.tenantId, ctx.tenantId)];
        if (input?.formId) conds.push(eq(formSubmissions.formId, input.formId));
        if (input?.status) conds.push(eq(formSubmissions.status, input.status));
        const rows = await db.select().from(formSubmissions)
          .where(and(...conds))
          .orderBy(desc(formSubmissions.createdAt))
          .limit(input?.limit ?? 100);
        const submissions = rows.map((r: any) => ({
          ...r,
          values: safeParse(r.valuesJson),
        }));
        return { success: true as const, submissions };
      } catch (error) {
        return { success: false as const, error: (error as Error).message, submissions: [] };
      }
    }),

  submit: tenantProcedure
    .input(z.object({
      formId:    z.string().min(1).max(64),
      formLabel: z.string().min(1).max(200),
      values:    z.record(z.string()),
      signature: z.string().optional(),
      submittedBy: z.string().min(1).max(160),
      notes:     z.string().optional(),
      status:    z.enum(STATUSES).default('submitted'),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const [{ id }] = await db.insert(formSubmissions).values({
          tenantId:    ctx.tenantId,
          formId:      input.formId,
          formLabel:   input.formLabel,
          valuesJson:  JSON.stringify(input.values),
          signature:   input.signature ?? null,
          submittedBy: input.submittedBy,
          status:      input.status,
          notes:       input.notes ?? null,
        }).$returningId();
        return { success: true as const, id };
      } catch (error) {
        return { success: false as const, error: (error as Error).message };
      }
    }),

  approve: tenantProcedure
    .input(z.object({
      id:         z.number().int(),
      approvedBy: z.string().min(1).max(160),
      signature:  z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const patch: any = {
          status: 'approved',
          approvedBy: input.approvedBy,
          approvedAt: new Date(),
        };
        if (input.signature) patch.signature = input.signature;
        await db.update(formSubmissions).set(patch)
          .where(and(eq(formSubmissions.id, input.id), eq(formSubmissions.tenantId, ctx.tenantId)));
        return { success: true as const };
      } catch (error) {
        return { success: false as const, error: (error as Error).message };
      }
    }),

  reject: tenantProcedure
    .input(z.object({
      id:         z.number().int(),
      approvedBy: z.string().min(1).max(160),
      notes:      z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        await db.update(formSubmissions).set({
          status: 'rejected',
          approvedBy: input.approvedBy,
          approvedAt: new Date(),
          notes: input.notes ?? null,
        }).where(and(eq(formSubmissions.id, input.id), eq(formSubmissions.tenantId, ctx.tenantId)));
        return { success: true as const };
      } catch (error) {
        return { success: false as const, error: (error as Error).message };
      }
    }),

  delete: tenantProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await db.delete(formSubmissions)
          .where(and(eq(formSubmissions.id, input.id), eq(formSubmissions.tenantId, ctx.tenantId)));
        return { success: true as const };
      } catch (error) {
        return { success: false as const, error: (error as Error).message };
      }
    }),
});

function safeParse(s: string | null | undefined): Record<string, string> {
  if (!s) return {};
  try { const v = JSON.parse(s); return v && typeof v === 'object' ? v : {}; } catch { return {}; }
}
