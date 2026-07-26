import { FormEvent, useMemo, useState } from 'react';
import { FileText, FilePenLine, Printer, Check, Share2, Lock } from 'lucide-react';
import { useRole } from '../../lib/useRole';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { trpc } from '../../lib/trpc';
import { PrintLayout } from '../../components/print/PrintLayout';
import { SignatureCapture } from '../../components/forms/SignatureCapture';

/**
 * WS4-C — Forms library. Each template auto-fills system data
 * (employee, date, department, job ref), the staff member completes
 * the remaining fields on screen, then a manager signs / approves.
 * The final state can be printed via the shared <PrintLayout>.
 *
 * Templates sourced from D:\AGL - Forms (mirroring filenames). The
 * resolution-letter template ("Resolution Letter - Ms Joclyn …") is
 * carried as a managed form.
 *
 * Submission history is persisted client-side in localStorage for now;
 * the `forms` server router lands in a follow-up pass (see plan).
 */

type Audience = 'admin' | 'manager' | 'staff';

interface FormTemplate {
  id: string;
  label: string;
  audience: Audience[];
  fields: FormField[];
  body: (values: Record<string, string>) => React.ReactNode;
}

interface FormField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'date' | 'number';
  required?: boolean;
  placeholder?: string;
  systemFill?: 'today' | 'employee_name';
}

