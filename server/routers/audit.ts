import { adminProcedure, router } from "../_core/trpc";
import { listAudit, pruneAudit } from "../audit";
import { z } from "zod";

export const auditRouter = router({
  list: adminProcedure
    .input(z.object({ limit: z.number().min(1).max(500).optional() }).optional())
    .query(async ({ input }) => {
      return await listAudit(input?.limit ?? 100);
    }),

  prune: adminProcedure
    .input(z.object({ keepDays: z.number().int().min(7).max(3650) }))
    .mutation(async ({ input }) => {
      return await pruneAudit(input.keepDays);
    }),
});
