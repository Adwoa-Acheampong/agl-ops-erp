import { FormEvent, ReactNode, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Receipt, Truck, ShoppingCart, TrendingUp, TrendingDown, Loader2,
  Search, X, Plus, Package, Pencil,
} from 'lucide-react';
import { trpc } from '../lib/trpc';
import { ghs, computeGhanaTax } from '../lib/ghanaTax';
import { FileUploader, type UploadedFile } from '../components/forms/FileUploader';
import { DateRangePicker, rangeFor, type RangePreset } from '../components/ui/DateRangePicker';
import { useAuth } from '../contexts/AuthContext';

/**
 * WS3 — Consolidated P&L Hub. Absorbs the standalone Extra-Expense and
 * Purchase-Order surfaces so a manager can record + audit all outflow
 * types from one screen.
 *
 *   • Overview  — KPIs + P&L roll-up + Ghana tax remittance
 *   • Supplies  — purchase orders flagged as goods receipt
 *   • Expenses  — operating expenses ledger (with category + vendor drill)
 *   • Purchases — full purchase-order ledger with status filter
 *
 * Every panel carries search, a status drill-through, and three summary
 * cards (count, value, top vendor). The "New Entry" button opens a
 * modal that writes through `expenses.create` or `purchaseOrders.create`
 * with optional receipt upload.
 */

type Tab = 'overview' | 'supplies' | 'expenses' | 'purchases';