const TEMPLATES: FormTemplate[] = [
  {
    id: 'complaint',
    label: 'Customer complaint',
    audience: ['staff', 'manager', 'admin'],
    fields: [
      { key: 'date',          label: 'Date',            type: 'date', required: true, systemFill: 'today' },
      { key: 'customer_name', label: 'Customer name',   type: 'text', required: true },
      { key: 'phone',         label: 'Customer phone',  type: 'text' },
      { key: 'vehicle',       label: 'Vehicle / reg #', type: 'text' },
      { key: 'description',   label: 'Complaint',       type: 'textarea', required: true, placeholder: 'Describe the issue in customer’s own words…' },
      { key: 'desired_resolution', label: 'Desired resolution', type: 'textarea' },
      { key: 'received_by',   label: 'Received by',     type: 'text', systemFill: 'employee_name' },
    ],
    body: (v) => (
      <>
        <Section title="Customer">
          <KV k="Name"    v={v.customer_name}/>
          <KV k="Phone"   v={v.phone}/>
          <KV k="Vehicle" v={v.vehicle}/>
        </Section>
        <Section title="Complaint"><p style={{ whiteSpace: 'pre-wrap' }}>{v.description}</p></Section>
        {v.desired_resolution && <Section title="Desired resolution"><p style={{ whiteSpace: 'pre-wrap' }}>{v.desired_resolution}</p></Section>}
      </>
    ),
  },
  {
    id: 'requisition',
    label: 'Parts / supplies requisition',
    audience: ['staff', 'manager', 'admin'],
    fields: [
      { key: 'date',         label: 'Date',         type: 'date', required: true, systemFill: 'today' },
      { key: 'requested_by', label: 'Requested by', type: 'text', required: true, systemFill: 'employee_name' },
      { key: 'department',   label: 'Department',   type: 'text' },
      { key: 'items',        label: 'Items',        type: 'textarea', required: true, placeholder: 'One item per line — qty + description' },
      { key: 'reason',       label: 'Reason',       type: 'textarea' },
      { key: 'estimated_cost', label: 'Estimated cost (GHS)', type: 'number' },
    ],
    body: (v) => (
      <>
        <Section title="Request">
          <KV k="Requested by" v={v.requested_by}/>
          <KV k="Department"   v={v.department}/>
          <KV k="Estimated cost" v={v.estimated_cost ? `GHS ${v.estimated_cost}` : ''}/>
        </Section>
        <Section title="Items"><pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{v.items}</pre></Section>
        {v.reason && <Section title="Reason"><p style={{ whiteSpace: 'pre-wrap' }}>{v.reason}</p></Section>}
      </>
    ),
  },
  {
    id: 'procurement',
    label: 'Procurement authorisation',
    audience: ['manager', 'admin'],
    fields: [
      { key: 'date',     label: 'Date',     type: 'date', required: true, systemFill: 'today' },
      { key: 'vendor',   label: 'Vendor',   type: 'text', required: true },
      { key: 'items',    label: 'Items',    type: 'textarea', required: true },
      { key: 'amount',   label: 'Amount (GHS)', type: 'number', required: true },
      { key: 'budget_code', label: 'Budget code', type: 'text' },
      { key: 'justification', label: 'Justification', type: 'textarea' },
    ],
    body: (v) => (
      <>
        <Section title="Authorisation">
          <KV k="Vendor"  v={v.vendor}/>
          <KV k="Amount"  v={v.amount ? `GHS ${v.amount}` : ''}/>
          <KV k="Budget"  v={v.budget_code}/>
        </Section>
        <Section title="Items"><pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{v.items}</pre></Section>
        {v.justification && <Section title="Justification"><p style={{ whiteSpace: 'pre-wrap' }}>{v.justification}</p></Section>}
      </>
    ),
  },
  {
    id: 'resolution_letter',
    label: 'Resolution letter',
    audience: ['manager', 'admin'],
    fields: [
      { key: 'date',        label: 'Date',           type: 'date', required: true, systemFill: 'today' },
      { key: 'addressee',   label: 'Addressee',      type: 'text', required: true, placeholder: 'Ms Joclyn …' },
      { key: 'subject',     label: 'Subject',        type: 'text', required: true },
      { key: 'body',        label: 'Letter body',    type: 'textarea', required: true, placeholder: 'Dear …' },
      { key: 'closing',     label: 'Closing salutation', type: 'text', placeholder: 'Yours sincerely,' },
      { key: 'signatory',   label: 'Signatory',      type: 'text', systemFill: 'employee_name' },
    ],
    body: (v) => (
      <>
        <p style={{ marginBottom: 12 }}>{v.date && new Date(v.date).toLocaleDateString()}</p>
        <p style={{ marginBottom: 12 }}>Dear {v.addressee},</p>
        <p style={{ fontWeight: 700, marginBottom: 12 }}>{v.subject}</p>
        <p style={{ whiteSpace: 'pre-wrap', marginBottom: 24 }}>{v.body}</p>
        <p>{v.closing || 'Yours sincerely,'}</p>
        <p style={{ fontWeight: 600, marginTop: 12 }}>{v.signatory}</p>
      </>
    ),
  },
  {
    id: 'incident_report',
    label: 'Workshop incident report',
    audience: ['staff', 'manager', 'admin'],
    fields: [
      { key: 'date',         label: 'Date',     type: 'date', required: true, systemFill: 'today' },
      { key: 'reporter',     label: 'Reporter', type: 'text', required: true, systemFill: 'employee_name' },
      { key: 'incident',     label: 'Incident summary', type: 'textarea', required: true },
      { key: 'persons',      label: 'Persons involved', type: 'text' },
      { key: 'damage',       label: 'Damage / loss estimate (GHS)', type: 'number' },
      { key: 'corrective',   label: 'Corrective action', type: 'textarea' },
    ],
    body: (v) => (
      <>
        <Section title="Incident"><p style={{ whiteSpace: 'pre-wrap' }}>{v.incident}</p></Section>
        <Section title="Detail">
          <KV k="Persons" v={v.persons}/>
          <KV k="Damage"  v={v.damage ? `GHS ${v.damage}` : ''}/>
        </Section>
        {v.corrective && <Section title="Corrective action"><p style={{ whiteSpace: 'pre-wrap' }}>{v.corrective}</p></Section>}
      </>
    ),
  },
];

