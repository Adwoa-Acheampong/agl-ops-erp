import { FormEvent, type ReactNode, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Download,
  FileText,
  Loader2,
  Pencil,
  Receipt,
  Save,
  Search,
  ShoppingBag,
  Truck,
  Wallet,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Modal, FormField } from '../components/ui';
import { trpc } from '../lib/trpc';
import { exportRowsToCsv } from '../lib/csvExport';
import { ghs } from '../lib/ghanaTax';
import { useAuth } from '../contexts/AuthContext';

const CHANNELS = ['Walk-In', 'WhatsApp', 'Phone', 'Instagram', 'TikTok', 'Boss', 'Delivery', 'Order'];
const PAYMENT_METHODS = ['Cash', 'MoMo', 'Bank Transfer', 'Credit', 'POS'];
const STATUSES = ['Completed', 'Pending Payment', 'Pending', 'Cancelled', 'Queued', 'Awaiting', 'Delivered'];

const PAYMENT_TONE: Record<string, string> = {
  Cash: 'bg-emerald-50 text-emerald-700',
  MoMo: 'bg-amber-50 text-amber-700',
  'Bank Transfer': 'bg-blue-50 text-blue-700',
  Credit: 'bg-brand-50 text-brand-600',
  POS: 'bg-violet-50 text-violet-700',
};

type Period = 'all' | 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

function rowValue(row: any, snake: string, camel: string) {
  return row?.[snake] ?? row?.[camel];
}

function numeric(value: any): number {
  return Number.parseFloat(String(value ?? '0')) || 0;
}

