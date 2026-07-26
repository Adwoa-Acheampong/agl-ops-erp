import { useState, FormEvent } from 'react';
import { GraduationCap, Plus, Loader2, CheckCircle2, Circle } from 'lucide-react';
import { trpc } from '../lib/trpc';

/**
 * Training records — built around AGL-OPS-PLAY-001's T-01 to T-14 training
 * sessions. Each row is one staff × session sign-off. Page shows two
 * views: a chronological log and a coverage matrix (staff × sessions).
 */

// Pre-fill suggestions from the 90-day playbook. The user can also enter
// arbitrary codes if they coin new sessions.
const PLAYBOOK_SESSIONS: { code: string; title: string }[] = [
  { code: 'T-01', title: 'Brand standards & customer greeting' },
  { code: 'T-02', title: 'Sales floor SOPs & receipt workflow' },
  { code: 'T-03', title: 'Inventory handling & SIR (Stock Issue Request)' },
  { code: 'T-04', title: 'POS / payment systems (Cash · MoMo · Bank · Card)' },
  { code: 'T-05', title: 'Workshop intake — VIF, condition photos, customer auth' },
  { code: 'T-06', title: 'Diagnostic findings → quotation discipline' },
  { code: 'T-07', title: 'Job Card AGL-JC-001 walkthrough' },
  { code: 'T-08', title: 'Parts fitment lookup & wrong-part avoidance' },
  { code: 'T-09', title: 'Workshop safety & PPE' },
  { code: 'T-10', title: 'Customer complaint handling (AGL-CCR-001)' },
  { code: 'T-11', title: 'Recall investigation & root-cause' },
  { code: 'T-12', title: 'Petty cash vs Sales cash reconciliation' },
  { code: 'T-13', title: 'WhatsApp templates & follow-up cadence' },
  { code: 'T-14', title: 'Daily standup, end-of-day handover & KPI ownership' },
];

export function TrainingPage() {
  const [tab, setTab] = useState<'matrix' | 'log'>('matrix');
  const [modalOpen, setModalOpen] = useState(false);
  const utils = trpc.useUtils();

  const covQ = trpc.training.coverage.useQuery();
  const logQ = trpc.training.list.useQuery({});

  return (
    <div className="max-w-7xl">
      <header className="flex items-end justify-between gap-3 flex-wrap mb-4">
        <div>
          <h1 className="h-section flex items-center gap-2"><GraduationCap size={20} /> Training</h1>
          <p className="mt-1 text-neutral-600 text-sm">Staff competency sign-offs — AGL-OPS-PLAY-001 sessions T-01 through T-14.</p>
        </div>
        <button className="btn-primary text-sm" onClick={() => setModalOpen(true)}><Plus size={14} /> Record session</button>
      </header>

      <nav className="flex items-center gap-1 mb-4 bg-white border border-line rounded-2xl p-1 w-fit">
        <button onClick={() => setTab('matrix')} className={`px-3 py-1.5 rounded-xl text-sm font-semibold ${tab === 'matrix' ? 'bg-brand-500 text-white' : 'text-neutral-600 hover:bg-canvas'}`}>Coverage matrix</button>
        <button onClick={() => setTab('log')}    className={`px-3 py-1.5 rounded-xl text-sm font-semibold ${tab === 'log' ? 'bg-brand-500 text-white' : 'text-neutral-600 hover:bg-canvas'}`}>Activity log</button>
      </nav>

      {tab === 'matrix' && <MatrixView q={covQ} />}
      {tab === 'log' && <LogView q={logQ} />}

      {modalOpen && <NewTrainingModal onClose={() => setModalOpen(false)} onSaved={() => { setModalOpen(false); utils.training.list.invalidate(); utils.training.coverage.invalidate(); }} />}
    </div>
  );
}

