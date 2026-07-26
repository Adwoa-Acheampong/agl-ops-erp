/**
 * Business Insights Engine
 * Generates trends, action items, best sellers, and performance metrics
 */

export interface Insight {
  id: string;
  type: "positive" | "negative" | "info" | "warning";
  title: string;
  description: string;
  metric?: number;
  trend?: "up" | "down" | "stable";
  actionable?: boolean;
  action?: string;
}

export interface TrendPoint {
  label: string; // e.g. "2026-04-01"
  value: number;
}

export interface TrendSeries {
  name: string;
  points: TrendPoint[];
  deltaPct: number; // % change vs previous period
  direction: "up" | "down" | "flat";
}

export interface PerformanceAlert {
  id: string;
  severity: "critical" | "warning" | "info";
  category: "finance" | "workshop" | "staff" | "inventory" | "sales";
  title: string;
  detail: string;
  metric?: number;
  recommendedAction?: string;
}

export interface BusinessMetrics {
  dailyRevenueTarget: number;
  dailyRevenue: number;
  revenueProgress: number;
  monthlyRevenueTarget: number;
  monthlyRevenueActual: number;
  monthlyProgressPct: number;
  mechanicEfficiency: {
    mechanicName: string;
    jobsCompleted: number;
    avgTimePerJob: number;
    efficiency: number; // percentage
    score5Star: number; // 0-5
  }[];
  vehicleTurnaroundTime: {
    average: number; // in hours
    trend: "improving" | "declining";
  };
  bestSellers: {
    productName: string;
    quantity: number;
    revenue: number;
    trend: "up" | "down";
  }[];
  trends: {
    revenue: TrendSeries;
    expenses: TrendSeries;
    sales: TrendSeries;
  };
  alerts: PerformanceAlert[];
  actionItems: Insight[];
}

export interface InsightConfig {
  dailyRevenueTarget?: number; // default 5,000 GHS
  monthlyRevenueTarget?: number; // default 50,000 GHS per todo
  lowStockThreshold?: number; // default 5
  overdueJobHours?: number; // default 72
}

/**
 * Generate insights from operational data
 */
export function generateInsights(data: any): Insight[] {
  const insights: Insight[] = [];

  // Revenue insights
  if (data.dailyRevenue > data.dailyRevenueTarget) {
    insights.push({
      id: "revenue-positive",
      type: "positive",
      title: "Revenue Target Exceeded",
      description: `Daily revenue of GHS ${data.dailyRevenue} exceeded target of GHS ${data.dailyRevenueTarget}`,
      metric: ((data.dailyRevenue / data.dailyRevenueTarget) * 100 - 100),
      trend: "up",
      actionable: true,
      action: "View detailed breakdown",
    });
  } else if (data.dailyRevenue < data.dailyRevenueTarget * 0.8) {
    insights.push({
      id: "revenue-warning",
      type: "warning",
      title: "Revenue Below Target",
      description: `Daily revenue is only GHS ${data.dailyRevenue}, target is GHS ${data.dailyRevenueTarget}`,
      metric: ((data.dailyRevenue / data.dailyRevenueTarget) * 100),
      trend: "down",
      actionable: true,
      action: "Review sales channels",
    });
  }

  // Mechanic efficiency insights
  if (data.mechanicEfficiency && data.mechanicEfficiency.length > 0) {
    const topMechanic = data.mechanicEfficiency.reduce((prev: any, current: any) =>
      current.efficiency > prev.efficiency ? current : prev
    );

    if (topMechanic.efficiency > 90) {
      insights.push({
        id: "mechanic-top-performer",
        type: "positive",
        title: `${topMechanic.mechanicName} - Top Performer`,
        description: `${topMechanic.mechanicName} has achieved ${topMechanic.efficiency}% efficiency with ${topMechanic.jobsCompleted} jobs completed`,
        metric: topMechanic.efficiency,
        trend: "up",
      });
    }

    const lowPerformer = data.mechanicEfficiency.reduce((prev: any, current: any) =>
      current.efficiency < prev.efficiency ? current : prev
    );

    if (lowPerformer.efficiency < 70) {
      insights.push({
        id: "mechanic-low-performer",
        type: "warning",
        title: `${lowPerformer.mechanicName} - Performance Alert`,
        description: `${lowPerformer.mechanicName} has ${lowPerformer.efficiency}% efficiency. Consider providing support or training.`,
        metric: lowPerformer.efficiency,
        trend: "down",
        actionable: true,
        action: "Review workload",
      });
    }
  }

  // Vehicle turnaround time insights
  if (data.vehicleTurnaroundTime) {
    if (data.vehicleTurnaroundTime.trend === "improving") {
      insights.push({
        id: "turnaround-improving",
        type: "positive",
        title: "Vehicle Turnaround Improving",
        description: `Average turnaround time is improving. Current average: ${data.vehicleTurnaroundTime.average} hours`,
        metric: data.vehicleTurnaroundTime.average,
        trend: "down",
      });
    } else if (data.vehicleTurnaroundTime.trend === "declining") {
      insights.push({
        id: "turnaround-declining",
        type: "warning",
        title: "Vehicle Turnaround Declining",
        description: `Average turnaround time is increasing. Current average: ${data.vehicleTurnaroundTime.average} hours`,
        metric: data.vehicleTurnaroundTime.average,
        trend: "up",
        actionable: true,
        action: "Review workshop capacity",
      });
    }
  }

  // Best sellers insights
  if (data.bestSellers && data.bestSellers.length > 0) {
    const topSeller = data.bestSellers[0];
    insights.push({
      id: "top-seller",
      type: "info",
      title: `Top Seller: ${topSeller.productName}`,
      description: `${topSeller.productName} generated GHS ${topSeller.revenue} in revenue with ${topSeller.quantity} units sold`,
      metric: topSeller.revenue,
      trend: topSeller.trend as "up" | "down",
    });
  }

  return insights;
}

