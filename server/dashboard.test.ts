import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };

  return ctx;
}

describe("Dashboard KPIs", () => {
  it("should return KPI data with default values when no data exists", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const kpis = await caller.dashboard.getKPIs({});

    expect(kpis).toBeDefined();
    expect(kpis.totalRevenue).toBe(0);
    expect(kpis.totalTransactions).toBe(0);
    expect(kpis.totalVehiclesServiced).toBe(0);
    expect(kpis.totalExpenses).toBe(0);
    expect(kpis.netPosition).toBe(0);
  });

  it("should calculate net position correctly", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const kpis = await caller.dashboard.getKPIs({});

    // Net position should be revenue - expenses
    expect(kpis.netPosition).toBe(kpis.totalRevenue - kpis.totalExpenses);
  });

  it("should return monthly summary", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const summary = await caller.dashboard.getMonthlySummary({});

    // Should return null if no data exists
    expect(summary === null || summary !== undefined).toBe(true);
  });
});

describe("Sales Transactions", () => {
  it("should fetch sales transactions", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const sales = await caller.sales.list({});

    expect(Array.isArray(sales)).toBe(true);
  });

  it("should filter sales by channel", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const sales = await caller.sales.list({ channel: "Walk-In" });

    expect(Array.isArray(sales)).toBe(true);
    // All returned sales should have the specified channel
    sales.forEach((sale: any) => {
      expect(sale.channel).toBe("Walk-In");
    });
  });

  it("should filter sales by payment method", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const sales = await caller.sales.list({ paymentMethod: "Cash" });

    expect(Array.isArray(sales)).toBe(true);
    // All returned sales should have the specified payment method
    sales.forEach((sale: any) => {
      expect(sale.paymentMethod).toBe("Cash");
    });
  });
});

describe("Workshop Jobs", () => {
  it("should fetch workshop jobs", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const jobs = await caller.workshop.list({});

    expect(Array.isArray(jobs)).toBe(true);
  });

  it("should filter jobs by status", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const jobs = await caller.workshop.list({ status: "Completed" });

    expect(Array.isArray(jobs)).toBe(true);
    // All returned jobs should have the specified status
    jobs.forEach((job: any) => {
      expect(job.status).toBe("Completed");
    });
  });
});

describe("Staff Attendance", () => {
  it("should fetch staff attendance records", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const attendance = await caller.staff.listAttendance({});

    expect(Array.isArray(attendance)).toBe(true);
  });
});

describe("Expenses", () => {
  it("should fetch expenses", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const expenses = await caller.expenses.list({});

    expect(Array.isArray(expenses)).toBe(true);
  });
});

describe("Purchase Orders", () => {
  it("should fetch purchase orders", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const pos = await caller.purchaseOrders.list({});

    expect(Array.isArray(pos)).toBe(true);
  });

  it("should filter POs by status", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const pos = await caller.purchaseOrders.list({ status: "Pending" });

    expect(Array.isArray(pos)).toBe(true);
    // All returned POs should have the specified status
    pos.forEach((po: any) => {
      expect(po.status).toBe("Pending");
    });
  });
});

describe("Inventory", () => {
  it("should fetch inventory items", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const items = await caller.inventory.list({});

    expect(Array.isArray(items)).toBe(true);
  });
});

describe("Credit Sales", () => {
  it("should fetch credit sales", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const creditSales = await caller.creditSales.list({});

    expect(Array.isArray(creditSales)).toBe(true);
  });

  it("should filter credit sales by status", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const creditSales = await caller.creditSales.list({ status: "Pending" });

    expect(Array.isArray(creditSales)).toBe(true);
    // All returned credit sales should have the specified status
    creditSales.forEach((cs: any) => {
      expect(cs.status).toBe("Pending");
    });
  });
});

describe("Notifications", () => {
  it("should fetch notifications", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const notifications = await caller.notifications.list({});

    expect(Array.isArray(notifications)).toBe(true);
  });
});
