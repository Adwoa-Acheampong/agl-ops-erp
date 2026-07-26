import { useMemo, useState } from 'react';
import { Archive, Wrench, Loader2, Search, X, Download } from 'lucide-react';
import { trpc } from '../lib/trpc';
import { exportRowsToCsv } from '../lib/csvExport';
import { DateRangePicker, rangeFor, type RangePreset } from '../components/ui/DateRangePicker';

/**
 * Data Archives — historical records imported from the master Excel
 * sheet (workshop jobs, attendance imports, etc.). Distinct from
 * Daily Entry, which is for live operational logs (opening, closing,
 * cash reconciliation, handovers).
 *
 * Source filter `loggedBy='imported'` isolates imported rows from
 * user-entered ones.
 */

interface Parsed {
  workOrder: string | null;
  vehicle: string | null;
  staffNames: string[];
  service: string | null;
  mechanicCode: string | null;
  status: string | null;
}

function parseDetails(summary: string | null, details: string | null): Parsed {
  const wkMatch = /^WKS:?\s*([\w-]+)/i.exec(String(summary ?? ''));
  const workOrder = wkMatch ? wkMatch[1] : null;
  const text = String(details ?? '');
  // Format: "Vehicle (Staff1 x Staff2) — N. Service · Mechanic: CODE · Status: STATUS"
  const carMatch = /^([^()]+?)\s*\(([^)]+)\)\s*[—-]\s*(.+?)(?:\s*·\s*Mechanic:\s*([^·]+?))?(?:\s*·\s*Status:\s*([^·]+?))?$/i.exec(text);
  if (!carMatch) return { workOrder, vehicle: text || null, staffNames: [], service: null, mechanicCode: null, status: null };
  const [, vehicle, staffBlob, serviceRaw, mechCode, status] = carMatch;
  const staffNames = String(staffBlob).split(/\s*(?:x|×|,|\/|&|\+)\s*/i).map(s => s.trim()).filter(Boolean);
  const service = (serviceRaw ?? '').replace(/^\d+\.\s*/, '').trim();
  return {
    workOrder,
    vehicle: vehicle?.trim() || null,
    staffNames,
    service: service || null,
    mechanicCode: mechCode?.trim() || null,
    status: status?.trim() || null,
  };
}

