import { useState } from 'react';
import { Database, Download, FileSpreadsheet, Loader2, ShieldCheck } from 'lucide-react';
import { PageShell } from '../components/layout/PageShell';
import { trpc } from '../lib/trpc';

type Format = 'csv' | 'xlsx';

function downloadBase64(filename: string, mime: string, base64: string) {
  const raw = atob(base64);
  const chunks: Uint8Array[] = [];
  for (let i = 0; i < raw.length; i += 8192) {
    const slice = raw.slice(i, i + 8192);
    const bytes = new Uint8Array(slice.length);
    for (let j = 0; j < slice.length; j++) bytes[j] = slice.charCodeAt(j);
    chunks.push(bytes);
  }
  const blob = new Blob(chunks, { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function ExportCenterPage() {
  const targetsQ = trpc.exports.listTargets.useQuery();
  const downloadMu = trpc.exports.download.useMutation();
  const [busy, setBusy] = useState<string | null>(null);

  const runExport = async (key: string, format: Format) => {
    const busyKey = `${key}:${format}`;
    setBusy(busyKey);
    try {
      const file = await downloadMu.mutateAsync({ key, format });
      downloadBase64(file.filename, file.mime, file.base64);
    } finally {
      setBusy(null);
    }
  };

  const targets = targetsQ.data?.ledgers ?? [];
  const fullBackup = targetsQ.data?.fullBackup;

  return (
    <PageShell
      eyebrow="Administration"
      title="Export Center"
      intro="Download operational ledgers, audit logs, and full ERP backups directly from the live database."
    >
      {targetsQ.error && (
        <div className="rounded-2xl border border-brand-500/30 bg-brand-50 px-4 py-3 font-sans text-sm text-brand-600">
          {targetsQ.error.message}
        </div>
      )}

      <section className="rounded-2xl border border-line bg-white p-4">
        <div className="flex items-start gap-3">
          <ShieldCheck className="mt-1 text-brand-500" size={20} />
          <div>
            <h2 className="font-sans text-lg font-bold">Controlled exports</h2>
            <p className="mt-1 font-sans text-sm text-neutral-600">
              Exports are admin-only and are generated from database tables, so they are not limited by page filters or visible rows.
            </p>
          </div>
        </div>
      </section>

      {fullBackup && (
        <section className="rounded-2xl border border-black/10 bg-black p-4 text-white">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <Database className="mt-1 text-brand-400" size={20} />
              <div>
                <h2 className="font-sans text-lg font-bold">{fullBackup.label}</h2>
                <p className="mt-1 font-sans text-sm text-white/70">
                  XLSX downloads one workbook with every table. CSV downloads a ZIP containing one CSV per table.
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <ExportButton
                label="CSV ZIP"
                icon="csv"
                busy={busy === `${fullBackup.key}:csv`}
                disabled={!!busy}
                onClick={() => runExport(fullBackup.key, 'csv')}
              />
              <ExportButton
                label="XLSX"
                icon="xlsx"
                busy={busy === `${fullBackup.key}:xlsx`}
                disabled={!!busy}
                onClick={() => runExport(fullBackup.key, 'xlsx')}
              />
            </div>
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-line bg-white overflow-hidden">
        <header className="grid grid-cols-[1fr_auto] gap-3 border-b border-line px-4 py-3">
          <div>
            <h2 className="font-sans text-lg font-bold">Ledgers</h2>
            <p className="font-sans text-sm text-neutral-600">Export one specific ledger at a time.</p>
          </div>
        </header>
        <div className="divide-y divide-line">
          {targetsQ.isLoading && (
            <div className="flex items-center gap-2 px-4 py-8 font-sans text-sm text-neutral-500">
              <Loader2 size={16} className="animate-spin" /> Loading export targets
            </div>
          )}
          {targets.map((target: any) => (
            <div key={target.key} className="grid grid-cols-1 gap-3 px-4 py-3 md:grid-cols-[1fr_auto] md:items-center">
              <div className="min-w-0">
                <div className="font-sans text-sm font-bold text-ink-900">{target.label}</div>
                <div className="mt-0.5 truncate font-mono text-xs text-neutral-500">{target.tables.join(', ')}</div>
              </div>
              <div className="flex gap-2">
                <ExportButton
                  label="CSV"
                  icon="csv"
                  busy={busy === `${target.key}:csv`}
                  disabled={!!busy}
                  onClick={() => runExport(target.key, 'csv')}
                />
                <ExportButton
                  label="XLSX"
                  icon="xlsx"
                  busy={busy === `${target.key}:xlsx`}
                  disabled={!!busy}
                  onClick={() => runExport(target.key, 'xlsx')}
                />
              </div>
            </div>
          ))}
        </div>
      </section>
    </PageShell>
  );
}

function ExportButton({
  label,
  icon,
  busy,
  disabled,
  onClick,
}: {
  label: string;
  icon: 'csv' | 'xlsx';
  busy: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const Icon = busy ? Loader2 : icon === 'xlsx' ? FileSpreadsheet : Download;
  return (
    <button
      type="button"
      className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-line bg-white px-3 py-2 font-sans text-sm font-semibold text-neutral-800 transition-colors hover:bg-canvas disabled:opacity-50"
      disabled={disabled}
      onClick={onClick}
    >
      <Icon size={14} className={busy ? 'animate-spin' : ''} />
      {label}
    </button>
  );
}
