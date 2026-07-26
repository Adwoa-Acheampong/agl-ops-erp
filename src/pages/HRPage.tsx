import { useState, useEffect, FormEvent, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Briefcase, UserPlus, Loader2, Pencil, Users, Clock as ClockIcon, Wallet, BarChart3, FileText, LogIn, LogOut, AlertOctagon, Calendar } from 'lucide-react';
import { trpc } from '../lib/trpc';
import { ghs } from '../lib/ghanaTax';
import { useAuth } from '../contexts/AuthContext';

type Role =
  | 'owner'
  | 'manager'
  | 'mechanic'
  | 'receptionist'
  | 'accountant'
  | 'sales_attendant'
  | 'sales_supervisor'
  | 'workshop_supervisor'
  | 'inventory_attendant';
type SalaryType = 'hourly' | 'salary' | 'monthly' | 'commission';
type Status = 'active' | 'suspended' | 'terminated';

/** AGL payroll policy — referenced by ClockTab UI + payroll math server-side. */
const POLICY = {
  workStart: '08:00',
  workEnd:   '18:00',
  latePenalty: 10,
  missedPunchPenalty: 5,
  overtimeMultiplier: 1.5,
  paidWorkingDaysPerMonth: 26,
} as const;

const NON_ATTENDANCE_ROLES = new Set(['owner', 'admin', 'principal']);
function isAttendanceRosterRole(role: unknown): boolean {
  return !NON_ATTENDANCE_ROLES.has(String(role ?? '').toLowerCase());
}

const ROLE_LABELS: Record<Role, string> = {
  owner: 'Owner', manager: 'Manager', mechanic: 'Mechanic',
  receptionist: 'Receptionist', accountant: 'Accountant',
  sales_attendant: 'Sales Attendant',
  sales_supervisor: 'Sales Supervisor',
  workshop_supervisor: 'Workshop Supervisor',
  inventory_attendant: 'Inventory Attendant',
};

const STAFF_ROLE_OPTIONS: Array<{ value: Role; label: string }> = [
  { value: 'mechanic', label: 'Mechanic' },
  { value: 'sales_attendant', label: 'Sales Attendant' },
  { value: 'sales_supervisor', label: 'Sales Supervisor' },
  { value: 'workshop_supervisor', label: 'Workshop Supervisor' },
  { value: 'inventory_attendant', label: 'Inventory Attendant' },
  { value: 'receptionist', label: 'Receptionist' },
  { value: 'accountant', label: 'Accountant' },
  { value: 'manager', label: 'Manager' },
  { value: 'owner', label: 'Owner' },
];
const STATUS_TONE: Record<Status, string> = {
  active: 'text-black', suspended: 'text-warning', terminated: 'text-brand-500',
};

interface StaffRow {
  id: number; name: string; role: Role; phone: string | null; email: string | null;
  salaryType: SalaryType; hourlyRate: number | null; hireDate: string | null; status: Status;
  baseMonthlyNet: number | null;
  ghanaCardId: string | null; ssnit: string | null; healthInsurance: string | null;
  workStart: string | null; workEnd: string | null;
}

type Tab = 'roster' | 'clock' | 'payroll' | 'performance' | 'documents';
const TABS: ReadonlyArray<Tab> = ['roster', 'clock', 'payroll', 'performance', 'documents'];

/**
 * HR — unified people view. Absorbs the old standalone Clock In/Out page
 * and surfaces the payroll + performance summaries in the same shell.
 *
 * Tab state derives from the URL (?tab=...) so the sidebar deep-links
 * (/hr?tab=payroll, /hr?tab=documents …) switch the active panel on
 * every navigation, not only on first mount.
 */
