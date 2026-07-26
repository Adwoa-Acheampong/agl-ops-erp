import { z } from "zod";
import { eq, and, gte, lte, desc, sql, sum, count } from "drizzle-orm";
import { router, protectedProcedure } from "../_core/trpc";
import { db } from "../db";
import {
  transactions,
  marketingSpend,
  type Transaction,
  type MarketingSpend,
} from "../db/schema";

// Zod schemas
const dateRangeSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
});

const addTransactionSchema = z.object({
  type: z.enum(["sale", "expense", "refund"]),
  amount: z.number().positive(),
  paymentMethod: z.enum(["cash", "card", "bank_transfer", "mobile_money"]).optional(),
  description: z.string().min(1),
  date: z.string().datetime(),
});

export const financeRouter = router({
  /**
   * Get daily sales summary grouped by payment method
   */
  dailySales: protectedProcedure
    .input(dateRangeSchema.partial().optional())
    .query(async ({ ctx, input }) => {
      try {
        const conditions = [
          eq(transactions.tenantId, ctx.tenantId),
          eq(transactions.type, "sale"),
        ];

        if (input?.startDate) {
          conditions.push(gte(transactions.date, new Date(input.startDate)));
        }
        if (input?.endDate) {
          conditions.push(lte(transactions.date, new Date(input.endDate)));
        }

        const results = await db
          .select({
            paymentMethod: transactions.paymentMethod,
            total: sum(transactions.amount).mapWith(Number),
            count: count(transactions.id),
          })
          .from(transactions)
          .where(and(...conditions))
          .groupBy(transactions.paymentMethod);

        const grandTotal = results.reduce((acc, r) => acc + (r.total || 0), 0);

        return {
          success: true,
          data: {
            breakdown: results,
            grandTotal,
          },
        };
      } catch (error) {
        console.error("Error fetching daily sales:", error);
        return {
          success: false,
          error: (error as Error).message,
        };
      }
    }),

  /**
   * Get expense report with totals
   */
  expenseReport: protectedProcedure
    .input(dateRangeSchema.partial().optional())
    .query(async ({ ctx, input }) => {
      try {
        const conditions = [
          eq(transactions.tenantId, ctx.tenantId),
          eq(transactions.type, "expense"),
        ];

        if (input?.startDate) {
          conditions.push(gte(transactions.date, new Date(input.startDate)));
        }
        if (input?.endDate) {
          conditions.push(lte(transactions.date, new Date(input.endDate)));
        }

        const expenses = await db
          .select()
          .from(transactions)
          .where(and(...conditions))
          .orderBy(desc(transactions.date));

        const totalExpenses = expenses.reduce((acc, e) => acc + e.amount, 0);

        return {
          success: true,
          data: {
            expenses,
            totalExpenses,
            count: expenses.length,
          },
        };
      } catch (error) {
        console.error("Error fetching expense report:", error);
        return {
          success: false,
          error: (error as Error).message,
        };
      }
    }),

  /**
   * Calculate marketing ROI per campaign
   */
  marketingROI: protectedProcedure
    .input(dateRangeSchema.partial().optional())
    .query(async ({ ctx, input }) => {
      try {
        const conditions = [eq(marketingSpend.tenantId, ctx.tenantId)];

        if (input?.startDate) {
          conditions.push(gte(marketingSpend.date, new Date(input.startDate)));
        }
        if (input?.endDate) {
          conditions.push(lte(marketingSpend.date, new Date(input.endDate)));
        }

        const campaigns = await db
          .select({
            campaignName: marketingSpend.campaignName,
            totalSpend: sum(marketingSpend.spend).mapWith(Number),
            totalRevenue: sum(marketingSpend.revenue).mapWith(Number),
          })
          .from(marketingSpend)
          .where(and(...conditions))
          .groupBy(marketingSpend.campaignName);

        const roiData = campaigns.map((c) => {
          const spend = c.totalSpend || 0;
          const revenue = c.totalRevenue || 0;
          const roi = spend > 0 ? ((revenue - spend) / spend) * 100 : 0;
          return {
            campaignName: c.campaignName,
            spend,
            revenue,
            roi: Math.round(roi * 100) / 100,
          };
        });

        const totalSpend = roiData.reduce((acc, c) => acc + c.spend, 0);
        const totalRevenue = roiData.reduce((acc, c) => acc + c.revenue, 0);
        const overallROI = totalSpend > 0 ? ((totalRevenue - totalSpend) / totalSpend) * 100 : 0;

        return {
          success: true,
          data: {
            campaigns: roiData,
            summary: {
              totalSpend,
              totalRevenue,
              overallROI: Math.round(overallROI * 100) / 100,
            },
          },
        };
      } catch (error) {
        console.error("Error calculating marketing ROI:", error);
        return {
          success: false,
          error: (error as Error).message,
        };
      }
    }),

  /**
   * Add a new transaction with validation and anomaly flagging
   */
  addTransaction: protectedProcedure
    .input(addTransactionSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // Calculate tenant average transaction amount for sales only
        let averageAmount = 0;
        if (input.type === "sale") {
          const avgResult = await db
            .select({
              average: sql<number>`AVG(${transactions.amount})`.mapWith(Number),
            })
            .from(transactions)
            .where(
              and(
                eq(transactions.tenantId, ctx.tenantId),
                eq(transactions.type, "sale")
              )
            );
          averageAmount = avgResult[0]?.average || 0;
        }

        const flagged = input.type === "sale" && input.amount > averageAmount * 2;

        const [transaction] = await db
          .insert(transactions)
          .values({
            tenantId: ctx.tenantId,
            type: input.type,
            amount: input.amount,
            paymentMethod: input.paymentMethod || null,
            description: input.description,
            date: new Date(input.date),
            flagged,
          })
          .returning();

        return {
          success: true,
          transaction,
          warning: flagged ? "Transaction amount significantly exceeds average" : undefined,
        };
      } catch (error) {
        console.error("Error adding transaction:", error);
        return {
          success: false,
          error: (error as Error).message,
        };
      }
    }),
});