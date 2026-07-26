import { router, publicProcedure } from "../_core/trpc";
import { syncAllSheetData } from "../googleSheets";
import {
  generateDailyCEOReport,
  generateWeeklyManagementReport,
  generateMonthlyFinancialReport,
  generateFullOperationsReport,
} from "../reports";

async function loadData() {
  try {
    return await syncAllSheetData();
  } catch (e) {
    console.error("reports.loadData failed:", e);
    return {
      monthlySummary: [],
      sales: [],
      workshop: [],
      staff: [],
      expenses: [],
      purchaseOrders: [],
    };
  }
}

export const reportsRouter = router({
  dailyCEO: publicProcedure.query(async () => {
    const data = await loadData();
    return generateDailyCEOReport(data);
  }),

  weeklyManagement: publicProcedure.query(async () => {
    const data = await loadData();
    return generateWeeklyManagementReport(data);
  }),

  monthlyFinancial: publicProcedure.query(async () => {
    const data = await loadData();
    return generateMonthlyFinancialReport(data);
  }),

  fullOperations: publicProcedure.query(async () => {
    const data = await loadData();
    return generateFullOperationsReport(data);
  }),
});
