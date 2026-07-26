import { useState, FormEvent, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wrench, Plus, Loader2, Package, Trash2, X, FileText, Search } from 'lucide-react';
import { trpc } from '../lib/trpc';

type Stage = 'Intake' | 'In Progress' | 'Ready' | 'Completed';
const STAGES: Stage[] = ['Intake', 'In Progress', 'Ready', 'Completed'];

function bucket(s: string | null | undefined): Stage | null {
  if (s === 'Scheduled' || s === 'Checked In') return 'Intake';
  if (s === 'In Progress') return 'In Progress';
  if (s === 'Ready') return 'Ready';
  if (s === 'Completed') return 'Completed';
  return null;
}

type Period = 'all' | 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

function toDateOnly(value: any): string {
  if (!value) return '';
  if (typeof value === 'string') {
    const match = value.match(/^\d{4}-\d{2}-\d{2}/);
    if (match) return match[0];
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

function dateLabel(value: any): string {
  const iso = toDateOnly(value);
  if (!iso) return '-';
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString();
}

function startOfWeek(d: Date): Date {
  const x = new Date(d);
  x.setDate(x.getDate() - x.getDay());
  x.setHours(0, 0, 0, 0);
  return x;
}

function periodRange(period: Period, customFrom: string, customTo: string): { from: string; to: string } | null {
  if (period === 'all') return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = toDateOnly(today);

  if (period === 'today') return { from: todayIso, to: todayIso };
  if (period === 'week') return { from: toDateOnly(startOfWeek(today)), to: todayIso };
  if (period === 'month') return { from: toDateOnly(new Date(today.getFullYear(), today.getMonth(), 1)), to: todayIso };
  if (period === 'quarter') {
    const q = Math.floor(today.getMonth() / 3);
    return { from: toDateOnly(new Date(today.getFullYear(), q * 3, 1)), to: todayIso };
  }
  if (period === 'year') return { from: toDateOnly(new Date(today.getFullYear(), 0, 1)), to: todayIso };
  if (period === 'custom' && (customFrom || customTo)) {
    return { from: customFrom || '1970-01-01', to: customTo || '9999-12-31' };
  }
  return null;
}

function mechanicNames(value: any): string[] {
  return String(value ?? '')
    .split(/\s*(?:,|\/|&|\+)\s*/)
    .map((x) => x.trim())
    .filter(Boolean);
}

function appointmentIso(row: any): string {
  const a = row?.appointment ?? row ?? {};
  return toDateOnly(a.scheduledDate ?? a.dateIn ?? a.createdAt);
}

export function WorkshopPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [partsForAppt, setPartsForAppt] = useState<number | null>(null);
  const [period, setPeriod] = useState<Period>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [search, setSearch] = useState('');
  const [mechanicFilter, setMechanicFilter] = useState('all');

  const utils = trpc.useUtils();
  const navigate = useNavigate();
  const q = trpc.appointments.list.useQuery(undefined, { keepPreviousData: true });
  const rawRows = q.data?.success ? q.data.appointments ?? [] : [];
  const err = q.error?.message ?? (q.data?.success === false ? q.data.error : null);
  const range = useMemo(() => periodRange(period, customFrom, customTo), [period, customFrom, customTo]);

  const mechanicOptions = useMemo(() => {
    const names = new Set<string>();
    for (const row of rawRows) {
      const a = (row as any).appointment ?? {};
      for (const name of mechanicNames(a.assignedMechanic)) names.add(name);
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [rawRows]);

  const rows = useMemo(() => {
    const qText = search.trim().toLowerCase();

    return rawRows.filter((row: any) => {
      const a = row.appointment ?? {};
      const c = row.customer ?? {};
      const v = row.vehicle ?? {};
      const iso = appointmentIso(row);

      if (range && (!iso || iso < range.from || iso > range.to)) return false;

      if (mechanicFilter !== 'all') {
        const names = mechanicNames(a.assignedMechanic).map((name) => name.toLowerCase());
        if (!names.includes(mechanicFilter.toLowerCase())) return false;
      }

      if (qText) {
        const hay = [
          a.serviceType,
          a.status,
          a.assignedMechanic,
          a.notes,
          c.name,
          c.phone,
          c.email,
          v.registrationNo,
          v.make,
          v.model,
          v.year,
        ].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(qText)) return false;
      }

      return true;
    });
  }, [rawRows, range, search, mechanicFilter]);

  const updateStatus = trpc.appointments.updateStatus.useMutation({
    onSuccess: () => utils.appointments.list.invalidate(),
  });

  const buckets: Record<Stage, any[]> = { 'Intake': [], 'In Progress': [], 'Ready': [], 'Completed': [] };
  for (const r of rows) {
    const stage = bucket((r as any).appointment?.status);
    if (stage) buckets[stage].push(r);
  }

  const activePill = 'px-3 py-2 rounded-xl text-sm font-semibold bg-brand-500 text-white border border-brand-500';
  const idlePill = 'px-3 py-2 rounded-xl text-sm font-semibold bg-white text-neutral-700 border border-line hover:bg-canvas';
  const hasFilters = period !== 'all' || search.trim() || mechanicFilter !== 'all' || customFrom || customTo;

  const clearFilters = () => {
    setPeriod('all');
    setCustomFrom('');
    setCustomTo('');
    setSearch('');
    setMechanicFilter('all');
  };

  const drillDate = (iso: string) => {
    if (!iso) return;
    setPeriod('custom');
    setCustomFrom(iso);
    setCustomTo(iso);
  };

  return (
    <div className="max-w-7xl">
      <header className="flex items-end justify-between gap-3 flex-wrap mb-4">
        <div>
          <h1 className="h-section">Workshop</h1>
          <p className="mt-1 text-neutral-600 text-sm">Live job board grouped by bay status.</p>
        </div>
        <button className="btn-primary text-sm" onClick={() => setModalOpen(true)}>
          <Plus size={14} /> Open New Job
        </button>
      </header>

      {err && <div className="rounded-2xl px-4 py-3 mb-3 text-sm bg-brand-50 text-brand-500">{err}</div>}

      <section className="mb-4 grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {[
            ['all', 'All'],
            ['today', 'Today'],
            ['week', 'This week'],
            ['month', 'This month'],
            ['quarter', 'This quarter'],
            ['year', 'This year'],
            ['custom', 'Custom'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={period === key ? activePill : idlePill}
              onClick={() => setPeriod(key as Period)}
            >
              {label}
            </button>
          ))}

          {period === 'custom' && (
            <span className="inline-flex items-center gap-2">
              <input
                type="date"
                className="rounded-xl bg-white border border-line px-3 py-2 text-sm num"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
              <span className="text-neutral-400">to</span>
              <input
                type="date"
                className="rounded-xl bg-white border border-line px-3 py-2 text-sm num"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-neutral-500">
            <Wrench size={13} /> Mechanics
          </span>
          <button
            type="button"
            className={mechanicFilter === 'all' ? activePill : idlePill}
            onClick={() => setMechanicFilter('all')}
          >
            All
          </button>
          {mechanicOptions.map((name) => (
            <button
              key={name}
              type="button"
              className={mechanicFilter === name ? activePill : idlePill}
              onClick={() => setMechanicFilter(name)}
            >
              {name}
            </button>
          ))}

          <span className="h-8 w-px bg-line mx-1" />

          <div className="relative flex-1 min-w-[260px] max-w-xl">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none" />
            <input
              type="search"
              className="w-full rounded-xl bg-white border border-line pl-9 pr-3 py-2 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search customer, car, plate, job, mechanic..."
            />
          </div>

          <span className="text-xs text-neutral-500 num">
            Showing {rows.length} of {rawRows.length}
          </span>

          {hasFilters && (
            <button
              type="button"
              className="text-sm text-neutral-500 hover:text-brand-500 underline underline-offset-2"
              onClick={clearFilters}
            >
              Clear all filters
            </button>
          )}
        </div>
      </section>

      <p className="text-xs text-neutral-500 mb-2">
        Drag a card between columns to update its status, or use the dropdown on each card.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
        {STAGES.map(stage => {
          // First-status for that visual stage (the dropdown lets the operator
          // pick a more specific one — Checked In vs Scheduled, etc.).
          const stageDefault = (
            stage === 'Intake' ? 'Scheduled' :
            stage === 'In Progress' ? 'In Progress' :
            stage === 'Ready' ? 'Ready' :
            'Completed'
          ) as 'Scheduled' | 'In Progress' | 'Ready' | 'Completed';
          return (
            <section
              key={stage}
              className="bg-white border border-line rounded-2xl p-3 min-h-[16rem] transition-colors"
              onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.background = '#FFF4F5'; }}
              onDragLeave={(e) => { e.currentTarget.style.background = ''; }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.style.background = '';
                const id = parseInt(e.dataTransfer.getData('application/x-appt-id'), 10);
                if (id) updateStatus.mutate({ id, status: stageDefault });
              }}
            >
              <header className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">{stage}</span>
                <span className="text-xs num text-neutral-500">
                  {q.isLoading ? <Loader2 size={12} className="animate-spin inline" /> : buckets[stage].length}
                </span>
              </header>
              <div className="h-px bg-line mb-2" />
              {q.isLoading ? (
                <p className="text-sm text-neutral-500">Loading…</p>
              ) : buckets[stage].length === 0 ? (
                <p className="text-sm text-neutral-500">No jobs.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {buckets[stage].map((row: any) => {
                    const a = row.appointment;
                    const c = row.customer;
                    const v = row.vehicle;
                    const iso = appointmentIso(row);
                    const mechs = mechanicNames(a.assignedMechanic);
                    return (
                      <li
                        key={a.id}
                        className="bg-canvas rounded-xl p-2.5 border border-line cursor-grab active:cursor-grabbing"
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData('application/x-appt-id', String(a.id));
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                      >
                        <button
                          type="button"
                          className="block text-left text-sm font-semibold text-black hover:text-brand-600"
                          onClick={() => setSearch(a.serviceType ?? '')}
                        >
                          {a.serviceType ?? 'Service'}
                        </button>
                        <button
                          type="button"
                          className="block text-left text-xs text-neutral-600 truncate mt-0.5 hover:text-brand-600 hover:underline underline-offset-2"
                          onClick={() => setSearch(c?.name ?? '')}
                        >
                          {c?.name ?? '-'}
                        </button>
                        <div className="text-xs text-neutral-600 mt-0.5 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            className="truncate hover:text-brand-600 hover:underline underline-offset-2"
                            onClick={() => setSearch(v?.registrationNo ?? '')}
                          >
                            {v?.registrationNo ?? '-'}
                          </button>
                          <button
                            type="button"
                            className="num hover:text-brand-600 hover:underline underline-offset-2"
                            onClick={() => drillDate(iso)}
                          >
                            {dateLabel(a.scheduledDate ?? a.dateIn)}
                          </button>
                        </div>
                        {(v?.make || v?.model) && (
                          <button
                            type="button"
                            className="block mt-0.5 text-xs text-neutral-500 truncate hover:text-brand-600 hover:underline underline-offset-2"
                            onClick={() => setSearch([v?.make, v?.model].filter(Boolean).join(' '))}
                          >
                            {[v?.make, v?.model].filter(Boolean).join(' ')}
                          </button>
                        )}
                        {mechs.length > 0 && (
                          <div className="text-xs text-neutral-600 mt-1 flex flex-wrap gap-1">
                            <span>Mechanic:</span>
                            {mechs.map((name) => (
                              <button
                                key={name}
                                type="button"
                                className="hover:text-brand-600 hover:underline underline-offset-2"
                                onClick={() => setMechanicFilter(name)}
                              >
                                {name}
                              </button>
                            ))}
                          </div>
                        )}
                        <select
                          className="field-input mt-2 text-xs"
                          value={a.status ?? 'Scheduled'}
                          onChange={(e) => updateStatus.mutate({ id: a.id, status: e.target.value as any })}
                          disabled={updateStatus.isLoading}
                        >
                          {['Scheduled','Checked In','In Progress','Ready','Completed','Cancelled'].map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                        <div className="mt-1.5 flex items-center gap-1">
                          <button
                            type="button"
                            className="flex-1 text-xs flex items-center justify-center gap-1 px-2 py-1 rounded-lg bg-white border border-line hover:bg-canvas"
                            onClick={() => setPartsForAppt(a.id)}
                          >
                            <Package size={12} /> Parts
                          </button>
                          <button
                            type="button"
                            className="flex-1 text-xs flex items-center justify-center gap-1 px-2 py-1 rounded-lg bg-brand-50 text-brand-500 hover:bg-brand-100"
                            onClick={() => navigate(`/vsr/${a.id}`)}
                          >
                            <FileText size={12} /> Open
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      <OpenJobModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={() => { setModalOpen(false); utils.appointments.list.invalidate(); }}
      />
      {partsForAppt !== null && (
        <PartsModal appointmentId={partsForAppt} onClose={() => setPartsForAppt(null)} />
      )}
    </div>
  );
}

function PartsModal({
  appointmentId, onClose,
}: { appointmentId: number; onClose: () => void }) {
  const utils = trpc.useUtils();
  const partsQ = trpc.appointments.listParts.useQuery({ appointmentId }, { keepPreviousData: true });
  const inventoryQ = trpc.inventory.list.useQuery({}, { keepPreviousData: true });
  const inventoryItems: any[] = Array.isArray(inventoryQ.data) ? inventoryQ.data : [];
  const parts = partsQ.data?.success ? partsQ.data.parts ?? [] : [];

  const [inventoryItemId, setInventoryItemId] = useState('');
  const [partName, setPartName] = useState('');
  const [supplier, setSupplier] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [error, setError] = useState<string | null>(null);

  // When an inventory item is chosen, prefill partName/supplier/sellPrice.
  const onPickInventory = (id: string) => {
    setInventoryItemId(id);
    if (!id) return;
    const it = inventoryItems.find((x: any) => x.id === parseInt(id, 10));
    if (!it) return;
    setPartName(it.itemName ?? '');
    setSupplier(it.supplier ?? '');
    setSellPrice(String(it.unitPrice ?? ''));
  };

  const addMu = trpc.appointments.addPart.useMutation({
    onSuccess: (d: any) => {
      if (d?.success === false) { setError(d.error); return; }
      setError(null);
      setInventoryItemId(''); setPartName(''); setSupplier('');
      setBuyPrice(''); setSellPrice(''); setQuantity('1');
      utils.appointments.listParts.invalidate({ appointmentId });
      utils.inventory.list.invalidate();
    },
    onError: (e) => setError(e.message),
  });
  const delMu = trpc.appointments.removePart.useMutation({
    onSuccess: () => {
      utils.appointments.listParts.invalidate({ appointmentId });
      utils.inventory.list.invalidate();
    },
    onError: (e) => setError(e.message),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const qty = parseInt(quantity, 10);
    const sell = parseFloat(sellPrice);
    if (Number.isNaN(qty) || qty <= 0) return setError('Quantity must be a positive integer.');
    if (Number.isNaN(sell) || sell < 0) return setError('Sell price must be ≥ 0.');
    let buy: number | undefined;
    if (buyPrice.trim()) {
      const n = parseFloat(buyPrice);
      if (Number.isNaN(n) || n < 0) return setError('Buy price must be ≥ 0.');
      buy = n;
    }
    addMu.mutate({
      appointmentId,
      inventoryItemId: inventoryItemId ? parseInt(inventoryItemId, 10) : undefined,
      partName: partName.trim() || undefined,
      supplier: supplier.trim() || undefined,
      buyPrice: buy,
      sellPrice: sell,
      quantity: qty,
    });
  };

  const subtotal = parts.reduce((s: number, p: any) => s + Number(p.sellPrice ?? 0) * Number(p.quantity ?? 0), 0);

  return (
    <div role="dialog" aria-modal="true"
         style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'grid', placeItems: 'center', background: 'rgba(14,10,10,0.42)', padding: 16 }}
         onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl shadow-pop" style={{ width: '100%', maxWidth: 720, maxHeight: '90vh', display: 'flex', flexDirection: 'column', border: '1px solid rgba(26,22,18,0.10)' }}>
        <header className="px-4 py-3 border-b border-line flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-500">Parts ledger</span>
            <h2 className="text-xl font-bold mt-0.5">Job #{appointmentId}</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1 hover:bg-canvas rounded-lg"><X size={16} /></button>
        </header>
        <div className="flex-1 overflow-auto px-4 py-3 grid gap-4">
          <section>
            <h3 className="text-sm font-semibold mb-2">Lines on this job</h3>
            <div className="rounded-xl border border-line overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="t-th">Part</th>
                    <th className="t-th">Supplier</th>
                    <th className="t-th">Qty</th>
                    <th className="t-th">Sell</th>
                    <th className="t-th">Line</th>
                    <th className="t-th" style={{ width: '2.5rem' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {partsQ.isLoading && <tr><td colSpan={6} className="px-3 py-3 text-center text-neutral-500"><Loader2 size={14} className="animate-spin inline" /></td></tr>}
                  {!partsQ.isLoading && parts.length === 0 && <tr><td colSpan={6} className="px-3 py-3 text-center text-neutral-500">No parts on this job yet.</td></tr>}
                  {parts.map((p: any) => (
                    <tr key={p.id}>
                      <td className="t-td">{p.partName ?? `#${p.inventoryItemId ?? '—'}`}</td>
                      <td className="t-td text-neutral-600">{p.supplier ?? '—'}</td>
                      <td className="t-td num">{p.quantity}</td>
                      <td className="t-td num">GHS {Number(p.sellPrice ?? 0).toFixed(2)}</td>
                      <td className="t-td num font-semibold">GHS {(Number(p.sellPrice ?? 0) * Number(p.quantity ?? 0)).toFixed(2)}</td>
                      <td className="t-td">
                        <button
                          type="button"
                          className="p-1 text-brand-500 hover:bg-brand-50 rounded-lg disabled:opacity-50"
                          onClick={() => { if (window.confirm('Remove this part?')) delMu.mutate({ id: p.id }); }}
                          disabled={delMu.isLoading}
                          title="Remove"
                        >
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {parts.length > 0 && (
                    <tr><td colSpan={4} className="t-td text-right text-xs font-semibold uppercase text-neutral-500">Subtotal</td>
                        <td className="t-td num font-bold">GHS {subtotal.toFixed(2)}</td>
                        <td className="t-td"></td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold mb-2">Add a part</h3>
            <form onSubmit={onSubmit} className="grid grid-cols-2 gap-3 text-sm">
              <label className="grid gap-1 col-span-2">
                <span className="text-xs font-semibold uppercase text-neutral-600">From inventory (optional)</span>
                <select className="field-input" value={inventoryItemId} onChange={(e) => onPickInventory(e.target.value)}>
                  <option value="">— Manual entry —</option>
                  {inventoryItems.map((it: any) => (
                    <option key={it.id} value={it.id}>
                      {it.itemCode} · {it.itemName} (on hand: {it.quantity})
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1"><span className="text-xs font-semibold uppercase text-neutral-600">Part name</span><input className="field-input" value={partName} onChange={e=>setPartName(e.target.value)} /></label>
              <label className="grid gap-1"><span className="text-xs font-semibold uppercase text-neutral-600">Supplier</span><input className="field-input" value={supplier} onChange={e=>setSupplier(e.target.value)} /></label>
              <label className="grid gap-1"><span className="text-xs font-semibold uppercase text-neutral-600">Qty *</span><input type="number" min={1} className="field-input num" value={quantity} onChange={e=>setQuantity(e.target.value)} required /></label>
              <label className="grid gap-1"><span className="text-xs font-semibold uppercase text-neutral-600">Buy price (GHS)</span><input type="number" min={0} step="0.01" className="field-input num" value={buyPrice} onChange={e=>setBuyPrice(e.target.value)} /></label>
              <label className="grid gap-1 col-span-2"><span className="text-xs font-semibold uppercase text-neutral-600">Sell price (GHS) *</span><input type="number" min={0} step="0.01" className="field-input num" value={sellPrice} onChange={e=>setSellPrice(e.target.value)} required /></label>
              {error && <div className="col-span-2 rounded-xl px-3 py-2 text-brand-500 bg-brand-50">{error}</div>}
              <div className="col-span-2 flex items-center justify-end gap-2">
                <button type="submit" className="btn-primary text-sm" disabled={addMu.isLoading}>
                  <Plus size={14} /> {addMu.isLoading ? 'Adding…' : 'Add part'}
                </button>
              </div>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}

function OpenJobModal({
  open, onClose, onCreated,
}: { open: boolean; onClose: () => void; onCreated: () => void }) {
  const customersQ = trpc.customers.list.useQuery(undefined, { enabled: open, keepPreviousData: true });
  const customers = customersQ.data?.success ? customersQ.data.customers ?? [] : [];

  const [customerId, setCustomerId] = useState('');
  const [vehicleId, setVehicleId] = useState('');
  const [scheduledDate, setScheduledDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [scheduledTime, setScheduledTime] = useState('');
  const [serviceType, setServiceType] = useState('Routine Service');
  const [assignedMechanic, setAssignedMechanic] = useState('');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [status, setStatus] = useState<'Scheduled' | 'Checked In' | 'In Progress'>('Scheduled');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const vehicles = useMemo(() => {
    const cid = parseInt(customerId, 10);
    if (!cid) return [];
    const c = customers.find((x: any) => x.id === cid) as any;
    return (c?.vehicles ?? []) as any[];
  }, [customerId, customers]);

  const mu = trpc.appointments.create.useMutation({
    onSuccess: (d: any) => { if (d?.success === false) setError(d.error); else onCreated(); },
    onError: (e) => setError(e.message),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const cid = parseInt(customerId, 10);
    const vid = parseInt(vehicleId, 10);
    if (!cid) return setError('Choose a customer.');
    if (!vid) return setError('Choose a vehicle.');
    let cost: number | undefined;
    if (estimatedCost.trim()) {
      const n = parseFloat(estimatedCost);
      if (Number.isNaN(n) || n < 0) return setError('Cost must be non-negative.');
      cost = n;
    }
    mu.mutate({
      customerId: cid, vehicleId: vid, scheduledDate,
      scheduledTime: scheduledTime || undefined,
      serviceType, assignedMechanic: assignedMechanic.trim() || undefined,
      estimatedCost: cost, status, notes: notes.trim() || undefined,
    });
  };

  if (!open) return null;
  return (
    <div role="dialog" aria-modal="true" style={{ position: 'fixed', inset: 0, zIndex: 80, display: 'grid', placeItems: 'center', background: 'rgba(14,10,10,0.42)', padding: 16 }}
         onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form onSubmit={onSubmit} className="bg-white rounded-2xl shadow-pop" style={{ width: '100%', maxWidth: 620, maxHeight: '90vh', display: 'flex', flexDirection: 'column', border: '1px solid rgba(26,22,18,0.10)' }}>
        <header className="px-4 py-3 border-b border-line">
          <span className="text-xs font-semibold uppercase tracking-wider text-brand-500">New Job</span>
          <h2 className="text-xl font-bold mt-0.5">Open Workshop Job</h2>
        </header>
        <div className="flex-1 overflow-auto px-4 py-3 grid grid-cols-2 gap-3 text-sm">
          <label className="grid gap-1 col-span-2">
            <span className="text-xs font-semibold uppercase text-neutral-600">Customer *</span>
            <select className="field-input" value={customerId} onChange={(e) => { setCustomerId(e.target.value); setVehicleId(''); }} required>
              <option value="">Select…</option>
              {customers.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className="grid gap-1 col-span-2">
            <span className="text-xs font-semibold uppercase text-neutral-600">Vehicle *</span>
            <select className="field-input" value={vehicleId} onChange={(e) => setVehicleId(e.target.value)} required disabled={!customerId}>
              <option value="">Select…</option>
              {vehicles.map((v) => <option key={v.id} value={v.id}>{v.registrationNo} — {[v.make, v.model].filter(Boolean).join(' ')}</option>)}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-semibold uppercase text-neutral-600">Service type *</span>
            <input className="field-input" value={serviceType} onChange={(e) => setServiceType(e.target.value)} required />
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-semibold uppercase text-neutral-600">Initial status</span>
            <select className="field-input" value={status} onChange={(e) => setStatus(e.target.value as any)}>
              <option value="Scheduled">Scheduled</option>
              <option value="Checked In">Checked In</option>
              <option value="In Progress">In Progress</option>
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-semibold uppercase text-neutral-600">Date *</span>
            <input type="date" className="field-input" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} required />
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-semibold uppercase text-neutral-600">Time</span>
            <input type="time" className="field-input" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} />
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-semibold uppercase text-neutral-600">Mechanic</span>
            <input className="field-input" value={assignedMechanic} onChange={(e) => setAssignedMechanic(e.target.value)} placeholder="Name (or leave blank)" />
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-semibold uppercase text-neutral-600">Estimated cost (GHS)</span>
            <input type="number" className="field-input num" min={0} step="0.01" value={estimatedCost} onChange={(e) => setEstimatedCost(e.target.value)} />
          </label>
          <label className="grid gap-1 col-span-2">
            <span className="text-xs font-semibold uppercase text-neutral-600">Notes</span>
            <textarea rows={2} className="field-input" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
          {error && <div className="col-span-2 rounded-xl px-3 py-2 text-brand-500 bg-brand-50" role="alert">{error}</div>}
        </div>
        <footer className="px-4 py-3 border-t border-line flex items-center justify-end gap-2">
          <button type="button" className="btn-outline text-sm" onClick={onClose} disabled={mu.isLoading}>Cancel</button>
          <button type="submit" className="btn-primary text-sm" disabled={mu.isLoading}>
            <Wrench size={14} /> {mu.isLoading ? 'Opening…' : 'Open Job'}
          </button>
        </footer>
      </form>
    </div>
  );
}
