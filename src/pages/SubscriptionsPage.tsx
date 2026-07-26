import { useState, FormEvent } from 'react';
import { Repeat, Plus, UserPlus, Loader2, X } from 'lucide-react';
import { trpc } from '../lib/trpc';

const DEFAULT_TENANT_ID = 1;

function ghs(n: number) {
  return `GHS ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function parseBenefits(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(x => typeof x === 'string') : [];
  } catch {
    return raw.trim() ? [raw.trim()] : [];
  }
}

const STATUS_TONE: Record<string, string> = {
  active: 'text-black', paused: 'text-warning', canceled: 'text-brand-500',
};

export function SubscriptionsPage() {
  const [planOpen, setPlanOpen] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const utils = trpc.useUtils();

  const subsQ = trpc.subscriptions.listSubscriptions.useQuery(undefined, { keepPreviousData: true });
  const plansQ = trpc.subscriptions.listPlans.useQuery({ tenantId: DEFAULT_TENANT_ID }, { keepPreviousData: true });

  const subs = subsQ.data?.success ? subsQ.data.subscriptions ?? [] : [];
  const plans = plansQ.data?.success ? plansQ.data.plans ?? [] : [];
  const err = subsQ.error?.message ?? (subsQ.data?.success === false ? subsQ.data.error : null);

  const active = subs.filter((r: any) => r.subscription?.status === 'active');
  const mrr = active.reduce((s, r: any) => s + Number(r.plan?.monthlyPrice ?? 0), 0);

  const refresh = () => {
    utils.subscriptions.listSubscriptions.invalidate();
    utils.subscriptions.listPlans.invalidate();
  };

  return (
    <div className="max-w-6xl">
      <header className="flex items-end justify-between gap-3 flex-wrap mb-4">
        <div>
          <h1 className="h-section">Subscriptions</h1>
          <p className="mt-1 text-neutral-600 text-sm">Recurring revenue plans and active enrolments.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="btn-outline text-sm disabled:opacity-50"
            onClick={() => setSubOpen(true)}
            disabled={plans.length === 0}
            title={plans.length === 0 ? 'Create a plan first' : 'Subscribe a customer'}
          >
            <UserPlus size={14} /> Subscribe Customer
          </button>
          <button className="btn-primary text-sm" onClick={() => setPlanOpen(true)}>
            <Plus size={14} /> Create Plan
          </button>
        </div>
      </header>

      {err && <div className="rounded-2xl px-4 py-3 mb-3 text-sm bg-brand-50 text-brand-500">{err}</div>}

      <section className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5">
        <Kpi label="Active subscribers" value={String(active.length)} />
        <Kpi label="MRR" value={ghs(mrr)} />
        <Kpi label="On ledger" value={String(subs.length)} note="Including paused/cancelled" />
      </section>

      {plans.length > 0 && (
        <section className="mb-5">
          <h2 className="text-base font-semibold mb-2">Plans</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {plans.map((p: any) => {
              const benefits = parseBenefits(p.benefitsJSON);
              return (
                <article key={p.id} className="card-feature flex flex-col gap-1.5">
                  <h3 className="text-lg font-bold">{p.name}</h3>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-extrabold">{ghs(Number(p.monthlyPrice ?? 0))}</span>
                    <span className="text-xs text-neutral-500">/ month</span>
                  </div>
                  <span className="text-xs text-neutral-500">{ghs(Number(p.yearlyPrice ?? 0))} / year</span>
                  {benefits.length > 0 && (
                    <ul className="text-sm text-neutral-600 list-disc pl-4 mt-1">
                      {benefits.map((b, i) => <li key={i}>{b}</li>)}
                    </ul>
                  )}
                </article>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-base font-semibold mb-2">Subscription ledger</h2>
        <div className="bg-white rounded-2xl overflow-hidden border border-line">
          <div style={{ overflowX: 'auto' }}>
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="t-th">Plan</th>
                  <th className="t-th">Monthly</th>
                  <th className="t-th">Customer ID</th>
                  <th className="t-th">Start</th>
                  <th className="t-th">Next bill</th>
                  <th className="t-th">Auto-renew</th>
                  <th className="t-th">Status</th>
                </tr>
              </thead>
              <tbody>
                {subsQ.isLoading && <tr><td colSpan={7} className="px-4 py-6 text-center text-neutral-500"><Loader2 size={14} className="animate-spin inline" /> Loading…</td></tr>}
                {!subsQ.isLoading && subs.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-neutral-500">No subscriptions yet.</td></tr>}
                {!subsQ.isLoading && subs.map((r: any) => {
                  const sub = r.subscription, plan = r.plan;
                  return (
                    <tr key={sub.id}>
                      <td className="t-td font-semibold">{plan?.name ?? '—'}</td>
                      <td className="t-td num">{ghs(Number(plan?.monthlyPrice ?? 0))}</td>
                      <td className="t-td num">{sub.customerId}</td>
                      <td className="t-td num">{sub.startDate ?? '—'}</td>
                      <td className="t-td num">{sub.nextBillingDate ?? '—'}</td>
                      <td className="t-td">{sub.autoRenew ? 'On' : 'Off'}</td>
                      <td className={`t-td capitalize ${STATUS_TONE[sub.status] ?? ''}`}>{sub.status}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {planOpen && <CreatePlanModal onClose={() => setPlanOpen(false)} onCreated={() => { setPlanOpen(false); refresh(); }} />}
      {subOpen && <SubscribeModal plans={plans as any} onClose={() => setSubOpen(false)} onCreated={() => { setSubOpen(false); refresh(); }} />}
    </div>
  );
}

function Kpi({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <article className="card-feature flex flex-col gap-1.5">
      <span className="text-[12.5px] font-bold tracking-[0.14em] text-neutral-500">{label.toUpperCase()}</span>
      <div className="text-2xl md:text-3xl font-extrabold tracking-tight text-black">{value}</div>
      {note && <span className="text-xs text-neutral-500">{note}</span>}
    </article>
  );
}

function CreatePlanModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [monthly, setMonthly] = useState('');
  const [yearly, setYearly] = useState('');
  const [benefits, setBenefits] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mu = trpc.subscriptions.createPlan.useMutation({
    onSuccess: (d: any) => { if (d?.success === false) setError(d.error); else onCreated(); },
    onError: e => setError(e.message),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const m = parseFloat(monthly), y = parseFloat(yearly);
    if (Number.isNaN(m) || m <= 0) return setError('Monthly price must be > 0.');
    if (Number.isNaN(y) || y <= 0) return setError('Yearly price must be > 0.');
    const lines = benefits.split('\n').map(s => s.trim()).filter(Boolean);
    mu.mutate({
      name: name.trim(), monthlyPrice: m, yearlyPrice: y, isActive,
      benefitsJSON: lines.length ? JSON.stringify(lines) : undefined,
    });
  };

  return (
    <Shell title="Create Plan" eyebrow="New plan" onClose={onClose}>
      <form onSubmit={onSubmit} className="grid gap-3 text-sm">
        <Field label="Plan name *"><input className="field-input" value={name} onChange={e=>setName(e.target.value)} required autoFocus /></Field>
        <Field label="Monthly price (GHS) *"><input type="number" min={0} step="0.01" className="field-input num" value={monthly} onChange={e=>setMonthly(e.target.value)} required /></Field>
        <Field label="Yearly price (GHS) *"><input type="number" min={0} step="0.01" className="field-input num" value={yearly} onChange={e=>setYearly(e.target.value)} required /></Field>
        <Field label="Benefits (one per line)"><textarea rows={4} className="field-input" value={benefits} onChange={e=>setBenefits(e.target.value)} /></Field>
        <label className="flex items-center gap-2 px-3 py-2 rounded-xl bg-canvas border border-line cursor-pointer">
          <input type="checkbox" checked={isActive} onChange={e=>setIsActive(e.target.checked)} className="accent-brand-500" />
          <span>Active — accept new subscribers</span>
        </label>
        {error && <div className="rounded-xl px-3 py-2 text-brand-500 bg-brand-50">{error}</div>}
        <Footer onClose={onClose} submitting={mu.isLoading} submitLabel="Save plan" />
      </form>
    </Shell>
  );
}

function SubscribeModal({
  plans, onClose, onCreated,
}: { plans: Array<{ id: number; name: string; monthlyPrice: string; isActive?: boolean }>; onClose: () => void; onCreated: () => void }) {
  const customersQ = trpc.customers.list.useQuery(undefined, { keepPreviousData: true });
  const customers = customersQ.data?.success ? customersQ.data.customers ?? [] : [];

  const [customerId, setCustomerId] = useState('');
  const [planId, setPlanId] = useState('');
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [autoRenew, setAutoRenew] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mu = trpc.subscriptions.subscribe.useMutation({
    onSuccess: (d: any) => { if (d?.success === false) setError(d.error); else onCreated(); },
    onError: e => setError(e.message),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const cid = parseInt(customerId, 10), pid = parseInt(planId, 10);
    if (!cid) return setError('Choose a customer.');
    if (!pid) return setError('Choose a plan.');
    mu.mutate({ customerId: cid, planId: pid, startDate, autoRenew });
  };

  return (
    <Shell title="Subscribe Customer" eyebrow="New enrolment" onClose={onClose}>
      <form onSubmit={onSubmit} className="grid gap-3 text-sm">
        <Field label="Customer *">
          <select className="field-input" value={customerId} onChange={e=>setCustomerId(e.target.value)} required>
            <option value="">Select…</option>
            {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>)}
          </select>
        </Field>
        <Field label="Plan *">
          <select className="field-input" value={planId} onChange={e=>setPlanId(e.target.value)} required>
            <option value="">Select…</option>
            {plans.map(p => <option key={p.id} value={p.id}>{p.name} — {ghs(Number(p.monthlyPrice))}/mo</option>)}
          </select>
        </Field>
        <Field label="Start date"><input type="date" className="field-input" value={startDate} onChange={e=>setStartDate(e.target.value)} required /></Field>
        <label className="flex items-center gap-2 px-3 py-2 rounded-xl bg-canvas border border-line cursor-pointer">
          <input type="checkbox" checked={autoRenew} onChange={e=>setAutoRenew(e.target.checked)} className="accent-brand-500" />
          <span>Auto-renew at end of billing period</span>
        </label>
        {error && <div className="rounded-xl px-3 py-2 text-brand-500 bg-brand-50">{error}</div>}
        <Footer onClose={onClose} submitting={mu.isLoading} submitLabel="Enrol" />
      </form>
    </Shell>
  );
}

function Field({ label, children }: { label: string; children: any }) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-semibold uppercase text-neutral-600">{label}</span>
      {children}
    </label>
  );
}

function Footer({ onClose, submitting, submitLabel }: { onClose: () => void; submitting: boolean; submitLabel: string }) {
  return (
    <div className="flex items-center justify-end gap-2 mt-1">
      <button type="button" className="btn-outline text-sm" onClick={onClose} disabled={submitting}>Cancel</button>
      <button type="submit" className="btn-primary text-sm" disabled={submitting}>
        <Repeat size={14} /> {submitting ? 'Saving…' : submitLabel}
      </button>
    </div>
  );
}

function Shell({ title, eyebrow, onClose, children }: { title: string; eyebrow: string; onClose: () => void; children: any }) {
  return (
    <div role="dialog" aria-modal="true"
         style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'grid', placeItems: 'center', background: 'rgba(14,10,10,0.42)', padding: 16 }}
         onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-pop" style={{ width: '100%', maxWidth: 520, maxHeight: '90vh', display: 'flex', flexDirection: 'column', border: '1px solid rgba(26,22,18,0.10)' }}>
        <header className="px-4 py-3 border-b border-line flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-500">{eyebrow}</span>
            <h2 className="text-xl font-bold mt-0.5">{title}</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1 hover:bg-canvas rounded-lg"><X size={16} /></button>
        </header>
        <div className="flex-1 overflow-auto px-4 py-3">{children}</div>
      </div>
    </div>
  );
}
