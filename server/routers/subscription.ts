import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { router, publicProcedure } from "../_core/trpc";
import { tenantProcedure } from "../_core/procedures";
import { db } from "../db";
import { subscriptionPlans, customerSubscriptions, marketingSpend } from "../../drizzle/schema";

const createPlanSchema = z.object({
  name: z.string().min(1),
  monthlyPrice: z.number().positive(),
  yearlyPrice: z.number().positive(),
  benefitsJSON: z.string().optional(),
  isActive: z.boolean().default(true),
});

const subscribeSchema = z.object({
  customerId: z.number().int(),
  planId: z.number().int(),
  startDate: z.string(),
  paymentMethod: z.string().optional(),
  autoRenew: z.boolean().default(true),
});

const marketingSpendSchema = z.object({
  campaignName: z.string().min(1),
  channel: z.enum(["facebook", "google", "whatsapp", "radio"]),
  budget: z.number().positive(),
  spent: z.number().min(0).default(0),
  leads: z.number().int().min(0).optional(),
  roi: z.number().optional(),
  flaggedForReview: z.boolean().default(false),
});

export const subscriptionsRouter = router({
  listPlans: publicProcedure
    .input(z.object({ tenantId: z.number().int() }))
    .query(async ({ input }) => {
      try {
        const plans = await db
          .select()
          .from(subscriptionPlans)
          .where(and(eq(subscriptionPlans.tenantId, input.tenantId), eq(subscriptionPlans.isActive, true)))
          .orderBy(subscriptionPlans.monthlyPrice);
        return { success: true, plans };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    }),

  createPlan: tenantProcedure.input(createPlanSchema).mutation(async ({ ctx, input }) => {
    try {
      const [{ id }] = await db
        .insert(subscriptionPlans)
        .values({ ...input, tenantId: ctx.tenantId })
        .$returningId();
      const [created] = await db
        .select()
        .from(subscriptionPlans)
        .where(eq(subscriptionPlans.id, id))
        .limit(1);
      return { success: true, plan: created };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }),

  subscribe: tenantProcedure.input(subscribeSchema).mutation(async ({ ctx, input }) => {
    try {
      const [plan] = await db
        .select()
        .from(subscriptionPlans)
        .where(
          and(
            eq(subscriptionPlans.id, input.planId),
            eq(subscriptionPlans.tenantId, ctx.tenantId),
            eq(subscriptionPlans.isActive, true)
          )
        )
        .limit(1);

      if (!plan) return { success: false, error: "Plan not found or inactive" };

      const startDate = new Date(input.startDate);
      const nextBillingDate = new Date(startDate);
      nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

      const [{ id }] = await db
        .insert(customerSubscriptions)
        .values({
          tenantId: ctx.tenantId,
          customerId: input.customerId,
          planId: input.planId,
          startDate: input.startDate,
          nextBillingDate: nextBillingDate.toISOString().split("T")[0],
          paymentMethod: input.paymentMethod ?? null,
          autoRenew: input.autoRenew,
          status: "active",
        })
        .$returningId();

      const [created] = await db
        .select()
        .from(customerSubscriptions)
        .where(eq(customerSubscriptions.id, id))
        .limit(1);

      return { success: true, subscription: created };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }),

  cancelSubscription: tenantProcedure
    .input(z.object({ subscriptionId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const [sub] = await db
          .select()
          .from(customerSubscriptions)
          .where(
            and(
              eq(customerSubscriptions.id, input.subscriptionId),
              eq(customerSubscriptions.tenantId, ctx.tenantId)
            )
          )
          .limit(1);

        if (!sub) return { success: false, error: "Subscription not found" };
        if (sub.status === "canceled") return { success: false, error: "Already canceled" };

        await db
          .update(customerSubscriptions)
          .set({ status: "canceled", updatedAt: new Date() })
          .where(eq(customerSubscriptions.id, input.subscriptionId));

        const [updated] = await db
          .select()
          .from(customerSubscriptions)
          .where(eq(customerSubscriptions.id, input.subscriptionId))
          .limit(1);

        return { success: true, subscription: updated };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    }),

  listSubscriptions: tenantProcedure
    .input(z.object({ status: z.enum(["active", "paused", "canceled"]).optional() }).optional())
    .query(async ({ ctx, input }) => {
      try {
        const conditions = [eq(customerSubscriptions.tenantId, ctx.tenantId)];
        if (input?.status) conditions.push(eq(customerSubscriptions.status, input.status));

        const list = await db
          .select({ subscription: customerSubscriptions, plan: subscriptionPlans })
          .from(customerSubscriptions)
          .innerJoin(subscriptionPlans, eq(customerSubscriptions.planId, subscriptionPlans.id))
          .where(and(...conditions))
          .orderBy(desc(customerSubscriptions.createdAt));

        return { success: true, subscriptions: list };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    }),

  addMarketingSpend: tenantProcedure.input(marketingSpendSchema).mutation(async ({ ctx, input }) => {
    try {
      const [{ id }] = await db
        .insert(marketingSpend)
        .values({
          ...input,
          tenantId: ctx.tenantId,
          spent: input.spent.toString(),
          budget: input.budget.toString(),
          roi: input.roi?.toString() ?? null,
        })
        .$returningId();

      const [created] = await db
        .select()
        .from(marketingSpend)
        .where(eq(marketingSpend.id, id))
        .limit(1);

      return { success: true, campaign: created };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }),

  listMarketingSpend: tenantProcedure.query(async ({ ctx }) => {
    try {
      const campaigns = await db
        .select()
        .from(marketingSpend)
        .where(eq(marketingSpend.tenantId, ctx.tenantId))
        .orderBy(desc(marketingSpend.createdAt));
      return { success: true, campaigns };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }),
});
