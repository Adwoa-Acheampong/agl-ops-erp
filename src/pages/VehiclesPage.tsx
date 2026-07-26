import { useState, FormEvent } from 'react';
import { Car, Plus, Loader2, Pencil, History, X } from 'lucide-react';
import { PageShell } from '../components/layout/PageShell';
import { EmptyState, Modal, FormField } from '../components/ui';
import { trpc } from '../lib/trpc';

interface VehicleRow {
  id: number;
  registrationNo: string;
  make: string | null;
  model: string | null;
  year: string | null;
  color: string | null;
  notes: string | null;
  chassisNumber: string | null;
  engineCapacity: string | null;
  customerId: number;
  ownerName: string;
  ownerPhone: string;
}

export function VehiclesPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<VehicleRow | null>(null);
  const [historyForId, setHistoryForId] = useState<number | null>(null);
  const utils = trpc.useUtils();

  const customersQuery = trpc.customers.list.useQuery(undefined, {
    keepPreviousData: true,
  });

  const isLoading = customersQuery.isLoading;
  const errorMessage =
    customersQuery.error?.message ??
    (customersQuery.data?.success === false ? customersQuery.data.error : null);

  // Flatten customers + vehicles into per-vehicle rows.
  const customers = customersQuery.data?.success ? customersQuery.data.customers ?? [] : [];
  const rows: VehicleRow[] = [];
  for (const c of customers) {
    const owned = (c as any).vehicles ?? [];
    for (const v of owned) {
      rows.push({
        id: v.id,
        registrationNo: v.registrationNo ?? '—',
        make: v.make ?? null,
        model: v.model ?? null,
        year: v.year ?? null,
        color: v.color ?? null,
        notes: v.notes ?? null,
        chassisNumber: v.chassisNumber ?? null,
        engineCapacity: v.engineCapacity ?? null,
        customerId: v.customerId ?? c.id,
        ownerName: c.name ?? 'Unknown',
        ownerPhone: c.phone ?? '',
      });
    }
  }

  // Pull the service summary (last/next per vehicle) in a single round trip
  // once we know which vehicleIds exist on the page. Disabled when empty so
  // the query doesn't fire with a zero-length array (router enforces min 1).
  const vehicleIds = rows.map(r => r.id);
  const summaryQuery = trpc.vehicles.serviceSummary.useQuery(
    { vehicleIds },
    { enabled: vehicleIds.length > 0, keepPreviousData: true },
  );
  const summary =
    summaryQuery.data?.success ? summaryQuery.data.summary : ({} as Record<number, {
      lastService: string | null;
      lastServiceType: string | null;
      nextDue: string | null;
      nextDueType: string | null;
    }>);

  return (
    <PageShell
      eyebrow="Fleet"
      title="Vehicles"
      intro="Every vehicle entrusted to the workshop, with full service history, mileage and maintenance schedule. The provenance of each car, preserved."
      actions={
        <button className="btn-primary text-sm" onClick={() => setModalOpen(true)}>
          <Plus size={14} /> Register Vehicle
        </button>
      }
    >
      <div
        className="bg-white rounded-2xl overflow-hidden"
        style={{ border: '1px solid rgba(26,22,18,0.06)' }}
      >
        <div style={{ overflowX: 'auto' }}>
          <table className="w-full">
            <thead>
              <tr>
                <th className="t-th">Registration</th>
                <th className="t-th">Make and Model</th>
                <th className="t-th">Year</th>
                <th className="t-th">Owner</th>
                <th className="t-th">Last Service</th>
                <th className="t-th">Next Due</th>
                <th className="t-th" style={{ width: '4rem' }}></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center font-sans text-sm text-ink-700">
                    <span className="inline-flex items-center gap-1.5">
                      <Loader2 size={14} className="animate-spin" /> Loading fleet ledger…
                    </span>
                  </td>
                </tr>
              )}
              {!isLoading && errorMessage && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center font-sans text-sm text-brand-500">
                    {errorMessage}
                  </td>
                </tr>
              )}
              {!isLoading && !errorMessage && rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center font-sans text-sm text-ink-700">
                    No vehicles registered yet.
                  </td>
                </tr>
              )}
              {!isLoading && rows.map(v => {
                const s = summary[v.id];
                return (
                <tr key={v.id}>
                  <td className="t-td font-semibold">{v.registrationNo}</td>
                  <td className="t-td">
                    {[v.make, v.model].filter(Boolean).join(' ') || '—'}
                  </td>
                  <td className="t-td num">{v.year ?? '—'}</td>
                  <td className="t-td">
                    <div className="font-semibold">{v.ownerName}</div>
                    {v.ownerPhone && (
                      <div className="font-sans text-xs text-ink-700 num">{v.ownerPhone}</div>
                    )}
                  </td>
                  <td className="t-td">
                    {s?.lastService ? (
                      <>
                        <div className="num">{s.lastService}</div>
                        {s.lastServiceType && (
                          <div className="font-sans text-xs text-ink-700">{s.lastServiceType}</div>
                        )}
                      </>
                    ) : (
                      <span className="text-ink-700">—</span>
                    )}
                  </td>
                  <td className="t-td">
                    {s?.nextDue ? (
                      <>
                        <div className="num">{s.nextDue}</div>
                        {s.nextDueType && (
                          <div className="font-sans text-xs text-ink-700">{s.nextDueType}</div>
                        )}
                      </>
                    ) : (
                      <span className="text-ink-700">—</span>
                    )}
                  </td>
                  <td className="t-td" style={{ width: '5.5rem' }}>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        className="rounded-lg p-1 text-ink-700 hover:bg-canvas hover:text-ink-900 transition-colors"
                        onClick={() => setHistoryForId(v.id)}
                        aria-label={`History for ${v.registrationNo}`}
                        title="Service history"
                      >
                        <History size={14} />
                      </button>
                      <button
                        type="button"
                        className="rounded-lg p-1 text-ink-700 hover:bg-canvas hover:text-ink-900 transition-colors"
                        onClick={() => setEditing(v)}
                        aria-label={`Edit ${v.registrationNo}`}
                        title="Edit vehicle"
                      >
                        <Pencil size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {!isLoading && !errorMessage && rows.length === 0 && (
        <EmptyState
          icon={Car}
          title="Your fleet ledger is empty"
          description="Register a vehicle to begin tracking service intervals, maintenance alerts and ownership history. Each registration links to a customer in the relationships ledger."
          action={
            <button className="btn-primary text-sm" onClick={() => setModalOpen(true)}>
              <Plus size={14} /> Register Your First Vehicle
            </button>
          }
        />
      )}

      <RegisterVehicleModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        customers={customers as any}
        onCreated={() => {
          setModalOpen(false);
          utils.customers.list.invalidate();
        }}
      />

      <EditVehicleModal
        vehicle={editing}
        customers={customers as any}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          utils.customers.list.invalidate();
        }}
      />

      {historyForId !== null && (
        <ServiceHistoryModal
          vehicleId={historyForId}
          vehicleLabel={rows.find(v => v.id === historyForId)?.registrationNo ?? ''}
          onClose={() => setHistoryForId(null)}
        />
      )}
    </PageShell>
  );
}

