import { useState, FormEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Wrench, ArrowLeft, Loader2, Package, Plus, Trash2, AlertOctagon,
  Stethoscope, X,
} from 'lucide-react';
import { trpc } from '../lib/trpc';

type Sev = 'low' | 'medium' | 'high' | 'critical';
const SEV_TONE: Record<Sev, string> = {
  low: 'text-neutral-600', medium: 'text-warning',
  high: 'text-brand-500', critical: 'text-brand-600 font-bold',
};

function ghs(n: number) {
  return `GHS ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function VsrDetailPage() {
  const { id } = useParams<{ id: string }>();
  const apptId = parseInt(id ?? '', 10);
  const navigate = useNavigate();

  const apptQ = trpc.appointments.getById.useQuery(
    { id: apptId },
    { enabled: !!apptId, keepPreviousData: true },
  );
  if (Number.isNaN(apptId)) {
    return (
      <div className="max-w-3xl">
        <h1 className="h-section">Invalid VSR ID</h1>
        <button className="btn-outline text-sm mt-3" onClick={() => navigate('/workshop')}>
          <ArrowLeft size={14} /> Back to workshop
        </button>
      </div>
    );
  }

  if (apptQ.isLoading) {
    return (
      <div className="max-w-3xl">
        <Loader2 className="animate-spin inline" size={16} /> Loading job card…
      </div>
    );
  }
  const ok = apptQ.data?.success === true;
  if (!ok) {
    return (
      <div className="max-w-3xl">
        <h1 className="h-section">Not found</h1>
        <p className="text-sm text-neutral-600 mt-2">{apptQ.data?.success === false ? apptQ.data.error : 'Job not found.'}</p>
        <button className="btn-outline text-sm mt-3" onClick={() => navigate('/workshop')}>
          <ArrowLeft size={14} /> Back to workshop
        </button>
      </div>
    );
  }
  const row: any = apptQ.data?.success ? apptQ.data.appointment : null;
  const a = row?.appointment ?? {};
  const c = row?.customer ?? {};
  const v = row?.vehicle ?? {};

  return (
    <div className="max-w-6xl">
      <div className="flex items-center justify-between mb-3">
        <button className="text-sm text-neutral-600 hover:text-black flex items-center gap-1" onClick={() => navigate('/workshop')}>
          <ArrowLeft size={14} /> Back to workshop
        </button>
        <div className="flex items-center gap-2">
          <a
            href={`/print/jobcard/${a.id}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold bg-white border border-line text-neutral-700 hover:bg-canvas"
            title="Print AGL-JC-001 job card"
          >
            Job Card
          </a>
          <a
            href={`/print/invoice/${a.id}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm font-semibold bg-brand-500 text-white hover:bg-brand-600"
            title="Print proforma invoice"
          >
            Invoice
          </a>
        </div>
      </div>

      <header className="mb-4">
        <span className="text-xs font-semibold uppercase tracking-wider text-brand-500">VSR #{a.id}</span>
        <h1 className="h-section flex items-center gap-2">
          <Wrench size={20} /> {a.serviceType ?? 'Service'}
        </h1>
        <div className="mt-1 text-sm text-neutral-600">
          <span className="font-semibold text-black">{c.name ?? '—'}</span>
          {' · '}
          {v.registrationNo ?? [v.make, v.model].filter(Boolean).join(' ') ?? '—'}
          {' · '}
          <span className="num">{a.scheduledDate ?? '—'}</span>
          {' · '}
          <span className="capitalize">{a.status ?? '—'}</span>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mb-5">
        <Info label="Status" value={a.status ?? '—'} />
        <Info label="Mechanic" value={a.assignedMechanic ?? '—'} />
        <Info label="Estimated" value={a.estimatedCost ? ghs(Number(a.estimatedCost)) : '—'} />
        <Info label="Service fee" value={a.serviceFee ? ghs(Number(a.serviceFee)) : '—'} />
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <PartsCard appointmentId={a.id} />
        <DiagnosticsCard appointmentId={a.id} />
      </div>

      <div className="mt-5">
        <PenaltiesCard appointmentId={a.id} />
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <article className="card-feature flex flex-col gap-1">
      <span className="text-[12.5px] font-bold tracking-[0.14em] text-neutral-500">{label.toUpperCase()}</span>
      <div className="text-base font-semibold text-black truncate">{value}</div>
    </article>
  );
}

function PartsCard({ appointmentId }: { appointmentId: number }) {
  const utils = trpc.useUtils();
  const q = trpc.appointments.listParts.useQuery({ appointmentId });
  const parts = q.data?.success ? q.data.parts ?? [] : [];

  const [adding, setAdding] = useState(false);
  const [partName, setPartName] = useState('');
  const [supplier, setSupplier] = useState('');
  const [buyPrice, setBuyPrice] = useState('');
  const [sellPrice, setSellPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [error, setError] = useState<string | null>(null);

  const addMu = trpc.appointments.addPart.useMutation({
    onSuccess: (d: any) => {
      if (d?.success === false) { setError(d.error); return; }
      setError(null);
      setPartName(''); setSupplier(''); setBuyPrice(''); setSellPrice(''); setQuantity('1'); setAdding(false);
      utils.appointments.listParts.invalidate({ appointmentId });
    },
    onError: e => setError(e.message),
  });
  const delMu = trpc.appointments.removePart.useMutation({
    onSuccess: () => utils.appointments.listParts.invalidate({ appointmentId }),
  });

  const onAdd = (e: FormEvent) => {
    e.preventDefault();
    const buy = parseFloat(buyPrice), sell = parseFloat(sellPrice), qty = parseInt(quantity, 10);
    if (Number.isNaN(buy) || buy < 0) return setError('Buy price must be ≥ 0.');
    if (Number.isNaN(sell) || sell < 0) return setError('Sell price must be ≥ 0.');
    if (Number.isNaN(qty) || qty <= 0) return setError('Quantity must be > 0.');
    addMu.mutate({
      appointmentId,
      partName: partName.trim(),
      supplier: supplier.trim() || undefined,
      buyPrice: buy, sellPrice: sell, quantity: qty,
    });
  };

  const subtotal = parts.reduce((s: number, p: any) => s + Number(p.sellPrice ?? 0) * Number(p.quantity ?? 0), 0);

  return (
    <article className="card-feature">
      <header className="flex items-center justify-between mb-2">
        <h3 className="text-base font-bold flex items-center gap-1.5"><Package size={16} /> Parts</h3>
        {!adding && (
          <button className="text-xs font-semibold text-brand-500 hover:text-brand-600" onClick={() => setAdding(true)}>
            <Plus size={12} className="inline" /> Add part
          </button>
        )}
      </header>
      <div className="rounded-xl border border-line overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="t-th">Part</th>
              <th className="t-th">Qty</th>
              <th className="t-th">Sell</th>
              <th className="t-th">Line</th>
              <th className="t-th" style={{ width: '2.5rem' }}></th>
            </tr>
          </thead>
          <tbody>
            {q.isLoading && <tr><td colSpan={5} className="px-3 py-3 text-center text-neutral-500"><Loader2 size={14} className="animate-spin inline" /></td></tr>}
            {!q.isLoading && parts.length === 0 && <tr><td colSpan={5} className="px-3 py-3 text-center text-neutral-500">No parts yet.</td></tr>}
            {parts.map((p: any) => (
              <tr key={p.id}>
                <td className="t-td">
                  <div className="font-semibold">{p.partName}</div>
                  {p.supplier && <div className="text-xs text-neutral-500">{p.supplier}</div>}
                </td>
                <td className="t-td num">{p.quantity}</td>
                <td className="t-td num">{ghs(Number(p.sellPrice ?? 0))}</td>
                <td className="t-td num font-semibold">{ghs(Number(p.sellPrice ?? 0) * Number(p.quantity ?? 0))}</td>
                <td className="t-td">
                  <button
                    className="p-1 text-brand-500 hover:bg-brand-50 rounded-lg"
                    onClick={() => { if (window.confirm('Remove part?')) delMu.mutate({ id: p.id }); }}
                    title="Remove"
                  >
                    <Trash2 size={12} />
                  </button>
                </td>
              </tr>
            ))}
            {parts.length > 0 && (
              <tr><td colSpan={3} className="t-td text-right text-xs uppercase text-neutral-500 font-semibold">Subtotal</td>
                  <td className="t-td num font-bold">{ghs(subtotal)}</td><td></td></tr>
            )}
          </tbody>
        </table>
      </div>

      {adding && (
        <form onSubmit={onAdd} className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <input className="field-input col-span-2" placeholder="Part name *" value={partName} onChange={e=>setPartName(e.target.value)} required />
          <input className="field-input" placeholder="Supplier" value={supplier} onChange={e=>setSupplier(e.target.value)} />
          <input type="number" min={1} className="field-input num" placeholder="Qty" value={quantity} onChange={e=>setQuantity(e.target.value)} required />
          <input type="number" min={0} step="0.01" className="field-input num" placeholder="Buy price (GHS)" value={buyPrice} onChange={e=>setBuyPrice(e.target.value)} required />
          <input type="number" min={0} step="0.01" className="field-input num" placeholder="Sell price (GHS) *" value={sellPrice} onChange={e=>setSellPrice(e.target.value)} required />
          {error && <div className="col-span-2 rounded-xl px-2 py-1 text-brand-500 bg-brand-50 text-xs">{error}</div>}
          <div className="col-span-2 flex items-center justify-end gap-2">
            <button type="button" className="btn-outline text-xs" onClick={() => setAdding(false)}>Cancel</button>
            <button type="submit" className="btn-primary text-xs" disabled={addMu.isLoading}>
              <Plus size={12} /> {addMu.isLoading ? 'Adding…' : 'Add'}
            </button>
          </div>
        </form>
      )}
    </article>
  );
}

function DiagnosticsCard({ appointmentId }: { appointmentId: number }) {
  const utils = trpc.useUtils();
  const q = trpc.appointments.listDiagnostics.useQuery({ appointmentId });
  const items = q.data?.success ? q.data.diagnostics ?? [] : [];

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Array<{ faultCode: string; severity: Sev; workOrder: string }>>([]);
  const [error, setError] = useState<string | null>(null);

  const startEdit = () => {
    setDraft(items.map((it: any) => ({
      faultCode: it.faultCode ?? '',
      severity: (it.severity ?? 'medium') as Sev,
      workOrder: it.workOrder ?? '',
    })));
    setEditing(true);
    setError(null);
  };

  const setMu = trpc.appointments.setDiagnostics.useMutation({
    onSuccess: (d: any) => {
      if (d?.success === false) { setError(d.error); return; }
      setEditing(false);
      utils.appointments.listDiagnostics.invalidate({ appointmentId });
    },
    onError: e => setError(e.message),
  });

  const save = () => {
    const cleaned = draft.filter(d => d.faultCode.trim()).map(d => ({
      faultCode: d.faultCode.trim(),
      severity: d.severity,
      workOrder: d.workOrder.trim() || undefined,
    }));
    setMu.mutate({ appointmentId, items: cleaned });
  };

  return (
    <article className="card-feature">
      <header className="flex items-center justify-between mb-2">
        <h3 className="text-base font-bold flex items-center gap-1.5"><Stethoscope size={16} /> Diagnostics</h3>
        {!editing ? (
          <button className="text-xs font-semibold text-brand-500 hover:text-brand-600" onClick={startEdit}>Edit</button>
        ) : (
          <button className="text-xs text-neutral-500 hover:text-black" onClick={() => setEditing(false)}>Cancel</button>
        )}
      </header>

      {!editing && (
        <div className="rounded-xl border border-line overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="t-th">Code</th>
                <th className="t-th">Severity</th>
                <th className="t-th">Work order</th>
              </tr>
            </thead>
            <tbody>
              {q.isLoading && <tr><td colSpan={3} className="px-3 py-3 text-center text-neutral-500"><Loader2 size={14} className="animate-spin inline" /></td></tr>}
              {!q.isLoading && items.length === 0 && <tr><td colSpan={3} className="px-3 py-3 text-center text-neutral-500">No diagnostics on file.</td></tr>}
              {items.map((it: any) => (
                <tr key={it.id}>
                  <td className="t-td font-semibold num">{it.faultCode}</td>
                  <td className={`t-td capitalize ${SEV_TONE[it.severity as Sev] ?? ''}`}>{it.severity}</td>
                  <td className="t-td text-neutral-700">{it.workOrder ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <div className="grid gap-2 text-sm">
          {draft.map((d, i) => (
            <div key={i} className="grid grid-cols-12 gap-2">
              <input className="field-input num col-span-3" placeholder="Code" value={d.faultCode} onChange={e => {
                const nd = [...draft]; nd[i].faultCode = e.target.value; setDraft(nd);
              }} />
              <select className="field-input col-span-2" value={d.severity} onChange={e => {
                const nd = [...draft]; nd[i].severity = e.target.value as Sev; setDraft(nd);
              }}>
                <option value="low">low</option><option value="medium">medium</option>
                <option value="high">high</option><option value="critical">critical</option>
              </select>
              <input className="field-input col-span-6" placeholder="Work order" value={d.workOrder} onChange={e => {
                const nd = [...draft]; nd[i].workOrder = e.target.value; setDraft(nd);
              }} />
              <button type="button" className="col-span-1 p-1 text-brand-500 hover:bg-brand-50 rounded-lg" onClick={() => setDraft(draft.filter((_, j) => j !== i))}>
                <X size={14} />
              </button>
            </div>
          ))}
          <button type="button" className="btn-outline text-xs self-start" onClick={() => setDraft([...draft, { faultCode: '', severity: 'medium', workOrder: '' }])}>
            <Plus size={12} /> Add row
          </button>
          {error && <div className="rounded-xl px-2 py-1 text-brand-500 bg-brand-50 text-xs">{error}</div>}
          <div className="flex items-center justify-end gap-2">
            <button type="button" className="btn-primary text-xs" onClick={save} disabled={setMu.isLoading}>
              {setMu.isLoading ? 'Saving…' : 'Save diagnostics'}
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

function PenaltiesCard({ appointmentId }: { appointmentId: number }) {
  const q = trpc.appointments.recallsForAppointment.useQuery({ appointmentId });
  const recalls = q.data?.success ? q.data.recalls ?? [] : [];
  const totalPenalty = recalls.reduce((s: number, r: any) => s + Number(r.penaltyAmount ?? 0), 0);

  return (
    <article className="card-feature">
      <header className="flex items-center justify-between mb-2">
        <h3 className="text-base font-bold flex items-center gap-1.5"><AlertOctagon size={16} /> Penalties &amp; recalls</h3>
        {recalls.length > 0 && <span className="text-xs text-brand-500 font-semibold">Total: {ghs(totalPenalty)}</span>}
      </header>
      <div className="rounded-xl border border-line overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th className="t-th">Recall ID</th>
              <th className="t-th">Reason</th>
              <th className="t-th">Penalty</th>
              <th className="t-th">Mechanics</th>
              <th className="t-th">Status</th>
              <th className="t-th">Lodged</th>
            </tr>
          </thead>
          <tbody>
            {q.isLoading && <tr><td colSpan={6} className="px-3 py-3 text-center text-neutral-500"><Loader2 size={14} className="animate-spin inline" /></td></tr>}
            {!q.isLoading && recalls.length === 0 && <tr><td colSpan={6} className="px-3 py-3 text-center text-neutral-500">No penalties on this job.</td></tr>}
            {recalls.map((r: any) => {
              const mechCount = Array.isArray(r.mechanicIds) ? r.mechanicIds.length : 0;
              return (
                <tr key={r.id}>
                  <td className="t-td num">{r.id}</td>
                  <td className="t-td">{r.recallReason}</td>
                  <td className="t-td num font-semibold text-brand-500">{ghs(Number(r.penaltyAmount ?? 0))}</td>
                  <td className="t-td num">{mechCount}</td>
                  <td className={`t-td capitalize ${r.status === 'open' ? 'text-brand-500' : 'text-neutral-700'}`}>{r.status}</td>
                  <td className="t-td num text-neutral-500">{r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </article>
  );
}
