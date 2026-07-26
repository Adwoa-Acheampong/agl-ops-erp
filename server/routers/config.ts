import { z } from "zod";
import { router, publicProcedure, protectedProcedure } from "../_core/trpc";
import { getConfig, updateConfig, resetConfig } from "../config";

export const configRouter = router({
  get: publicProcedure.query(() => getConfig()),

  update: protectedProcedure
    .input(
      z.object({
        dailyRevenueTarget: z.number().positive().optional(),
        monthlyRevenueTarget: z.number().positive().optional(),
        lowStockThreshold: z.number().min(0).optional(),
        overdueJobHours: z.number().positive().optional(),
      }),
    )
    .mutation(({ input }) => updateConfig(input)),

  reset: protectedProcedure.mutation(() => resetConfig()),
});
