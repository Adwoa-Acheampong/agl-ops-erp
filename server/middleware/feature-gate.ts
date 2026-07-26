import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { t } from "../_core/trpc";
import { db } from "../db";
import { tenants } from "../../drizzle/schema";

type SubscriptionTier = "free" | "starter" | "pro" | "enterprise";

const TIER_RANK: Record<SubscriptionTier, number> = {
  free: 0,
  starter: 1,
  pro: 2,
  enterprise: 3,
};

export function requireTier(minimumTier: SubscriptionTier) {
  return t.middleware(async ({ ctx, next }) => {
    const tenantId = (ctx as typeof ctx & { tenantId: number }).tenantId;

    const [tenant] = await db
      .select({ subscriptionTier: tenants.subscriptionTier, isActive: tenants.isActive })
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (!tenant || !tenant.isActive) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Tenant not found or inactive" });
    }

    const tierRank = TIER_RANK[tenant.subscriptionTier as SubscriptionTier] ?? -1;
    const requiredRank = TIER_RANK[minimumTier];

    if (tierRank < requiredRank) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `This feature requires the '${minimumTier}' plan or higher (current: ${tenant.subscriptionTier})`,
      });
    }

    return next({ ctx });
  });
}
