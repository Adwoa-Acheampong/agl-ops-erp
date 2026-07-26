import { useState, FormEvent } from 'react';
import { Building2, Plus, Loader2, Pencil, X, Trash2 } from 'lucide-react';
import { trpc } from '../lib/trpc';

const TIERS = ['free', 'starter', 'pro', 'enterprise'] as const;
type Tier = typeof TIERS[number];

interface TenantRow {
  id: number;
  businessName: string;
  ownerEmail: string;
  subscriptionTier: Tier;
  timezone: string | null;
  isActive: boolean;
}

export function TenantsPage() {
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<TenantRow | null>(null);
  const utils = trpc.useUtils();
  const meQ = trpc.auth.me.useQuery();
  const role = meQ.data?.user?.role;

  const q = trpc.tenants.list.useQuery(undefined, { keepPreviousData: true });
  const rows = q.data?.success ? q.data.tenants ?? [] : [];
  const err = q.error?.message ?? (q.data?.success === false ? q.data.error : null);

  if (role && role !== 'admin') {
    return (
      <div className="max-w-3xl">
        <h1 className="h-section">Tenants</h1>
        <div className="card-feature mt-4 text-sm text-neutral-600">
          Admin role required to manage tenants.
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl">
      <header className="flex items-end justify-between gap-3 flex-wrap mb-4">
        <div>
          <h1 className="h-section">Tenants</h1>
          <p className="mt-1 text-neutral-600 text-sm">Every tenant on the platform.</p>
        </div>
        <button className="btn-primary text-sm" onClick={() => setAddOpen(true)}>
          <Plus size={14} /> Create Tenant
        </button>
      </header>

      {err && <div className="rounded-2xl px-4 py-3 mb-3 text-sm bg-brand-50 text-brand-500">{err}</div>}

      <div className="bg-white rounded-2xl overflow-hidden border border-line">
        <div style={{ overflowX: 'auto' }}>
          <table className="w-full">
            <thead>
              <tr>
                <th className="t-th">ID</th>
                <th className="t-th">Business</th>
                <th className="t-th">Owner</th>
                <th className="t-th">Tier</th>
                <th className="t-th">Timezone</th>
                <th className="t-th">Active</th>
                <th className="t-th">Created</th>
                <th className="t-th" style={{ width: '3rem' }}></th>
              </tr>
            </thead>
            <tbody>
              {q.isLoading && <tr><td colSpan={8} className="px-4 py-6 text-center text-sm text-neutral-500"><Loader2 size={14} className="animate-spin inline" /> Loading…</td></tr>}
              {!q.isLoading && rows.length === 0 && <tr><td colSpan={8} className="px-4 py-6 text-center text-sm text-neutral-500">No tenants yet.</td></tr>}
              {!q.isLoading && rows.map((t: any) => (
                <tr key={t.id}>
                  <td className="t-td num">{t.id}</td>
                  <td className="t-td font-semibold">{t.businessName}</td>
                  <td className="t-td">{t.ownerEmail}</td>
                  <td className="t-td capitalize">{t.subscriptionTier}</td>
                  <td className="t-td">{t.timezone ?? '—'}</td>
                  <td className="t-td">{t.isActive ? 'Yes' : 'No'}</td>
                  <td className="t-td num text-neutral-500">{t.createdAt ? new Date(t.createdAt).toLocaleDateString() : '—'}</td>
                  <td className="t-td">
                    <button
                      type="button"
                      className="rounded-lg p-1 text-neutral-600 hover:bg-canvas hover:text-black"
                      onClick={() => setEditing({
                        id: t.id, businessName: t.businessName, ownerEmail: t.ownerEmail,
                        subscriptionTier: t.subscriptionTier, timezone: t.timezone ?? null,
                        isActive: !!t.isActive,
                      })}
                      title="Edit tenant"
                    >
                      <Pencil size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <CreateTenantModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onCreated={() => { setAddOpen(false); utils.tenants.list.invalidate(); }}
      />
      {editing && (
        <EditTenantModal
          tenant={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); utils.tenants.list.invalidate(); }}
        />
      )}
    </div>
  );
}

function EditTenantModal({
  tenant, onClose, onSaved,
}: { tenant: TenantRow; onClose: () => void; onSaved: () => void }) {
  const [businessName, setBusinessName] = useState(tenant.businessName);
  const [tier, setTier] = useState<Tier>(tenant.subscriptionTier);
  const [timezone, setTimezone] = useState(tenant.timezone ?? '');
  const [isActive, setIsActive] = useState(tenant.isActive);
  const [error, setError] = useState<string | null>(null);

  const mu = trpc.tenants.update.useMutation({
    onSuccess: (d: any) => { if (d?.success === false) setError(d.error); else onSaved(); },
    onError: e => setError(e.message),
  });

  const del = trpc.tenants.delete.useMutation({
    onSuccess: (d: any) => { if (d?.success === false) setError(d.error); else onSaved(); },
    onError: e => setError(e.message),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    mu.mutate({
      businessName: businessName.trim(),
      subscriptionTier: tier,
      timezone: timezone.trim() || undefined,
      isActive,
    } as any);
  };

  const onDelete = (hard: boolean) => {
    const verb = hard ? 'HARD DELETE' : 'deactivate';
    const msg = hard
      ? `HARD DELETE "${tenant.businessName}"?\n\nThis is irreversible. All staff, customers, vehicles, sales and history under this tenant will be detached.\n\nPrefer "Deactivate" unless absolutely sure.`
      : `Deactivate "${tenant.businessName}"? They will lose access. Data is preserved and can be reactivated.`;
    if (!window.confirm(msg)) return;
    setError(null);
    del.mutate({ id: tenant.id, hard });
  };

  return (
    <div role="dialog" aria-modal="true"
         style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'grid', placeItems: 'center', background: 'rgba(14,10,10,0.42)', padding: 16 }}
         onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form onSubmit={onSubmit} className="bg-white rounded-2xl shadow-pop" style={{ width: '100%', maxWidth: 520, maxHeight: '90vh', display: 'flex', flexDirection: 'column', border: '1px solid rgba(26,22,18,0.10)' }}>
        <header className="px-4 py-3 border-b border-line flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-500">Edit Tenant</span>
            <h2 className="text-xl font-bold mt-0.5">{tenant.businessName}</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="p-1 hover:bg-canvas rounded-lg"><X size={16} /></button>
        </header>
        <div className="flex-1 overflow-auto px-4 py-3 grid gap-3 text-sm">
          <label className="grid gap-1"><span className="text-xs font-semibold uppercase text-neutral-600">Business name</span><input className="field-input" value={businessName} onChange={e=>setBusinessName(e.target.value)} required /></label>
          <label className="grid gap-1"><span className="text-xs font-semibold uppercase text-neutral-600">Tier</span>
            <select className="field-input" value={tier} onChange={e=>setTier(e.target.value as Tier)}>
              {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="grid gap-1"><span className="text-xs font-semibold uppercase text-neutral-600">Timezone</span><input className="field-input" value={timezone} onChange={e=>setTimezone(e.target.value)} placeholder="Africa/Accra" /></label>
          <label className="flex items-center gap-2 px-3 py-2 rounded-xl bg-canvas border border-line cursor-pointer">
            <input type="checkbox" checked={isActive} onChange={e=>setIsActive(e.target.checked)} className="accent-brand-500" />
            <span>Active</span>
          </label>
          {error && <div className="rounded-xl px-3 py-2 text-brand-500 bg-brand-50">{error}</div>}
        </div>
        <footer className="px-4 py-3 border-t border-line flex items-center justify-end gap-2">
          <button
            type="button"
            className="text-sm text-brand-500 hover:text-brand-600 mr-auto inline-flex items-center gap-1 disabled:opacity-50"
            onClick={() => onDelete(false)}
            disabled={mu.isLoading || del.isLoading}
            title="Deactivate this tenant (reversible)"
          >
            <Trash2 size={14} /> {del.isLoading ? 'Deleting…' : 'Deactivate'}
          </button>
          <button
            type="button"
            className="text-xs text-neutral-500 hover:text-brand-500 mr-2 disabled:opacity-50"
            onClick={() => onDelete(true)}
            disabled={mu.isLoading || del.isLoading}
            title="Hard delete (irreversible)"
          >
            Hard delete
          </button>
          <button type="button" className="btn-outline text-sm" onClick={onClose} disabled={mu.isLoading}>Cancel</button>
          <button type="submit" className="btn-primary text-sm" disabled={mu.isLoading}>
            <Building2 size={14} /> {mu.isLoading ? 'Saving…' : 'Save'}
          </button>
        </footer>
      </form>
    </div>
  );
}

function CreateTenantModal({
  open, onClose, onCreated,
}: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const [businessName, setBusinessName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [subscriptionTier, setSubscriptionTier] = useState<typeof TIERS[number]>('free');
  const [timezone, setTimezone] = useState('Africa/Accra');
  const [error, setError] = useState<string | null>(null);

  const mu = trpc.tenants.create.useMutation({
    onSuccess: (d: any) => { if (d?.success === false) setError(d.error); else onCreated(); },
    onError: (e) => setError(e.message),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    mu.mutate({
      businessName: businessName.trim(),
      ownerEmail: ownerEmail.trim(),
      subscriptionTier,
      timezone: timezone.trim() || undefined,
    });
  };

  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'grid', placeItems: 'center', background: 'rgba(14,10,10,0.42)', padding: 16 }}
         onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form onSubmit={onSubmit} className="bg-white rounded-2xl shadow-pop" style={{ width: '100%', maxWidth: 520, maxHeight: '90vh', display: 'flex', flexDirection: 'column', border: '1px solid rgba(26,22,18,0.10)' }}>
        <header className="px-4 py-3 border-b border-line">
          <span className="text-xs font-semibold uppercase tracking-wider text-brand-500">New Tenant</span>
          <h2 className="text-xl font-bold mt-0.5">Create Tenant</h2>
        </header>
        <div className="flex-1 overflow-auto px-4 py-3 grid gap-3 text-sm">
          <label className="grid gap-1"><span className="text-xs font-semibold uppercase text-neutral-600">Business name *</span><input className="field-input" value={businessName} onChange={e=>setBusinessName(e.target.value)} required autoFocus /></label>
          <label className="grid gap-1"><span className="text-xs font-semibold uppercase text-neutral-600">Owner email *</span><input type="email" className="field-input" value={ownerEmail} onChange={e=>setOwnerEmail(e.target.value)} required /></label>
          <label className="grid gap-1"><span className="text-xs font-semibold uppercase text-neutral-600">Subscription tier</span>
            <select className="field-input" value={subscriptionTier} onChange={e=>setSubscriptionTier(e.target.value as any)}>
              {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
          <label className="grid gap-1"><span className="text-xs font-semibold uppercase text-neutral-600">Timezone</span><input className="field-input" value={timezone} onChange={e=>setTimezone(e.target.value)} placeholder="Africa/Accra" /></label>
          {error && <div className="rounded-xl px-3 py-2 text-brand-500 bg-brand-50" role="alert">{error}</div>}
        </div>
        <footer className="px-4 py-3 border-t border-line flex items-center justify-end gap-2">
          <button type="button" className="btn-outline text-sm" onClick={onClose} disabled={mu.isLoading}>Cancel</button>
          <button type="submit" className="btn-primary text-sm" disabled={mu.isLoading}>
            <Building2 size={14} /> {mu.isLoading ? 'Creating…' : 'Create'}
          </button>
        </footer>
      </form>
    </div>
  );
}
