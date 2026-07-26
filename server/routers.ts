import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { sheetsRouter } from "./routers/sheets";
import { reportsRouter } from "./routers/reports";
import { auditRouter } from "./routers/audit";
import { exportsRouter } from "./routers/exports";
import { configRouter } from "./routers/config";
import { shareRouter } from "./routers/share";
import { schedulesRouter } from "./routers/schedules";
import { publicProcedure, router, protectedProcedure } from "./_core/trpc";
import { aiRouter } from "./routers/ai";
import { authRouter } from "./routers/auth";
import { customersRouter } from "./routers/customers";
import { vehiclesRouter } from "./routers/vehicles";
import { remindersRouter } from "./routers/reminders";
import { fixbotRouter } from "./routers/fixbot";
import { botRouter } from "./routers/bot";
import { recallsRouter } from "./routers/recalls";
import { payrollRouter } from "./routers/payroll";
import { appointmentsRouter } from "./routers/appointments";
import { notifyRouter } from "./routers/notify";
import { tenantsRouter } from "./routers/tenants";
import { staffRouter } from "./routers/staff";
import { staffPortalRouter } from "./routers/staffPortal";
import { transactionsRouter } from "./routers/transactions";
import { subscriptionsRouter } from "./routers/subscription";
import { complaintsRouter } from "./routers/complaints";
import { formsRouter } from "./routers/forms";
import { dailyEntryRouter, scheduleRouter, trainingRouter, mechanicTrackerRouter, serviceCatalogRouter, kpiTargetRouter } from "./routers/wizardly";
import { canEditLedgers } from "./_core/ledgerAccess";
import { importExcelData } from "./import";
import {
  getSalesTransactions,
  getWorkshopJobs,
  getStaffAttendance,
  getExpenses,
  getPurchaseOrders,
  getInventory,
  getCreditSales,
  getNotifications,
  getMonthlySummary,
  calculateKPIs,
  getDb,
  updateSalesTransaction,
} from "./db";
import {
  insertSalesTransaction,
  insertWorkshopJob,
  insertExpense,
  insertPurchaseOrder,
  insertInventory,
  insertCreditSale,
  insertNotification,
} from "./db.insert";


