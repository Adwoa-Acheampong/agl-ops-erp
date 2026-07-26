import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ShoppingCart, Search, Plus, Minus, Trash2, X, Pause, RotateCcw, AlertTriangle,
  CheckCircle2, Loader2, Package,
} from 'lucide-react';
import { PageShell } from '../components/layout/PageShell';
import { trpc } from '../lib/trpc';
import { useToast } from '../components/ui/Toast';

/**
 * P22 — POS Register.
 *
 * Inventa-POS-style "Sell" page optimized for counter staff: type-or-scan to
 * find a SKU, click a tile to add it, edit quantities in the cart, pick a
 * payment method, complete the sale in one keystroke. "Park sale" stashes
 * the in-progress cart in localStorage so the cashier can attend to another
 * customer and resume later (mirrors Inventa's "Tabs").
 */

interface CartLine {
  inventoryItemId: number;
  itemCode: string;
  itemName: string;
  unitPrice: number;
  quantity: number;
  onHand: number;
}

interface ParkedSale {
  id: string;
  label: string;
  parkedAt: number;
  customerName: string;
  paymentMethod: 'cash' | 'mobile_money' | 'card';
  channel: 'walk_in' | 'whatsapp' | 'phone' | 'online';
  notes: string;
  lines: CartLine[];
}

const PARKED_KEY = 'agl-pos-parked';

