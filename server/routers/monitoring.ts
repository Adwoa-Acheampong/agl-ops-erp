import { z } from "zod";
import { eq, and, sql, lt, desc } from "drizzle-orm";
import { router, protectedProcedure, publicProcedure } from "../_core/trpc";
import { db } from "../db";
import {
  alerts,
  transactions,
  inventory,
  staffAttendance,
  type Alert,
} from "../db/schema";

export const monitoringRouter = router({
  /**
   * Get all alerts for the tenant (flagged transactions, low inventory, attendance mismatches)
   */
  getAlerts: protectedProcedure.query(async ({ ctx }) => {
    try {
      const tenantId = ctx.tenantId;

      // Fetch all active alerts for tenant
      const activeAlerts = await db
        .select()
        .from(alerts)
        .where(
          and(
            eq(alerts.tenantId, tenantId),
            eq(alerts.status, "active")
          )
        )
        .orderBy(desc(alerts.createdAt));

      return { success: true, alerts: activeAlerts };
    } catch (error) {
      console.error("Error fetching alerts:", error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }),

  /**
   * Generate a plain-English insight from provided data (AI simulation)
   */
  generateInsight: publicProcedure
    .input(z.object({ data: z.any() }))
    .mutation(async ({ input }) => {
      try {
        const { data } = input;
        let insight = "";

        // Simulate AI analysis based on data structure
        if (data && typeof data === "object") {
          if (data.marketingSpend && data.leads === 0) {
            insight = `⚠️ Medium: Marketing spend on ${data.campaign || "campaign"} has 0 leads this week. Suggested: Pause campaign.`;
          } else if (data.lowStockItems && data.lowStockItems.length > 0) {
            insight = `⚠️ High: ${data.lowStockItems.length} item(s) running low on inventory. Suggested: Reorder soon.`;
          } else if (data.pendingAppointments && data.pendingAppointments > 5) {
            insight = `ℹ️ Info: You have ${data.pendingAppointments} upcoming appointments this week.`;
          } else if (data.flaggedTransactions && data.flaggedTransactions > 0) {
            insight = `⚠️ Medium: ${data.flaggedTransactions} transaction(s) flagged as unusual. Review recommended.`;
          } else {
            insight = `✅ All systems look normal based on provided data.`;
          }
        } else {
          insight = `ℹ️ No specific insights generated. Provide structured data for analysis.`;
        }

        return { success: true, insight };
      } catch (error) {
        console.error("Error generating insight:", error);
        return {
          success: false,
          error: (error as Error).message,
        };
      }
    }),

  /**
   * Resolve an alert (mark as reviewed)
   */
  resolveAlert: protectedProcedure
    .input(z.object({ alertId: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const tenantId = ctx.tenantId;

        const [updatedAlert] = await db
          .update(alerts)
          .set({
            status: "reviewed",
            reviewedAt: new Date(),
            reviewedBy: ctx.userId, // assuming ctx has userId
          })
          .where(
            and(
              eq(alerts.id, input.alertId),
              eq(alerts.tenantId, tenantId)
            )
          )
          .returning();

        if (!updatedAlert) {
          return { success: false, error: "Alert not found or already resolved" };
        }

        return { success: true, alert: updatedAlert };
      } catch (error) {
        console.error("Error resolving alert:", error);
        return {
          success: false,
          error: (error as Error).message,
        };
      }
    }),
});