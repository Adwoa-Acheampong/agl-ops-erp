import { FormEvent, useMemo, useState } from 'react';
import { Receipt, Plus, Loader2, Search, X, Download } from 'lucide-react';
import { PageShell } from '../components/layout/PageShell';
import { Modal, FormField } from '../components/ui';
import { trpc } from '../lib/trpc';

/**
 * P24.3 — Expense ledger backed by the legacy `expenses` table.
 * Lists every expense imported from the master spreadsheet plus any added
 * post-import. Category filter + search + new-expense modal.
 */

function fmtGhs(v: any) {
  const n = parseFloat(String(v ?? '0')) || 0;
  return `GHS ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function isoDate(v: any) {
  if (!v) return '—';
  try { return new Date(v).toLocaleDateString(); } catch { return String(v); }
}

export function ExpensesPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [open, setOpen] = useState(false);
  const list = trpc.expenses.list.useQuery({});
  const all: any[] = Array.isArray(list.data) ? list.data : [];

  const items = useMemo(() => {
    return all.filter((e: any) => {
      if (category !== 'all' && e.category !== category) return false;
      if (search.trim()) {
        const hay = `${e.description ?? ''} ${e.vendor ?? ''} ${e.category ?? ''}`.toLowerCase();
        if (!hay.includes(search.trim().toLowerCase())) return false;
      }
      return true;
    });
  }, [all, search, category]);

  const total = useMemo(() => items.reduce((s, e: any) => s + (parseFloat(String(e.amount ?? '0')) || 0), 0), [items]);
  const categories = Array.from(new Set(all.map((e: any) => e.category).filter(Boolean))) as string[];

  return (
    <PageShell
      eyebrow="Finance"
      title="Expenses"
      intro="Every cost on the books — fuel, parts, vendor payouts, salaries reimbursement, anything outflow."
      actions={
        <button className="btn-primary text-sm" onClick={() => setOpen(true)}>
          <Plus size={14} /> Log Expense
        </button>
      }
    >
      <section className="grid grid-cols-2 md:grid-cols-3 gap-2">
        <Tile label="Entries" value={String(items.length)} sub={items.length === all.length ? 'all' : `of ${all.length}`} />
        <Tile label="Total outflow" value={fmtGhs(total)} tone="warning" />
        <Tile label="Categories" value={String(categories.length)} />
      </section>

      <div className="flex flex-wrap items-center gap-2 my-2">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-700 pointer-events-none" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} type="search"
            placeholder="Search description, vendor, category…"
            className="w-full rounded-lg bg-white pl-7 pr-7 py-1.5 text-sm" style={{ border: '1px solid rgba(26,22,18,0.12)' }} />
          {search && <button type="button" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-700"><X size={12}/></button>}
        </div>
        <select value={category} onChange={(e) => setCategory(e.target.value)} className="rounded-lg bg-white px-2 py-1.5 text-sm" style={{ border: '1px solid rgba(26,22,18,0.12)' }}>
          <option value="all">All categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid rgba(26,22,18,0.06)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="w-full">
            <thead><tr>
              <th className="t-th">Date</th>
              <th className="t-th">Category</th>
              <th className="t-th">Description</th>
              <th className="t-th">Vendor</th>
              <th className="t-th">Method</th>
              <th className="t-th">Amount</th>
              <th className="t-th">Approved By</th>
            </tr></thead>
            <tbody>
              {list.isLoading && (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-sm"><Loader2 size={14} className="inline animate-spin mr-1"/> Loading…</td></tr>
              )}
              {!list.isLoading && items.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-sm text-ink-700">No matching expenses.</td></tr>
              )}
              {items.map((e: any) => (
                <tr key={e.id}>
                  <td className="t-td">{isoDate(e.expense_date ?? e.expenseDate)}</td>
                  <td className="t-td">{e.category}</td>
                  <td className="t-td">{e.description}</td>
                  <td className="t-td">{e.vendor ?? '—'}</td>
                  <td className="t-td">{e.payment_method ?? e.paymentMethod ?? '—'}</td>
                  <td className="t-td num font-semibold">{fmtGhs(e.amount)}</td>
                  <td className="t-td">{e.approved_by ?? e.approvedBy ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <NewExpenseModal open={open} onClose={() => setOpen(false)} />
    </PageShell>
  );
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'warning' | 'neutral' }) {
  const color = tone === 'warning' ? 'text-warning' : 'text-ink-900';
  return (
    <article className="bg-white rounded-xl p-3" style={{ border: '1px solid rgba(26,22,18,0.06)' }}>
      <span className="font-sans text-2xs font-semibold uppercase text-ink-700" style={{ letterSpacing: '0.08em' }}>{label}</span>
      <div className={`font-sans num leading-none ${color}`} style={{ fontSize: 22, fontWeight: 600 }}>{value}</div>
      {sub && <span className="font-sans text-2xs text-ink-700">{sub}</span>}
    </article>
  );
}

function NewExpenseModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const utils = trpc.useUtils();
  const create = trpc.expenses.create.useMutation({
    onSuccess: () => { utils.expenses.list.invalidate(); onClose(); reset(); },
  });
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState('Operational Supplies');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [vendor, setVendor] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  // W3 — AGL daily reports split outflows by source:
  //   Petty Cash → not deducted from gross sales
  //   Sales Cash → deducted from gross sales (depletes till)
  //   Bank / MoMo → settlement channels, not deducted from cash
  const [cashSource, setCashSource] = useState<'petty_cash'|'sales_cash'|'bank'|'momo'|'other'>('petty_cash');
  const [deductedFromSales, setDeductedFromSales] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setDescription(''); setAmount(''); setVendor(''); setError(null);
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const amt = parseFloat(amount);
    if (!description.trim()) { setError('Description is required.'); return; }
    if (!Number.isFinite(amt) || amt <= 0) { setError('Amount must be greater than 0.'); return; }
    create.mutate({
      expenseDate: new Date(date),
      category,
      description: description.trim(),
      amount: amt,
      vendor: vendor.trim() || undefined,
      paymentMethod,
      cashSource,
      deductedFromSales,
    } as any);
  }

  if (!open) return null;
  return (
    <Modal open={open} onClose={onClose} title="Log Expense" icon={Receipt}>
      <form onSubmit={submit} className="grid gap-2">
        <div className="grid md:grid-cols-2 gap-2">
          <FormField label="Date" required render={(id) => (
            <input id={id} type="date" className="field-input" value={date} onChange={(e) => setDate(e.target.value)} />
          )} />
          <FormField label="Category" required render={(id) => (
            <input id={id} className="field-input" value={category} onChange={(e) => setCategory(e.target.value)} />
          )} />
        </div>
        <FormField label="Description" required render={(id) => (
          <input id={id} className="field-input" value={description} onChange={(e) => setDescription(e.target.value)} />
        )} />
        <div className="grid md:grid-cols-3 gap-2">
          <FormField label="Amount (GHS)" required render={(id) => (
            <input id={id} type="number" step="0.01" className="field-input" value={amount} onChange={(e) => setAmount(e.target.value)} />
          )} />
          <FormField label="Vendor" render={(id) => (
            <input id={id} className="field-input" value={vendor} onChange={(e) => setVendor(e.target.value)} />
          )} />
          <FormField label="Method" render={(id) => (
            <select id={id} className="field-input" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
              <option value="Cash">Cash</option>
              <option value="MoMo">MoMo</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="POS">POS</option>
            </select>
          )} />
        </div>
        <div className="grid md:grid-cols-2 gap-2 pt-1 mt-1 border-t border-line">
          <FormField label="Cash source" render={(id) => (
            <select id={id} className="field-input" value={cashSource} onChange={(e) => {
              const v = e.target.value as typeof cashSource;
              setCashSource(v);
              // Match AGL convention: Sales Cash is deducted, Petty Cash is not.
              setDeductedFromSales(v === 'sales_cash');
            }}>
              <option value="petty_cash">Petty Cash (NOT deducted from sales)</option>
              <option value="sales_cash">Sales Cash (deducted from sales)</option>
              <option value="bank">Bank account</option>
              <option value="momo">MoMo wallet</option>
              <option value="other">Other</option>
            </select>
          )} />
          <label className="flex items-end gap-2 pb-1">
            <input
              type="checkbox"
              className="accent-brand-500 mb-2"
              checked={deductedFromSales}
              onChange={(e) => setDeductedFromSales(e.target.checked)}
            />
            <span className="text-xs text-neutral-700 mb-1.5">Deduct from gross sales in daily report</span>
          </label>
        </div>
        {error && <p className="field-error">{error}</p>}
        <div className="flex gap-2 justify-end">
          <button type="button" className="btn-outline text-sm" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary text-sm" disabled={create.isLoading}>
            {create.isLoading ? <Loader2 size={14} className="animate-spin"/> : 'Log Expense'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
