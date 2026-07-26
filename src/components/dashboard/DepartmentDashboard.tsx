import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Wallet, ClipboardList, Users, Repeat, TrendingUp, TrendingDown, LucideIcon,
  Package, AlertOctagon, Wrench, Briefcase, ShoppingCart, Calendar,
  Receipt, Clock, Boxes, ArrowRight, Loader2,
} from 'lucide-react';
import { trpc } from '../../lib/trpc';
import { computeGhanaTax, ghs } from '../../lib/ghanaTax';

/**
 * P4 — Department dashboard.
 *
 * One screen, five lenses: Sales / Operations / HR / Finance / Inventory.
 * Each pane is a grid of KPI cards driven by the global window selector
 * at the top. Every card carries an explicit `to=` link so clicking the
 * card lands you on the matching detail page with relevant filters.
 *
 * The window selector emits two ranges: `current` (the selected period)
 * and `previous` (the immediately preceding period of the same length).
 * Each KPI computes a delta % vs the previous range — that's what the
 * up/down chip shows.
 */

type Department = 'sales' | 'operations' | 'hr' | 'finance' | 'inventory';

type Window =
  | { kind: 'today' }
  | { kind: 'week' }
  | { kind: 'month' }
  | { kind: 'quarter' }
  | { kind: 'custom'; start: string; end: string };

interface DateRange { start: Date; end: Date }

function startOfDay(d: Date): Date { const c = new Date(d); c.setHours(0,0,0,0); return c; }
function endOfDay(d: Date): Date { const c = new Date(d); c.setHours(23,59,59,999); return c; }
function addDays(d: Date, n: number): Date { const c = new Date(d); c.setDate(c.getDate()+n); return c; }

function rangesFor(w: Window): { current: DateRange; previous: DateRange; label: string } {
  const now = new Date();
  const today = startOfDay(now);

  if (w.kind === 'today') {
    return {
      current:  { start: today, end: endOfDay(now) },
      previous: { start: addDays(today, -1), end: endOfDay(addDays(today, -1)) },
      label: 'today',
    };
  }
  if (w.kind === 'week') {
    const start = addDays(today, -6);
    return {
      current:  { start, end: endOfDay(now) },
      previous: { start: addDays(start, -7), end: endOfDay(addDays(start, -1)) },
      label: 'last 7 days',
    };
  }
  if (w.kind === 'month') {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const previousStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const previousEnd = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);
    return {
      current:  { start, end: endOfDay(now) },
      previous: { start: previousStart, end: previousEnd },
      label: 'this month',
    };
  }
  if (w.kind === 'quarter') {
    const q = Math.floor(today.getMonth() / 3);
    const start = new Date(today.getFullYear(), q * 3, 1);
    const previousStart = new Date(today.getFullYear(), q * 3 - 3, 1);
    const previousEnd = new Date(today.getFullYear(), q * 3, 0, 23, 59, 59, 999);
    return {
      current:  { start, end: endOfDay(now) },
      previous: { start: previousStart, end: previousEnd },
      label: 'this quarter',
    };
  }
  // custom
  const s = new Date(w.start);
  const e = endOfDay(new Date(w.end));
  const lenMs = e.getTime() - s.getTime();
  return {
    current:  { start: s, end: e },
    previous: { start: new Date(s.getTime() - lenMs - 1), end: new Date(s.getTime() - 1) },
    label: `${w.start} → ${w.end}`,
  };
}

function pctDelta(curr: number, prev: number): { dir: 'up' | 'down' | 'flat'; text: string } | undefined {
  if (prev <= 0 && curr <= 0) return undefined;
  if (prev <= 0) return { dir: 'up', text: 'new' };
  const pct = ((curr - prev) / prev) * 100;
  const dir = pct > 0.5 ? 'up' : pct < -0.5 ? 'down' : 'flat';
  return { dir, text: `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}% vs prior` };
}

function inRange(d: any, r: DateRange): boolean {
  if (!d) return false;
  const t = new Date(d).getTime();
  return t >= r.start.getTime() && t <= r.end.getTime();
}

