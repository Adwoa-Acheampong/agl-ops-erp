import { useState, useMemo, FormEvent } from 'react';
import { CircleDollarSign, Plus, Search, Loader2, Download } from 'lucide-react';
import { trpc } from '../lib/trpc';
import { exportRowsToCsv } from '../lib/csvExport';

type Tab = 'open' | 'overdue' | 'paid' | 'all';

function ghs(n: number) {
  return `GHS ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const STATUS_TONE: Record<string, string> = {
  Pending: 'text-warning',
  'Partially Paid': 'text-warning',
  'Fully Paid': 'text-emerald-700',
  Overdue: 'text-brand-500',
};

const TODAY = () => new Date().toISOString().slice(0, 10);

export function CreditorsPage() {
  const [tab, setTab] = useState<Tab>('open');
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const utils = trpc.useUtils();

  const q = trpc.creditSales.list.useQuery({}, { keepPreviousData: true });
  const rows: any[] = Array.isArray(q.data) ? q.data : [];
  const err = (q.data && (q.data as any).success === false) ? (q.data as any).error : q.error?.message;

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    const today = TODAY();
    return rows.filter(r => {
      const paid = r.status === 'Fully Paid';
      const overdue = !paid && r.dueDate && String(r.dueDate).slice(0, 10) < today;
      if (tab === 'paid' && !paid) return false;
      if (tab === 'open' && paid) return false;
      if (tab === 'overdue' && !overdue) return false;
      if (s) {
        const blob = `${r.customerName ?? ''} ${r.customerContact ?? ''} ${r.notes ?? ''}`.toLowerCase();
        if (!blob.includes(s)) return false;
      }
      return true;
    });
  }, [rows, tab, search]);

  const totals = useMemo(() => {
    const today = TODAY();
    let owed = 0, overdue = 0, paid = 0, count = 0;
    for (const r of rows) {
      const due = Number(r.amountDue ?? 0);
      const paidAmt = Number(r.amountPaid ?? 0);
      const isPaid = r.status === 'Fully Paid';
      if (!isPaid) {
        owed += due;
        count += 1;
        if (r.dueDate && String(r.dueDate).slice(0, 10) < today) overdue += due;
      }
      paid += paidAmt;
    }
    return { owed, overdue, paid, count };
  }, [rows]);

  return (
    <div className="max-w-7xl">
      <header className="flex items-end justify-between gap-3 flex-wrap mb-4">
        <div>
          <h1 className="h-section flex items-center gap-2"><CircleDollarSign size={20} /> Creditors</h1>
          <p className="mt-1 text-neutral-600 text-sm">Credit sales and outstanding receivables.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-line">
            <Search size={14} className="text-neutral-500" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name / contact"
              className="bg-transparent outline-none text-sm placeholder:text-neutral-400"
              style={{ minWidth: 220 }}
            />
          </div>
          <button
            type="button"
            className="btn-outline text-sm disabled:opacity-50"
            disabled={filtered.length === 0}
            onClick={() => exportRowsToCsv('agl-creditors', filtered, [
              { header: 'ID',           value: (r: any) => r.id },
              { header: 'Customer',     value: (r: any) => r.customerName ?? '' },
              { header: 'Contact',      value: (r: any) => r.customerContact ?? '' },
              { header: 'Total',        value: (r: any) => Number(r.totalAmount ?? 0).toFixed(2) },
              { header: 'Paid',         value: (r: any) => Number(r.amountPaid ?? 0).toFixed(2) },
              { header: 'Due',          value: (r: any) => Number(r.amountDue ?? 0).toFixed(2) },
              { header: 'Sale date',    value: (r: any) => r.saleDate ? String(r.saleDate).slice(0, 10) : '' },
              { header: 'Due date',     value: (r: any) => r.dueDate ? String(r.dueDate).slice(0, 10) : '' },
              { header: 'Status',       value: (r: any) => r.status ?? '' },
              { header: 'Notes',        value: (r: any) => r.notes ?? '' },
            ])}
          >
            <Download size={14} /> CSV
          </button>
          <button className="btn-primary text-sm" onClick={() => setAddOpen(true)}>
            <Plus size={14} /> Record Credit Sale
          </button>
        </div>
      </header>

      {err && <div className="rounded-2xl px-4 py-3 mb-3 text-sm bg-brand-50 text-brand-500">{err}</div>}

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Kpi label="Outstanding"  value={ghs(totals.owed)}    note={`${totals.count} accounts`} />
        <Kpi label="Overdue"      value={ghs(totals.overdue)} tone="red" />
        <Kpi label="Collected"    value={ghs(totals.paid)}    tone="emerald" />
        <Kpi label="Total rows"   value={String(rows.length)} />
      </section>

      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {(['open', 'overdue', 'paid', 'all'] as Tab[]).map(t => (
          <button
            key={t}
            type="button"
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors capitalize ${
              tab === t ? 'bg-brand-500 text-white' : 'bg-white border border-line text-neutral-700 hover:bg-canvas'
            }`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl overflow-hidden border border-line">
        <div style={{ overflowX: 'auto' }}>
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="t-th">Customer</th>
                <th className="t-th">Contact</th>
                <th className="t-th">Total</th>
                <th className="t-th">Paid</th>
                <th className="t-th">Due</th>
                <th className="t-th">Sale date</th>
                <th className="t-th">Due date</th>
                <th className="t-th">Status</th>
              </tr>
            </thead>
            <tbody>
              {q.isLoading && <tr><td colSpan={8} className="px-4 py-6 text-center text-neutral-500"><Loader2 size={14} className="animate-spin inline" /> Loading…</td></tr>}
              {!q.isLoading && filtered.length === 0 && <tr><td colSpan={8} className="px-4 py-6 text-center text-neutral-500">No creditors match this filter.</td></tr>}
              {!q.isLoading && filtered.map(r => (
                <tr key={r.id}>
                  <td className="t-td font-semibold">{r.customerName ?? '—'}</td>
                  <td className="t-td num">{r.customerContact ?? '—'}</td>
                  <td className="t-td num">{ghs(Number(r.totalAmount ?? 0))}</td>
                  <td className="t-td num text-emerald-700">{ghs(Number(r.amountPaid ?? 0))}</td>
                  <td className="t-td num font-semibold">{ghs(Number(r.amountDue ?? 0))}</td>
                  <td className="t-td num text-neutral-600">{r.saleDate ? String(r.saleDate).slice(0, 10) : '—'}</td>
                  <td className="t-td num text-neutral-600">{r.dueDate ? String(r.dueDate).slice(0, 10) : '—'}</td>
                  <td className={`t-td ${STATUS_TONE[r.status] ?? ''}`}>{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {addOpen && (
        <RecordCreditModal
          onClose={() => setAddOpen(false)}
          onSaved={() => { setAddOpen(false); utils.creditSales.list.invalidate(); }}
        />
      )}
    </div>
  );
}

function Kpi({ label, value, note, tone }: { label: string; value: string; note?: string; tone?: 'red' | 'emerald' }) {
  const cls = tone === 'red' ? 'text-brand-500' : tone === 'emerald' ? 'text-emerald-700' : 'text-black';
  return (
    <article className="card-feature flex flex-col gap-1.5">
      <span className="text-[12.5px] font-bold tracking-[0.14em] text-neutral-500">{label.toUpperCase()}</span>
      <div className={`text-2xl md:text-3xl font-extrabold tracking-tight ${cls}`}>{value}</div>
      {note && <span className="text-xs text-neutral-500">{note}</span>}
    </article>
  );
}

function RecordCreditModal({
  onClose, onSaved,
}: { onClose: () => void; onSaved: () => void }) {
  const [customerName, setCustomerName] = useState('');
  const [customerContact, setCustomerContact] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [amountPaid, setAmountPaid] = useState('0');
  const [saleDate, setSaleDate] = useState(() => TODAY());
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mu = trpc.creditSales.create.useMutation({
    onSuccess: (d: any) => { if (d?.success === false) setError(d.error); else onSaved(); },
    onError: e => setError(e.message),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const total = parseFloat(totalAmount);
    const paid = parseFloat(amountPaid);
    if (Number.isNaN(total) || total <= 0) return setError('Total must be > 0.');
    if (Number.isNaN(paid) || paid < 0) return setError('Paid must be ≥ 0.');
    if (paid > total) return setError('Paid amount cannot exceed total.');
    const due = total - paid;
    const status = paid === 0 ? 'Pending' : (paid >= total ? 'Fully Paid' : 'Partially Paid');
    mu.mutate({
      customerName: customerName.trim(),
      customerContact: customerContact.trim() || undefined,
      totalAmount: total,
      amountPaid: paid,
      amountDue: due,
      saleDate: new Date(saleDate),
      dueDate: dueDate ? new Date(dueDate) : undefined,
      status,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <div role="dialog" aria-modal="true"
         style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'grid', placeItems: 'center', background: 'rgba(14,10,10,0.42)', padding: 16 }}
         onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form onSubmit={onSubmit} className="bg-white rounded-2xl shadow-pop" style={{ width: '100%', maxWidth: 520, maxHeight: '90vh', display: 'flex', flexDirection: 'column', border: '1px solid rgba(26,22,18,0.10)' }}>
        <header className="px-4 py-3 border-b border-line">
          <span className="text-xs font-semibold uppercase tracking-wider text-brand-500">New credit sale</span>
          <h2 className="text-xl font-bold mt-0.5">Record Creditor</h2>
        </header>
        <div className="flex-1 overflow-auto px-4 py-3 grid gap-3 text-sm">
          <label className="grid gap-1"><span className="text-xs font-semibold uppercase text-neutral-600">Customer name *</span><input className="field-input" value={customerName} onChange={e=>setCustomerName(e.target.value)} required autoFocus /></label>
          <label className="grid gap-1"><span className="text-xs font-semibold uppercase text-neutral-600">Contact</span><input className="field-input" value={customerContact} onChange={e=>setCustomerContact(e.target.value)} /></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="grid gap-1"><span className="text-xs font-semibold uppercase text-neutral-600">Total amount (GHS) *</span><input type="number" min={0} step="0.01" className="field-input num" value={totalAmount} onChange={e=>setTotalAmount(e.target.value)} required /></label>
            <label className="grid gap-1"><span className="text-xs font-semibold uppercase text-neutral-600">Amount paid (GHS)</span><input type="number" min={0} step="0.01" className="field-input num" value={amountPaid} onChange={e=>setAmountPaid(e.target.value)} /></label>
            <label className="grid gap-1"><span className="text-xs font-semibold uppercase text-neutral-600">Sale date *</span><input type="date" className="field-input" value={saleDate} onChange={e=>setSaleDate(e.target.value)} required /></label>
            <label className="grid gap-1"><span className="text-xs font-semibold uppercase text-neutral-600">Due date</span><input type="date" className="field-input" value={dueDate} onChange={e=>setDueDate(e.target.value)} /></label>
          </div>
          <label className="grid gap-1"><span className="text-xs font-semibold uppercase text-neutral-600">Notes</span><textarea rows={2} className="field-input" value={notes} onChange={e=>setNotes(e.target.value)} /></label>
          {error && <div className="rounded-xl px-3 py-2 text-brand-500 bg-brand-50">{error}</div>}
        </div>
        <footer className="px-4 py-3 border-t border-line flex items-center justify-end gap-2">
          <button type="button" className="btn-outline text-sm" onClick={onClose} disabled={mu.isLoading}>Cancel</button>
          <button type="submit" className="btn-primary text-sm" disabled={mu.isLoading}>
            <CircleDollarSign size={14} /> {mu.isLoading ? 'Saving…' : 'Record'}
          </button>
        </footer>
      </form>
    </div>
  );
}