function toDateOnly(value: any): string {
  if (!value) return '';
  if (typeof value === 'string') {
    const match = value.match(/^\d{4}-\d{2}-\d{2}/);
    if (match) return match[0];
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function dateLabel(value: any): string {
  const iso = toDateOnly(value);
  if (!iso) return '-';
  const date = new Date(`${iso}T12:00:00Z`);
  return date.toLocaleDateString();
}

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setDate(x.getDate() - x.getDay());
  x.setHours(0, 0, 0, 0);
  return x;
}

function periodRange(period: Period, customFrom: string, customTo: string): { from: string; to: string } | null {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = toDateOnly(today);

  if (period === 'today') return { from: todayIso, to: todayIso };
  if (period === 'week') return { from: toDateOnly(startOfWeek(today)), to: todayIso };
  if (period === 'month') return { from: toDateOnly(new Date(today.getFullYear(), today.getMonth(), 1)), to: todayIso };
  if (period === 'quarter') {
    const quarter = Math.floor(today.getMonth() / 3);
    return { from: toDateOnly(new Date(today.getFullYear(), quarter * 3, 1)), to: todayIso };
  }
  if (period === 'year') return { from: toDateOnly(new Date(today.getFullYear(), 0, 1)), to: todayIso };
  if (period === 'custom' && (customFrom || customTo)) {
    return { from: customFrom || '1970-01-01', to: customTo || '9999-12-31' };
  }
  return null;
}

function parseNames(value: any): string[] {
  if (!value) return [];
  return String(value)
    .split(/\s*(?:x|,|\/|&|\+)\s*/i)
    .map((part) => part.trim())
    .filter(Boolean);
}

function blankToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function parseOptionalNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

function parseRequiredNumber(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function FinancePage() {
  return (
    <FinanceLedgerView
      title="Finance"
      intro="Sales ledger, expenses, purchases and supplies in one place."
    />
  );
}

export function FinanceLedgerView({
  title = 'Finance',
  intro = 'Sales ledger with customer, item, channel, payment, status and staff coverage.',
  extraActions,
}: {
  title?: string;
  intro?: string;
  extraActions?: ReactNode;
}) {
  const [search, setSearch] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<string>('all');
  const [channel, setChannel] = useState<string>('all');
  const [status, setStatus] = useState<string>('all');
  const [period, setPeriod] = useState<Period>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [editing, setEditing] = useState<any | null>(null);

  const { user } = useAuth();
  const canEditLedger = !!user?.canEditLedgers || ['admin', 'owner', 'manager', 'operations_manager', 'principal'].includes(String(user?.role ?? '').toLowerCase());
  const utils = trpc.useUtils();
  const q = trpc.sales.list.useQuery({} as any, { keepPreviousData: true });
  const sales: any[] = Array.isArray(q.data) ? q.data : ((q.data as any)?.transactions ?? []);
  const range = useMemo(() => periodRange(period, customFrom, customTo), [period, customFrom, customTo]);

  const channelOptions = useMemo(() => {
    return Array.from(new Set([...CHANNELS, ...sales.map((s) => s.channel).filter(Boolean)])).sort();
  }, [sales]);

  const items = useMemo(() => sales.filter((s: any) => {
    const method = rowValue(s, 'payment_method', 'paymentMethod');
    if (paymentMethod !== 'all' && method !== paymentMethod) return false;
    if (channel !== 'all' && (s.channel ?? '') !== channel) return false;
    if (status !== 'all' && (s.status ?? '') !== status) return false;

    if (range) {
      const iso = toDateOnly(rowValue(s, 'transaction_date', 'transactionDate'));
      if (!iso || iso < range.from || iso > range.to) return false;
    }

    if (search.trim()) {
      const hay = [
        s.id,
        rowValue(s, 'customer_name', 'customerName'),
        rowValue(s, 'customer_contact', 'customerContact'),
        s.channel,
        s.vehicle,
        rowValue(s, 'part_service', 'partService'),
        rowValue(s, 'receipt_no', 'receiptNo'),
        rowValue(s, 'sales_rep', 'salesRep'),
        s.mechanic,
        method,
        s.status,
      ].filter(Boolean).join(' ').toLowerCase();
      if (!hay.includes(search.trim().toLowerCase())) return false;
    }

    return true;
  }), [sales, paymentMethod, channel, status, range, search]);

  const totals = useMemo(() => {
    const revenue = items.reduce((sum, r: any) => sum + numeric(rowValue(r, 'total_amount', 'totalAmount')), 0);
    const orders = items.length;
    const aov = orders > 0 ? revenue / orders : 0;
    const credit = items
      .filter((r: any) => rowValue(r, 'payment_method', 'paymentMethod') === 'Credit')
      .reduce((sum, r: any) => sum + numeric(rowValue(r, 'total_amount', 'totalAmount')), 0);
    return { revenue, orders, aov, credit };
  }, [items]);

  const clearFilters = () => {
    setSearch('');
    setPaymentMethod('all');
    setChannel('all');
    setStatus('all');
    setPeriod('all');
    setCustomFrom('');
    setCustomTo('');
  };

  const exportCsv = () => exportRowsToCsv('agl-finance-sales', items, [
    { header: 'Date',          value: (s: any) => toDateOnly(rowValue(s, 'transaction_date', 'transactionDate')) },
    { header: 'Customer',      value: (s: any) => rowValue(s, 'customer_name', 'customerName') ?? '' },
    { header: 'Contact',       value: (s: any) => rowValue(s, 'customer_contact', 'customerContact') ?? '' },
    { header: 'Channel',       value: (s: any) => s.channel ?? '' },
    { header: 'Vehicle',       value: (s: any) => s.vehicle ?? '' },
    { header: 'Item/Service',  value: (s: any) => rowValue(s, 'part_service', 'partService') ?? '' },
    { header: 'Qty',           value: (s: any) => s.quantity ?? '' },
    { header: 'Unit Price',    value: (s: any) => rowValue(s, 'unit_price', 'unitPrice') ?? '' },
    { header: 'Total',         value: (s: any) => rowValue(s, 'total_amount', 'totalAmount') ?? '' },
    { header: 'Payment',       value: (s: any) => rowValue(s, 'payment_method', 'paymentMethod') ?? '' },
    { header: 'Receipt #',     value: (s: any) => rowValue(s, 'receipt_no', 'receiptNo') ?? '' },
    { header: 'Sales Rep',     value: (s: any) => rowValue(s, 'sales_rep', 'salesRep') ?? '' },
    { header: 'Mechanic',      value: (s: any) => s.mechanic ?? '' },
    { header: 'Status',        value: (s: any) => s.status ?? '' },
    { header: 'Notes',         value: (s: any) => s.notes ?? '' },
  ]);

  return (
    <div className="max-w-7xl">
      <header className="flex items-end justify-between gap-3 flex-wrap mb-4">
        <div>
          <h1 className="h-section flex items-center gap-2"><Wallet size={20} /> {title}</h1>
          <p className="mt-1 text-neutral-600 text-sm">{intro}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {extraActions}
          <Link to="/expenses-hub?tab=expenses" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold bg-brand-50 text-brand-600 hover:bg-brand-500 hover:text-white border border-brand-500/40">
            <Receipt size={14} /> Add Expense
          </Link>
          <Link to="/expenses-hub?tab=purchases" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold bg-white text-neutral-700 hover:bg-canvas border border-line">
            <Truck size={14} /> Add Purchase
          </Link>
          <Link to="/expenses-hub?tab=supplies" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold bg-white text-neutral-700 hover:bg-canvas border border-line">
            <ShoppingBag size={14} /> Add Supply
          </Link>
          <Link to="/expenses-hub" className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold bg-black text-white hover:bg-neutral-800">
            P&amp;L Hub
          </Link>
        </div>
      </header>

      {q.error && <div className="rounded-2xl px-4 py-3 mb-3 text-sm bg-brand-50 text-brand-500">{q.error.message}</div>}

      <section className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-4">
        <Kpi label="Revenue (filtered)" value={ghs(totals.revenue)} />
        <Kpi label="Orders" value={String(totals.orders)} sub={items.length === sales.length ? 'all rows' : `of ${sales.length}`} />
        <Kpi label="Average sale" value={ghs(totals.aov)} />
        <Kpi label="Outstanding credit" value={ghs(totals.credit)} tone={totals.credit > 0 ? 'brand' : undefined} />
      </section>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            type="search"
            placeholder="Search customer, item/service, vehicle, staff, receipt..."
            className="w-full rounded-lg bg-white border border-line pl-7 pr-7 py-1.5 text-xs"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-black" aria-label="Clear search">
              <X size={12} />
            </button>
          )}
        </div>

        <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="rounded-lg bg-white border border-line px-2 py-1.5 text-xs">
          <option value="all">All payment methods</option>
          {PAYMENT_METHODS.map((method) => <option key={method} value={method}>{method}</option>)}
        </select>

        <select value={channel} onChange={(e) => setChannel(e.target.value)} className="rounded-lg bg-white border border-line px-2 py-1.5 text-xs">
          <option value="all">All channels</option>
          {channelOptions.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>

        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg bg-white border border-line px-2 py-1.5 text-xs">
          <option value="all">All status</option>
          {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <select value={period} onChange={(e) => setPeriod(e.target.value as Period)} className="rounded-lg bg-white border border-line px-2 py-1.5 text-xs">
          <option value="all">All time</option>
          <option value="today">Today</option>
          <option value="week">This week</option>
          <option value="month">This month</option>
          <option value="quarter">This quarter</option>
          <option value="year">This year</option>
          <option value="custom">Custom range</option>
        </select>

        {period === 'custom' && (
          <span className="inline-flex items-center gap-1">
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="rounded-lg bg-white border border-line px-2 py-1.5 text-xs" />
            <span className="text-xs text-neutral-500">to</span>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="rounded-lg bg-white border border-line px-2 py-1.5 text-xs" />
          </span>
        )}

        <button
          className="btn-outline text-xs disabled:opacity-50 px-3 py-1.5"
          disabled={items.length === 0}
          onClick={exportCsv}
        >
          <Download size={12} /> CSV
        </button>

        {(search || paymentMethod !== 'all' || channel !== 'all' || status !== 'all' || period !== 'all') && (
          <button className="text-xs text-neutral-500 hover:text-brand-500 underline underline-offset-2" onClick={clearFilters}>
            Clear filters
          </button>
        )}

        {q.isFetching && (
          <span className="inline-flex items-center gap-1.5 text-xs text-neutral-500">
            <Loader2 size={12} className="animate-spin" /> Refreshing
          </span>
        )}
      </div>

      <div className="bg-white rounded-2xl overflow-hidden border border-line">
        <div style={{ overflowX: 'auto' }}>
          <table className="w-full text-[11.5px] min-w-[1240px]">
            <thead>
              <tr>
                <th className="t-th !px-2 !py-2">Date</th>
                <th className="t-th !px-2 !py-2">Customer</th>
                <th className="t-th !px-2 !py-2">Channel</th>
                <th className="t-th !px-2 !py-2">Vehicle</th>
                <th className="t-th !px-2 !py-2">Item / Service</th>
                <th className="t-th !px-2 !py-2">Qty</th>
                <th className="t-th !px-2 !py-2">Unit</th>
                <th className="t-th !px-2 !py-2">Total</th>
                <th className="t-th !px-2 !py-2">Pay</th>
                <th className="t-th !px-2 !py-2">Sales Rep</th>
                <th className="t-th !px-2 !py-2">Mechanic</th>
                <th className="t-th !px-2 !py-2">Status</th>
                {canEditLedger && <th className="t-th !px-2 !py-2 text-right">Edit</th>}
              </tr>
            </thead>
            <tbody>
              {q.isLoading && <tr><td colSpan={13} className="px-2 py-6 text-center text-neutral-500"><Loader2 size={14} className="animate-spin inline" /> Loading...</td></tr>}
              {!q.isLoading && items.length === 0 && <tr><td colSpan={13} className="px-2 py-6 text-center text-neutral-500">No matching sales.</td></tr>}
              {!q.isLoading && items.slice(0, 500).map((s: any, i: number) => {
                const id = Number(s.id ?? i);
                const pay = rowValue(s, 'payment_method', 'paymentMethod') ?? '-';
                const tone = PAYMENT_TONE[pay] ?? 'bg-canvas text-neutral-600';
                const rep = rowValue(s, 'sales_rep', 'salesRep');
                const mech = s.mechanic;
                const item = rowValue(s, 'part_service', 'partService') ?? '-';
                const isService = /diagn|labour|labor|service|test|cleaning|fitting|fix|repair/i.test(String(item));
                const dateIso = toDateOnly(rowValue(s, 'transaction_date', 'transactionDate'));
                const selected = selectedId === id;

                return (
                  <tr
                    key={s.id ?? i}
                    className={`${selected ? 'bg-brand-50/70 ring-1 ring-inset ring-brand-500/30' : 'hover:bg-neutral-50'} cursor-pointer`}
                    onClick={() => setSelectedId(id)}
                  >
                    <td className="t-td !px-2 !py-1.5 num-tabular text-neutral-600">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!dateIso) return;
                          setPeriod('custom');
                          setCustomFrom(dateIso);
                          setCustomTo(dateIso);
                        }}
                        className="hover:text-brand-600 hover:underline underline-offset-2"
                        title={dateIso ? `Filter to ${dateIso}` : undefined}
                      >
                        {dateLabel(rowValue(s, 'transaction_date', 'transactionDate'))}
                      </button>
                    </td>
                    <td className="t-td !px-2 !py-1.5">
                      <div className="font-semibold truncate" style={{ maxWidth: 132 }}>{rowValue(s, 'customer_name', 'customerName') ?? <span className="text-neutral-400">Walk-in</span>}</div>
                      {rowValue(s, 'customer_contact', 'customerContact') && <div className="text-[10.5px] text-neutral-500 num-tabular truncate" style={{ maxWidth: 132 }}>{rowValue(s, 'customer_contact', 'customerContact')}</div>}
                    </td>
                    <td className="t-td !px-2 !py-1.5"><span className="inline-block px-1.5 py-0.5 rounded-md bg-canvas text-[10.5px] capitalize">{s.channel ?? '-'}</span></td>
                    <td className="t-td !px-2 !py-1.5 num-tabular truncate" style={{ maxWidth: 84 }}>{s.vehicle ?? '-'}</td>
                    <td className="t-td !px-2 !py-1.5">
                      <span className={`inline-block px-1 py-0.5 rounded text-[10px] font-bold mr-1 ${isService ? 'bg-brand-50 text-brand-600' : 'bg-emerald-50 text-emerald-700'}`}>{isService ? 'SVC' : 'PART'}</span>
                      <span className="truncate inline-block align-bottom" style={{ maxWidth: 190 }} title={String(item)}>{item}</span>
                    </td>
                    <td className="t-td !px-2 !py-1.5 num-tabular text-right">{s.quantity ?? 1}</td>
                    <td className="t-td !px-2 !py-1.5 num-tabular text-right">{numeric(rowValue(s, 'unit_price', 'unitPrice')).toFixed(2)}</td>
                    <td className="t-td !px-2 !py-1.5 num-tabular font-semibold text-right">{numeric(rowValue(s, 'total_amount', 'totalAmount')).toFixed(2)}</td>
                    <td className="t-td !px-2 !py-1.5"><span className={`inline-block px-1.5 py-0.5 rounded text-[10.5px] font-semibold ${tone}`}>{pay}</span></td>
                    <td className="t-td !px-2 !py-1.5 text-[10.5px] text-neutral-600">
                      <span className="truncate inline-block" style={{ maxWidth: 90 }}>{parseNames(rep).join(', ') || '-'}</span>
                    </td>
                    <td className="t-td !px-2 !py-1.5 text-[10.5px] text-neutral-600">
                      <span className="truncate inline-block" style={{ maxWidth: 90 }}>{parseNames(mech).join(', ') || '-'}</span>
                    </td>
                    <td className="t-td !px-2 !py-1.5 capitalize text-[10.5px]">{s.status ?? '-'}</td>
                    {canEditLedger && (
                      <td className="t-td !px-2 !py-1.5 text-right">
                        <button
                          type="button"
                          className="inline-grid place-items-center w-7 h-7 rounded-md text-neutral-500 hover:bg-brand-50 hover:text-brand-600"
                          title="Edit logged sale"
                          aria-label="Edit logged sale"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedId(id);
                            setEditing(s);
                          }}
                        >
                          <Pencil size={13} />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {items.length > 500 && (
          <div className="px-3 py-2 text-xs text-neutral-500 text-center border-t border-line">
            Showing first 500 of {items.length} rows. Refine filters or export CSV for all rows.
          </div>
        )}
      </div>

      <EditSaleModal
        sale={editing}
        open={editing !== null}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          utils.sales.list.invalidate();
        }}
      />
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'brand' }) {
  return (
    <article className="card-feature !p-3 flex flex-col gap-1 min-w-0">
      <span className="kpi-label">{label}</span>
      <div className={`kpi-value num-tabular ${tone === 'brand' ? 'text-brand-500' : 'text-black'}`}>{value}</div>
      {sub && <span className="text-[11.5px] text-neutral-500 truncate">{sub}</span>}
    </article>
  );
}

function EditSaleModal({
  open,
  sale,
  onClose,
  onSaved,
}: {
  open: boolean;
  sale: any | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [syncedId, setSyncedId] = useState<number | null>(null);
  const [transactionDate, setTransactionDate] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerContact, setCustomerContact] = useState('');
  const [channel, setChannel] = useState(CHANNELS[0]);
  const [vehicle, setVehicle] = useState('');
  const [partService, setPartService] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState(PAYMENT_METHODS[0]);
  const [receiptNo, setReceiptNo] = useState('');
  const [salesRep, setSalesRep] = useState('');
  const [mechanic, setMechanic] = useState('');
  const [status, setStatus] = useState(STATUSES[0]);
  const [workmanshipFee, setWorkmanshipFee] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const update = trpc.sales.update.useMutation({
    onSuccess: (result: any) => {
      if (result?.success === false) {
        setError(result.error ?? 'Could not save this sale.');
        return;
      }
      onSaved();
    },
    onError: (err) => setError(err.message),
  });

  if (sale && sale.id !== syncedId) {
    setSyncedId(Number(sale.id));
    setTransactionDate(toDateOnly(rowValue(sale, 'transaction_date', 'transactionDate')));
    setCustomerName(rowValue(sale, 'customer_name', 'customerName') ?? '');
    setCustomerContact(rowValue(sale, 'customer_contact', 'customerContact') ?? '');
    setChannel(sale.channel ?? CHANNELS[0]);
    setVehicle(sale.vehicle ?? '');
    setPartService(rowValue(sale, 'part_service', 'partService') ?? '');
    setQuantity(sale.quantity == null ? '' : String(sale.quantity));
    setUnitPrice(rowValue(sale, 'unit_price', 'unitPrice') == null ? '' : String(rowValue(sale, 'unit_price', 'unitPrice')));
    setTotalAmount(rowValue(sale, 'total_amount', 'totalAmount') == null ? '' : String(rowValue(sale, 'total_amount', 'totalAmount')));
    setPaymentMethod(rowValue(sale, 'payment_method', 'paymentMethod') ?? PAYMENT_METHODS[0]);
    setReceiptNo(rowValue(sale, 'receipt_no', 'receiptNo') ?? '');
    setSalesRep(rowValue(sale, 'sales_rep', 'salesRep') ?? '');
    setMechanic(sale.mechanic ?? '');
    setStatus(sale.status ?? STATUSES[0]);
    setWorkmanshipFee(rowValue(sale, 'workmanship_fee', 'workmanshipFee') == null ? '' : String(rowValue(sale, 'workmanship_fee', 'workmanshipFee')));
    setNotes(sale.notes ?? '');
    setError(null);
  } else if (!sale && syncedId !== null) {
    setSyncedId(null);
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!sale?.id) return setError('Missing sale id.');
    if (!transactionDate) return setError('Date is required.');
    if (!partService.trim()) return setError('Item / service is required.');
    if (!totalAmount.trim()) return setError('Total amount is required.');

    const qty = parseOptionalNumber(quantity);
    const unit = parseOptionalNumber(unitPrice);
    const total = parseRequiredNumber(totalAmount);
    const workmanship = parseOptionalNumber(workmanshipFee);

    update.mutate({
      id: Number(sale.id),
      transactionDate: new Date(`${transactionDate}T12:00:00Z`),
      customerName: blankToNull(customerName),
      customerContact: blankToNull(customerContact),
      channel,
      vehicle: blankToNull(vehicle),
      partService: partService.trim(),
      quantity: qty,
      unitPrice: unit,
      totalAmount: total,
      paymentMethod,
      receiptNo: blankToNull(receiptNo),
      salesRep: blankToNull(salesRep),
      mechanic: blankToNull(mechanic),
      status,
      workmanshipFee: workmanship,
      notes: blankToNull(notes),
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow="Edit Sale"
      title={sale ? `Sale #${sale.id}` : 'Edit Sale'}
      icon={FileText}
      width={780}
      footer={
        <>
          <button type="button" className="btn-outline text-xs" onClick={onClose} disabled={update.isLoading}>Cancel</button>
          <button type="submit" form="edit-sale-form" className="btn-primary text-xs" disabled={update.isLoading}>
            {update.isLoading ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />} Save changes
          </button>
        </>
      }
    >
      <form id="edit-sale-form" onSubmit={onSubmit} className="grid grid-cols-2 gap-3">
        <FormField label="Date" required>
          <input type="date" className="field-input" value={transactionDate} onChange={(e) => setTransactionDate(e.target.value)} required />
        </FormField>
        <FormField label="Channel" required>
          <select className="field-input" value={channel} onChange={(e) => setChannel(e.target.value)}>
            {CHANNELS.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </FormField>
        <FormField label="Customer">
          <input className="field-input" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
        </FormField>
        <FormField label="Contact">
          <input className="field-input" value={customerContact} onChange={(e) => setCustomerContact(e.target.value)} />
        </FormField>
        <FormField label="Vehicle">
          <input className="field-input" value={vehicle} onChange={(e) => setVehicle(e.target.value)} />
        </FormField>
        <FormField label="Receipt #">
          <input className="field-input" value={receiptNo} onChange={(e) => setReceiptNo(e.target.value)} />
        </FormField>
        <FormField label="Item / Service" required span={2}>
          <textarea className="field-input" rows={2} value={partService} onChange={(e) => setPartService(e.target.value)} required />
        </FormField>
        <FormField label="Quantity">
          <input type="number" step="0.01" className="field-input num" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </FormField>
        <FormField label="Unit price (GHS)">
          <input type="number" step="0.01" min="0" className="field-input num" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} />
        </FormField>
        <FormField label="Total amount (GHS)" required>
          <input type="number" step="0.01" min="0" className="field-input num" value={totalAmount} onChange={(e) => setTotalAmount(e.target.value)} required />
        </FormField>
        <FormField label="Payment method" required>
          <select className="field-input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
            {PAYMENT_METHODS.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </FormField>
        <FormField label="Sales rep">
          <input className="field-input" value={salesRep} onChange={(e) => setSalesRep(e.target.value)} />
        </FormField>
        <FormField label="Mechanic">
          <input className="field-input" value={mechanic} onChange={(e) => setMechanic(e.target.value)} />
        </FormField>
        <FormField label="Status" required>
          <select className="field-input" value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((option) => <option key={option} value={option}>{option}</option>)}
          </select>
        </FormField>
        <FormField label="Workmanship fee">
          <input type="number" step="0.01" min="0" className="field-input num" value={workmanshipFee} onChange={(e) => setWorkmanshipFee(e.target.value)} />
        </FormField>
        <FormField label="Notes" span={2}>
          <textarea className="field-input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </FormField>
        {error && (
          <div className="col-span-2 rounded-lg px-3 py-2 text-xs text-brand-500 bg-brand-50 ring-1 ring-brand-200 flex items-center gap-1.5">
            <AlertTriangle size={12} /> {error}
          </div>
        )}
      </form>
    </Modal>
  );
}