/**
 * Calculate mechanic efficiency metrics
 */
export function calculateMechanicEfficiency(
  mechanicData: any[],
  jobData: any[]
): { mechanicName: string; jobsCompleted: number; avgTimePerJob: number; efficiency: number }[] {
  return mechanicData.map((mechanic) => {
    const mechanicJobs = jobData.filter((job) => job.mechanicName === mechanic.name);
    const completedJobs = mechanicJobs.filter((job) => job.status === "Completed");

    const totalTime = completedJobs.reduce((sum, job) => {
      const start = new Date(job.startTime).getTime();
      const end = new Date(job.endTime).getTime();
      return sum + (end - start) / (1000 * 60 * 60); // Convert to hours
    }, 0);

    const avgTime = completedJobs.length > 0 ? totalTime / completedJobs.length : 0;
    const efficiency = (completedJobs.length / mechanicJobs.length) * 100;

    return {
      mechanicName: mechanic.name,
      jobsCompleted: completedJobs.length,
      avgTimePerJob: avgTime,
      efficiency: Math.round(efficiency),
    };
  });
}

/**
 * Calculate vehicle turnaround time
 */
export function calculateTurnaroundTime(jobData: any[]): BusinessMetrics["vehicleTurnaroundTime"] {
  const completedJobs = jobData.filter((job) => job.status === "Completed");

  if (completedJobs.length === 0) {
    return { average: 0, trend: "improving" };
  }

  const turnaroundTimes = completedJobs.map((job) => {
    const start = new Date(job.intakeDate).getTime();
    const end = new Date(job.completionDate).getTime();
    return (end - start) / (1000 * 60 * 60); // Convert to hours
  });

  const average = turnaroundTimes.reduce((a, b) => a + b, 0) / turnaroundTimes.length;

  // Simple trend calculation: compare last 5 with previous 5
  const recent = turnaroundTimes.slice(-5).reduce((a, b) => a + b, 0) / 5;
  const previous = turnaroundTimes.slice(-10, -5).reduce((a, b) => a + b, 0) / 5;

  const trend: "improving" | "declining" = recent < previous ? "improving" : "declining";

  return {
    average: Math.round(average * 10) / 10,
    trend,
  };
}

/**
 * Identify best sellers
 */
