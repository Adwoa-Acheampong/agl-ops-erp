import { useState, FormEvent } from 'react';
import { Settings as SettingsIcon, Loader2, Globe2 } from 'lucide-react';
import { trpc } from '../lib/trpc';

const COMMON_TZ = [
  'Africa/Accra', 'Africa/Lagos', 'Africa/Nairobi', 'Africa/Cairo', 'Africa/Johannesburg',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin',
  'America/New_York', 'America/Los_Angeles',
  'Asia/Dubai', 'Asia/Singapore', 'Asia/Tokyo',
];

export function SettingsPage() {
  const utils = trpc.useUtils();
  const meQ = trpc.auth.me.useQuery();
  const tenantQ = trpc.auth.myTenant.useQuery(undefined, { enabled: !!meQ.data?.user });
  const tenantId = tenantQ.data?.tenantId ?? null;

  const tenantsQ = trpc.tenants.list.useQuery(undefined, { enabled: tenantId !== null });
  const all = tenantsQ.data?.success ? tenantsQ.data.tenants ?? [] : [];
  const mine = all.find((t: any) => t.id === tenantId) as any;

  const [tz, setTz] = useState<string>('');
  const [businessName, setBusinessName] = useState<string>('');
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [syncedId, setSyncedId] = useState<number | null>(null);
  if (mine && mine.id !== syncedId) {
    setSyncedId(mine.id);
    setTz(mine.timezone ?? 'Africa/Accra');
    setBusinessName(mine.businessName ?? '');
  }

  const update = trpc.tenants.update.useMutation({
    onSuccess: (d: any) => {
      if (d?.success === false) { setError(d.error); return; }
      setSavedAt(new Date()); setError(null);
      utils.tenants.list.invalidate();
    },
    onError: (e) => setError(e.message),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    update.mutate({ businessName: businessName.trim(), timezone: tz });
  };

  const role = meQ.data?.user?.role;
  const isAdmin = role === 'admin';

  return (
    <div className="max-w-3xl">
      <header className="mb-4">
        <h1 className="h-section">Settings</h1>
        <p className="mt-1 text-neutral-600 text-sm">Tenant identity and operational defaults.</p>
      </header>

      {tenantsQ.isLoading && (
        <div className="card-feature flex items-center gap-2 text-sm text-neutral-500">
          <Loader2 size={14} className="animate-spin" /> Loading…
        </div>
      )}

      {!tenantsQ.isLoading && !mine && (
        <div className="card-feature text-sm text-neutral-600">
          No tenant resolved for your account. Complete onboarding first.
        </div>
      )}

      {!tenantsQ.isLoading && mine && (
        <form onSubmit={onSubmit} className="card-feature grid gap-4">
          <section className="grid gap-2">
            <span className="text-[12.5px] font-bold uppercase tracking-[0.14em] text-neutral-500">Identity</span>
            <label className="grid gap-1 text-sm">
              <span className="text-xs font-semibold uppercase text-neutral-600">Business name</span>
              <input
                className="field-input"
                value={businessName}
                onChange={e=>setBusinessName(e.target.value)}
                disabled={!isAdmin}
                required
              />
            </label>
          </section>

          <section className="grid gap-2">
            <span className="text-[12.5px] font-bold uppercase tracking-[0.14em] text-neutral-500">Timezone</span>
            <label className="grid gap-1 text-sm">
              <span className="text-xs font-semibold uppercase text-neutral-600 flex items-center gap-1.5">
                <Globe2 size={12} /> IANA timezone
              </span>
              <select
                className="field-input"
                value={tz}
                onChange={e=>setTz(e.target.value)}
                disabled={!isAdmin}
              >
                {COMMON_TZ.map(z => <option key={z} value={z}>{z}</option>)}
                {tz && !COMMON_TZ.includes(tz) && <option value={tz}>{tz} (current)</option>}
              </select>
              <span className="text-xs text-neutral-500">
                Used by payroll: late = clock-in past 08:00 in this zone.
              </span>
            </label>
          </section>

          {error && <div className="rounded-xl px-3 py-2 text-brand-500 bg-brand-50 text-sm" role="alert">{error}</div>}

          <footer className="flex items-center justify-between">
            <span className="text-xs text-neutral-500">
              {savedAt ? `Saved at ${savedAt.toLocaleTimeString()}.` : isAdmin ? 'Edits save when you click below.' : 'Read-only — admin role required to change.'}
            </span>
            <button
              type="submit"
              className="btn-primary text-sm disabled:opacity-50"
              disabled={!isAdmin || update.isLoading}
            >
              <SettingsIcon size={14} /> {update.isLoading ? 'Saving…' : 'Save'}
            </button>
          </footer>
        </form>
      )}
    </div>
  );
}