export function DataArchivesPage() {
  const [search, setSearch]         = useState('');
  const [preset, setPreset]         = useState<RangePreset>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo]     = useState('');
  const range = useMemo(() => rangeFor(preset, customFrom, customTo), [preset, customFrom, customTo]);

  const q = trpc.dailyEntry.list.useQuery({} as any, { keepPreviousData: true });
  const allRows: any[] = q.data?.success ? q.data.entries ?? [] : [];

  // Archive = anything imported. Operator can switch to "user entries"
  // to see the inverse if needed (debug aid).
  const [bucket, setBucket] = useState<'imported' | 'user'>('imported');

  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return allRows.filter((r: any) => {
      const isImported = (r.loggedBy ?? '').toLowerCase() === 'imported';
      if (bucket === 'imported' && !isImported) return false;
      if (bucket === 'user'     &&  isImported) return false;
      const d = r.entryDate ? new Date(r.entryDate) : null;
      if (d) {
        if (d < range.from || d > range.to) return false;
      }
      if (s) {
        const hay = [r.summary, r.details, r.loggedBy, r.category].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(s)) return false;
      }
      return true;
    });
  }, [allRows, bucket, search, range]);

  // Parse imported rows into structured columns.
  const parsed = useMemo(() => rows.map((r: any) => ({
    raw: r,
    date: r.entryDate ? new Date(r.entryDate) : null,
    parsed: parseDetails(r.summary, r.details),
  })), [rows]);

  const totals = useMemo(() => parsed.reduce((acc, p) => {
    const status = (p.parsed.status ?? '').toLowerCase();
    return {
      jobs: acc.jobs + 1,
      completed: acc.completed + (status.includes('complete') ? 1 : 0),
      pending:   acc.pending   + (status && !status.includes('complete') ? 1 : 0),
    };
  }, { jobs: 0, completed: 0, pending: 0 }), [parsed]);

  const onExport = () => {
    exportRowsToCsv('agl-data-archives', parsed, [
      { header: 'Date',          value: (p: any) => p.date ? p.date.toISOString().slice(0, 10) : '' },
      { header: 'Work Order',    value: (p: any) => p.parsed.workOrder ?? '' },
      { header: 'Vehicle',       value: (p: any) => p.parsed.vehicle ?? '' },
      { header: 'Staff',         value: (p: any) => p.parsed.staffNames.join(' x ') },
      { header: 'Service',       value: (p: any) => p.parsed.service ?? '' },
      { header: 'Mechanic code', value: (p: any) => p.parsed.mechanicCode ?? '' },
      { header: 'Status',        value: (p: any) => p.parsed.status ?? '' },
    ]);
  };

  return (
    <div className="max-w-7xl">
      <header className="flex items-end justify-between gap-3 flex-wrap mb-4">
        <div>
          <h1 className="h-section flex items-center gap-2"><Archive size={20}/> Data Archives</h1>
          <p className="mt-1 text-neutral-600 text-sm">
            Imported historical records from the master Excel sheet — workshop jobs, mechanic assignments, and
            other rows the system absorbed during onboarding.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DateRangePicker
            preset={preset} onPresetChange={setPreset}
            customFrom={customFrom} customTo={customTo}
            onCustomFromChange={setCustomFrom} onCustomToChange={setCustomTo}
            presets={['week', 'month', 'quarter', 'year', 'all', 'custom']}
          />
          <button type="button" className="btn-outline text-sm" onClick={onExport} disabled={parsed.length === 0}>
            <Download size={14}/> Export
          </button>
        </div>
      </header>

      <section className="grid grid-cols-3 gap-3 mb-4">
        <Kpi label="Archived records"  value={String(totals.jobs)}     icon={Archive} tone="ink"/>
        <Kpi label="Completed jobs"    value={String(totals.completed)} icon={Wrench} tone="emerald"/>
        <Kpi label="Other status"      value={String(totals.pending)}   icon={Wrench} tone="ink"/>
      </section>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <nav className="inline-flex bg-white border border-line rounded-2xl p-1">
          {(['imported', 'user'] as const).map((b) => (
            <button key={b} type="button" onClick={() => setBucket(b)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                bucket === b ? 'bg-brand-500 text-white' : 'text-neutral-600 hover:bg-canvas'
              }`}>
              {b === 'imported' ? 'Imported (Excel)' : 'User entries'}
            </button>
          ))}
        </nav>
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none"/>
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search vehicle, staff, service, work order…"
            className="w-full field-input text-sm pl-7 pr-7"/>
          {search && <button type="button" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500"><X size={12}/></button>}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-line overflow-hidden">
        <div className="agl-scroll-x" style={{ maxHeight: 'calc(100vh - 320px)' }}>
          <table className="w-full min-w-[960px]">
            <thead><tr>
              <th className="t-th">Date</th>
              <th className="t-th">Work Order</th>
              <th className="t-th">Vehicle</th>
              <th className="t-th">Staff</th>
              <th className="t-th">Service</th>
              <th className="t-th">Mechanic code</th>
              <th className="t-th">Status</th>
            </tr></thead>
            <tbody>
              {q.isLoading && <tr><td colSpan={7} className="px-4 py-6 text-center text-sm text-neutral-500"><Loader2 size={14} className="animate-spin inline mr-1"/> Loading archive…</td></tr>}
              {!q.isLoading && parsed.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-sm text-neutral-500">No archived records match the filter.</td></tr>}
              {parsed.slice(0, 500).map((p, i) => (
                <tr key={p.raw.id ?? i}>
                  <td className="t-td whitespace-nowrap">{p.date ? p.date.toLocaleDateString() : '—'}</td>
                  <td className="t-td num font-semibold">{p.parsed.workOrder ?? '—'}</td>
                  <td className="t-td">{p.parsed.vehicle ?? '—'}</td>
                  <td className="t-td">{p.parsed.staffNames.length > 0 ? p.parsed.staffNames.join(', ') : '—'}</td>
                  <td className="t-td max-w-[30ch] truncate" title={p.parsed.service ?? ''}>{p.parsed.service ?? '—'}</td>
                  <td className="t-td num text-neutral-600">{p.parsed.mechanicCode ?? '—'}</td>
                  <td className="t-td">
                    {p.parsed.status
                      ? <span className={`chip ${p.parsed.status.toLowerCase().includes('complete') ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{p.parsed.status}</span>
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {parsed.length > 500 && (
          <p className="px-3 py-2 text-2xs text-neutral-500">Showing first 500 of {parsed.length}. Tighten filters or export to CSV for the full archive.</p>
        )}
      </div>
    </div>
  );
}

function Kpi({ label, value, icon: Icon, tone }: { label: string; value: string; icon: any; tone: 'ink' | 'emerald' }) {
  const colour = tone === 'emerald' ? 'text-emerald-700' : 'text-ink-900';
  return (
    <article className="card-feature flex flex-col gap-1.5">
      <span className="text-[12.5px] font-bold tracking-[0.14em] text-neutral-500 inline-flex items-center gap-1.5">
        <Icon size={12}/> {label.toUpperCase()}
      </span>
      <div className={`text-xl md:text-2xl font-extrabold tracking-tight ${colour} truncate`} title={value}>{value}</div>
    </article>
  );
}
