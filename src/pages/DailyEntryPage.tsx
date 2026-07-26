import { useState, FormEvent, useMemo } from 'react';
import { ClipboardList, Plus, Loader2, Flag, Trash2 } from 'lucide-react';
import { trpc } from '../lib/trpc';
import { ghs } from '../lib/ghanaTax';

const CATEGORIES: { value: string; label: string }[] = [
  { value: 'opening',             label: 'Opening' },
  { value: 'cash_reconciliation', label: 'Cash reconciliation' },
  { value: 'sales_summary',       label: 'Sales summary' },
  { value: 'inventory_check',     label: 'Inventory check' },
  { value: 'closing',             label: 'Closing' },
  { value: 'handover',            label: 'Handover' },
  { value: 'other',               label: 'Other' },
];

/**
 * Daily Entry — chronological log of operational events not captured by
 * the transactional tables. Ports the "DailyEntry" sheet that existed in
 * the wizardly-dhawan tree, rebuilt against tRPC + the new schema.
 */
export function DailyEntryPage() {
  const [category, setCategory] = useState<string>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const utils = trpc.useUtils();

  const q = trpc.dailyEntry.list.useQuery({ category }, { keepPreviousData: true });
  // Imported workshop-job rows live in Data Archives now (see
  // DataArchivesPage). Filter them out here so Daily Entry only ever
  // shows what its name implies: live operational logs.
  const rows: any[] = (q.data?.success ? q.data.entries ?? [] : [])
    .filter((r: any) => (r.loggedBy ?? '').toLowerCase() !== 'imported');
  const err = q.data?.success === false ? q.data.error : q.error?.message;

  const totals = useMemo(() => {
    const flagged = rows.filter(r => r.flagged).length;
    const amount = rows.reduce((s, r) => s + Number(r.amountGhs ?? 0), 0);
    return { count: rows.length, flagged, amount };
  }, [rows]);

  const del = trpc.dailyEntry.delete.useMutation({
    onSuccess: () => utils.dailyEntry.list.invalidate(),
  });

  return (
    <div className="max-w-7xl">
      <header className="flex items-end justify-between gap-3 flex-wrap mb-4">
        <div>
          <h1 className="h-section flex items-center gap-2"><ClipboardList size={20} /> Daily Entry</h1>
          <p className="mt-1 text-neutral-600 text-sm">Daily operational log — opening, closing, cash reconciliation, handovers.</p>
        </div>
        <button className="btn-primary text-sm" onClick={() => setModalOpen(true)}><Plus size={14} /> New entry</button>
      </header>

      <section className="grid grid-cols-3 gap-3 mb-4">
        <Kpi label="Entries"  value={String(totals.count)} />
        <Kpi label="Flagged"  value={String(totals.flagged)} tone={totals.flagged > 0 ? 'brand' : 'ink'} />
        <Kpi label="Logged value" value={ghs(totals.amount)} />
      </section>

      <nav className="flex items-center gap-1 mb-3 bg-white border border-line rounded-2xl p-1 w-fit overflow-x-auto">
        <button onClick={() => setCategory('all')}
                className={`px-3 py-1.5 rounded-xl text-sm font-semibold transition-colors ${category === 'all' ? 'bg-brand-500 text-white' : 'text-neutral-600 hover:bg-canvas'}`}>All</button>
        {CATEGORIES.map((c) => (
          <button key={c.value} onClick={() => setCategory(c.value)}
                  className={`px-3 py-1.5 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap ${category === c.value ? 'bg-brand-500 text-white' : 'text-neutral-600 hover:bg-canvas'}`}>{c.label}</button>
        ))}
      </nav>

      {err && <div className="rounded-2xl px-4 py-3 mb-3 text-sm bg-brand-50 text-brand-500">{err}</div>}

      <div className="bg-white rounded-2xl border border-line overflow-hidden">
        <div style={{ overflowX: 'auto' }}>
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="t-th">Date</th>
                <th className="t-th">Category</th>
                <th className="t-th">Summary</th>
                <th className="t-th">Logged by</th>
                <th className="t-th">Amount</th>
                <th className="t-th"></th>
              </tr>
            </thead>
            <tbody>
              {q.isLoading && <tr><td colSpan={6} className="px-4 py-6 text-center text-neutral-500"><Loader2 size={14} className="animate-spin inline" /> Loading…</td></tr>}
              {!q.isLoading && rows.length === 0 && <tr><td colSpan={6} className="px-4 py-6 text-center text-neutral-500">Nothing logged yet.</td></tr>}
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="t-td num">{r.entryDate ? new Date(r.entryDate).toLocaleDateString() : '—'}</td>
                  <td className="t-td capitalize">{CATEGORIES.find(c => c.value === r.category)?.label ?? r.category}</td>
                  <td className="t-td">
                    <div className="font-semibold">{r.summary ?? '—'}</div>
                    {r.details && <div className="text-xs text-neutral-500 mt-0.5 line-clamp-2">{r.details}</div>}
                  </td>
                  <td className="t-td">{r.loggedBy ?? '—'}</td>
                  <td className="t-td num font-semibold">{r.amountGhs ? ghs(Number(r.amountGhs)) : '—'}</td>
                  <td className="t-td">
                    {r.flagged ? <Flag size={14} className="text-brand-500 inline mr-2" /> : null}
                    <button type="button" className="text-neutral-400 hover:text-brand-500" onClick={() => { if (confirm('Delete this entry?')) del.mutate({ id: r.id }); }}>
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && <NewEntryModal onClose={() => setModalOpen(false)} onSaved={() => { setModalOpen(false); utils.dailyEntry.list.invalidate(); }} />}
    </div>
  );
}

function NewEntryModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [entryDate, setEntryDate] = useState(new Date().toISOString().slice(0, 10));
  const [category, setCategory] = useState('other');
  const [loggedBy, setLoggedBy] = useState('');
  const [summary, setSummary] = useState('');
  const [details, setDetails] = useState('');
  const [amount, setAmount] = useState('');
  const [flagged, setFlagged] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mu = trpc.dailyEntry.create.useMutation({
    onSuccess: (d: any) => { if (d?.success === false) setError(d.error); else onSaved(); },
    onError: e => setError(e.message),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    mu.mutate({
      entryDate: new Date(entryDate),
      category: category as any,
      loggedBy: loggedBy.trim() || undefined,
      summary: summary.trim() || undefined,
      details: details.trim() || undefined,
      amountGhs: amount ? parseFloat(amount) : undefined,
      flagged,
    });
  };

  return (
    <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'grid', placeItems: 'center', background: 'rgba(14,10,10,0.42)', padding: 16 }}
         onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form onSubmit={onSubmit} className="bg-white rounded-2xl shadow-pop" style={{ width: '100%', maxWidth: 560, border: '1px solid rgba(26,22,18,0.10)' }}>
        <header className="px-4 py-3 border-b border-line">
          <span className="text-xs font-semibold uppercase tracking-wider text-brand-500">Daily entry</span>
          <h2 className="text-xl font-bold mt-0.5">Log entry</h2>
        </header>
        <div className="px-4 py-3 grid grid-cols-2 gap-3 text-sm">
          <Field label="Date"><input type="date" className="field-input" value={entryDate} onChange={e => setEntryDate(e.target.value)} required /></Field>
          <Field label="Category">
            <select className="field-input" value={category} onChange={e => setCategory(e.target.value)}>
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </Field>
          <Field label="Logged by" col={2}><input className="field-input" value={loggedBy} onChange={e => setLoggedBy(e.target.value)} placeholder="Ops Manager" /></Field>
          <Field label="Summary" col={2}><input className="field-input" value={summary} onChange={e => setSummary(e.target.value)} placeholder="e.g. Opening cash count" required /></Field>
          <Field label="Details" col={2}><textarea rows={3} className="field-input" value={details} onChange={e => setDetails(e.target.value)} placeholder="What happened. What was checked. Anything notable." /></Field>
          <Field label="Amount (GHS)"><input type="number" step="0.01" className="field-input num" value={amount} onChange={e => setAmount(e.target.value)} /></Field>
          <label className="flex items-end gap-2 pb-2">
            <input type="checkbox" checked={flagged} onChange={e => setFlagged(e.target.checked)} className="accent-brand-500 mb-1" />
            <span className="text-xs text-neutral-700">Flag for follow-up</span>
          </label>
          {error && <div className="col-span-2 rounded-xl px-3 py-2 text-brand-500 bg-brand-50">{error}</div>}
        </div>
        <footer className="px-4 py-3 border-t border-line flex items-center justify-end gap-2">
          <button type="button" className="btn-outline text-sm" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary text-sm" disabled={mu.isLoading}>{mu.isLoading ? 'Saving…' : 'Save entry'}</button>
        </footer>
      </form>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: 'brand' | 'ink' }) {
  const colour = tone === 'brand' ? 'text-brand-500' : 'text-ink-900';
  return (
    <article className="card-feature flex flex-col gap-1.5">
      <span className="text-[12.5px] font-bold tracking-[0.14em] text-neutral-500">{label.toUpperCase()}</span>
      <div className={`text-2xl md:text-3xl font-extrabold tracking-tight ${colour}`}>{value}</div>
    </article>
  );
}

function Field({ label, children, col }: { label: string; children: any; col?: 2 }) {
  return (
    <label className="grid gap-1" style={{ gridColumn: col === 2 ? 'span 2 / span 2' : undefined }}>
      <span className="text-xs font-semibold uppercase tracking-wide text-neutral-600">{label}</span>
      {children}
    </label>
  );
}
