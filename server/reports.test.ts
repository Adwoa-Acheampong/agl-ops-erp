import { describe, it, expect } from "vitest";
import {
  generateDailyCEOReport,
  generateWeeklyManagementReport,
  generateMonthlyFinancialReport,
  generateFullOperationsReport,
  exportReportAsText,
} from "./reports";

const today = new Date().toISOString().slice(0, 10);

const data = {
  sales: [
    { date: today, amount: "1000", channel: "POS", paymentMethod: "Cash", partService: "Brakes", quantity: "1" },
    { date: today, amount: "2000", channel: "Workshop", paymentMethod: "Mobile", partService: "Service", quantity: "1" },
  ],
  workshop: [
    { vehicleReg: "GR-1", status: "Completed", mechanicName: "Kofi", intakeDate: today, completionDate: today, startTime: today + "T08:00", endTime: today + "T11:00" },
  ],
  expenses: [{ date: today, amount: "300", category: "Fuel" }],
  staff: [{ name: "Kofi", hoursWorked: "8" }],
  purchaseOrders: [{ status: "Pending" }, { status: "Completed" }],
  creditSales: [{ creditorName: "ABC", amountOwed: "500" }],
  inventory: [],
};

describe("reports", () => {
  it("daily CEO report has core fields", () => {
    const r = generateDailyCEOReport(data);
    expect(r.type).toBe("daily-ceo");
    expect(r.topMetrics.revenue).toBe(3000);
    expect(r.topMetrics.transactions).toBe(2);
    expect(r.topMetrics.netPosition).toBe(2700);
  });

  it("weekly management report", () => {
    const r = generateWeeklyManagementReport(data);
    expect(r.type).toBe("weekly-management");
    expect(r.departmentSummary.workshop.jobsCompleted).toBe(1);
    expect(r.departmentSummary.sales.totalRevenue).toBe(3000);
  });

  it("monthly financial report computes profit margin", () => {
    const r = generateMonthlyFinancialReport(data);
    expect(r.financialSummary.grossRevenue).toBe(3000);
    expect(r.financialSummary.totalExpenses).toBe(300);
    expect(r.financialSummary.netIncome).toBe(2700);
    expect(Math.round(r.financialSummary.profitMargin)).toBe(90);
  });

  it("full ops report contains department breakdown", () => {
    const r = generateFullOperationsReport(data);
    expect(r.type).toBe("full-operations");
    expect(r.departmentReports.sales.transactionCount).toBe(2);
    expect(r.departmentReports.workshop.totalJobs).toBe(1);
  });

  it("text export contains report header", () => {
    const r = generateDailyCEOReport(data);
    const txt = exportReportAsText(r);
    expect(txt).toContain("DAILY-CEO");
    expect(txt).toContain("EXECUTIVE SUMMARY");
  });
});
