import { useState, useMemo } from 'react';
import { Boxes, Loader2, Search, Download, ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { trpc } from '../lib/trpc';
import { exportRowsToCsv } from '../lib/csvExport';

function ghs(n: number) {
  return `GHS ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const KIND_TONE: Record<string, { label: string; cls: string; Icon: any }> = {
  receipt: { label: 'Receipt', cls: 'text-emerald-700 bg-emerald-50', Icon: ArrowDownRight },
  issue:   { label: 'Issue',   cls: 'text-brand-500 bg-brand-50',     Icon: ArrowUpRight },
};

export function InventoryLogPage() {
  const [search, setSearch] = useState('');
  const [kindFilter, setKindFilter] = useState<'all' | 'receipt' | 'issue'>('all');

  const q = trpc.inventory.logEvents.useQuery({ limit: 500 }, { keepPreviousData: true });
  const events: any[] = q.data?.success ? q.data.events ?? [] : [];
  const err = q.data?.success === false ? q.data.error : q.error?.message;

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return events.filter(e => {
      if (kindFilter !== 'all' && e.kind !== kindFilter) return false;
      if (!s) return true;
      const blob = `${e.itemCode ?? ''} ${e.itemName ?? ''} ${e.supplier ?? ''} ${e.context ?? ''}`.toLowerCase();
      return blob.includes(s);
    });
  }, [events, search, kindFilter]);

  const totals = useMemo(() => {
    let inUnits = 0, outUnits = 0, inValue = 0, outValue = 0;
    for (const e of filtered) {
      const v = Number(e.quantity ?? 0) * Number(e.unitPrice ?? 0);
      if (e.kind === 'receipt') { inUnits += Number(e.quantity ?? 0); inValue += v; }
      else { outUnits += Number(e.quantity ?? 0); outValue += v; }
    }
    return { inUnits, outUnits, inValue, outValue };
  }, [filtered]);

  return (
    <div className="max-w-7xl">
      <header className="flex items-end justify-between gap-3 flex-wrap mb-4">
        <div>
          <h1 className="h-section flex items-center gap-2"><Boxes size={20} /> Inventory Log</h1>
          <p className="mt-1 text-neutral-600 text-sm">Stock receipts and issues across every SKU.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-line">
            <Search size={14} className="text-neutral-500" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search SKU / supplier / context"
              className="bg-transparent outline-none text-sm placeholder:text-neutral-400"
              style={{ minWidth: 220 }}
            />
          </div>
          <select
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value as any)}
            className="field-input text-sm"
            style={{ width: 140 }}
          >
            <option value="all">All movements</option>
            <option value="receipt">Receipts only</option>
            <option value="issue">Issues only</option>
          </select>
          <button
            type="button"
            className="btn-outline text-sm disabled:opacity-50"
            disabled={filtered.length === 0}
            onClick={() => exportRowsToCsv('agl-inventory-log', filtered, [
              { header: 'Timestamp', value: (e: any) => e.at ? new Date(e.at).toISOString() : '' },
              { header: 'Kind',      value: (e: any) => e.kind },
              { header: 'Item code', value: (e: any) => e.itemCode ?? '' },
              { header: 'Item',      value: (e: any) => e.itemName ?? '' },
              { header: 'Quantity',  value: (e: any) => e.quantity ?? 0 },
              { header: 'Unit price (GHS)', value: (e: any) => Number(e.unitPrice ?? 0).toFixed(2) },
              { header: 'Line value (GHS)', value: (e: any) => (Number(e.quantity ?? 0) * Number(e.unitPrice ?? 0)).toFixed(2) },
              { header: 'Supplier',  value: (e: any) => e.supplier ?? '' },
              { header: 'Context',   value: (e: any) => e.context ?? '' },
            ])}
          >
            <Download size={14} /> CSV
          </button>
        </div>
      </header>

      {err && <div className="rounded-2xl px-4 py-3 mb-3 text-sm bg-brand-50 text-brand-500">{err}</div>}

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Kpi label="Receipts (units)"  value={String(totals.inUnits)}  tone="emerald" />
        <Kpi label="Receipts (value)"  value={ghs(totals.inValue)}     tone="emerald" />
        <Kpi label="Issues (units)"    value={String(totals.outUnits)} tone="brand" />
        <Kpi label="Issues (value)"    value={ghs(totals.outValue)}    tone="brand" />
      </section>

      <div className="bg-white rounded-2xl overflow-hidden border border-line">
        <div style={{ overflowX: 'auto' }}>
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="t-th">When</th>
                <th className="t-th">Kind</th>
                <th className="t-th">Item</th>
                <th className="t-th">Qty</th>
                <th className="t-th">Unit price</th>
                <th className="t-th">Line value</th>
                <th className="t-th">Context</th>
              </tr>
            </thead>
            <tbody>
              {q.isLoading && <tr><td colSpan={7} className="px-4 py-6 text-center text-neutral-500"><Loader2 size={14} className="animate-spin inline" /> Loading…</td></tr>}
              {!q.isLoading && filtered.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-neutral-500">No movements match the current filter.</td></tr>}
              {!q.isLoading && filtered.map((e: any, i: number) => {
                const meta = KIND_TONE[e.kind] ?? KIND_TONE.issue;
                const Icon = meta.Icon;
                return (
                  <tr key={`${e.kind}-${i}`}>
                    <td className="t-td num text-neutral-600">{e.at ? new Date(e.at).toLocaleString() : '—'}</td>
                    <td className="t-td">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-xs font-semibold ${meta.cls}`}>
                        <Icon size={11} /> {meta.label}
                      </span>
                    </td>
                    <td className="t-td">
                      <div className="font-semibold">{e.itemName ?? '—'}</div>
                      {e.itemCode && <div className="text-xs text-neutral-500 num">{e.itemCode}</div>}
                    </td>
                    <td className="t-td num">{e.quantity ?? 0}</td>
                    <td className="t-td num">{ghs(Number(e.unitPrice ?? 0))}</td>
                    <td className="t-td num font-semibold">{ghs(Number(e.quantity ?? 0) * Number(e.unitPrice ?? 0))}</td>
                    <td className="t-td text-neutral-600">{e.context ?? (e.supplier ?? '—')}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone: 'emerald' | 'brand' }) {
  const colour = tone === 'emerald' ? 'text-emerald-700' : 'text-brand-500';
  return (
    <article className="card-feature flex flex-col gap-1.5">
      <span className="text-[12.5px] font-bold tracking-[0.14em] text-neutral-500">{label.toUpperCase()}</span>
      <div className={`text-2xl md:text-3xl font-extrabold tracking-tight ${colour}`}>{value}</div>
    </article>
  );
}