export function FormsPage() {
  const { role, isManager, user } = useRole();
  const me = user?.name ?? user?.email ?? 'Staff member';
  const audienceRole = role === 'owner' ? 'manager' : role;
  const visible = useMemo(() => TEMPLATES.filter((t) => t.audience.includes(audienceRole as Audience)), [audienceRole]);

  const [activeId, setActiveId] = useState<string>(visible[0]?.id ?? '');
  const active = visible.find((t) => t.id === activeId) ?? null;

  const initialValues = (t: FormTemplate | null): Record<string, string> => {
    if (!t) return {};
    const out: Record<string, string> = {};
    for (const f of t.fields) {
      if (f.systemFill === 'today') out[f.key] = new Date().toISOString().slice(0, 10);
      else if (f.systemFill === 'employee_name') out[f.key] = me;
      else out[f.key] = '';
    }
    return out;
  };

  const [values, setValues]   = useState<Record<string, string>>(() => initialValues(active));
  const [signature, setSig]   = useState<string | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [preview, setPreview] = useState(false);

  // Server-backed submission history.
  const utils = trpc.useUtils();
  // No optional-chain on the tRPC calls: Vite compiles `?.()` to `.call(this, …)`,
  // which the tRPC recursive proxy treats as a path segment and then crashes on
  // `hooks['call']`. See AppShell NotificationBell for the full write-up.
  const historyQ = (trpc as any).forms.list.useQuery({ limit: 60 }, { keepPreviousData: true });
  const history: any[] = historyQ?.data?.success ? historyQ.data.submissions ?? [] : [];

  const submitMut = (trpc as any).forms.submit.useMutation({
    onSuccess: () => { (utils as any).forms.list.invalidate(); setPreview(true); },
    onError:   (e: any) => setError(e.message),
  });
  const approveMut = (trpc as any).forms.approve.useMutation({
    onSuccess: () => (utils as any).forms.list.invalidate(),
  });

  const onSelectTemplate = (id: string) => {
    setActiveId(id);
    const t = visible.find((x) => x.id === id) ?? null;
    setValues(initialValues(t)); setSig(null); setError(null); setPreview(false);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!active) return;
    for (const f of active.fields) {
      if (f.required && !values[f.key]?.trim()) { setError(`"${f.label}" is required.`); return; }
    }
    submitMut?.mutate?.({
      formId:    active.id,
      formLabel: active.label,
      values,
      signature: signature ?? undefined,
      submittedBy: me,
      status: isManager && signature ? 'approved' : 'submitted',
    });
    setError(null);
  };

  const shareWa = () => {
    if (!active) return;
    const text = `*${active.label}*\n${Object.entries(values).map(([k, v]) => `${k}: ${v}`).join('\n')}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div>
      {visible.length === 0 ? (
        <div className="card-feature flex items-start gap-3 max-w-xl">
          <span className="tile-red"><Lock size={18}/></span>
          <div>
            <h2 className="text-base font-bold">No forms available</h2>
            <p className="text-sm text-neutral-600 mt-1">Your role doesn't currently have any assigned forms.</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-4">
          {/* Template list */}
          <aside className="bg-white rounded-2xl border border-line p-2">
            <div className="px-2 py-2 text-2xs font-bold uppercase tracking-[0.14em] text-neutral-500">Forms</div>
            {visible.map((t) => (
              <button key={t.id} type="button" onClick={() => onSelectTemplate(t.id)}
                className={`w-full text-left px-2.5 py-1.5 rounded-md text-sm font-medium ${
                  activeId === t.id ? 'bg-brand-50 text-brand-700' : 'text-neutral-700 hover:bg-canvas'
                }`}>
                <FileText size={13} className="inline mr-1.5 -mt-0.5"/> {t.label}
              </button>
            ))}
          </aside>

          {/* Editor or preview */}
          <section>
            {!preview && active && (
              <form onSubmit={onSubmit} className="bg-white rounded-2xl border border-line p-4 grid gap-3">
                <h2 className="font-semibold flex items-center gap-2"><FilePenLine size={14}/> {active.label}</h2>
                {active.fields.map((f) => (
                  <label key={f.key} className="grid gap-1 text-sm">
                    <span className="text-xs font-semibold uppercase text-neutral-600">
                      {f.label}{f.required ? ' *' : ''}{f.systemFill && <span className="ml-1 text-emerald-700 normal-case">· auto</span>}
                    </span>
                    {f.type === 'textarea' ? (
                      <textarea className="field-input" rows={3} value={values[f.key] ?? ''}
                                onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                                placeholder={f.placeholder} required={f.required}/>
                    ) : (
                      <input className="field-input" type={f.type} value={values[f.key] ?? ''}
                             onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                             placeholder={f.placeholder} required={f.required}/>
                    )}
                  </label>
                ))}
                {isManager && (
                  <SignatureCapture label="Manager signature (approve)" value={signature} onCapture={setSig}/>
                )}
                {error && <div className="rounded-xl px-3 py-2 text-sm text-brand-500 bg-brand-50" role="alert">{error}</div>}
                <div className="flex items-center justify-end gap-2">
                  <button type="submit" className="btn-primary text-sm"><Check size={14}/> Submit & preview</button>
                </div>
              </form>
            )}

            {preview && active && (
              <div>
                <div className="no-print flex items-center justify-end gap-2 mb-3">
                  <button type="button" className="btn-outline text-sm" onClick={() => setPreview(false)}>Edit</button>
                  <button type="button" className="btn-outline text-sm" onClick={shareWa}><Share2 size={14}/> WhatsApp</button>
                  <button type="button" className="btn-primary text-sm" onClick={() => window.print()}><Printer size={14}/> Print / PDF</button>
                </div>
                <PrintLayout
                  eyebrow={active.label.toUpperCase()}
                  title={active.label}
                  subtitle={values.date ? new Date(values.date).toLocaleDateString() : ''}
                  meta={{ 'Submitted by': me, 'Submitted at': new Date().toLocaleString() }}
                  showToolbar={false}
                >
                  {active.body(values)}
                  {signature && (
                    <section style={{ marginTop: 32 }}>
                      <div style={{ borderTop: '1px solid #ddd', paddingTop: 8, fontWeight: 600 }}>Manager approval</div>
                      <img src={signature} alt="Manager signature" style={{ maxHeight: 80, marginTop: 4 }}/>
                      <div style={{ color: '#666', fontSize: 11 }}>Approved by {me} · {new Date().toLocaleString()}</div>
                    </section>
                  )}
                </PrintLayout>
              </div>
            )}

            <h3 className="font-semibold mt-6 mb-2 text-sm">Recent submissions</h3>
            <div className="bg-white rounded-2xl border border-line overflow-hidden">
              <table className="w-full text-sm">
                <thead><tr>
                  <th className="t-th">Form</th>
                  <th className="t-th">Submitted by</th>
                  <th className="t-th">When</th>
                  <th className="t-th">Status</th>
                  {isManager && <th className="t-th">Action</th>}
                </tr></thead>
                <tbody>
                  {history.length === 0 && <tr><td colSpan={isManager ? 5 : 4} className="px-4 py-6 text-center text-neutral-500">No submissions yet.</td></tr>}
                  {history.slice(0, 12).map((h: any) => (
                    <tr key={h.id}>
                      <td className="t-td">{h.formLabel ?? TEMPLATES.find((t) => t.id === h.formId)?.label ?? h.formId}</td>
                      <td className="t-td">{h.submittedBy}</td>
                      <td className="t-td num">{new Date(h.createdAt).toLocaleString()}</td>
                      <td className="t-td">
                        {h.status === 'approved' && <span className="chip bg-emerald-50 text-emerald-700">✓ {h.approvedBy ?? 'approved'}</span>}
                        {h.status === 'submitted' && <span className="chip bg-amber-50 text-amber-700">Pending</span>}
                        {h.status === 'rejected' && <span className="chip bg-brand-50 text-brand-600">Rejected</span>}
                        {h.status === 'draft' && <span className="chip bg-neutral-100 text-neutral-600">Draft</span>}
                      </td>
                      {isManager && (
                        <td className="t-td">
                          {h.status === 'submitted' && (
                            <button type="button" className="text-emerald-700 hover:text-emerald-800 text-xs underline underline-offset-2"
                              onClick={() => approveMut?.mutate?.({ id: h.id, approvedBy: me })}>
                              Approve
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 16 }}>
      <h3 style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.04em', color: '#666', marginBottom: 6 }}>{title}</h3>
      {children}
    </section>
  );
}
function KV({ k, v }: { k: string; v?: string }) {
  if (!v) return null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: 8, marginBottom: 4 }}>
      <span style={{ color: '#666', fontWeight: 600 }}>{k}</span>
      <span>{v}</span>
    </div>
  );
}
