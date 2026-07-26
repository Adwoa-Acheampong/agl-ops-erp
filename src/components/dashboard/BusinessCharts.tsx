import { useMemo } from 'react';
import { TrendingUp, BarChart3, PieChart, Package, Loader2 } from 'lucide-react';
import { trpc } from '../../lib/trpc';
import { ghs } from '../../lib/ghanaTax';

/**
 * Inline SVG charts (no chart library = no extra bundle weight).
 *
 *   1. Daily-revenue sparkline + 30-day total
 *   2. Sales-by-channel bar
 *   3. Top 10 items by revenue
 *   4. Expense breakdown by category
 *   5. Payment-method mix
 */

export function BusinessCharts() {
  const salesQ = trpc.sales.list.useQuery({} as any, { keepPreviousData: true });
  const expensesQ = trpc.expenses.list.useQuery({} as any, { keepPreviousData: true });

  const sales: any[] = Array.isArray(salesQ.data) ? salesQ.data : ((salesQ.data as any)?.transactions ?? []);
  const expenses: any[] = Array.isArray(expensesQ.data) ? expensesQ.data : ((expensesQ.data as any)?.expenses ?? []);

  const loading = salesQ.isLoading || expensesQ.isLoading;

  // ── 30-day daily revenue series ────────────────────────────────────
  const dailyRevenue = useMemo(() => {
    const days: { date: string; revenue: number; orders: number }[] = [];
    const now = new Date();
    const start = new Date(now); start.setDate(now.getDate() - 29);
    for (let d = new Date(start); d <= now; d.setDate(d.getDate() + 1)) {
      days.push({ date: d.toISOString().slice(0, 10), revenue: 0, orders: 0 });
    }
    const idx = new Map(days.map((d, i) => [d.date, i]));
    for (const s of sales) {
      const k = (s.transaction_date ?? s.transactionDate);
      const dateKey = k ? new Date(k).toISOString().slice(0, 10) : null;
      if (dateKey && idx.has(dateKey)) {
        const i = idx.get(dateKey)!;
        days[i].revenue += Number(s.total_amount ?? s.totalAmount ?? 0);
        days[i].orders += 1;
      }
    }
    return days;
  }, [sales]);

  const total30Day = dailyRevenue.reduce((s, d) => s + d.revenue, 0);
  const orders30Day = dailyRevenue.reduce((s, d) => s + d.orders, 0);

  // ── Sales by channel ───────────────────────────────────────────────
  const byChannel = useMemo(() => {
    const m = new Map<string, { count: number; revenue: number }>();
    for (const s of sales) {
      const c = s.channel ?? 'Other';
      const cur = m.get(c) ?? { count: 0, revenue: 0 };
      cur.count += 1;
      cur.revenue += Number(s.total_amount ?? s.totalAmount ?? 0);
      m.set(c, cur);
    }
    return Array.from(m.entries()).map(([channel, v]) => ({ channel, ...v }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [sales]);

  // ── Top 10 items by revenue ────────────────────────────────────────
  const topItems = useMemo(() => {
    const m = new Map<string, { revenue: number; qty: number; count: number }>();
    for (const s of sales) {
      const item = (s.part_service ?? s.partService ?? '').trim();
      if (!item) continue;
      // Normalise common variants (e.g. "Diagnoses" vs "Diagnostics")
      const k = item.toLowerCase().replace(/\s+/g, ' ');
      const cur = m.get(k) ?? { revenue: 0, qty: 0, count: 0 };
      cur.revenue += Number(s.total_amount ?? s.totalAmount ?? 0);
      cur.qty += Number(s.quantity ?? 1);
      cur.count += 1;
      m.set(k, cur);
    }
    return Array.from(m.entries()).map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }, [sales]);

  // ── Expense breakdown by category ──────────────────────────────────
  const byCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of expenses) {
      const c = e.category ?? 'Uncategorised';
      m.set(c, (m.get(c) ?? 0) + Number(e.amount ?? 0));
    }
    return Array.from(m.entries()).map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total).slice(0, 8);
  }, [expenses]);

  // ── Payment method mix ─────────────────────────────────────────────
  const byPayment = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of sales) {
      const p = s.payment_method ?? s.paymentMethod ?? 'Unknown';
      m.set(p, (m.get(p) ?? 0) + Number(s.total_amount ?? s.totalAmount ?? 0));
    }
    return Array.from(m.entries()).map(([method, total]) => ({ method, total }))
      .sort((a, b) => b.total - a.total);
  }, [sales]);

  if (loading && sales.length === 0) {
    return (
      <section className="bg-white border border-line rounded-2xl p-6 text-center text-neutral-500">
        <Loader2 size={16} className="animate-spin inline mr-1.5" /> Loading business charts…
      </section>
    );
  }

  return (
    <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* 1. Revenue trend */}
      <ChartCard
        title="Revenue — last 30 days"
        icon={TrendingUp}
        meta={`${ghs(total30Day)} · ${orders30Day} orders`}
      >
        <Sparkline data={dailyRevenue.map(d => d.revenue)} labels={dailyRevenue.map(d => d.date.slice(5))} />
      </ChartCard>

      {/* 2. Sales by channel */}
      <ChartCard title="Sales by channel" icon={BarChart3} meta={`${byChannel.length} channels`}>
        <BarList rows={byChannel.map(c => ({ label: c.channel, value: c.revenue, sub: `${c.count} orders` }))} />
      </ChartCard>

      {/* 3. Top items by revenue */}
      <ChartCard title="Top 10 items by revenue" icon={Package} meta={`${topItems.length} unique items`}>
        <BarList rows={topItems.map(t => ({ label: t.name, value: t.revenue, sub: `${t.qty} units · ${t.count} sales` }))} />
      </ChartCard>

      {/* 4. Expense breakdown */}
      <ChartCard title="Expense breakdown" icon={PieChart} meta={`${byCategory.length} categories`}>
        <BarList rows={byCategory.map(c => ({ label: c.category, value: c.total }))} tone="brand" />
      </ChartCard>

      {/* 5. Payment method mix — full width below */}
      <ChartCard title="Payment method mix" icon={PieChart} meta={`Revenue by tender`} fullWidth>
        <StackedBar segments={byPayment.map(p => ({ label: p.method, value: p.total }))} />
      </ChartCard>
    </section>
  );
}

