import { useMemo, useState } from 'react';
import { Printer, LayoutDashboard, TrendingUp, TrendingDown, Wallet, ShoppingCart, Wrench, Users, Loader2, Lock } from 'lucide-react';
import { trpc } from '../../lib/trpc';
import { useRole } from '../../lib/useRole';
import { PrintLayout } from '../../components/print/PrintLayout';
import { DateRangePicker, rangeFor, type RangePreset } from '../../components/ui/DateRangePicker';

/**
 * WS4-B — Manager BI Dashboard. KPI cards + computed measures
 * (MoM growth, margins, utilisation rate) + interactive slicers
 * + print-current-view. Role-gated to Manager + Admin.
 *
 * Charts kept lightweight SVG to avoid a chart-library dependency
 * — keeps the bundle small and lets <PrintLayout> capture them
 * cleanly without a canvas/html2canvas hop.
 */

const ghs = (n: number) => `GHS ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function BIDashboardPage() {
  const { isManager, loading } = useRole();
  if (loading) return <div className="text-center text-neutral-500 py-8"><Loader2 size={14} className="animate-spin inline mr-1"/> Resolving access…</div>;
  if (!isManager) {
    return (
      <div className="card-feature flex items-start gap-3 max-w-xl">
        <span className="tile-red"><Lock size={18}/></span>
        <div>
          <h2 className="text-base font-bold">Manager-only view</h2>
          <p className="text-sm text-neutral-600 mt-1">
            The BI dashboard is restricted to Manager and Admin roles. Ask your administrator to elevate your role if you need access.
          </p>
        </div>
      </div>
    );
  }
  return <BIDashboard/>;
}

function BIDashboard() {
  const [preset, setPreset]         = useState<RangePreset>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo]     = useState('');
  const [dept, setDept]             = useState<string>('all');
  const [category, setCategory]     = useState<string>('all');
  const range = useMemo(() => rangeFor(preset, customFrom, customTo), [preset, customFrom, customTo]);

  // Previous-period range for MoM growth computation.
  const prevRange = useMemo(() => {
    const span = range.to.getTime() - range.from.getTime();
    return { from: new Date(range.from.getTime() - span), to: new Date(range.to.getTime() - span) };
  }, [range]);

  const salesQ     = trpc.sales.list.useQuery({ startDate: range.from, endDate: range.to } as any, { keepPreviousData: true });
  const salesPrevQ = trpc.sales.list.useQuery({ startDate: prevRange.from, endDate: prevRange.to } as any, { keepPreviousData: true });
  const expensesQ  = trpc.expenses.list.useQuery({ startDate: range.from, endDate: range.to } as any, { keepPreviousData: true });
  const inventoryQ = trpc.inventory.list.useQuery({}, { keepPreviousData: true });
  const apptsQ     = trpc.appointments.list.useQuery({} as any, { keepPreviousData: true });
  const staffQ     = trpc.staffManagement.list.useQuery(undefined as any, { keepPreviousData: true });

  const salesData:      any = salesQ.data;
  const salesPrevData:  any = salesPrevQ.data;
  const expensesData:   any = expensesQ.data;
  const sales: any[]     = Array.isArray(salesData)     ? salesData     : (salesData?.transactions     ?? []);
  const salesPrev: any[] = Array.isArray(salesPrevData) ? salesPrevData : (salesPrevData?.transactions ?? []);
  const expenses: any[]  = Array.isArray(expensesData)  ? expensesData  : (expensesData?.expenses      ?? []);
  const inventory: any[] = Array.isArray(inventoryQ.data) ? inventoryQ.data : [];
  const appts: any[]     = apptsQ.data?.success ? apptsQ.data.appointments ?? [] : (Array.isArray(apptsQ.data) ? apptsQ.data : []);
  const staff: any[]     = staffQ.data?.success ? staffQ.data.staff ?? [] : [];

  // ── Computed measures (DAX-equivalent) ────────────────────────────
  const measures = useMemo(() => {
    const filt = (rows: any[]) => rows.filter((r) => {
      if (category !== 'all') {
        const c = (r.category ?? r.channel ?? '').toString().toLowerCase();
        if (c !== category) return false;
      }
      return true;
    });
    const s     = filt(sales);
    const sPrev = filt(salesPrev);
    const e     = filt(expenses);
    const revenue     = s.reduce((sum: number, r: any) => sum + Number(r.totalAmount ?? r.total_amount ?? 0), 0);
    const revenuePrev = sPrev.reduce((sum: number, r: any) => sum + Number(r.totalAmount ?? r.total_amount ?? 0), 0);
    const opex        = e.reduce((sum: number, r: any) => sum + Number(r.amount ?? 0), 0);
    const orders      = s.length;
    const ordersPrev  = sPrev.length;
    const aov         = orders > 0 ? revenue / orders : 0;
    const aovPrev     = ordersPrev > 0 ? revenuePrev / ordersPrev : 0;
    const margin      = revenue > 0 ? ((revenue - opex) / revenue) * 100 : 0;
    const momGrowth   = revenuePrev > 0 ? ((revenue - revenuePrev) / revenuePrev) * 100 : 0;
    const completedJobs = appts.filter((r: any) => (r.appointment?.status ?? r.status) === 'Completed').length;
    const openJobs      = appts.filter((r: any) => {
      const st = (r.appointment?.status ?? r.status) ?? '';
      return st && st !== 'Completed' && st !== 'Cancelled';
    }).length;
    const utilization   = (completedJobs + openJobs) > 0 ? (completedJobs / (completedJobs + openJobs)) * 100 : 0;
    const skuCount    = inventory.length;
    const lowStock    = inventory.filter((i: any) => Number(i.quantity ?? 0) > 0 && Number(i.quantity ?? 0) <= Number(i.minStockLevel ?? 0)).length;
    return { revenue, revenuePrev, opex, orders, aov, aovPrev, margin, momGrowth, completedJobs, openJobs, utilization, skuCount, lowStock, headcount: staff.length };
  }, [sales, salesPrev, expenses, appts, inventory, staff, category]);

  const categories = useMemo(() => {
    const c = new Set<string>();
    sales.forEach((r) => c.add(String(r.channel ?? '').toLowerCase()));
    return Array.from(c).filter(Boolean).sort();
  }, [sales]);

  return (
    <div>
      <div className="no-print flex flex-wrap items-end gap-2 mb-4">
        <DateRangePicker
          preset={preset} onPresetChange={setPreset}
          customFrom={customFrom} customTo={customTo}
          onCustomFromChange={setCustomFrom} onCustomToChange={setCustomTo}
          presets={['today', 'week', 'month', 'quarter', 'year', 'custom']}
        />
        <select className="field-input text-sm" value={dept} onChange={(e) => setDept(e.target.value)}>
          <option value="all">All departments</option>
          <option value="sales">Sales</option><option value="workshop">Workshop</option>
          <option value="finance">Finance</option><option value="hr">HR</option>
        </select>
        <select className="field-input text-sm" value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="all">All channels</option>
          {categories.map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
        </select>
        <button type="button" className="btn-primary text-sm ml-auto" onClick={() => window.print()}>
          <Printer size={14}/> Print view
        </button>
      </div>

      <PrintLayout
        eyebrow="Manager BI Dashboard"
        title={`${range.label}`}
        subtitle={`${range.from.toLocaleDateString()} → ${range.to.toLocaleDateString()}`}
        orientation="landscape"
        meta={{
          'Revenue':       ghs(measures.revenue),
          'MoM growth':    `${measures.momGrowth >= 0 ? '+' : ''}${measures.momGrowth.toFixed(1)}%`,
          'Net margin':    `${measures.margin.toFixed(1)}%`,
          'Utilization':   `${measures.utilization.toFixed(1)}%`,
        }}
        showToolbar={false}
      >
        <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <KpiCard label="Revenue"        value={ghs(measures.revenue)}     icon={Wallet}        delta={measures.momGrowth}/>
          <KpiCard label="Orders"         value={String(measures.orders)}    icon={ShoppingCart}  delta={pct(measures.orders, sales_prev_count(salesPrev))}/>
          <KpiCard label="Operating exp." value={ghs(measures.opex)}         icon={TrendingDown}/>
          <KpiCard label="Net margin"     value={`${measures.margin.toFixed(1)}%`} icon={TrendingUp}/>
          <KpiCard label="Avg order"      value={ghs(measures.aov)}          icon={ShoppingCart}  delta={pct(measures.aov, measures.aovPrev)}/>
          <KpiCard label="Open jobs"      value={String(measures.openJobs)}  icon={Wrench}/>
          <KpiCard label="Utilization"    value={`${measures.utilization.toFixed(1)}%`} icon={Wrench}/>
          <KpiCard label="Headcount"      value={String(measures.headcount)} icon={Users}/>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <ChartCard title="Sales by channel" hint="Click a bar to filter the rest of the page.">
            <BarChart
              rows={byChannel(sales)}
              format={ghs}
              onClick={(label) => setCategory(label.toLowerCase())}
            />
          </ChartCard>
          <ChartCard title="Daily revenue (this period)">
            <LineChart points={dailyRevenue(sales, range.from, range.to)} format={ghs}/>
          </ChartCard>
          <ChartCard title="Expense composition">
            <PieChart rows={byExpense(expenses)} format={ghs}/>
          </ChartCard>
          <ChartCard title="Margin vs growth (channels)">
            <ScatterChart rows={channelScatter(sales, expenses)} xLabel="Revenue" yLabel="Margin %"/>
          </ChartCard>
        </section>
      </PrintLayout>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────

function KpiCard({ label, value, icon: Icon, delta }: { label: string; value: string; icon: any; delta?: number }) {
  return (
    <article className="card-feature flex flex-col gap-1.5">
      <span className="text-[12.5px] font-bold tracking-[0.14em] text-neutral-500 inline-flex items-center gap-1.5">
        <Icon size={12}/> {label.toUpperCase()}
      </span>
      <div className="text-xl md:text-2xl font-extrabold tracking-tight text-ink-900 truncate" title={value}>{value}</div>
      {typeof delta === 'number' && Number.isFinite(delta) && (
        <span className={`text-xs ${delta >= 0 ? 'text-emerald-700' : 'text-brand-500'}`}>
          {delta >= 0 ? '↑' : '↓'} {Math.abs(delta).toFixed(1)}% vs prior
        </span>
      )}
    </article>
  );
}

function ChartCard({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <article className="bg-white rounded-2xl border border-line p-4">
      <header className="mb-2 flex items-end justify-between">
        <h3 className="font-semibold">{title}</h3>
        {hint && <span className="text-2xs text-neutral-500">{hint}</span>}
      </header>
      {children}
    </article>
  );
}

function BarChart({ rows, format, onClick }: { rows: { label: string; value: number }[]; format: (n: number) => string; onClick?: (label: string) => void }) {
  if (rows.length === 0) return <div className="text-center text-neutral-500 text-sm py-6">No data.</div>;
  const max = Math.max(1, ...rows.map(r => r.value));
  return (
    <div className="grid gap-1.5">
      {rows.map((r) => (
        <button key={r.label} type="button" onClick={() => onClick?.(r.label)} className="text-left">
          <div className="flex items-center justify-between text-xs mb-0.5">
            <span className="font-semibold">{r.label}</span>
            <span className="num text-neutral-600">{format(r.value)}</span>
          </div>
          <div className="w-full h-2.5 rounded-full bg-canvas overflow-hidden">
            <div className="h-full bg-brand-500 transition-all" style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }}/>
          </div>
        </button>
      ))}
    </div>
  );
}

function LineChart({ points, format }: { points: { x: string; y: number }[]; format: (n: number) => string }) {
  if (points.length === 0) return <div className="text-center text-neutral-500 text-sm py-6">No data.</div>;
  const max = Math.max(1, ...points.map(p => p.y));
  const W = 480, H = 140, P = 12;
  const dx = (W - P * 2) / Math.max(1, points.length - 1);
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${P + i * dx} ${H - P - (p.y / max) * (H - P * 2)}`).join(' ');
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none">
        <path d={d} fill="none" stroke="#DC2626" strokeWidth={2}/>
      </svg>
      <div className="flex items-center justify-between text-2xs text-neutral-500 mt-1">
        <span>{points[0]?.x}</span>
        <span className="num">max {format(max)}</span>
        <span>{points[points.length - 1]?.x}</span>
      </div>
    </div>
  );
}

