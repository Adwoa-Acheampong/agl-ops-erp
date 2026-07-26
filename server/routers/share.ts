import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import {
  createShareLink,
  listShareLinks,
  revokeShareLink,
  verifyShareLink,
} from "../shareLinks";
import { syncAllSheetData } from "../googleSheets";
import { generateBusinessMetrics } from "../insights";
import { getConfig } from "../config";

export const shareRouter = router({
  list: protectedProcedure.query(() => listShareLinks()),

  create: protectedProcedure
    .input(
      z.object({
        scope: z.enum(["dashboard", "kpi", "reports"]),
        ttlMs: z.number().positive().optional(),
        label: z.string().optional(),
      }),
    )
    .mutation(({ input, ctx }) =>
      createShareLink({ ...input, createdBy: ctx.user.openId }),
    ),

  revoke: protectedProcedure
    .input(z.object({ token: z.string() }))
    .mutation(({ input }) => ({ revoked: revokeShareLink(input.token) })),

  /**
   * Public read-only metrics endpoint, gated by share token.
   * Returns a stripped-down version of metrics safe for guest viewing.
   */
  publicMetrics: publicProcedure
    .input(z.object({ token: z.string() }))
    .query(async ({ input }) => {
      const link = verifyShareLink(input.token);
      if (!link) return { ok: false as const, error: "Invalid or expired link" };

      const data = await syncAllSheetData().catch(() => null);
      if (!data) return { ok: false as const, error: "Data unavailable" };

      const m = generateBusinessMetrics(data, getConfig());
      // Strip anything sensitive (alerts metadata, raw rows)
      return {
        ok: true as const,
        scope: link.scope,
        label: link.label ?? null,
        metrics: {
          dailyRevenue: m.dailyRevenue,
          dailyRevenueTarget: m.dailyRevenueTarget,
          revenueProgress: m.revenueProgress,
          monthlyRevenueActual: m.monthlyRevenueActual,
          monthlyRevenueTarget: m.monthlyRevenueTarget,
          monthlyProgressPct: m.monthlyProgressPct,
          mechanicEfficiency: m.mechanicEfficiency.map((x) => ({
            mechanicName: x.mechanicName,
            efficiency: x.efficiency,
            score5Star: x.score5Star,
          })),
          bestSellers: m.bestSellers,
          trends: m.trends,
        },
      };
    }),
});
