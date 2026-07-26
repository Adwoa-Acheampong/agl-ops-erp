import { useState, FormEvent } from 'react';
import { MessageSquareWarning, Plus, Loader2, X, AlertOctagon, CheckCircle2, Clock, ArrowUpRight } from 'lucide-react';
import { trpc } from '../lib/trpc';

/**
 * AGL-CCR-001 — Customer Complaint Record.
 *
 * The on-screen form follows the paper template the team currently uses.
 * Status moves: open → in_progress → resolved (or escalated → closed).
 */

const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: 'wrong_part',        label: 'Wrong Part' },
  { value: 'delayed_order',     label: 'Delayed Order' },
  { value: 'price_dispute',     label: 'Price Dispute' },
  { value: 'staff_behaviour',   label: 'Staff Behaviour' },
  { value: 'workshop_quality',  label: 'Workshop / Service Quality' },
  { value: 'momo_payment',      label: 'MoMo / Payment Issue' },
  { value: 'other',             label: 'Other' },
];

const ACTION_OPTIONS: { value: string; label: string }[] = [
  { value: 'apology',           label: 'Apology given' },
  { value: 'manager_notified',  label: 'Manager notified' },
  { value: 'replacement',       label: 'Replacement arranged' },
  { value: 'refund',            label: 'Refund initiated' },
  { value: 'investigation',     label: 'Investigation opened' },
  { value: 'escalated_to_ceo',  label: 'Escalated to CEO' },
];

const STATUS_TONE: Record<string, { bg: string; fg: string; icon: any }> = {
  open:         { bg: 'bg-brand-50',     fg: 'text-brand-600',     icon: AlertOctagon },
  in_progress:  { bg: 'bg-amber-50',     fg: 'text-amber-700',     icon: Clock },
  resolved:     { bg: 'bg-emerald-50',   fg: 'text-emerald-700',   icon: CheckCircle2 },
  escalated:    { bg: 'bg-brand-500',    fg: 'text-white',         icon: ArrowUpRight },
  closed:       { bg: 'bg-neutral-100',  fg: 'text-neutral-600',   icon: CheckCircle2 },
};