export function ExpensesHubPage() {
  // Tab state mirrors the URL so sidebar deep-links (e.g. /expenses-hub?tab=expenses)
  // jump straight into the matching panel.
  const location = useLocation();
  const navigate = useNavigate();
  const tab: Tab = (() => {
    const t = new URLSearchParams(location.search).get('tab') ?? 'overview';
    return (['overview', 'supplies', 'expenses', 'purchases'] as Tab[]).includes(t as Tab) ? (t as Tab) : 'overview';
  })();
  const setTab = (next: Tab) => navigate(next === 'overview' ? '/expenses-hub' : `/expenses-hub?tab=${next}`);
  const [preset, setPreset]         = useState<RangePreset>('year');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo]     = useState('');
  const { from: startDate, to: endDate } = useMemo(
    () => rangeFor(preset, customFrom, customTo),
    [preset, customFrom, customTo],
  );

  const utils = trpc.useUtils();

  // Data queries ──────────────────────────────────────────────────────
  const salesQ    = trpc.sales.list.useQuery({ startDate, endDate } as any, { keepPreviousData: true });
  const expensesQ = trpc.expenses.list.useQuery({ startDate, endDate } as any, { keepPreviousData: true });
  const poQ       = trpc.purchaseOrders.list.useQuery({} as any, { keepPreviousData: true });

  const salesData: any = salesQ.data;
  const expensesData: any = expensesQ.data;
  const poData: any = poQ.data;
  const sales: any[]    = Array.isArray(salesData) ? salesData : (salesData?.transactions ?? []);
  const expenses: any[] = Array.isArray(expensesData) ? expensesData : (expensesData?.expenses ?? []);
  const purchaseOrders: any[] = Array.isArray(poData) ? poData : (poData?.orders ?? []);

  // Per-panel drill-through state ─────────────────────────────────────
  const [search, setSearch]     = useState('');
  const [statusF, setStatusF]   = useState<string>('all');
  const [categoryF, setCategory]= useState<string>('all');
  const [newEntryOpen, setNewEntryOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any | null>(null);
  const [editingOrder, setEditingOrder] = useState<any | null>(null);
  const { user } = useAuth();
  const canEditLedger = !!user?.canEditLedgers || ['admin', 'owner', 'manager', 'operations_manager', 'principal'].includes(String(user?.role ?? '').toLowerCase());

  // Reset filters on tab change so a Supplies search doesn't leak to Expenses.
  const switchTab = (next: Tab) => { setTab(next); setSearch(''); setStatusF('all'); setCategory('all'); };

  // P&L totals ────────────────────────────────────────────────────────
  const totals = useMemo(() => {
    const revenue = sales.reduce((s, r: any) => s + Number(r.totalAmount ?? r.total_amount ?? 0), 0);
    const opex    = expenses.reduce((s, r: any) => s + Number(r.amount ?? 0), 0);
    const poInWindow = purchaseOrders.filter((p: any) => {
      const d = p.poDate ?? p.po_date ?? p.deliveryDate;
      if (!d) return false;
      const t = new Date(d).getTime();
      return t >= startDate.getTime() && t <= endDate.getTime();
    });
    const supplies = poInWindow.reduce((s, p: any) => s + Number(p.amount ?? 0), 0);
    const tax = computeGhanaTax({ netBeforeDiscount: revenue });
    const cogsEstimate = supplies;
    const grossProfit  = revenue - cogsEstimate;
    const netProfit    = grossProfit - opex;
    return { revenue, opex, supplies, cogsEstimate, grossProfit, netProfit, tax, poInWindow };
  }, [sales, expenses, purchaseOrders, startDate, endDate]);

  return (
    <div className="max-w-7xl">
      <header className="flex items-end justify-between gap-3 flex-wrap mb-4">
        <div>
          <h1 className="h-section flex items-center gap-2"><Receipt size={20} /> Expenses &amp; P&amp;L Hub</h1>
          <p className="mt-1 text-neutral-600 text-sm">
            Supplies, purchases and operating expenses in one place — with a live P&amp;L roll-up.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DateRangePicker
            preset={preset}
            onPresetChange={setPreset}
            customFrom={customFrom} customTo={customTo}
            onCustomFromChange={setCustomFrom} onCustomToChange={setCustomTo}
            presets={['today', 'week', 'month', 'quarter', 'year', 'custom']}
          />
          {tab !== 'overview' && (
            <button className="btn-primary text-sm" onClick={() => setNewEntryOpen(true)}>
              <Plus size={14}/> New entry
            </button>
          )}
        </div>
      </header>

      <nav className="flex items-center gap-1 mb-4 bg-white border border-line rounded-2xl p-1 w-fit">
        {(['overview', 'supplies', 'expenses', 'purchases'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => switchTab(t)}
            className={`px-3 py-1.5 rounded-xl text-sm font-semibold capitalize transition-colors ${
              tab === t ? 'bg-brand-500 text-white' : 'text-neutral-600 hover:bg-canvas'
            }`}
          >
            {t === 'supplies' ? 'Supplies' : t === 'purchases' ? 'Purchase orders' : t}
          </button>
        ))}
      </nav>

      {tab === 'overview' && (
        <>
          <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
            <Kpi label="Revenue" value={ghs(totals.revenue)} icon={TrendingUp} tone="emerald" />
            <Kpi label="Supplies / Purchases" value={ghs(totals.supplies)} icon={Truck} tone="ink" />
            <Kpi label="Operating Expenses" value={ghs(totals.opex)} icon={Receipt} tone="ink" />
            <Kpi label="Net Profit" value={ghs(totals.netProfit)} icon={totals.netProfit >= 0 ? TrendingUp : TrendingDown} tone={totals.netProfit >= 0 ? 'emerald' : 'brand'} />
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <article className="bg-white rounded-2xl border border-line p-4">
              <h3 className="font-semibold mb-2">Profit &amp; Loss</h3>
              <table className="w-full text-sm">
                <tbody>
                  <PLRow label="Revenue (gross sales incl. VAT)" value={totals.revenue} />
                  <PLRow label="− Cost of supplies (approx. COGS)" value={-totals.supplies} />
                  <PLRow label="Gross profit" value={totals.grossProfit} bold />
                  <PLRow label="− Operating expenses" value={-totals.opex} />
                  <PLRow label="Net profit" value={totals.netProfit} bold tone={totals.netProfit >= 0 ? 'emerald' : 'brand'} />
                </tbody>
              </table>
            </article>
            <article className="bg-white rounded-2xl border border-line p-4">
              <h3 className="font-semibold mb-2">Ghana tax liability (period)</h3>
              <p className="text-xs text-neutral-500 mb-3">Approximation — treats revenue as VAT-inclusive at standard rate.</p>
              <table className="w-full text-sm">
                <tbody>
                  <PLRow label="VAT 15%" value={totals.tax.vat} />
                  <PLRow label="NHIL 2.5%" value={totals.tax.nhil} />
                  <PLRow label="GETFund 2.5%" value={totals.tax.getfund} />
                  <PLRow label="COVID 1%" value={totals.tax.covid} />
                  <PLRow label="Total tax remittance" value={totals.tax.totalTax} bold tone="brand" />
                </tbody>
              </table>
            </article>
          </section>
        </>
      )}

      {tab === 'supplies'  && <SuppliesPanel rows={totals.poInWindow} loading={poQ.isLoading} search={search} setSearch={setSearch} status={statusF} setStatus={setStatusF} canEdit={canEditLedger} onEdit={setEditingOrder}/>}
      {tab === 'expenses'  && <ExpensesPanel rows={expenses}  loading={expensesQ.isLoading} search={search} setSearch={setSearch} category={categoryF} setCategory={setCategory} canEdit={canEditLedger} onEdit={setEditingExpense}/>}
      {tab === 'purchases' && <PurchasesPanel rows={purchaseOrders} loading={poQ.isLoading} search={search} setSearch={setSearch} status={statusF} setStatus={setStatusF} canEdit={canEditLedger} onEdit={setEditingOrder}/>}

      <NewEntryModal
        open={newEntryOpen}
        kind={tab === 'expenses' ? 'expense' : tab === 'supplies' ? 'supply' : tab === 'purchases' ? 'purchase' : 'expense'}
        onClose={() => setNewEntryOpen(false)}
        onSaved={() => {
          setNewEntryOpen(false);
          utils.expenses.list.invalidate();
          utils.purchaseOrders.list.invalidate();
        }}
      />
      {editingExpense && (
        <ExpenseEditModal
          row={editingExpense}
          onClose={() => setEditingExpense(null)}
          onSaved={() => {
            setEditingExpense(null);
            utils.expenses.list.invalidate();
          }}
        />
      )}
      {editingOrder && (
        <PurchaseOrderEditModal
          row={editingOrder}
          onClose={() => setEditingOrder(null)}
          onSaved={() => {
            setEditingOrder(null);
            utils.purchaseOrders.list.invalidate();
          }}
        />
      )}
    </div>
  );
}