export function identifyBestSellers(salesData: any[]): BusinessMetrics["bestSellers"] {
  const productMap = new Map<string, { quantity: number; revenue: number }>();

  salesData.forEach((sale) => {
    const product = sale.partService || "Unknown";
    const quantity = parseInt(sale.quantity) || 1;
    const revenue = parseFloat(sale.amount) || 0;

    if (productMap.has(product)) {
      const existing = productMap.get(product)!;
      existing.quantity += quantity;
      existing.revenue += revenue;
    } else {
      productMap.set(product, { quantity, revenue });
    }
  });

  return Array.from(productMap.entries())
    .map(([name, data]) => ({
      productName: name,
      quantity: data.quantity,
      revenue: data.revenue,
      trend: "up" as const, // Could calculate actual trend with historical data
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);
}

/**
 * Calculate daily revenue target progress
 */
export function calculateRevenueProgress(
  dailyRevenue: number,
  dailyTarget: number
): { progress: number; status: "on-track" | "at-risk" | "exceeded" } {
  const progress = (dailyRevenue / dailyTarget) * 100;

  let status: "on-track" | "at-risk" | "exceeded";
  if (progress >= 100) {
    status = "exceeded";
  } else if (progress >= 80) {
    status = "on-track";
  } else {
    status = "at-risk";
  }

  return { progress: Math.round(progress), status };
}

/**
 * Build a daily trend series for a numeric field over a window of days
 */
export function buildDailyTrend(
  rows: any[],
  dateField: string,
  amountField: string,
  windowDays = 14,
  name = "series",
): TrendSeries {
  const today = new Date();
  const buckets: Record<string, number> = {};
  for (let i = windowDays - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    buckets[d.toISOString().slice(0, 10)] = 0;
  }
  for (const row of rows || []) {
    const raw = row?.[dateField];
    if (!raw) continue;
    const key = String(raw).slice(0, 10);
    if (key in buckets) {
      buckets[key] += parseFloat(row?.[amountField]) || 0;
    }
  }
  const points: TrendPoint[] = Object.entries(buckets).map(([label, value]) => ({
    label,
    value: Math.round(value * 100) / 100,
  }));

  // delta: last half vs first half
  const half = Math.floor(points.length / 2);
  const first = points.slice(0, half).reduce((s, p) => s + p.value, 0);
  const last = points.slice(half).reduce((s, p) => s + p.value, 0);
  const deltaPct = first === 0 ? (last > 0 ? 100 : 0) : Math.round(((last - first) / first) * 100);
  const direction: "up" | "down" | "flat" =
    Math.abs(deltaPct) < 2 ? "flat" : deltaPct > 0 ? "up" : "down";

  return { name, points, deltaPct, direction };
}

/**
 * Generate alerts from operational data
 */
export function generateAlerts(data: any, config: Required<InsightConfig>): PerformanceAlert[] {
  const alerts: PerformanceAlert[] = [];
  const now = Date.now();

  // Workshop: jobs open longer than overdueJobHours
  for (const job of data.workshop || []) {
    if (job.status && String(job.status).toLowerCase() !== "completed") {
      const intake = job.intakeDate ? new Date(job.intakeDate).getTime() : null;
      if (intake && (now - intake) / 36e5 > config.overdueJobHours) {
        alerts.push({
          id: `overdue-${job.vehicleReg || job.id || Math.random()}`,
          severity: "warning",
          category: "workshop",
          title: `Job overdue: ${job.vehicleReg || "vehicle"}`,
          detail: `Open for >${config.overdueJobHours}h. Mechanic: ${job.mechanicName || "unassigned"}`,
          recommendedAction: "Escalate or reassign",
        });
      }
    }
  }

  // Inventory: low stock
  for (const item of data.inventory || []) {
    const qty = parseFloat(item.quantity ?? item.stock) || 0;
    if (qty <= config.lowStockThreshold) {
      alerts.push({
        id: `lowstock-${item.sku || item.name}`,
        severity: qty <= 0 ? "critical" : "warning",
        category: "inventory",
        title: `Low stock: ${item.name || item.sku}`,
        detail: `Only ${qty} left (threshold ${config.lowStockThreshold})`,
        metric: qty,
        recommendedAction: "Raise purchase order",
      });
    }
  }

  // Staff: chronic lateness (>3 lates in current dataset)
  const lateCount: Record<string, number> = {};
  for (const r of data.staff || []) {
    if (r.status && String(r.status).toLowerCase() === "late") {
      const k = r.name || r.staffName || "unknown";
      lateCount[k] = (lateCount[k] || 0) + 1;
    }
  }
  for (const [name, count] of Object.entries(lateCount)) {
    if (count >= 3) {
      alerts.push({
        id: `late-${name}`,
        severity: "warning",
        category: "staff",
        title: `Chronic lateness: ${name}`,
        detail: `${count} late arrivals in current period`,
        metric: count,
        recommendedAction: "HR review",
      });
    }
  }

  // Finance: expenses > 70% of revenue today
  const todayKey = new Date().toISOString().slice(0, 10);
  const todayRevenue = (data.sales || [])
    .filter((s: any) => String(s.date || "").slice(0, 10) === todayKey)
    .reduce((sum: number, s: any) => sum + (parseFloat(s.amount) || 0), 0);
  const todayExpenses = (data.expenses || [])
    .filter((e: any) => String(e.date || "").slice(0, 10) === todayKey)
    .reduce((sum: number, e: any) => sum + (parseFloat(e.amount) || 0), 0);
  if (todayRevenue > 0 && todayExpenses / todayRevenue > 0.7) {
    alerts.push({
      id: "expense-ratio",
      severity: "critical",
      category: "finance",
      title: "Expense ratio above 70%",
      detail: `Expenses GHS ${todayExpenses.toFixed(0)} vs revenue GHS ${todayRevenue.toFixed(0)}`,
      metric: Math.round((todayExpenses / todayRevenue) * 100),
      recommendedAction: "Review variable costs",
    });
  }

  return alerts;
}

/**
 * Compute 5-star score for a mechanic from efficiency + recalls + jobs
 */
export function scoreMechanic(eff: number, recalls: number, jobs: number): number {
  if (jobs === 0) return 0;
  const effScore = Math.min(eff / 100, 1) * 3; // 0-3
  const recallPenalty = Math.min(recalls / Math.max(jobs, 1), 1) * 2; // 0-2 deducted
  const volumeBonus = Math.min(jobs / 20, 1) * 2; // 0-2
  const raw = effScore + volumeBonus - recallPenalty;
  return Math.max(0, Math.min(5, Math.round(raw * 10) / 10));
}

/**
 * Generate comprehensive business metrics
 */
export function generateBusinessMetrics(data: any, config: InsightConfig = {}): BusinessMetrics {
  const cfg: Required<InsightConfig> = {
    dailyRevenueTarget: config.dailyRevenueTarget ?? 5000,
    monthlyRevenueTarget: config.monthlyRevenueTarget ?? 50000,
    lowStockThreshold: config.lowStockThreshold ?? 5,
    overdueJobHours: config.overdueJobHours ?? 72,
  };

  const dailyRevenue =
    data.sales?.reduce((sum: number, sale: any) => sum + (parseFloat(sale.amount) || 0), 0) || 0;

  // Monthly actuals: filter sales to current month
  const now = new Date();
  const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const monthlyRevenueActual =
    data.sales
      ?.filter((s: any) => String(s.date || "").startsWith(ym))
      .reduce((sum: number, s: any) => sum + (parseFloat(s.amount) || 0), 0) || 0;

  const baseMechanicEff = calculateMechanicEfficiency(data.staff || [], data.workshop || []);
  const mechanicEfficiency = baseMechanicEff.map((m) => {
    const recalls =
      (data.workshop || []).filter(
        (j: any) => j.mechanicName === m.mechanicName && j.recall === true,
      ).length || 0;
    return { ...m, score5Star: scoreMechanic(m.efficiency, recalls, m.jobsCompleted) };
  });

  const vehicleTurnaroundTime = calculateTurnaroundTime(data.workshop || []);
  const bestSellers = identifyBestSellers(data.sales || []);
  const revenueProgress = calculateRevenueProgress(dailyRevenue, cfg.dailyRevenueTarget);

  const trends = {
    revenue: buildDailyTrend(data.sales || [], "date", "amount", 14, "Revenue"),
    expenses: buildDailyTrend(data.expenses || [], "date", "amount", 14, "Expenses"),
    sales: buildDailyTrend(data.sales || [], "date", "quantity", 14, "Units sold"),
  };

  const alerts = generateAlerts(data, cfg);

  const actionItems = generateInsights({
    dailyRevenue,
    dailyRevenueTarget: cfg.dailyRevenueTarget,
    mechanicEfficiency,
    vehicleTurnaroundTime,
    bestSellers,
  });

  return {
    dailyRevenueTarget: cfg.dailyRevenueTarget,
    dailyRevenue,
    revenueProgress: revenueProgress.progress,
    monthlyRevenueTarget: cfg.monthlyRevenueTarget,
    monthlyRevenueActual,
    monthlyProgressPct: Math.round((monthlyRevenueActual / cfg.monthlyRevenueTarget) * 100),
    mechanicEfficiency,
    vehicleTurnaroundTime,
    bestSellers,
    trends,
    alerts,
    actionItems,
  };
}