// ───────────────────────────────────────────────────────────────────────────
//   Register Vehicle modal
// ───────────────────────────────────────────────────────────────────────────

function RegisterVehicleModal({
  open,
  onClose,
  customers,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  customers: Array<{ id: number; name: string; phone: string }>;
  onCreated: () => void;
}) {
  const [customerId, setCustomerId] = useState<string>('');
  const [registrationNo, setRegistrationNo] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [color, setColor] = useState('');
  const [notes, setNotes] = useState('');
  const [chassisNumber, setChassisNumber] = useState('');
  const [engineCapacity, setEngineCapacity] = useState('');
  const [error, setError] = useState<string | null>(null);

  const createMutation = trpc.vehicles.create.useMutation({
    onSuccess: (data) => {
      if (data?.success === false) {
        setError(data.error ?? 'Failed to register vehicle.');
        return;
      }
      setCustomerId('');
      setRegistrationNo('');
      setMake('');
      setModel('');
      setYear('');
      setColor('');
      setNotes('');
      setChassisNumber('');
      setEngineCapacity('');
      setError(null);
      onCreated();
    },
    onError: (e) => setError(e.message),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const cid = parseInt(customerId, 10);
    if (!cid) {
      setError('Choose an owner from the customer ledger first.');
      return;
    }
    createMutation.mutate({
      customerId: cid,
      registrationNo: registrationNo.trim(),
      make: make.trim(),
      model: model.trim() || undefined,
      year: year.trim() || undefined,
      color: color.trim() || undefined,
      notes: notes.trim() || undefined,
      chassisNumber: chassisNumber.trim() || undefined,
      engineCapacity: engineCapacity.trim() || undefined,
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow="New Registration"
      title="Register Vehicle"
      footer={
        <>
          <button type="button" className="btn-outline text-sm" onClick={onClose} disabled={createMutation.isLoading}>
            Cancel
          </button>
          <button
            type="submit"
            form="register-vehicle-form"
            className="btn-primary text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={createMutation.isLoading}
          >
            {createMutation.isLoading ? 'Saving…' : 'Register Vehicle'}
          </button>
        </>
      }
    >
      <form id="register-vehicle-form" onSubmit={onSubmit} className="grid grid-cols-2 gap-3">
        <FormField label="Owner" required span={2} hint={customers.length === 0 ? 'Add a customer first under the Customers page.' : undefined}>
          <select
            className="field-input"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            required
            disabled={customers.length === 0}
          >
            <option value="">Select a principal…</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>
            ))}
          </select>
        </FormField>

        <FormField label="Registration" required hint="Plate number. Must be unique.">
          <input
            className="field-input"
            value={registrationNo}
            onChange={(e) => setRegistrationNo(e.target.value.toUpperCase())}
            placeholder="GR-1234-23"
            required
          />
        </FormField>

        <FormField label="Make" required>
          <input
            className="field-input"
            value={make}
            onChange={(e) => setMake(e.target.value)}
            placeholder="Range Rover"
            required
          />
        </FormField>

        <FormField label="Model">
          <input
            className="field-input"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="Vogue Autobiography"
          />
        </FormField>

        <FormField label="Year">
          <input
            className="field-input"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="2018"
            inputMode="numeric"
          />
        </FormField>

        <FormField label="Colour" span={2}>
          <input
            className="field-input"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            placeholder="Santorini Black"
          />
        </FormField>

        <FormField label="Chassis Number" hint="VIN / chassis. Useful for parts lookup.">
          <input
            className="field-input num"
            value={chassisNumber}
            onChange={(e) => setChassisNumber(e.target.value.toUpperCase())}
            placeholder="SALWA2BG7HA123456"
            maxLength={64}
          />
        </FormField>

        <FormField label="Engine Capacity" hint="Displacement, e.g. 5.0L V8 or 2400cc.">
          <input
            className="field-input"
            value={engineCapacity}
            onChange={(e) => setEngineCapacity(e.target.value)}
            placeholder="5.0L V8"
            maxLength={32}
          />
        </FormField>

        <FormField label="Notes" hint="Optional. Modifications, mileage at intake, anything noteworthy." span={2}>
          <textarea
            className="field-input"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Aftermarket exhaust. Owner is particular about wheel cleaning products."
          />
        </FormField>

        {error && (
          <div
            className="col-span-2 rounded-xl px-3 py-2 font-sans text-sm text-brand-500"
            style={{ background: '#F5EBED', border: '1px solid rgba(122,31,43,0.18)' }}
            role="alert"
          >
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
}

// ───────────────────────────────────────────────────────────────────────────
//   Edit Vehicle modal
// ───────────────────────────────────────────────────────────────────────────

function EditVehicleModal({
  vehicle,
  customers,
  onClose,
  onSaved,
}: {
  vehicle: VehicleRow | null;
  customers: Array<{ id: number; name: string; phone: string }>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [customerId, setCustomerId] = useState<string>('');
  const [registrationNo, setRegistrationNo] = useState('');
  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('');
  const [color, setColor] = useState('');
  const [notes, setNotes] = useState('');
  const [chassisNumber, setChassisNumber] = useState('');
  const [engineCapacity, setEngineCapacity] = useState('');
  const [error, setError] = useState<string | null>(null);

  const open = vehicle !== null;

  const [syncedId, setSyncedId] = useState<number | null>(null);
  if (vehicle && vehicle.id !== syncedId) {
    setSyncedId(vehicle.id);
    setCustomerId(String(vehicle.customerId));
    setRegistrationNo(vehicle.registrationNo);
    setMake(vehicle.make ?? '');
    setModel(vehicle.model ?? '');
    setYear(vehicle.year ?? '');
    setColor(vehicle.color ?? '');
    setNotes(vehicle.notes ?? '');
    setChassisNumber(vehicle.chassisNumber ?? '');
    setEngineCapacity(vehicle.engineCapacity ?? '');
    setError(null);
  } else if (!vehicle && syncedId !== null) {
    setSyncedId(null);
  }

  const updateMutation = trpc.vehicles.update.useMutation({
    onSuccess: (data) => {
      if (data?.success === false) {
        setError(data.error ?? 'Failed to update vehicle.');
        return;
      }
      onSaved();
    },
    onError: (e) => setError(e.message),
  });

  const deleteMutation = trpc.vehicles.delete.useMutation({
    onSuccess: () => onSaved(),
    onError: (e) => setError(e.message),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!vehicle) return;
    setError(null);
    const cid = parseInt(customerId, 10);
    if (!cid) {
      setError('An owner is required.');
      return;
    }
    updateMutation.mutate({
      id: vehicle.id,
      customerId: cid,
      registrationNo: registrationNo.trim(),
      make: make.trim(),
      model: model.trim() || undefined,
      year: year.trim() || undefined,
      color: color.trim() || undefined,
      notes: notes.trim() || undefined,
      chassisNumber: chassisNumber.trim() || undefined,
      engineCapacity: engineCapacity.trim() || undefined,
    });
  };

  const onDelete = () => {
    if (!vehicle) return;
    if (!window.confirm(`Permanently remove ${vehicle.registrationNo} from the fleet ledger? Service history references will be lost.`)) return;
    setError(null);
    deleteMutation.mutate({ id: vehicle.id });
  };

  const isPending = updateMutation.isLoading || deleteMutation.isLoading;

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow="Edit Registration"
      title={vehicle ? vehicle.registrationNo : 'Edit Vehicle'}
      footer={
        <>
          <button
            type="button"
            className="font-sans text-sm text-brand-500 hover:text-brand-600 mr-auto disabled:opacity-50"
            onClick={onDelete}
            disabled={isPending}
          >
            Delete
          </button>
          <button type="button" className="btn-outline text-sm" onClick={onClose} disabled={isPending}>
            Cancel
          </button>
          <button
            type="submit"
            form="edit-vehicle-form"
            className="btn-primary text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={isPending}
          >
            {updateMutation.isLoading ? 'Saving…' : 'Save Changes'}
          </button>
        </>
      }
    >
      <form id="edit-vehicle-form" onSubmit={onSubmit} className="grid grid-cols-2 gap-3">
        <FormField label="Owner" required span={2}>
          <select
            className="field-input"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            required
          >
            <option value="">Select a principal…</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>{c.name} — {c.phone}</option>
            ))}
          </select>
        </FormField>

        <FormField label="Registration" required>
          <input
            className="field-input"
            value={registrationNo}
            onChange={(e) => setRegistrationNo(e.target.value.toUpperCase())}
            required
          />
        </FormField>

        <FormField label="Make" required>
          <input
            className="field-input"
            value={make}
            onChange={(e) => setMake(e.target.value)}
            required
          />
        </FormField>

        <FormField label="Model">
          <input className="field-input" value={model} onChange={(e) => setModel(e.target.value)} />
        </FormField>

        <FormField label="Year">
          <input
            className="field-input"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            inputMode="numeric"
          />
        </FormField>

        <FormField label="Colour" span={2}>
          <input className="field-input" value={color} onChange={(e) => setColor(e.target.value)} />
        </FormField>

        <FormField label="Chassis Number">
          <input
            className="field-input num"
            value={chassisNumber}
            onChange={(e) => setChassisNumber(e.target.value.toUpperCase())}
            maxLength={64}
          />
        </FormField>

        <FormField label="Engine Capacity">
          <input
            className="field-input"
            value={engineCapacity}
            onChange={(e) => setEngineCapacity(e.target.value)}
            maxLength={32}
          />
        </FormField>

        <FormField label="Notes" span={2}>
          <textarea
            className="field-input"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </FormField>

        {error && (
          <div
            className="col-span-2 rounded-xl px-3 py-2 font-sans text-sm text-brand-500"
            style={{ background: '#F5EBED', border: '1px solid rgba(122,31,43,0.18)' }}
            role="alert"
          >
            {error}
          </div>
        )}
      </form>
    </Modal>
  );
}

