import { useState, FormEvent } from 'react';
import { Users, UserPlus, Search, Loader2, Pencil, Download } from 'lucide-react';
import { trpc } from '../lib/trpc';
import { exportRowsToCsv } from '../lib/csvExport';

interface CustomerRow {
  id: number;
  name: string;
  phone: string;
  email?: string | null;
  preferredContact?: 'sms' | 'whatsapp' | 'email' | null;
  notificationsEnabled?: boolean | null;
  notes?: string | null;
}

export function CustomersPage() {
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<CustomerRow | null>(null);
  const utils = trpc.useUtils();

  const q = trpc.customers.list.useQuery(
    { search: search || undefined },
    { keepPreviousData: true },
  );
  const rows = q.data?.success ? q.data.customers ?? [] : [];
  const err = q.error?.message ?? (q.data?.success === false ? q.data.error : null);

  return (
    <div className="max-w-6xl">
      <header className="flex items-end justify-between gap-3 flex-wrap mb-4">
        <div>
          <h1 className="h-section">Customers</h1>
          <p className="mt-1 text-neutral-600 text-sm">Principals, contact preferences and notification settings.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-line">
            <Search size={14} className="text-neutral-500" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or phone"
              className="bg-transparent outline-none text-sm placeholder:text-neutral-400"
              style={{ minWidth: 220 }}
            />
          </div>
          <button
            type="button"
            className="btn-outline text-sm disabled:opacity-50"
            disabled={rows.length === 0}
            onClick={() => exportRowsToCsv('agl-customers', rows, [
              { header: 'ID', value: (c: any) => c.id },
              { header: 'Name', value: (c: any) => c.name ?? '' },
              { header: 'Phone', value: (c: any) => c.phone ?? '' },
              { header: 'Email', value: (c: any) => c.email ?? '' },
              { header: 'Vehicles', value: (c: any) => (c.vehicles ?? []).length },
              { header: 'Preferred', value: (c: any) => c.preferredContact ?? '' },
              { header: 'Notifications', value: (c: any) => c.notificationsEnabled ? 'on' : 'off' },
            ])}
            title="Export filtered customer list as CSV"
          >
            <Download size={14} /> CSV
          </button>
          <button className="btn-primary text-sm" onClick={() => setAddOpen(true)}>
            <UserPlus size={14} /> Add Customer
          </button>
        </div>
      </header>

      {err && <Banner tone="error">{err}</Banner>}

      <div className="bg-white rounded-2xl overflow-hidden border border-line">
        <div style={{ overflowX: 'auto' }}>
          <table className="w-full">
            <thead>
              <tr>
                <th className="t-th">Name</th>
                <th className="t-th">Phone</th>
                <th className="t-th">Email</th>
                <th className="t-th">Vehicles</th>
                <th className="t-th">Preferred</th>
                <th className="t-th">Notifs</th>
                <th className="t-th" style={{ width: '4rem' }}></th>
              </tr>
            </thead>
            <tbody>
              {q.isLoading && (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-sm text-neutral-500">
                  <Loader2 size={14} className="animate-spin inline" /> Loading…
                </td></tr>
              )}
              {!q.isLoading && rows.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-6 text-center text-sm text-neutral-500">
                  {search ? `No customers match "${search}"` : 'No customers yet.'}
                </td></tr>
              )}
              {!q.isLoading && rows.map((c: any) => (
                <tr key={c.id}>
                  <td className="t-td font-semibold">{c.name}</td>
                  <td className="t-td num">{c.phone}</td>
                  <td className="t-td">{c.email ?? '—'}</td>
                  <td className="t-td num">{c.vehicles?.length ?? 0}</td>
                  <td className="t-td capitalize">{c.preferredContact ?? '—'}</td>
                  <td className="t-td">{c.notificationsEnabled ? 'On' : 'Off'}</td>
                  <td className="t-td">
                    <button
                      type="button"
                      className="rounded-lg p-1 text-neutral-600 hover:bg-canvas hover:text-black transition-colors"
                      onClick={() => setEditing({
                        id: c.id, name: c.name, phone: c.phone, email: c.email,
                        preferredContact: c.preferredContact,
                        notificationsEnabled: c.notificationsEnabled, notes: c.notes,
                      })}
                      title="Edit"
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

      <CustomerModal
        open={addOpen}
        existing={null}
        onClose={() => setAddOpen(false)}
        onSaved={() => { setAddOpen(false); utils.customers.list.invalidate(); }}
      />
      <CustomerModal
        open={editing !== null}
        existing={editing}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); utils.customers.list.invalidate(); }}
      />
    </div>
  );
}

