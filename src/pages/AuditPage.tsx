import { useMemo, useState } from 'react';
import { ScrollText, Loader2, Filter, Trash2, Download } from 'lucide-react';
import { PageShell } from '../components/layout/PageShell';
import { trpc } from '../lib/trpc';
import { exportRowsToCsv } from '../lib/csvExport';

/**
 * P10.4 — Audit log viewer.
 *
 * Reads the in-memory `audit` ring (last 500 entries by default). Admin-only
 * server-side. Surfaces actor / action / category / time + meta JSON.
 */

const CATEGORY_TONE: Record<string, string> = {
  auth: 'text-warning',
  mutation: 'text-ink-900',
  access: 'text-ink-700',
};

export function AuditPage() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string>('all');

  const utils = trpc.useUtils();
  const auditQuery = trpc.audit.list.useQuery(
    { limit: 500 },
    { keepPreviousData: true, refetchInterval: 30_000 },
  );
  const entries: any[] = Array.isArray(auditQuery.data) ? auditQuery.data : [];

  const pruneMutation = trpc.audit.prune.useMutation({
    onSuccess: (data) => {
      utils.audit.list.invalidate();
      window.alert(
        data
          ? `Pruned ${data.deleted} entries older than ${new Date(data.cutoff).toLocaleDateString()}.`
          : 'Prune failed.',
      );
    },
    onError: (e) => window.alert(`Prune failed: ${e.message}`),
  });

  const onPrune = () => {
    const days = window.prompt('Keep how many days of audit history? (minimum 7, default 90)', '90');
    if (days === null) return;
    const n = parseInt(days, 10);
    if (Number.isNaN(n) || n < 7) {
      window.alert('Enter a number ≥ 7.');
      return;
    }
    if (!window.confirm(`Permanently delete every audit entry older than ${n} days?`)) return;
    pruneMutation.mutate({ keepDays: n });
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (category !== 'all' && e.category !== category) return false;
      if (!q) return true;
      const blob = `${e.userName ?? ''} ${e.userId ?? ''} ${e.action ?? ''} ${
        e.meta ? JSON.stringify(e.meta) : ''
      }`.toLowerCase();
      return blob.includes(q);
    });
  }, [entries, search, category]);

  const errorMessage = auditQuery.error?.message ?? null;

  return (
    <PageShell
      eyebrow="Administration"
      title="Audit Log"
      intro="Every mutation, every authentication event, every role change. Tagged with actor and time. Last 500 events held in memory; refreshes every 30 seconds."
      actions={
        <>
          <div
            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white"
            style={{ border: '1px solid rgba(26,22,18,0.10)' }}
          >
            <Filter size={12} className="text-ink-700" />
            <select
              className="bg-transparent outline-none font-sans text-xs text-ink-900"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="all">All categories</option>
              <option value="auth">Auth</option>
              <option value="mutation">Mutation</option>
              <option value="access">Access</option>
            </select>
          </div>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter actor / action / meta…"
            className="field-input text-sm"
            style={{ minWidth: 240 }}
          />
          <button
            type="button"
            className="btn-outline text-sm disabled:opacity-50"
            onClick={() => {
              const rows = Array.isArray(entries) ? entries : [];
              exportRowsToCsv('agl-audit', rows, [
                { header: 'Timestamp', value: (e: any) => e.ts ? new Date(e.ts).toISOString() : '' },
                { header: 'User', value: (e: any) => e.userName ?? e.userId ?? '' },
                { header: 'Action', value: (e: any) => e.action ?? '' },
                { header: 'Category', value: (e: any) => e.category ?? '' },
                { header: 'IP', value: (e: any) => e.ip ?? '' },
                { header: 'Meta', value: (e: any) => e.meta ? JSON.stringify(e.meta) : '' },
              ]);
            }}
            disabled={entries.length === 0}
            title="Download the loaded audit slice as CSV"
          >
            <Download size={14} /> Export CSV
          </button>
          <button
            type="button"
            className="btn-outline text-sm disabled:opacity-50"
            onClick={onPrune}
            disabled={pruneMutation.isLoading}
            title="Permanently delete entries older than N days"
          >
            <Trash2 size={14} /> Prune…
          </button>
        </>
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

      <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(26,22,18,0.06)' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="w-full">
            <thead>
              <tr>
                <th className="t-th">When</th>
                <th className="t-th">Actor</th>
                <th className="t-th">Action</th>
                <th className="t-th">Category</th>
                <th className="t-th">Meta</th>
              </tr>
            </thead>
            <tbody>
              {auditQuery.isLoading && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center font-sans text-sm text-ink-700">
                    <span className="inline-flex items-center gap-1.5">
                      <Loader2 size={14} className="animate-spin" /> Loading audit log…
                    </span>
                  </td>
                </tr>
              )}
              {!auditQuery.isLoading && filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center font-sans text-sm text-ink-700">
                    {entries.length === 0 ? (
                      <span className="inline-flex items-center gap-1.5">
                        <ScrollText size={14} /> No events recorded yet.
                      </span>
                    ) : (
                      `No events match the current filter.`
                    )}
                  </td>
                </tr>
              )}
              {filtered.map((e) => (
                <tr key={e.id}>
                  <td className="t-td num">{e.at ? new Date(e.at).toLocaleString() : '—'}</td>
                  <td className="t-td">
                    <div className="font-semibold">{e.userName ?? 'system'}</div>
                    {e.userId && <div className="font-sans text-xs text-ink-700 num">{e.userId}</div>}
                  </td>
                  <td className="t-td font-mono text-xs">{e.action}</td>
                  <td className={`t-td capitalize ${CATEGORY_TONE[e.category] ?? ''}`}>{e.category}</td>
                  <td className="t-td">
                    {e.meta && Object.keys(e.meta).length > 0 ? (
                      <code className="font-mono text-2xs text-ink-700 break-all">
                        {JSON.stringify(e.meta)}
                      </code>
                    ) : (
                      <span className="text-ink-700">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="font-sans text-xs text-ink-700 mt-2">
        Showing {filtered.length} of {entries.length} events.{' '}
        {auditQuery.isFetching && (
          <span className="inline-flex items-center gap-1">
            <Loader2 size={10} className="animate-spin" /> Refreshing…
          </span>
        )}
      </p>
    </PageShell>
  );
}