export const appRouter = router({
  system: systemRouter,
  sheets: sheetsRouter,
  reports: reportsRouter,
  audit: auditRouter,
  exports: exportsRouter,
  config: configRouter,
  share: shareRouter,
  schedules: schedulesRouter,
  auth: authRouter,

  // Dashboard KPIs
  dashboard: router({
    getKPIs: publicProcedure
      .input(
        z.object({
          startDate: z.date().optional(),
          endDate: z.date().optional(),
        })
      )
      .query(async ({ input }) => {
        const startDate = input.startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const endDate = input.endDate || new Date();
        return await calculateKPIs(startDate, endDate);
      }),

    getMonthlySummary: publicProcedure
      .input(z.object({ month: z.date().optional() }))
      .query(async ({ input }) => {
        return await getMonthlySummary(input.month);
      }),
  }),

  // Sales & Transactions
  sales: router({
    list: publicProcedure
      .input(
        z.object({
          startDate: z.date().optional(),
          endDate: z.date().optional(),
          channel: z.string().optional(),
          paymentMethod: z.string().optional(),
          status: z.string().optional(),
          searchTerm: z.string().optional(),
          limit: z.number().int().positive().max(1000).optional(),
        }).optional()
      )
      .query(async ({ input }) => {
        return await getSalesTransactions(input ?? {});
      }),

    create: protectedProcedure
      .input(
        z.object({
          transactionDate: z.date(),
          customerName: z.string().optional(),
          customerContact: z.string().optional(),
          channel: z.string(),
          vehicle: z.string().optional(),
          partService: z.string(),
          quantity: z.number().optional(),
          unitPrice: z.number().optional(),
          totalAmount: z.number(),
          paymentMethod: z.string(),
          receiptNo: z.string().optional(),
          salesRep: z.string().optional(),
          mechanic: z.string().optional(),
          status: z.string(),
          workmanshipFee: z.number().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        return await insertSalesTransaction(input);
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number().int(),
          transactionDate: z.date().optional(),
          customerName: z.string().nullable().optional(),
          customerContact: z.string().nullable().optional(),
          channel: z.string().optional(),
          vehicle: z.string().nullable().optional(),
          partService: z.string().optional(),
          quantity: z.number().nullable().optional(),
          unitPrice: z.number().nullable().optional(),
          totalAmount: z.number().optional(),
          paymentMethod: z.string().optional(),
          receiptNo: z.string().nullable().optional(),
          salesRep: z.string().nullable().optional(),
          mechanic: z.string().nullable().optional(),
          status: z.string().optional(),
          workmanshipFee: z.number().nullable().optional(),
          notes: z.string().nullable().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (!(await canEditLedgers(ctx.user))) {
          return { success: false as const, error: 'Manager, owner, or principal account required.' };
        }
        const { id, ...patch } = input;
        return await updateSalesTransaction(id, patch);
      }),
  }),

  // partsSales — wraps the canonical `sales` router so SalesPage / POSPage
  // (which still address the router by its prior name) continue to work.
  // Two shape differences vs the new `sales` router that we paper over here:
  //   - Old shape: `{ success: true, sales: [{ id, amount, paymentMethod,
  //     channel, status, createdAt }] }`
  //   - New shape (sales_transactions table): array of rows with snake_case
  //     fields and richer columns (customerName, vehicle, partService, …)
  // We map fields to the legacy camelCase keys so old pages just work.
  partsSales: router({
    list: publicProcedure
      .input(
        z.object({
          startDate: z.date().optional(),
          endDate: z.date().optional(),
          channel: z.string().optional(),
          paymentMethod: z.string().optional(),
          status: z.string().optional(),
          searchTerm: z.string().optional(),
          limit: z.number().int().positive().max(1000).optional(),
        }).optional()
      )
      .query(async ({ input }) => {
        try {
          const rows = await getSalesTransactions(input ?? {});
          const list = Array.isArray(rows) ? rows : [];
          const limit = input?.limit ?? 500;
          const sales = list.slice(0, limit).map((r: any) => ({
            id:             r.id,
            createdAt:      r.transaction_date ?? r.transactionDate,
            amount:         String(r.total_amount ?? r.totalAmount ?? '0'),
            paymentMethod:  r.payment_method ?? r.paymentMethod ?? '',
            channel:        r.channel ?? '',
            status:         r.status ?? '',
            customerName:   r.customer_name ?? r.customerName ?? null,
            customerContact: r.customer_contact ?? r.customerContact ?? null,
            vehicle:        r.vehicle ?? null,
            partService:    r.part_service ?? r.partService ?? null,
            quantity:       r.quantity ?? null,
            unitPrice:      r.unit_price ?? r.unitPrice ?? null,
            receiptNo:      r.receipt_no ?? r.receiptNo ?? null,
            salesRep:       r.sales_rep ?? r.salesRep ?? null,
            mechanic:       r.mechanic ?? null,
            notes:          r.notes ?? null,
          }));
          return { success: true as const, sales };
        } catch (error) {
          return { success: false as const, error: (error as Error).message, sales: [] as any[] };
        }
      }),

    // Modal payload from the legacy NewSaleModal — line items + payment +
    // channel + (optional) customer name. We fold this into a single
    // sales_transactions row keyed off the basket subtotal.
    create: protectedProcedure
      .input(
        z.object({
          items: z.array(z.object({
            inventoryItemId: z.number(),
            quantity:        z.number().positive(),
            unitPrice:       z.number().nonnegative(),
          })).min(1),
          paymentMethod:   z.string(),
          channel:         z.string(),
          customerName:    z.string().optional(),
          customerContact: z.string().optional(),
          salesRep:        z.string().optional(),
          mechanic:        z.string().optional(),
          notes:           z.string().optional(),
          // Backdating support — defaults to now if absent.
          transactionDate: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        try {
          const total = input.items.reduce((sum, it) => sum + it.quantity * it.unitPrice, 0);
          const partService = input.items.map(it => `Item #${it.inventoryItemId} ×${it.quantity}`).join(' · ');
          const txDate = input.transactionDate ? new Date(input.transactionDate) : new Date();
          await insertSalesTransaction({
            transactionDate: txDate,
            customerName:    input.customerName,
            customerContact: input.customerContact,
            channel:         input.channel,
            partService,
            quantity:        input.items.reduce((n, it) => n + it.quantity, 0),
            unitPrice:       input.items[0]?.unitPrice ?? 0,
            totalAmount:     total,
            paymentMethod:   input.paymentMethod,
            salesRep:        input.salesRep,
            mechanic:        input.mechanic,
            status:          'Completed',
            notes:           input.notes,
          });
          return { success: true as const, total };
        } catch (error) {
          return { success: false as const, error: (error as Error).message };
        }
      }),
  }),

  // Workshop Jobs
  workshop: router({
    list: publicProcedure
      .input(
        z.object({
          startDate: z.date().optional(),
          endDate: z.date().optional(),
          status: z.string().optional(),
          searchTerm: z.string().optional(),
        })
      )
      .query(async ({ input }) => {
        return await getWorkshopJobs(input);
      }),

    create: protectedProcedure
      .input(
        z.object({
          jobDate: z.date(),
          vehicle: z.string(),
          registrationNo: z.string().optional(),
          mechanics: z.array(z.string()),
          jobDescription: z.string(),
          status: z.string(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        return await insertWorkshopJob(input);
      }),
  }),

  // Staff Attendance
  staff: router({
    listAttendance: publicProcedure
      .input(
        z.object({
          startDate: z.date().optional(),
          endDate: z.date().optional(),
          staffName: z.string().optional(),
        })
      )
      .query(async ({ input }) => {
        return await getStaffAttendance(input);
      }),
  }),

  // Expenses
  expenses: router({
    list: publicProcedure
      .input(
        z.object({
          startDate: z.date().optional(),
          endDate: z.date().optional(),
          category: z.string().optional(),
        })
      )
      .query(async ({ input }) => {
        return await getExpenses(input);
      }),

    create: protectedProcedure
      .input(
        z.object({
          expenseDate: z.date(),
          category: z.string(),
          description: z.string(),
          amount: z.number(),
          paymentMethod: z.string().optional(),
          // W3 — Petty Cash vs Sales Cash distinction from AGL daily reports.
          cashSource: z.enum(['petty_cash','sales_cash','bank','momo','other']).optional(),
          deductedFromSales: z.boolean().optional(),
          vendor: z.string().optional(),
          approvedBy: z.string().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        return await insertExpense(input);
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number().int(),
          expenseDate: z.date().optional(),
          category: z.string().optional(),
          description: z.string().optional(),
          amount: z.number().optional(),
          paymentMethod: z.string().nullable().optional(),
          cashSource: z.enum(['petty_cash','sales_cash','bank','momo','other']).nullable().optional(),
          deductedFromSales: z.boolean().nullable().optional(),
          vendor: z.string().nullable().optional(),
          approvedBy: z.string().nullable().optional(),
          notes: z.string().nullable().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        try {
          if (!(await canEditLedgers(ctx.user))) {
            return { success: false as const, error: 'Manager, owner, or principal account required.' };
          }
          const db = await getDb();
          if (!db) return { success: false as const, error: 'Database unavailable.' };
          const { expenses } = await import("../drizzle/schema");
          const { eq } = await import("drizzle-orm");
          const { id, expenseDate, amount, ...rest } = input;
          const patch: any = { ...rest };
          if (expenseDate !== undefined) patch.expenseDate = expenseDate;
          if (amount !== undefined) patch.amount = String(amount);
          await db.update(expenses).set(patch).where(eq(expenses.id, id));
          const [row] = await db.select().from(expenses).where(eq(expenses.id, id)).limit(1);
          return { success: true as const, expense: row };
        } catch (error) {
          return { success: false as const, error: (error as Error).message };
        }
      }),
  }),

  // Purchase Orders
  purchaseOrders: router({
    list: publicProcedure
      .input(z.object({ status: z.string().optional() }))
      .query(async ({ input }) => {
        return await getPurchaseOrders(input);
      }),

    create: protectedProcedure
      .input(
        z.object({
          poNumber: z.string(),
          poDate: z.date(),
          vendor: z.string(),
          description: z.string(),
          amount: z.number(),
          status: z.string(),
          deliveryDate: z.date().optional(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        return await insertPurchaseOrder(input);
      }),

    update: protectedProcedure
      .input(
        z.object({
          id: z.number().int(),
          poNumber: z.string().optional(),
          poDate: z.date().optional(),
          vendor: z.string().optional(),
          description: z.string().optional(),
          amount: z.number().optional(),
          status: z.string().optional(),
          deliveryDate: z.date().nullable().optional(),
          notes: z.string().nullable().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        try {
          if (!(await canEditLedgers(ctx.user))) {
            return { success: false as const, error: 'Manager, owner, or principal account required.' };
          }
          const db = await getDb();
          if (!db) return { success: false as const, error: 'Database unavailable.' };
          const { purchaseOrders } = await import("../drizzle/schema");
          const { eq } = await import("drizzle-orm");
          const { id, poDate, deliveryDate, amount, ...rest } = input;
          const patch: any = { ...rest };
          if (poDate !== undefined) patch.poDate = poDate;
          if (deliveryDate !== undefined) patch.deliveryDate = deliveryDate;
          if (amount !== undefined) patch.amount = String(amount);
          await db.update(purchaseOrders).set(patch).where(eq(purchaseOrders.id, id));
          const [row] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, id)).limit(1);
          return { success: true as const, order: row };
        } catch (error) {
          return { success: false as const, error: (error as Error).message };
        }
      }),
  }),

  // Inventory
  inventory: router({
    list: publicProcedure
      .input(
        z.object({
          category: z.string().optional(),
          lowStockOnly: z.boolean().optional(),
        })
      )
      .query(async ({ input }) => {
        return await getInventory(input);
      }),

    create: protectedProcedure
      .input(
        z.object({
          itemName: z.string(),
          itemCode: z.string(),
          category: z.string(),
          // Fractional units allowed (e.g. 1.5 L) — clamped to ≥ 0.
          quantity:      z.number().min(0),
          minStockLevel: z.number().min(0),
          unitPrice:     z.number().min(0),
          supplier: z.string().optional(),
          notes: z.string().optional(),
          // W8 — structured vehicle fitment columns
          vehicleMake: z.string().optional(),
          vehicleModel: z.string().optional(),
          yearMin: z.number().int().optional(),
          yearMax: z.number().int().optional(),
          engineCapacity: z.string().optional(),
          cleanDescription: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        try {
          return await insertInventory(input);
        } catch (error: any) {
          if (error?.code === 'ER_DUP_ENTRY') {
            return { success: false as const, error: `Part number already exists: ${input.itemCode}` };
          }
          return { success: false as const, error: error?.sqlMessage ?? error?.message ?? 'Failed to create inventory item.' };
        }
      }),

    /**
     * Update an existing inventory row. Every field except `id` is
     * optional — drizzle only patches what's supplied so callers can
     * partial-update without re-sending the whole record.
     */
    update: protectedProcedure
      .input(z.object({
        id: z.number().int(),
        itemName:        z.string().optional(),
        itemCode:        z.string().optional(),
        category:        z.string().optional(),
        quantity:        z.number().min(0).optional(),
        minStockLevel:   z.number().min(0).optional(),
        unitPrice:       z.number().nonnegative().optional(),
        supplier:        z.string().optional(),
        notes:           z.string().optional(),
        vehicleMake:     z.string().optional(),
        vehicleModel:    z.string().optional(),
        yearMin:         z.number().int().optional(),
        yearMax:         z.number().int().optional(),
        engineCapacity:  z.string().optional(),
        cleanDescription:z.string().optional(),
        lastRestockDate: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        try {
          const db = await import("./db").then((m) => m.getDb());
          if (!db) return { success: false as const, error: "Database unavailable." };
          const { inventory } = await import("../drizzle/schema");
          const { eq } = await import("drizzle-orm");
          const { id, unitPrice, quantity, minStockLevel, lastRestockDate, ...rest } = input;
          const patch: any = { ...rest };
          // Drizzle's decimal type expects strings on the way in. Numeric
          // payloads from the UI get coerced here so quantity = 1.5
          // round-trips cleanly.
          if (unitPrice      !== undefined) patch.unitPrice     = String(unitPrice);
          if (quantity       !== undefined) patch.quantity      = String(quantity);
          if (minStockLevel  !== undefined) patch.minStockLevel = String(minStockLevel);
          if (lastRestockDate !== undefined) patch.lastRestockDate = lastRestockDate ? new Date(lastRestockDate) : null;
          await db.update(inventory).set(patch).where(eq(inventory.id, id));
          const [row] = await db.select().from(inventory).where(eq(inventory.id, id)).limit(1);
          return { success: true as const, item: row };
        } catch (error) {
          return { success: false as const, error: (error as Error).message };
        }
      }),

    delete: protectedProcedure
      .input(z.object({ id: z.number().int() }))
      .mutation(async ({ input }) => {
        try {
          const db = await import("./db").then((m) => m.getDb());
          if (!db) return { success: false as const, error: "Database unavailable." };
          const { inventory } = await import("../drizzle/schema");
          const { eq } = await import("drizzle-orm");
          await db.delete(inventory).where(eq(inventory.id, input.id));
          return { success: true as const };
        } catch (error) {
          return { success: false as const, error: (error as Error).message };
        }
      }),

    /**
     * Inventory log — flattens stock movements into a single chronological feed.
     * Each entry is one of:
     *   - "receipt" — derived from inventory.lastRestockDate (one per SKU with that date)
     *   - "issue"   — one per appointment_parts row tied to an inventoryItemId
     */
    logEvents: protectedProcedure
      .input(z.object({ limit: z.number().int().positive().max(500).optional() }).optional())
      .query(async ({ input }) => {
        try {
          const limit = input?.limit ?? 200;
          const db = await import("./db").then(m => m.getDb());
          if (!db) return { success: true as const, events: [] };
          const { inventory, appointmentParts, serviceAppointments, customers, vehicles } = await import("../drizzle/schema");
          const { desc, eq } = await import("drizzle-orm");

          // Receipts (when stock was added — best-effort from lastRestockDate).
          const inv = await db.select().from(inventory);
          const receipts = inv
            .filter(r => r.lastRestockDate)
            .map(r => ({
              kind: "receipt" as const,
              at: r.lastRestockDate as unknown as Date,
              itemCode: r.itemCode,
              itemName: r.itemName,
              quantity: Number(r.quantity ?? 0),
              unitPrice: Number(r.unitPrice ?? 0),
              supplier: r.supplier ?? null,
              context: null as string | null,
            }));

          // Issues — parts consumed by appointments.
          const parts = await db
            .select({
              partId: appointmentParts.id,
              createdAt: appointmentParts.createdAt,
              inventoryItemId: appointmentParts.inventoryItemId,
              partName: appointmentParts.partName,
              quantity: appointmentParts.quantity,
              sellPrice: appointmentParts.sellPrice,
              appointmentId: appointmentParts.appointmentId,
              customerName: customers.name,
              registrationNo: vehicles.registrationNo,
            })
            .from(appointmentParts)
            .leftJoin(serviceAppointments, eq(appointmentParts.appointmentId, serviceAppointments.id))
            .leftJoin(customers, eq(serviceAppointments.customerId, customers.id))
            .leftJoin(vehicles, eq(serviceAppointments.vehicleId, vehicles.id))
            .orderBy(desc(appointmentParts.createdAt));

          // Resolve itemCode for each inventoryItemId.
          const invMap = new Map(inv.map(i => [i.id, i]));
          const issues = parts.map((p: any) => {
            const inv = p.inventoryItemId ? invMap.get(p.inventoryItemId) : null;
            return {
              kind: "issue" as const,
              at: p.createdAt as Date,
              itemCode: inv?.itemCode ?? null,
              itemName: p.partName ?? inv?.itemName ?? "(free-text part)",
              quantity: Number(p.quantity ?? 0),
              unitPrice: Number(p.sellPrice ?? 0),
              supplier: inv?.supplier ?? null,
              context: p.customerName
                ? `Job #${p.appointmentId} — ${p.customerName}${p.registrationNo ? ` (${p.registrationNo})` : ''}`
                : `Job #${p.appointmentId}`,
            };
          });

          const combined = [...receipts, ...issues]
            .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
            .slice(0, limit);

          return { success: true as const, events: combined };
        } catch (error) {
          return { success: false as const, error: (error as Error).message };
        }
      }),
  }),

  // Credit Sales
  creditSales: router({
    list: publicProcedure
      .input(z.object({ status: z.string().optional() }))
      .query(async ({ input }) => {
        return await getCreditSales(input);
      }),

    create: protectedProcedure
      .input(
        z.object({
          customerName: z.string(),
          customerContact: z.string().optional(),
          totalAmount: z.number(),
          amountPaid: z.number().optional(),
          amountDue: z.number(),
          saleDate: z.date(),
          dueDate: z.date().optional(),
          status: z.string(),
          notes: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        return await insertCreditSale(input);
      }),
  }),

  // Notifications
  notifications: router({
    list: publicProcedure
      .input(
        z.object({
          recipientRole: z.string().optional(),
          unreadOnly: z.boolean().optional(),
        })
      )
      .query(async ({ input }) => {
        return await getNotifications(input);
      }),

    create: protectedProcedure
      .input(
        z.object({
          title: z.string(),
          content: z.string(),
          type: z.string(),
          recipientRole: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        return await insertNotification(input);
      }),
  }),

  // Customers, Vehicles, Appointments & Notifications
  customers: customersRouter,
  vehicles: vehiclesRouter,
  appointments: appointmentsRouter,
  recalls: recallsRouter,
  reminders: remindersRouter,
  fixbot: fixbotRouter,
  bot: botRouter,
  notify: notifyRouter,

  // Multi-tenant & new modules
  tenants: tenantsRouter,
  staffManagement: staffRouter,
  staffPortal: staffPortalRouter,
  payroll: payrollRouter,
  transactions: transactionsRouter,
  subscriptions: subscriptionsRouter,
  complaints: complaintsRouter,
  forms:      formsRouter,

  // W4 — Wizardly ports
  dailyEntry:        dailyEntryRouter,
  schedule:          scheduleRouter,
  training:          trainingRouter,
  mechanicTracker:   mechanicTrackerRouter,
  serviceCatalog:    serviceCatalogRouter,
  kpiTarget:         kpiTargetRouter,

  // AI Chat
  ai: aiRouter,

  // Import Excel Data
  import: router({
    processExcel: publicProcedure
      .input(
        z.object({
          fileContent: z.string(),
          filename: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        try {
          // Create a temporary file from base64 content
          const path = require('path');
          const fs = require('fs');
          const os = require('os');
          
          const tempDir = os.tmpdir();
          const tempFilePath = path.join(tempDir, `excel-import-${Date.now()}-${Math.random().toString(36).slice(2)}.xlsx`);
          
          // Decode base64 and write to temp file
          const buffer = Buffer.from(input.fileContent, 'base64');
          fs.writeFileSync(tempFilePath, buffer);
          
          // Process the Excel file
          const result = await importExcelData(tempFilePath);
          
          // Clean up temp file
          try {
            fs.unlinkSync(tempFilePath);
          } catch (e) {
            console.error('Failed to clean up temp file:', e);
          }
          
          return {
            success: true,
            message: 'Import completed successfully',
            stats: result.stats || {},
          };
        } catch (error: any) {
          console.error('Import error:', error);
          return {
            success: false,
            message: error.message || 'Failed to process Excel file',
            stats: {},
          };
        }
      }),
  }),
});

export type AppRouter = typeof appRouter;