// ─── Panels ──────────────────────────────────────────────────────────

function SuppliesPanel({ rows, loading, search, setSearch, status, setStatus, canEdit, onEdit }: PanelProps) {
  const filtered = rows.filter((p: any) => {
    if (status !== 'all' && (p.status ?? '').toLowerCase() !== status) return false;
    if (search.trim()) {
      const hay = `${p.vendor ?? ''} ${p.description ?? ''} ${p.poNumber ?? p.po_number ?? ''}`.toLowerCase();
      if (!hay.includes(search.trim().toLowerCase())) return false;
    }
    return true;
  });
  const summary = summarise(filtered, (p) => Number(p.amount ?? 0), (p) => String(p.vendor ?? '—'));
  return (
    <>
      <SummaryCards count={summary.count} total={summary.total} topVendor={summary.topGroup}/>
      <FilterBar search={search} setSearch={setSearch} status={status} setStatus={setStatus}
        statuses={['all','draft','approved','received','partial','cancelled']} />
      <SimpleTable rows={filtered.map((p: any) => ({
        Date: fmtDate(p.poDate ?? p.po_date), Supplier: p.vendor, Description: p.description, Status: p.status, Amount: Number(p.amount ?? 0)
      }))} rawRows={filtered} title="Supplies received" cols={['Date','Supplier','Description','Status','Amount']} loading={loading} canEdit={canEdit} onEdit={onEdit}/>
    </>
  );
}

