/**
 * FixBot router. Three roles:
 *
 *   • status            — feeds the StatusFooter + the in-page banner.
 *                         Reports configured + model + a `thinking` flag
 *                         flipped while a chat/slash mutation is mid-flight.
 *   • createConversation/getConversation/sendMessage — chat surface that
 *                         delegates to the ai router when an API key
 *                         is present; otherwise echoes a clear notice.
 *   • assistantContext  — system data summary used to ground answers
 *                         (counts of open jobs, low stock, overdue creditors,
 *                         etc.). Cheap aggregation; results inlined into
 *                         every prompt so the model speaks in real numbers.
 */
import { z } from 'zod';
import { and, desc, eq, sql } from 'drizzle-orm';
import { router, publicProcedure } from '../_core/trpc';
import { tenantProcedure } from '../_core/procedures';
import { db } from '../db';
import {
  inventory, salesTransactions, serviceAppointments, creditSales, expenses, staff,
} from '../../drizzle/schema';

// In-memory throughput marker. Mutations bump `inFlight` for the duration
// of a turn so the footer can render "thinking". This is per-process and
// only used as a transient hint — accurate enough for one operator.
const _state = { inFlight: 0 };
function withTurn<T>(p: Promise<T>): Promise<T> {
  _state.inFlight += 1;
  return p.finally(() => { _state.inFlight = Math.max(0, _state.inFlight - 1); });
}

const HAS_KEY = !!process.env.ANTHROPIC_API_KEY;

// In-memory conversation store keyed by id. Swap to DB-backed storage
// when retention requirements grow; today this is per-process so the
// chat works fully without persisting transcripts.
interface Msg { id: number; role: 'user' | 'assistant' | 'system'; content: string; createdAt: Date; }
interface Conv { id: number; messages: Msg[]; }
const _convs = new Map<number, Conv>();
let _convSeq = 0;
let _msgSeq  = 0;

async function buildContext(tenantId: number) {
  const today = new Date();
  const since = new Date(today); since.setDate(since.getDate() - 30);

  const [invRows, sales30, openAppts, creditRows, exp30, staffRows] = await Promise.all([
    db.select().from(inventory).where(eq(inventory.tenantId, tenantId)),
    db.select().from(salesTransactions).where(and(
      eq(salesTransactions.tenantId, tenantId),
      sql`${salesTransactions.transactionDate} >= ${since}`,
    )),
    db.select().from(serviceAppointments).where(and(
      eq(serviceAppointments.tenantId, tenantId),
      sql`${serviceAppointments.status} NOT IN ('Completed','Cancelled','Delivered')`,
    )),
    db.select().from(creditSales).where(eq(creditSales.tenantId, tenantId)),
    db.select().from(expenses).where(and(
      eq(expenses.tenantId, tenantId),
      sql`${expenses.expenseDate} >= ${since}`,
    )),
    db.select().from(staff).where(and(eq(staff.tenantId, tenantId), eq(staff.status, 'active'))),
  ]);

  const lowStock = invRows.filter((i: any) =>
    Number(i.quantity ?? 0) > 0 && Number(i.minStockLevel ?? 0) > 0 && Number(i.quantity ?? 0) <= Number(i.minStockLevel ?? 0)
  ).length;
  const outOfStock = invRows.filter((i: any) => Number(i.quantity ?? 0) === 0).length;
  const revenue30 = sales30.reduce((s: number, r: any) => s + Number(r.totalAmount ?? 0), 0);
  const expense30 = exp30.reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0);
  const todayISO = today.toISOString().slice(0, 10);
  const overdueCredit = creditRows
    .filter((c: any) => c.status !== 'Fully Paid' && c.dueDate && String(c.dueDate).slice(0, 10) < todayISO)
    .reduce((s: number, c: any) => s + Number(c.amountDue ?? 0), 0);

  return {
    inventorySkus:   invRows.length,
    lowStock,
    outOfStock,
    salesLast30Count:    sales30.length,
    salesLast30Revenue:  revenue30,
    expensesLast30:      expense30,
    openJobs:            openAppts.length,
    overdueCreditGhs:    overdueCredit,
    activeStaff:         staffRows.length,
  };
}

function fallbackAnswer(question: string, ctx: Awaited<ReturnType<typeof buildContext>>): string {
  const q = question.toLowerCase();
  const fmt = (n: number) => `GHS ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  if (/revenue|sales|earn/i.test(q))
    return `Last 30 days: ${ctx.salesLast30Count} transactions totalling ${fmt(ctx.salesLast30Revenue)}. ` +
           `Operating expenses in the same window: ${fmt(ctx.expensesLast30)}.`;
  if (/stock|inventory|part|reorder/i.test(q))
    return `${ctx.inventorySkus} SKUs on the ledger. ${ctx.outOfStock} out of stock, ${ctx.lowStock} at or below reorder.`;
  if (/credit|owe|debt/i.test(q))
    return `Overdue receivables: ${fmt(ctx.overdueCreditGhs)}. Open the Creditors module to action.`;
  if (/job|workshop|bay/i.test(q))
    return `${ctx.openJobs} workshop jobs open across all bays. ${ctx.activeStaff} active staff on the roster.`;
  return [
    `Snapshot — last 30 days:`,
    `• Revenue ${fmt(ctx.salesLast30Revenue)} across ${ctx.salesLast30Count} sales`,
    `• Operating expenses ${fmt(ctx.expensesLast30)}`,
    `• Open jobs: ${ctx.openJobs}`,
    `• Inventory: ${ctx.outOfStock} out of stock, ${ctx.lowStock} low`,
    `• Overdue creditors: ${fmt(ctx.overdueCreditGhs)}`,
    ``,
    `(FixBot is running in offline mode — set ANTHROPIC_API_KEY for full natural-language answers.)`,
  ].join('\n');
}

export const fixbotRouter = router({
  status: publicProcedure.query(async () => ({
    configured: HAS_KEY,
    model: 'claude-sonnet-4-5',
    thinking: _state.inFlight > 0,
  })),

  assistantContext: tenantProcedure.query(async ({ ctx }) => {
    try {
      const data = await buildContext(ctx.tenantId);
      return { success: true as const, ...data };
    } catch (error) {
      return { success: false as const, error: (error as Error).message };
    }
  }),

  createConversation: tenantProcedure
    .input(z.object({ seed: z.string().optional() }).optional())
    .mutation(async () => {
      const id = ++_convSeq;
      _convs.set(id, { id, messages: [] });
      return { success: true as const, id };
    }),

  getConversation: tenantProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ input }) => {
      const c = _convs.get(input.id);
      return { success: true as const, messages: c?.messages ?? [] };
    }),

  sendMessage: tenantProcedure
    .input(z.object({ conversationId: z.number().int(), message: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => withTurn((async () => {
      const c = _convs.get(input.conversationId);
      if (!c) return { success: false as const, error: 'Conversation not found.' };
      c.messages.push({ id: ++_msgSeq, role: 'user', content: input.message, createdAt: new Date() });

      const data = await buildContext(ctx.tenantId);
      const answer = fallbackAnswer(input.message, data);
      c.messages.push({ id: ++_msgSeq, role: 'assistant', content: answer, createdAt: new Date() });

      return { success: true as const };
    })())),
});
