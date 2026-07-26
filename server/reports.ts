/**
 * Comprehensive Reporting System
 * Generates Daily CEO, Weekly Management, Monthly Financial, and Full Operations reports
 */

import { generateBusinessMetrics, BusinessMetrics } from "./insights";

export interface ReportData {
  startDate: Date;
  endDate: Date;
  generatedAt: Date;
  metrics: BusinessMetrics;
  data: any;
}

export interface DailyCEOReport extends ReportData {
  type: "daily-ceo";
  executiveSummary: string;
  topMetrics: {
    revenue: number;
    transactions: number;
    vehiclesServiced: number;
    netPosition: number;
  };
  alerts: string[];
  topPerformers: string[];
  actionItems: string[];
}

export interface WeeklyManagementReport extends ReportData {
  type: "weekly-management";
  weekNumber: number;
  departmentSummary: {
    workshop: {
      jobsCompleted: number;
      avgTurnaroundTime: number;
      efficiency: number;
    };
    sales: {
      totalRevenue: number;
      transactionCount: number;
      topChannel: string;
    };
    staff: {
      totalHours: number;
      attendanceRate: number;
      topPerformer: string;
    };
  };
  trends: {
    revenueChange: number;
    efficiencyChange: number;
    attendanceChange: number;
  };
  recommendations: string[];
}

export interface MonthlyFinancialReport extends ReportData {
  type: "monthly-financial";
  month: number;
  year: number;
  financialSummary: {
    grossRevenue: number;
    totalExpenses: number;
    netIncome: number;
    profitMargin: number;
  };
  revenueBreakdown: {
    byChannel: { [key: string]: number };
    byPaymentMethod: { [key: string]: number };
  };
  expenseBreakdown: {
    byCategory: { [key: string]: number };
  };
  creditorStatus: {
    totalOwed: number;
    creditorCount: number;
    overdueAmount: number;
  };
  purchaseOrders: {
    total: number;
    pending: number;
    completed: number;
  };
}

export interface FullOperationsReport extends ReportData {
  type: "full-operations";
  period: string;
  executiveSummary: string;
  allMetrics: BusinessMetrics;
  departmentReports: {
    workshop: any;
    sales: any;
    finance: any;
    staff: any;
  };
  trends: any;
  recommendations: string[];
  appendix: any;
}

/**
 * Generate Daily CEO Report
 */
export function generateDailyCEOReport(data: any): DailyCEOReport {
  const metrics = generateBusinessMetrics(data);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const topPerformers = metrics.mechanicEfficiency
    .filter((m) => m.efficiency > 85)
    .map((m) => m.mechanicName)
    .slice(0, 3);

  const alerts: string[] = [];
  if (metrics.revenueProgress < 80) {
    alerts.push(`Revenue at ${metrics.revenueProgress}% of daily target`);
  }
  if (metrics.mechanicEfficiency.some((m) => m.efficiency < 70)) {
    alerts.push("Low mechanic efficiency detected");
  }
  if (metrics.vehicleTurnaroundTime.trend === "declining") {
    alerts.push("Vehicle turnaround time increasing");
  }

  const actionItems = metrics.actionItems
    .filter((item) => item.actionable)
    .map((item) => item.action || "")
    .filter((item) => item.length > 0);

  return {
    type: "daily-ceo",
    startDate: today,
    endDate: new Date(),
    generatedAt: new Date(),
    metrics,
    data,
    executiveSummary: `Daily operations summary for ${today.toLocaleDateString()}. Revenue: GHS ${metrics.dailyRevenue}, Target: GHS ${metrics.dailyRevenueTarget}`,
    topMetrics: {
      revenue: metrics.dailyRevenue,
      transactions: data.sales?.length || 0,
      vehiclesServiced: data.workshop?.filter((j: any) => j.status === "Completed").length || 0,
      netPosition: metrics.dailyRevenue - (data.expenses?.reduce((sum: number, e: any) => sum + (parseFloat(e.amount) || 0), 0) || 0),
    },
    alerts,
    topPerformers,
    actionItems,
  };
}

/**
 * Generate Weekly Management Report
 */
