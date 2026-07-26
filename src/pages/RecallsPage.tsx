import { useState, FormEvent } from 'react';
import { AlertOctagon, Loader2, Plus, CheckCircle2 } from 'lucide-react';
import { trpc } from '../lib/trpc';

export function RecallsPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const utils = trpc.useUtils();
  const recallsQuery = trpc.recalls.list.useQuery(undefined, { keepPreviousData: true });
  const rows = recallsQuery.data?.success ? recallsQuery.data.recalls ?? [] : [];

  const resolveMutation = trpc.recalls.resolve.useMutation({
    onSuccess: () => utils.recalls.list.invalidate(),
  });

  return (
    <div className="max-w-6xl">
      <header className="flex items-end justify-between gap-3 flex-wrap mb-4">
        <div>
          <h1 className="h-section">Recalls</h1>
          <p className="mt-1 text-neutral-600 text-sm">
            Returned jobs and the offsetting refund / inventory entries.
          </p>
        </div>
        <button className="btn-primary text-sm" onClick={() => setModalOpen(true)}>
          <Plus size={14} /> Lodge Recall
        </button>
      </header>

      <div className="bg-white rounded-2xl overflow-hidden border border-line">
        <div style={{ overflowX: 'auto' }}>
          <table className="w-full">
            <thead>
              <tr>
                <th className="t-th">ID</th>
                <th className="t-th">Appointment</th>
                <th className="t-th">Reason</th>
                <th className="t-th">Penalty</th>
                <th className="t-th">Mechanics</th>
                <th className="t-th">Status</th>
                <th className="t-th">Lodged</th>
                <th className="t-th" style={{ width: '5rem' }}></th>
              </tr>
            </thead>
            <tbody>
              {recallsQuery.isLoading && (
                <tr><td colSpan={8} className="px-4 py-6 text-center text-sm text-neutral-500">
                  <Loader2 size={14} className="animate-spin inline" /> Loading…
                </td></tr>
              )}
              {!recallsQuery.isLoading && rows.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-6 text-center text-sm text-neutral-500">
                  No recalls on file.
                </td></tr>
              )}
              {!recallsQuery.isLoading && rows.map((r: any) => {
                const isOpen = r.status === 'open';
                const mechCount = Array.isArray(r.mechanicIds) ? r.mechanicIds.length : 0;
                return (
                  <tr key={r.id}>
                    <td className="t-td num">{r.id}</td>
                    <td className="t-td num">#{r.originalAppointmentId}</td>
                    <td className="t-td">{r.recallReason}</td>
                    <td className="t-td num">GHS {Number(r.penaltyAmount ?? 0).toFixed(2)}</td>
                    <td className="t-td num">{mechCount}</td>
                    <td className={`t-td capitalize ${isOpen ? 'text-brand-500' : 'text-neutral-700'}`}>
                      {r.status}
                    </td>
                    <td className="t-td num text-neutral-500">
                      {r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '—'}
                    </td>
                    <td className="t-td">
                      {isOpen && (
                        <button
                          type="button"
                          className="text-xs font-semibold text-brand-500 hover:text-brand-600 disabled:opacity-50"
                          onClick={() => resolveMutation.mutate({ id: r.id })}
                          disabled={resolveMutation.isLoading}
                          title="Mark this recall as resolved"
                        >
                          <CheckCircle2 size={12} className="inline" /> Resolve
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {resolveMutation.error && (
        <div className="mt-3 rounded-xl px-3 py-2 text-sm text-brand-500 bg-brand-50" role="alert">
          {resolveMutation.error.message}
        </div>
      )}

      <LodgeRecallModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onLodged={() => {
          setModalOpen(false);
          utils.recalls.list.invalidate();
        }}
      />
    </div>
  );
}

function LodgeRecallModal({
  open,
  onClose,
  onLodged,
}: {
  open: boolean;
  onClose: () => void;
  onLodged: () => void;
}) {
  const [originalAppointmentId, setOriginalAppointmentId] = useState('');
  const [recallReason, setRecallReason] = useState('');
  const [penaltyAmount, setPenaltyAmount] = useState('');
  const [mechanicIds, setMechanicIds] = useState<number[]>([]);
  const [refundCustomer, setRefundCustomer] = useState(true);
  const [restoreParts, setRestoreParts] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // P33 — pull active staff (role=mechanic preferred but we'll also let
  // any staff be selected; recalls.lodge just needs valid staff.id).
  const staffQ = trpc.staffManagement.list.useQuery(
    { role: 'mechanic', status: 'active' },
    { enabled: open, keepPreviousData: true },
  );
  const mechanics = staffQ.data?.success ? staffQ.data.staff ?? [] : [];

  const lodgeMutation = trpc.recalls.lodge.useMutation({
    onSuccess: (data) => {
      if (data?.success === false) { setError(data.error ?? 'Lodge failed.'); return; }
      setOriginalAppointmentId(''); setRecallReason(''); setPenaltyAmount('');
      setMechanicIds([]); setError(null);
      onLodged();
    },
    onError: (e) => setError(e.message),
  });

  const toggleMechanic = (id: number) => {
    setMechanicIds(curr => curr.includes(id) ? curr.filter(x => x !== id) : [...curr, id]);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const apptId = parseInt(originalAppointmentId, 10);
    const penalty = parseFloat(penaltyAmount);
    if (!apptId) return setError('Original appointment ID is required.');
    if (!recallReason.trim()) return setError('A reason is required.');
    if (Number.isNaN(penalty) || penalty < 0) return setError('Penalty must be a non-negative number.');
    if (mechanicIds.length === 0) return setError('Select at least one mechanic.');
    lodgeMutation.mutate({
      originalAppointmentId: apptId,
      recallReason: recallReason.trim(),
      penaltyAmount: penalty,
      mechanicIds,
      refundCustomer,
      restoreParts,
    });
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed', inset: 0, zIndex: 80,
        display: 'grid', placeItems: 'center',
        background: 'rgba(14,10,10,0.42)', padding: '16px',
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <form
        onSubmit={onSubmit}
        className="bg-white rounded-2xl shadow-pop"
        style={{
          width: '100%', maxWidth: 520, maxHeight: '90vh',
          display: 'flex', flexDirection: 'column',
          border: '1px solid rgba(26,22,18,0.10)',
        }}
      >
        <header className="px-4 py-3 border-b border-line">
          <span className="text-xs font-semibold uppercase tracking-wider text-brand-500">New Recall</span>
          <h2 className="text-xl font-bold mt-0.5">Lodge Recall</h2>
        </header>

        <div className="flex-1 overflow-auto px-4 py-3 grid grid-cols-2 gap-3 text-sm">
          <label className="col-span-2 grid gap-1">
            <span className="text-xs font-semibold uppercase text-neutral-600">Original Appointment ID *</span>
            <input
              type="number"
              className="field-input num"
              value={originalAppointmentId}
              onChange={(e) => setOriginalAppointmentId(e.target.value)}
              placeholder="e.g. 142"
              required
              autoFocus
            />
          </label>
          <label className="col-span-2 grid gap-1">
            <span className="text-xs font-semibold uppercase text-neutral-600">Reason *</span>
            <textarea
              className="field-input"
              rows={3}
              value={recallReason}
              onChange={(e) => setRecallReason(e.target.value)}
              placeholder="What came back, and why."
              required
            />
          </label>
          <label className="grid gap-1">
            <span className="text-xs font-semibold uppercase text-neutral-600">Penalty (GHS) *</span>
            <input
              type="number"
              className="field-input num"
              min={0}
              step="0.01"
              value={penaltyAmount}
              onChange={(e) => setPenaltyAmount(e.target.value)}
              required
            />
          </label>
          <div className="col-span-2 grid gap-1">
            <span className="text-xs font-semibold uppercase text-neutral-600">
              Mechanics implicated * {mechanicIds.length > 0 && <span className="text-neutral-500 font-normal">({mechanicIds.length} selected)</span>}
            </span>
            <div className="rounded-xl border border-line bg-canvas p-2 max-h-44 overflow-auto flex flex-col gap-1">
              {staffQ.isLoading && <span className="text-xs text-neutral-500">Loading roster…</span>}
              {!staffQ.isLoading && mechanics.length === 0 && (
                <span className="text-xs text-neutral-500">No active mechanics on the roster.</span>
              )}
              {mechanics.map((m: any) => (
                <label key={m.id} className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-white cursor-pointer">
                  <input
                    type="checkbox"
                    checked={mechanicIds.includes(m.id)}
                    onChange={() => toggleMechanic(m.id)}
                    className="accent-brand-500"
                  />
                  <span className="text-sm">{m.name}</span>
                  <span className="text-xs text-neutral-500 ml-auto num">#{m.id}</span>
                </label>
              ))}
            </div>
            <span className="text-xs text-neutral-500">Penalty is split evenly across selected mechanics.</span>
          </div>
          <label className="col-span-2 flex items-center gap-2 px-3 py-2 rounded-xl bg-canvas border border-line cursor-pointer">
            <input
              type="checkbox"
              checked={refundCustomer}
              onChange={(e) => setRefundCustomer(e.target.checked)}
              className="accent-brand-500"
            />
            <span>Refund customer — write a <code>refund</code> transaction for this appointment.</span>
          </label>
          <label className="col-span-2 flex items-center gap-2 px-3 py-2 rounded-xl bg-canvas border border-line cursor-pointer">
            <input
              type="checkbox"
              checked={restoreParts}
              onChange={(e) => setRestoreParts(e.target.checked)}
              className="accent-brand-500"
            />
            <span>Restore parts to inventory — only if returned parts are reusable.</span>
          </label>
          {error && (
            <div className="col-span-2 rounded-xl px-3 py-2 text-brand-500 bg-brand-50" role="alert">
              {error}
            </div>
          )}
        </div>

        <footer className="px-4 py-3 border-t border-line flex items-center justify-end gap-2">
          <button type="button" className="btn-outline text-sm" onClick={onClose} disabled={lodgeMutation.isLoading}>
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={lodgeMutation.isLoading}
          >
            <AlertOctagon size={14} /> {lodgeMutation.isLoading ? 'Lodging…' : 'Lodge Recall'}
          </button>
        </footer>
      </form>
    </div>
  );
}
