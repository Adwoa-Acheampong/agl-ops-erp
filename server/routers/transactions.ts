import { z } from "zod";
import { eq, and, desc, avg, sum, count } from "drizzle-orm";
import { router } from "../_core/trpc";
import { tenantProcedure } from "../_core/procedures";
import { db } from "../db";
import { transactions, staff } from "../../drizzle/schema";

const createTransactionSchema = z.object({
  appointmentId: z.number().int().optional(),
  type: z.enum(["sale", "refund", "expense", "payroll", "subscription"]),
  amount: z.number().positive(),
  currency: z.string().default("GHS"),
  paymentMethod: z.enum(["cash", "mobile_money", "card"]),
  processedBy: z.number().int().optional(),
  status: z.enum(["pending", "completed", "flagged"]).default("pending"),
});

export const transactionsRouter = router({
  list: tenantProcedure
    .input(
      z.object({
        type: z.enum(["sale", "refund", "expense", "payroll", "subscription"]).optional(),
        status: z.enum(["pending", "completed", "flagged"]).optional(),
        paymentMethod: z.enum(["cash", "mobile_money", "card"]).optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      try {
        const conditions = [eq(transactions.tenantId, ctx.tenantId)];
        if (input?.type) conditions.push(eq(transactions.type, input.type));
        if (input?.status) conditions.push(eq(transactions.status, input.status));
        if (input?.paymentMethod) conditions.push(eq(transactions.paymentMethod, input.paymentMethod));

        const list = await db
          .select()
          .from(transactions)
          .where(and(...conditions))
          .orderBy(desc(transactions.createdAt));

        return { success: true, transactions: list };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    }),

  create: tenantProcedure.input(createTransactionSchema).mutation(async ({ ctx, input }) => {
    try {
      const [avgResult] = await db
        .select({ avg: avg(transactions.amount) })
        .from(transactions)
        .where(and(eq(transactions.tenantId, ctx.tenantId), eq(transactions.type, "sale")));

      const avgAmount = parseFloat((avgResult?.avg as string) ?? "0") || 0;
      const autoFlagged = input.type === "sale" && avgAmount > 0 && input.amount > avgAmount * 2;
      const finalStatus = autoFlagged ? "flagged" : input.status;

      const [{ id }] = await db
        .insert(transactions)
        .values({ ...input, tenantId: ctx.tenantId, status: finalStatus })
        .$returningId();

      const [created] = await db.select().from(transactions).where(eq(transactions.id, id)).limit(1);

      return {
        success: true,
        transaction: created,
        warning: autoFlagged ? "Transaction significantly exceeds average sale amount" : undefined,
      };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }),

  updateStatus: tenantProcedure
    .input(z.object({ id: z.number().int(), status: z.enum(["pending", "completed", "flagged"]) }))
    .mutation(async ({ ctx, input }) => {
      try {
        await db
          .update(transactions)
          .set({ status: input.status, updatedAt: new Date() })
          .where(and(eq(transactions.id, input.id), eq(transactions.tenantId, ctx.tenantId)));

        const [updated] = await db
          .select()
          .from(transactions)
          .where(eq(transactions.id, input.id))
          .limit(1);

        if (!updated) return { success: false, error: "Transaction not found" };
        return { success: true, transaction: updated };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    }),

  summary: tenantProcedure.query(async ({ ctx }) => {
    try {
      const breakdown = await db
        .select({
          type: transactions.type,
          total: sum(transactions.amount),
          count: count(transactions.id),
        })
        .from(transactions)
        .where(eq(transactions.tenantId, ctx.tenantId))
        .groupBy(transactions.type);

      return { success: true, breakdown };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }),
});
