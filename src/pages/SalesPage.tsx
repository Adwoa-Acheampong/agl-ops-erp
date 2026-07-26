import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { ShoppingCart, Plus, Loader2, Search, X, Calendar, User, Wrench, ChevronDown, Check } from 'lucide-react';
import { PageShell } from '../components/layout/PageShell';
import {
  EmptyState,
  Modal,
  FormField,
  Combobox,
  type ComboboxItem,
} from '../components/ui';
import { trpc } from '../lib/trpc';
import { computeGhanaTax } from '../lib/ghanaTax';
import { FinanceLedgerView } from './FinancePage';

/**
 * P8.3 — Counter & online parts-sale flow.
 *
 * Distinct from the Workshop ledger: the shop sells parts directly to walk-ins
 * and online customers, drawing from the same `inventory` table. Each sale
 * posts a `transactions.type='sale'` row and decrements stock.
 */

function formatGHS(amount: number) {
  return `GHS ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Canonical AGL staff. Sales floor + workshop are fixed rosters — every
 * sale ties back to one or more of these names. The lists are colocated
 * with the filter UI on purpose: changing a name once here cascades to
 * the pill toggles, the active-filter chips, and the cell renderer.
 *
 * Notes on titles are display-only so the operator gets context when
 * scanning the filter row.
 */
const SALES_REPS: ReadonlyArray<{ name: string; note?: string }> = [
  { name: 'Yvonne' },
  { name: 'Bright',   note: 'Boss' },
  { name: 'Ben' },
  { name: 'Abigail' },
  { name: 'Miracle',  note: 'Ops Mgr' },
];
const MECHANICS: ReadonlyArray<{ name: string }> = [
  { name: 'Chris' },
  { name: 'Kojo' },
  { name: 'Appiah' },
  { name: 'Fatawu' },
];

/**
 * Split a multi-name cell into individual names. Master sheet uses
 * "Chris x Kojo" or "Chris × Kojo" to indicate that BOTH worked the
 * job; we also accept commas / slashes / ampersands / plus signs so
 * legacy entries don't slip the filter.
 */
function parseNames(field: any): string[] {
  if (!field) return [];
  return String(field)
    .split(/\s*(?:x|×|,|\/|&|\+)\s*/i)
    .map(s => s.trim())
    .filter(Boolean);
}

type Period = 'all' | 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

/**
 * Compact multi-select dropdown — looks like a native <select> but lets
 * the operator pick multiple items. Used for the two staff filters so
 * Sales Reps and Mechanics each have their own dropdown (never mixed)
 * while still supporting joint-job cases like "Chris x Kojo".
 *
 * Closes on outside-click and Escape.
 */
function MultiSelectDropdown({
  label, icon: Icon, options, selected, onChange, accent = 'red',
}: {
  label: string;
  icon: any;
  options: ReadonlyArray<{ name: string; note?: string }>;
  selected: string[];
  onChange: (next: string[]) => void;
  accent?: 'red' | 'amber';
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const toggle = (name: string) =>
    onChange(selected.includes(name) ? selected.filter(n => n !== name) : [...selected, name]);

  const tone =
    accent === 'amber'
      ? 'bg-amber-500 text-white ring-amber-600'
      : 'bg-brand-500 text-white ring-brand-600';

  const summary =
    selected.length === 0 ? `All ${label.toLowerCase()}` :
    selected.length === 1 ? selected[0] :
    `${selected.length} ${label.toLowerCase()}`;

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2 py-1.5 text-sm font-sans text-ink-900 hover:bg-neutral-100 whitespace-nowrap"
        style={{ border: '1px solid rgba(26,22,18,0.12)' }}
        title={`Filter by ${label.toLowerCase()}`}
      >
        <Icon size={13} className="text-ink-700" />
        <span>{summary}</span>
        {selected.length > 0 && (
          <span className={`inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full text-2xs font-bold ring-1 ${tone}`}>
            {selected.length}
          </span>
        )}
        <ChevronDown size={12} className={`text-ink-700 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div
          className="absolute z-30 mt-1 left-0 min-w-[180px] rounded-lg bg-white shadow-pop ring-1 ring-neutral-200 py-1"
          role="listbox"
          aria-multiselectable="true"
        >
          {options.map(({ name, note }) => {
            const on = selected.includes(name);
            return (
              <button
                key={name}
                type="button"
                role="option"
                aria-selected={on}
                onClick={() => toggle(name)}
                className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-sm text-left hover:bg-neutral-50 ${on ? 'bg-neutral-50' : ''}`}
              >
                <span className={`w-3.5 h-3.5 rounded-sm grid place-items-center ring-1 ${on ? tone : 'bg-white ring-neutral-300'}`}>
                  {on && <Check size={10} strokeWidth={3} className="text-white" />}
                </span>
                <span className="text-ink-900 flex-1">{name}</span>
                {note && <span className="text-ink-700 text-2xs">{note}</span>}
              </button>
            );
          })}
          {selected.length > 0 && (
            <>
              <div className="my-1 h-px bg-neutral-100" />
              <button
                type="button"
                onClick={() => { onChange([]); setOpen(false); }}
                className="w-full text-left px-2.5 py-1.5 text-xs text-ink-700 hover:bg-neutral-50 hover:text-brand-500"
              >
                Clear selection
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ymd(d: Date): string { return d.toISOString().slice(0, 10); }
function startOfWeek(d: Date): Date {
  const x = new Date(d);
  const day = x.getDay(); // 0 = Sun
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}
/** Compute [startISO, endISO] for a named period, or null for "all". */
function periodRange(period: Period, customFrom: string, customTo: string): { from: string; to: string } | null {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayISO = ymd(today);
  const eod = (d: Date) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return ymd(x); };
  if (period === 'today')   return { from: todayISO, to: eod(today) };
  if (period === 'week')    return { from: ymd(startOfWeek(today)), to: eod(today) };
  if (period === 'month')   { const s = new Date(today.getFullYear(), today.getMonth(), 1); return { from: ymd(s), to: eod(today) }; }
  if (period === 'quarter') { const q = Math.floor(today.getMonth() / 3); const s = new Date(today.getFullYear(), q * 3, 1); return { from: ymd(s), to: eod(today) }; }
  if (period === 'year')    { const s = new Date(today.getFullYear(), 0, 1); return { from: ymd(s), to: eod(today) }; }
  if (period === 'custom' && (customFrom || customTo)) {
    return { from: customFrom || '1970-01-01', to: customTo || ymd(new Date(8640000000000000)) };
  }
  return null;
}

export function SalesPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const salesUtils = trpc.useUtils();

  return (
    <>
      <FinanceLedgerView
        title="Sales"
        intro="Finance-style sales ledger with editable rows, date drill-through, split staff columns and CSV export."
        extraActions={
          <button className="btn-primary text-sm" onClick={() => setModalOpen(true)}>
            <Plus size={14} /> New Sale
          </button>
        }
      />
      <NewSaleModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={() => {
          setModalOpen(false);
          salesUtils.sales.list.invalidate();
          salesUtils.partsSales.list.invalidate();
          salesUtils.inventory.list.invalidate();
        }}
      />
    </>
  );

  const [search, setSearch] = useState('');
  const [methodFilter, setMethodFilter] = useState<string>('all');
  // Drill-through filters — set by clicking pill toggles or cells in the
  // ledger, cleared from the active-filter chip row above the table.
  // Multi-select: a row passes if *any* selected rep / mechanic appears
  // in its (potentially multi-name) field.
  const [repFilter, setRepFilter]   = useState<string[]>([]);
  const [mechFilter, setMechFilter] = useState<string[]>([]);
  const toggleRep  = (name: string) => setRepFilter(p  => p.includes(name) ? p.filter(n => n !== name) : [...p, name]);
  const toggleMech = (name: string) => setMechFilter(p => p.includes(name) ? p.filter(n => n !== name) : [...p, name]);
  const [period, setPeriod] = useState<Period>('all');
  const [customFrom, setCustomFrom] = useState<string>('');
  const [customTo,   setCustomTo]   = useState<string>('');
  const utils = trpc.useUtils();

  const salesQuery = trpc.partsSales.list.useQuery({ limit: 1000 }, { keepPreviousData: true });
  const allSales = salesQuery.data?.success ? salesQuery.data.sales ?? [] : [];

  const range = useMemo(() => periodRange(period, customFrom, customTo), [period, customFrom, customTo]);

  const sales = useMemo(() => allSales.filter((s: any) => {
    const q = search.trim().toLowerCase();
    if (q) {
      const hay = [
        s.id, s.amount, s.paymentMethod, s.status, s.createdAt,
        s.customerName, s.customerContact, s.channel, s.vehicle,
        s.partService, s.receiptNo, s.salesRep, s.mechanic,
      ].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (methodFilter !== 'all' && s.paymentMethod !== methodFilter) return false;
    if (repFilter.length > 0) {
      const names = parseNames(s.salesRep);
      if (!names.some(n => repFilter.includes(n))) return false;
    }
    if (mechFilter.length > 0) {
      const names = parseNames(s.mechanic);
      if (!names.some(n => mechFilter.includes(n))) return false;
    }
    if (range) {
      const ts = s.createdAt ? new Date(s.createdAt) : null;
      if (!ts) return false;
      const d = ymd(ts);
      if (d < range.from || d > range.to) return false;
    }
    return true;
  }), [allSales, search, methodFilter, repFilter, mechFilter, range]);

  const isLoading = salesQuery.isLoading;
  const errorMessage =
    salesQuery.error?.message ??
    (salesQuery.data?.success === false ? salesQuery.data.error : null);

  const totalSales = sales.reduce((sum: number, s: any) => sum + parseFloat(s.amount ?? '0'), 0);

  const hasActiveFilter = repFilter.length > 0 || mechFilter.length > 0 || period !== 'all' || methodFilter !== 'all' || !!search.trim();
  const clearAll = () => {
    setRepFilter([]); setMechFilter([]);
    setPeriod('all'); setCustomFrom(''); setCustomTo('');
    setMethodFilter('all'); setSearch('');
  };

  return (
    <PageShell
      eyebrow="Counter"
      title="Parts Sales"
      intro="Direct, walk-in, online — every part sold outside the workshop is recorded here. Stock decrements automatically; the financial ledger picks it up in the same beat."
      actions={
        <button className="btn-primary text-sm" onClick={() => setModalOpen(true)}>
          <Plus size={14} /> New Sale
        </button>
      }
    >
      {errorMessage && (
        <div
          className="rounded-2xl px-4 py-3 font-sans text-sm text-brand-500 bg-white"
          style={{ border: '1px solid rgba(160,48,64,0.32)' }}
        >
          {errorMessage}
        </div>
      )}

      <section className="grid grid-cols-2 md:grid-cols-3 gap-2">
        <article className="bg-white rounded-xl p-3 flex flex-col gap-1 min-w-0" style={{ border: '1px solid rgba(26,22,18,0.06)' }}>
          <span className="font-sans text-2xs font-semibold uppercase text-ink-700" style={{ letterSpacing: '0.08em' }}>Sales recorded</span>
          <div className="font-sans num leading-none text-ink-900" style={{ fontSize: 22, fontWeight: 600 }}>{sales.length}</div>
          <p className="font-sans text-2xs text-ink-700 leading-tight">
            {sales.length === allSales.length ? 'Total events on the ledger.' : `Filtered · of ${allSales.length} total`}
          </p>
        </article>
        <article className="bg-white rounded-xl p-3 flex flex-col gap-1 min-w-0" style={{ border: '1px solid rgba(26,22,18,0.06)' }}>
          <span className="font-sans text-2xs font-semibold uppercase text-ink-700" style={{ letterSpacing: '0.08em' }}>Gross revenue</span>
          <div className="font-sans num leading-none text-ink-900" style={{ fontSize: 22, fontWeight: 600 }}>{formatGHS(totalSales)}</div>
          <p className="font-sans text-2xs text-ink-700 leading-tight">
            {sales.length === allSales.length ? 'Sum of all parts sales rolling.' : 'Sum across active filters.'}
          </p>
        </article>
      </section>

      <section className="mt-2">
        <header className="flex items-end justify-between gap-3 flex-wrap mb-2">
          <h2 className="font-sans text-lg font-semibold text-ink-900">Sales Ledger</h2>
          <span className="font-sans text-xs text-ink-700">
            {sales.length === allSales.length ? `${allSales.length} sales` : `${sales.length} of ${allSales.length}`}
          </span>
        </header>
        <div className="flex flex-wrap items-center gap-2 mb-2">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-700 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by amount, method, status, date…"
              className="w-full rounded-lg bg-white pl-7 pr-7 py-1.5 text-sm font-sans text-ink-900 placeholder:text-ink-700 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
              style={{ border: '1px solid rgba(26,22,18,0.12)' }}
            />
            {search && (
              <button type="button" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-700 hover:text-ink-900" aria-label="Clear">
                <X size={12} />
              </button>
            )}
          </div>
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value as any)}
            className="rounded-lg bg-white px-2 py-1.5 text-sm font-sans text-ink-900"
            style={{ border: '1px solid rgba(26,22,18,0.12)' }}
          >
            <option value="all">All methods</option>
            <option value="Cash">Cash</option>
            <option value="MoMo">MoMo</option>
            <option value="Bank Transfer">Bank Transfer</option>
            <option value="Credit">Credit</option>
            <option value="POS">POS / Card</option>
          </select>

          {/* Sales-rep drill-through (multi-select). */}
          <MultiSelectDropdown
            label="Sales Reps"
            icon={User}
            options={SALES_REPS}
            selected={repFilter}
            onChange={setRepFilter}
            accent="red"
          />

          {/* Mechanic drill-through (multi-select). */}
          <MultiSelectDropdown
            label="Mechanics"
            icon={Wrench}
            options={MECHANICS}
            selected={mechFilter}
            onChange={setMechFilter}
            accent="amber"
          />

          {/* Period drill-through. */}
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
            className="rounded-lg bg-white px-2 py-1.5 text-sm font-sans text-ink-900"
            style={{ border: '1px solid rgba(26,22,18,0.12)' }}
            title="Filter by period"
          >
            <option value="all">All time</option>
            <option value="today">Today</option>
            <option value="week">This week</option>
            <option value="month">This month</option>
            <option value="quarter">This quarter</option>
            <option value="year">This year</option>
            <option value="custom">Custom range…</option>
          </select>
          {period === 'custom' && (
            <span className="inline-flex items-center gap-1 text-xs">
              <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)}
                className="rounded-lg bg-white px-2 py-1 text-xs" style={{ border: '1px solid rgba(26,22,18,0.12)' }} />
              <span className="text-ink-700">→</span>
              <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)}
                className="rounded-lg bg-white px-2 py-1 text-xs" style={{ border: '1px solid rgba(26,22,18,0.12)' }} />
            </span>
          )}

          {salesQuery.isFetching && (
            <span className="inline-flex items-center gap-1.5 font-sans text-xs text-ink-700">
              <Loader2 size={12} className="animate-spin" /> Refreshing…
            </span>
          )}
        </div>

        {/* Active-filter chip strip — period / method / search. Staff
            selections live in the dropdowns above; this strip only shows
            the non-staff filters so we don't double-render the names. */}
        {(period !== 'all' || methodFilter !== 'all' || search.trim()) && (
          <div className="flex flex-wrap items-center gap-1.5 mb-2 text-xs">
            <span className="text-ink-700 font-semibold uppercase tracking-wider" style={{ fontSize: 10 }}>Filters:</span>
            {period !== 'all' && (
              <button onClick={() => { setPeriod('all'); setCustomFrom(''); setCustomTo(''); }}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100 ring-1 ring-emerald-100">
                <Calendar size={11}/> {period === 'custom' ? `${customFrom || '…'} → ${customTo || '…'}` : period} <X size={10}/>
              </button>
            )}
            {methodFilter !== 'all' && (
              <button onClick={() => setMethodFilter('all')}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700 hover:bg-neutral-200 ring-1 ring-neutral-200">
                Method · {methodFilter} <X size={10}/>
              </button>
            )}
            {search.trim() && (
              <button onClick={() => setSearch('')}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700 hover:bg-neutral-200 ring-1 ring-neutral-200">
                Search · “{search.trim()}” <X size={10}/>
              </button>
            )}
            {hasActiveFilter && (
              <button onClick={clearAll} className="ml-auto text-ink-700 hover:text-brand-500 underline underline-offset-2">Clear all</button>
            )}
          </div>
        )}
        <div className="bg-white rounded-2xl agl-scroll-x min-w-0" style={{ border: '1px solid rgba(26,22,18,0.06)', maxWidth: '100%' }}>
          <table className="min-w-[1100px] w-full" style={{ tableLayout: 'auto' }}>
              <thead>
                <tr>
                  <th className="t-th whitespace-nowrap">Date</th>
                  <th className="t-th whitespace-nowrap">Customer</th>
                  <th className="t-th whitespace-nowrap">Sales Rep</th>
                  <th className="t-th whitespace-nowrap">Mechanic</th>
                  <th className="t-th whitespace-nowrap">Channel</th>
                  <th className="t-th whitespace-nowrap">Vehicle</th>
                  <th className="t-th whitespace-nowrap">Item / Service</th>
                  <th className="t-th whitespace-nowrap">Qty</th>
                  <th className="t-th whitespace-nowrap">Unit</th>
                  <th className="t-th whitespace-nowrap">Total</th>
                  <th className="t-th whitespace-nowrap">Method</th>
                  <th className="t-th whitespace-nowrap">Status</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={12} className="px-4 py-8 text-center font-sans text-sm text-ink-700">
                      <span className="inline-flex items-center gap-1.5">
                        <Loader2 size={14} className="animate-spin" /> Loading sales…
                      </span>
                    </td>
                  </tr>
                )}
                {!isLoading && sales.length === 0 && (
                  <tr>
                    <td colSpan={12} className="px-4 py-8 text-center font-sans text-sm text-ink-700">
                      No parts sold yet.
                    </td>
                  </tr>
                )}
                {sales.map((s: any) => {
                  const date = s.createdAt ? new Date(s.createdAt) : null;
                  const dateLabel = date ? date.toLocaleDateString() : '—';
                  const dateISO = date ? ymd(date) : null;
                  const unit = parseFloat(s.unitPrice ?? '0');
                  // Clicking a date drills into a single-day custom range.
                  const drillDate = () => {
                    if (!dateISO) return;
                    setPeriod('custom');
                    setCustomFrom(dateISO);
                    setCustomTo(dateISO);
                  };
                  return (
                    <tr key={s.id} className="hover:bg-neutral-50">
                      <td className="t-td">
                        <button
                          type="button"
                          onClick={drillDate}
                          disabled={!dateISO}
                          className="text-left hover:text-brand-600 hover:underline underline-offset-2 disabled:no-underline disabled:hover:text-current"
                          title={dateISO ? `Filter to ${dateISO}` : undefined}
                        >
                          {dateLabel}
                        </button>
                      </td>
                      <td className="t-td">{s.customerName ?? '—'}</td>
                      <td className="t-td whitespace-nowrap">
                        {parseNames(s.salesRep).join(', ') || '—'}
                      </td>
                      <td className="t-td whitespace-nowrap">
                        {parseNames(s.mechanic).join(', ') || '—'}
                      </td>
                      <td className="t-td">{s.channel ?? '—'}</td>
                      <td className="t-td">{s.vehicle ?? '—'}</td>
                      <td className="t-td max-w-[28ch] truncate" title={s.partService ?? ''}>
                        {s.partService ?? '—'}
                      </td>
                      <td className="t-td num">{s.quantity ?? '—'}</td>
                      <td className="t-td num">{unit > 0 ? formatGHS(unit) : '—'}</td>
                      <td className="t-td num font-semibold">{formatGHS(parseFloat(s.amount ?? '0'))}</td>
                      <td className="t-td">{s.paymentMethod ?? '—'}</td>
                      <td className="t-td">{s.status ?? '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
          </table>
        </div>
      </section>

      {!isLoading && !errorMessage && sales.length === 0 && (
        <EmptyState
          icon={ShoppingCart}
          title="The counter is quiet"
          description="Record your first walk-in or online parts sale to begin building a sales history. Every entry decrements stock and posts to Finance automatically."
          action={
            <button className="btn-primary text-sm" onClick={() => setModalOpen(true)}>
              <Plus size={14} /> Record Your First Sale
            </button>
          }
        />
      )}

      <NewSaleModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={() => {
          setModalOpen(false);
          utils.partsSales.list.invalidate();
          utils.inventory.list.invalidate();
        }}
      />
    </PageShell>
  );
}

// ───────────────────────────────────────────────────────────────────────────
//   New Sale modal
// ───────────────────────────────────────────────────────────────────────────

interface SaleLine {
  id: string; // local-only; lets React key the repeater rows
  inventoryItemId: number | null;
  quantity: string;
  unitPrice: string;
}

const newLine = (): SaleLine => ({
  id: Math.random().toString(36).slice(2, 9),
  inventoryItemId: null,
  quantity: '1',
  unitPrice: '',
});

function NewSaleModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const inventoryQuery = trpc.inventory.list.useQuery({}, { keepPreviousData: true });
  const items = Array.isArray(inventoryQuery.data) ? inventoryQuery.data : [];

  const [lines, setLines] = useState<SaleLine[]>([newLine()]);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'mobile_money' | 'card' | 'bank_transfer' | 'credit'>('cash');
  const [channel, setChannel] = useState<'walk_in' | 'whatsapp' | 'phone' | 'online'>('walk_in');
  const [customerName, setCustomerName] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [discountPct, setDiscountPct] = useState('0');
  const [taxMode, setTaxMode] = useState<'standard' | 'exempt' | 'zero-rated'>('standard');
  // Backdating support: defaults to today but operators can pick any
  // date (used for filling in May history etc.).
  const [transactionDate, setTransactionDate] = useState<string>(new Date().toISOString().slice(0, 10));
  // Staff attribution at sale time so backdated rows still carry the
  // attendant who actually closed the deal.
  const [salesRep, setSalesRep] = useState<string>('');
  const [mechanic, setMechanic] = useState<string>('');

  const itemList: ComboboxItem[] = useMemo(
    () =>
      items.map((it: any) => ({
        id: it.id as number,
        label: `${it.itemCode ?? '—'} · ${it.itemName ?? ''}`,
        sublabel: `${it.quantity} on hand · ${formatGHS(parseFloat(it.unitPrice ?? '0'))} unit · ${it.category ?? ''}`,
      })),
    [items],
  );

  const updateLine = (idx: number, patch: Partial<SaleLine>) => {
    setLines((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  };
  const removeLine = (idx: number) => setLines((rows) => rows.filter((_, i) => i !== idx));
  const addLine = () => setLines((rows) => [...rows, newLine()]);

  // WS2-A: picking a new SKU must ALWAYS replace the unit price with
  // the new SKU's list price. The previous heuristic ("only if the row
  // was empty") caused the first line's price to persist after the
  // user changed the SKU — the bug the user reported. Rule now:
  //   - new SKU selected → unit price reset to that SKU's list price
  //   - SKU cleared      → unit price cleared
  // The operator can still type a custom price afterwards; the field
  // remains a controlled input so totals always reflect live state.
  const onPickItem = (idx: number, id: number | null) => {
    if (id == null) { updateLine(idx, { inventoryItemId: null, unitPrice: '' }); return; }
    const it = items.find((x: any) => x.id === id) as any;
    const nextPrice = it ? String(parseFloat(it.unitPrice ?? '0')) : '';
    updateLine(idx, { inventoryItemId: id, unitPrice: nextPrice });
  };

  const createMutation = trpc.partsSales.create.useMutation({
    onSuccess: (data) => {
      if (data?.success === false) {
        setError(data.error ?? 'Failed to record sale.');
        return;
      }
      setLines([newLine()]);
      setPaymentMethod('cash');
      setChannel('walk_in');
      setCustomerName('');
      setNotes('');
      setError(null);
      // Reset the new fields too — keep transactionDate at today so the
      // operator doesn't have to re-pick it for the next entry.
      setTransactionDate(new Date().toISOString().slice(0, 10));
      setSalesRep('');
      setMechanic('');
      onCreated();
    },
    onError: (e) => setError(e.message),
  });

  const subtotal = lines.reduce((sum, ln) => {
    const q = parseFloat(ln.quantity);
    const p = parseFloat(ln.unitPrice);
    if (Number.isNaN(q) || Number.isNaN(p)) return sum;
    return sum + q * p;
  }, 0);

  // Alias kept for the legacy "total" name still used in basket display.
  const total = subtotal;

  const discountPctNum = Math.max(0, Math.min(100, parseFloat(discountPct) || 0));
  const tax = computeGhanaTax({
    netBeforeDiscount: subtotal,
    discountPct: discountPctNum / 100,
    rateMode: taxMode,
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const valid: { inventoryItemId: number; quantity: number; unitPrice: number }[] = [];
    for (let idx = 0; idx < lines.length; idx++) {
      const ln = lines[idx];
      if (ln.inventoryItemId == null) {
        return setError(`Pick an inventory item for row ${idx + 1}.`);
      }
      const q = parseFloat(ln.quantity);
      const p = parseFloat(ln.unitPrice);
      if (Number.isNaN(q) || q <= 0) return setError(`Quantity must be a positive number on row ${idx + 1}.`);
      if (Number.isNaN(p) || p < 0) return setError(`Unit price must be a non-negative number on row ${idx + 1}.`);
      valid.push({ inventoryItemId: ln.inventoryItemId, quantity: q, unitPrice: p });
    }

    // Encode discount + Ghana tax breakdown into notes so the data is
    // captured even before the server schema gets dedicated columns.
    // Once we add discount_pct / vat / nhil / getfund / covid columns to
    // the parts_sales server input, switch to passing them as fields.
    const taxNote = taxMode === 'standard'
      ? `Discount ${discountPctNum}% (GHS ${tax.discount.toFixed(2)}) · NHIL ${tax.nhil.toFixed(2)} · GETFund ${tax.getfund.toFixed(2)} · COVID ${tax.covid.toFixed(2)} · VAT ${tax.vat.toFixed(2)} · Gross ${tax.gross.toFixed(2)}`
      : `Discount ${discountPctNum}% (GHS ${tax.discount.toFixed(2)}) · Tax ${taxMode.toUpperCase()} · Gross ${tax.gross.toFixed(2)}`;
    const combinedNotes = [notes.trim(), taxNote].filter(Boolean).join(' | ');

    createMutation.mutate({
      items: valid,
      paymentMethod,
      channel,
      customerName: customerName.trim() || undefined,
      notes: combinedNotes || undefined,
      transactionDate: transactionDate || undefined,
      salesRep: salesRep || undefined,
      mechanic: mechanic || undefined,
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow="New Sale"
      title="Record Parts Sale"
      width={680}
      footer={
        <>
          <button type="button" className="btn-outline text-sm" onClick={onClose} disabled={createMutation.isLoading}>
            Cancel
          </button>
          <button
            type="submit"
            form="new-sale-form"
            className="btn-primary text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={createMutation.isLoading}
          >
            {createMutation.isLoading ? 'Saving…' : `Record · ${formatGHS(tax.gross)}`}
          </button>
        </>
      }
    >
      <form id="new-sale-form" onSubmit={onSubmit} className="grid grid-cols-2 gap-3">
        <FormField label="Line items" required span={2} hint="Add as many SKUs as needed; each decrements stock independently.">
          <div className="flex flex-col gap-2">
            {lines.map((ln, idx) => {
              const item = items.find((x: any) => x.id === ln.inventoryItemId) as any;
              const lineTotal =
                parseFloat(ln.quantity) > 0 && parseFloat(ln.unitPrice) >= 0
                  ? parseFloat(ln.quantity) * parseFloat(ln.unitPrice)
                  : 0;
              return (
                <div
                  key={ln.id}
                  className="grid gap-2"
                  style={{ gridTemplateColumns: '1fr 80px 110px 100px 32px', alignItems: 'center' }}
                >
                  <Combobox
                    items={itemList}
                    value={ln.inventoryItemId}
                    onChange={(it) => onPickItem(idx, it ? Number(it.id) : null)}
                    placeholder="Search part…"
                    emptyHint="Nothing matches."
                  />
                  <input
                    type="number"
                    className="field-input num"
                    min={1}
                    step="0.01"
                    value={ln.quantity}
                    onChange={(e) => updateLine(idx, { quantity: e.target.value })}
                    placeholder="Qty"
                    required
                  />
                  <input
                    type="number"
                    className="field-input num"
                    min={0}
                    step="0.01"
                    value={ln.unitPrice}
                    onChange={(e) => updateLine(idx, { unitPrice: e.target.value })}
                    placeholder="Price"
                    required
                  />
                  <span className="font-sans num text-sm text-ink-900 text-right">
                    {formatGHS(lineTotal)}
                  </span>
                  <button
                    type="button"
                    className="text-brand-500 hover:text-brand-600 text-xs disabled:opacity-40"
                    onClick={() => removeLine(idx)}
                    disabled={lines.length === 1}
                    title={lines.length === 1 ? 'At least one line required' : 'Remove'}
                  >
                    ✕
                  </button>
                  {item && (
                    <span className="col-span-5 font-sans text-xs text-ink-700">
                      {item.quantity} on hand at {formatGHS(parseFloat(item.unitPrice ?? '0'))} list.
                    </span>
                  )}
                </div>
              );
            })}
            <div className="flex items-center justify-between">
              <button type="button" className="btn-outline text-xs" onClick={addLine}>
                + Add line
              </button>
              <span className="font-sans num text-sm font-semibold text-ink-900">
                Basket: {formatGHS(total)}
              </span>
            </div>
          </div>
        </FormField>

        <FormField label="Transaction date" required hint="Backdating allowed — picks any historical date.">
          <input
            type="date"
            className="field-input num"
            value={transactionDate}
            onChange={(e) => setTransactionDate(e.target.value)}
            max={new Date().toISOString().slice(0, 10)}
            required
          />
        </FormField>

        <FormField label="Payment method" required>
          <select
            className="field-input"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as typeof paymentMethod)}
          >
            <option value="cash">Cash</option>
            <option value="mobile_money">Mobile money (MoMo)</option>
            <option value="bank_transfer">Bank transfer</option>
            <option value="card">Card / POS</option>
            <option value="credit">Credit sale (defer payment)</option>
          </select>
        </FormField>

        <FormField label="Channel">
          <select
            className="field-input"
            value={channel}
            onChange={(e) => setChannel(e.target.value as typeof channel)}
          >
            <option value="walk_in">Walk-in</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="phone">Phone</option>
            <option value="online">Online</option>
          </select>
        </FormField>

        <FormField label="Sales rep" hint="Who closed the sale. Canonical roster.">
          <select className="field-input" value={salesRep} onChange={(e) => setSalesRep(e.target.value)}>
            <option value="">—</option>
            {SALES_REPS.map((r) => (
              <option key={r.name} value={r.name}>{r.name}{r.note ? ` · ${r.note}` : ''}</option>
            ))}
          </select>
        </FormField>

        <FormField label="Mechanic" hint="If parts went onto a workshop job.">
          <select className="field-input" value={mechanic} onChange={(e) => setMechanic(e.target.value)}>
            <option value="">—</option>
            {MECHANICS.map((m) => <option key={m.name} value={m.name}>{m.name}</option>)}
          </select>
        </FormField>

        <FormField label="Customer name" hint="Optional. Walk-ins can stay anonymous." span={2}>
          <input
            className="field-input"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Yaw Mensah"
          />
        </FormField>

        <FormField label="Discount %" hint="Whole-customer discount applied before tax.">
          <input
            type="number"
            className="field-input num"
            min={0}
            max={100}
            step="0.5"
            value={discountPct}
            onChange={(e) => setDiscountPct(e.target.value)}
          />
        </FormField>

        <FormField label="Tax treatment" hint="Standard = full Ghana VAT stack.">
          <select
            className="field-input"
            value={taxMode}
            onChange={(e) => setTaxMode(e.target.value as any)}
          >
            <option value="standard">Standard (VAT + NHIL + GETFund + COVID)</option>
            <option value="zero-rated">Zero-rated</option>
            <option value="exempt">Exempt</option>
          </select>
        </FormField>

        <div
          className="col-span-2 rounded-xl px-3 py-2.5 grid grid-cols-2 gap-x-4 gap-y-1 text-sm"
          style={{ background: '#FAF7F2', border: '1px solid rgba(26,22,18,0.10)' }}
        >
          <span className="text-ink-700">Subtotal</span>
          <span className="num text-right">{formatGHS(tax.netBeforeDiscount)}</span>
          {tax.discount > 0 && (
            <>
              <span className="text-ink-700">Discount ({discountPctNum.toFixed(1)}%)</span>
              <span className="num text-right text-brand-500">− {formatGHS(tax.discount)}</span>
            </>
          )}
          <span className="text-ink-700">Net</span>
          <span className="num text-right">{formatGHS(tax.net)}</span>
          {taxMode === 'standard' && (
            <>
              <span className="text-ink-700">NHIL 2.5%</span>
              <span className="num text-right">{formatGHS(tax.nhil)}</span>
              <span className="text-ink-700">GETFund 2.5%</span>
              <span className="num text-right">{formatGHS(tax.getfund)}</span>
              <span className="text-ink-700">COVID 1%</span>
              <span className="num text-right">{formatGHS(tax.covid)}</span>
              <span className="text-ink-700">VAT 15%</span>
              <span className="num text-right">{formatGHS(tax.vat)}</span>
            </>
          )}
          <span className="font-semibold text-ink-900 pt-1 border-t border-line">Gross total</span>
          <span className="num font-semibold text-right text-ink-900 pt-1 border-t border-line">{formatGHS(tax.gross)}</span>
        </div>

        <FormField label="Notes" span={2}>
          <textarea
            className="field-input"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Discount applied. Phoned in by Mama Akua."
          />
        </FormField>

        {error && (
          <div
            className="col-span-2 rounded-xl px-3 py-2 font-sans text-sm text-brand-500"
            style={{ background: '#F5EBED', border: '1px solid rgba(122,31,43,0.18)' }}
            role="alert"
          >
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
}