export function HRPage() {
  const location = useLocation();
  const navigate = useNavigate();

  // Derive the active tab from the URL on every render so navigating
  // between sidebar deep-links updates the panel without a remount.
  const tab: Tab = (() => {
    const t = new URLSearchParams(location.search).get('tab');
    return (TABS as readonly string[]).includes(t ?? '') ? (t as Tab) : 'roster';
  })();

  const setTab = (id: Tab) => navigate(`/hr?tab=${id}`);

  return (
    <div className="max-w-7xl">
      <header className="flex items-end justify-between gap-3 flex-wrap mb-4">
        <div>
          <h1 className="h-section flex items-center gap-2"><Briefcase size={20} /> HR &amp; People</h1>
          <p className="mt-1 text-neutral-600 text-sm">Roster · attendance · payroll · performance · documents — one workspace.</p>
        </div>
      </header>

      <DocumentExpiryBanner />


      <nav className="flex items-center gap-1 mb-5 bg-white border border-line rounded-2xl p-1 w-fit overflow-x-auto">
        {([
          { id: 'roster',      label: 'Roster',      icon: Users },
          { id: 'clock',       label: 'Attendance',  icon: ClockIcon },
          { id: 'payroll',     label: 'Payroll',     icon: Wallet },
          { id: 'performance', label: 'Performance', icon: BarChart3 },
          { id: 'documents',   label: 'Documents',   icon: FileText },
        ] as { id: Tab; label: string; icon: any }[]).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold transition-colors whitespace-nowrap ${
              tab === t.id ? 'bg-brand-500 text-white' : 'text-neutral-600 hover:bg-canvas'
            }`}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </nav>

      {tab === 'roster'      && <RosterTab />}
      {tab === 'clock'       && <ClockTab />}
      {tab === 'payroll'     && <PayrollSummaryTab />}
      {tab === 'performance' && <PerformanceTab />}
      {tab === 'documents'   && <DocumentsTab />}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Manual / backdated attendance entry. Writes through to the historical
// `staff_attendance` table so the Attendance Ledger picks it up
// immediately. Useful for filling in days the live clock missed.
// ────────────────────────────────────────────────────────────────────────
function ManualAttendanceModal({
  open, staffList, onClose, onSaved,
}: { open: boolean; staffList: any[]; onClose: () => void; onSaved: () => void }) {
  const [staffId, setStaffId]       = useState<number | null>(null);
  const [date, setDate]             = useState<string>(new Date().toISOString().slice(0, 10));
  const [clockIn, setClockIn]       = useState<string>('08:00');
  const [clockOut, setClockOut]     = useState<string>('18:00');
  const [absenceType, setAbsenceType] = useState<'none' | 'holiday' | 'pto' | 'sickday'>('none');
  const [notes, setNotes]           = useState<string>('');
  const [error, setError]           = useState<string | null>(null);

  const mu = trpc.staffManagement.manualAttendance.useMutation({
    onSuccess: (d: any) => {
      if (d?.success === false) { setError(d.error ?? 'Failed to save.'); return; }
      reset(); onSaved();
    },
    onError: (e) => setError(e.message),
  });
  const reset = () => {
    setStaffId(null);
    setDate(new Date().toISOString().slice(0, 10));
    setClockIn('08:00'); setClockOut('18:00'); setAbsenceType('none'); setNotes(''); setError(null);
  };

  if (!open) return null;
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!staffId) return setError('Pick a staff member.');
    if (!clockIn && !clockOut && absenceType === 'none') return setError('Provide a clock time or legal absence type.');
    mu.mutate({
      staffId,
      clockInDate:  date,
      clockInTime:  absenceType === 'none' ? (clockIn || undefined) : undefined,
      clockOutTime: absenceType === 'none' ? (clockOut || undefined) : undefined,
      absenceType:  absenceType === 'none' ? undefined : absenceType,
      notes:        notes.trim() || undefined,
    });
  };

  return (
    <div role="dialog" aria-modal="true"
      style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'grid', placeItems: 'center', background: 'rgba(14,10,10,0.42)', padding: 16 }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form onSubmit={onSubmit} className="bg-white rounded-2xl shadow-pop"
        style={{ width: '100%', maxWidth: 520, border: '1px solid rgba(26,22,18,0.10)' }}>
        <header className="px-4 py-3 border-b border-line">
          <span className="text-xs font-semibold uppercase tracking-wider text-brand-500">Backdated</span>
          <h2 className="text-xl font-bold mt-0.5">Manual attendance entry</h2>
          <p className="text-xs text-neutral-500 mt-0.5">For filling in shifts the live clock missed — pick any date.</p>
        </header>
        <div className="px-4 py-3 grid grid-cols-2 gap-3 text-sm">
          <label className="grid gap-1 col-span-2">
            <span className="text-xs font-semibold uppercase text-neutral-600">Staff member *</span>
            <select className="field-input" value={staffId ?? ''} onChange={(e) => setStaffId(e.target.value ? Number(e.target.value) : null)} required>
              <option value="">— select —</option>
              {staffList.map((s: any) => <option key={s.id} value={s.id}>{s.name}{s.role ? ` · ${s.role}` : ''}</option>)}
            </select>
          </label>
          <label className="grid gap-1 col-span-2">
            <span className="text-xs font-semibold uppercase text-neutral-600">Date *</span>
            <input type="date" className="field-input num" value={date} onChange={(e) => setDate(e.target.value)} required max={new Date().toISOString().slice(0, 10)}/>
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-semibold uppercase text-neutral-600">Clock in</span>
            <input type="time" className="field-input num" value={clockIn} onChange={(e) => setClockIn(e.target.value)}/>
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-semibold uppercase text-neutral-600">Clock out</span>
            <input type="time" className="field-input num" value={clockOut} onChange={(e) => setClockOut(e.target.value)}/>
          </label>
          <label className="grid gap-1 col-span-2">
            <span className="text-xs font-semibold uppercase text-neutral-600">Legal absence</span>
            <select className="field-input" value={absenceType} onChange={(e) => setAbsenceType(e.target.value as any)}>
              <option value="none">None</option>
              <option value="holiday">Holiday</option>
              <option value="pto">PTO</option>
              <option value="sickday">Sickday</option>
            </select>
          </label>
          <label className="grid gap-1 col-span-2">
            <span className="text-xs font-semibold uppercase text-neutral-600">Notes</span>
            <input className="field-input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Reason for manual entry (optional)"/>
          </label>
          {error && <div className="col-span-2 rounded-xl px-3 py-2 text-brand-500 bg-brand-50" role="alert">{error}</div>}
        </div>
        <footer className="px-4 py-3 border-t border-line flex items-center justify-end gap-2">
          <button type="button" className="btn-outline text-sm" onClick={onClose} disabled={mu.isLoading}>Cancel</button>
          <button type="submit" className="btn-primary text-sm" disabled={mu.isLoading}>
            <Calendar size={14}/> {mu.isLoading ? 'Saving…' : 'Add to ledger'}
          </button>
        </footer>
      </form>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// WS5-B — HR home expiry banner. Aggregates documents within the 30-day
// window so the HR lead sees the heads-up the moment they land on the
// roster. Falls through to nothing when no documents are due.
// ────────────────────────────────────────────────────────────────────────
function DocumentExpiryBanner() {
  // No optional-chain on the tRPC call: Vite compiles `?.()` to `.call(this, …)`,
  // which the tRPC recursive proxy treats as a path segment and then crashes on
  // `hooks['call']`. See AppShell NotificationBell for the full write-up.
  const q = (trpc.staffManagement as any).expiringDocuments.useQuery(
    { withinDays: 30 }, { keepPreviousData: true },
  );
  const rows: any[] = q?.data?.success ? (q.data.rows ?? []) : [];
  if (rows.length === 0) return null;
  const expired = rows.filter((r: any) => r.doc.expiresAt && new Date(r.doc.expiresAt) < new Date()).length;
  const soon    = rows.length - expired;
  const tone = expired > 0 ? '!border-l-brand-500' : '!border-l-amber-500';
  const dotTone = expired > 0 ? 'bg-brand-500' : 'bg-amber-500';
  return (
    <div className={`card-feature border-l-4 ${tone} mb-4 flex flex-col md:flex-row md:items-center gap-4`}>
      <div className="flex items-start gap-3 flex-1">
        <span className={`!w-10 !h-10 !rounded-xl grid place-items-center text-white ${dotTone}`}><AlertOctagon size={16}/></span>
        <div>
          <div className="text-xs font-bold tracking-[0.14em] text-brand-600">
            {expired > 0 ? 'DOCUMENT EXPIRY' : 'DOCUMENT REMINDER'}
          </div>
          <div className="font-semibold text-black mt-1">
            {expired > 0 && <span>{expired} expired · </span>}
            {soon > 0 && <span>{soon} expiring within 30 days</span>}
          </div>
          <div className="text-sm text-neutral-500 mt-0.5">
            {rows.slice(0, 3).map((r: any) => `${r.staffName} (${String(r.doc.docType).replace(/_/g, ' ')})`).join(', ')}
            {rows.length > 3 ? `, +${rows.length - 3} more` : ''}
          </div>
        </div>
      </div>
      <a href="/hr?tab=documents" className="btn-primary !py-2.5 !px-5 !rounded-xl text-sm">Review documents</a>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────
// WS5-A — Employee documents. Per-staff list + upload form + status
// chip (Valid / Expiring within 30d / Expired) + delete.
// ────────────────────────────────────────────────────────────────────────
import { FileUploader, type UploadedFile } from '../components/forms/FileUploader';

const DOC_TYPES: { value: string; label: string }[] = [
  { value: 'contract',         label: 'Contract' },
  { value: 'national_id',      label: 'National ID' },
  { value: 'ghana_card',       label: 'Ghana Card' },
  { value: 'drivers_license',  label: "Driver's licence" },
  { value: 'certification',    label: 'Certification' },
  { value: 'medical',          label: 'Medical' },
  { value: 'training',         label: 'Training certificate' },
  { value: 'other',            label: 'Other' },
];

function DocumentsTab() {
  const utils = trpc.useUtils();
  const staffQ = trpc.staffManagement.list.useQuery(undefined as any, { keepPreviousData: true });
  const staffList: any[] = staffQ.data?.success ? staffQ.data.staff ?? [] : [];
  const [staffId, setStaffId] = useState<number | null>(null);
  const docsQ = trpc.staffManagement.listDocuments.useQuery(
    staffId ? { staffId } : (undefined as any),
    { keepPreviousData: true, enabled: !!staffId },
  );
  const docs: any[] = docsQ.data?.success ? docsQ.data.documents ?? [] : [];

  const [docType, setDocType]   = useState<string>('contract');
  const [files, setFiles]       = useState<UploadedFile[]>([]);
  const [expiresAt, setExpires] = useState<string>('');
  const [notes, setNotes]       = useState<string>('');
  const [err, setErr]           = useState<string | null>(null);

  const upload = trpc.staffManagement.uploadDocument.useMutation({
    onSuccess: (d: any) => {
      if (d?.success === false) { setErr(d.error); return; }
      setFiles([]); setExpires(''); setNotes(''); setErr(null);
      utils.staffManagement.listDocuments.invalidate();
    },
    onError: (e) => setErr(e.message),
  });
  const remove = trpc.staffManagement.deleteDocument.useMutation({
    onSuccess: () => utils.staffManagement.listDocuments.invalidate(),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault(); setErr(null);
    if (!staffId)        return setErr('Pick a staff member.');
    if (files.length === 0) return setErr('Attach a file.');
    const f = files[0];
    upload.mutate({
      staffId, docType: docType as any,
      filename: f.name, mimeType: f.type, base64: f.base64,
      expiresAt: expiresAt || undefined,
      notes: notes.trim() || undefined,
    });
  };

  const statusChip = (s: 'valid' | 'expiring' | 'expired') => {
    if (s === 'expired')  return <span className="chip-red">EXPIRED</span>;
    if (s === 'expiring') return <span className="chip bg-amber-50 text-amber-700">EXPIRING</span>;
    return <span className="chip bg-emerald-50 text-emerald-700">VALID</span>;
  };

  return (
    <section className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-4">
      <article className="bg-white rounded-2xl border border-line overflow-hidden">
        <header className="px-4 py-3 border-b border-line bg-canvas">
          <h2 className="font-semibold flex items-center gap-2"><FileText size={14}/> Upload document</h2>
          <p className="text-xs text-neutral-500 mt-0.5">PDF, JPG, PNG or DOCX. Optional expiry triggers 30-day + 7-day reminders.</p>
        </header>
        <form onSubmit={onSubmit} className="p-4 grid gap-3">
          <label className="grid gap-1 text-sm">
            <span className="text-xs font-semibold uppercase text-neutral-600">Staff member *</span>
            <select className="field-input" value={staffId ?? ''} onChange={(e) => setStaffId(e.target.value ? Number(e.target.value) : null)} required>
              <option value="">— select —</option>
              {staffList.map((s: any) => <option key={s.id} value={s.id}>{s.name}{s.role ? ` · ${s.role}` : ''}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-xs font-semibold uppercase text-neutral-600">Document type *</span>
            <select className="field-input" value={docType} onChange={(e) => setDocType(e.target.value)}>
              {DOC_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
          </label>
          <FileUploader label="File *" value={files} onChange={setFiles} maxSizeMb={10} multiple={false} />
          <label className="grid gap-1 text-sm">
            <span className="text-xs font-semibold uppercase text-neutral-600">Expires (optional)</span>
            <input type="date" className="field-input" value={expiresAt} onChange={(e) => setExpires(e.target.value)} />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-xs font-semibold uppercase text-neutral-600">Notes</span>
            <textarea className="field-input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          {err && <div className="rounded-xl px-3 py-2 text-sm text-brand-500 bg-brand-50" role="alert">{err}</div>}
          <button type="submit" className="btn-primary text-sm" disabled={upload.isLoading}>
            {upload.isLoading ? 'Uploading…' : 'Upload'}
          </button>
        </form>
      </article>

      <article className="bg-white rounded-2xl border border-line overflow-hidden">
        <header className="px-4 py-3 border-b border-line bg-canvas flex items-center justify-between">
          <h2 className="font-semibold">{staffId ? `Documents — ${staffList.find((s: any) => s.id === staffId)?.name ?? ''}` : 'Documents'}</h2>
          <span className="text-xs text-neutral-500">{docs.length} on file</span>
        </header>
        {!staffId && <div className="px-4 py-8 text-center text-sm text-neutral-500">Pick a staff member to view documents.</div>}
        {staffId && docsQ.isLoading && <div className="px-4 py-8 text-center text-sm text-neutral-500"><Loader2 size={14} className="animate-spin inline"/> Loading…</div>}
        {staffId && !docsQ.isLoading && docs.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-neutral-500">No documents uploaded yet.</div>
        )}
        {docs.length > 0 && (
          <div className="agl-scroll-x">
            <table className="w-full min-w-[640px]">
              <thead><tr>
                <th className="t-th">Type</th>
                <th className="t-th">File</th>
                <th className="t-th">Uploaded</th>
                <th className="t-th">Expires</th>
                <th className="t-th">Status</th>
                <th className="t-th"></th>
              </tr></thead>
              <tbody>
                {docs.map((d: any) => (
                  <tr key={d.id}>
                    <td className="t-td capitalize">{String(d.docType).replace(/_/g, ' ')}</td>
                    <td className="t-td truncate max-w-[24ch]" title={d.filename}>{d.filename}</td>
                    <td className="t-td num">{new Date(d.createdAt).toLocaleDateString()}</td>
                    <td className="t-td num">{d.expiresAt ? new Date(d.expiresAt).toLocaleDateString() : '—'}</td>
                    <td className="t-td">{statusChip(d.status)}</td>
                    <td className="t-td">
                      <button type="button" className="text-brand-500 hover:text-brand-600 text-xs"
                              onClick={() => { if (window.confirm(`Delete ${d.filename}?`)) remove.mutate({ id: d.id }); }}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────
// ROSTER (unchanged from prior version, kept inline for the tab shell)
// ────────────────────────────────────────────────────────────────────────

function RosterTab() {
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<StaffRow | null>(null);
  const utils = trpc.useUtils();
  const q = trpc.staffManagement.list.useQuery(undefined as any, { keepPreviousData: true });
  const rows = q.data?.success ? q.data.staff ?? [] : [];
  const err = q.error?.message ?? (q.data?.success === false ? q.data.error : null);

  return (
    <>
      <div className="flex items-end justify-end mb-3">
        <button className="btn-primary text-sm" onClick={() => setAddOpen(true)}>
          <UserPlus size={14} /> Add Member
        </button>
      </div>
      {err && <div className="rounded-2xl px-4 py-3 mb-3 text-sm bg-brand-50 text-brand-500">{err}</div>}
      <div className="bg-white rounded-2xl overflow-hidden border border-line">
        <div style={{ overflowX: 'auto' }}>
          <table className="w-full">
            <thead><tr>
              <th className="t-th">Name</th><th className="t-th">Role</th><th className="t-th">Phone</th>
              <th className="t-th">Email</th><th className="t-th">Pay basis</th><th className="t-th">Status</th>
              <th className="t-th" style={{ width: '4rem' }}></th>
            </tr></thead>
            <tbody>
              {q.isLoading && <tr><td colSpan={7} className="px-4 py-6 text-center text-sm text-neutral-500"><Loader2 size={14} className="animate-spin inline" /> Loading…</td></tr>}
              {!q.isLoading && rows.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-sm text-neutral-500">No team members yet.</td></tr>}
              {!q.isLoading && rows.map((m: any) => (
                <tr key={m.id}>
                  <td className="t-td font-semibold">{m.name}</td>
                  <td className="t-td">{ROLE_LABELS[m.role as Role] ?? m.role}</td>
                  <td className="t-td num">{m.phone ?? '—'}</td>
                  <td className="t-td">{m.email ?? '—'}</td>
                  <td className="t-td capitalize">{m.salaryType ?? '—'}</td>
                  <td className={`t-td capitalize ${STATUS_TONE[m.status as Status] ?? ''}`}>{m.status ?? '—'}</td>
                  <td className="t-td">
                    <button type="button" className="rounded-lg p-1 text-neutral-600 hover:bg-canvas hover:text-black"
                      onClick={() => setEditing({
                        id: m.id, name: m.name ?? '', role: (m.role ?? 'mechanic') as Role,
                        phone: m.phone ?? null, email: m.email ?? null,
                        salaryType: (m.salaryType ?? 'monthly') as SalaryType,
                        hourlyRate: m.hourlyRate != null ? Number(m.hourlyRate) : null,
                        baseMonthlyNet: m.baseMonthlyNet != null ? Number(m.baseMonthlyNet) : null,
                        hireDate: m.hireDate ? String(m.hireDate).slice(0,10) : null,
                        status: (m.status ?? 'active') as Status,
                        ghanaCardId:     m.ghanaCardId     ?? null,
                        ssnit:           m.ssnit           ?? null,
                        healthInsurance: m.healthInsurance ?? null,
                        workStart:       m.workStart       ?? null,
                        workEnd:         m.workEnd         ?? null,
                      })}
                      title="Edit"><Pencil size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <StaffModal open={addOpen} existing={null} onClose={() => setAddOpen(false)}
                  onSaved={() => { setAddOpen(false); utils.staffManagement.list.invalidate(); }} />
      <StaffModal open={editing !== null} existing={editing} onClose={() => setEditing(null)}
                  onSaved={() => { setEditing(null); utils.staffManagement.list.invalidate(); }} />
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────
// CLOCK IN/OUT (absorbed from /clock standalone page)
// ────────────────────────────────────────────────────────────────────────

function ClockTab() {
  const [now, setNow] = useState(new Date());
  useMemo(() => { const t = setInterval(() => setNow(new Date()), 60_000); return () => clearInterval(t); }, []);
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [selectedStaffId, setSelectedStaffId] = useState<number | null>(null);

  const staffQ = trpc.staffManagement.list.useQuery({ status: 'active' } as any);
  const rawStaffList: any[] = staffQ.data?.success ? staffQ.data.staff ?? [] : [];
  const staffList = rawStaffList.filter((s: any) => isAttendanceRosterRole(s.role));

  const attendanceQ = trpc.staffManagement.listAttendance.useQuery(undefined as any, { keepPreviousData: true });
  const logs: any[] = attendanceQ.data?.success ? attendanceQ.data.attendanceLogs ?? [] : [];

  const utils = trpc.useUtils();
  const invalidate = () => { utils.staffManagement.list.invalidate(); utils.staffManagement.listAttendance.invalidate(); };
  const clockIn = trpc.staffManagement.clockIn.useMutation({ onSuccess: invalidate });
  const clockOut = trpc.staffManagement.clockOut.useMutation({ onSuccess: invalidate });

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

  const [manualOpen, setManualOpen] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-neutral-600">
          Working day {POLICY.workStart} → {POLICY.workEnd}. Late after {POLICY.workStart} (GHS {POLICY.latePenalty}). Missed punches GHS {POLICY.missedPunchPenalty} each. Overtime {POLICY.overtimeMultiplier}× hourly.
        </p>
        <div className="flex items-center gap-3">
          <button type="button" className="btn-outline text-sm" onClick={() => setManualOpen(true)}>
            <Calendar size={14}/> Manual entry
          </button>
          <div className="text-right">
            <div className="text-xs font-bold uppercase tracking-wider text-neutral-500">Current time</div>
            <div className="num text-2xl font-bold text-brand-600">{fmtTime(now)}</div>
          </div>
        </div>
      </div>
      <ManualAttendanceModal
        open={manualOpen}
        staffList={staffList}
        onClose={() => setManualOpen(false)}
        onSaved={() => { setManualOpen(false); invalidate(); utils.staffManagement.listImportedAttendance.invalidate(); }}
      />

      <section className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4">
        <article className="bg-white rounded-2xl border border-line overflow-hidden">
          <header className="px-4 py-3 border-b border-line bg-canvas">
            <h2 className="font-semibold">Active staff</h2>
            <p className="text-xs text-neutral-500">Tap to clock in/out.</p>
          </header>
          <div className="divide-y divide-line">
            {staffQ.isLoading && <div className="px-4 py-6 text-center text-sm text-neutral-500"><Loader2 size={14} className="animate-spin inline" /> Loading…</div>}
            {!staffQ.isLoading && staffList.length === 0 && <div className="px-4 py-6 text-center text-sm text-neutral-500">No active staff yet.</div>}
            {staffList.map((s: any) => {
              const openLog = openLogByStaffId.get(s.id);
              const isOn = !!openLog;
              return (
                <div key={s.id} className="px-4 py-3 flex items-center gap-3">
                  <button type="button" onClick={() => setSelectedStaffId(s.id)}
                          className={`text-left flex-1 ${selectedStaffId === s.id ? 'text-brand-600 font-semibold' : ''}`}>
                    <div className="font-semibold">{s.name}</div>
                    <div className="text-xs text-neutral-500 capitalize">{s.role}</div>
                    {isOn && <div className="text-xs text-emerald-700 mt-0.5">In since {fmtTime(new Date(openLog.clockInTime))} ({elapsed(new Date(openLog.clockInTime), now)})</div>}
                  </button>
                  {isOn ? (
                    <button type="button" disabled={clockOut.isLoading} onClick={() => clockOut.mutate({ attendanceLogId: openLog.id })}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50">
                      <LogOut size={14} /> Clock out
                    </button>
                  ) : (
                    <button type="button" disabled={clockIn.isLoading} onClick={() => clockIn.mutate({ staffId: s.id })}
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
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
            <p className="text-xs text-neutral-500">Penalty + overtime calc for selected staff.</p>
          </header>
          <div className="p-4 grid gap-3">
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs"><span className="block text-neutral-500 mb-1">Year</span><input type="number" className="field-input num w-full" value={year} onChange={(e) => setYear(parseInt(e.target.value || `${today.getFullYear()}`, 10))} /></label>
              <label className="text-xs"><span className="block text-neutral-500 mb-1">Month</span>
                <select className="field-input w-full" value={month} onChange={(e) => setMonth(parseInt(e.target.value, 10))}>
                  {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Date(2024, i, 1).toLocaleString(undefined, { month: 'long' })}</option>)}
                </select>
              </label>
            </div>
            {!selectedStaffId && <div className="text-sm text-neutral-500">Select a staff member on the left.</div>}
            {selectedStaffId && summaryQ.isLoading && <div className="text-sm text-neutral-500"><Loader2 size={14} className="animate-spin inline" /> Calculating…</div>}
            {summary && (
              <div className="grid gap-2 text-sm">
                <Row label="Staff">{summary.staffName}</Row>
                <Row label="Working days">{summary.workingDays}</Row>
                <Row label="Hourly rate">{ghs(summary.hourlyRate)}</Row>
                <Row label="Regular hours">{summary.regularHours.toFixed(2)}</Row>
                <Row label="Overtime hours">{summary.overtimeHours.toFixed(2)} <span className="text-xs text-neutral-500">× 1.5</span></Row>
                <Row label="Overtime pay" tone="emerald">+ {ghs(summary.overtimePay)}</Row>
                <Row label="Late + missed">{summary.lateCount + summary.missedPunchCount}</Row>
                <Row label="Total penalties" tone="brand">− {ghs(summary.totalPenalty)}</Row>
                <div className="mt-2 pt-2 border-t border-line flex items-center justify-between">
                  <span className="font-semibold">Gross payable</span>
                  <span className="num text-lg font-bold text-brand-600">{ghs(summary.grossPay)}</span>
                </div>
              </div>
            )}
          </div>
        </article>
      </section>

      <AttendanceLedger />
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────
// ATTENDANCE LEDGER — historical clock-in/out from the master sheet
// (imported via the Excel pipeline into `staff_attendance`). Distinct
// from the live `staff_attendance_logs` we write from this app.
// ────────────────────────────────────────────────────────────────────────

function AttendanceLedger() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const [search, setSearch] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate]     = useState('');
  const [onlyLate, setOnlyLate] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const canEditLedger = !!user?.canEditLedgers || ['admin', 'owner', 'manager', 'operations_manager', 'principal'].includes(String(user?.role ?? '').toLowerCase());
  const q = trpc.staffManagement.listImportedAttendance.useQuery(undefined as any, { keepPreviousData: true });
  const all: any[] = q.data?.success ? q.data.rows ?? [] : [];

  const rows = useMemo(() => {
    const s = search.trim().toLowerCase();
    return all.filter((r: any) => {
      if (s) {
        const hay = `${r.staffName ?? ''} ${r.role ?? ''} ${r.notes ?? ''}`.toLowerCase();
        if (!hay.includes(s)) return false;
      }
      if (onlyLate && !r.isLate) return false;
      if (fromDate || toDate) {
        const d = r.clockInDate ? String(r.clockInDate).slice(0, 10) : '';
        if (fromDate && d < fromDate) return false;
        if (toDate   && d > toDate)   return false;
      }
      return true;
    });
  }, [all, search, fromDate, toDate, onlyLate]);

  const totals = useMemo(() => rows.reduce((acc, r: any) => ({
    sessions:    acc.sessions + 1,
    hours:       acc.hours + (Number(r.hoursWorked ?? 0) || 0),
    late:        acc.late  + (r.isLate ? 1 : 0),
    missedIn:    acc.missedIn  + (!r.clockInTime  ? 1 : 0),
    missedOut:   acc.missedOut + (!r.clockOutTime ? 1 : 0),
  }), { sessions: 0, hours: 0, late: 0, missedIn: 0, missedOut: 0 }), [rows]);

  return (
    <section className="mt-5">
      <header className="flex items-end justify-between gap-3 flex-wrap mb-2">
        <div>
          <h2 className="font-semibold flex items-center gap-2"><Calendar size={14}/> Attendance Ledger</h2>
          <p className="text-xs text-neutral-500 mt-0.5">Historical clock-in / clock-out records — imported from the master sheet.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-neutral-600 flex-wrap">
          <span><strong className="num">{totals.sessions}</strong> sessions</span>
          <span>·</span>
          <span><strong className="num">{totals.hours.toFixed(1)}</strong> hours</span>
          <span>·</span>
          <span className="text-brand-500"><strong className="num">{totals.late}</strong> late</span>
          <span>·</span>
          <span className="text-amber-700"><strong className="num">{totals.missedIn}</strong> no IN</span>
          <span>·</span>
          <span className="text-amber-700"><strong className="num">{totals.missedOut}</strong> no OUT</span>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2 mb-2">
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)}
          placeholder="Search staff, role, notes…"
          className="field-input text-sm" style={{ minWidth: 220, flex: '1 1 220px', maxWidth: 360 }} />
        <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="field-input text-sm" title="From"/>
        <span className="text-neutral-500 text-xs">→</span>
        <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="field-input text-sm" title="To"/>
        <label className="inline-flex items-center gap-1 text-xs text-neutral-700">
          <input type="checkbox" checked={onlyLate} onChange={(e) => setOnlyLate(e.target.checked)}/>
          Late only
        </label>
        {(search || fromDate || toDate || onlyLate) && (
          <button onClick={() => { setSearch(''); setFromDate(''); setToDate(''); setOnlyLate(false); }}
            className="text-xs text-neutral-700 hover:text-brand-500 underline underline-offset-2">Clear</button>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-line overflow-hidden">
        <div
          className="agl-scroll-x"
          style={{ maxHeight: 'calc(100vh - 360px)', overflowY: 'auto', scrollbarGutter: 'stable' }}
        >
          <table className="w-full min-w-[860px]">
            <thead><tr>
              <th className="t-th">Date</th>
              <th className="t-th">Staff</th>
              <th className="t-th">Role</th>
              <th className="t-th">Clock In</th>
              <th className="t-th">Clock Out</th>
              <th className="t-th">Hours</th>
              <th className="t-th">Late?</th>
              <th className="t-th">Notes</th>
              {canEditLedger && <th className="t-th text-right">Edit</th>}
            </tr></thead>
            <tbody>
              {q.isLoading && (
                <tr><td colSpan={canEditLedger ? 9 : 8} className="px-4 py-6 text-center text-sm text-neutral-500">
                  <Loader2 size={14} className="inline animate-spin mr-1"/> Loading ledger…
                </td></tr>
              )}
              {!q.isLoading && rows.length === 0 && (
                <tr><td colSpan={canEditLedger ? 9 : 8} className="px-4 py-6 text-center text-sm text-neutral-500">No attendance records match the filter.</td></tr>
              )}
              {rows.slice(0, 500).map((r: any) => {
                const d = r.clockInDate ? new Date(r.clockInDate).toLocaleDateString() : '—';
                const isImputed = String(r.notes ?? '').includes('imputed clock-in');
                const inMissing  = !r.clockInTime;
                const outMissing = !r.clockOutTime;
                const roleLabel = r.role ? String(r.role).replace('_', ' ') : '—';
                return (
                  <tr key={r.id}>
                    <td className="t-td whitespace-nowrap">{d}</td>
                    <td className="t-td font-semibold">{r.staffName ?? '—'}</td>
                    <td className="t-td capitalize">{roleLabel}</td>
                    <td className="t-td num">
                      {inMissing ? (
                        <span className="chip bg-brand-50 text-brand-600">no IN</span>
                      ) : (
                        <span className={isImputed ? 'text-amber-700' : ''} title={isImputed ? 'Back-computed from clock-out − hours worked' : undefined}>
                          {r.clockInTime}{isImputed && <sup className="ml-0.5 text-2xs">≈</sup>}
                        </span>
                      )}
                    </td>
                    <td className="t-td num">
                      {outMissing ? <span className="chip bg-brand-50 text-brand-600">no OUT</span> : r.clockOutTime}
                    </td>
                    <td className="t-td num">{r.hoursWorked != null ? Number(r.hoursWorked).toFixed(2) : '—'}</td>
                    <td className="t-td">
                      {inMissing ? '—' : r.isLate ? <span className="chip-red">LATE</span> : <span className="chip bg-emerald-50 text-emerald-700">on time</span>}
                    </td>
                    <td className="t-td max-w-[28ch] truncate" title={r.notes ?? ''}>{r.notes ?? ''}</td>
                    {canEditLedger && (
                      <td className="t-td text-right">
                        <button
                          type="button"
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-neutral-600 hover:bg-canvas hover:text-brand-500"
                          onClick={() => setEditing(r)}
                          title="Edit attendance row"
                          aria-label={`Edit attendance row for ${r.staffName ?? 'staff'}`}
                        >
                          <Pencil size={13} />
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {rows.length > 500 && (
          <p className="px-3 py-2 text-2xs text-neutral-500">Showing first 500 of {rows.length}. Tighten filters to narrow further.</p>
        )}
      </div>
      {editing && (
        <AttendanceEditModal
          row={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            utils.staffManagement.listImportedAttendance.invalidate();
            utils.payroll.computeMonthly.invalidate();
          }}
        />
      )}
    </section>
  );
}

// ────────────────────────────────────────────────────────────────────────
// PAYROLL SUMMARY — current-month roll-up across all staff
// ────────────────────────────────────────────────────────────────────────

function AttendanceEditModal({ row, onClose, onSaved }: { row: any; onClose: () => void; onSaved: () => void }) {
  const dateOnly = (value: any) => {
    if (!value) return new Date().toISOString().slice(0, 10);
    if (typeof value === 'string') return value.slice(0, 10);
    return new Date(value).toISOString().slice(0, 10);
  };
  const detectedAbsence = /Absence:\s*Holiday/i.test(row.notes ?? '')
    ? 'holiday'
    : /Absence:\s*PTO/i.test(row.notes ?? '')
      ? 'pto'
      : /Absence:\s*Sickday/i.test(row.notes ?? '')
        ? 'sickday'
        : 'none';

  const [clockInDate, setClockInDate] = useState(dateOnly(row.clockInDate));
  const [clockInTime, setClockInTime] = useState(row.clockInTime ?? '');
  const [clockOutTime, setClockOutTime] = useState(row.clockOutTime ?? '');
  const [absenceType, setAbsenceType] = useState<'none' | 'holiday' | 'pto' | 'sickday'>(detectedAbsence);
  const [notes, setNotes] = useState(String(row.notes ?? ''));
  const [error, setError] = useState<string | null>(null);

  const update = trpc.staffManagement.updateImportedAttendance.useMutation({
    onSuccess: (d: any) => {
      if (d?.success === false) { setError(d.error ?? 'Could not update attendance row.'); return; }
      onSaved();
    },
    onError: (e) => setError(e.message),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    update.mutate({
      id: row.id,
      clockInDate,
      clockInTime: absenceType === 'none' ? clockInTime : null,
      clockOutTime: absenceType === 'none' ? clockOutTime : null,
      absenceType,
      notes: notes.trim() || null,
    });
  };

  return (
    <div role="dialog" aria-modal="true"
      style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'grid', placeItems: 'center', background: 'rgba(14,10,10,0.42)', padding: 16 }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form onSubmit={onSubmit} className="bg-white rounded-2xl shadow-pop"
        style={{ width: '100%', maxWidth: 520, border: '1px solid rgba(26,22,18,0.10)' }}>
        <header className="px-4 py-3 border-b border-line">
          <span className="text-xs font-semibold uppercase tracking-wider text-brand-500">Attendance Ledger</span>
          <h2 className="text-xl font-bold mt-0.5">Edit {row.staffName ?? 'attendance'}</h2>
        </header>
        <div className="px-4 py-3 grid grid-cols-2 gap-3 text-sm">
          <label className="grid gap-1 col-span-2">
            <span className="text-xs font-semibold uppercase text-neutral-600">Date</span>
            <input type="date" className="field-input num" value={clockInDate} onChange={(e) => setClockInDate(e.target.value)} required />
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-semibold uppercase text-neutral-600">Clock in</span>
            <input type="time" className="field-input num" value={clockInTime} onChange={(e) => setClockInTime(e.target.value)} disabled={absenceType !== 'none'} />
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-semibold uppercase text-neutral-600">Clock out</span>
            <input type="time" className="field-input num" value={clockOutTime} onChange={(e) => setClockOutTime(e.target.value)} disabled={absenceType !== 'none'} />
          </label>
          <label className="grid gap-1 col-span-2">
            <span className="text-xs font-semibold uppercase text-neutral-600">Legal absence</span>
            <select className="field-input" value={absenceType} onChange={(e) => setAbsenceType(e.target.value as any)}>
              <option value="none">None</option>
              <option value="holiday">Holiday</option>
              <option value="pto">PTO</option>
              <option value="sickday">Sickday</option>
            </select>
          </label>
          <label className="grid gap-1 col-span-2">
            <span className="text-xs font-semibold uppercase text-neutral-600">Notes</span>
            <textarea rows={3} className="field-input" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          {error && <div className="col-span-2 rounded-xl px-3 py-2 text-brand-500 bg-brand-50" role="alert">{error}</div>}
        </div>
        <footer className="px-4 py-3 border-t border-line flex items-center justify-end gap-2">
          <button type="button" className="btn-outline text-sm" onClick={onClose} disabled={update.isLoading}>Cancel</button>
          <button type="submit" className="btn-primary text-sm" disabled={update.isLoading}>
            <Pencil size={14} /> {update.isLoading ? 'Saving...' : 'Save changes'}
          </button>
        </footer>
      </form>
    </div>
  );
}

function PayrollSummaryTab() {
  const today = new Date();
  const defaultPeriod = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const [year, setYear] = useState(defaultPeriod.getFullYear());
  const [month, setMonth] = useState(defaultPeriod.getMonth() + 1);
  const q = trpc.payroll.computeMonthly.useQuery({ year, month }, { keepPreviousData: true });
  const data: any = q.data?.success ? q.data : null;
  const breakdowns: any[] = data?.breakdowns ?? [];
  const summary: any = data?.summary ?? null;

  const totals = useMemo(() => breakdowns.reduce((acc, b) => ({
    base: acc.base + b.baseMonthlyNet, bonus: acc.bonus + b.bonusShare,
    ot: acc.ot + b.overtimePay, penalties: acc.penalties + b.latePenalty + b.noClockOutPenalty + b.recallPenaltyShare,
    net: acc.net + b.netPay,
  }), { base: 0, bonus: 0, ot: 0, penalties: 0, net: 0 }), [breakdowns]);

  return (
    <>
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm text-neutral-600">Per-staff payroll = base + bonus + overtime − (late + missed-clockout + recall).</p>
        <div className="flex items-center gap-2">
          <input type="number" className="field-input num text-sm" value={year} onChange={(e) => setYear(parseInt(e.target.value || `${today.getFullYear()}`, 10))} style={{ width: 90 }} />
          <select className="field-input text-sm" value={month} onChange={(e) => setMonth(parseInt(e.target.value, 10))}>
            {Array.from({ length: 12 }, (_, i) => <option key={i + 1} value={i + 1}>{new Date(2024, i, 1).toLocaleString(undefined, { month: 'long' })}</option>)}
          </select>
        </div>
      </div>

      <section className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <Kpi label="Base pay" value={ghs(totals.base)} />
        <Kpi label="Bonus" value={ghs(totals.bonus)} tone="emerald" />
        <Kpi label="Overtime" value={ghs(totals.ot)} tone="emerald" />
        <Kpi label="Penalties" value={`− ${ghs(totals.penalties)}`} tone="brand" />
        <Kpi label="Net payroll" value={ghs(totals.net)} tone="brand" />
      </section>

      {summary && (
        <div className="mb-4 rounded-2xl bg-white px-4 py-3 text-sm text-neutral-600 border border-line">
          Payroll source: {summary.importedAttendanceRows ?? 0} imported row(s), {summary.matchedImportedRows ?? 0} matched, {summary.liveAttendanceRows ?? 0} live clock row(s), {summary.excusedAbsences ?? 0} excused, {summary.unmatchedImportedRows ?? 0} unmatched.
        </div>
      )}

      <div className="bg-white rounded-2xl border border-line overflow-hidden">
        <div style={{ overflowX: 'auto' }}>
          <table className="w-full text-sm">
            <thead><tr>
              <th className="t-th">Staff</th><th className="t-th">Base</th><th className="t-th">Bonus</th>
              <th className="t-th">OT</th><th className="t-th">Late</th><th className="t-th">Missed</th>
              <th className="t-th">Recall</th><th className="t-th">Net</th>
            </tr></thead>
            <tbody>
              {q.isLoading && <tr><td colSpan={8} className="px-4 py-6 text-center text-neutral-500"><Loader2 size={14} className="animate-spin inline" /> Loading…</td></tr>}
              {!q.isLoading && breakdowns.length === 0 && <tr><td colSpan={8} className="px-4 py-6 text-center text-neutral-500">No payroll rows for this month. Check the staff roster and attendance ledger.</td></tr>}
              {breakdowns.map((b: any) => (
                <tr key={b.staffId}>
                  <td className="t-td font-semibold">{b.staffName}</td>
                  <td className="t-td num">{ghs(b.baseMonthlyNet)}</td>
                  <td className="t-td num text-emerald-700">{b.bonusShare ? ghs(b.bonusShare) : '—'}</td>
                  <td className="t-td num text-emerald-700">{b.overtimePay ? ghs(b.overtimePay) : '—'}</td>
                  <td className="t-td num text-brand-500">{b.latePenalty ? ghs(b.latePenalty) : '—'}</td>
                  <td className="t-td num text-brand-500">{b.noClockOutPenalty ? ghs(b.noClockOutPenalty) : '—'}</td>
                  <td className="t-td num text-brand-500">{b.recallPenaltyShare ? ghs(b.recallPenaltyShare) : '—'}</td>
                  <td className="t-td num font-bold">{ghs(b.netPay)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────
// PERFORMANCE — per-staff KPIs + bar chart
// ────────────────────────────────────────────────────────────────────────

type PerfPeriod = 'week' | 'month' | 'quarter' | 'year' | 'all' | 'custom';
type PerfRole = 'all' | 'mechanic' | 'sales_rep';

function PerformanceTab() {
  const today = new Date();
  const [period, setPeriod] = useState<PerfPeriod>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [roleTab, setRoleTab] = useState<PerfRole>('all');

  // ── Date range from period selector ────────────────────────────────────
  const { startDate, endDate, label } = useMemo(() => {
    const eod = (d: Date) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; };
    if (period === 'week') {
      const s = new Date(today); s.setDate(today.getDate() - today.getDay()); s.setHours(0, 0, 0, 0);
      return { startDate: s, endDate: eod(today), label: 'This week' };
    }
    if (period === 'quarter') {
      const q = Math.floor(today.getMonth() / 3);
      const s = new Date(today.getFullYear(), q * 3, 1);
      return { startDate: s, endDate: eod(today), label: 'This quarter' };
    }
    if (period === 'year') {
      const s = new Date(today.getFullYear(), 0, 1);
      return { startDate: s, endDate: eod(today), label: 'This year' };
    }
    if (period === 'all') {
      return { startDate: new Date(2000, 0, 1), endDate: eod(today), label: 'All time' };
    }
    if (period === 'custom') {
      const s = customFrom ? new Date(customFrom) : new Date(2000, 0, 1);
      const e = customTo ? eod(new Date(customTo)) : eod(today);
      return { startDate: s, endDate: e, label: `${customFrom || '…'} → ${customTo || '…'}` };
    }
    // default: month
    const s = new Date(today.getFullYear(), today.getMonth(), 1);
    return { startDate: s, endDate: eod(today), label: 'This month' };
  }, [period, customFrom, customTo, today]);

  // ── Pull live data: mechanics from scoreboard, reps from sales ledger ──
  const scoreboardQ = trpc.mechanicTracker.scoreboard.useQuery(
    { startDate, endDate } as any,
    { keepPreviousData: true, retry: 0 },
  );
  const mechanics: any[] = scoreboardQ.data?.success ? scoreboardQ.data.scoreboard ?? [] : [];

  const salesQ = trpc.sales.list.useQuery({ startDate, endDate } as any, { keepPreviousData: true, retry: 0 });
  const sales: any[] = Array.isArray(salesQ.data) ? salesQ.data : (salesQ.data?.transactions ?? []);

  // Sales-rep aggregation derived from the sales ledger. Handles
  // "Yvonne x Bright" multi-name entries by splitting the same way the
  // Sales page does (covers joint shifts).
  const reps = useMemo(() => {
    const split = (raw: any): string[] => {
      if (!raw) return [];
      return String(raw).split(/\s*(?:x|×|,|\/|&|\+)\s*/i).map((s) => s.trim()).filter(Boolean);
    };
    const map = new Map<string, { name: string; orders: number; revenue: number; customers: Set<string>; lastSale: Date | null }>();
    for (const s of sales) {
      const names = split(s.sales_rep ?? s.salesRep);
      const amount = Number(s.total_amount ?? s.totalAmount ?? 0);
      const cust = String(s.customer_name ?? s.customerName ?? '').trim();
      const txDate = s.transaction_date ?? s.transactionDate;
      const txTime = txDate ? new Date(txDate) : null;
      for (const n of names) {
        const k = n.toLowerCase();
        const cur = map.get(k) ?? { name: n, orders: 0, revenue: 0, customers: new Set<string>(), lastSale: null };
        cur.orders += 1;
        cur.revenue += amount;
        if (cust) cur.customers.add(cust);
        if (txTime && (!cur.lastSale || txTime > cur.lastSale)) cur.lastSale = txTime;
        map.set(k, cur);
      }
    }
    return Array.from(map.values())
      .map((r) => ({ ...r, customers: r.customers.size }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [sales]);

  // Pick which bar-list to render based on the role tab.
  const showMechanics = roleTab === 'all' || roleTab === 'mechanic';
  const showReps      = roleTab === 'all' || roleTab === 'sales_rep';

  // Top-line KPIs combine both rosters so the totals reflect the whole org.
  const totals = useMemo(() => {
    const m = mechanics.reduce((acc: any, x: any) => ({
      jobs: acc.jobs + x.jobsCompleted, open: acc.open + x.openJobs,
      revenue: acc.revenue + x.revenueGenerated, recalls: acc.recalls + x.recallsAgainst,
    }), { jobs: 0, open: 0, revenue: 0, recalls: 0 });
    const r = reps.reduce((acc: any, x: any) => ({
      orders: acc.orders + x.orders, revenue: acc.revenue + x.revenue,
    }), { orders: 0, revenue: 0 });
    return { ...m, repOrders: r.orders, repRevenue: r.revenue };
  }, [mechanics, reps]);

  const mechSorted = [...mechanics].sort((a, b) => b.revenueGenerated - a.revenueGenerated);
  const maxMechRev = mechSorted.reduce((m: number, s: any) => Math.max(m, s.revenueGenerated), 1);
  const maxRepRev  = reps.reduce((m, s: any) => Math.max(m, s.revenue), 1);

  const anyLoading = scoreboardQ.isLoading || salesQ.isLoading;

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-3 mb-3">
        <div>
          <p className="text-sm text-neutral-600">
            Per-staff KPIs across <strong>{label}</strong>. Mechanics from workshop jobs; sales reps from the sales ledger.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {(['week','month','quarter','year','all','custom'] as PerfPeriod[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-colors ${
                period === p ? 'bg-brand-500 text-white' : 'bg-white border border-line text-neutral-600 hover:bg-canvas'
              }`}
            >
              {p === 'week' ? 'This week' : p === 'all' ? 'All time' : p}
            </button>
          ))}
          {period === 'custom' && (
            <span className="inline-flex items-center gap-1 text-xs">
              <input type="date" className="field-input text-xs" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
              <span className="text-neutral-500">→</span>
              <input type="date" className="field-input text-xs" value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
            </span>
          )}
        </div>
      </header>

      <nav className="flex items-center gap-1 mb-4 bg-white border border-line rounded-2xl p-1 w-fit">
        {([
          { id: 'all',       label: 'All staff' },
          { id: 'mechanic',  label: 'Mechanics' },
          { id: 'sales_rep', label: 'Sales reps' },
        ] as { id: PerfRole; label: string }[]).map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setRoleTab(r.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
              roleTab === r.id ? 'bg-brand-500 text-white' : 'text-neutral-600 hover:bg-canvas'
            }`}
          >
            {r.label}
          </button>
        ))}
      </nav>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <Kpi label="Workshop revenue"   value={ghs(totals.revenue)}    tone="emerald" />
        <Kpi label="Counter / parts"    value={ghs(totals.repRevenue)} tone="emerald" />
        <Kpi label="Jobs completed"     value={String(totals.jobs)} />
        <Kpi label="Sales orders"       value={String(totals.repOrders)} />
      </section>

      {anyLoading && (
        <div className="text-center text-neutral-500 mb-3"><Loader2 size={14} className="animate-spin inline mr-1" /> Loading…</div>
      )}

      {showMechanics && (
        <>
          <h2 className="font-semibold mb-2 flex items-center gap-2"><BarChart3 size={14}/> Mechanics — revenue contribution</h2>
          <div className="bg-white rounded-2xl border border-line p-4 mb-5">
            {!anyLoading && mechSorted.length === 0 && (
              <div className="text-center text-neutral-500 text-sm">No completed workshop jobs in this period.</div>
            )}
            {mechSorted.map((m: any) => (
              <div key={m.staffId} className="mb-2 last:mb-0">
                <div className="flex items-center justify-between text-xs mb-0.5">
                  <span className="font-semibold">{m.name}</span>
                  <span className="num text-neutral-600">{ghs(m.revenueGenerated)} · {m.jobsCompleted} jobs · {m.recallsAgainst} recalls · {m.openJobs} open</span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-canvas overflow-hidden">
                  <div className="h-full bg-brand-500 transition-all" style={{ width: `${Math.max(2, (m.revenueGenerated / maxMechRev) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {showReps && (
        <>
          <h2 className="font-semibold mb-2 flex items-center gap-2"><BarChart3 size={14}/> Sales reps — revenue contribution</h2>
          <div className="bg-white rounded-2xl border border-line p-4 mb-5">
            {!anyLoading && reps.length === 0 && (
              <div className="text-center text-neutral-500 text-sm">No sales recorded in this period.</div>
            )}
            {reps.map((r: any) => (
              <div key={r.name} className="mb-2 last:mb-0">
                <div className="flex items-center justify-between text-xs mb-0.5">
                  <span className="font-semibold">{r.name}</span>
                  <span className="num text-neutral-600">
                    {ghs(r.revenue)} · {r.orders} order{r.orders === 1 ? '' : 's'} · {r.customers} customer{r.customers === 1 ? '' : 's'}
                    {r.lastSale ? ` · last ${new Date(r.lastSale).toLocaleDateString()}` : ''}
                  </span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-canvas overflow-hidden">
                  <div className="h-full bg-emerald-500 transition-all" style={{ width: `${Math.max(2, (r.revenue / maxRepRev) * 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

// ────────────────────────────────────────────────────────────────────────
// Helpers + StaffModal (unchanged from prior version)
// ────────────────────────────────────────────────────────────────────────

function Kpi({ label, value, tone }: { label: string; value: string; tone?: 'brand' | 'emerald' | 'ink' }) {
  const colour = tone === 'brand' ? 'text-brand-500' : tone === 'emerald' ? 'text-emerald-700' : 'text-ink-900';
  return (
    <article className="card-feature flex flex-col gap-1.5">
      <span className="text-[12.5px] font-bold tracking-[0.14em] text-neutral-500">{label.toUpperCase()}</span>
      <div className={`text-2xl md:text-3xl font-extrabold tracking-tight ${colour}`}>{value}</div>
    </article>
  );
}

function Row({ label, children, tone }: { label: string; children: any; tone?: 'brand' | 'emerald' }) {
  const colour = tone === 'brand' ? 'text-brand-500' : tone === 'emerald' ? 'text-emerald-700' : '';
  return (
    <div className="flex items-center justify-between">
      <span className="text-neutral-500">{label}</span>
      <span className={`num font-semibold ${colour}`}>{children}</span>
    </div>
  );
}

function fmtTime(d: Date) { return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }); }
function setHour(d: Date, h: number) { const c = new Date(d); c.setHours(h, 0, 0, 0); return c; }
function elapsed(from: Date, to: Date) {
  const ms = to.getTime() - from.getTime();
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  return `${h}h ${m}m`;
}

function StaffModal({
  open, existing, onClose, onSaved,
}: { open: boolean; existing: StaffRow | null; onClose: () => void; onSaved: () => void }) {
  const isEdit = existing !== null;
  const [name, setName] = useState(existing?.name ?? '');
  const [role, setRole] = useState<Role>(existing?.role ?? 'mechanic');
  const [phone, setPhone] = useState(existing?.phone ?? '');
  const [email, setEmail] = useState(existing?.email ?? '');
  const [salaryType, setSalaryType] = useState<SalaryType>(existing?.salaryType ?? 'monthly');
  const [hourlyRate, setHourlyRate] = useState(existing?.hourlyRate != null ? String(existing.hourlyRate) : '');
  const [baseMonthlyNet, setBaseMonthlyNet] = useState(existing?.baseMonthlyNet != null ? String(existing.baseMonthlyNet) : '');
  const [hireDate, setHireDate] = useState(existing?.hireDate ?? '');
  const [status, setStatus] = useState<Status>(existing?.status ?? 'active');
  // New compliance + working-envelope fields.
  const [ghanaCardId,     setGhanaCardId]     = useState(existing?.ghanaCardId ?? '');
  const [ssnit,           setSsnit]           = useState(existing?.ssnit ?? '');
  const [healthInsurance, setHealthInsurance] = useState(existing?.healthInsurance ?? '');
  const [workStart,       setWorkStart]       = useState(existing?.workStart ?? POLICY.workStart);
  const [workEnd,         setWorkEnd]         = useState(existing?.workEnd   ?? POLICY.workEnd);
  const [error, setError] = useState<string | null>(null);

  const [syncedId, setSyncedId] = useState<number | null>(null);
  if (existing && existing.id !== syncedId) {
    setSyncedId(existing.id);
    setName(existing.name); setRole(existing.role); setPhone(existing.phone ?? ''); setEmail(existing.email ?? '');
    setSalaryType(existing.salaryType);
    setHourlyRate(existing.hourlyRate != null ? String(existing.hourlyRate) : '');
    setBaseMonthlyNet(existing.baseMonthlyNet != null ? String(existing.baseMonthlyNet) : '');
    setHireDate(existing.hireDate ?? ''); setStatus(existing.status);
    setGhanaCardId(existing.ghanaCardId ?? '');
    setSsnit(existing.ssnit ?? '');
    setHealthInsurance(existing.healthInsurance ?? '');
    setWorkStart(existing.workStart ?? POLICY.workStart);
    setWorkEnd(existing.workEnd ?? POLICY.workEnd);
    setError(null);
  } else if (!existing && syncedId !== null) { setSyncedId(null); }

  // Hours-per-day from the work envelope (HH:MM → HH:MM). Default 10.
  const hoursPerDay = useMemo(() => {
    const parse = (s: string) => {
      const m = /^(\d{1,2}):(\d{2})$/.exec(s);
      if (!m) return null;
      return parseInt(m[1], 10) + parseInt(m[2], 10) / 60;
    };
    const s = parse(workStart), e = parse(workEnd);
    if (s == null || e == null) return 10;
    const span = e - s;
    return span > 0 && span <= 16 ? span : 10;
  }, [workStart, workEnd]);

  // Auto-derive hourly rate for monthly-salary staff:
  //   hourlyRate = monthlyNet / (26 working days × hoursPerDay)
  const derivedHourly = useMemo(() => {
    const m = parseFloat(baseMonthlyNet);
    if (!Number.isFinite(m) || m <= 0) return null;
    return m / (POLICY.paidWorkingDaysPerMonth * hoursPerDay);
  }, [baseMonthlyNet, hoursPerDay]);

  const create = trpc.staffManagement.create.useMutation({ onSuccess: (d: any) => { if (d?.success === false) setError(d.error); else onSaved(); }, onError: (e) => setError(e.message) });
  const update = trpc.staffManagement.update.useMutation({ onSuccess: (d: any) => { if (d?.success === false) setError(d.error); else onSaved(); }, onError: (e) => setError(e.message) });
  const del = trpc.staffManagement.delete.useMutation({ onSuccess: () => onSaved(), onError: (e) => setError(e.message) });
  const isPending = create.isLoading || update.isLoading || del.isLoading;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault(); setError(null);

    // For monthly-salary staff we persist the derived hourly so the
    // payroll calc has a single source of truth; for hourly staff the
    // operator enters the rate directly.
    let rate: number | undefined;
    if (salaryType === 'monthly' && derivedHourly && derivedHourly > 0) {
      rate = Number(derivedHourly.toFixed(2));
    } else if (hourlyRate.trim()) {
      const n = parseFloat(hourlyRate);
      if (Number.isNaN(n) || n <= 0) return setError('Hourly rate must be positive.');
      rate = n;
    }
    let monthly: number | undefined;
    if (baseMonthlyNet.trim()) {
      const n = parseFloat(baseMonthlyNet);
      if (Number.isNaN(n) || n < 0) return setError('Monthly salary must be a non-negative number.');
      monthly = n;
    }
    if (salaryType === 'monthly' && (monthly == null || monthly <= 0)) {
      return setError('Monthly salary is required when pay basis is Monthly.');
    }

    const payload: any = {
      name: name.trim(), role, salaryType, status,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      hourlyRate: rate,
      baseMonthlyNet: monthly,
      hireDate: hireDate || undefined,
      ghanaCardId:     ghanaCardId.trim()     || undefined,
      ssnit:           ssnit.trim()           || undefined,
      healthInsurance: healthInsurance.trim() || undefined,
      workStart:       workStart || undefined,
      workEnd:         workEnd   || undefined,
    };
    if (isEdit && existing) update.mutate({ id: existing.id, ...payload });
    else create.mutate(payload);
  };

  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'grid', placeItems: 'center', background: 'rgba(14,10,10,0.42)', padding: 16 }}
         onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form onSubmit={onSubmit} className="bg-white rounded-2xl shadow-pop" style={{ width: '100%', maxWidth: 640, maxHeight: '90vh', display: 'flex', flexDirection: 'column', border: '1px solid rgba(26,22,18,0.10)' }}>
        <header className="px-4 py-3 border-b border-line">
          <span className="text-xs font-semibold uppercase tracking-wider text-brand-500">{isEdit ? 'Edit' : 'New'}</span>
          <h2 className="text-xl font-bold mt-0.5">{isEdit ? (existing?.name ?? 'Member') : 'Add Member'}</h2>
        </header>
        <div className="flex-1 overflow-auto px-4 py-3 grid grid-cols-2 gap-3 text-sm">
          {/* ── Identity ─────────────────────────────────────────── */}
          <label className="grid gap-1 col-span-2"><span className="text-xs font-semibold uppercase text-neutral-600">Name *</span><input className="field-input" value={name} onChange={e=>setName(e.target.value)} required /></label>
          <label className="grid gap-1"><span className="text-xs font-semibold uppercase text-neutral-600">Role *</span>
            <select className="field-input" value={role} onChange={e=>setRole(e.target.value as Role)}>
              {STAFF_ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </label>
          <label className="grid gap-1"><span className="text-xs font-semibold uppercase text-neutral-600">Status</span>
            <select className="field-input" value={status} onChange={e=>setStatus(e.target.value as Status)}>
              <option value="active">Active</option><option value="suspended">Suspended</option><option value="terminated">Terminated</option>
            </select>
          </label>
          <label className="grid gap-1"><span className="text-xs font-semibold uppercase text-neutral-600">Phone</span><input className="field-input" value={phone ?? ''} onChange={e=>setPhone(e.target.value)} /></label>
          <label className="grid gap-1"><span className="text-xs font-semibold uppercase text-neutral-600">Email</span><input type="email" className="field-input" value={email ?? ''} onChange={e=>setEmail(e.target.value)} /></label>

          {/* ── Compliance IDs ──────────────────────────────────── */}
          <div className="col-span-2 mt-1 -mb-1 text-2xs font-bold uppercase tracking-[0.14em] text-neutral-500">Compliance</div>
          <label className="grid gap-1"><span className="text-xs font-semibold uppercase text-neutral-600">Ghana Card ID</span>
            <input className="field-input num" value={ghanaCardId} onChange={e=>setGhanaCardId(e.target.value)} placeholder="GHA-XXXXXXXXX-X" />
          </label>
          <label className="grid gap-1"><span className="text-xs font-semibold uppercase text-neutral-600">SSNIT #</span>
            <input className="field-input num" value={ssnit} onChange={e=>setSsnit(e.target.value)} placeholder="C123456789012" />
          </label>
          <label className="grid gap-1 col-span-2"><span className="text-xs font-semibold uppercase text-neutral-600">Health insurance (NHIS / private)</span>
            <input className="field-input" value={healthInsurance} onChange={e=>setHealthInsurance(e.target.value)} placeholder="NHIS-1234567 · or Acacia Health" />
          </label>

          {/* ── Pay structure ───────────────────────────────────── */}
          <div className="col-span-2 mt-1 -mb-1 text-2xs font-bold uppercase tracking-[0.14em] text-neutral-500">Pay</div>
          <label className="grid gap-1"><span className="text-xs font-semibold uppercase text-neutral-600">Pay basis</span>
            <select className="field-input" value={salaryType} onChange={e=>setSalaryType(e.target.value as SalaryType)}>
              <option value="monthly">Monthly</option>
              <option value="salary">Salary (legacy)</option>
              <option value="hourly">Hourly</option>
              <option value="commission">Commission</option>
            </select>
          </label>
          <label className="grid gap-1"><span className="text-xs font-semibold uppercase text-neutral-600">Hire date</span><input type="date" className="field-input" value={hireDate ?? ''} onChange={e=>setHireDate(e.target.value)} /></label>

          <label className="grid gap-1"><span className="text-xs font-semibold uppercase text-neutral-600">Monthly salary (GHS)</span>
            <input type="number" min={0} step="0.01" className="field-input num" value={baseMonthlyNet} onChange={e=>setBaseMonthlyNet(e.target.value)} placeholder="e.g. 1800.00" />
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-semibold uppercase text-neutral-600">
              Hourly rate (GHS) {salaryType === 'monthly' && <span className="text-2xs text-emerald-700 normal-case">· auto from monthly ÷ ({POLICY.paidWorkingDaysPerMonth} × {hoursPerDay.toFixed(1)}h)</span>}
            </span>
            <input type="number" min={0} step="0.01" className="field-input num"
              value={salaryType === 'monthly' ? (derivedHourly != null ? derivedHourly.toFixed(2) : '') : hourlyRate}
              onChange={e=>setHourlyRate(e.target.value)}
              readOnly={salaryType === 'monthly'}
              placeholder={salaryType === 'monthly' ? 'Enter monthly salary first' : 'e.g. 12.50'}
            />
          </label>

          {/* ── Working hours envelope ──────────────────────────── */}
          <label className="grid gap-1"><span className="text-xs font-semibold uppercase text-neutral-600">Work start</span>
            <input type="time" className="field-input num" value={workStart} onChange={e=>setWorkStart(e.target.value)} />
          </label>
          <label className="grid gap-1"><span className="text-xs font-semibold uppercase text-neutral-600">Work end</span>
            <input type="time" className="field-input num" value={workEnd} onChange={e=>setWorkEnd(e.target.value)} />
          </label>
          <p className="col-span-2 text-2xs text-neutral-500 -mt-1">
            Hours/day: <span className="num font-semibold">{hoursPerDay.toFixed(1)}h</span>. Late after {workStart || POLICY.workStart} (GHS {POLICY.latePenalty}), missed punch GHS {POLICY.missedPunchPenalty}, overtime {POLICY.overtimeMultiplier}×.
          </p>

          {error && <div className="col-span-2 rounded-xl px-3 py-2 text-brand-500 bg-brand-50" role="alert">{error}</div>}
        </div>
        <footer className="px-4 py-3 border-t border-line flex items-center justify-end gap-2">
          {isEdit && existing && (
            <button type="button" className="text-sm text-brand-500 hover:text-brand-600 mr-auto disabled:opacity-50"
                    onClick={() => { if (window.confirm(`Delete ${existing.name}?`)) del.mutate({ id: existing.id }); }}
                    disabled={isPending}>Delete</button>
          )}
          <button type="button" className="btn-outline text-sm" onClick={onClose} disabled={isPending}>Cancel</button>
          <button type="submit" className="btn-primary text-sm" disabled={isPending}>
            <Briefcase size={14} /> {isPending ? 'Saving…' : 'Save'}
          </button>
        </footer>
      </form>
    </div>
  );
}
