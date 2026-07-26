import { useState } from 'react';
import { Calculator, Loader2, ArrowDownUp } from 'lucide-react';
import { PageShell } from '../components/layout/PageShell';
import { trpc } from '../lib/trpc';
import { useAuth } from '../contexts/AuthContext';

/**
 * P7.6 — Automated Payroll page.
 *
 * Two modes per month:
 *   1. Compute preview (read-only) — runs the engine and shows the breakdown.
 *   2. Finalize — writes payroll_runs rows so the breakdown is frozen.
 *
 * The page also lists previously finalized runs for the selected year so an
 * admin can audit history.
 */
export function PayrollPage() {
  const today = new Date();
  const defaultPeriod = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const [year, setYear] = useState(defaultPeriod.getFullYear());
  const [month, setMonth] = useState(defaultPeriod.getMonth() + 1);

  const { user } = useAuth();
  const canFinalize = !!user?.canEditLedgers || ['admin', 'owner', 'manager', 'operations_manager', 'principal'].includes(String(user?.role ?? '').toLowerCase());

  const utils = trpc.useUtils();
  const computeQuery = trpc.payroll.computeMonthly.useQuery(
    { year, month },
    { keepPreviousData: true },
  );
  const runsQuery = trpc.payroll.listRuns.useQuery({ year }, { keepPreviousData: true });

  const finalizeMutation = trpc.payroll.finalizeMonthly.useMutation({
    onSuccess: () => {
      utils.payroll.listRuns.invalidate({ year });
    },
  });

  const compute = computeQuery.data?.success ? computeQuery.data : null;
  const computeError =
    computeQuery.error?.message ??
    (computeQuery.data?.success === false ? computeQuery.data.error : null);

  const breakdowns = compute?.breakdowns ?? [];
  const summary = compute?.summary;

  const totalNet = breakdowns.reduce((s, b) => s + b.netPay, 0);
  const totalBonus = breakdowns.reduce((s, b) => s + b.bonusShare, 0);
  const totalOT = breakdowns.reduce((s, b) => s + b.overtimePay, 0);
  const totalDeductions = breakdowns.reduce(
    (s, b) => s + b.latePenalty + b.noClockOutPenalty + b.recallPenaltyShare,
    0,
  );

  const runs = runsQuery.data?.success ? runsQuery.data.runs ?? [] : [];

  const monthLabel = new Date(year, month - 1, 1).toLocaleString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  const onFinalize = () => {
    if (!window.confirm(`Finalize ${monthLabel}? This freezes the breakdown into payroll_runs.`)) return;
    finalizeMutation.mutate({ year, month });
  };

  return (
    <PageShell
      eyebrow="Payroll"
      title="Monthly Payroll"
      intro="Base + bonus + overtime − penalties, computed from the workshop ledger and attendance logs in one keystroke. Finalize to freeze the run for audit."
      actions={
        <div className="flex items-center gap-2">
          <select
            className="field-input text-sm"
            value={month}
            onChange={(e) => setMonth(parseInt(e.target.value, 10))}
            style={{ minWidth: 130 }}
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {new Date(2000, m - 1, 1).toLocaleString(undefined, { month: 'long' })}
              </option>
            ))}
          </select>
          <input
            type="number"
            className="field-input num text-sm"
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value, 10) || today.getFullYear())}
            min={2000}
            max={2100}
            style={{ width: 96 }}
          />
          <button
            type="button"
            className="btn-primary text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            onClick={onFinalize}
            disabled={finalizeMutation.isLoading || breakdowns.length === 0 || !canFinalize}
            title={
              !canFinalize
                ? 'Manager, owner, or principal account required to finalize payroll.'
                : breakdowns.length === 0
                  ? 'Nothing to finalize'
                  : `Freeze ${monthLabel} into payroll_runs`
            }
          >
            {finalizeMutation.isLoading ? 'Finalizing…' : 'Finalize Run'}
          </button>
        </div>
      }
    >
      {computeError && (
        <div
          className="rounded-2xl px-4 py-3 font-sans text-sm text-brand-500 bg-white"
          style={{ border: '1px solid rgba(160,48,64,0.32)' }}
        >
          {computeError}
        </div>
      )}

      {finalizeMutation.error && (
        <div
          className="rounded-2xl px-4 py-3 font-sans text-sm text-brand-500 bg-white"
          style={{ border: '1px solid rgba(160,48,64,0.32)' }}
          role="alert"
        >
          {finalizeMutation.error.message}
        </div>
      )}

      {summary && (
        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          <PayrollKpi
            label="Net pay (preview)"
            value={`GHS ${totalNet.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            helper={`${breakdowns.length} active staff for ${monthLabel}.`}
          />
          <PayrollKpi
            label="Service bonus pool"
            value={`GHS ${summary.servicePoolGHS.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            helper={`20% of completed service fees · ${summary.mechanicCount} mechanic(s) sharing.`}
          />
          <PayrollKpi
            label="Overtime"
            value={`GHS ${totalOT.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            helper={`Past ${summary.standardHoursPerDay}h/day × 1.5×.`}
          />
          <PayrollKpi
            label="Deductions"
            value={`GHS ${totalDeductions.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            helper="Late + no-clock-out + recall shares."
          />
        </section>
      )}

      {summary && (
        <div className="rounded-2xl bg-white px-4 py-3 text-sm text-ink-700" style={{ border: '1px solid rgba(26,22,18,0.08)' }}>
          Payroll source: {summary.importedAttendanceRows ?? 0} imported attendance row(s), {summary.matchedImportedRows ?? 0} matched to roster, {summary.liveAttendanceRows ?? 0} live clock row(s), {summary.excusedAbsences ?? 0} excused absence(s), {summary.unmatchedImportedRows ?? 0} unmatched.
        </div>
      )}

      <section>
        <header className="flex items-end justify-between gap-3 flex-wrap mb-3">
          <h2 className="font-sans text-2xl font-semibold text-ink-900">{monthLabel} Preview</h2>
          {computeQuery.isFetching && (
            <span className="inline-flex items-center gap-1.5 font-sans text-xs text-ink-700">
              <Loader2 size={12} className="animate-spin" /> Recomputing…
            </span>
          )}
        </header>
        <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(26,22,18,0.06)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="w-full">
              <thead>
                <tr>
                  <th className="t-th">Staff</th>
                  <th className="t-th">Base</th>
                  <th className="t-th">Bonus</th>
                  <th className="t-th">OT</th>
                  <th className="t-th">Late</th>
                  <th className="t-th">No-Out</th>
                  <th className="t-th">Recall</th>
                  <th className="t-th">Net</th>
                </tr>
              </thead>
              <tbody>
                {computeQuery.isLoading && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center font-sans text-sm text-ink-700">
                      <span className="inline-flex items-center gap-1.5">
                        <Loader2 size={14} className="animate-spin" /> Computing payroll…
                      </span>
                    </td>
                  </tr>
                )}
                {!computeQuery.isLoading && breakdowns.length === 0 && !computeError && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center font-sans text-sm text-ink-700">
                      No active staff for this month.
                    </td>
                  </tr>
                )}
                {breakdowns.map((b) => (
                  <tr key={b.staffId}>
                    <td className="t-td font-semibold">{b.staffName}</td>
                    <td className="t-td num">{b.baseMonthlyNet.toFixed(2)}</td>
                    <td className="t-td num">{b.bonusShare.toFixed(2)}</td>
                    <td className="t-td num">{b.overtimePay.toFixed(2)}</td>
                    <td className="t-td num text-brand-500">{b.latePenalty.toFixed(2)}</td>
                    <td className="t-td num text-brand-500">{b.noClockOutPenalty.toFixed(2)}</td>
                    <td className="t-td num text-brand-500">{b.recallPenaltyShare.toFixed(2)}</td>
                    <td className="t-td num font-semibold">{b.netPay.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {runs.length > 0 && (
        <section>
          <header className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
            <h2 className="font-sans text-2xl font-semibold text-ink-900">{year} Frozen Runs</h2>
            <span className="font-sans text-xs text-ink-700">
              <ArrowDownUp size={12} className="inline mr-1" />
              {runs.length} row{runs.length === 1 ? '' : 's'} on file.
            </span>
          </header>
          <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(26,22,18,0.06)' }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="t-th">Month</th>
                    <th className="t-th">Staff ID</th>
                    <th className="t-th">Net</th>
                    <th className="t-th">Bonus</th>
                    <th className="t-th">OT</th>
                    <th className="t-th">Penalties</th>
                    <th className="t-th">Finalized</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r: any) => {
                    const penalties =
                      Number(r.latePenalty) +
                      Number(r.noClockOutPenalty) +
                      Number(r.recallPenaltyShare);
                    return (
                      <tr key={r.id}>
                        <td className="t-td num">{r.month.toString().padStart(2, '0')}/{r.year}</td>
                        <td className="t-td num">{r.staffId}</td>
                        <td className="t-td num font-semibold">{Number(r.netPay).toFixed(2)}</td>
                        <td className="t-td num">{Number(r.bonusShare).toFixed(2)}</td>
                        <td className="t-td num">{Number(r.overtimePay).toFixed(2)}</td>
                        <td className="t-td num text-brand-500">{penalties.toFixed(2)}</td>
                        <td className="t-td num">{r.finalizedAt ? new Date(r.finalizedAt).toISOString().slice(0, 10) : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </PageShell>
  );
}

function PayrollKpi({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <article
      className="bg-white rounded-2xl p-4 flex flex-col gap-1.5 min-w-0"
      style={{ border: '1px solid rgba(26,22,18,0.06)' }}
    >
      <span className="font-sans text-xs font-semibold uppercase text-ink-700" style={{ letterSpacing: '0.08em' }}>
        {label}
      </span>
      <div className="rule-luxe" />
      <div className="font-sans num leading-none text-ink-900" style={{ fontSize: 32, fontWeight: 600 }}>
        <span className="inline-flex items-center gap-1.5">
          <Calculator size={20} className="text-ink-700" /> {value}
        </span>
      </div>
      <p className="font-sans text-sm text-ink-700 leading-relaxed">{helper}</p>
    </article>
  );
}
