import { describe, it, expect } from "vitest";
import {
  generateBusinessMetrics,
  buildDailyTrend,
  generateAlerts,
  scoreMechanic,
} from "./insights";

const today = new Date().toISOString().slice(0, 10);

const fixture = {
  sales: [
    { date: today, amount: "1500", quantity: "2", channel: "POS", paymentMethod: "Cash", partService: "Brake pads" },
    { date: today, amount: "2000", quantity: "1", channel: "Workshop", paymentMethod: "Mobile", partService: "Service" },
  ],
  workshop: [
    { vehicleReg: "GR-123", status: "Completed", mechanicName: "Kofi", intakeDate: today, completionDate: today, startTime: today + "T08:00:00", endTime: today + "T11:00:00" },
    { vehicleReg: "GR-456", status: "Pending", mechanicName: "Ama", intakeDate: "2026-03-01" },
  ],
  staff: [
    { name: "Kofi", status: "On Time" },
    { name: "Ama", status: "Late" },
    { name: "Ama", status: "Late" },
    { name: "Ama", status: "Late" },
  ],
  expenses: [{ date: today, amount: "500", category: "Fuel" }],
  inventory: [{ name: "Brake pads", sku: "BP-1", quantity: 2 }],
  purchaseOrders: [],
};

describe("insights", () => {
  it("scoreMechanic stays in [0,5] range", () => {
    expect(scoreMechanic(0, 0, 0)).toBe(0);
    const s = scoreMechanic(95, 0, 25);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThanOrEqual(5);
  });

  it("buildDailyTrend buckets values", () => {
    const t = buildDailyTrend(fixture.sales, "date", "amount", 7, "Revenue");
    expect(t.points.length).toBe(7);
    const todayPoint = t.points.find((p) => p.label === today);
    expect(todayPoint?.value).toBe(3500);
  });

  it("generateAlerts surfaces low stock + lateness + overdue", () => {
    const alerts = generateAlerts(fixture as any, {
      dailyRevenueTarget: 5000,
      monthlyRevenueTarget: 50000,
      lowStockThreshold: 5,
      overdueJobHours: 72,
    });
    expect(alerts.some((a) => a.category === "inventory")).toBe(true);
    expect(alerts.some((a) => a.category === "staff")).toBe(true);
    expect(alerts.some((a) => a.category === "workshop")).toBe(true);
  });

  it("generateBusinessMetrics returns full shape", () => {
    const m = generateBusinessMetrics(fixture);
    expect(m.dailyRevenue).toBe(3500);
    expect(m.monthlyRevenueTarget).toBe(50000);
    expect(m.trends.revenue.points.length).toBeGreaterThan(0);
    expect(Array.isArray(m.alerts)).toBe(true);
  });
});
