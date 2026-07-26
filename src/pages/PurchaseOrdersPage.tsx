import { useMemo, useState } from 'react';
import { ShoppingBag, Loader2, Search, X } from 'lucide-react';
import { PageShell } from '../components/layout/PageShell';
import { trpc } from '../lib/trpc';

/**
 * P24.4 — Purchase Orders ledger backed by `purchase_orders`.
 */

function fmtGhs(v: any) {
  const n = parseFloat(String(v ?? '0')) || 0;
  return `GHS ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function isoDate(v: any) {
  if (!v) return '—';
  try { return new Date(v).toLocaleDateString(); } catch { return String(v); }
}

export function PurchaseOrdersPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<string>('all');
  const list = trpc.purchaseOrders.list.useQuery({});
  const all: any[] = Array.isArray(list.data) ? list.data : [];

  const items = useMemo(() => {
    return all.filter((p: any) => {
      if (status !== 'all' && p.status !== status) return false;
      if (search.trim()) {
        const hay = `${p.po_number ?? p.poNumber ?? ''} ${p.vendor ?? ''} ${p.description ?? ''}`.toLowerCase();
        if (!hay.includes(search.trim().toLowerCase())) return false;
      }
      return true;
    });
  }, [all, search, status]);

  const total = useMemo(() => items.reduce((s, p: any) => s + (parseFloat(String(p.amount ?? '0')) || 0), 0), [items]);

  return (
    <PageShell
      eyebrow="Procurement"
      title="Purchase Orders"
      intro="Goods we've ordered from suppliers — pending, approved, received, or cancelled."
    >
      <section className="grid grid-cols-2 md:grid-cols-3 gap-2">
        <Tile label="POs" value={String(items.length)} sub={items.length === all.length ? 'all' : `of ${all.length}`} />
        <Tile label="Total committed" value={fmtGhs(total)} />
        <Tile label="Received" value={String(items.filter((p: any) => p.status === 'Received').length)} />
      </section>

      <div className="flex flex-wrap items-center gap-2 my-2">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-700 pointer-events-none" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} type="search"
            placeholder="Search PO number, vendor, item…"
            className="w-full rounded-lg bg-white pl-7 pr-7 py-1.5 text-sm" style={{ border: '1px solid rgba(26,22,18,0.12)' }} />
          {search && <button type="button" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-700"><X size={12}/></button>}
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg bg-white px-2 py-1.5 text-sm" style={{ border: '1px solid rgba(26,22,18,0.12)' }}>
          <option value="all">All status</option>
          <option value="Pending">Pending</option>
          <option value="Approved">Approved</option>
          <option value="Received">Received</option>
          <option value="Cancelled">Cancelled</option>
        </select>
      </div>

      <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid rgba(26,22,18,0.06)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="w-full">
            <thead><tr>
              <th className="t-th">PO #</th>
              <th className="t-th">Date</th>
              <th className="t-th">Vendor</th>
              <th className="t-th">Description</th>
              <th className="t-th">Amount</th>
              <th className="t-th">Status</th>
              <th className="t-th">Delivery</th>
            </tr></thead>
            <tbody>
              {list.isLoading && <tr><td colSpan={7} className="px-4 py-6 text-center text-sm"><Loader2 size={14} className="inline animate-spin mr-1"/> Loading…</td></tr>}
              {!list.isLoading && items.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-sm text-ink-700">No matching POs.</td></tr>}
              {items.map((p: any) => (
                <tr key={p.id}>
                  <td className="t-td font-semibold">{p.po_number ?? p.poNumber}</td>
                  <td className="t-td">{isoDate(p.po_date ?? p.poDate)}</td>
                  <td className="t-td">{p.vendor}</td>
                  <td className="t-td">{p.description}</td>
                  <td className="t-td num font-semibold">{fmtGhs(p.amount)}</td>
                  <td className="t-td">{p.status}</td>
                  <td className="t-td">{isoDate(p.delivery_date ?? p.deliveryDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PageShell>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <article className="bg-white rounded-xl p-3" style={{ border: '1px solid rgba(26,22,18,0.06)' }}>
      <span className="font-sans text-2xs font-semibold uppercase text-ink-700" style={{ letterSpacing: '0.08em' }}>{label}</span>
      <div className="font-sans num leading-none text-ink-900" style={{ fontSize: 22, fontWeight: 600 }}>{value}</div>
      {sub && <span className="font-sans text-2xs text-ink-700">{sub}</span>}
    </article>
  );
}
