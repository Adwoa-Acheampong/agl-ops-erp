import { useMemo, useState, type ReactNode } from 'react';
import { Printer, BarChart3, Settings2 } from 'lucide-react';
import { trpc } from '../../lib/trpc';
import { PrintLayout } from '../../components/print/PrintLayout';
import { DateRangePicker, rangeFor, type RangePreset } from '../../components/ui/DateRangePicker';

type Department = 'all' | 'sales' | 'workshop' | 'hr' | 'finance';
type ReportSection =
  | 'summary'
  | 'salesChannel'
  | 'topItems'
  | 'expenses'
  | 'workshop'
  | 'attendance'
  | 'payroll'
  | 'roster';

const SECTION_OPTIONS: Array<{ id: ReportSection; label: string }> = [
  { id: 'summary', label: 'Executive KPI strip' },
  { id: 'salesChannel', label: 'Sales by channel' },
  { id: 'topItems', label: 'Top items / services' },
  { id: 'expenses', label: 'Expense breakdown' },
  { id: 'workshop', label: 'Workshop snapshot' },
  { id: 'attendance', label: 'Attendance summary' },
  { id: 'payroll', label: 'Payroll table' },
  { id: 'roster', label: 'Roster / role mix' },
];

const DEPT_SECTIONS: Record<Department, ReportSection[]> = {
  all: ['summary', 'salesChannel', 'topItems', 'expenses', 'workshop', 'attendance', 'payroll', 'roster'],
  sales: ['summary', 'salesChannel', 'topItems'],
  workshop: ['summary', 'workshop', 'roster'],
  hr: ['summary', 'attendance', 'payroll', 'roster'],
  finance: ['summary', 'salesChannel', 'expenses', 'payroll'],
};