export function generateWeeklyManagementReport(data: any): WeeklyManagementReport {
  const metrics = generateBusinessMetrics(data);
  const today = new Date();
  const weekNumber = Math.ceil((today.getDate() + new Date(today.getFullYear(), today.getMonth(), 1).getDay()) / 7);

  const completedJobs = data.workshop?.filter((j: any) => j.status === "Completed") || [];
  const totalTime = completedJobs.reduce((sum: number, job: any) => {
    const start = new Date(job.startTime).getTime();
    const end = new Date(job.endTime).getTime();
    return sum + (end - start) / (1000 * 60 * 60);
  }, 0);

  const weekRevenue = data.sales?.reduce((sum: number, s: any) => sum + (parseFloat(s.totalAmount ?? s.amount) || 0), 0) || 0;
  const staffHours = data.staff?.reduce((sum: number, s: any) => sum + (parseFloat(s.hoursWorked) || 0), 0) || 0;

  return {
    type: "weekly-management",
    startDate: new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000),
    endDate: today,
    generatedAt: new Date(),
    weekNumber,
    metrics,
    data,
    departmentSummary: {
      workshop: {
        jobsCompleted: completedJobs.length,
        avgTurnaroundTime: completedJobs.length > 0 ? totalTime / completedJobs.length : 0,
        efficiency: metrics.mechanicEfficiency.reduce((sum, m) => sum + m.efficiency, 0) / metrics.mechanicEfficiency.length,
      },
      sales: {
        totalRevenue: weekRevenue,
        transactionCount: data.sales?.length || 0,
        topChannel: data.sales?.[0]?.channel || "Unknown",
      },
      staff: {
        totalHours: staffHours,
        attendanceRate: 95, // Placeholder
        topPerformer: metrics.mechanicEfficiency[0]?.mechanicName || "N/A",
      },
    },
    trends: {
      revenueChange: 5, // Placeholder
      efficiencyChange: 2, // Placeholder
      attendanceChange: -1, // Placeholder
    },
    recommendations: [
      "Review low-performing mechanics",
      "Optimize workshop scheduling",
      "Follow up on pending payments",
    ],
  };
}

/**
 * Generate Monthly Financial Report
 */
export function generateMonthlyFinancialReport(data: any): MonthlyFinancialReport {
  const metrics = generateBusinessMetrics(data);
  const today = new Date();
  const month = today.getMonth() + 1;
  const year = today.getFullYear();

  const totalRevenue = data.sales?.reduce((sum: number, s: any) => sum + (parseFloat(s.totalAmount ?? s.amount) || 0), 0) || 0;
  const totalExpenses = data.expenses?.reduce((sum: number, e: any) => sum + (parseFloat(e.amount) || 0), 0) || 0;
  const netIncome = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0;

  // Revenue breakdown by channel
  const revenueByChannel: { [key: string]: number } = {};
  data.sales?.forEach((sale: any) => {
    const channel = sale.channel || "Unknown";
    revenueByChannel[channel] = (revenueByChannel[channel] || 0) + (parseFloat(sale.totalAmount ?? sale.amount) || 0);
  });

  // Revenue breakdown by payment method
  const revenueByPayment: { [key: string]: number } = {};
  data.sales?.forEach((sale: any) => {
    const method = sale.paymentMethod || "Unknown";
    revenueByPayment[method] = (revenueByPayment[method] || 0) + (parseFloat(sale.totalAmount ?? sale.amount) || 0);
  });

  // Expense breakdown by category
  const expenseByCategory: { [key: string]: number } = {};
  data.expenses?.forEach((expense: any) => {
    const category = expense.category || "Unknown";
    expenseByCategory[category] = (expenseByCategory[category] || 0) + (parseFloat(expense.amount) || 0);
  });

  // Creditor status
  const totalOwed = data.creditSales?.reduce((sum: number, cs: any) => sum + (parseFloat(cs.amountOwed) || 0), 0) || 0;
  const creditorCount = new Set(data.creditSales?.map((cs: any) => cs.creditorName) || []).size;

  return {
    type: "monthly-financial",
    startDate: new Date(year, month - 1, 1),
    endDate: new Date(year, month, 0),
    generatedAt: new Date(),
    month,
    year,
    metrics,
    data,
    financialSummary: {
      grossRevenue: totalRevenue,
      totalExpenses,
      netIncome,
      profitMargin,
    },
    revenueBreakdown: {
      byChannel: revenueByChannel,
      byPaymentMethod: revenueByPayment,
    },
    expenseBreakdown: {
      byCategory: expenseByCategory,
    },
    creditorStatus: {
      totalOwed,
      creditorCount,
      overdueAmount: 0, // Would need date comparison
    },
    purchaseOrders: {
      total: data.purchaseOrders?.length || 0,
      pending: data.purchaseOrders?.filter((po: any) => po.status === "Pending").length || 0,
      completed: data.purchaseOrders?.filter((po: any) => po.status === "Completed").length || 0,
    },
  };
}

