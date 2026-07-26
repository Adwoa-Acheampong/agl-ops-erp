import { useEffect, useRef, useState } from 'react';
import { PenTool, Type, Eraser, Check } from 'lucide-react';

/**
 * Two-mode signature capture: draw (canvas) or typed (font). Both emit
 * a PNG data URL via `onCapture(dataUrl)` so the consumer can ship a
 * single shape to the server regardless of mode.
 *
 * Used by WS4-C (Forms — manager signature/approval workflow).
 */
export function SignatureCapture({
  value, onCapture, label = 'Signature',
}: {
  value: string | null;
  onCapture: (dataUrl: string | null) => void;
  label?: string;
}) {
  const [mode, setMode] = useState<'draw' | 'type'>('draw');
  const [typed, setTyped] = useState('');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);

  // Draw mode handlers
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  }, [mode]);

  const point = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) };
  };
  const start = (e: React.PointerEvent<HTMLCanvasElement>) => { drawingRef.current = true; lastRef.current = point(e); (e.target as Element).setPointerCapture(e.pointerId); };
  const move  = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const c = canvasRef.current!; const ctx = c.getContext('2d')!;
    const p = point(e);
    ctx.beginPath(); ctx.moveTo(lastRef.current!.x, lastRef.current!.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    lastRef.current = p;
  };
  const end = () => { drawingRef.current = false; commitDraw(); };
  const commitDraw = () => {
    const c = canvasRef.current; if (!c) return;
    onCapture(c.toDataURL('image/png'));
  };
  const clear = () => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext('2d')!; ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = '#111'; ctx.lineWidth = 2;
    onCapture(null);
  };

  const commitTyped = () => {
    if (!typed.trim()) { onCapture(null); return; }
    // Render typed signature to canvas → dataURL for unified shape.
    const c = document.createElement('canvas');
    c.width = 600; c.height = 160;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#111'; ctx.font = 'italic 56px "Cormorant Garamond", "Instrument Serif", serif';
    ctx.textBaseline = 'middle';
    ctx.fillText(typed.trim(), 24, c.height / 2);
    onCapture(c.toDataURL('image/png'));
  };

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-neutral-600">{label}</span>
        <div className="inline-flex rounded-lg bg-white border border-line p-0.5">
          <button type="button" onClick={() => setMode('draw')} className={`px-2 py-1 rounded text-xs inline-flex items-center gap-1 ${mode === 'draw' ? 'bg-brand-500 text-white' : 'text-neutral-600'}`}><PenTool size={12}/> Draw</button>
          <button type="button" onClick={() => setMode('type')} className={`px-2 py-1 rounded text-xs inline-flex items-center gap-1 ${mode === 'type' ? 'bg-brand-500 text-white' : 'text-neutral-600'}`}><Type size={12}/> Type</button>
        </div>
      </div>

      {mode === 'draw' ? (
        <>
          <canvas
            ref={canvasRef}
            width={600}
            height={160}
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={end}
            onPointerLeave={end}
            className="w-full bg-white border border-line rounded-lg touch-none cursor-crosshair"
            style={{ aspectRatio: '600 / 160' }}
          />
          <div className="flex items-center justify-between">
            <button type="button" onClick={clear} className="text-xs text-neutral-700 hover:text-brand-500 inline-flex items-center gap-1"><Eraser size={12}/> Clear</button>
            {value && <span className="text-xs text-emerald-700 inline-flex items-center gap-1"><Check size={12}/> Captured</span>}
          </div>
        </>
      ) : (
        <>
          <input
            type="text"
            className="field-input text-base font-serif italic"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onBlur={commitTyped}
            placeholder="Type your name"
          />
          <span className="text-2xs text-neutral-500">Typed signature commits when the field loses focus.</span>
        </>
      )}
    </div>
  );
}