const ghs = (n: number) => `GHS ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function previousMonthDefaults(now = new Date()) {
  const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const last = new Date(now.getFullYear(), now.getMonth(), 0);
  return {
    from: first.toISOString().slice(0, 10),
    to: last.toISOString().slice(0, 10),
  };
}

function isMissingPunch(value: unknown): boolean {
  const s = String(value ?? '').trim();
  return !s || s === '00:00';
}

function isExcused(row: any): boolean {
  return /\b(holiday|pto|sick|sickday|sick day)\b/i.test(String(row.notes ?? ''));
}

function roleLabel(value: unknown): string {
  return String(value ?? 'Unassigned').replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

function isReportingStaff(row: any): boolean {
  return !['owner', 'admin', 'principal'].includes(String(row?.role ?? '').toLowerCase());
}

export function BusinessReportPage() {
  const defaults = useMemo(() => previousMonthDefaults(), []);
  const [preset, setPreset] = useState<RangePreset>('custom');
  const [customFrom, setCustomFrom] = useState(defaults.from);
  const [customTo, setCustomTo] = useState(defaults.to);
  const [dept, setDept] = useState<Department>('all');
  const [sections, setSections] = useState<ReportSection[]>(DEPT_SECTIONS.all);

  const range = useMemo(() => rangeFor(preset, customFrom, customTo), [preset, customFrom, customTo]);
  const payrollPeriod = useMemo(() => ({
    year: range.from.getFullYear(),
    month: range.from.getMonth() + 1,
  }), [range.from]);

  const salesQ = trpc.sales.list.useQuery({ startDate: range.from, endDate: range.to } as any, { keepPreviousData: true });
  const expensesQ = trpc.expenses.list.useQuery({ startDate: range.from, endDate: range.to } as any, { keepPreviousData: true });
  const apptsQ = trpc.appointments.list.useQuery({} as any, { keepPreviousData: true });
  const staffQ = trpc.staffManagement.list.useQuery(undefined as any, { keepPreviousData: true });
  const attendanceQ = trpc.staffManagement.listImportedAttendance.useQuery({
    from: range.from.toISOString().slice(0, 10),
    to: range.to.toISOString().slice(0, 10),
    limit: 2000,
  } as any, { keepPreviousData: true });
  const payrollQ = trpc.payroll.computeMonthly.useQuery(payrollPeriod, { keepPreviousData: true });

  const salesData: any = salesQ.data;
  const expensesData: any = expensesQ.data;
  const sales: any[] = Array.isArray(salesData) ? salesData : (salesData?.transactions ?? []);
  const expenses: any[] = Array.isArray(expensesData) ? expensesData : (expensesData?.expenses ?? []);
  const appts: any[] = apptsQ.data?.success ? apptsQ.data.appointments ?? [] : (Array.isArray(apptsQ.data) ? apptsQ.data : []);
  const staff: any[] = staffQ.data?.success ? staffQ.data.staff ?? [] : [];
  const attendance: any[] = attendanceQ.data?.success ? attendanceQ.data.rows ?? [] : [];
  const payrollData: any = payrollQ.data?.success ? payrollQ.data : null;
  const payrollRows: any[] = payrollData?.breakdowns ?? [];
  const payrollSummary: any = payrollData?.summary ?? null;

  const has = (id: ReportSection) => sections.includes(id);
  const toggleSection = (id: ReportSection) => {
    setSections((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);
  };
  const applyDepartment = (next: Department) => {
    setDept(next);
    setSections(DEPT_SECTIONS[next]);
  };

  const totals = useMemo(() => {
    const revenue = sales.reduce((s, r: any) => s + Number(r.totalAmount ?? r.total_amount ?? 0), 0);
    const orders = sales.length;
    const aov = orders > 0 ? revenue / orders : 0;
    const opex = expenses.reduce((s, r: any) => s + Number(r.amount ?? 0), 0);
    const net = revenue - opex;
    const completedJobs = appts.filter((r: any) => (r.appointment?.status ?? r.status) === 'Completed').length;
    const activeStaff = staff.filter((s: any) => isReportingStaff(s) && (s.status ?? 'active') === 'active').length;
    const attendanceSessions = attendance.filter((r: any) => !isExcused(r)).length;
    const excused = attendance.filter(isExcused).length;
    const late = attendance.filter((r: any) => !isExcused(r) && Number(r.isLate ?? 0) > 0).length;
    const missedIn = attendance.filter((r: any) => !isExcused(r) && isMissingPunch(r.clockInTime)).length;
    const missedOut = attendance.filter((r: any) => !isExcused(r) && isMissingPunch(r.clockOutTime)).length;
    const hours = attendance.reduce((sum, r: any) => sum + (isExcused(r) ? 0 : Number(r.hoursWorked ?? 0) || 0), 0);
    const payrollNet = payrollRows.reduce((s, r: any) => s + Number(r.netPay ?? 0), 0);
    const payrollBase = payrollRows.reduce((s, r: any) => s + Number(r.baseMonthlyNet ?? 0), 0);
    const payrollOvertime = payrollRows.reduce((s, r: any) => s + Number(r.overtimePay ?? 0), 0);
    const payrollPenalties = payrollRows.reduce((s, r: any) => s + Number(r.latePenalty ?? 0) + Number(r.noClockOutPenalty ?? 0) + Number(r.recallPenaltyShare ?? 0), 0);
    return { revenue, orders, aov, opex, net, completedJobs, activeStaff, attendanceSessions, excused, late, missedIn, missedOut, hours, payrollNet, payrollBase, payrollOvertime, payrollPenalties };
  }, [sales, expenses, appts, staff, attendance, payrollRows]);

  const byChannel = useMemo(() => {
    const m = new Map<string, { count: number; revenue: number }>();
    for (const s of sales) {
      const k = s.channel ?? 'Unknown';
      const cur = m.get(k) ?? { count: 0, revenue: 0 };
      cur.count += 1;
      cur.revenue += Number(s.totalAmount ?? s.total_amount ?? 0);
      m.set(k, cur);
    }
    return Array.from(m.entries()).sort((a, b) => b[1].revenue - a[1].revenue);
  }, [sales]);

  const topItems = useMemo(() => {
    const m = new Map<string, { qty: number; revenue: number }>();
    for (const s of sales) {
      const k = s.part_service ?? s.partService ?? 'Unspecified';
      const cur = m.get(k) ?? { qty: 0, revenue: 0 };
      cur.qty += Number(s.quantity ?? 0) || 1;
      cur.revenue += Number(s.totalAmount ?? s.total_amount ?? 0);
      m.set(k, cur);
    }
    return Array.from(m.entries()).sort((a, b) => b[1].revenue - a[1].revenue).slice(0, 10);
  }, [sales]);

  const byExpenseCategory = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of expenses) {
      const k = e.category ?? 'Uncategorised';
      m.set(k, (m.get(k) ?? 0) + Number(e.amount ?? 0));
    }
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  }, [expenses]);

  const attendanceByStaff = useMemo(() => {
    const m = new Map<string, { sessions: number; late: number; missedIn: number; missedOut: number; excused: number; hours: number }>();
    for (const row of attendance) {
      const k = row.staffName ?? 'Unassigned';
      const cur = m.get(k) ?? { sessions: 0, late: 0, missedIn: 0, missedOut: 0, excused: 0, hours: 0 };
      const excused = isExcused(row);
      if (excused) {
        cur.excused += 1;
      } else {
        cur.sessions += 1;
        cur.late += Number(row.isLate ?? 0) > 0 ? 1 : 0;
        cur.missedIn += isMissingPunch(row.clockInTime) ? 1 : 0;
        cur.missedOut += isMissingPunch(row.clockOutTime) ? 1 : 0;
        cur.hours += Number(row.hoursWorked ?? 0) || 0;
      }
      m.set(k, cur);
    }
    return Array.from(m.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [attendance]);

  const roles = useMemo(() => {
    const m = new Map<string, { total: number; active: number }>();
    for (const row of staff) {
      const k = roleLabel(row.role);
      const cur = m.get(k) ?? { total: 0, active: 0 };
      cur.total += 1;
      cur.active += (row.status ?? 'active') === 'active' ? 1 : 0;
      m.set(k, cur);
    }
    return Array.from(m.entries()).sort((a, b) => b[1].active - a[1].active || a[0].localeCompare(b[0]));
  }, [staff]);

  const reportTitle = `${dept === 'all' ? 'All departments' : dept.charAt(0).toUpperCase() + dept.slice(1)} - ${range.label}`;

  return (
    <div>
      <div className="no-print grid gap-3 mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <DateRangePicker
            preset={preset}
            onPresetChange={setPreset}
            customFrom={customFrom}
            customTo={customTo}
            onCustomFromChange={setCustomFrom}
            onCustomToChange={setCustomTo}
            presets={['today', 'week', 'month', 'quarter', 'year', 'custom']}
          />
          <select className="field-input text-sm" value={dept} onChange={(e) => applyDepartment(e.target.value as Department)}>
            <option value="all">All departments</option>
            <option value="sales">Sales</option>
            <option value="workshop">Workshop</option>
            <option value="hr">HR</option>
            <option value="finance">Finance</option>
          </select>
          <button type="button" className="btn-primary text-sm ml-auto" onClick={() => window.print()}>
            <Printer size={14} /> Print report
          </button>
        </div>

        <div className="rounded-2xl bg-white border border-line p-3">
          <div className="flex items-center gap-2 text-sm font-semibold mb-2">
            <Settings2 size={14} /> Report settings
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {SECTION_OPTIONS.map((section) => (
              <label key={section.id} className="flex items-center gap-2 rounded-xl border border-line px-3 py-2 text-sm bg-canvas/50">
                <input type="checkbox" checked={has(section.id)} onChange={() => toggleSection(section.id)} />
                <span>{section.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <PrintLayout
        eyebrow="Business Report"
        title={reportTitle}
        subtitle={`${range.from.toLocaleDateString()} - ${range.to.toLocaleDateString()}`}
        orientation="landscape"
        meta={has('summary') ? {
          Revenue: ghs(totals.revenue),
          Orders: String(totals.orders),
          'Avg order': ghs(totals.aov),
          Expenses: ghs(totals.opex),
          'Net ops': ghs(totals.net),
          'Active staff': String(totals.activeStaff),
          'Payroll net': ghs(totals.payrollNet),
          'Attendance flags': String(totals.late + totals.missedIn + totals.missedOut),
        } : undefined}
      >
        {has('salesChannel') && (
          <Section title="Sales by channel">
            <table className="pl-table">
              <thead><tr><th>Channel</th><th style={{ textAlign: 'right' }}>Orders</th><th style={{ textAlign: 'right' }}>Revenue</th><th style={{ textAlign: 'right' }}>Share</th></tr></thead>
              <tbody>
                {byChannel.map(([name, v]) => (
                  <tr key={name}>
                    <td>{name}</td>
                    <td style={{ textAlign: 'right' }}>{v.count}</td>
                    <td style={{ textAlign: 'right' }}>{ghs(v.revenue)}</td>
                    <td style={{ textAlign: 'right' }}>{totals.revenue > 0 ? ((v.revenue / totals.revenue) * 100).toFixed(1) : '0.0'}%</td>
                  </tr>
                ))}
                {byChannel.length === 0 && <EmptyRow colSpan={4} label="No sales in this period." />}
              </tbody>
            </table>
          </Section>
        )}

        {has('topItems') && (
          <Section title="Top 10 items / services by revenue">
            <table className="pl-table">
              <thead><tr><th>Item</th><th style={{ textAlign: 'right' }}>Qty</th><th style={{ textAlign: 'right' }}>Revenue</th></tr></thead>
              <tbody>
                {topItems.map(([name, v]) => (
                  <tr key={name}>
                    <td style={{ maxWidth: '40ch' }}>{name}</td>
                    <td style={{ textAlign: 'right' }}>{v.qty}</td>
                    <td style={{ textAlign: 'right' }}>{ghs(v.revenue)}</td>
                  </tr>
                ))}
                {topItems.length === 0 && <EmptyRow colSpan={3} label="No items in this period." />}
              </tbody>
            </table>
          </Section>
        )}

        {has('expenses') && (
          <Section title="Expense breakdown by category">
            <table className="pl-table">
              <thead><tr><th>Category</th><th style={{ textAlign: 'right' }}>Amount</th><th style={{ textAlign: 'right' }}>Share</th></tr></thead>
              <tbody>
                {byExpenseCategory.map(([k, v]) => (
                  <tr key={k}>
                    <td>{k}</td>
                    <td style={{ textAlign: 'right' }}>{ghs(v)}</td>
                    <td style={{ textAlign: 'right' }}>{totals.opex > 0 ? ((v / totals.opex) * 100).toFixed(1) : '0.0'}%</td>
                  </tr>
                ))}
                {byExpenseCategory.length === 0 && <EmptyRow colSpan={3} label="No expenses in this period." />}
              </tbody>
            </table>
          </Section>
        )}

        {has('workshop') && (
          <Section title="Workshop snapshot">
            <table className="pl-table">
              <tbody>
                <tr><td>Completed jobs in period</td><td style={{ textAlign: 'right' }}>{totals.completedJobs}</td></tr>
                <tr><td>Active staff snapshot</td><td style={{ textAlign: 'right' }}>{totals.activeStaff}</td></tr>
              </tbody>
            </table>
          </Section>
        )}

        {has('attendance') && (
          <Section title="Attendance summary">
            <table className="pl-table">
              <tbody>
                <tr><td>Attendance sessions</td><td style={{ textAlign: 'right' }}>{totals.attendanceSessions}</td></tr>
                <tr><td>Total recorded hours</td><td style={{ textAlign: 'right' }}>{totals.hours.toFixed(2)}</td></tr>
                <tr><td>Late flags</td><td style={{ textAlign: 'right' }}>{totals.late}</td></tr>
                <tr><td>Missing clock-in</td><td style={{ textAlign: 'right' }}>{totals.missedIn}</td></tr>
                <tr><td>Missing clock-out</td><td style={{ textAlign: 'right' }}>{totals.missedOut}</td></tr>
                <tr><td>Holiday / PTO / Sickday</td><td style={{ textAlign: 'right' }}>{totals.excused}</td></tr>
              </tbody>
            </table>

            <table className="pl-table" style={{ marginTop: 12 }}>
              <thead><tr><th>Staff</th><th style={{ textAlign: 'right' }}>Sessions</th><th style={{ textAlign: 'right' }}>Hours</th><th style={{ textAlign: 'right' }}>Late</th><th style={{ textAlign: 'right' }}>Missed In</th><th style={{ textAlign: 'right' }}>Missed Out</th><th style={{ textAlign: 'right' }}>Excused</th></tr></thead>
              <tbody>
                {attendanceByStaff.map(([name, v]) => (
                  <tr key={name}>
                    <td>{name}</td>
                    <td style={{ textAlign: 'right' }}>{v.sessions}</td>
                    <td style={{ textAlign: 'right' }}>{v.hours.toFixed(2)}</td>
                    <td style={{ textAlign: 'right' }}>{v.late}</td>
                    <td style={{ textAlign: 'right' }}>{v.missedIn}</td>
                    <td style={{ textAlign: 'right' }}>{v.missedOut}</td>
                    <td style={{ textAlign: 'right' }}>{v.excused}</td>
                  </tr>
                ))}
                {attendanceByStaff.length === 0 && <EmptyRow colSpan={7} label="No attendance rows in this period." />}
              </tbody>
            </table>
          </Section>
        )}

        {has('payroll') && (
          <Section title={`Payroll preview - ${new Date(payrollPeriod.year, payrollPeriod.month - 1, 1).toLocaleString(undefined, { month: 'long', year: 'numeric' })}`}>
            <table className="pl-table">
              <tbody>
                <tr><td>Base pay</td><td style={{ textAlign: 'right' }}>{ghs(totals.payrollBase)}</td></tr>
                <tr><td>Overtime</td><td style={{ textAlign: 'right' }}>{ghs(totals.payrollOvertime)}</td></tr>
                <tr><td>Penalties</td><td style={{ textAlign: 'right' }}>{ghs(totals.payrollPenalties)}</td></tr>
                <tr><td>Net payroll</td><td style={{ textAlign: 'right', fontWeight: 700 }}>{ghs(totals.payrollNet)}</td></tr>
                <tr><td>Payroll source</td><td style={{ textAlign: 'right' }}>{payrollSummary?.matchedImportedRows ?? 0} matched / {payrollSummary?.importedAttendanceRows ?? 0} imported rows</td></tr>
              </tbody>
            </table>

            <table className="pl-table" style={{ marginTop: 12 }}>
              <thead><tr><th>Staff</th><th style={{ textAlign: 'right' }}>Base</th><th style={{ textAlign: 'right' }}>Bonus</th><th style={{ textAlign: 'right' }}>OT</th><th style={{ textAlign: 'right' }}>Late</th><th style={{ textAlign: 'right' }}>Missed</th><th style={{ textAlign: 'right' }}>Recall</th><th style={{ textAlign: 'right' }}>Net</th></tr></thead>
              <tbody>
                {payrollRows.map((b: any) => (
                  <tr key={b.staffId}>
                    <td>{b.staffName}</td>
                    <td style={{ textAlign: 'right' }}>{ghs(Number(b.baseMonthlyNet ?? 0))}</td>
                    <td style={{ textAlign: 'right' }}>{Number(b.bonusShare ?? 0) ? ghs(Number(b.bonusShare)) : '-'}</td>
                    <td style={{ textAlign: 'right' }}>{Number(b.overtimePay ?? 0) ? ghs(Number(b.overtimePay)) : '-'}</td>
                    <td style={{ textAlign: 'right' }}>{Number(b.latePenalty ?? 0) ? ghs(Number(b.latePenalty)) : '-'}</td>
                    <td style={{ textAlign: 'right' }}>{Number(b.noClockOutPenalty ?? 0) ? ghs(Number(b.noClockOutPenalty)) : '-'}</td>
                    <td style={{ textAlign: 'right' }}>{Number(b.recallPenaltyShare ?? 0) ? ghs(Number(b.recallPenaltyShare)) : '-'}</td>
                    <td style={{ textAlign: 'right', fontWeight: 700 }}>{ghs(Number(b.netPay ?? 0))}</td>
                  </tr>
                ))}
                {payrollRows.length === 0 && <EmptyRow colSpan={8} label="No payroll rows for this period." />}
              </tbody>
            </table>
          </Section>
        )}

        {has('roster') && (
          <Section title="Roster and role mix">
            <table className="pl-table">
              <thead><tr><th>Role</th><th style={{ textAlign: 'right' }}>Active</th><th style={{ textAlign: 'right' }}>Total</th></tr></thead>
              <tbody>
                {roles.map(([role, v]) => (
                  <tr key={role}>
                    <td>{role}</td>
                    <td style={{ textAlign: 'right' }}>{v.active}</td>
                    <td style={{ textAlign: 'right' }}>{v.total}</td>
                  </tr>
                ))}
                {roles.length === 0 && <EmptyRow colSpan={3} label="No roster rows found." />}
              </tbody>
            </table>
          </Section>
        )}
      </PrintLayout>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-5">
      <h2 className="text-base font-semibold mb-2 flex items-center gap-2">
        <BarChart3 size={14} /> {title}
      </h2>
      {children}
    </section>
  );
}

function EmptyRow({ colSpan, label }: { colSpan: number; label: string }) {
  return <tr><td colSpan={colSpan} style={{ textAlign: 'center', color: '#888' }}>{label}</td></tr>;
}
