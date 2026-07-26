import { useState, useMemo } from 'react';
import { Wrench, Loader2, AlertOctagon, ClipboardList, Wallet, Search, X, Download, Printer } from 'lucide-react';
import { trpc } from '../lib/trpc';
import { ghs } from '../lib/ghanaTax';
import { DateRangePicker, rangeFor, type RangePreset } from '../components/ui/DateRangePicker';
import { exportRowsToCsv } from '../lib/csvExport';

/**
 * Mechanic Tracker — live per-mechanic scoreboard with full filter UI.
 *
 *   • Period drill-through (today / week / month / quarter / year / custom)
 *   • Multi-select mechanic filter (canonical roster pills)
 *   • Search across name + history rows
 *   • Min-jobs threshold to focus on the active half of the roster
 *   • CSV export + Print view (per the shared print primitives)
 */

const ROSTER: ReadonlyArray<string> = ['Chris', 'Kojo', 'Appiah', 'Fatawu'];

export function MechanicTrackerPage() {
  // Period state via the shared DateRangePicker.
  const [preset, setPreset]         = useState<RangePreset>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo]     = useState('');
  const range = useMemo(() => rangeFor(preset, customFrom, customTo), [preset, customFrom, customTo]);

  // Drill-through filters.
  const [picked, setPicked]   = useState<string[]>([]);
  const [search, setSearch]   = useState('');
  const [minJobs, setMinJobs] = useState<number>(0);
  const togglePicked = (n: string) => setPicked(p => p.includes(n) ? p.filter(x => x !== n) : [...p, n]);

  const scoreboardQ = trpc.mechanicTracker.scoreboard.useQuery(
    { startDate: range.from, endDate: range.to } as any,
    { keepPreviousData: true },
  );
  const historyQ = trpc.mechanicTracker.history.useQuery(undefined as any, { keepPreviousData: true });

  const scoreboard: any[] = scoreboardQ.data?.success ? scoreboardQ.data.scoreboard ?? [] : [];
  const history: any[]    = historyQ.data?.success ? historyQ.data.history ?? [] : [];

  const filteredScoreboard = useMemo(() => {
    const s = search.trim().toLowerCase();
    return scoreboard
      .filter((m: any) => picked.length === 0 || picked.includes(m.name))
      .filter((m: any) => !s || String(m.name).toLowerCase().includes(s))
      .filter((m: any) => m.jobsCompleted >= minJobs);
  }, [scoreboard, picked, search, minJobs]);

  const filteredHistory = useMemo(() => {
    const s = search.trim().toLowerCase();
    return history
      .filter((row: any) => picked.length === 0 || picked.includes(row.name))
      .filter((row: any) => !s || String(row.name ?? '').toLowerCase().includes(s));
  }, [history, picked, search]);

  const totals = useMemo(() => filteredScoreboard.reduce((acc, m: any) => ({
    jobs: acc.jobs + m.jobsCompleted, open: acc.open + m.openJobs,
    revenue: acc.revenue + m.revenueGenerated, recalls: acc.recalls + m.recallsAgainst,
  }), { jobs: 0, open: 0, revenue: 0, recalls: 0 }), [filteredScoreboard]);

  const clearAll = () => { setPicked([]); setSearch(''); setMinJobs(0); setPreset('month'); setCustomFrom(''); setCustomTo(''); };
  const hasFilter = picked.length > 0 || !!search.trim() || minJobs > 0 || preset !== 'month';

  const onExport = () => {
    exportRowsToCsv('mechanic-tracker', filteredScoreboard, [
      { header: 'Mechanic',  value: (m: any) => m.name },
      { header: 'Completed', value: (m: any) => m.jobsCompleted },
      { header: 'Open',      value: (m: any) => m.openJobs },
      { header: 'Revenue',   value: (m: any) => Number(m.revenueGenerated).toFixed(2) },
      { header: 'Recalls',   value: (m: any) => m.recallsAgainst },
      { header: 'Avg job',   value: (m: any) => (m.jobsCompleted > 0 ? (m.revenueGenerated / m.jobsCompleted).toFixed(2) : '0.00') },
    ]);
  };

  return (
    <div className="max-w-7xl">
      <header className="flex items-end justify-between gap-3 flex-wrap mb-4">
        <div>
          <h1 className="h-section flex items-center gap-2"><Wrench size={20} /> Mechanic Tracker</h1>
          <p className="mt-1 text-neutral-600 text-sm">Per-mechanic productivity, revenue contribution and recall pressure across {range.label.toLowerCase()}.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DateRangePicker
            preset={preset} onPresetChange={setPreset}
            customFrom={customFrom} customTo={customTo}
            onCustomFromChange={setCustomFrom} onCustomToChange={setCustomTo}
            presets={['today', 'week', 'month', 'quarter', 'year', 'custom']}
          />
          <button type="button" className="btn-outline text-sm" onClick={onExport} disabled={filteredScoreboard.length === 0}>
            <Download size={14}/> Export
          </button>
          <button type="button" className="btn-outline text-sm" onClick={() => window.print()}>
            <Printer size={14}/> Print
          </button>
        </div>
      </header>

      {/* Mechanic pill row + search + min-jobs slider */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="inline-flex items-center gap-1 text-ink-700 font-semibold uppercase tracking-wider" style={{ fontSize: 10 }}>
          <Wrench size={11}/> Mechanics
        </span>
        {ROSTER.map((n) => {
          const on = picked.includes(n);
          return (
            <button key={n} type="button" onClick={() => togglePicked(n)}
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs ring-1 transition-colors ${
                on ? 'bg-amber-500 text-white ring-amber-600' : 'bg-white text-ink-900 ring-neutral-200 hover:bg-amber-50 hover:ring-amber-200'
              }`}>
              {n}
            </button>
          );
        })}
        {picked.length > 0 && (
          <button type="button" onClick={() => setPicked([])} className="text-xs text-ink-700 hover:text-amber-700 underline underline-offset-2">clear</button>
        )}

        <span className="mx-2 h-4 w-px bg-neutral-200"/>

        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none"/>
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search mechanic…" className="w-full field-input text-sm pl-7 pr-7"/>
          {search && (
            <button type="button" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-500"><X size={12}/></button>
          )}
        </div>

        <label className="inline-flex items-center gap-1.5 text-xs text-neutral-700">
          Min jobs
          <input type="number" min={0} step={1} value={minJobs} onChange={(e) => setMinJobs(Math.max(0, parseInt(e.target.value || '0', 10) || 0))}
            className="field-input text-xs num" style={{ width: 64 }}/>
        </label>

        {hasFilter && (
          <button type="button" onClick={clearAll} className="ml-auto text-xs text-neutral-700 hover:text-brand-500 underline underline-offset-2">
            Clear all filters
          </button>
        )}
      </div>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Kpi label="Jobs completed" value={String(totals.jobs)} icon={ClipboardList} tone="ink" />
        <Kpi label="Open jobs"      value={String(totals.open)} icon={Wrench}        tone="ink" />
        <Kpi label="Revenue"        value={ghs(totals.revenue)} icon={Wallet}        tone="red" />
        <Kpi label="Recalls"        value={String(totals.recalls)} icon={AlertOctagon} tone={totals.recalls > 0 ? 'red' : 'ink'} />
      </section>

      <h2 className="font-semibold mb-2">Scoreboard ({range.from.toLocaleDateString()} → {range.to.toLocaleDateString()})</h2>
      <div className="bg-white rounded-2xl border border-line overflow-hidden mb-5">
        <div className="agl-scroll-x">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr>
                <th className="t-th">Mechanic</th>
                <th className="t-th">Completed</th>
                <th className="t-th">Open</th>
                <th className="t-th">Revenue (GHS)</th>
                <th className="t-th">Recalls</th>
                <th className="t-th">Avg job value</th>
                <th className="t-th">Share of total</th>
              </tr>
            </thead>
            <tbody>
              {scoreboardQ.isLoading && <tr><td colSpan={7} className="px-4 py-6 text-center text-neutral-500"><Loader2 size={14} className="animate-spin inline" /> Loading…</td></tr>}
              {!scoreboardQ.isLoading && filteredScoreboard.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-neutral-500">No mechanics match the active filters.</td></tr>}
              {filteredScoreboard.sort((a: any, b: any) => b.revenueGenerated - a.revenueGenerated).map((m: any) => {
                const avg = m.jobsCompleted > 0 ? m.revenueGenerated / m.jobsCompleted : 0;
                const share = totals.revenue > 0 ? (m.revenueGenerated / totals.revenue) * 100 : 0;
                return (
                  <tr key={m.staffId} className="hover:bg-neutral-50 cursor-pointer" onClick={() => togglePicked(m.name)} title={`Filter to ${m.name}`}>
                    <td className="t-td font-semibold">{m.name}</td>
                    <td className="t-td num">{m.jobsCompleted}</td>
                    <td className="t-td num">{m.openJobs}</td>
                    <td className="t-td num font-semibold">{ghs(m.revenueGenerated)}</td>
                    <td className={`t-td num ${m.recallsAgainst > 0 ? 'text-brand-500 font-semibold' : ''}`}>{m.recallsAgainst}</td>
                    <td className="t-td num text-neutral-600">{ghs(avg)}</td>
                    <td className="t-td num text-neutral-600">{share.toFixed(1)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <h2 className="font-semibold mb-2">History (frozen monthly performance)</h2>
      <div className="bg-white rounded-2xl border border-line overflow-hidden">
        <div className="agl-scroll-x">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr>
                <th className="t-th">Month</th>
                <th className="t-th">Mechanic</th>
                <th className="t-th">Jobs</th>
                <th className="t-th">Avg job time (h)</th>
                <th className="t-th">Rating</th>
                <th className="t-th">Revenue</th>
                <th className="t-th">Deductions</th>
              </tr>
            </thead>
            <tbody>
              {historyQ.isLoading && <tr><td colSpan={7} className="px-4 py-6 text-center text-neutral-500"><Loader2 size={14} className="animate-spin inline" /> Loading…</td></tr>}
              {!historyQ.isLoading && filteredHistory.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-neutral-500">No frozen performance snapshots match this filter.</td></tr>}
              {filteredHistory.map((row: any) => {
                const p = row.perf ?? row;
                return (
                  <tr key={`${row.name}-${p.id ?? p.monthStart ?? Math.random()}`}>
                    <td className="t-td num">{p.monthStart ? new Date(p.monthStart).toLocaleDateString(undefined, { month: 'short', year: 'numeric' }) : '—'}</td>
                    <td className="t-td font-semibold">{row.name}</td>
                    <td className="t-td num">{p.jobsCompleted ?? 0}</td>
                    <td className="t-td num">{p.avgJobTime ? Number(p.avgJobTime).toFixed(2) : '—'}</td>
                    <td className="t-td num">{p.customerRating ? Number(p.customerRating).toFixed(2) : '—'}</td>
                    <td className="t-td num">{p.revenueGenerated ? ghs(Number(p.revenueGenerated)) : '—'}</td>
                    <td className="t-td num text-brand-500">{p.deductionsApplied ? ghs(Number(p.deductionsApplied)) : '—'}</td>
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

function Kpi({ label, value, icon: Icon, tone }: { label: string; value: string; icon: any; tone: 'ink' | 'red' }) {
  return (
    <article className="card-feature flex flex-col gap-1.5">
      <span className="text-[12.5px] font-bold tracking-[0.14em] text-neutral-500 inline-flex items-center gap-1.5">
        <Icon size={12} /> {label.toUpperCase()}
      </span>
      <div className={`text-xl md:text-2xl font-extrabold tracking-tight ${tone === 'red' ? 'text-brand-500' : 'text-ink-900'} truncate`} title={value}>{value}</div>
    </article>
  );
}
