import { useRef, useState } from 'react';
import { Upload, X, FileText, Image as ImageIcon, Loader2 } from 'lucide-react';

/**
 * Controlled file uploader. Encodes each file as base64 in memory then
 * hands the consumer a structured payload — server-side procedures
 * decide where to persist (local disk, S3, Drive, etc.).
 *
 * Used by WS3-B (receipt upload on new expense/supply/purchase) and
 * WS5-A (staff documents). Restricts file types via `accept` prop.
 */
export interface UploadedFile {
  name: string;
  type: string;
  size: number;
  base64: string;
}

export function FileUploader({
  label = 'Attachments',
  multiple = false,
  accept = 'application/pdf,image/png,image/jpeg,image/jpg,application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  maxSizeMb = 10,
  value, onChange,
}: {
  label?: string;
  multiple?: boolean;
  accept?: string;
  maxSizeMb?: number;
  value: UploadedFile[];
  onChange: (files: UploadedFile[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const readAll = async (fl: FileList): Promise<UploadedFile[]> => {
    const out: UploadedFile[] = [];
    for (const f of Array.from(fl)) {
      if (f.size > maxSizeMb * 1024 * 1024) {
        throw new Error(`"${f.name}" exceeds ${maxSizeMb}MB.`);
      }
      const b64 = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => res(String(r.result).split(',')[1] ?? '');
        r.onerror = () => rej(r.error);
        r.readAsDataURL(f);
      });
      out.push({ name: f.name, type: f.type, size: f.size, base64: b64 });
    }
    return out;
  };

  const onPick = async (fl: FileList | null) => {
    if (!fl || fl.length === 0) return;
    setError(null); setBusy(true);
    try {
      const next = await readAll(fl);
      onChange(multiple ? [...value, ...next] : next.slice(0, 1));
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); if (inputRef.current) inputRef.current.value = ''; }
  };

  const remove = (i: number) => onChange(value.filter((_, idx) => idx !== i));

  return (
    <div className="grid gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-wider text-neutral-600">{label}</span>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white border border-dashed border-line hover:bg-canvas hover:border-brand-300 text-sm text-neutral-700 transition-colors"
        disabled={busy}
      >
        {busy ? <Loader2 size={14} className="animate-spin"/> : <Upload size={14}/>}
        {busy ? 'Reading…' : `Choose file${multiple ? '(s)' : ''}`}
      </button>
      <input ref={inputRef} type="file" multiple={multiple} accept={accept} className="hidden"
             onChange={(e) => onPick(e.target.files)}/>
      {error && <div className="text-xs text-brand-500">{error}</div>}
      {value.length > 0 && (
        <ul className="grid gap-1.5">
          {value.map((f, i) => (
            <li key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white border border-line text-sm">
              {f.type.startsWith('image/') ? <ImageIcon size={14} className="text-neutral-500"/> : <FileText size={14} className="text-neutral-500"/>}
              <span className="flex-1 truncate" title={f.name}>{f.name}</span>
              <span className="text-2xs text-neutral-500 num">{(f.size / 1024).toFixed(1)} KB</span>
              <button type="button" onClick={() => remove(i)} className="text-neutral-500 hover:text-brand-500" aria-label={`Remove ${f.name}`}>
                <X size={12}/>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
