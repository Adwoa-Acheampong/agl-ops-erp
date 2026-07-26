import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import {
  createSchedule,
  deleteSchedule,
  listSchedules,
  runScheduleNow,
  setEnabled,
} from "../scheduler";

const reportType = z.enum(["daily-ceo", "weekly-management", "monthly-financial", "full-operations"]);
const frequency = z.enum(["hourly", "daily", "weekly", "monthly"]);

export const schedulesRouter = router({
  list: protectedProcedure.query(() => listSchedules()),

  create: protectedProcedure
    .input(
      z.object({
        reportType,
        frequency,
        recipientEmail: z.string().email(),
        hourOfDay: z.number().min(0).max(23).optional(),
      }),
    )
    .mutation(({ input }) => createSchedule(input)),

  delete: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => ({ deleted: deleteSchedule(input.id) })),

  setEnabled: protectedProcedure
    .input(z.object({ id: z.string(), enabled: z.boolean() }))
    .mutation(({ input }) => setEnabled(input.id, input.enabled)),

  runNow: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(({ input }) => runScheduleNow(input.id)),
});
