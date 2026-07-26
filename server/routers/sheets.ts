import { router, protectedProcedure } from "../_core/trpc";
import {
  syncAllSheetData,
  getSheetMetadata,
  getSyncStatus,
  clearSheetCache,
} from "../googleSheets";
import { generateBusinessMetrics } from "../insights";
import { getConfig } from "../config";

export const sheetsRouter = router({
  /**
   * Sync all data from Google Sheets
   */
  /**
   * Current sync status (last sync time, errors, totals)
   */
  getStatus: protectedProcedure.query(() => {
    return { success: true, status: getSyncStatus() };
  }),

  /**
   * Force a fresh sync (bypass cache)
   */
  forceSync: protectedProcedure.mutation(async () => {
    try {
      clearSheetCache();
      const data = await syncAllSheetData({ force: true });
      return { success: true, data, syncedAt: new Date() };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }),

  syncAll: protectedProcedure.mutation(async () => {
    try {
      const data = await syncAllSheetData();
      return {
        success: true,
        data,
        syncedAt: new Date(),
      };
    } catch (error) {
      console.error("Error syncing sheets:", error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }),

  /**
   * Get sheet metadata
   */
  getMetadata: protectedProcedure.query(async () => {
    try {
      const metadata = await getSheetMetadata();
      return {
        success: true,
        sheets: metadata,
      };
    } catch (error) {
      console.error("Error fetching metadata:", error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }),

  /**
   * Get business metrics and insights (mutation form, kept for backwards compat)
   */
  getInsights: protectedProcedure.mutation(async () => {
    try {
      const data = await syncAllSheetData();
      const metrics = generateBusinessMetrics(data, getConfig());
      return {
        success: true,
        metrics,
      };
    } catch (error) {
      console.error("Error generating insights:", error);
      return {
        success: false,
        error: (error as Error).message,
      };
    }
  }),

  /**
   * Cached query form: pulls from cached sheet data, regenerates metrics each call
   */
  insights: protectedProcedure.query(async () => {
    try {
      const data = await syncAllSheetData();
      const metrics = generateBusinessMetrics(data, getConfig());
      return { success: true, metrics };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }),
});