function loadParked(): ParkedSale[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(PARKED_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveParked(list: ParkedSale[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PARKED_KEY, JSON.stringify(list));
}

function formatGHS(n: number): string {
  return `GHS ${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function POSPage() {
  const toast = useToast();
  const [search, setSearch] = useState('');
  const [lines, setLines] = useState<CartLine[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'mobile_money' | 'card'>('cash');
  const [channel, setChannel] = useState<'walk_in' | 'whatsapp' | 'phone' | 'online'>('walk_in');
  const [customerName, setCustomerName] = useState('');
  const [notes, setNotes] = useState('');
  const [parked, setParked] = useState<ParkedSale[]>(() => loadParked());
  const [showParked, setShowParked] = useState(false);
  const searchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => { saveParked(parked); }, [parked]);
  useEffect(() => {
    // Focus the search input on mount so a barcode scanner can fire keystrokes.
    searchRef.current?.focus();
  }, []);

  const inventoryQ = trpc.inventory.list.useQuery({});
  const utils = trpc.useUtils();

  const items: any[] = Array.isArray(inventoryQ.data)
    ? (inventoryQ.data as any)
    : Array.isArray((inventoryQ.data as any)?.items)
      ? (inventoryQ.data as any).items
      : [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items.slice(0, 24);
    return items
      .filter((it) =>
        (it.itemCode ?? '').toLowerCase().includes(q) ||
        (it.itemName ?? '').toLowerCase().includes(q) ||
        (it.category ?? '').toLowerCase().includes(q)
      )
      .slice(0, 24);
  }, [items, search]);

  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
  const itemCount = lines.reduce((s, l) => s + l.quantity, 0);

  function addItem(it: any): void {
    const id = it.id;
    const onHand = Number(it.quantity ?? 0);
    if (onHand <= 0) {
      toast.warning(`${it.itemCode ?? it.itemName} is out of stock`);
      return;
    }
    setLines((prev) => {
      const existing = prev.find((l) => l.inventoryItemId === id);
      if (existing) {
        if (existing.quantity + 1 > onHand) {
          toast.warning(`Only ${onHand} on hand`);
          return prev;
        }
        return prev.map((l) =>
          l.inventoryItemId === id ? { ...l, quantity: l.quantity + 1 } : l,
        );
      }
      return [
        ...prev,
        {
          inventoryItemId: id,
          itemCode: it.itemCode ?? '',
          itemName: it.itemName ?? '',
          unitPrice: Number(it.unitPrice ?? 0),
          quantity: 1,
          onHand,
        },
      ];
    });
    setSearch('');
    searchRef.current?.focus();
  }

  function changeQty(idx: number, delta: number): void {
    setLines((prev) => {
      const next = [...prev];
      const line = next[idx];
      const newQty = line.quantity + delta;
      if (newQty <= 0) return prev.filter((_, i) => i !== idx);
      if (newQty > line.onHand) {
        toast.warning(`Only ${line.onHand} on hand for ${line.itemCode}`);
        return prev;
      }
      next[idx] = { ...line, quantity: newQty };
      return next;
    });
  }

  function removeLine(idx: number): void {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  function parkCurrent(): void {
    if (lines.length === 0) {
      toast.info('Nothing to park — cart is empty');
      return;
    }
    const id = `${Date.now()}`;
    const label =
      customerName.trim() ||
      (lines[0]?.itemName ? `${lines[0].itemName.slice(0, 30)} +${lines.length - 1}` : 'Tab');
    const newTab: ParkedSale = {
      id,
      label,
      parkedAt: Date.now(),
      customerName,
      paymentMethod,
      channel,
      notes,
      lines,
    };
    setParked((prev) => [newTab, ...prev]);
    clearCart();
    toast.success(`Sale parked — ${label}`);
  }

  function resumeParked(p: ParkedSale): void {
    if (lines.length > 0 && !window.confirm('Replace the current cart?')) return;
    setLines(p.lines);
    setCustomerName(p.customerName ?? '');
    setPaymentMethod(p.paymentMethod);
    setChannel(p.channel);
    setNotes(p.notes ?? '');
    setParked((prev) => prev.filter((x) => x.id !== p.id));
    setShowParked(false);
    toast.info(`Resumed: ${p.label}`);
    searchRef.current?.focus();
  }

  function discardParked(p: ParkedSale): void {
    if (!window.confirm(`Discard parked sale "${p.label}"?`)) return;
    setParked((prev) => prev.filter((x) => x.id !== p.id));
  }

  function clearCart(): void {
    setLines([]);
    setCustomerName('');
    setNotes('');
    setSearch('');
  }

  const checkoutMut = trpc.partsSales.create.useMutation({
    onSuccess: async () => {
      toast.success(`Sale completed — ${formatGHS(subtotal)}`);
      clearCart();
      await Promise.all([
        utils.inventory.list.invalidate(),
        utils.partsSales.list.invalidate(),
        utils.transactions.list.invalidate(),
      ]);
    },
    onError: (e) => toast.error(e.message ?? 'Checkout failed'),
  });

  function checkout(): void {
    if (lines.length === 0) {
      toast.warning('Cart is empty');
      return;
    }
    checkoutMut.mutate({
      items: lines.map((l) => ({
        inventoryItemId: l.inventoryItemId,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
      })),
      paymentMethod,
      channel,
      customerName: customerName.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  }

  return (
    <PageShell
      eyebrow="Counter"
      title="POS Register"
      intro="Type a part code, scan a barcode, or click a tile to ring up a sale. Park the cart to attend to another customer and resume later."
      actions={
        <button
          type="button"
          className="btn-outline text-sm"
          onClick={() => setShowParked((v) => !v)}
        >
          <RotateCcw size={14} /> Parked ({parked.length})
        </button>
      }
    >
      {showParked && (
        <ParkedDrawer
          parked={parked}
          onResume={resumeParked}
          onDiscard={discardParked}
          onClose={() => setShowParked(false)}
        />
      )}

      <div className="grid gap-3 md:grid-cols-[1fr_360px]">
        {/* Left — search + product grid */}
        <section
          className="bg-white rounded-2xl p-3 flex flex-col gap-3 min-w-0"
          style={{ border: '1px solid rgba(26,22,18,0.06)' }}
        >
          <div className="relative">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-700"
            />
            <input
              ref={searchRef}
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search part number, name, or category"
              className="w-full rounded-xl border border-line bg-canvas py-2 pl-9 pr-3 font-sans text-sm
                         focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              autoComplete="off"
            />
          </div>

          {inventoryQ.isLoading ? (
            <div className="flex items-center justify-center py-12 text-ink-700">
              <Loader2 size={16} className="animate-spin mr-2" /> Loading inventory…
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex items-center justify-center py-12 text-ink-700 text-sm font-sans">
              No matches — try a different search term.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 overflow-y-auto" style={{ maxHeight: '60vh' }}>
              {filtered.map((it: any) => {
                const onHand = Number(it.quantity ?? 0);
                const out = onHand <= 0;
                return (
                  <button
                    key={it.id}
                    type="button"
                    disabled={out}
                    onClick={() => addItem(it)}
                    className={`text-left rounded-xl border p-2 transition-colors min-w-0 ${
                      out
                        ? 'border-line bg-canvas/40 opacity-60 cursor-not-allowed'
                        : 'border-line bg-canvas hover:border-brand-500 hover:bg-brand-50'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-2xs font-sans font-semibold uppercase text-ink-700 mb-1">
                      <Package size={10} /> {it.category ?? 'Part'}
                    </div>
                    <div className="font-sans text-sm font-semibold text-ink-900 truncate">
                      {it.itemName ?? it.itemCode}
                    </div>
                    <div className="font-sans text-xs text-ink-700 truncate num">{it.itemCode}</div>
                    <div className="flex items-baseline justify-between mt-1.5">
                      <span className="font-sans text-sm font-semibold text-ink-900 num">
                        {formatGHS(Number(it.unitPrice ?? 0))}
                      </span>
                      <span
                        className={`text-2xs font-sans font-semibold ${
                          out ? 'text-brand-500' : onHand <= Number(it.minStockLevel ?? 0) ? 'text-warning' : 'text-success'
                        }`}
                      >
                        {out ? 'Out' : `${onHand} on hand`}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>

        {/* Right — cart */}
        <aside
          className="bg-white rounded-2xl p-3 flex flex-col gap-3 min-w-0"
          style={{ border: '1px solid rgba(26,22,18,0.06)' }}
        >
          <header className="flex items-center justify-between">
            <h3 className="font-sans text-base font-semibold text-ink-900 flex items-center gap-1.5">
              <ShoppingCart size={16} /> Cart
              {itemCount > 0 && (
                <span className="rounded-full bg-brand-500 text-neutral-50 text-2xs font-bold px-1.5">
                  {itemCount}
                </span>
              )}
            </h3>
            {lines.length > 0 && (
              <button
                type="button"
                onClick={clearCart}
                className="text-2xs font-sans font-semibold text-ink-700 hover:text-brand-500"
              >
                Clear
              </button>
            )}
          </header>

          {lines.length === 0 ? (
            <p className="text-sm font-sans text-ink-700 py-6 text-center">
              Cart is empty. Add a part from the grid or scan a barcode.
            </p>
          ) : (
            <ul className="flex flex-col gap-1 overflow-y-auto" style={{ maxHeight: '40vh' }}>
              {lines.map((l, i) => (
                <li
                  key={l.inventoryItemId}
                  className="rounded-xl bg-canvas px-2 py-1.5 flex items-center gap-2 min-w-0"
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-sans font-semibold text-ink-900 truncate">
                      {l.itemName || l.itemCode}
                    </div>
                    <div className="text-2xs text-ink-700 num">{formatGHS(l.unitPrice)} each</div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => changeQty(i, -1)}
                      className="w-5 h-5 grid place-items-center rounded-md bg-white hover:bg-brand-50"
                      aria-label="Decrease"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="text-sm font-sans font-semibold w-5 text-center num">{l.quantity}</span>
                    <button
                      type="button"
                      onClick={() => changeQty(i, 1)}
                      className="w-5 h-5 grid place-items-center rounded-md bg-white hover:bg-brand-50"
                      aria-label="Increase"
                    >
                      <Plus size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => removeLine(i)}
                      className="w-5 h-5 grid place-items-center rounded-md text-ink-700 hover:bg-brand-50 hover:text-brand-500"
                      aria-label="Remove"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                  <span className="font-sans text-sm font-semibold text-ink-900 num shrink-0">
                    {formatGHS(l.unitPrice * l.quantity)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="rounded-xl bg-ink-900/95 text-neutral-50 p-3 mt-auto">
            <div className="flex items-baseline justify-between mb-3">
              <span className="font-sans text-xs font-semibold uppercase text-neutral-50/70" style={{ letterSpacing: '0.08em' }}>
                Total
              </span>
              <span className="font-sans num" style={{ fontSize: 28, fontWeight: 600, lineHeight: 1 }}>
                {formatGHS(subtotal)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <label className="flex flex-col gap-0.5">
                <span className="font-sans text-neutral-50/70 uppercase" style={{ letterSpacing: '0.08em' }}>Payment</span>
                <select
                  className="rounded-md bg-white/10 px-1.5 py-1 text-neutral-50 text-xs"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                >
                  <option value="cash">Cash</option>
                  <option value="mobile_money">Mobile Money</option>
                  <option value="card">Card</option>
                </select>
              </label>
              <label className="flex flex-col gap-0.5">
                <span className="font-sans text-neutral-50/70 uppercase" style={{ letterSpacing: '0.08em' }}>Channel</span>
                <select
                  className="rounded-md bg-white/10 px-1.5 py-1 text-neutral-50 text-xs"
                  value={channel}
                  onChange={(e) => setChannel(e.target.value as any)}
                >
                  <option value="walk_in">Walk-in</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="phone">Phone</option>
                  <option value="online">Online</option>
                </select>
              </label>
              <input
                type="text"
                placeholder="Customer name (optional)"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="col-span-2 rounded-md bg-white/10 px-1.5 py-1 text-neutral-50 placeholder:text-neutral-50/40 text-xs"
              />
              <input
                type="text"
                placeholder="Notes (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="col-span-2 rounded-md bg-white/10 px-1.5 py-1 text-neutral-50 placeholder:text-neutral-50/40 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              <button
                type="button"
                onClick={parkCurrent}
                disabled={lines.length === 0}
                className="rounded-xl bg-white/10 hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed
                           text-neutral-50 text-xs font-sans font-semibold py-2 inline-flex items-center justify-center gap-1.5"
              >
                <Pause size={13} /> Park Sale
              </button>
              <button
                type="button"
                onClick={checkout}
                disabled={lines.length === 0 || checkoutMut.isLoading}
                className="rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-40 disabled:cursor-not-allowed
                           text-neutral-50 text-xs font-sans font-semibold py-2 inline-flex items-center justify-center gap-1.5"
              >
                {checkoutMut.isLoading ? (
                  <><Loader2 size={13} className="animate-spin" /> Processing…</>
                ) : (
                  <><CheckCircle2 size={13} /> Checkout</>
                )}
              </button>
            </div>
          </div>
        </aside>
      </div>
    </PageShell>
  );
}

function ParkedDrawer({
  parked,
  onResume,
  onDiscard,
  onClose,
}: {
  parked: ParkedSale[];
  onResume: (p: ParkedSale) => void;
  onDiscard: (p: ParkedSale) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="bg-white rounded-2xl p-3"
      style={{ border: '1px solid rgba(26,22,18,0.06)' }}
    >
      <header className="flex items-center justify-between mb-2">
        <h3 className="font-sans text-base font-semibold text-ink-900 flex items-center gap-1.5">
          <Pause size={16} /> Parked Sales
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="w-5 h-5 grid place-items-center rounded-md hover:bg-canvas"
          aria-label="Close"
        >
          <X size={14} />
        </button>
      </header>
      {parked.length === 0 ? (
        <p className="text-sm font-sans text-ink-700 py-4 text-center">
          No parked sales. Park a cart to keep it for later.
        </p>
      ) : (
        <ul className="grid gap-1.5">
          {parked.map((p) => {
            const total = p.lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0);
            const ago = Math.round((Date.now() - p.parkedAt) / 60_000);
            return (
              <li key={p.id} className="rounded-xl bg-canvas px-3 py-2 flex items-center gap-2 min-w-0">
                <div className="min-w-0 flex-1">
                  <div className="font-sans text-sm font-semibold text-ink-900 truncate">{p.label}</div>
                  <div className="text-2xs text-ink-700">
                    {p.lines.length} item{p.lines.length === 1 ? '' : 's'} · {formatGHS(total)} · {ago} min ago
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onResume(p)}
                  className="text-xs font-sans font-semibold text-brand-500 hover:text-brand-600"
                >
                  Resume
                </button>
                <button
                  type="button"
                  onClick={() => onDiscard(p)}
                  className="w-5 h-5 grid place-items-center rounded-md text-ink-700 hover:bg-white hover:text-brand-500"
                  aria-label="Discard"
                  title="Discard"
                >
                  <Trash2 size={12} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