// ── primitives ───────────────────────────────────────────────────────────

function ChartCard({ title, icon: Icon, meta, fullWidth, children }: { title: string; icon: any; meta?: string; fullWidth?: boolean; children: any }) {
  return (
    <article className={`card-feature !p-4 ${fullWidth ? 'lg:col-span-2' : ''} min-w-0`}>
      <header className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-bold flex items-center gap-1.5"><Icon size={14} /> {title}</h3>
        {meta && <span className="text-[11.5px] text-neutral-500 truncate">{meta}</span>}
      </header>
      {children}
    </article>
  );
}

function Sparkline({ data, labels }: { data: number[]; labels: string[] }) {
  const max = Math.max(1, ...data);
  const w = 100; const h = 32;
  const step = data.length > 1 ? w / (data.length - 1) : 0;
  const pts = data.map((v, i) => `${(i * step).toFixed(2)},${(h - (v / max) * h).toFixed(2)}`).join(' ');
  const lastVal = data[data.length - 1] ?? 0;

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="w-full h-20">
        <defs>
          <linearGradient id="sparkfill" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#CC0E1A" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#CC0E1A" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={`0,${h} ${pts} ${w},${h}`} fill="url(#sparkfill)" />
        <polyline points={pts} fill="none" stroke="#CC0E1A" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="flex items-center justify-between text-[11.5px] text-neutral-500 mt-1">
        <span>{labels[0] ?? ''}</span>
        <span className="font-semibold text-black">Today: {ghs(lastVal)}</span>
        <span>{labels[labels.length - 1] ?? ''}</span>
      </div>
    </div>
  );
}

function BarList({ rows, tone }: { rows: { label: string; value: number; sub?: string }[]; tone?: 'brand' | 'ink' }) {
  const max = Math.max(1, ...rows.map(r => r.value));
  const colour = tone === 'brand' ? '#CC0E1A' : '#111';
  if (rows.length === 0) return <div className="text-xs text-neutral-500 text-center py-4">No data yet.</div>;
  return (
    <div className="space-y-1.5">
      {rows.map((r, i) => (
        <div key={i} className="min-w-0">
          <div className="flex items-center justify-between text-[12.5px] mb-0.5 gap-2">
            <span className="font-semibold truncate" title={r.label}>{r.label}</span>
            <span className="num-tabular text-neutral-600 shrink-0">{ghs(r.value)}{r.sub ? ` · ${r.sub}` : ''}</span>
          </div>
          <div className="w-full h-2 rounded-full bg-canvas overflow-hidden">
            <div className="h-full transition-all" style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, background: colour }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function StackedBar({ segments }: { segments: { label: string; value: number }[] }) {
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (total === 0) return <div className="text-xs text-neutral-500 text-center py-4">No data yet.</div>;
  const palette = ['#CC0E1A', '#1A1A1A', '#10B981', '#F59E0B', '#3B82F6', '#8B5CF6'];
  return (
    <div>
      <div className="flex w-full h-7 rounded-lg overflow-hidden border border-line">
        {segments.map((s, i) => (
          <div key={s.label} style={{ width: `${(s.value / total) * 100}%`, background: palette[i % palette.length] }} title={`${s.label}: ${ghs(s.value)}`} />
        ))}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5 mt-2 text-[12.5px]">
        {segments.map((s, i) => (
          <div key={s.label} className="flex items-center gap-1.5 min-w-0">
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ background: palette[i % palette.length] }} />
            <span className="truncate">{s.label}</span>
            <span className="num-tabular text-neutral-600 ml-auto">{((s.value / total) * 100).toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