function ServiceHistoryModal({
  vehicleId, vehicleLabel, onClose,
}: { vehicleId: number; vehicleLabel: string; onClose: () => void }) {
  const q = trpc.vehicles.serviceHistory.useQuery({ vehicleId });
  const rows = q.data?.success ? q.data.history ?? [] : [];
  return (
    <div role="dialog" aria-modal="true"
         style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'grid', placeItems: 'center', background: 'rgba(14,10,10,0.42)', padding: 16 }}
         onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-pop" style={{ width: '100%', maxWidth: 700, maxHeight: '90vh', display: 'flex', flexDirection: 'column', border: '1px solid rgba(26,22,18,0.10)' }}>
        <header className="px-4 py-3 border-b border-line flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-500">Service history</span>
            <h2 className="text-xl font-bold mt-0.5">{vehicleLabel || `Vehicle #${vehicleId}`}</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1 hover:bg-canvas rounded-lg"><X size={16} /></button>
        </header>
        <div className="flex-1 overflow-auto px-4 py-3">
          {q.isLoading && (
            <div className="text-center py-6 text-sm text-neutral-500">
              <Loader2 size={14} className="animate-spin inline" /> Loading…
            </div>
          )}
          {!q.isLoading && rows.length === 0 && (
            <div className="text-center py-6 text-sm text-neutral-500">No service history on file.</div>
          )}
          {!q.isLoading && rows.length > 0 && (
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="t-th">Date</th>
                  <th className="t-th">Service</th>
                  <th className="t-th">Status</th>
                  <th className="t-th">Mechanic</th>
                  <th className="t-th">Cost</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r: any) => (
                  <tr key={r.id}>
                    <td className="t-td num">{r.scheduledDate ?? '—'}</td>
                    <td className="t-td">{r.serviceType ?? '—'}</td>
                    <td className="t-td capitalize">{r.status ?? '—'}</td>
                    <td className="t-td">{r.assignedMechanic ?? '—'}</td>
                    <td className="t-td num">{r.estimatedCost ? `GHS ${Number(r.estimatedCost).toFixed(2)}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