// ─────────────────────────────────────────────────────────────────────────

export function DepartmentDashboard() {
  const [dept, setDept] = useState<Department>('sales');
  const [windowKind, setWindowKind] = useState<Window['kind']>('month');
  const [customStart, setCustomStart] = useState<string>(new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10));
  const [customEnd, setCustomEnd] = useState<string>(new Date().toISOString().slice(0, 10));

  const win: Window = windowKind === 'custom'
    ? { kind: 'custom', start: customStart, end: customEnd }
    : { kind: windowKind } as Window;
  const { current, previous, label } = rangesFor(win);

  // Pull all the underlying queries once and slice per-department.
  const inventoryQ   = trpc.inventory.list.useQuery({}, { keepPreviousData: true });
  const recallsQ     = trpc.recalls.list.useQuery(undefined as any, { keepPreviousData: true });
  const apptsQ       = trpc.appointments.list.useQuery(undefined as any, { keepPreviousData: true });
  const customersQ   = trpc.customers.list.useQuery({}, { keepPreviousData: true });
  const txQ          = trpc.transactions.summary.useQuery(undefined as any, { keepPreviousData: true });
  const subsQ        = trpc.subscriptions.listSubscriptions.useQuery(undefined as any, { keepPreviousData: true });
  const salesQ       = trpc.sales.list.useQuery({ startDate: current.start, endDate: current.end } as any, { keepPreviousData: true });
  const salesPrevQ   = trpc.sales.list.useQuery({ startDate: previous.start, endDate: previous.end } as any, { keepPreviousData: true });
  const expensesQ    = trpc.expenses.list.useQuery({ startDate: current.start, endDate: current.end } as any, { keepPreviousData: true });
  const expensesPrevQ= trpc.expenses.list.useQuery({ startDate: previous.start, endDate: previous.end } as any, { keepPreviousData: true });
  const staffQ       = trpc.staffManagement.list.useQuery({ status: 'active' }, { keepPreviousData: true });
  const attendanceQ  = trpc.staffManagement.listAttendance.useQuery(undefined as any, { keepPreviousData: true });

  // Pull-and-cast helpers — tRPC narrows types tightly but the routers
  // return mixed shapes, so we read defensively.
  const sales: any[]      = Array.isArray(salesQ.data) ? salesQ.data : ((salesQ.data as any)?.transactions ?? []);
  const salesPrev: any[]  = Array.isArray(salesPrevQ.data) ? salesPrevQ.data : ((salesPrevQ.data as any)?.transactions ?? []);
  const expenses: any[]   = Array.isArray(expensesQ.data) ? expensesQ.data : ((expensesQ.data as any)?.expenses ?? []);
  const expensesPrev: any[] = Array.isArray(expensesPrevQ.data) ? expensesPrevQ.data : ((expensesPrevQ.data as any)?.expenses ?? []);
  const inventory: any[]  = Array.isArray(inventoryQ.data) ? inventoryQ.data : [];
  const recalls: any[]    = (recallsQ.data as any)?.success ? (recallsQ.data as any).recalls ?? [] : [];
  const appts: any[]      = (apptsQ.data as any)?.success ? (apptsQ.data as any).appointments ?? [] : [];
  const customers: any[]  = (customersQ.data as any)?.success ? (customersQ.data as any).customers ?? [] : [];
  const subs: any[]       = (subsQ.data as any)?.success ? (subsQ.data as any).subscriptions ?? [] : [];
  const staff: any[]      = (staffQ.data as any)?.success ? (staffQ.data as any).staff ?? [] : [];
  const attendance: any[] = (attendanceQ.data as any)?.success ? (attendanceQ.data as any).attendanceLogs ?? [] : [];

  // ── SALES department ──
  const salesPanel = useMemo(() => {
    const revenue = sales.reduce((s, r: any) => s + Number(r.totalAmount ?? r.total_amount ?? 0), 0);
    const revenuePrev = salesPrev.reduce((s, r: any) => s + Number(r.totalAmount ?? r.total_amount ?? 0), 0);
    const orders = sales.length;
    const ordersPrev = salesPrev.length;
    const aov = orders > 0 ? revenue / orders : 0;
    const aovPrev = ordersPrev > 0 ? revenuePrev / ordersPrev : 0;
    const channels = new Set(sales.map((r: any) => r.channel)).size;
    return { revenue, revenuePrev, orders, ordersPrev, aov, aovPrev, channels };
  }, [sales, salesPrev]);

  // ── OPERATIONS (Workshop) ──
  const opsPanel = useMemo(() => {
    const openJobs = appts.filter((r: any) => {
      const s = r.appointment?.status ?? r.status;
      return s && s !== 'Completed' && s !== 'Cancelled';
    }).length;
    const completedInWindow = appts.filter((r: any) => {
      const a = r.appointment ?? r;
      const s = a.status;
      const d = a.updatedAt ?? a.scheduledDate;
      return s === 'Completed' && inRange(d, current);
    }).length;
    const completedPrev = appts.filter((r: any) => {
      const a = r.appointment ?? r;
      const s = a.status;
      const d = a.updatedAt ?? a.scheduledDate;
      return s === 'Completed' && inRange(d, previous);
    }).length;
    const openRecalls = recalls.filter((r: any) => r.status === 'open').length;
    // Average cycle time across completed appointments in the current
    // window — derived from scheduledDate → updatedAt timestamps.
    const completedCycleMs = appts
      .map((r: any) => {
        const a = r.appointment ?? r;
        if (a.status !== 'Completed') return null;
        if (!inRange(a.updatedAt ?? a.scheduledDate, current)) return null;
        const start = a.scheduledDate ? new Date(a.scheduledDate).getTime() : null;
        const end   = a.updatedAt     ? new Date(a.updatedAt).getTime()     : null;
        if (!start || !end || end <= start) return null;
        return end - start;
      })
      .filter((v: any): v is number => typeof v === 'number');
    const avgCycleHours = completedCycleMs.length > 0
      ? completedCycleMs.reduce((s: number, v: number) => s + v, 0) / completedCycleMs.length / 3_600_000
      : 0;
    return { openJobs, completedInWindow, completedPrev, openRecalls, recallTotal: recalls.length, avgCycleHours, cycleSampleSize: completedCycleMs.length };
  }, [appts, recalls, current, previous]);

  // ── HR ──
  const hrPanel = useMemo(() => {
    const headcount = staff.length;
    const byRole = staff.reduce((acc: Record<string, number>, s: any) => {
      acc[s.role] = (acc[s.role] ?? 0) + 1;
      return acc;
    }, {});
    const logsInWindow = attendance.filter((row: any) => {
      const log = row.log ?? row;
      return inRange(log.clockInTime, current);
    });
    const logsPrev = attendance.filter((row: any) => {
      const log = row.log ?? row;
      return inRange(log.clockInTime, previous);
    });
    const overtimeHours = logsInWindow.reduce((s: number, row: any) => {
      const log = row.log ?? row;
      return s + Number(log.overtimeHours ?? 0);
    }, 0);
    const overtimeHoursPrev = logsPrev.reduce((s: number, row: any) => {
      const log = row.log ?? row;
      return s + Number(log.overtimeHours ?? 0);
    }, 0);
    const lateCount = logsInWindow.filter((row: any) => {
      const ci = (row.log ?? row).clockInTime;
      if (!ci) return false;
      const d = new Date(ci);
      return d.getHours() > 8 || (d.getHours() === 8 && d.getMinutes() > 0);
    }).length;
    const missedPunches = logsInWindow.filter((row: any) => {
      const log = row.log ?? row;
      return !log.clockInTime || !log.clockOutTime;
    }).length;
    return { headcount, byRole, overtimeHours, overtimeHoursPrev, lateCount, missedPunches, shiftsLogged: logsInWindow.length };
  }, [staff, attendance, current, previous]);

  // ── FINANCE ──
  const financePanel = useMemo(() => {
    const revenue = sales.reduce((s, r: any) => s + Number(r.totalAmount ?? r.total_amount ?? 0), 0);
    const revenuePrev = salesPrev.reduce((s, r: any) => s + Number(r.totalAmount ?? r.total_amount ?? 0), 0);
    const opex = expenses.reduce((s, r: any) => s + Number(r.amount ?? 0), 0);
    const opexPrev = expensesPrev.reduce((s, r: any) => s + Number(r.amount ?? 0), 0);
    const netProfit = revenue - opex;
    const netProfitPrev = revenuePrev - opexPrev;
    const tax = computeGhanaTax({ netBeforeDiscount: revenue });
    const mrr = subs
      .filter((r: any) => r.subscription?.status === 'active')
      .reduce((s: number, r: any) => s + Number(r.plan?.monthlyPrice ?? 0), 0);
    return { revenue, revenuePrev, opex, opexPrev, netProfit, netProfitPrev, tax, mrr };
  }, [sales, salesPrev, expenses, expensesPrev, subs]);

  // ── INVENTORY ──
  const inventoryPanel = useMemo(() => {
    const skuCount = inventory.length;
    const totalValue = inventory.reduce((s: number, i: any) => s + Number(i.quantity ?? 0) * Number(i.unitPrice ?? 0), 0);
    const lowStock = inventory.filter((i: any) => {
      const q = Number(i.quantity ?? 0); const m = Number(i.minStockLevel ?? 0);
      return q > 0 && q <= m;
    }).length;
    const outOfStock = inventory.filter((i: any) => Number(i.quantity ?? 0) <= 0).length;
    return { skuCount, totalValue, lowStock, outOfStock };
  }, [inventory]);

  const anyLoading =
    inventoryQ.isLoading || apptsQ.isLoading || customersQ.isLoading ||
    salesQ.isLoading || expensesQ.isLoading || staffQ.isLoading;

  return (
    <section className="grid gap-4">
      {/* Window + department selectors */}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-sans text-xl font-semibold text-ink-900 flex items-center gap-2">
            <Calendar size={16} /> Department dashboard
            <span className="text-sm font-normal text-neutral-500">— {label}</span>
          </h2>
          <p className="text-sm text-neutral-600">
            Drill into Sales, Operations, HR, Finance or Inventory. Every card compares to the prior {label === 'today' ? 'day' : label.replace('this ', '').replace('last 7 days', 'week')}.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(['today','week','month','quarter','custom'] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setWindowKind(k)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-colors ${
                windowKind === k ? 'bg-brand-500 text-white' : 'bg-white border border-line text-neutral-600 hover:bg-canvas'
              }`}
            >
              {k === 'week' ? '7 days' : k}
            </button>
          ))}
          {windowKind === 'custom' && (
            <span className="flex items-center gap-1.5 text-xs">
              <input type="date" className="field-input text-xs" value={customStart} onChange={(e) => setCustomStart(e.target.value)} style={{ padding: '4px 6px' }} />
              <span className="text-neutral-500">→</span>
              <input type="date" className="field-input text-xs" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} style={{ padding: '4px 6px' }} />
            </span>
          )}
        </div>
      </div>

      {/* Department tabs */}
      <nav className="flex items-center gap-1 bg-white border border-line rounded-2xl p-1 w-fit overflow-x-auto">
        {([
          { id: 'sales',       label: 'Sales',       icon: ShoppingCart },
          { id: 'operations',  label: 'Operations',  icon: Wrench },
          { id: 'hr',          label: 'HR',          icon: Briefcase },
          { id: 'finance',     label: 'Finance',     icon: Wallet },
          { id: 'inventory',   label: 'Inventory',   icon: Boxes },
        ] as { id: Department; label: string; icon: LucideIcon }[]).map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => setDept(d.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap ${
              dept === d.id ? 'bg-brand-500 text-white' : 'text-neutral-600 hover:bg-canvas'
            }`}
          >
            <d.icon size={14} /> {d.label}
          </button>
        ))}
      </nav>

      {anyLoading && (
        <div className="text-center text-sm text-neutral-500 py-4">
          <Loader2 size={14} className="animate-spin inline" /> Refreshing department metrics…
        </div>
      )}

      {/* Panel */}
      {dept === 'sales' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <KpiCard label="Revenue"        value={ghs(salesPanel.revenue)} caption={`${salesPanel.orders} orders`} icon={Wallet} tone="red" to="/sales" delta={pctDelta(salesPanel.revenue, salesPanel.revenuePrev)} />
          <KpiCard label="Orders"         value={String(salesPanel.orders)} caption={`${salesPanel.channels} channels`} icon={ShoppingCart} tone="ink" to="/sales" delta={pctDelta(salesPanel.orders, salesPanel.ordersPrev)} />
          <KpiCard label="Average order"  value={ghs(salesPanel.aov)} caption="Per transaction" icon={TrendingUp} tone="ink" to="/sales" delta={pctDelta(salesPanel.aov, salesPanel.aovPrev)} />
          <KpiCard label="Customers"      value={String(customers.length)} caption="On the ledger" icon={Users} tone="red" to="/customers" />
        </div>
      )}

      {dept === 'operations' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <KpiCard label="Open jobs"          value={String(opsPanel.openJobs)} caption="All bays" icon={ClipboardList} tone="ink" to="/workshop" />
          <KpiCard label="Completed"          value={String(opsPanel.completedInWindow)} caption={`In ${label}`} icon={Wrench} tone="red" to="/workshop?status=Completed" delta={pctDelta(opsPanel.completedInWindow, opsPanel.completedPrev)} />
          <KpiCard label="Open recalls"       value={String(opsPanel.openRecalls)} caption={`${opsPanel.recallTotal} total`} icon={AlertOctagon} tone={opsPanel.openRecalls > 0 ? 'red' : 'ink'} to="/recalls" />
          <KpiCard
            label="Avg job cycle"
            value={opsPanel.cycleSampleSize > 0 ? `${opsPanel.avgCycleHours.toFixed(1)}h` : '—'}
            caption={opsPanel.cycleSampleSize > 0 ? `Across ${opsPanel.cycleSampleSize} completed` : 'Awaiting completed jobs'}
            icon={Clock}
            tone="ink"
            to="/workshop"
          />
        </div>
      )}

      {dept === 'hr' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <KpiCard label="Active staff"     value={String(hrPanel.headcount)} caption={Object.entries(hrPanel.byRole).map(([r, n]) => `${n} ${r}`).join(' · ')} icon={Users} tone="red" to="/hr" />
          <KpiCard label="Shifts logged"    value={String(hrPanel.shiftsLogged)} caption={`In ${label}`} icon={Clock} tone="ink" to="/clock" />
          <KpiCard label="Overtime hours"   value={hrPanel.overtimeHours.toFixed(1)} caption="Paid at 1.5×" icon={TrendingUp} tone="ink" to="/clock" delta={pctDelta(hrPanel.overtimeHours, hrPanel.overtimeHoursPrev)} />
          <KpiCard label="Late + missed"    value={String(hrPanel.lateCount + hrPanel.missedPunches)} caption={`${hrPanel.lateCount} late · ${hrPanel.missedPunches} missed`} icon={AlertOctagon} tone={(hrPanel.lateCount + hrPanel.missedPunches) > 0 ? 'red' : 'ink'} to="/clock" />
        </div>
      )}

      {dept === 'finance' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <KpiCard label="Revenue"        value={ghs(financePanel.revenue)} caption={label} icon={Wallet} tone="red" to="/finance" delta={pctDelta(financePanel.revenue, financePanel.revenuePrev)} />
          <KpiCard label="Operating exp." value={ghs(financePanel.opex)} caption={label} icon={Receipt} tone="ink" to="/expenses-hub" delta={pctDelta(financePanel.opex, financePanel.opexPrev)} />
          <KpiCard label="Net profit"     value={ghs(financePanel.netProfit)} caption={financePanel.netProfit >= 0 ? 'In the black' : 'Loss'} icon={financePanel.netProfit >= 0 ? TrendingUp : TrendingDown} tone={financePanel.netProfit >= 0 ? 'ink' : 'red'} to="/expenses-hub" delta={pctDelta(financePanel.netProfit, financePanel.netProfitPrev)} />
          <KpiCard label="MRR"            value={ghs(financePanel.mrr)} caption="Subscriptions" icon={Repeat} tone="ink" to="/subscriptions" />
          <KpiCard label="VAT liability"  value={ghs(financePanel.tax.vat)} caption="To remit" icon={Receipt} tone="ink" to="/expenses-hub" />
          <KpiCard label="NHIL"           value={ghs(financePanel.tax.nhil)} caption="2.5% levy" icon={Receipt} tone="ink" to="/expenses-hub" />
          <KpiCard label="GETFund"        value={ghs(financePanel.tax.getfund)} caption="2.5% levy" icon={Receipt} tone="ink" to="/expenses-hub" />
          <KpiCard label="COVID levy"     value={ghs(financePanel.tax.covid)} caption="1.0% levy" icon={Receipt} tone="ink" to="/expenses-hub" />
        </div>
      )}

      {dept === 'inventory' && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <KpiCard label="SKUs on ledger" value={String(inventoryPanel.skuCount)} caption="Distinct parts" icon={Boxes} tone="ink" to="/inventory" />
          <KpiCard label="Stock value"    value={ghs(inventoryPanel.totalValue)} caption="Qty × unit price" icon={Wallet} tone="red" to="/inventory" />
          <KpiCard label="Low stock"      value={String(inventoryPanel.lowStock)} caption="At or below reorder" icon={Package} tone={inventoryPanel.lowStock > 0 ? 'red' : 'ink'} to="/inventory?status=low" />
          <KpiCard label="Out of stock"   value={String(inventoryPanel.outOfStock)} caption="Urgent restock" icon={Package} tone={inventoryPanel.outOfStock > 0 ? 'red' : 'ink'} to="/inventory?status=out" />
        </div>
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────

function KpiCard({
  label, value, caption, icon: Icon, tone, to, delta,
}: {
  label: string;
  value: string;
  caption: string;
  icon: LucideIcon;
  tone: 'red' | 'ink';
  to?: string;
  delta?: { dir: 'up' | 'down' | 'flat'; text: string };
}) {
  const inner = (
    <article className="group card-feature !p-4 flex flex-col gap-2 h-full transition-shadow hover:shadow-pop min-w-0">
      <header className="flex items-center justify-between gap-2 min-w-0">
        <span className="kpi-label">{label}</span>
        <span className={tone === 'red' ? 'tile-red !w-7 !h-7 !rounded-xl shrink-0' : 'tile-ink !w-7 !h-7 !rounded-xl shrink-0'}>
          <Icon size={12} />
        </span>
      </header>
      <div className="kpi-value num-tabular text-black">{value}</div>
      <footer className="flex items-center justify-between gap-2 min-w-0">
        <span className="text-[12.5px] text-neutral-500 truncate">{caption}</span>
        {delta && (
          <span className={`chip ${
            delta.dir === 'up' ? 'bg-emerald-50 text-emerald-700' :
            delta.dir === 'down' ? 'bg-brand-50 text-brand-600' :
            'bg-canvas text-neutral-600'
          }`}>
            {delta.dir === 'up' ? <TrendingUp size={10}/> :
             delta.dir === 'down' ? <TrendingDown size={10}/> : null}
            {delta.text}
          </span>
        )}
        {to && <ArrowRight size={12} className="opacity-0 group-hover:opacity-100 text-brand-500 transition-opacity shrink-0" />}
      </footer>
    </article>
  );
  return to ? <Link to={to} className="block">{inner}</Link> : inner;
}