export function ComplaintsPage() {
  const [filter, setFilter] = useState<'open' | 'in_progress' | 'resolved' | 'all'>('open');
  const [newOpen, setNewOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const utils = trpc.useUtils();

  const q = trpc.complaints.list.useQuery(
    { status: filter === 'all' ? 'all' : filter },
    { keepPreviousData: true },
  );
  const rows = q.data?.success ? q.data.complaints ?? [] : [];
  const err = q.data?.success === false ? q.data.error : q.error?.message;

  const stats = (() => {
    const open = rows.filter((r: any) => r.status === 'open').length;
    const inProgress = rows.filter((r: any) => r.status === 'in_progress').length;
    const resolved = rows.filter((r: any) => r.status === 'resolved').length;
    return { open, inProgress, resolved, total: rows.length };
  })();

  return (
    <div className="max-w-7xl">
      <header className="flex items-end justify-between gap-3 flex-wrap mb-4">
        <div>
          <h1 className="h-section flex items-center gap-2"><MessageSquareWarning size={20} /> Customer Complaints</h1>
          <p className="mt-1 text-neutral-600 text-sm">
            AGL-CCR-001 · Every complaint logged, every action recorded, every resolution confirmed.
          </p>
        </div>
        <button className="btn-primary text-sm" onClick={() => setNewOpen(true)}>
          <Plus size={14} /> Log Complaint
        </button>
      </header>

      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <StatCard label="Open"        value={stats.open}        tone="brand" />
        <StatCard label="In progress" value={stats.inProgress}  tone="amber" />
        <StatCard label="Resolved"    value={stats.resolved}    tone="emerald" />
        <StatCard label="Total"       value={stats.total}       tone="ink" />
      </section>

      <nav className="flex items-center gap-1 mb-4 bg-white border border-line rounded-2xl p-1 w-fit">
        {(['open','in_progress','resolved','all'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-xl text-sm font-semibold capitalize transition-colors ${
              filter === s ? 'bg-brand-500 text-white' : 'text-neutral-600 hover:bg-canvas'
            }`}
          >
            {s.replace('_', ' ')}
          </button>
        ))}
      </nav>

      {err && <div className="rounded-2xl px-4 py-3 mb-3 text-sm bg-brand-50 text-brand-500">{err}</div>}

      <div className="bg-white rounded-2xl border border-line overflow-hidden">
        <div style={{ overflowX: 'auto' }}>
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="t-th">Ref</th>
                <th className="t-th">Logged</th>
                <th className="t-th">Customer</th>
                <th className="t-th">Channel</th>
                <th className="t-th">Categories</th>
                <th className="t-th">Status</th>
                <th className="t-th">Deadline</th>
                <th className="t-th"></th>
              </tr>
            </thead>
            <tbody>
              {q.isLoading && (
                <tr><td colSpan={8} className="px-4 py-6 text-center text-neutral-500"><Loader2 size={14} className="animate-spin inline" /> Loading…</td></tr>
              )}
              {!q.isLoading && rows.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-6 text-center text-neutral-500">No complaints match this view. Quiet day.</td></tr>
              )}
              {rows.map((c: any) => {
                const tone = STATUS_TONE[c.status] ?? STATUS_TONE.open;
                const Icon = tone.icon;
                const cats = Array.isArray(c.categories) ? c.categories : [];
                return (
                  <tr key={c.id} className="hover:bg-canvas cursor-pointer" onClick={() => setEditing(c)}>
                    <td className="t-td num font-semibold">{c.complaintNo}</td>
                    <td className="t-td num text-neutral-600">{c.loggedAt ? new Date(c.loggedAt).toLocaleString() : '—'}</td>
                    <td className="t-td">
                      <div className="font-semibold">{c.customerName}</div>
                      {c.customerContact && <div className="text-xs text-neutral-500 num">{c.customerContact}</div>}
                    </td>
                    <td className="t-td capitalize">{c.channel?.replace('_', ' ')}</td>
                    <td className="t-td text-xs">
                      {cats.length === 0 ? '—' : cats.map((cat: string) => (
                        <span key={cat} className="inline-block mr-1 mb-0.5 px-1.5 py-0.5 rounded bg-canvas text-neutral-600">
                          {CATEGORY_OPTIONS.find(o => o.value === cat)?.label ?? cat}
                        </span>
                      ))}
                    </td>
                    <td className="t-td">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-semibold ${tone.bg} ${tone.fg}`}>
                        <Icon size={10} /> {c.status?.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="t-td num text-xs text-neutral-600">{c.resolutionDeadline ? new Date(c.resolutionDeadline).toLocaleDateString() : '—'}</td>
                    <td className="t-td">
                      <button type="button" className="text-brand-500 text-xs hover:text-brand-600 mr-2" onClick={() => setEditing(c)}>Open</button>
                      <a className="text-neutral-600 text-xs hover:text-black" href={`/complaints/${c.id}/print`} target="_blank" rel="noreferrer" title="Print this complaint">Print</a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <NewComplaintModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        onCreated={() => { setNewOpen(false); utils.complaints.list.invalidate(); }}
      />

      {editing && (
        <ComplaintDetailModal
          complaint={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); utils.complaints.list.invalidate(); }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────

function StatCard({ label, value, tone }: { label: string; value: number; tone: 'brand' | 'amber' | 'emerald' | 'ink' }) {
  const colour =
    tone === 'brand' ? 'text-brand-500' :
    tone === 'amber' ? 'text-amber-700' :
    tone === 'emerald' ? 'text-emerald-700' : 'text-ink-900';
  return (
    <article className="card-feature flex flex-col gap-1.5">
      <span className="text-[12.5px] font-bold tracking-[0.14em] text-neutral-500">{label.toUpperCase()}</span>
      <div className={`text-2xl md:text-3xl font-extrabold tracking-tight ${colour}`}>{value}</div>
    </article>
  );
}

function NewComplaintModal({ open, onClose, onCreated }: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [customerName, setCustomerName] = useState('');
  const [customerContact, setCustomerContact] = useState('');
  const [vehicleLabel, setVehicleLabel] = useState('');
  const [previousInvoiceRef, setPreviousInvoiceRef] = useState('');
  const [channel, setChannel] = useState<'walk_in'|'whatsapp'|'phone'|'email'|'remote'|'other'>('walk_in');
  const [loggedBy, setLoggedBy] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [customerWords, setCustomerWords] = useState('');
  const [staffInvolved, setStaffInvolved] = useState('');
  const [actions, setActions] = useState<string[]>([]);
  const [actionDescription, setActionDescription] = useState('');
  const [promisedResolution, setPromisedResolution] = useState('');
  const [resolutionDeadline, setResolutionDeadline] = useState('');
  const [error, setError] = useState<string | null>(null);

  const mu = trpc.complaints.create.useMutation({
    onSuccess: (d: any) => { if (d?.success === false) setError(d.error); else onCreated(); },
    onError: (e) => setError(e.message),
  });

  const toggle = (set: (v: string[]) => void, current: string[], value: string) => {
    set(current.includes(value) ? current.filter(v => v !== value) : [...current, value]);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    mu.mutate({
      customerName: customerName.trim(),
      customerContact: customerContact.trim() || undefined,
      vehicleLabel: vehicleLabel.trim() || undefined,
      previousInvoiceRef: previousInvoiceRef.trim() || undefined,
      channel,
      loggedBy: loggedBy.trim() || undefined,
      categories: categories as any,
      customerWords: customerWords.trim(),
      staffInvolved: staffInvolved.trim() || undefined,
      immediateActions: actions as any,
      actionDescription: actionDescription.trim() || undefined,
      promisedResolution: promisedResolution ? new Date(promisedResolution) : undefined,
      resolutionDeadline: resolutionDeadline ? new Date(resolutionDeadline) : undefined,
    } as any);
  };

  if (!open) return null;
  return (
    <Shell title="Log a Customer Complaint" eyebrow="AGL-CCR-001" onClose={onClose}>
      <form onSubmit={onSubmit} className="grid gap-4 text-sm">
        <Section title="Customer & channel">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Customer name *" col={2}><input className="field-input" value={customerName} onChange={(e) => setCustomerName(e.target.value)} required /></Field>
            <Field label="Contact number"><input className="field-input" value={customerContact} onChange={(e) => setCustomerContact(e.target.value)} /></Field>
            <Field label="Channel">
              <select className="field-input" value={channel} onChange={(e) => setChannel(e.target.value as any)}>
                <option value="walk_in">Walk-in</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="phone">Phone</option>
                <option value="email">Email</option>
                <option value="remote">Remote</option>
                <option value="other">Other</option>
              </select>
            </Field>
            <Field label="Vehicle"><input className="field-input" value={vehicleLabel} onChange={(e) => setVehicleLabel(e.target.value)} placeholder="JEEP – GR 8998-22" /></Field>
            <Field label="Previous invoice / ref"><input className="field-input" value={previousInvoiceRef} onChange={(e) => setPreviousInvoiceRef(e.target.value)} /></Field>
            <Field label="Logged by" col={2}><input className="field-input" value={loggedBy} onChange={(e) => setLoggedBy(e.target.value)} placeholder="Operations Manager" /></Field>
          </div>
        </Section>

        <Section title="Complaint">
          <div className="grid gap-3">
            <Field label="Categories (tick all that apply)">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                {CATEGORY_OPTIONS.map((o) => (
                  <label key={o.value} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-canvas border border-line cursor-pointer text-xs hover:bg-brand-50">
                    <input type="checkbox" checked={categories.includes(o.value)} onChange={() => toggle(setCategories, categories, o.value)} className="accent-brand-500" />
                    {o.label}
                  </label>
                ))}
              </div>
            </Field>
            <Field label="Customer's exact words *">
              <textarea rows={3} className="field-input" value={customerWords} onChange={(e) => setCustomerWords(e.target.value)} required placeholder="Verbatim quote from the customer." />
            </Field>
            <Field label="Staff member(s) involved">
              <input className="field-input" value={staffInvolved} onChange={(e) => setStaffInvolved(e.target.value)} placeholder="Benjamin (Supervisor) / Kojo (Mechanic)" />
            </Field>
          </div>
        </Section>

        <Section title="Immediate action taken">
          <div className="grid gap-3">
            <Field label="Actions (tick all that apply)">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5">
                {ACTION_OPTIONS.map((o) => (
                  <label key={o.value} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-canvas border border-line cursor-pointer text-xs hover:bg-brand-50">
                    <input type="checkbox" checked={actions.includes(o.value)} onChange={() => toggle(setActions, actions, o.value)} className="accent-brand-500" />
                    {o.label}
                  </label>
                ))}
              </div>
            </Field>
            <Field label="Describe action taken at time of complaint">
              <textarea rows={3} className="field-input" value={actionDescription} onChange={(e) => setActionDescription(e.target.value)} />
            </Field>
          </div>
        </Section>

        <Section title="Resolution & follow-up">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Promised resolution"><input type="date" className="field-input" value={promisedResolution} onChange={(e) => setPromisedResolution(e.target.value)} /></Field>
            <Field label="Resolution deadline"><input type="date" className="field-input" value={resolutionDeadline} onChange={(e) => setResolutionDeadline(e.target.value)} /></Field>
          </div>
        </Section>

        {error && <div className="rounded-xl px-3 py-2 text-brand-500 bg-brand-50">{error}</div>}

        <footer className="flex items-center justify-end gap-2 pt-2 border-t border-line">
          <button type="button" className="btn-outline text-sm" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary text-sm" disabled={mu.isLoading}>{mu.isLoading ? 'Logging…' : 'Log complaint'}</button>
        </footer>
      </form>
    </Shell>
  );
}

function ComplaintDetailModal({ complaint, onClose, onSaved }: { complaint: any; onClose: () => void; onSaved: () => void }) {
  const [actualResolution, setActualResolution] = useState(complaint.actualResolution ?? '');
  const [resolvedAt, setResolvedAt] = useState(complaint.resolvedAt ? new Date(complaint.resolvedAt).toISOString().slice(0, 10) : '');
  const [customerSatisfied, setCustomerSatisfied] = useState<boolean | null>(complaint.customerSatisfied == null ? null : !!complaint.customerSatisfied);
  const [reviewedBy, setReviewedBy] = useState(complaint.reviewedBy ?? '');
  const [status, setStatus] = useState(complaint.status);
  const [escalatedToCeo, setEscalatedToCeo] = useState(!!complaint.escalatedToCeo);
  const [error, setError] = useState<string | null>(null);

  const mu = trpc.complaints.update.useMutation({
    onSuccess: (d: any) => { if (d?.success === false) setError(d.error); else onSaved(); },
    onError: (e) => setError(e.message),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    mu.mutate({
      id: complaint.id,
      actualResolution: actualResolution.trim() || undefined,
      resolvedAt: resolvedAt ? new Date(resolvedAt) : undefined,
      customerSatisfied: customerSatisfied === null ? undefined : customerSatisfied,
      reviewedBy: reviewedBy.trim() || undefined,
      status,
      escalatedToCeo,
    } as any);
  };

  const cats = Array.isArray(complaint.categories) ? complaint.categories : [];
  const acts = Array.isArray(complaint.immediateActions) ? complaint.immediateActions : [];

  return (
    <Shell title={complaint.complaintNo} eyebrow="Complaint" onClose={onClose}>
      <div className="grid gap-3 text-sm">
        <div className="grid grid-cols-2 gap-3">
          <Info label="Customer">{complaint.customerName}<br /><span className="text-xs text-neutral-500 num">{complaint.customerContact ?? '—'}</span></Info>
          <Info label="Vehicle">{complaint.vehicleLabel ?? '—'}</Info>
          <Info label="Channel" className="capitalize">{complaint.channel?.replace('_',' ')}</Info>
          <Info label="Logged">{new Date(complaint.loggedAt).toLocaleString()} by {complaint.loggedBy ?? '—'}</Info>
        </div>
        <Info label="Customer's words">{complaint.customerWords}</Info>
        {complaint.staffInvolved && <Info label="Staff involved">{complaint.staffInvolved}</Info>}
        {cats.length > 0 && <Info label="Categories">{cats.map((c: string) => CATEGORY_OPTIONS.find(o => o.value === c)?.label).join(' · ')}</Info>}
        {acts.length > 0 && <Info label="Immediate actions">{acts.map((a: string) => ACTION_OPTIONS.find(o => o.value === a)?.label).join(' · ')}</Info>}
        {complaint.actionDescription && <Info label="Action description">{complaint.actionDescription}</Info>}

        <form onSubmit={onSubmit} className="pt-4 mt-2 border-t border-line grid gap-3">
          <div className="font-semibold text-sm">Resolution</div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Status">
              <select className="field-input" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="open">Open</option>
                <option value="in_progress">In progress</option>
                <option value="resolved">Resolved</option>
                <option value="escalated">Escalated</option>
                <option value="closed">Closed</option>
              </select>
            </Field>
            <Field label="Date resolved"><input type="date" className="field-input" value={resolvedAt} onChange={(e) => setResolvedAt(e.target.value)} /></Field>
          </div>
          <Field label="Actual resolution"><textarea rows={3} className="field-input" value={actualResolution} onChange={(e) => setActualResolution(e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Customer satisfied?">
              <select className="field-input" value={customerSatisfied === null ? '' : customerSatisfied ? 'yes' : 'no'} onChange={(e) => setCustomerSatisfied(e.target.value === '' ? null : e.target.value === 'yes')}>
                <option value="">—</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </Field>
            <Field label="Reviewed by"><input className="field-input" value={reviewedBy} onChange={(e) => setReviewedBy(e.target.value)} placeholder="Ops Manager name" /></Field>
          </div>
          <label className="flex items-center gap-2 px-3 py-2 rounded-xl bg-canvas border border-line cursor-pointer">
            <input type="checkbox" checked={escalatedToCeo} onChange={(e) => setEscalatedToCeo(e.target.checked)} className="accent-brand-500" />
            Escalated to CEO
          </label>
          {error && <div className="rounded-xl px-3 py-2 text-brand-500 bg-brand-50">{error}</div>}
          <footer className="flex items-center justify-end gap-2 pt-2 border-t border-line">
            <button type="button" className="btn-outline text-sm" onClick={onClose}>Close</button>
            <button type="submit" className="btn-primary text-sm" disabled={mu.isLoading}>{mu.isLoading ? 'Saving…' : 'Save'}</button>
          </footer>
        </form>
      </div>
    </Shell>
  );
}

// ─────────────────────────────────────────────────────────────────────────

function Shell({ title, eyebrow, onClose, children }: { title: string; eyebrow: string; onClose: () => void; children: any }) {
  return (
    <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'grid', placeItems: 'center', background: 'rgba(14,10,10,0.42)', padding: 16 }}
         onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-pop" style={{ width: '100%', maxWidth: 720, maxHeight: '92vh', display: 'flex', flexDirection: 'column', border: '1px solid rgba(26,22,18,0.10)' }}>
        <header className="px-4 py-3 border-b border-line flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-500">{eyebrow}</span>
            <h2 className="text-xl font-bold mt-0.5">{title}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 hover:bg-canvas rounded-lg"><X size={16} /></button>
        </header>
        <div className="flex-1 overflow-auto px-4 py-3">{children}</div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: any }) {
  return (
    <fieldset>
      <legend className="font-semibold text-sm uppercase tracking-wider text-neutral-500 mb-2">{title}</legend>
      {children}
    </fieldset>
  );
}

function Field({ label, col, children }: { label: string; col?: 2; children: any }) {
  return (
    <label className="grid gap-1" style={{ gridColumn: col === 2 ? 'span 2 / span 2' : undefined }}>
      <span className="text-xs font-semibold uppercase tracking-wide text-neutral-600">{label}</span>
      {children}
    </label>
  );
}

function Info({ label, children, className }: { label: string; children: any; className?: string }) {
  return (
    <div className={`rounded-lg p-2.5 bg-canvas border border-line ${className ?? ''}`}>
      <div className="text-[11.5px] font-bold uppercase tracking-wider text-neutral-500 mb-0.5">{label}</div>
      <div className="text-sm">{children}</div>
    </div>
  );
}
