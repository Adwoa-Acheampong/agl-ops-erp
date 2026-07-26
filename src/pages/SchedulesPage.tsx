import { useState, useMemo, FormEvent } from 'react';
import { CalendarDays, Plus, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { trpc } from '../lib/trpc';
import { DateRangePicker, rangeFor, type RangePreset } from '../components/ui/DateRangePicker';

const STATUS_TONE: Record<string, string> = {
  planned:   'bg-canvas text-neutral-600',
  confirmed: 'bg-emerald-50 text-emerald-700',
  swapped:   'bg-amber-50 text-amber-700',
  cancelled: 'bg-neutral-100 text-neutral-500 line-through',
  no_show:   'bg-brand-50 text-brand-600',
};

/**
 * Schedules — planned shift roster, distinct from `staff_attendance_logs`
 * which records actual clock-in/out. This is the "who is supposed to be
 * here next Tuesday" view, ported from the wizardly-dhawan Schedules page.
 */
export function SchedulesPage() {
  // WS6-B: Day / Week / Month presets plus a Custom range with two date
  // pickers. The traditional week-stepper still works in "week" mode for
  // continuity with the prior nav pattern.
  const [preset, setPreset]         = useState<RangePreset>('week');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo]     = useState('');
  const [weekOffset, setWeekOffset] = useState(0);

  const { weekStart, weekEnd } = useMemo(() => {
    if (preset === 'week') {
      const d = new Date(); d.setHours(0, 0, 0, 0);
      const dow = d.getDay() || 7;
      d.setDate(d.getDate() - (dow - 1) + weekOffset * 7);
      const end = new Date(d); end.setDate(d.getDate() + 7);
      return { weekStart: d, weekEnd: end };
    }
    const r = rangeFor(preset === 'today' ? 'today' : preset, customFrom, customTo);
    return { weekStart: r.from, weekEnd: new Date(r.to.getTime() + 1) };
  }, [preset, weekOffset, customFrom, customTo]);

  const staffQ = trpc.staffManagement.list.useQuery({ status: 'active' });
  const staffList: any[] = staffQ.data?.success ? staffQ.data.staff ?? [] : [];

  const schedQ = trpc.schedule.list.useQuery({ startDate: weekStart, endDate: weekEnd }, { keepPreviousData: true });
  const schedules: any[] = schedQ.data?.success ? schedQ.data.schedules ?? [] : [];

  const [modalOpen, setModalOpen] = useState(false);
  const [seedDate, setSeedDate] = useState<string | null>(null);
  const utils = trpc.useUtils();
  const updateMu = trpc.schedule.update.useMutation({ onSuccess: () => utils.schedule.list.invalidate() });

  // Days rendered depend on the active preset: week → 7 days, day → 1,
  // month / custom → at most 31 (cap to keep the grid readable).
  const days = useMemo(() => {
    const out: Date[] = [];
    const cur = new Date(weekStart); cur.setHours(0, 0, 0, 0);
    const end = new Date(weekEnd);
    let i = 0;
    while (cur < end && i < 31) { out.push(new Date(cur)); cur.setDate(cur.getDate() + 1); i += 1; }
    return out.length === 0 ? [new Date(weekStart)] : out;
  }, [weekStart, weekEnd]);

  // Group by day key.
  const byDay = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const d of days) m.set(d.toISOString().slice(0, 10), []);
    for (const row of schedules) {
      const k = (row.schedule?.shiftDate ?? row.shiftDate);
      const dateKey = new Date(k).toISOString().slice(0, 10);
      if (m.has(dateKey)) m.get(dateKey)!.push(row);
    }
    return m;
  }, [schedules, days.map(d => d.toISOString()).join('|')]);

  return (
    <div className="max-w-7xl">
      <header className="flex items-end justify-between gap-3 flex-wrap mb-4">
        <div>
          <h1 className="h-section flex items-center gap-2"><CalendarDays size={20} /> Schedules</h1>
          <p className="mt-1 text-neutral-600 text-sm">Planned shifts for the active workforce. Clock-In page records actual attendance.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <DateRangePicker
            preset={preset}
            onPresetChange={(p) => { setPreset(p); if (p === 'week') setWeekOffset(0); }}
            customFrom={customFrom}
            customTo={customTo}
            onCustomFromChange={setCustomFrom}
            onCustomToChange={setCustomTo}
            presets={['today','week','month','custom']}
          />
          {preset === 'week' && (
            <span className="inline-flex items-center gap-2 ml-2">
              <button type="button" className="p-1.5 rounded-lg bg-white border border-line hover:bg-canvas" onClick={() => setWeekOffset(w => w - 1)} title="Previous week"><ChevronLeft size={14} /></button>
              <span className="text-sm font-semibold num">{weekStart.toLocaleDateString()} – {new Date(weekEnd.getTime() - 86_400_000).toLocaleDateString()}</span>
              <button type="button" className="p-1.5 rounded-lg bg-white border border-line hover:bg-canvas" onClick={() => setWeekOffset(w => w + 1)} title="Next week"><ChevronRight size={14} /></button>
              <button type="button" className="text-xs text-neutral-500 hover:text-black ml-1" onClick={() => setWeekOffset(0)}>Today</button>
            </span>
          )}
          <button className="btn-primary text-sm ml-2" onClick={() => { setSeedDate(null); setModalOpen(true); }}><Plus size={14} /> Add shift</button>
        </div>
      </header>

      {schedQ.isLoading && <div className="text-center py-4 text-neutral-500"><Loader2 size={14} className="animate-spin inline" /> Loading…</div>}

      <div className="bg-white rounded-2xl border border-line overflow-hidden">
        <div className="grid border-b border-line" style={{ gridTemplateColumns: `repeat(${Math.min(days.length, 7)}, minmax(0, 1fr))` }}>
          {days.map((d) => {
            const isToday = d.toDateString() === new Date().toDateString();
            return (
              <div key={d.toISOString()} className={`p-2 text-center border-r border-line last:border-r-0 ${isToday ? 'bg-brand-50' : ''}`}>
                <div className="text-xs font-bold uppercase text-neutral-500">{d.toLocaleDateString(undefined, { weekday: 'short' })}</div>
                <div className={`text-sm num font-semibold ${isToday ? 'text-brand-600' : ''}`}>{d.getDate()}</div>
              </div>
            );
          })}
        </div>
        <div className="grid min-h-[300px]" style={{ gridTemplateColumns: `repeat(${Math.min(days.length, 7)}, minmax(0, 1fr))` }}>
          {days.map((d) => {
            const k = d.toISOString().slice(0, 10);
            const items = byDay.get(k) ?? [];
            return (
              <div key={k} className="p-2 border-r border-line last:border-r-0 space-y-1.5 min-h-[260px] hover:bg-canvas cursor-pointer"
                   onClick={() => { setSeedDate(k); setModalOpen(true); }}>
                {items.length === 0 && <span className="text-[11.5px] text-neutral-400 italic">+ click to add</span>}
                {items.map((row: any) => {
                  const s = row.schedule;
                  const tone = STATUS_TONE[s.status] ?? STATUS_TONE.planned;
                  return (
                    <div key={s.id} className={`rounded-lg px-2 py-1 text-xs ${tone}`} onClick={(e) => e.stopPropagation()}>
                      <div className="font-semibold">{row.staffName}</div>
                      <div className="num">
                        {s.startTime?.slice(0, 5) ?? '—'} – {s.endTime?.slice(0, 5) ?? '—'}
                      </div>
                      <div className="mt-0.5">
                        <select className="text-[11.5px] bg-transparent border-none p-0 cursor-pointer" value={s.status} onChange={(e) => updateMu.mutate({ id: s.id, status: e.target.value as any })}>
                          <option value="planned">Planned</option>
                          <option value="confirmed">Confirmed</option>
                          <option value="swapped">Swapped</option>
                          <option value="cancelled">Cancelled</option>
                          <option value="no_show">No-show</option>
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {modalOpen && (
        <NewShiftModal
          staffList={staffList}
          seedDate={seedDate}
          onClose={() => setModalOpen(false)}
          onSaved={() => { setModalOpen(false); utils.schedule.list.invalidate(); }}
        />
      )}
    </div>
  );
}

function NewShiftModal({ staffList, seedDate, onClose, onSaved }: { staffList: any[]; seedDate: string | null; onClose: () => void; onSaved: () => void }) {
  const [staffId, setStaffId] = useState(staffList[0]?.id ?? 0);
  const [shiftDate, setShiftDate] = useState(seedDate ?? new Date().toISOString().slice(0, 10));
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('18:00');
  const [role, setRole] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mu = trpc.schedule.create.useMutation({
    onSuccess: (d: any) => { if (d?.success === false) setError(d.error); else onSaved(); },
    onError: e => setError(e.message),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!staffId) return setError('Select a staff member.');
    mu.mutate({
      staffId,
      shiftDate: new Date(shiftDate),
      startTime,
      endTime,
      role: role.trim() || undefined,
      notes: notes.trim() || undefined,
      status: 'planned',
    });
  };

  return (
    <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'grid', placeItems: 'center', background: 'rgba(14,10,10,0.42)', padding: 16 }}
         onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form onSubmit={onSubmit} className="bg-white rounded-2xl shadow-pop" style={{ width: '100%', maxWidth: 520, border: '1px solid rgba(26,22,18,0.10)' }}>
        <header className="px-4 py-3 border-b border-line">
          <span className="text-xs font-semibold uppercase tracking-wider text-brand-500">Schedule</span>
          <h2 className="text-xl font-bold mt-0.5">New shift</h2>
        </header>
        <div className="px-4 py-3 grid grid-cols-2 gap-3 text-sm">
          <Field label="Staff" col={2}>
            <select className="field-input" value={staffId} onChange={e => setStaffId(parseInt(e.target.value, 10))}>
              {staffList.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.role})</option>)}
            </select>
          </Field>
          <Field label="Date" col={2}><input type="date" className="field-input" value={shiftDate} onChange={e => setShiftDate(e.target.value)} required /></Field>
          <Field label="Start"><input type="time" className="field-input num" value={startTime} onChange={e => setStartTime(e.target.value)} /></Field>
          <Field label="End"><input type="time" className="field-input num" value={endTime} onChange={e => setEndTime(e.target.value)} /></Field>
          <Field label="Role on shift" col={2}><input className="field-input" value={role} onChange={e => setRole(e.target.value)} placeholder="Mechanic / Cashier / Storekeeper" /></Field>
          <Field label="Notes" col={2}><textarea rows={2} className="field-input" value={notes} onChange={e => setNotes(e.target.value)} /></Field>
          {error && <div className="col-span-2 rounded-xl px-3 py-2 text-brand-500 bg-brand-50">{error}</div>}
        </div>
        <footer className="px-4 py-3 border-t border-line flex items-center justify-end gap-2">
          <button type="button" className="btn-outline text-sm" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary text-sm" disabled={mu.isLoading}>{mu.isLoading ? 'Saving…' : 'Save shift'}</button>
        </footer>
      </form>
    </div>
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