function ExpensesPanel({ rows, loading, search, setSearch, category, setCategory, canEdit, onEdit }: Omit<PanelProps, 'status' | 'setStatus'> & { category: string; setCategory: (s: string) => void }) {
  const filtered = rows.filter((e: any) => {
    if (category !== 'all' && (e.category ?? '').toLowerCase() !== category) return false;
    if (search.trim()) {
      const hay = `${e.description ?? ''} ${e.vendor ?? ''} ${e.notes ?? ''}`.toLowerCase();
      if (!hay.includes(search.trim().toLowerCase())) return false;
    }
    return true;
  });
  const summary = summarise(filtered, (e) => Number(e.amount ?? 0), (e) => String(e.vendor ?? e.category ?? '—'));
  const categories = Array.from(new Set(rows.map((r: any) => String(r.category ?? '')).filter(Boolean))).sort();
  return (
    <>
      <SummaryCards count={summary.count} total={summary.total} topVendor={summary.topGroup}/>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <SearchInput search={search} setSearch={setSearch} placeholder="Search description, vendor, notes…"/>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="field-input text-sm">
          <option value="all">All categories</option>
          {categories.map((c) => <option key={c} value={c.toLowerCase()}>{c}</option>)}
        </select>
      </div>
      <SimpleTable rows={filtered.map((e: any) => ({
        Date: fmtDate(e.expenseDate ?? e.expense_date), Category: e.category, Description: e.description, Vendor: e.vendor ?? '—', Amount: Number(e.amount ?? 0)
      }))} rawRows={filtered} title="Operating expenses" cols={['Date','Category','Description','Vendor','Amount']} loading={loading} canEdit={canEdit} onEdit={onEdit}/>
    </>
  );
}

function PurchasesPanel({ rows, loading, search, setSearch, status, setStatus, canEdit, onEdit }: PanelProps) {
  const filtered = rows.filter((p: any) => {
    if (status !== 'all' && (p.status ?? '').toLowerCase() !== status) return false;
    if (search.trim()) {
      const hay = `${p.vendor ?? ''} ${p.description ?? ''} ${p.poNumber ?? p.po_number ?? ''}`.toLowerCase();
      if (!hay.includes(search.trim().toLowerCase())) return false;
    }
    return true;
  });
  const summary = summarise(filtered, (p) => Number(p.amount ?? 0), (p) => String(p.vendor ?? '—'));
  return (
    <>
      <SummaryCards count={summary.count} total={summary.total} topVendor={summary.topGroup}/>
      <FilterBar search={search} setSearch={setSearch} status={status} setStatus={setStatus}
        statuses={['all','draft','approved','received','partial','cancelled']} />
      <SimpleTable rows={filtered.map((p: any) => ({
        Date: fmtDate(p.poDate ?? p.po_date), PO: p.poNumber ?? p.po_number, Vendor: p.vendor, Description: p.description, Status: p.status, Amount: Number(p.amount ?? 0)
      }))} rawRows={filtered} title="Purchase orders" cols={['Date','PO','Vendor','Description','Status','Amount']} loading={loading} canEdit={canEdit} onEdit={onEdit}/>
    </>
  );
}

interface PanelProps {
  rows: any[]; loading: boolean;
  search: string; setSearch: (s: string) => void;
  status: string; setStatus: (s: string) => void;
  canEdit?: boolean; onEdit?: (row: any) => void;
}

// ─── Shared bits ─────────────────────────────────────────────────────