function CustomerModal({
  open, existing, onClose, onSaved,
}: {
  open: boolean;
  existing: CustomerRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = existing !== null;
  const [name, setName] = useState(existing?.name ?? '');
  const [phone, setPhone] = useState(existing?.phone ?? '');
  const [email, setEmail] = useState(existing?.email ?? '');
  const [preferred, setPreferred] = useState<'sms' | 'whatsapp' | 'email'>(existing?.preferredContact ?? 'whatsapp');
  const [channel, setChannel] = useState<'walk_in'|'whatsapp'|'phone'|'instagram'|'tiktok'|'facebook'|'referral'|'boss'>('walk_in');
  const [notif, setNotif] = useState(existing?.notificationsEnabled ?? true);
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [error, setError] = useState<string | null>(null);

  // Optional vehicle attached at customer-creation time. Only shown in
  // "new customer" mode. Eliminates the two-step "create customer, then go
  // to vehicles and create vehicle" friction the team flagged.
  const [addVehicle, setAddVehicle] = useState(false);
  const [vReg, setVReg] = useState('');
  const [vMake, setVMake] = useState('');
  const [vModel, setVModel] = useState('');
  const [vYear, setVYear] = useState('');
  const [vColor, setVColor] = useState('');
  const [vEngine, setVEngine] = useState('');
  const [vChassis, setVChassis] = useState('');
  const [vCondition, setVCondition] = useState('');

  // Resync state when a different row is opened in edit mode.
  const [syncedId, setSyncedId] = useState<number | null>(null);
  if (existing && existing.id !== syncedId) {
    setSyncedId(existing.id);
    setName(existing.name); setPhone(existing.phone); setEmail(existing.email ?? '');
    setPreferred((existing.preferredContact as any) ?? 'whatsapp');
    setNotif(existing.notificationsEnabled ?? true);
    setNotes(existing.notes ?? '');
    setError(null);
    setAddVehicle(false);
  } else if (!existing && syncedId !== null) {
    setSyncedId(null);
  }

  const create = trpc.customers.create.useMutation({
    onError: (e) => setError(e.message),
  });
  const update = trpc.customers.update.useMutation({
    onSuccess: (d: any) => { if (d?.success === false) setError(d.error); else onSaved(); },
    onError: (e) => setError(e.message),
  });
  const del = trpc.customers.delete.useMutation({
    onSuccess: () => onSaved(),
    onError: (e) => setError(e.message),
  });
  const createVehicle = trpc.vehicles.create.useMutation({
    onError: (e) => setError(`Customer saved, but vehicle failed: ${e.message}`),
  });

  const isPending = create.isLoading || update.isLoading || del.isLoading || createVehicle.isLoading;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const payload: any = {
      name: name.trim(), phone: phone.trim(),
      email: email.trim() || undefined,
      preferredContact: preferred,
      notificationsEnabled: notif,
      // Acquisition channel is appended to `notes` until the customers
      // table has a dedicated `acquisitionChannel` column.
      notes: [notes.trim(), `Acquired via: ${channel.replace('_', ' ')}`].filter(Boolean).join(' · '),
    };

    if (isEdit && existing) {
      update.mutate({ id: existing.id, ...payload });
      return;
    }

    // Create customer, then attach vehicle if requested.
    try {
      const result: any = await create.mutateAsync(payload);
      if (result?.success === false) {
        setError(result.error ?? 'Failed to create customer.');
        return;
      }
      const customerId = result?.customer?.id ?? result?.id;

      if (addVehicle && customerId && vReg.trim()) {
        const vResult: any = await createVehicle.mutateAsync({
          customerId,
          registrationNo: vReg.trim().toUpperCase(),
          make: vMake.trim() || 'Unknown',
          model: vModel.trim() || undefined,
          year: vYear.trim() || undefined,
          color: vColor.trim() || undefined,
          engineCapacity: vEngine.trim() || undefined,
          chassisNumber: vChassis.trim() || undefined,
          notes: vCondition.trim() ? `Intake condition: ${vCondition.trim()}` : undefined,
        });
        if (vResult?.success === false) {
          setError(`Customer saved. Vehicle error: ${vResult.error ?? 'unknown'}`);
          return;
        }
      }
      onSaved();
    } catch (err: any) {
      // mutateAsync's onError already set the message
    }
  };

  if (!open) return null;
  return (
    <ModalShell
      eyebrow={isEdit ? 'Edit' : 'New'}
      title={isEdit ? (existing?.name ?? 'Customer') : 'Add Customer'}
      onClose={onClose}
      footer={
        <>
          {isEdit && existing && (
            <button
              type="button"
              className="text-sm text-brand-500 hover:text-brand-600 mr-auto disabled:opacity-50"
              onClick={() => {
                if (window.confirm(`Delete ${existing.name}?`)) del.mutate({ id: existing.id });
              }}
              disabled={isPending}
            >
              Delete
            </button>
          )}
          <button type="button" className="btn-outline text-sm" onClick={onClose} disabled={isPending}>Cancel</button>
          <button type="submit" form="cust-form" className="btn-primary text-sm" disabled={isPending}>
            {isPending ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <form id="cust-form" onSubmit={onSubmit} className="grid grid-cols-2 gap-3 text-sm">
        <Field label="Name *" col={2}><input className="field-input" value={name} onChange={e=>setName(e.target.value)} required /></Field>
        <Field label="Phone *"><input className="field-input" value={phone} onChange={e=>setPhone(e.target.value)} required /></Field>
        <Field label="Email"><input type="email" className="field-input" value={email ?? ''} onChange={e=>setEmail(e.target.value)} /></Field>
        <Field label="Preferred contact">
          <select className="field-input" value={preferred} onChange={e=>setPreferred(e.target.value as any)}>
            <option value="whatsapp">WhatsApp</option>
            <option value="sms">SMS</option>
            <option value="email">Email</option>
          </select>
        </Field>
        <Field label="How did they find us?">
          <select className="field-input" value={channel} onChange={e=>setChannel(e.target.value as any)}>
            <option value="walk_in">Walk-in</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="phone">Phone</option>
            <option value="instagram">Instagram</option>
            <option value="tiktok">TikTok</option>
            <option value="facebook">Facebook</option>
            <option value="referral">Referral</option>
            <option value="boss">Boss / management</option>
          </select>
        </Field>
        <Field label="Notifications">
          <label className="flex items-center gap-2 px-3 py-2 rounded-xl bg-canvas border border-line cursor-pointer">
            <input type="checkbox" checked={notif} onChange={e=>setNotif(e.target.checked)} className="accent-brand-500" />
            <span>Enabled</span>
          </label>
        </Field>
        <Field label="Notes" col={2}><textarea rows={3} className="field-input" value={notes ?? ''} onChange={e=>setNotes(e.target.value)} /></Field>

        {!isEdit && (
          <div className="col-span-2 mt-1 pt-3 border-t border-line">
            <label className="flex items-center gap-2 cursor-pointer mb-2">
              <input type="checkbox" checked={addVehicle} onChange={e=>setAddVehicle(e.target.checked)} className="accent-brand-500" />
              <span className="font-semibold text-brand-600">Also register their vehicle now</span>
              <span className="text-xs text-neutral-500">— skips the second form</span>
            </label>
            {addVehicle && (
              <div className="grid grid-cols-2 gap-3 mt-2 p-3 rounded-xl bg-canvas border border-line">
                <Field label="Registration *" col={2}>
                  <input className="field-input" value={vReg} onChange={e=>setVReg(e.target.value.toUpperCase())} placeholder="GR 1234-25" required={addVehicle} />
                </Field>
                <Field label="Make *"><input className="field-input" value={vMake} onChange={e=>setVMake(e.target.value)} placeholder="Toyota" required={addVehicle} /></Field>
                <Field label="Model"><input className="field-input" value={vModel} onChange={e=>setVModel(e.target.value)} placeholder="Corolla" /></Field>
                <Field label="Year of manufacture"><input className="field-input" type="number" value={vYear} onChange={e=>setVYear(e.target.value)} placeholder="2019" /></Field>
                <Field label="Colour"><input className="field-input" value={vColor} onChange={e=>setVColor(e.target.value)} placeholder="Silver" /></Field>
                <Field label="Engine capacity"><input className="field-input" value={vEngine} onChange={e=>setVEngine(e.target.value)} placeholder="1.8L" /></Field>
                <Field label="Chassis / VIN"><input className="field-input" value={vChassis} onChange={e=>setVChassis(e.target.value)} placeholder="JT2BG22K..." /></Field>
                <Field label="Intake condition" col={2}>
                  <textarea rows={2} className="field-input" value={vCondition} onChange={e=>setVCondition(e.target.value)} placeholder="Scratches on rear bumper, working AC, ¼ tank fuel…" />
                </Field>
              </div>
            )}
          </div>
        )}

        {error && <div className="col-span-2 rounded-xl px-3 py-2 text-brand-500 bg-brand-50" role="alert">{error}</div>}
      </form>
    </ModalShell>
  );
}

function Field({ label, col = 1, children }: { label: string; col?: 1 | 2; children: any }) {
  return (
    <label className="grid gap-1" style={{ gridColumn: col === 2 ? 'span 2 / span 2' : undefined }}>
      <span className="text-xs font-semibold uppercase tracking-wide text-neutral-600">{label}</span>
      {children}
    </label>
  );
}

function ModalShell({
  eyebrow, title, onClose, footer, children,
}: { eyebrow: string; title: string; onClose: () => void; footer: any; children: any }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'grid', placeItems: 'center', background: 'rgba(14,10,10,0.42)', padding: 16 }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-2xl shadow-pop" style={{ width: '100%', maxWidth: 540, maxHeight: '90vh', display: 'flex', flexDirection: 'column', border: '1px solid rgba(26,22,18,0.10)' }}>
        <header className="px-4 py-3 border-b border-line">
          <span className="text-xs font-semibold uppercase tracking-wider text-brand-500">{eyebrow}</span>
          <h2 className="text-xl font-bold mt-0.5">{title}</h2>
        </header>
        <div className="flex-1 overflow-auto px-4 py-3">{children}</div>
        <footer className="px-4 py-3 border-t border-line flex items-center justify-end gap-2">{footer}</footer>
      </div>
    </div>
  );
}

function Banner({ tone, children }: { tone: 'error'; children: any }) {
  return <div className={`rounded-2xl px-4 py-3 mb-3 text-sm bg-brand-50 text-brand-500`}>{children}</div>;
}
