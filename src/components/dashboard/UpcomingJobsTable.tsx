import { ArrowUpRight, Inbox, Loader2 } from 'lucide-react';
import { useMemo } from 'react';
import { trpc } from '../../lib/trpc';

type Row = {
  id: number | string;
  vehicle: string;
  customer: string;
  service: string;
  status: string;
  when?: string;
};

/**
 * Upcoming Jobs — derived from the next 8 scheduled service appointments.
 * Previously this component accepted a `rows` prop that the dashboard
 * never supplied, so it always rendered the empty state regardless of
 * what was actually on the board. Now it queries `appointments.list`
 * directly and ranks by scheduled date ascending.
 */
export function UpcomingJobsTable() {
  const q = trpc.appointments.list.useQuery({} as any, { keepPreviousData: true });
  const raw: any[] = q.data?.success
    ? q.data.appointments ?? []
    : Array.isArray(q.data) ? q.data : [];

  const rows: Row[] = useMemo(() => {
    const now = Date.now();
    const ranked = raw
      .map((r: any) => {
        const a = r.appointment ?? r;
        const status = String(a.status ?? '').toLowerCase();
        if (status === 'completed' || status === 'cancelled' || status === 'delivered') return null;
        const when = a.scheduledDate ?? a.scheduled_date ?? a.appointmentDate ?? a.createdAt;
        const whenMs = when ? new Date(when).getTime() : 0;
        return {
          id: a.id ?? r.id ?? Math.random(),
          vehicle: r.vehicle?.registrationNo ?? r.vehicleRegistrationNo ?? a.vehicle ?? a.registrationNo ?? '—',
          customer: r.customer?.name ?? r.customerName ?? a.customerName ?? '—',
          service: a.serviceType ?? a.description ?? a.jobDescription ?? a.notes ?? '—',
          status: a.status ?? 'Scheduled',
          when: when ? new Date(when).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : undefined,
          whenMs,
        };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => {
        // Upcoming first (>= now), then closest to now from the past.
        const ar = a.whenMs >= now ? 1 : 0;
        const br = b.whenMs >= now ? 1 : 0;
        if (ar !== br) return br - ar;
        return ar === 1 ? a.whenMs - b.whenMs : b.whenMs - a.whenMs;
      })
      .slice(0, 8)
      .map(({ whenMs: _drop, ...rest }) => rest);
    return ranked;
  }, [raw]);

  const statusChip = (status: string) => {
    const s = status.toLowerCase();
    if (s.includes('open') || s.includes('scheduled') || s.includes('booked')) return 'bg-brand-50 text-brand-600';
    if (s.includes('bay') || s.includes('progress') || s.includes('working'))  return 'bg-amber-50 text-amber-700';
    if (s.includes('part') || s.includes('wait'))                              return 'bg-neutral-100 text-neutral-700';
    if (s.includes('done') || s.includes('complete'))                          return 'bg-emerald-50 text-emerald-700';
    return 'bg-neutral-100 text-neutral-700';
  };

  return (
    <section className="card-feature">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="text-lg font-bold">Upcoming Jobs</h3>
          <p className="text-sm text-neutral-500">Next bookings across all bays</p>
        </div>
        <a href="/workshop" className="btn-outline text-sm">
          Open Kanban <ArrowUpRight size={14} />
        </a>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line">
        <table className="w-full">
          <thead>
            <tr>
              <th className="t-th">Vehicle</th>
              <th className="t-th">Customer</th>
              <th className="t-th">Service</th>
              <th className="t-th">When</th>
              <th className="t-th text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {q.isLoading && (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-neutral-500">
                  <Loader2 size={14} className="inline animate-spin mr-1" /> Loading bookings…
                </td>
              </tr>
            )}
            {!q.isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <div className="flex flex-col items-center justify-center text-center p-14 gap-3">
                    <div className="tile-red"><Inbox size={22} /></div>
                    <div className="text-base font-bold text-black">No scheduled jobs for now.</div>
                    <div className="text-sm text-neutral-500 max-w-sm">
                      Get started by creating a booking from the Kanban board.
                    </div>
                    <a href="/workshop" className="btn-primary mt-2">Create Booking</a>
                  </div>
                </td>
              </tr>
            )}
            {!q.isLoading && rows.map(r => (
              <tr key={r.id} className="hover:bg-canvas transition-colors">
                <td className="t-td font-semibold text-black">{r.vehicle}</td>
                <td className="t-td">{r.customer}</td>
                <td className="t-td max-w-[28ch] truncate" title={r.service}>{r.service}</td>
                <td className="t-td num">{r.when ?? '—'}</td>
                <td className="t-td text-right">
                  <span className={`chip ${statusChip(r.status)}`}>{r.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
