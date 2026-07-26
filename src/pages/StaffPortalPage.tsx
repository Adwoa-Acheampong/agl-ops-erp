import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  Bot,
  CalendarDays,
  Camera,
  ClipboardList,
  GraduationCap,
  Loader2,
  Monitor,
  QrCode,
  RefreshCw,
  Wallet,
  Wrench,
  X,
} from 'lucide-react';
import { trpc } from '../lib/trpc';

type ClockKind = 'in' | 'out';
type QrProof = { qrToken: string; site?: string };

const DEFAULT_QR_SITE = 'main-workshop';

function ghs(value: unknown) {
  const n = Number(value ?? 0);
  return `GHS ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function cleanRole(value: unknown) {
  return String(value ?? '').replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

function dateLabel(value: unknown) {
  if (!value) return '-';
  const raw = value instanceof Date ? value.toISOString() : String(value);
  const iso = raw.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  return iso ?? raw.slice(0, 10);
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <section className={`rounded-2xl border border-black/10 bg-white shadow-sm ${className}`}>{children}</section>;
}

function SectionTitle({ icon: Icon, title, sub }: { icon: any; title: string; sub?: string }) {
  return (
    <header className="flex items-center gap-3 px-4 pt-4 pb-3">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-neutral-100 text-neutral-800">
        <Icon size={18} />
      </span>
      <div>
        <h2 className="font-sans text-base font-semibold text-neutral-950">{title}</h2>
        {sub && <p className="font-sans text-xs text-neutral-500">{sub}</p>}
      </div>
    </header>
  );
}

function Stat({ label, value, tone = 'dark' }: { label: string; value: React.ReactNode; tone?: 'dark' | 'good' | 'bad' }) {
  const color = tone === 'good' ? 'text-emerald-700' : tone === 'bad' ? 'text-red-600' : 'text-neutral-950';
  return (
    <div className="rounded-xl border border-black/10 bg-neutral-50 px-3 py-3">
      <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-neutral-500">{label}</p>
      <p className={`mt-1 font-mono text-lg font-semibold ${color}`}>{value}</p>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="px-4 pb-4 font-sans text-sm text-neutral-500">{label}</div>;
}

function parseQrPayload(raw: string): QrProof | null {
  const value = raw.trim();
  if (!value) return null;
  try {
    const url = new URL(value);
    const qrToken = url.searchParams.get('t') || url.searchParams.get('token');
    const site = url.searchParams.get('site') || DEFAULT_QR_SITE;
    return qrToken ? { qrToken, site } : null;
  } catch {
    const token = value.match(/(?:^|[?&\s])(?:t|token)=([^&\s]+)/)?.[1];
    const site = value.match(/(?:^|[?&\s])site=([^&\s]+)/)?.[1] ?? DEFAULT_QR_SITE;
    return token ? { qrToken: decodeURIComponent(token), site: decodeURIComponent(site) } : null;
  }
}

function deviceFingerprint() {
  if (typeof navigator === 'undefined') return undefined;
  return [navigator.userAgent, navigator.language, screen?.width, screen?.height].filter(Boolean).join(' | ').slice(0, 250);
}

function QrClockModal({
  kind,
  busy,
  onClose,
  onSubmit,
}: {
  kind: ClockKind;
  busy: boolean;
  onClose: () => void;
  onSubmit: (proof: QrProof) => Promise<void>;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const submittedRef = useRef(false);
  const [manual, setManual] = useState('');
  const [status, setStatus] = useState('Point the camera at the live shop QR.');

  async function submitRaw(raw: string) {
    const proof = parseQrPayload(raw);
    if (!proof) {
      setStatus('That QR is not an AGL clock token.');
      return;
    }
    if (submittedRef.current) return;
    submittedRef.current = true;
    setStatus('QR read. Verifying...');
    await onSubmit(proof);
  }

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    async function start() {
      const Detector = (window as any).BarcodeDetector;
      if (!Detector || !navigator.mediaDevices?.getUserMedia) {
        setStatus('Camera QR scanning is not available on this browser. Paste the QR value from the shop scanner field.');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        const detector = new Detector({ formats: ['qr_code'] });
        timer = window.setInterval(async () => {
          if (submittedRef.current || !videoRef.current) return;
          try {
            const hits = await detector.detect(videoRef.current);
            const raw = hits?.[0]?.rawValue;
            if (raw) await submitRaw(raw);
          } catch {
            // Keep the scanner alive; a single bad frame should not close it.
          }
        }, 700);
      } catch {
        setStatus('Camera permission was not available. Allow camera access or paste the QR value.');
      }
    }

    start();
    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/70 px-4 py-6 grid place-items-center">
      <section className="w-full max-w-md rounded-2xl bg-white p-4 shadow-2xl">
        <header className="flex items-center justify-between gap-3">
          <div>
            <p className="font-sans text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">AGL Clock</p>
            <h2 className="font-sans text-lg font-bold">{kind === 'in' ? 'Scan to clock in' : 'Scan to clock out'}</h2>
          </div>
          <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-xl border border-black/10">
            <X size={18} />
          </button>
        </header>

        <div className="mt-4 overflow-hidden rounded-2xl bg-neutral-950">
          <video ref={videoRef} className="aspect-square w-full object-cover" muted playsInline />
        </div>

        <p className="mt-3 rounded-xl bg-neutral-50 px-3 py-2 font-sans text-xs text-neutral-700">{status}</p>

        <div className="mt-3 grid gap-2">
          <input
            className="auth-input"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="Paste QR value if camera is unavailable"
          />
          <button
            type="button"
            disabled={busy || !manual.trim()}
            onClick={() => submitRaw(manual)}
            className="flex h-11 items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 font-sans text-sm font-semibold text-white disabled:bg-neutral-300"
          >
            {busy ? <Loader2 className="animate-spin" size={16} /> : <QrCode size={16} />}
            Verify QR
          </button>
        </div>
      </section>
    </div>
  );
}

export function StaffKioskPage() {
  const [site, setSite] = useState(DEFAULT_QR_SITE);
  const challenge = trpc.staffPortal.qrChallenge.useQuery({ site }, {
    refetchInterval: 5_000,
    retry: false,
  });
  const payload = challenge.data?.payload ?? '';
  const qrSrc = payload
    ? `https://api.qrserver.com/v1/create-qr-code/?size=420x420&margin=18&data=${encodeURIComponent(payload)}`
    : '';

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-8 text-white">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-5xl place-items-center">
        <section className="w-full rounded-3xl border border-white/10 bg-white p-6 text-neutral-950 shadow-2xl md:p-8">
          <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-2xl bg-neutral-950 text-white">
                <Monitor size={22} />
              </span>
              <div>
                <p className="font-sans text-xs font-bold uppercase tracking-[0.22em] text-neutral-500">AGL Staff Clock</p>
                <h1 className="font-sans text-2xl font-bold">Live QR Kiosk</h1>
              </div>
            </div>
            <label className="font-sans text-xs font-semibold uppercase tracking-[0.14em] text-neutral-500">
              Site
              <input
                className="ml-3 h-11 rounded-xl border border-black/10 px-3 font-mono text-sm text-neutral-950"
                value={site}
                onChange={(e) => setSite(e.target.value)}
              />
            </label>
          </header>

          <div className="grid items-center gap-8 md:grid-cols-[1fr_1.1fr]">
            <div className="rounded-3xl bg-neutral-50 p-5">
              {challenge.isLoading ? (
                <div className="grid aspect-square place-items-center">
                  <Loader2 className="animate-spin" />
                </div>
              ) : qrSrc ? (
                <img src={qrSrc} alt="Rotating staff clock QR" className="mx-auto aspect-square w-full max-w-[420px]" />
              ) : (
                <div className="grid aspect-square place-items-center text-center font-sans text-sm text-red-600">
                  {challenge.error?.message ?? 'Could not generate QR.'}
                </div>
              )}
            </div>

            <div>
              <p className="font-sans text-sm font-semibold uppercase tracking-[0.18em] text-red-600">Scan with staff portal only</p>
              <h2 className="mt-2 font-sans text-4xl font-bold tracking-tight">This code expires every 30 seconds.</h2>
              <p className="mt-4 font-sans text-base text-neutral-600">
                Staff must open the AGL staff portal, tap Scan to clock in/out, and scan this screen. Screenshots expire automatically.
              </p>
              <div className="mt-6 grid grid-cols-2 gap-3">
                <Stat label="Site" value={challenge.data?.site ?? site} />
                <Stat label="Expires in" value={`${challenge.data?.expiresInSeconds ?? '-'}s`} tone="bad" />
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export function StaffPortalPage() {
  const utils = trpc.useUtils();
  const dashboard = trpc.staffPortal.dashboard.useQuery(undefined, {
    refetchInterval: 60_000,
    retry: false,
  });
  const [notice, setNotice] = useState<string | null>(null);
  const [scanKind, setScanKind] = useState<ClockKind | null>(null);
  const clockIn = trpc.staffPortal.clockIn.useMutation();
  const clockOut = trpc.staffPortal.clockOut.useMutation();
  const data: any = dashboard.data;
  const busy = clockIn.isLoading || clockOut.isLoading || dashboard.isFetching;

  async function runClock(kind: ClockKind, proof: QrProof) {
    setNotice(null);
    const payload = { ...proof, deviceFingerprint: deviceFingerprint() };
    const result: any = kind === 'in' ? await clockIn.mutateAsync(payload) : await clockOut.mutateAsync(payload);
    if (result?.success === false) {
      setNotice(result.error ?? 'Clock action was not accepted.');
      return;
    }
    setNotice(kind === 'in' ? 'Clock-in recorded.' : 'Clock-out recorded.');
    setScanKind(null);
    await utils.staffPortal.dashboard.invalidate();
  }

  if (dashboard.isLoading) {
    return (
      <main className="min-h-screen bg-neutral-950 text-white grid place-items-center px-6">
        <div className="flex items-center gap-2 font-sans text-sm">
          <Loader2 className="animate-spin" size={18} />
          Loading staff workspace
        </div>
      </main>
    );
  }

  if (dashboard.error) {
    return (
      <main className="min-h-screen bg-neutral-50 px-5 py-8">
        <Card className="p-5">
          <p className="font-sans text-sm font-semibold text-red-700">Staff portal unavailable</p>
          <p className="mt-2 font-sans text-sm text-neutral-700">{dashboard.error.message}</p>
          <Link to="/login" className="mt-4 inline-flex rounded-xl bg-neutral-950 px-4 py-2 font-sans text-sm font-semibold text-white">
            Login again
          </Link>
        </Card>
      </main>
    );
  }

  const staff = data?.staff ?? {};
  const attendance = data?.attendance ?? {};
  const payroll = data?.payroll ?? {};
  const today = data?.today ?? {};
  const performance = data?.performance;
  const training = Array.isArray(data?.training) ? data.training : [];
  const tasks = Array.isArray(data?.tasks) ? data.tasks : [];
  const workshopLog = Array.isArray(data?.workshopLog) ? data.workshopLog : [];
  const isWorkshopSupervisor = staff.role === 'workshop_supervisor';

  return (
    <main className="min-h-screen bg-[#f6f6f3] text-neutral-950">
      <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-4 py-5 sm:px-6">
        <header className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="font-sans text-xs font-semibold uppercase tracking-[0.22em] text-neutral-500">AGL Staff</p>
            <h1 className="font-sans text-2xl font-bold tracking-tight">{staff.name ?? 'Staff workspace'}</h1>
            <p className="font-sans text-sm text-neutral-600">{cleanRole(staff.role)}</p>
          </div>
          <button
            type="button"
            onClick={() => dashboard.refetch()}
            className="grid h-11 w-11 place-items-center rounded-xl border border-black/10 bg-white text-neutral-800 shadow-sm"
            aria-label="Refresh"
          >
            {busy ? <Loader2 className="animate-spin" size={18} /> : <RefreshCw size={18} />}
          </button>
        </header>

        <div className="grid gap-4">
          <Card className="overflow-hidden">
            <div className="bg-neutral-950 px-4 py-5 text-white">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-sans text-xs uppercase tracking-[0.18em] text-white/60">Today</p>
                  <p className="mt-1 font-mono text-2xl font-semibold">{data?.now?.ymd}</p>
                  <p className="mt-1 font-sans text-sm text-white/70">Local time {data?.now?.hm}</p>
                </div>
                <span className="rounded-full bg-white/10 px-3 py-1 font-sans text-xs font-semibold">
                  {data?.clockedIn ? 'Clocked in' : today?.clockOutTime ? 'Complete' : 'Open'}
                </span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 p-4">
              <button
                type="button"
                disabled={!data?.canClockIn || clockIn.isLoading}
                onClick={() => setScanKind('in')}
                className="flex h-14 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 font-sans text-sm font-semibold text-white disabled:bg-neutral-300 disabled:text-neutral-500"
              >
                <Camera size={17} />
                Scan to clock in
              </button>
              <button
                type="button"
                disabled={!data?.canClockOut || clockOut.isLoading}
                onClick={() => setScanKind('out')}
                className="flex h-14 items-center justify-center gap-2 rounded-xl bg-red-600 px-4 font-sans text-sm font-semibold text-white disabled:bg-neutral-300 disabled:text-neutral-500"
              >
                <QrCode size={17} />
                Scan to clock out
              </button>
              <div className="col-span-2 rounded-xl bg-neutral-50 px-3 py-3 font-sans text-xs text-neutral-600">
                Clock-in opens {data?.clockWindow?.clockInOpens ?? '07:30'}; clock-out opens {data?.clockWindow?.clockOutOpens ?? '18:00'}. A fresh shop QR scan is required.
                {notice && <p className="mt-2 font-semibold text-neutral-900">{notice}</p>}
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <Stat label="Clock in" value={today?.clockInTime ?? '-'} tone={today?.clockInTime ? 'good' : 'bad'} />
            <Stat label="Clock out" value={today?.clockOutTime ?? '-'} tone={today?.clockOutTime ? 'good' : 'dark'} />
            <Stat label="Hours" value={today?.hoursWorked ?? '0.00'} />
            <Stat label="Late flags" value={attendance.lateCount ?? 0} tone={(attendance.lateCount ?? 0) > 0 ? 'bad' : 'good'} />
          </div>

          <Card>
            <SectionTitle icon={Wallet} title="Payroll" sub={`${data?.period?.month ?? ''}/${data?.period?.year ?? ''}`} />
            <div className="grid grid-cols-2 gap-3 px-4 pb-4">
              <Stat label="Base earned" value={ghs(payroll.baseEarned)} />
              <Stat label="Overtime" value={ghs(payroll.overtimePay)} tone="good" />
              <Stat label="Penalties" value={`- ${ghs(payroll.penalties)}`} tone="bad" />
              <Stat label="Net pay" value={ghs(payroll.netPay)} tone="good" />
            </div>
          </Card>

          <Card>
            <SectionTitle icon={CalendarDays} title="Attendance" sub="Current month" />
            <div className="grid grid-cols-2 gap-3 px-4 pb-4">
              <Stat label="Sessions" value={attendance.sessions ?? 0} />
              <Stat label="Payable days" value={attendance.payableDays ?? 0} />
              <Stat label="Unlogged" value={attendance.unloggedDays ?? 0} tone={(attendance.unloggedDays ?? 0) > 0 ? 'bad' : 'good'} />
              <Stat label="Excused" value={attendance.excusedAbsences ?? 0} />
            </div>
            {Array.isArray(attendance.unloggedDates) && attendance.unloggedDates.length > 0 && (
              <p className="px-4 pb-4 font-sans text-xs text-neutral-600">
                Missing dates: {attendance.unloggedDates.map(dateLabel).join(', ')}
              </p>
            )}
          </Card>

          <Card>
            <SectionTitle icon={Activity} title="Performance" sub="Latest snapshot" />
            {performance ? (
              <div className="grid grid-cols-2 gap-3 px-4 pb-4">
                <Stat label="Jobs" value={performance.jobsCompleted ?? 0} />
                <Stat label="Rating" value={performance.customerRating ?? '-'} />
                <Stat label="Revenue" value={ghs(performance.revenueGenerated)} tone="good" />
                <Stat label="Deductions" value={ghs(performance.deductionsApplied)} tone="bad" />
              </div>
            ) : (
              <Empty label="No performance snapshot yet." />
            )}
          </Card>

          <Card>
            <SectionTitle icon={GraduationCap} title="Training" sub="Assigned sessions" />
            {training.length === 0 ? (
              <Empty label="No training assigned." />
            ) : (
              <div className="divide-y divide-black/10 px-4 pb-2">
                {training.map((row: any) => (
                  <div key={row.id} className="py-3">
                    <p className="font-sans text-sm font-semibold">{row.sessionTitle}</p>
                    <p className="font-sans text-xs text-neutral-500">
                      {row.sessionCode} - {dateLabel(row.sessionDate)} - {row.passed ? 'Passed' : 'Pending'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card>
            <SectionTitle icon={ClipboardList} title="Tasks" sub="Assigned to you" />
            {tasks.length === 0 ? (
              <Empty label="No assigned tasks." />
            ) : (
              <div className="divide-y divide-black/10 px-4 pb-2">
                {tasks.map((task: any) => (
                  <div key={task.id} className="py-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="font-sans text-sm font-semibold">{task.title}</p>
                      <span className="rounded-full bg-neutral-100 px-2 py-1 font-sans text-[11px] font-semibold uppercase text-neutral-600">
                        {task.status}
                      </span>
                    </div>
                    {task.details && <p className="mt-1 font-sans text-xs text-neutral-500">{task.details}</p>}
                    {task.dueDatetime && <p className="mt-1 font-sans text-xs text-neutral-500">Due {String(task.dueDatetime).slice(0, 16)}</p>}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Link to="/fixbot" className="flex items-center justify-between rounded-2xl border border-black/10 bg-neutral-950 px-4 py-4 text-white shadow-sm">
            <span className="flex items-center gap-3 font-sans text-sm font-semibold">
              <Bot size={18} />
              Open FixBot
            </span>
            <span className="font-sans text-xs text-white/60">Assistant</span>
          </Link>

          {isWorkshopSupervisor && (
            <Card>
              <SectionTitle icon={Wrench} title="Workshop log" sub="Supervisor access" />
              {workshopLog.length === 0 ? (
                <Empty label="No workshop entries found." />
              ) : (
                <div className="divide-y divide-black/10 px-4 pb-2">
                  {workshopLog.map((job: any) => (
                    <div key={job.id} className="py-3">
                      <p className="font-sans text-sm font-semibold">{job.vsrNo ?? `Job #${job.id}`} - {job.serviceType}</p>
                      <p className="font-sans text-xs text-neutral-500">
                        {job.scheduledDate ?? dateLabel(job.dateIn)} - {job.status}
                      </p>
                      {job.assignedMechanic && <p className="mt-1 font-sans text-xs text-neutral-500">Mechanic: {job.assignedMechanic}</p>}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </div>
        {scanKind && (
          <QrClockModal
            kind={scanKind}
            busy={busy}
            onClose={() => setScanKind(null)}
            onSubmit={(proof) => runClock(scanKind, proof)}
          />
        )}
      </div>
    </main>
  );
}
