import { useState, useMemo } from 'react';
import { Clock, LogIn, LogOut, Loader2, AlertTriangle, Calendar } from 'lucide-react';
import { trpc } from '../lib/trpc';
import { ghs } from '../lib/ghanaTax';

/**
 * Clock In / Clock Out — staff attendance with built-in penalty calculator.
 *
 * AGL policy enforced here:
 *   • Work day 08:00 → 18:00
 *   • Late clock-in (> 08:00) = GHS 20 penalty
 *   • Missed clock-in or clock-out = GHS 5 penalty each
 *   • Hours past 18:00 = overtime at 1.5× hourly
 *
 * Hourly rate is derived from each staff member's `baseMonthlyNet` divided
 * by (workingDays × 10 hours). Set baseMonthlyNet in Staff settings.
 */

export function ClockInOutPage() {
  const [now, setNow] = useState(new Date());
  // Refresh the clock display every minute so "now" stays current.
  useMemo(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null);

  const staffQ = trpc.staffManagement.list.useQuery({ status: 'active' });
  const staffList: any[] = staffQ.data?.success ? staffQ.data.staff ?? [] : [];

  const attendanceQ = trpc.staffManagement.listAttendance.useQuery(undefined, { keepPreviousData: true });
  const logs: any[] = attendanceQ.data?.success ? attendanceQ.data.attendanceLogs ?? [] : [];

  const utils = trpc.useUtils();
  const invalidate = () => {
    utils.staffManagement.list.invalidate();
    utils.staffManagement.listAttendance.invalidate();
  };

  const clockIn = trpc.staffManagement.clockIn.useMutation({ onSuccess: invalidate });
  const clockOut = trpc.staffManagement.clockOut.useMutation({ onSuccess: invalidate });

  // Build a "who is currently clocked in" map from open logs.
  const openLogByStaffId = useMemo(() => {
    const m = new Map<number, any>();
    for (const row of logs) {
      const log = row.log ?? row;
      if (log.clockInTime && !log.clockOutTime) m.set(log.staffId, log);
    }
    return m;
  }, [logs]);

  const summaryQ = trpc.staffManagement.monthlyAttendanceSummary.useQuery(
    selectedStaffId ? { staffId: selectedStaffId, year, month } : (undefined as any),
    { enabled: selectedStaffId !== null },
  );
  const summary = summaryQ.data?.success ? summaryQ.data.summary : null;

  return (
    <div className="max-w-7xl">
      <header className="flex items-end justify-between gap-3 flex-wrap mb-4">
        <div>
          <h1 className="h-section flex items-center gap-2"><Clock size={20} /> Clock In &amp; Out</h1>
          <p className="mt-1 text-neutral-600 text-sm">
            Working day {fmtTime(setHour(today, 8))} → {fmtTime(setHour(today, 18))}. Late after 08:00 (GHS 20). Missed punches GHS 5. Overtime 1.5×.
          </p>
        </div>
        <div className="text-right">
          <div className="text-xs font-bold uppercase tracking-wider text-neutral-500">Current time</div>
          <div className="num text-3xl font-bold text-brand-600">{fmtTime(now)}</div>
          <div className="text-xs text-neutral-500">{now.toDateString()}</div>
        </div>
      </header>

      <section className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4">
        <article className="bg-white rounded-2xl border border-line overflow-hidden">
          <header className="px-4 py-3 border-b border-line bg-canvas">
            <h2 className="font-semibold">Active staff</h2>
            <p className="text-xs text-neutral-500">Tap to clock a staff member in or out.</p>
          </header>
          <div className="divide-y divide-line">
            {staffQ.isLoading && (
              <div className="px-4 py-6 text-center text-sm text-neutral-500">
                <Loader2 size={14} className="animate-spin inline" /> Loading staff…
              </div>
            )}
            {!staffQ.isLoading && staffList.length === 0 && (
              <div className="px-4 py-6 text-center text-sm text-neutral-500">
                No active staff yet. Add them from HR &gt; Staff.
              </div>
            )}
            {staffList.map((s) => {
              const openLog = openLogByStaffId.get(s.id);
              const isOn = !!openLog;
              return (
                <div key={s.id} className="px-4 py-3 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedStaffId(s.id)}
                    className={`text-left flex-1 ${selectedStaffId === s.id ? 'text-brand-600 font-semibold' : ''}`}
                  >
                    <div className="font-semibold">{s.name}</div>
                    <div className="text-xs text-neutral-500 capitalize">{s.role}</div>
                    {isOn && (
                      <div className="text-xs text-emerald-700 mt-0.5">
                        Clocked in at {fmtTime(new Date(openLog.clockInTime))} ({elapsed(new Date(openLog.clockInTime), now)})
                      </div>
                    )}
                  </button>
                  {isOn ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50"
                      disabled={clockOut.isLoading}
                      onClick={() => clockOut.mutate({ attendanceLogId: openLog.id })}
                    >
                      <LogOut size={14} /> Clock out
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                      disabled={clockIn.isLoading}
                      onClick={() => clockIn.mutate({ staffId: s.id })}
                    >
                      <LogIn size={14} /> Clock in
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </article>

        <article className="bg-white rounded-2xl border border-line overflow-hidden">
          <header className="px-4 py-3 border-b border-line bg-canvas">
            <h2 className="font-semibold flex items-center gap-2"><Calendar size={14} /> Monthly summary</h2>
            <p className="text-xs text-neutral-500">Penalty + overtime calc for the selected staff.</p>
          </header>
          <div className="p-4 grid gap-3">
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs">
                <span className="block text-neutral-500 mb-1">Year</span>
                <input type="number" className="field-input num w-full" value={year} onChange={(e) => setYear(parseInt(e.target.value || `${today.getFullYear()}`, 10))} />
              </label>
              <label className="text-xs">
                <span className="block text-neutral-500 mb-1">Month</span>
                <select className="field-input w-full" value={month} onChange={(e) => setMonth(parseInt(e.target.value, 10))}>
                  {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>{new Date(2024, i, 1).toLocaleString(undefined, { month: 'long' })}</option>
                  ))}
                </select>
              </label>
            </div>

            {!selectedStaffId && (
              <div className="text-sm text-neutral-500">Select a staff member on the left to see their summary.</div>
            )}
            {selectedStaffId && summaryQ.isLoading && (
              <div className="text-sm text-neutral-500"><Loader2 size={14} className="animate-spin inline" /> Calculating…</div>
            )}
            {summary && (
              <div className="grid gap-2 text-sm">
                <Row label="Staff">{summary.staffName}</Row>
                <Row label="Working days">{summary.workingDays}</Row>
                <Row label="Hourly rate">{ghs(summary.hourlyRate)}</Row>
                <Row label="Base monthly">{ghs(summary.baseMonthlyNet)}</Row>
                <Row label="Regular hours">{summary.regularHours.toFixed(2)}</Row>
                <Row label="Overtime hours">{summary.overtimeHours.toFixed(2)} <span className="text-xs text-neutral-500">× 1.5</span></Row>
                <Row label="Overtime pay" tone="emerald">+ {ghs(summary.overtimePay)}</Row>
                <Row label="Late clock-ins">{summary.lateCount} <span className="text-xs text-neutral-500">× GHS 20</span></Row>
                <Row label="Missed punches">{summary.missedPunchCount} <span className="text-xs text-neutral-500">× GHS 5</span></Row>
                <Row label="Total penalties" tone="brand">− {ghs(summary.totalPenalty)}</Row>
                <div className="mt-2 pt-2 border-t border-line flex items-center justify-between">
                  <span className="font-semibold">Gross payable</span>
                  <span className="num text-lg font-bold text-brand-600">{ghs(summary.grossPay)}</span>
                </div>
                {summary.missedPunchCount > 0 && (
                  <div className="rounded-lg px-2 py-1.5 bg-brand-50 text-brand-600 text-xs flex items-start gap-1.5">
                    <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                    {summary.missedPunchCount} attendance log(s) missing clock-in or clock-out this month.
                  </div>
                )}
              </div>
            )}
          </div>
        </article>
      </section>

      <section className="mt-6">
        <h2 className="font-semibold mb-2">Recent activity</h2>
        <div className="bg-white rounded-2xl border border-line overflow-hidden">
          <div style={{ overflowX: 'auto' }}>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="t-th">Staff</th>
                  <th className="t-th">Role</th>
                  <th className="t-th">Clock-in</th>
                  <th className="t-th">Clock-out</th>
                  <th className="t-th">Overtime</th>
                  <th className="t-th">Status</th>
                </tr>
              </thead>
              <tbody>
                {attendanceQ.isLoading && (
                  <tr><td colSpan={6} className="px-4 py-6 text-center text-neutral-500">
                    <Loader2 size={14} className="animate-spin inline" /> Loading…
                  </td></tr>
                )}
                {!attendanceQ.isLoading && logs.length === 0 && (
                  <tr><td colSpan={6} className="px-4 py-6 text-center text-neutral-500">No attendance recorded yet.</td></tr>
                )}
                {logs.slice(0, 50).map((row: any, i: number) => {
                  const log = row.log ?? row;
                  const ci = log.clockInTime ? new Date(log.clockInTime) : null;
                  const co = log.clockOutTime ? new Date(log.clockOutTime) : null;
                  const late = ci ? ci.getHours() > 8 || (ci.getHours() === 8 && ci.getMinutes() > 0) : false;
                  return (
                    <tr key={log.id ?? i}>
                      <td className="t-td font-semibold">{row.staffName ?? `Staff #${log.staffId}`}</td>
                      <td className="t-td capitalize text-neutral-600">{row.role ?? '—'}</td>
                      <td className="t-td num">
                        {ci ? ci.toLocaleString() : <span className="text-brand-500">missing</span>}
                        {late && <span className="ml-2 px-1.5 py-0.5 rounded text-xs bg-brand-50 text-brand-600">late</span>}
                      </td>
                      <td className="t-td num">
                        {co ? co.toLocaleString() : <span className="text-emerald-700">on shift</span>}
                      </td>
                      <td className="t-td num">{log.overtimeHours ? `${Number(log.overtimeHours).toFixed(2)} h` : '—'}</td>
                      <td className="t-td">{co ? 'closed' : 'open'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
function Row({ label, children, tone }: { label: string; children: any; tone?: 'brand' | 'emerald' }) {
  const colour = tone === 'brand' ? 'text-brand-500' : tone === 'emerald' ? 'text-emerald-700' : '';
  return (
    <div className="flex items-center justify-between">
      <span className="text-neutral-500">{label}</span>
      <span className={`num font-semibold ${colour}`}>{children}</span>
    </div>
  );
}

function fmtTime(d: Date): string {
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}
function setHour(d: Date, h: number): Date {
  const c = new Date(d); c.setHours(h, 0, 0, 0); return c;
}
function elapsed(from: Date, to: Date): string {
  const ms = to.getTime() - from.getTime();
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
}