function MatrixView({ q }: { q: any }) {
  if (q.isLoading) return <div className="text-center py-6 text-neutral-500"><Loader2 size={14} className="animate-spin inline" /> Loading…</div>;
  if (!q.data?.success) return <div className="rounded-2xl px-4 py-3 bg-brand-50 text-brand-500">{q.data?.error ?? 'Failed to load.'}</div>;

  const staffList: any[] = q.data.staff ?? [];
  const sessionCodes: string[] = q.data.sessions ?? [];
  const trainings: any[] = q.data.trainings ?? [];

  // Union of playbook sessions + actually-recorded ones.
  const allCodes = Array.from(new Set([...PLAYBOOK_SESSIONS.map(p => p.code), ...sessionCodes])).sort();

  const lookup = new Map<string, any>();
  for (const t of trainings) lookup.set(`${t.staffId}::${t.sessionCode}`, t);

  const titleFor = (code: string) => PLAYBOOK_SESSIONS.find(p => p.code === code)?.title ?? trainings.find(t => t.sessionCode === code)?.sessionTitle ?? '';

  return (
    <div className="bg-white rounded-2xl border border-line overflow-hidden">
      <div style={{ overflowX: 'auto' }}>
        <table className="w-full text-xs">
          <thead>
            <tr>
              <th className="t-th sticky left-0 bg-white z-10" style={{ minWidth: 180 }}>Staff</th>
              {allCodes.map(c => (
                <th key={c} className="t-th text-center" title={titleFor(c)} style={{ minWidth: 56 }}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {staffList.length === 0 && <tr><td colSpan={allCodes.length + 1} className="px-4 py-6 text-center text-neutral-500">No active staff.</td></tr>}
            {staffList.map((s: any) => (
              <tr key={s.id}>
                <td className="t-td sticky left-0 bg-white z-10">
                  <div className="font-semibold">{s.name}</div>
                  <div className="text-[11.5px] text-neutral-500 capitalize">{s.role}</div>
                </td>
                {allCodes.map(code => {
                  const t = lookup.get(`${s.id}::${code}`);
                  return (
                    <td key={code} className="t-td text-center">
                      {t?.passed
                        ? <CheckCircle2 size={14} className="text-emerald-600 inline" />
                        : t
                          ? <Circle size={14} className="text-amber-500 inline" />
                          : <span className="text-neutral-300">·</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LogView({ q }: { q: any }) {
  if (q.isLoading) return <div className="text-center py-6 text-neutral-500"><Loader2 size={14} className="animate-spin inline" /> Loading…</div>;
  if (!q.data?.success) return <div className="rounded-2xl px-4 py-3 bg-brand-50 text-brand-500">{q.data?.error ?? 'Failed.'}</div>;
  const rows: any[] = q.data.trainings ?? [];
  return (
    <div className="bg-white rounded-2xl border border-line overflow-hidden">
      <div style={{ overflowX: 'auto' }}>
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="t-th">Date</th>
              <th className="t-th">Session</th>
              <th className="t-th">Staff</th>
              <th className="t-th">Competency</th>
              <th className="t-th">Passed</th>
              <th className="t-th">Delivered by</th>
              <th className="t-th">Signed off</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-neutral-500">No training recorded yet.</td></tr>}
            {rows.map((row: any) => {
              const t = row.training;
              return (
                <tr key={t.id}>
                  <td className="t-td num">{new Date(t.sessionDate).toLocaleDateString()}</td>
                  <td className="t-td"><span className="font-semibold num">{t.sessionCode}</span> <span className="text-neutral-600">{t.sessionTitle}</span></td>
                  <td className="t-td">{row.staffName} <span className="text-xs text-neutral-500 capitalize">({row.staffRole})</span></td>
                  <td className="t-td capitalize">{t.competencyLevel ?? '—'}</td>
                  <td className="t-td">{t.passed ? <CheckCircle2 size={14} className="text-emerald-600 inline" /> : '—'}</td>
                  <td className="t-td">{t.deliveredBy ?? '—'}</td>
                  <td className="t-td text-xs text-neutral-600">{t.signedOffBy ?? '—'}{t.signedOffAt ? ` · ${new Date(t.signedOffAt).toLocaleDateString()}` : ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NewTrainingModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const staffQ = trpc.staffManagement.list.useQuery({ status: 'active' });
  const staffList: any[] = staffQ.data?.success ? staffQ.data.staff ?? [] : [];

  const [staffId, setStaffId] = useState(0);
  const [sessionCode, setSessionCode] = useState('T-01');
  const [sessionTitle, setSessionTitle] = useState(PLAYBOOK_SESSIONS[0].title);
  const [sessionDate, setSessionDate] = useState(new Date().toISOString().slice(0, 10));
  const [deliveredBy, setDeliveredBy] = useState('Operations Manager');
  const [competencyLevel, setCompetencyLevel] = useState<'aware'|'practising'|'competent'|'expert'>('competent');
  const [passed, setPassed] = useState(true);
  const [notes, setNotes] = useState('');
  const [signedOffBy, setSignedOffBy] = useState('Operations Manager');
  const [error, setError] = useState<string | null>(null);

  const mu = trpc.training.create.useMutation({
    onSuccess: (d: any) => { if (d?.success === false) setError(d.error); else onSaved(); },
    onError: e => setError(e.message),
  });

  const onPickCode = (c: string) => {
    setSessionCode(c);
    const pb = PLAYBOOK_SESSIONS.find(p => p.code === c);
    if (pb) setSessionTitle(pb.title);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!staffId) return setError('Select a staff member.');
    mu.mutate({
      staffId,
      sessionCode,
      sessionTitle,
      sessionDate: new Date(sessionDate),
      deliveredBy: deliveredBy.trim() || undefined,
      competencyLevel,
      passed,
      notes: notes.trim() || undefined,
      signedOffBy: signedOffBy.trim() || undefined,
    });
  };

  return (
    <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'grid', placeItems: 'center', background: 'rgba(14,10,10,0.42)', padding: 16 }}
         onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form onSubmit={onSubmit} className="bg-white rounded-2xl shadow-pop" style={{ width: '100%', maxWidth: 560, border: '1px solid rgba(26,22,18,0.10)' }}>
        <header className="px-4 py-3 border-b border-line">
          <span className="text-xs font-semibold uppercase tracking-wider text-brand-500">Training</span>
          <h2 className="text-xl font-bold mt-0.5">Record training session</h2>
        </header>
        <div className="px-4 py-3 grid grid-cols-2 gap-3 text-sm">
          <Field label="Staff" col={2}>
            <select className="field-input" value={staffId} onChange={e => setStaffId(parseInt(e.target.value, 10))}>
              <option value={0}>— pick staff —</option>
              {staffList.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.role})</option>)}
            </select>
          </Field>
          <Field label="Session code"><input className="field-input num" value={sessionCode} onChange={e => onPickCode(e.target.value)} list="session-codes" /></Field>
          <Field label="Date"><input type="date" className="field-input" value={sessionDate} onChange={e => setSessionDate(e.target.value)} required /></Field>
          <datalist id="session-codes">{PLAYBOOK_SESSIONS.map(p => <option key={p.code} value={p.code}>{p.title}</option>)}</datalist>
          <Field label="Session title" col={2}><input className="field-input" value={sessionTitle} onChange={e => setSessionTitle(e.target.value)} required /></Field>
          <Field label="Delivered by"><input className="field-input" value={deliveredBy} onChange={e => setDeliveredBy(e.target.value)} /></Field>
          <Field label="Competency">
            <select className="field-input" value={competencyLevel} onChange={e => setCompetencyLevel(e.target.value as any)}>
              <option value="aware">Aware</option>
              <option value="practising">Practising</option>
              <option value="competent">Competent</option>
              <option value="expert">Expert</option>
            </select>
          </Field>
          <Field label="Signed off by" col={2}><input className="field-input" value={signedOffBy} onChange={e => setSignedOffBy(e.target.value)} /></Field>
          <label className="flex items-center gap-2 col-span-2"><input type="checkbox" checked={passed} onChange={e => setPassed(e.target.checked)} className="accent-brand-500" /><span>Passed</span></label>
          <Field label="Notes" col={2}><textarea rows={2} className="field-input" value={notes} onChange={e => setNotes(e.target.value)} /></Field>
          {error && <div className="col-span-2 rounded-xl px-3 py-2 text-brand-500 bg-brand-50">{error}</div>}
        </div>
        <footer className="px-4 py-3 border-t border-line flex items-center justify-end gap-2">
          <button type="button" className="btn-outline text-sm" onClick={onClose}>Cancel</button>
          <button type="submit" className="btn-primary text-sm" disabled={mu.isLoading}>{mu.isLoading ? 'Saving…' : 'Record session'}</button>
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