function PieChart({ rows, format }: { rows: { label: string; value: number }[]; format: (n: number) => string }) {
  if (rows.length === 0) return <div className="text-center text-neutral-500 text-sm py-6">No data.</div>;
  const total = rows.reduce((s, r) => s + r.value, 0) || 1;
  const palette = ['#DC2626', '#1A1A1A', '#10B981', '#F59E0B', '#3B82F6', '#8B5CF6', '#EC4899'];
  let cum = 0;
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 100 100" className="w-32 h-32 shrink-0">
        {rows.map((r, i) => {
          const frac = r.value / total;
          const a0 = cum * 2 * Math.PI;
          const a1 = (cum + frac) * 2 * Math.PI;
          cum += frac;
          const x0 = 50 + 50 * Math.sin(a0), y0 = 50 - 50 * Math.cos(a0);
          const x1 = 50 + 50 * Math.sin(a1), y1 = 50 - 50 * Math.cos(a1);
          const large = frac > 0.5 ? 1 : 0;
          return <path key={r.label} d={`M50 50 L ${x0} ${y0} A 50 50 0 ${large} 1 ${x1} ${y1} Z`} fill={palette[i % palette.length]}/>;
        })}
      </svg>
      <ul className="flex-1 grid gap-1 text-xs">
        {rows.map((r, i) => (
          <li key={r.label} className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-2 min-w-0 truncate">
              <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: palette[i % palette.length] }}/>
              <span className="truncate">{r.label}</span>
            </span>
            <span className="num text-neutral-600">{format(r.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ScatterChart({ rows, xLabel, yLabel }: { rows: { x: number; y: number; label: string }[]; xLabel: string; yLabel: string }) {
  if (rows.length === 0) return <div className="text-center text-neutral-500 text-sm py-6">No data.</div>;
  const xs = rows.map(r => r.x); const ys = rows.map(r => r.y);
  const xMin = Math.min(...xs, 0), xMax = Math.max(...xs, 1);
  const yMin = Math.min(...ys, 0), yMax = Math.max(...ys, 1);
  const W = 480, H = 200, P = 24;
  const X = (v: number) => P + ((v - xMin) / Math.max(1, (xMax - xMin))) * (W - P * 2);
  const Y = (v: number) => H - P - ((v - yMin) / Math.max(1, (yMax - yMin))) * (H - P * 2);
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full">
        <line x1={P} y1={H - P} x2={W - P} y2={H - P} stroke="#E5E5E5"/>
        <line x1={P} y1={P}     x2={P}     y2={H - P} stroke="#E5E5E5"/>
        {rows.map((r) => (
          <g key={r.label}>
            <circle cx={X(r.x)} cy={Y(r.y)} r={5} fill="#DC2626"/>
            <text x={X(r.x) + 6} y={Y(r.y) - 6} fontSize={10} fill="#525252">{r.label}</text>
          </g>
        ))}
      </svg>
      <div className="flex items-center justify-between text-2xs text-neutral-500 mt-1">
        <span>{xLabel}</span><span>{yLabel}</span>
      </div>
    </div>
  );
}

// ─── Aggregation helpers ─────────────────────────────────────────────

function sales_prev_count(s: any[]) { return s.length; }
function pct(cur: number, prev: number) { return prev > 0 ? ((cur - prev) / prev) * 100 : 0; }

function byChannel(sales: any[]): { label: string; value: number }[] {
  const m = new Map<string, number>();
  for (const s of sales) {
    const k = s.channel ?? 'Unknown';
    m.set(k, (m.get(k) ?? 0) + Number(s.totalAmount ?? s.total_amount ?? 0));
  }
  return Array.from(m.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

function dailyRevenue(sales: any[], from: Date, to: Date): { x: string; y: number }[] {
  const days: { x: string; y: number }[] = [];
  const cur = new Date(from); cur.setHours(0, 0, 0, 0);
  const end = new Date(to);
  const map = new Map<string, number>();
  for (const s of sales) {
    const k = new Date(s.transaction_date ?? s.transactionDate ?? 0).toISOString().slice(0, 10);
    map.set(k, (map.get(k) ?? 0) + Number(s.totalAmount ?? s.total_amount ?? 0));
  }
  while (cur <= end) {
    const k = cur.toISOString().slice(0, 10);
    days.push({ x: k.slice(5), y: map.get(k) ?? 0 });
    cur.setDate(cur.getDate() + 1);
    if (days.length > 92) break;
  }
  return days;
}

function byExpense(expenses: any[]): { label: string; value: number }[] {
  const m = new Map<string, number>();
  for (const e of expenses) {
    const k = e.category ?? 'Uncategorised';
    m.set(k, (m.get(k) ?? 0) + Number(e.amount ?? 0));
  }
  return Array.from(m.entries()).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

function channelScatter(sales: any[], expenses: any[]): { x: number; y: number; label: string }[] {
  const m = new Map<string, { rev: number; cost: number }>();
  for (const s of sales) {
    const k = s.channel ?? 'Unknown';
    const cur = m.get(k) ?? { rev: 0, cost: 0 };
    cur.rev += Number(s.totalAmount ?? s.total_amount ?? 0);
    m.set(k, cur);
  }
  // Spread expense pro-rata to revenue share, then compute margin.
  const totalRev = Array.from(m.values()).reduce((s, v) => s + v.rev, 0);
  const totalExp = expenses.reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0);
  const out: { x: number; y: number; label: string }[] = [];
  m.forEach((v, k) => {
    const share = totalRev > 0 ? (v.rev / totalRev) : 0;
    const allocated = totalExp * share;
    const margin = v.rev > 0 ? ((v.rev - allocated) / v.rev) * 100 : 0;
    out.push({ x: v.rev, y: margin, label: k });
  });
  return out;
}
