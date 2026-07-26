/**
 * Wizardly routers. Six named exports the wider tree consumes.
 *
 *   - dailyEntryRouter:      WS2-C, full CRUD over `daily_entries`
 *   - mechanicTrackerRouter: WS2-D, see scoreboard query
 *   - scheduleRouter, trainingRouter, serviceCatalogRouter,
 *     kpiTargetRouter: keep stubs until their tables/pages catch up.
 */
import { z } from 'zod';
import { and, desc, eq, sql } from 'drizzle-orm';
import { router } from '../_core/trpc';
import { tenantProcedure } from '../_core/procedures';
import { db } from '../db';
import { dailyEntries } from '../../drizzle/schema';

const CATEGORIES = ['opening','cash_reconciliation','sales_summary','inventory_check','closing','handover','other'] as const;

const baseSchema = z.object({
  entryDate: z.string(),
  category:  z.enum(CATEGORIES),
  summary:   z.string().min(1).max(255),
  details:   z.string().optional(),
  amountGhs: z.number().nonnegative().optional(),
  flagged:   z.boolean().optional(),
  loggedBy:  z.string().max(160).optional(),
});

export const dailyEntryRouter = router({
  list: tenantProcedure
    .input(z.object({ category: z.string().optional(), from: z.string().optional(), to: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      try {
        const conds: any[] = [eq(dailyEntries.tenantId, ctx.tenantId)];
        if (input?.category && input.category !== 'all') conds.push(eq(dailyEntries.category, input.category as any));
        if (input?.from) conds.push(sql`${dailyEntries.entryDate} >= ${input.from}`);
        if (input?.to)   conds.push(sql`${dailyEntries.entryDate} <= ${input.to}`);
        const entries = await db.select().from(dailyEntries).where(and(...conds)).orderBy(desc(dailyEntries.entryDate), desc(dailyEntries.id));
        return { success: true as const, entries };
      } catch (error) {
        return { success: false as const, error: (error as Error).message, entries: [] };
      }
    }),

  create: tenantProcedure.input(baseSchema).mutation(async ({ ctx, input }) => {
    try {
      const [{ id }] = await db.insert(dailyEntries).values({
        tenantId:  ctx.tenantId,
        entryDate: new Date(input.entryDate),
        category:  input.category,
        summary:   input.summary,
        details:   input.details ?? null,
        amountGhs: input.amountGhs != null ? String(input.amountGhs) : null,
        flagged:   input.flagged ? 1 : 0,
        loggedBy:  input.loggedBy ?? null,
      }).$returningId();
      return { success: true as const, id };
    } catch (error) {
      return { success: false as const, error: (error as Error).message };
    }
  }),

  update: tenantProcedure
    .input(baseSchema.partial().extend({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const { id, entryDate, amountGhs, flagged, ...rest } = input;
        const patch: any = { ...rest };
        if (entryDate !== undefined) patch.entryDate = new Date(entryDate);
        if (amountGhs !== undefined) patch.amountGhs = amountGhs != null ? String(amountGhs) : null;
        if (flagged   !== undefined) patch.flagged   = flagged ? 1 : 0;
        await db.update(dailyEntries).set(patch).where(and(eq(dailyEntries.id, id), eq(dailyEntries.tenantId, ctx.tenantId)));
        return { success: true as const };
      } catch (error) {
        return { success: false as const, error: (error as Error).message };
      }
    }),

  delete: tenantProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await db.delete(dailyEntries).where(and(eq(dailyEntries.id, input.id), eq(dailyEntries.tenantId, ctx.tenantId)));
        return { success: true as const };
      } catch (error) {
        return { success: false as const, error: (error as Error).message };
      }
    }),
});

export const scheduleRouter        = router({});
export const trainingRouter        = router({});

/**
 * WS2-D — Mechanic Tracker live scoreboard. Aggregates per-mechanic
 * counters from the existing tables — completed `service_appointments`
 * by primary mechanic, attributed `sales_transactions` (mechanic column),
 * and recalls. No mock data; everything derives from the master-sheet
 * import.
 */
import { serviceAppointments, salesTransactions, appointmentRecalls, staff } from '../../drizzle/schema';

export const mechanicTrackerRouter = router({
  scoreboard: tenantProcedure
    .input(z.object({ startDate: z.date(), endDate: z.date() }))
    .query(async ({ ctx, input }) => {
      try {
        const mechs = await db.select().from(staff).where(and(
          eq(staff.tenantId, ctx.tenantId),
          eq(staff.role, 'mechanic'),
        ));
        // Pull completed appointments + sales in window once, aggregate in JS.
        const appts = await db.select().from(serviceAppointments).where(and(
          sql`${serviceAppointments.scheduledDate} >= ${input.startDate}`,
          sql`${serviceAppointments.scheduledDate} <= ${input.endDate}`,
        ));
        const sales = await db.select().from(salesTransactions).where(and(
          sql`${salesTransactions.transactionDate} >= ${input.startDate}`,
          sql`${salesTransactions.transactionDate} <= ${input.endDate}`,
        ));
        const allRecalls = await db.select().from(appointmentRecalls);

        const splitNames = (raw: any): string[] =>
          !raw ? [] : String(raw).split(/\s*(?:x|×|,|\/|&|\+)\s*/i).map(s => s.trim()).filter(Boolean);

        const board = mechs.map((m) => {
          const name = m.name;
          const completed = appts.filter(a => a.status === 'Completed' && (a as any).primaryMechanicId === m.id).length;
          const open      = appts.filter(a => a.status !== 'Completed' && a.status !== 'Cancelled' && (a as any).primaryMechanicId === m.id).length;
          const revenue = sales
            .filter(s => splitNames(s.mechanic).some(n => n.toLowerCase() === name.toLowerCase()))
            .reduce((sum: number, s: any) => sum + Number(s.totalAmount ?? 0), 0);
          // appointment_recalls doesn't carry a mechanic-at-fault column;
          // join through serviceAppointments → primary mechanic id instead.
          const apptIdsForThisMech = new Set(appts.filter((a: any) => a.primaryMechanicId === m.id).map((a: any) => a.id));
          const recallsAgainst = allRecalls.filter((r: any) => apptIdsForThisMech.has(r.appointmentId)).length;
          return { staffId: m.id, name, jobsCompleted: completed, openJobs: open, revenueGenerated: revenue, recallsAgainst };
        });
        return { success: true as const, scoreboard: board };
      } catch (error) {
        return { success: false as const, error: (error as Error).message, scoreboard: [] };
      }
    }),

  history: tenantProcedure.query(async ({ ctx }) => {
    try {
      const mechs = await db.select().from(staff).where(and(
        eq(staff.tenantId, ctx.tenantId),
        eq(staff.role, 'mechanic'),
      )).orderBy(staff.name);
      return { success: true as const, history: mechs };
    } catch (error) {
      return { success: false as const, error: (error as Error).message, history: [] };
    }
  }),
});

export const serviceCatalogRouter  = router({});
export const kpiTargetRouter       = router({});