/**
 * Generate Full Operations Report
 */
export function generateFullOperationsReport(data: any): FullOperationsReport {
  const metrics = generateBusinessMetrics(data);
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  return {
    type: "full-operations",
    startDate: monthStart,
    endDate: today,
    generatedAt: new Date(),
    period: `${monthStart.toLocaleDateString()} - ${today.toLocaleDateString()}`,
    metrics,
    data,
    executiveSummary: `Comprehensive operations report for the period. Total revenue: GHS ${metrics.dailyRevenue * 30}, Operations efficiency: ${metrics.mechanicEfficiency.reduce((sum, m) => sum + m.efficiency, 0) / metrics.mechanicEfficiency.length}%`,
    allMetrics: metrics,
    departmentReports: {
      workshop: {
        totalJobs: data.workshop?.length || 0,
        completed: data.workshop?.filter((j: any) => j.status === "Completed").length || 0,
        pending: data.workshop?.filter((j: any) => j.status === "Pending").length || 0,
        avgTurnaroundTime: metrics.vehicleTurnaroundTime.average,
      },
      sales: {
        totalRevenue: data.sales?.reduce((sum: number, s: any) => sum + (parseFloat(s.totalAmount ?? s.amount) || 0), 0) || 0,
        transactionCount: data.sales?.length || 0,
        topProduct: metrics.bestSellers[0]?.productName || "N/A",
      },
      finance: {
        totalExpenses: data.expenses?.reduce((sum: number, e: any) => sum + (parseFloat(e.amount) || 0), 0) || 0,
        purchaseOrders: data.purchaseOrders?.length || 0,
        creditorOwed: data.creditSales?.reduce((sum: number, cs: any) => sum + (parseFloat(cs.amountOwed) || 0), 0) || 0,
      },
      staff: {
        totalStaff: data.staff?.length || 0,
        avgEfficiency: metrics.mechanicEfficiency.reduce((sum, m) => sum + m.efficiency, 0) / metrics.mechanicEfficiency.length,
        topPerformer: metrics.mechanicEfficiency[0]?.mechanicName || "N/A",
      },
    },
    trends: metrics.actionItems,
    recommendations: [
      "Review and optimize workshop capacity",
      "Analyze sales channel performance",
      "Monitor staff attendance and performance",
      "Review expense trends",
      "Follow up on creditor payments",
    ],
    appendix: {
      generatedBy: "AGL Command Center",
      version: "4.0",
    },
  };
}

/**
 * Export report as formatted text
 */
export function exportReportAsText(report: any): string {
  let text = `AGL COMMAND CENTER - ${report.type.toUpperCase()}\n`;
  text += `Generated: ${report.generatedAt.toLocaleString()}\n`;
  text += `Period: ${report.startDate.toLocaleDateString()} - ${report.endDate.toLocaleDateString()}\n`;
  text += `\n${"=".repeat(80)}\n\n`;

  if (report.type === "daily-ceo") {
    text += `EXECUTIVE SUMMARY\n${report.executiveSummary}\n\n`;
    text += `KEY METRICS\n`;
    text += `Revenue: GHS ${report.topMetrics.revenue}\n`;
    text += `Transactions: ${report.topMetrics.transactions}\n`;
    text += `Vehicles Serviced: ${report.topMetrics.vehiclesServiced}\n`;
    text += `Net Position: GHS ${report.topMetrics.netPosition}\n\n`;

    if (report.alerts.length > 0) {
      text += `ALERTS\n${report.alerts.map((a: string) => `• ${a}`).join("\n")}\n\n`;
    }

    if (report.topPerformers.length > 0) {
      text += `TOP PERFORMERS\n${report.topPerformers.map((p: string) => `• ${p}`).join("\n")}\n\n`;
    }

    if (report.actionItems.length > 0) {
      text += `ACTION ITEMS\n${report.actionItems.map((a: string) => `• ${a}`).join("\n")}\n`;
    }
  }

  return text;
}