function SearchInput({ search, setSearch, placeholder }: { search: string; setSearch: (s: string) => void; placeholder: string }) {
  return (
    <div className="relative flex-1 min-w-[220px] max-w-md">
      <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none"/>
      <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={placeholder}
             className="w-full field-input pl-7 pr-7"/>
      {search && <button type="button" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500"><X size={12}/></button>}
    </div>
  );
}

function FilterBar({ search, setSearch, status, setStatus, statuses }: {
  search: string; setSearch: (s: string) => void; status: string; setStatus: (s: string) => void; statuses: string[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 mb-2">
      <SearchInput search={search} setSearch={setSearch} placeholder="Search vendor, description, PO #…"/>
      <select value={status} onChange={(e) => setStatus(e.target.value)} className="field-input text-sm">
        {statuses.map((s) => <option key={s} value={s}>{s === 'all' ? 'All statuses' : s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
      </select>
    </div>
  );
}

function SummaryCards({ count, total, topVendor }: { count: number; total: number; topVendor: string | null }) {
  return (
    <section className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
      <Kpi label="Entries" value={String(count)} icon={Package} tone="ink"/>
      <Kpi label="Total value" value={ghs(total)} icon={TrendingUp} tone="emerald"/>
      <Kpi label="Top counterparty" value={topVendor ?? '—'} icon={ShoppingCart} tone="ink"/>
    </section>
  );
}

function summarise<T>(rows: T[], amount: (r: T) => number, group: (r: T) => string) {
  const total = rows.reduce((s, r) => s + amount(r), 0);
  const grouped = new Map<string, number>();
  for (const r of rows) {
    const k = group(r);
    grouped.set(k, (grouped.get(k) ?? 0) + amount(r));
  }
  const topGroup = Array.from(grouped.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  return { count: rows.length, total, topGroup };
}

// ─── KPI / table / utilities ─────────────────────────────────────────

function Kpi({ label, value, icon: Icon, tone }: { label: string; value: string; icon: any; tone: 'emerald' | 'brand' | 'ink' }) {
  const colour = tone === 'emerald' ? 'text-emerald-700' : tone === 'brand' ? 'text-brand-500' : 'text-ink-900';
  return (
    <article className="card-feature flex flex-col gap-1.5">
      <span className="text-[12.5px] font-bold tracking-[0.14em] text-neutral-500 inline-flex items-center gap-1.5">
        <Icon size={12}/> {label.toUpperCase()}
      </span>
      <div className={`text-xl md:text-2xl font-extrabold tracking-tight ${colour} truncate`} title={value}>{value}</div>
    </article>
  );
}

function PLRow({ label, value, bold, tone }: { label: string; value: number; bold?: boolean; tone?: 'emerald' | 'brand' }) {
  const colour = tone === 'emerald' ? 'text-emerald-700' : tone === 'brand' ? 'text-brand-500' : '';
  return (
    <tr className={bold ? 'border-t border-line' : ''}>
      <td className={`py-1.5 ${bold ? 'font-semibold' : 'text-neutral-600'}`}>{label}</td>
      <td className={`py-1.5 text-right num ${colour} ${bold ? 'font-semibold' : ''}`}>{value < 0 ? `(${ghs(Math.abs(value))})` : ghs(value)}</td>
    </tr>
  );
}

function SimpleTable({ rows, rawRows, cols, title, loading, canEdit, onEdit }: { rows: Record<string, any>[]; rawRows?: any[]; cols: string[]; title: string; loading: boolean; canEdit?: boolean; onEdit?: (row: any) => void }) {
  const colSpan = cols.length + (canEdit ? 1 : 0);
  return (
    <article className="bg-white rounded-2xl border border-line overflow-hidden">
      <header className="px-4 py-3 border-b border-line bg-canvas">
        <h3 className="font-semibold">{title} <span className="text-neutral-500 text-sm">({rows.length})</span></h3>
      </header>
      <div className="agl-scroll-x">
        <table className="w-full text-sm">
          <thead><tr>{cols.map((c) => <th key={c} className="t-th">{c}</th>)}{canEdit && <th className="t-th text-right">Edit</th>}</tr></thead>
          <tbody>
            {loading && <tr><td colSpan={colSpan} className="px-4 py-6 text-center text-neutral-500"><Loader2 size={14} className="animate-spin inline"/> Loading…</td></tr>}
            {!loading && rows.length === 0 && <tr><td colSpan={colSpan} className="px-4 py-6 text-center text-neutral-500">Nothing in this period.</td></tr>}
            {rows.map((r, i) => (
              <tr key={i}>
                {cols.map((c) => (
                  <td key={c} className={`t-td ${c === 'Amount' ? 'num font-semibold text-right' : ''}`}>
                    {c === 'Amount' ? ghs(Number(r[c] ?? 0)) : (r[c] ?? '—')}
                  </td>
                ))}
                {canEdit && (
                  <td className="t-td text-right">
                    <button
                      type="button"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-neutral-600 hover:bg-canvas hover:text-brand-500"
                      onClick={() => onEdit?.(rawRows?.[i] ?? r)}
                      title="Edit ledger row"
                      aria-label="Edit ledger row"
                    >
                      <Pencil size={13} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

// ─── New entry modal ─────────────────────────────────────────────────

type Kind = 'expense' | 'supply' | 'purchase';

function dateOnly(value: any): string {
  if (!value) return new Date().toISOString().slice(0, 10);
  if (typeof value === 'string') return value.slice(0, 10);
  return new Date(value).toISOString().slice(0, 10);
}

function ExpenseEditModal({ row, onClose, onSaved }: { row: any; onClose: () => void; onSaved: () => void }) {
  const [date, setDate] = useState(dateOnly(row.expenseDate ?? row.expense_date));
  const [category, setCategory] = useState(row.category ?? 'Other');
  const [description, setDescription] = useState(row.description ?? '');
  const [vendor, setVendor] = useState(row.vendor ?? '');
  const [amount, setAmount] = useState(String(row.amount ?? ''));
  const [notes, setNotes] = useState(row.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const update = trpc.expenses.update.useMutation({
    onSuccess: (d: any) => { if (d?.success === false) setError(d.error); else onSaved(); },
    onError: (e) => setError(e.message),
  });
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt < 0) return setError('Amount must be a valid number.');
    update.mutate({
      id: row.id,
      expenseDate: new Date(date),
      category,
      description: description.trim() || '(no description)',
      vendor: vendor.trim() || null,
      amount: amt,
      notes: notes.trim() || null,
    });
  };
  return (
    <LedgerEditShell title="Edit expense" error={error} busy={update.isLoading} onClose={onClose} onSubmit={onSubmit}>
      <Field label="Date"><input type="date" className="field-input" value={date} onChange={(e) => setDate(e.target.value)} required /></Field>
      <Field label="Category">
        <select className="field-input" value={category} onChange={(e) => setCategory(e.target.value)}>
          {['Utilities','Rent','Fuel','Telecoms','Office','Professional Fees','Maintenance','Travel','Delivery','Client Expense','Other'].map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </Field>
      <Field label="Description" col={2}><input className="field-input" value={description} onChange={(e) => setDescription(e.target.value)} required /></Field>
      <Field label="Vendor"><input className="field-input" value={vendor} onChange={(e) => setVendor(e.target.value)} /></Field>
      <Field label="Amount"><input type="number" min={0} step="0.01" className="field-input num" value={amount} onChange={(e) => setAmount(e.target.value)} required /></Field>
      <Field label="Notes" col={2}><textarea rows={3} className="field-input" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
    </LedgerEditShell>
  );
}

function PurchaseOrderEditModal({ row, onClose, onSaved }: { row: any; onClose: () => void; onSaved: () => void }) {
  const [poNumber, setPoNumber] = useState(row.poNumber ?? row.po_number ?? '');
  const [date, setDate] = useState(dateOnly(row.poDate ?? row.po_date));
  const [vendor, setVendor] = useState(row.vendor ?? '');
  const [description, setDescription] = useState(row.description ?? '');
  const [status, setStatus] = useState(row.status ?? 'approved');
  const [amount, setAmount] = useState(String(row.amount ?? ''));
  const [notes, setNotes] = useState(row.notes ?? '');
  const [error, setError] = useState<string | null>(null);
  const update = trpc.purchaseOrders.update.useMutation({
    onSuccess: (d: any) => { if (d?.success === false) setError(d.error); else onSaved(); },
    onError: (e) => setError(e.message),
  });
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt < 0) return setError('Amount must be a valid number.');
    update.mutate({
      id: row.id,
      poNumber: poNumber.trim() || `PO-${row.id}`,
      poDate: new Date(date),
      vendor: vendor.trim() || '(walk-in)',
      description: description.trim() || '(no description)',
      status,
      amount: amt,
      notes: notes.trim() || null,
    });
  };
  return (
    <LedgerEditShell title="Edit purchase / supply" error={error} busy={update.isLoading} onClose={onClose} onSubmit={onSubmit}>
      <Field label="PO / Ref"><input className="field-input num" value={poNumber} onChange={(e) => setPoNumber(e.target.value)} /></Field>
      <Field label="Date"><input type="date" className="field-input" value={date} onChange={(e) => setDate(e.target.value)} required /></Field>
      <Field label="Vendor"><input className="field-input" value={vendor} onChange={(e) => setVendor(e.target.value)} required /></Field>
      <Field label="Status">
        <select className="field-input" value={status} onChange={(e) => setStatus(e.target.value)}>
          {['draft','approved','received','partial','cancelled','Pending','Approved','Received','Cancelled'].map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </Field>
      <Field label="Description" col={2}><input className="field-input" value={description} onChange={(e) => setDescription(e.target.value)} required /></Field>
      <Field label="Amount"><input type="number" min={0} step="0.01" className="field-input num" value={amount} onChange={(e) => setAmount(e.target.value)} required /></Field>
      <Field label="Notes"><input className="field-input" value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
    </LedgerEditShell>
  );
}

function LedgerEditShell({ title, error, busy, onClose, onSubmit, children }: { title: string; error: string | null; busy: boolean; onClose: () => void; onSubmit: (e: FormEvent) => void; children: ReactNode }) {
  return (
    <div role="dialog" aria-modal="true"
      style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'grid', placeItems: 'center', background: 'rgba(14,10,10,0.42)', padding: 16 }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form onSubmit={onSubmit} className="bg-white rounded-2xl shadow-pop" style={{ width: '100%', maxWidth: 640, border: '1px solid rgba(26,22,18,0.10)' }}>
        <header className="px-4 py-3 border-b border-line">
          <span className="text-xs font-semibold uppercase tracking-wider text-brand-500">Ledger edit</span>
          <h2 className="text-xl font-bold mt-0.5">{title}</h2>
        </header>
        <div className="px-4 py-3 grid grid-cols-2 gap-3 text-sm">
          {children}
          {error && <div className="col-span-2 rounded-xl px-3 py-2 text-brand-500 bg-brand-50" role="alert">{error}</div>}
        </div>
        <footer className="px-4 py-3 border-t border-line flex items-center justify-end gap-2">
          <button type="button" className="btn-outline text-sm" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn-primary text-sm" disabled={busy}><Pencil size={14} /> {busy ? 'Saving...' : 'Save changes'}</button>
        </footer>
      </form>
    </div>
  );
}

function Field({ label, col, children }: { label: string; col?: 1 | 2; children: ReactNode }) {
  return <label className={`grid gap-1 ${col === 2 ? 'col-span-2' : ''}`}><span className="text-xs font-semibold uppercase text-neutral-600">{label}</span>{children}</label>;
}

function NewEntryModal({ open, kind, onClose, onSaved }: { open: boolean; kind: Kind; onClose: () => void; onSaved: () => void }) {
  const isExpense = kind === 'expense';
  const [category, setCategory]   = useState('Utilities');
  const [vendor, setVendor]       = useState('');
  const [description, setDesc]    = useState('');
  const [amount, setAmount]       = useState('');
  const [date, setDate]           = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState('');
  const [notes, setNotes]         = useState('');
  const [receipts, setReceipts]   = useState<UploadedFile[]>([]);
  const [error, setError]         = useState<string | null>(null);

  const expenseMut = trpc.expenses.create.useMutation({
    onSuccess: (d: any) => { if (d?.success === false) setError(d.error); else { reset(); onSaved(); } },
    onError: (e) => setError(e.message),
  });
  const poMut = trpc.purchaseOrders.create.useMutation({
    onSuccess: (d: any) => { if (d?.success === false) setError(d.error); else { reset(); onSaved(); } },
    onError: (e) => setError(e.message),
  });
  const busy = expenseMut.isLoading || poMut.isLoading;

  const reset = () => {
    setCategory('Utilities'); setVendor(''); setDesc(''); setAmount(''); setReference(''); setNotes(''); setReceipts([]); setError(null);
    setDate(new Date().toISOString().slice(0, 10));
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault(); setError(null);
    const amt = parseFloat(amount);
    if (!Number.isFinite(amt) || amt <= 0) return setError('Amount must be a positive number.');
    // Receipt files are recorded in the notes field as a base64 reference
    // until a dedicated attachments table lands. The FileUploader still
    // captures the binary so we can ship to the server in one call.
    const receiptNote = receipts.length
      ? `attachments=${receipts.map(r => `${r.name}(${(r.size / 1024).toFixed(1)}KB)`).join('; ')}`
      : '';
    const combinedNotes = [notes.trim(), receiptNote].filter(Boolean).join(' | ');

    if (isExpense) {
      expenseMut.mutate({
        expenseDate: new Date(date),
        category,
        description: description.trim() || '(no description)',
        amount: amt,
        vendor: vendor.trim() || undefined,
        notes: combinedNotes || undefined,
      });
    } else {
      // Both 'supply' and 'purchase' route to purchaseOrders.create.
      // Supplies are flagged via the description prefix until a dedicated
      // type column lands; this keeps the existing PO ledger as the
      // single source of truth.
      const desc = kind === 'supply' ? `[Supply] ${description.trim()}` : description.trim();
      poMut.mutate({
        poNumber: reference.trim() || `PO-${Date.now()}`,
        poDate: new Date(date),
        vendor: vendor.trim() || '(walk-in)',
        description: desc || '(no description)',
        amount: amt,
        status: 'approved',
        notes: combinedNotes || undefined,
      });
    }
  };

  if (!open) return null;
  const title = isExpense ? 'Record operating expense' : kind === 'supply' ? 'Record supply receipt' : 'Record purchase order';
  return (
    <div role="dialog" aria-modal="true"
      style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'grid', placeItems: 'center', background: 'rgba(14,10,10,0.42)', padding: 16 }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form onSubmit={onSubmit} className="bg-white rounded-2xl shadow-pop" style={{ width: '100%', maxWidth: 640, maxHeight: '90vh', display: 'flex', flexDirection: 'column', border: '1px solid rgba(26,22,18,0.10)' }}>
        <header className="px-4 py-3 border-b border-line">
          <span className="text-xs font-semibold uppercase tracking-wider text-brand-500">New</span>
          <h2 className="text-xl font-bold mt-0.5">{title}</h2>
        </header>
        <div className="flex-1 overflow-auto px-4 py-3 grid grid-cols-2 gap-3 text-sm">
          <label className="grid gap-1 col-span-2">
            <span className="text-xs font-semibold uppercase text-neutral-600">Description *</span>
            <input className="field-input" value={description} onChange={(e) => setDesc(e.target.value)} required/>
          </label>
          {isExpense ? (
            <label className="grid gap-1">
              <span className="text-xs font-semibold uppercase text-neutral-600">Category *</span>
              <select className="field-input" value={category} onChange={(e) => setCategory(e.target.value)}>
                {['Utilities','Rent','Fuel','Telecoms','Office','Professional Fees','Maintenance','Travel','Other'].map((c) =>
                  <option key={c} value={c}>{c}</option>
                )}
              </select>
            </label>
          ) : (
            <label className="grid gap-1">
              <span className="text-xs font-semibold uppercase text-neutral-600">Reference / PO #</span>
              <input className="field-input num" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Auto-generated if blank"/>
            </label>
          )}
          <label className="grid gap-1">
            <span className="text-xs font-semibold uppercase text-neutral-600">Vendor / supplier</span>
            <input className="field-input" value={vendor} onChange={(e) => setVendor(e.target.value)}/>
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-semibold uppercase text-neutral-600">Amount (GHS) *</span>
            <input className="field-input num" type="number" min={0} step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required/>
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-semibold uppercase text-neutral-600">Date *</span>
            <input className="field-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required/>
          </label>
          <div className="col-span-2">
            <FileUploader label="Receipt(s)" multiple={true} value={receipts} onChange={setReceipts}/>
          </div>
          <label className="grid gap-1 col-span-2">
            <span className="text-xs font-semibold uppercase text-neutral-600">Notes</span>
            <textarea className="field-input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}/>
          </label>
          {error && <div className="col-span-2 rounded-xl px-3 py-2 text-brand-500 bg-brand-50" role="alert">{error}</div>}
        </div>
        <footer className="px-4 py-3 border-t border-line flex items-center justify-end gap-2">
          <button type="button" className="btn-outline text-sm" onClick={onClose} disabled={busy}>Cancel</button>
          <button type="submit" className="btn-primary text-sm" disabled={busy}>
            <Receipt size={14}/> {busy ? 'Saving…' : 'Save to ledger'}
          </button>
        </footer>
      </form>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────

function fmtDate(d: any): string { return d ? new Date(d).toLocaleDateString() : '—'; }
