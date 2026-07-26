import { useState, FormEvent, useRef } from 'react';
// SheetJS (`xlsx`) is loaded lazily inside ImportPartsModal.onFile via a
// dynamic `import('xlsx')`. That keeps the ~110 KB gzip parser out of the
// main bundle for users who never touch the import flow.
import { Package, Plus, Upload, AlertTriangle, TrendingDown, Boxes, Loader2, Pencil, FileSpreadsheet, Search, X } from 'lucide-react';
import { PageShell } from '../components/layout/PageShell';
import { EmptyState, Modal, FormField } from '../components/ui';
import { trpc } from '../lib/trpc';
import { exportRowsToXlsx } from '../lib/excelExport';

interface InventoryStat { label: string; value: string; helper: string; tone: 'neutral' | 'warning' | 'danger' }

const standardCategories = [
  { name: 'Lubricants and Fluids',   detail: 'Engine oil, transmission fluid, coolant, brake fluid.' },
  { name: 'Filters',                  detail: 'Oil, air, cabin and fuel filtration across marques.' },
  { name: 'Brake System',             detail: 'Pads, discs, calipers, lines and sensors.' },
  { name: 'Electrical and Battery',   detail: 'Batteries, alternators, starters, wiring harnesses.' },
  { name: 'Tyres and Wheels',         detail: 'Performance, all-season and run-flat compounds.' },
  { name: 'Body and Trim',            detail: 'Panels, mouldings, fasteners and finishing materials.' },
  { name: 'Engine and Drivetrain',    detail: 'Belts, hoses, gaskets, mounts and ancillaries.' },
  { name: 'Consumables and Tooling',  detail: 'Workshop consumables, fasteners, abrasives and PPE.' },
];

const toneClass: Record<InventoryStat['tone'], string> = {
  neutral: 'text-ink-900',
  warning: 'text-warning',
  danger:  'text-brand-500',
};

function formatGHS(amount: number) {
  return `GHS ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function statusFor(qty: number, minStock: number): { label: string; tone: 'ok' | 'warning' | 'danger' } {
  if (qty <= 0) return { label: 'Out of stock', tone: 'danger' };
  if (qty <= minStock) return { label: 'Low stock', tone: 'warning' };
  return { label: 'In stock', tone: 'ok' };
}

const statusToneClass = {
  ok: 'text-ink-900',
  warning: 'text-warning',
  danger: 'text-brand-500',
};

interface PartRow {
  id: number;
  itemName: string;
  itemCode: string;
  category: string;
  quantity: number;
  minStockLevel: number;
  unitPrice: number;
  supplier: string | null;
  notes: string | null;
}

export function InventoryPage() {
  const [modalOpen, setModalOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [editing, setEditing] = useState<PartRow | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_stock' | 'low' | 'out'>('all');
  const utils = trpc.useUtils();
  const inventoryQuery = trpc.inventory.list.useQuery({}, { keepPreviousData: true });

  const isLoading = inventoryQuery.isLoading;
  const errorMessage = inventoryQuery.error?.message ?? null;
  const allItems: any[] = Array.isArray(inventoryQuery.data) ? inventoryQuery.data : [];

  const items = allItems.filter((it) => {
    const q = search.trim().toLowerCase();
    if (q) {
      const hay = `${it.itemCode ?? ''} ${it.itemName ?? ''} ${it.category ?? ''} ${it.supplier ?? ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (categoryFilter !== 'all' && it.category !== categoryFilter) return false;
    const qty = Number(it.quantity ?? 0);
    const min = Number(it.minStockLevel ?? 0);
    if (statusFilter === 'in_stock' && qty <= min) return false;
    if (statusFilter === 'low' && !(qty > 0 && qty <= min)) return false;
    if (statusFilter === 'out' && qty > 0) return false;
    return true;
  });

  // Stats reflect the FULL ledger, not the filtered view, so tile values
  // don't twitch when the operator searches.
  const skuCount = allItems.length;
  const totalValue = allItems.reduce((sum, it) => {
    const qty = Number(it.quantity ?? 0);
    const price = Number(it.unitPrice ?? 0);
    return sum + qty * price;
  }, 0);
  const lowStockCount = allItems.filter(it => {
    const qty = Number(it.quantity ?? 0);
    const min = Number(it.minStockLevel ?? 0);
    return qty > 0 && qty <= min;
  }).length;
  const outOfStockCount = allItems.filter(it => Number(it.quantity ?? 0) <= 0).length;
  const allCategories = Array.from(new Set(allItems.map(it => it.category).filter(Boolean))).sort();

  const exportInventory = async () => {
    setExporting(true);
    try {
      await exportRowsToXlsx('agl-inventory-ledger', 'Inventory', items, [
        { header: 'Item Code', value: (it: any) => it.itemCode ?? '' },
        { header: 'Item Name', value: (it: any) => it.itemName ?? '' },
        { header: 'Clean Description', value: (it: any) => it.cleanDescription ?? '' },
        { header: 'Category', value: (it: any) => it.category ?? '' },
        { header: 'Quantity On Hand', value: (it: any) => Number(it.quantity ?? 0) },
        { header: 'Minimum Stock Level', value: (it: any) => Number(it.minStockLevel ?? 0) },
        { header: 'Unit Price (GHS)', value: (it: any) => Number(it.unitPrice ?? 0) },
        { header: 'Stock Value (GHS)', value: (it: any) => Number(it.quantity ?? 0) * Number(it.unitPrice ?? 0) },
        { header: 'Supplier', value: (it: any) => it.supplier ?? '' },
        { header: 'Vehicle Make', value: (it: any) => it.vehicleMake ?? '' },
        { header: 'Vehicle Model', value: (it: any) => it.vehicleModel ?? '' },
        { header: 'Year Min', value: (it: any) => it.yearMin ?? '' },
        { header: 'Year Max', value: (it: any) => it.yearMax ?? '' },
        { header: 'Engine Capacity', value: (it: any) => it.engineCapacity ?? '' },
        { header: 'Last Restock Date', value: (it: any) => it.lastRestockDate ? String(it.lastRestockDate).slice(0, 10) : '' },
        { header: 'Status', value: (it: any) => statusFor(Number(it.quantity ?? 0), Number(it.minStockLevel ?? 0)).label },
        { header: 'Notes', value: (it: any) => it.notes ?? '' },
      ]);
    } finally {
      setExporting(false);
    }
  };

  const stats: InventoryStat[] = [
    { label: 'Stock Keeping Units',  value: String(skuCount),                    helper: 'Distinct parts on the ledger',  tone: 'neutral' },
    { label: 'Inventory Value',      value: formatGHS(totalValue),               helper: 'At unit price × quantity',      tone: 'neutral' },
    { label: 'Low Stock Items',      value: String(lowStockCount),               helper: 'At or below reorder point',     tone: 'warning' },
    { label: 'Out Of Stock',         value: String(outOfStockCount),             helper: 'Requiring immediate attention', tone: 'danger'  },
  ];

  // Aggregate per-category counts and value for the categories grid.
  const categoryAggregates = new Map<string, { count: number; value: number }>();
  for (const it of items) {
    const cat = (it.category ?? 'Uncategorised') as string;
    const qty = Number(it.quantity ?? 0);
    const price = Number(it.unitPrice ?? 0);
    const entry = categoryAggregates.get(cat) ?? { count: 0, value: 0 };
    entry.count += 1;
    entry.value += qty * price;
    categoryAggregates.set(cat, entry);
  }

  return (
    <PageShell
      eyebrow="Stockroom"
      title="Inventory"
      intro="Every part on the shelf, with provenance, supplier and current value held to a single ledger. Low-stock and out-of-stock signals reach the people who can act."
      actions={
        <>
          <button
            type="button"
            onClick={() => setImportOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold bg-brand-50 text-brand-600 border border-brand-500/40 hover:bg-brand-500 hover:text-white transition-colors"
          >
            <FileSpreadsheet size={14} /> Import From Excel
          </button>
          <button
            type="button"
            onClick={exportInventory}
            disabled={items.length === 0 || exporting}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold bg-white text-neutral-700 border border-line hover:bg-canvas disabled:opacity-50 transition-colors"
          >
            {exporting ? <Loader2 size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
            Export to Excel
          </button>
          <button className="btn-primary text-sm" onClick={() => setModalOpen(true)}>
            <Plus size={14} /> Add Part
          </button>
        </>
      }
    >
      {errorMessage && (
        <div
          className="rounded-2xl px-4 py-3 font-sans text-sm text-brand-500 bg-white"
          style={{ border: '1px solid rgba(160,48,64,0.32)' }}
        >
          {errorMessage}
        </div>
      )}

      <section className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {stats.map(s => (
          <article
            key={s.label}
            className="bg-white rounded-xl p-3 flex flex-col gap-1 min-w-0"
            style={{ border: '1px solid rgba(26,22,18,0.06)' }}
          >
            <span
              className="font-sans text-2xs font-semibold uppercase text-ink-700"
              style={{ letterSpacing: '0.08em' }}
            >
              {s.label}
            </span>
            <div
              className={`font-sans num leading-none ${toneClass[s.tone]}`}
              style={{ fontSize: 22, fontWeight: 600 }}
            >
              {isLoading ? <Loader2 size={18} className="animate-spin" /> : s.value}
            </div>
            <p className="font-sans text-2xs text-ink-700 leading-tight">{s.helper}</p>
          </article>
        ))}
      </section>

      <section>
        <header className="flex items-end justify-between gap-3 flex-wrap mb-3">
          <h2 className="font-sans text-lg font-semibold text-ink-900">Stock Ledger</h2>
          <span className="font-sans text-xs text-ink-700">
            {items.length === allItems.length
              ? `${allItems.length} parts`
              : `${items.length} of ${allItems.length} parts`}
          </span>
        </header>
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-700 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by code, name, category or supplier…"
              className="w-full rounded-lg bg-white pl-7 pr-7 py-1.5 text-sm font-sans text-ink-900 placeholder:text-ink-700 focus:outline-none focus:ring-2 focus:ring-brand-500/40"
              style={{ border: '1px solid rgba(26,22,18,0.12)' }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-700 hover:text-ink-900"
                aria-label="Clear search"
              >
                <X size={12} />
              </button>
            )}
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="rounded-lg bg-white px-2 py-1.5 text-sm font-sans text-ink-900"
            style={{ border: '1px solid rgba(26,22,18,0.12)' }}
          >
            <option value="all">All categories</option>
            {allCategories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="rounded-lg bg-white px-2 py-1.5 text-sm font-sans text-ink-900"
            style={{ border: '1px solid rgba(26,22,18,0.12)' }}
          >
            <option value="all">All status</option>
            <option value="in_stock">In stock</option>
            <option value="low">Low stock</option>
            <option value="out">Out of stock</option>
          </select>
        </div>
        <div className="bg-white rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(26,22,18,0.06)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="w-full">
              <thead>
                <tr>
                  <th className="t-th">Part Number</th>
                  <th className="t-th">Description</th>
                  <th className="t-th">Category</th>
                  <th className="t-th">Make</th>
                  <th className="t-th">Model</th>
                  <th className="t-th">Year</th>
                  <th className="t-th">Engine</th>
                  <th className="t-th">On Hand</th>
                  <th className="t-th">Reorder</th>
                  <th className="t-th">Unit Cost</th>
                  <th className="t-th">Status</th>
                  <th className="t-th" style={{ width: '4rem' }}></th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={12} className="px-4 py-8 text-center font-sans text-sm text-ink-700">
                      <span className="inline-flex items-center gap-1.5">
                        <Loader2 size={14} className="animate-spin" /> Loading stock ledger…
                      </span>
                    </td>
                  </tr>
                )}
                {!isLoading && !errorMessage && items.length === 0 && (
                  <tr>
                    <td colSpan={12} className="px-4 py-8 text-center font-sans text-sm text-ink-700">
                      No parts on the ledger yet.
                    </td>
                  </tr>
                )}
                {!isLoading && items.map((it: any) => {
                  const qty = Number(it.quantity ?? 0);
                  const min = Number(it.minStockLevel ?? 0);
                  const price = Number(it.unitPrice ?? 0);
                  const status = statusFor(qty, min);
                  const yearLabel = it.yearMin || it.yearMax
                    ? `${it.yearMin ?? '…'}–${it.yearMax ?? '…'}`
                    : '—';
                  // Prefer cleanDescription (item name with "— fits …" stripped)
                  // and fall back to itemName for un-backfilled rows.
                  const desc = it.cleanDescription ?? it.itemName ?? '—';
                  return (
                    <tr key={it.id}>
                      <td className="t-td font-semibold num">{it.itemCode ?? '—'}</td>
                      <td className="t-td">{desc}</td>
                      <td className="t-td">{it.category ?? '—'}</td>
                      <td className="t-td">{it.vehicleMake ?? '—'}</td>
                      <td className="t-td">{it.vehicleModel ?? '—'}</td>
                      <td className="t-td num">{yearLabel}</td>
                      <td className="t-td">{it.engineCapacity ?? '—'}</td>
                      <td className="t-td num">{qty}</td>
                      <td className="t-td num">{min}</td>
                      <td className="t-td num">{formatGHS(price)}</td>
                      <td className={`t-td ${statusToneClass[status.tone]}`}>{status.label}</td>
                      <td className="t-td" style={{ width: '4rem' }}>
                        <button
                          type="button"
                          className="rounded-lg p-1 text-ink-700 hover:bg-canvas hover:text-ink-900 transition-colors"
                          onClick={() => setEditing({
                            id: it.id,
                            itemName: it.itemName ?? '',
                            itemCode: it.itemCode ?? '',
                            category: it.category ?? PART_CATEGORIES[0],
                            quantity: qty,
                            minStockLevel: min,
                            unitPrice: price,
                            supplier: it.supplier ?? null,
                            notes: it.notes ?? null,
                          })}
                          aria-label={`Edit ${it.itemCode ?? it.itemName}`}
                          title="Edit part"
                        >
                          <Pencil size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section>
        <header className="flex items-end justify-between gap-3 flex-wrap mb-3">
          <h2 className="font-sans text-2xl font-semibold text-ink-900">Categories</h2>
          <span className="font-sans text-xs text-ink-700">Eight standard categories. Bespoke categories available on request.</span>
        </header>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
          {standardCategories.map(c => {
            const agg = categoryAggregates.get(c.name) ?? { count: 0, value: 0 };
            return (
              <article
                key={c.name}
                className="bg-white rounded-2xl p-4 flex flex-col gap-2 min-w-0"
                style={{ border: '1px solid rgba(26,22,18,0.06)' }}
              >
                <span className="w-5 h-5 rounded-xl bg-brand-50 text-brand-500 grid place-items-center">
                  <Boxes size={20} />
                </span>
                <h3 className="font-sans text-base font-semibold text-ink-900">{c.name}</h3>
                <p className="font-sans text-sm text-ink-700 leading-relaxed">{c.detail}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className="font-sans text-xs text-ink-700">{agg.count} parts</span>
                  <span className="font-sans num text-sm text-ink-900">{formatGHS(agg.value)}</span>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section>
        <header className="flex items-end justify-between gap-3 flex-wrap mb-3">
          <h2 className="font-sans text-2xl font-semibold text-ink-900">Stock Movements</h2>
          <span className="font-sans text-xs text-ink-700">Receipts, issues, transfers and adjustments — every change recorded.</span>
        </header>
        <div
          className="bg-white rounded-2xl"
          style={{ border: '1px solid rgba(26,22,18,0.06)' }}
        >
          <div className="px-4 py-8 grid place-items-center">
            <div className="flex flex-col items-center text-center gap-2" style={{ maxWidth: '52ch' }}>
              <span className="w-6 h-6 rounded-2xl bg-brand-50 text-brand-500 grid place-items-center">
                <TrendingDown size={24} />
              </span>
              <h3 className="font-serif font-medium text-ink-900" style={{ fontSize: '1.5rem', lineHeight: 1.2 }}>
                No stock movements recorded
              </h3>
              <p className="font-sans text-sm text-ink-700 leading-relaxed">
                Once parts are received from a supplier or issued to a workshop job, the entry appears here with the principal who authorised it.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section
        className="rounded-2xl p-4 flex items-start gap-3"
        style={{
          background: '#0E0A0A',
          color: '#FAF7F2',
          border: '1px solid rgba(160,48,64,0.32)',
        }}
      >
        <span className="w-5 h-5 rounded-xl bg-brand-500 text-neutral-50 grid place-items-center shrink-0">
          <AlertTriangle size={20} />
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="font-sans text-base font-semibold">Reorder Discipline</h3>
          <p className="font-sans text-sm text-neutral-50/80 mt-1 leading-relaxed">
            When any part falls to or below its reorder point, FixBot drafts a purchase order to the assigned supplier and notifies the operations principal on WhatsApp.
            Nothing is ordered without explicit approval; nothing is forgotten without a record.
          </p>
        </div>
      </section>

      {!isLoading && !errorMessage && items.length === 0 && (
        <EmptyState
          icon={Package}
          title="Begin your stock ledger"
          description="Import an existing parts list from Excel, or add your first part by hand. Categories, reorder points and suppliers may be set during onboarding."
          action={
            <div className="flex flex-wrap gap-2 justify-center">
              <button className="btn-outline text-sm" onClick={() => setImportOpen(true)}>
                <Upload size={14} /> Import From Excel
              </button>
              <button className="btn-primary text-sm" onClick={() => setModalOpen(true)}>
                <Plus size={14} /> Add Your First Part
              </button>
            </div>
          }
        />
      )}

      <AddPartModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={() => {
          setModalOpen(false);
          utils.inventory.list.invalidate();
        }}
      />

      <EditPartModal
        part={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          utils.inventory.list.invalidate();
        }}
      />

      <ImportPartsModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => {
          setImportOpen(false);
          utils.inventory.list.invalidate();
        }}
      />
    </PageShell>
  );
}

// ───────────────────────────────────────────────────────────────────────────
//   Add Part modal
// ───────────────────────────────────────────────────────────────────────────

/**
 * Canonical inventory categories. Reflects the actual SKU lines on the
 * AGL ledger after the May-2026 master-sheet import — including the
 * fast-moving electricals (spark plugs, fuel pumps, oxygen sensors)
 * that operators were previously unable to assign at the edit dialog.
 */
const PART_CATEGORIES = [
  'Engine Oil',
  'Lubricants and Fluids',
  'Wiper Fluid',
  'Filters',
  'Spark Plugs',
  'Fuel Pump',
  'Oxygen Sensor',
  'Brake System',
  'Electrical and Battery',
  'Tyres and Wheels',
  'Body and Trim',
  'Engine and Drivetrain',
  'Consumables and Tooling',
  'Services',
];

function AddPartModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [itemName, setItemName] = useState('');
  const [itemCode, setItemCode] = useState('');
  const [category, setCategory] = useState(PART_CATEGORIES[0]);
  const [quantity, setQuantity] = useState('0');
  const [minStockLevel, setMinStockLevel] = useState('1');
  const [unitPrice, setUnitPrice] = useState('0');
  const [supplier, setSupplier] = useState('');
  const [notes, setNotes] = useState('');
  // W8 — structured vehicle fitment fields surface as their own columns.
  const [vehicleMake, setVehicleMake] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [yearMin, setYearMin] = useState('');
  const [yearMax, setYearMax] = useState('');
  const [engineCapacity, setEngineCapacity] = useState('');
  const [error, setError] = useState<string | null>(null);

  const createMutation = trpc.inventory.create.useMutation({
    onSuccess: (data: any) => {
      if (data?.success === false) {
        setError(data.error ?? 'Failed to save part.');
        return;
      }
      setItemName(''); setItemCode('');
      setCategory(PART_CATEGORIES[0]);
      setQuantity('0'); setMinStockLevel('1'); setUnitPrice('0');
      setSupplier(''); setNotes('');
      setVehicleMake(''); setVehicleModel(''); setYearMin(''); setYearMax(''); setEngineCapacity('');
      setError(null);
      onCreated();
    },
    onError: (e) => setError(e.message),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    // Fractional units allowed (e.g. 1.5 L of engine oil). Server-side
    // schema stores the column as DECIMAL(10,2); we forward a Number
    // and let the router coerce to string for drizzle.
    const qty = parseFloat(quantity);
    const min = parseFloat(minStockLevel);
    const price = parseFloat(unitPrice);

    if (Number.isNaN(qty) || qty < 0) return setError('Quantity must be a non-negative number.');
    if (Number.isNaN(min) || min < 0) return setError('Reorder point must be a non-negative number.');
    if (Number.isNaN(price) || price < 0) return setError('Unit price must be a non-negative number.');

    const yMin = yearMin.trim() ? parseInt(yearMin, 10) : undefined;
    const yMax = yearMax.trim() ? parseInt(yearMax, 10) : undefined;

    createMutation.mutate({
      itemName: itemName.trim(),
      itemCode: itemCode.trim(),
      category,
      quantity: qty,
      minStockLevel: min,
      unitPrice: price,
      supplier: supplier.trim() || undefined,
      notes: notes.trim() || undefined,
      vehicleMake: vehicleMake.trim() || undefined,
      vehicleModel: vehicleModel.trim() || undefined,
      yearMin: yMin,
      yearMax: yMax,
      engineCapacity: engineCapacity.trim() || undefined,
      cleanDescription: itemName.trim().replace(/\s+[—-]\s*fits\s+.+$/i, '').slice(0, 250) || undefined,
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow="New SKU"
      title="Add Part"
      footer={
        <>
          <button type="button" className="btn-outline text-sm" onClick={onClose} disabled={createMutation.isLoading}>
            Cancel
          </button>
          <button
            type="submit"
            form="add-part-form"
            className="btn-primary text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={createMutation.isLoading}
          >
            {createMutation.isLoading ? 'Saving…' : 'Save Part'}
          </button>
        </>
      }
    >
      <form id="add-part-form" onSubmit={onSubmit} className="grid grid-cols-2 gap-3">
        <FormField label="Description" required span={2}>
          <input
            className="field-input"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            placeholder="Mobil 1 ESP 5W-30 — 5L"
            required
          />
        </FormField>

        <FormField label="Part Number" required hint="Internal code, must be unique.">
          <input
            className="field-input"
            value={itemCode}
            onChange={(e) => setItemCode(e.target.value.toUpperCase())}
            placeholder="LUB-MOBIL1-5L"
            required
          />
        </FormField>

        <FormField label="Category" required>
          <select className="field-input" value={category} onChange={(e) => setCategory(e.target.value)} required>
            {PART_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </FormField>

        <FormField label="Quantity On Hand" required hint="Fractional units allowed (e.g. 1.5).">
          <input
            className="field-input num"
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />
        </FormField>

        <FormField label="Reorder Point" required hint="Trigger restock alerts at or below this.">
          <input
            className="field-input num"
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            value={minStockLevel}
            onChange={(e) => setMinStockLevel(e.target.value)}
            required
          />
        </FormField>

        <FormField label="Unit Price (GHS)" required>
          <input
            className="field-input num"
            type="number"
            min={0}
            step="0.01"
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
            required
          />
        </FormField>

        <FormField label="Supplier">
          <input
            className="field-input"
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
            placeholder="Continental Lubricants Ltd."
          />
        </FormField>

        <FormField label="Notes" hint="Optional. Storage location, OEM equivalent, etc." span={2}>
          <textarea
            className="field-input"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Stored in cabinet B3. OEM equivalent for BMW LL-04."
          />
        </FormField>

        <div className="col-span-2 pt-2 mt-1 border-t border-line">
          <div className="font-sans text-xs font-bold uppercase tracking-wide text-neutral-500 mb-2">Vehicle fitment</div>
          <div className="grid grid-cols-5 gap-2">
            <FormField label="Make"><input className="field-input" value={vehicleMake} onChange={(e) => setVehicleMake(e.target.value)} placeholder="Toyota" /></FormField>
            <FormField label="Model"><input className="field-input" value={vehicleModel} onChange={(e) => setVehicleModel(e.target.value)} placeholder="Corolla" /></FormField>
            <FormField label="Year min"><input className="field-input num" type="number" value={yearMin} onChange={(e) => setYearMin(e.target.value)} placeholder="2015" /></FormField>
            <FormField label="Year max"><input className="field-input num" type="number" value={yearMax} onChange={(e) => setYearMax(e.target.value)} placeholder="2024" /></FormField>
            <FormField label="Engine"><input className="field-input" value={engineCapacity} onChange={(e) => setEngineCapacity(e.target.value)} placeholder="2.0T" /></FormField>
          </div>
        </div>

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
//   Edit Part modal
// ───────────────────────────────────────────────────────────────────────────

function EditPartModal({
  part,
  onClose,
  onSaved,
}: {
  part: PartRow | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [itemName, setItemName] = useState('');
  const [itemCode, setItemCode] = useState('');
  const [category, setCategory] = useState(PART_CATEGORIES[0]);
  const [quantity, setQuantity] = useState('0');
  const [minStockLevel, setMinStockLevel] = useState('1');
  const [unitPrice, setUnitPrice] = useState('0');
  const [supplier, setSupplier] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const open = part !== null;

  const [syncedId, setSyncedId] = useState<number | null>(null);
  if (part && part.id !== syncedId) {
    setSyncedId(part.id);
    setItemName(part.itemName);
    setItemCode(part.itemCode);
    setCategory(part.category);
    setQuantity(String(part.quantity));
    setMinStockLevel(String(part.minStockLevel));
    setUnitPrice(String(part.unitPrice));
    setSupplier(part.supplier ?? '');
    setNotes(part.notes ?? '');
    setError(null);
  } else if (!part && syncedId !== null) {
    setSyncedId(null);
  }

  const updateMutation = trpc.inventory.update.useMutation({
    onSuccess: (data) => {
      if (data?.success === false) {
        setError(data.error ?? 'Failed to update part.');
        return;
      }
      onSaved();
    },
    onError: (e) => setError(e.message),
  });

  const deleteMutation = trpc.inventory.delete.useMutation({
    onSuccess: () => onSaved(),
    onError: (e) => setError(e.message),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!part) return;
    setError(null);

    // Fractional units allowed (e.g. 1.5 L). Same coercion path as
    // the add-part flow above.
    const qty = parseFloat(quantity);
    const min = parseFloat(minStockLevel);
    const price = parseFloat(unitPrice);

    if (Number.isNaN(qty) || qty < 0) return setError('Quantity must be a non-negative number.');
    if (Number.isNaN(min) || min < 0) return setError('Reorder point must be a non-negative number.');
    if (Number.isNaN(price) || price < 0) return setError('Unit price must be a non-negative number.');

    updateMutation.mutate({
      id: part.id,
      itemName: itemName.trim(),
      itemCode: itemCode.trim(),
      category,
      quantity: qty,
      minStockLevel: min,
      unitPrice: price,
      supplier: supplier.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  };

  const onDelete = () => {
    if (!part) return;
    if (!window.confirm(`Permanently remove ${part.itemCode} (${part.itemName}) from the stock ledger? Movement history will be detached.`)) return;
    setError(null);
    deleteMutation.mutate({ id: part.id });
  };

  const isPending = updateMutation.isLoading || deleteMutation.isLoading;

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow="Edit SKU"
      title={part ? `${part.itemCode} — ${part.itemName}` : 'Edit Part'}
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
            form="edit-part-form"
            className="btn-primary text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={isPending}
          >
            {updateMutation.isLoading ? 'Saving…' : 'Save Changes'}
          </button>
        </>
      }
    >
      <form id="edit-part-form" onSubmit={onSubmit} className="grid grid-cols-2 gap-3">
        <FormField label="Description" required span={2}>
          <input
            className="field-input"
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            required
          />
        </FormField>

        <FormField label="Part Number" required>
          <input
            className="field-input"
            value={itemCode}
            onChange={(e) => setItemCode(e.target.value.toUpperCase())}
            required
          />
        </FormField>

        <FormField label="Category" required>
          <select className="field-input" value={category} onChange={(e) => setCategory(e.target.value)} required>
            {PART_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </FormField>

        <FormField label="Quantity On Hand" required hint="Fractional units allowed (e.g. 1.5).">
          <input
            className="field-input num"
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            required
          />
        </FormField>

        <FormField label="Reorder Point" required>
          <input
            className="field-input num"
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            value={minStockLevel}
            onChange={(e) => setMinStockLevel(e.target.value)}
            required
          />
        </FormField>

        <FormField label="Unit Price (GHS)" required>
          <input
            className="field-input num"
            type="number"
            min={0}
            step="0.01"
            value={unitPrice}
            onChange={(e) => setUnitPrice(e.target.value)}
            required
          />
        </FormField>

        <FormField label="Supplier">
          <input
            className="field-input"
            value={supplier}
            onChange={(e) => setSupplier(e.target.value)}
          />
        </FormField>

        <FormField label="Notes" span={2}>
          <textarea
            className="field-input"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </FormField>

        {part && (
          <div className="col-span-2 mt-2">
            <FitmentSection inventoryItemId={part.id} />
          </div>
        )}

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
//   P12.1 — Fitment compatibility editor
// ───────────────────────────────────────────────────────────────────────────

function FitmentSection({ inventoryItemId }: { inventoryItemId: number }) {
  const utils = trpc.useUtils();
  const fitmentQuery = trpc.fitment.listForItem.useQuery({ inventoryItemId });
  const rows = fitmentQuery.data?.success ? fitmentQuery.data.fitment ?? [] : [];

  const [make, setMake] = useState('');
  const [model, setModel] = useState('');
  const [yearMin, setYearMin] = useState('');
  const [yearMax, setYearMax] = useState('');
  const [engine, setEngine] = useState('');
  const [error, setError] = useState<string | null>(null);

  const addMutation = trpc.fitment.add.useMutation({
    onSuccess: () => {
      setMake(''); setModel(''); setYearMin(''); setYearMax(''); setEngine(''); setError(null);
      utils.fitment.listForItem.invalidate({ inventoryItemId });
    },
    onError: (e) => setError(e.message),
  });
  const removeMutation = trpc.fitment.remove.useMutation({
    onSuccess: () => utils.fitment.listForItem.invalidate({ inventoryItemId }),
  });

  const onAdd = () => {
    setError(null);
    if (!make.trim()) return setError('Make is required.');
    const ymin = yearMin.trim() ? parseInt(yearMin, 10) : undefined;
    const ymax = yearMax.trim() ? parseInt(yearMax, 10) : undefined;
    if (ymin !== undefined && Number.isNaN(ymin)) return setError('Year min must be a number.');
    if (ymax !== undefined && Number.isNaN(ymax)) return setError('Year max must be a number.');
    if (ymin !== undefined && ymax !== undefined && ymax < ymin) return setError('Year max must be ≥ year min.');
    addMutation.mutate({
      inventoryItemId,
      make: make.trim(),
      model: model.trim() || undefined,
      yearMin: ymin,
      yearMax: ymax,
      engineCapacity: engine.trim() || undefined,
    });
  };

  return (
    <section className="pt-4" style={{ borderTop: '1px solid rgba(26,22,18,0.10)' }}>
      <div className="flex items-baseline justify-between mb-2">
        <h3 className="font-sans text-sm font-semibold text-ink-900 uppercase tracking-luxe">Fitment</h3>
        <span className="font-sans text-xs text-ink-700">
          Vehicles this part fits. FixBot uses these for precise lookup.
        </span>
      </div>

      {rows.length > 0 && (
        <div className="bg-canvas rounded-xl mb-2 overflow-hidden" style={{ border: '1px solid rgba(26,22,18,0.06)' }}>
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="t-th">Make</th>
                <th className="t-th">Model</th>
                <th className="t-th">Years</th>
                <th className="t-th">Engine</th>
                <th className="t-th" style={{ width: '4rem' }}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((f: any) => (
                <tr key={f.id}>
                  <td className="t-td font-semibold">{f.make}</td>
                  <td className="t-td">{f.model ?? '— any —'}</td>
                  <td className="t-td num">
                    {f.yearMin || f.yearMax
                      ? `${f.yearMin ?? '…'}–${f.yearMax ?? '…'}`
                      : '— any —'}
                  </td>
                  <td className="t-td">{f.engineCapacity ?? '—'}</td>
                  <td className="t-td">
                    <button
                      type="button"
                      className="text-brand-500 hover:text-brand-600 text-xs"
                      onClick={() => removeMutation.mutate({ id: f.id })}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid grid-cols-5 gap-2">
        <input className="field-input" placeholder="Make (Range Rover)" value={make} onChange={(e) => setMake(e.target.value)} />
        <input className="field-input" placeholder="Model (any if blank)" value={model} onChange={(e) => setModel(e.target.value)} />
        <input className="field-input num" type="number" placeholder="Year min" value={yearMin} onChange={(e) => setYearMin(e.target.value)} />
        <input className="field-input num" type="number" placeholder="Year max" value={yearMax} onChange={(e) => setYearMax(e.target.value)} />
        <input className="field-input" placeholder="Engine (optional)" value={engine} onChange={(e) => setEngine(e.target.value)} />
      </div>
      <div className="flex items-center justify-end mt-2">
        <button type="button" className="btn-outline text-xs" onClick={onAdd} disabled={addMutation.isLoading}>
          + Add fitment
        </button>
      </div>
      {error && <div className="font-sans text-xs text-brand-500 mt-1">{error}</div>}
    </section>
  );
}

// ───────────────────────────────────────────────────────────────────────────
//   Import Parts modal (Excel / CSV → batched inventory.create)
// ───────────────────────────────────────────────────────────────────────────

// Header aliasing is forgiving — many shops keep their stock list under
// idiosyncratic column names. Map any of these to the canonical field.
const HEADER_ALIASES: Record<string, string[]> = {
  itemName:       ['itemname', 'item name', 'name', 'description', 'part description', 'product'],
  itemCode:       ['itemcode', 'item code', 'partnumber', 'part number', 'sku', 'code', 'oem'],
  category:       ['category', 'group', 'class', 'type'],
  quantity:       ['quantity', 'qty', 'on hand', 'onhand', 'stock', 'units'],
  minStockLevel:  ['minstocklevel', 'min stock level', 'reorder', 'reorder point', 'minstock', 'min stock'],
  unitPrice:      ['unitprice', 'unit price', 'price', 'cost', 'unit cost', 'rate'],
  supplier:       ['supplier', 'vendor', 'source'],
  notes:          ['notes', 'remarks', 'comment', 'comments'],
};

interface ParsedPart {
  rowIndex: number; // 1-based for human-friendly errors
  itemName: string;
  itemCode: string;
  category: string;
  quantity: number;
  minStockLevel: number;
  unitPrice: number;
  supplier?: string;
  notes?: string;
  errors: string[];
}

function normaliseHeader(h: string): string {
  return h.toLowerCase().trim();
}

function aliasFor(header: string): string | null {
  const norm = normaliseHeader(header);
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.includes(norm)) return field;
  }
  return null;
}

function parseRow(rowIndex: number, raw: Record<string, unknown>, headerMap: Record<string, string>): ParsedPart {
  const errors: string[] = [];

  const get = (field: string): unknown => {
    const sourceKey = Object.keys(headerMap).find(k => headerMap[k] === field);
    return sourceKey ? raw[sourceKey] : undefined;
  };

  const itemName = String(get('itemName') ?? '').trim();
  const itemCode = String(get('itemCode') ?? '').trim().toUpperCase();
  const category = String(get('category') ?? '').trim() || PART_CATEGORIES[0];
  const qtyRaw = get('quantity');
  const minRaw = get('minStockLevel');
  const priceRaw = get('unitPrice');
  const supplier = String(get('supplier') ?? '').trim() || undefined;
  const notes = String(get('notes') ?? '').trim() || undefined;

  if (!itemName) errors.push('Description is required.');
  if (!itemCode) errors.push('Part number is required.');

  const quantity = Number(qtyRaw ?? 0);
  if (!Number.isFinite(quantity) || quantity < 0) {
    errors.push(`Quantity is not a non-negative number ("${qtyRaw}").`);
  }

  const minStockLevel = Number(minRaw ?? 0);
  if (!Number.isFinite(minStockLevel) || minStockLevel < 0) {
    errors.push(`Reorder point is not a non-negative number ("${minRaw}").`);
  }

  const unitPrice = Number(priceRaw ?? 0);
  if (!Number.isFinite(unitPrice) || unitPrice < 0) {
    errors.push(`Unit price is not a non-negative number ("${priceRaw}").`);
  }

  return {
    rowIndex,
    itemName,
    itemCode,
    category,
    quantity: Math.floor(quantity),
    minStockLevel: Math.floor(minStockLevel),
    unitPrice,
    supplier,
    notes,
    errors,
  };
}

function ImportPartsModal({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [rows, setRows] = useState<ParsedPart[]>([]);
  const [headerMap, setHeaderMap] = useState<Record<string, string>>({});
  const [unmappedHeaders, setUnmappedHeaders] = useState<string[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, succeeded: 0, failed: 0 });
  const [serverErrors, setServerErrors] = useState<Array<{ rowIndex: number; message: string }>>([]);

  // We call inventory.create per row using the raw tRPC client.
  const utils = trpc.useUtils();

  const reset = () => {
    setFileName(null);
    setRows([]);
    setHeaderMap({});
    setUnmappedHeaders([]);
    setParseError(null);
    setImporting(false);
    setProgress({ done: 0, total: 0, succeeded: 0, failed: 0 });
    setServerErrors([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const onFile = async (file: File) => {
    setParseError(null);
    setServerErrors([]);
    setFileName(file.name);
    try {
      // Dynamic import keeps SheetJS off the initial page load.
      const XLSX = await import('xlsx');
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const sheetName = wb.SheetNames[0];
      if (!sheetName) {
        setParseError('No sheets found in this file.');
        return;
      }
      const ws = wb.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
      if (json.length === 0) {
        setParseError('This file has no data rows.');
        return;
      }

      // Build a map: original header → canonical field name (or unmapped).
      const headers = Object.keys(json[0]);
      const map: Record<string, string> = {};
      const unmapped: string[] = [];
      for (const h of headers) {
        const f = aliasFor(h);
        if (f) map[h] = f;
        else unmapped.push(h);
      }
      setHeaderMap(map);
      setUnmappedHeaders(unmapped);

      const parsed = json.map((r, i) => parseRow(i + 2, r, map)); // +2 = sheet row (header at 1)
      setRows(parsed);
    } catch (e) {
      setParseError((e as Error).message ?? 'Failed to parse file.');
    }
  };

  const totalRows = rows.length;
  const validRows = rows.filter(r => r.errors.length === 0);
  const invalidRows = rows.filter(r => r.errors.length > 0);

  const onImport = async () => {
    if (validRows.length === 0) return;
    setImporting(true);
    setServerErrors([]);
    setProgress({ done: 0, total: validRows.length, succeeded: 0, failed: 0 });

    const failures: Array<{ rowIndex: number; message: string }> = [];
    let succeeded = 0;
    let failed = 0;

    for (const row of validRows) {
      try {
        const result: any = await utils.client.inventory.create.mutate({
          itemName: row.itemName,
          itemCode: row.itemCode,
          category: row.category,
          quantity: row.quantity,
          minStockLevel: row.minStockLevel,
          unitPrice: row.unitPrice,
          supplier: row.supplier,
          notes: row.notes,
        });
        if (result?.success === false) {
          failures.push({ rowIndex: row.rowIndex, message: result.error ?? 'Server rejected the row.' });
          failed += 1;
        } else {
          succeeded += 1;
        }
      } catch (e) {
        failures.push({ rowIndex: row.rowIndex, message: (e as Error).message ?? 'Network or server error.' });
        failed += 1;
      }
      // Progress is a snapshot at the end of each iteration so the UI
      // surfaces "X / Y" cleanly even if the user closes the modal mid-run.
      setProgress({ done: succeeded + failed, total: validRows.length, succeeded, failed });
    }

    setServerErrors(failures);
    setImporting(false);

    if (failed === 0) {
      // Pure success — close after a short delay so the user sees the count.
      setTimeout(() => {
        reset();
        onImported();
      }, 600);
    }
  };

  const closeAndReset = () => {
    if (importing) return;
    reset();
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={closeAndReset}
      eyebrow="Bulk Import"
      title="Import Parts From Excel"
      width={720}
      footer={
        <>
          <button type="button" className="btn-outline text-sm" onClick={closeAndReset} disabled={importing}>
            Cancel
          </button>
          {validRows.length > 0 && (
            <button
              type="button"
              className="btn-primary text-sm disabled:opacity-60 disabled:cursor-not-allowed"
              onClick={onImport}
              disabled={importing}
            >
              {importing
                ? `Importing… ${progress.done}/${progress.total}`
                : `Import ${validRows.length} ${validRows.length === 1 ? 'part' : 'parts'}`}
            </button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {/* File picker */}
        <div
          className="flex items-center gap-3 px-4 py-4 rounded-xl bg-white"
          style={{ border: '2px dashed rgba(204,14,26,0.40)' }}
        >
          <span className="w-10 h-10 rounded-xl bg-brand-50 grid place-items-center text-brand-500 shrink-0">
            <FileSpreadsheet size={20} />
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-sans text-sm font-semibold text-ink-900">
              {fileName ?? 'Choose an .xlsx, .xls, or .csv file'}
            </p>
            <p className="font-sans text-xs text-ink-700 leading-relaxed">
              Headers are matched flexibly — &ldquo;Description&rdquo; or &ldquo;Item Name&rdquo;, &ldquo;SKU&rdquo; or &ldquo;Part Number&rdquo;, etc. Unmapped headers are reported below.
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
          />
          <button
            type="button"
            className="btn-outline text-sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
          >
            {fileName ? 'Replace File' : 'Choose File'}
          </button>
        </div>

        {parseError && (
          <div
            className="rounded-xl px-3 py-2 font-sans text-sm text-brand-500"
            style={{ background: '#F5EBED', border: '1px solid rgba(122,31,43,0.18)' }}
            role="alert"
          >
            {parseError}
          </div>
        )}

        {totalRows > 0 && (
          <>
            {/* Summary tiles */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-white rounded-xl p-2.5" style={{ border: '1px solid rgba(26,22,18,0.06)' }}>
                <div className="font-sans text-2xs uppercase tracking-luxe text-ink-700">Total rows</div>
                <div className="font-sans num text-xl font-semibold text-ink-900">{totalRows}</div>
              </div>
              <div className="bg-white rounded-xl p-2.5" style={{ border: '1px solid rgba(26,22,18,0.06)' }}>
                <div className="font-sans text-2xs uppercase tracking-luxe text-ink-700">Importable</div>
                <div className="font-sans num text-xl font-semibold text-ink-900">{validRows.length}</div>
              </div>
              <div className="bg-white rounded-xl p-2.5" style={{ border: '1px solid rgba(26,22,18,0.06)' }}>
                <div className="font-sans text-2xs uppercase tracking-luxe text-ink-700">With errors</div>
                <div className="font-sans num text-xl font-semibold text-brand-500">{invalidRows.length}</div>
              </div>
            </div>

            {unmappedHeaders.length > 0 && (
              <div
                className="rounded-xl px-3 py-2 font-sans text-sm text-warning"
                style={{ background: '#FBF6E8', border: '1px solid rgba(218,165,32,0.30)' }}
              >
                Unmapped columns (skipped): <span className="num">{unmappedHeaders.join(', ')}</span>
              </div>
            )}

            {/* Preview table — first 8 rows so the modal stays compact */}
            <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid rgba(26,22,18,0.06)' }}>
              <div style={{ overflowX: 'auto', maxHeight: 280 }}>
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="t-th">Row</th>
                      <th className="t-th">Description</th>
                      <th className="t-th">Part #</th>
                      <th className="t-th">Qty</th>
                      <th className="t-th">Reorder</th>
                      <th className="t-th">Unit GHS</th>
                      <th className="t-th">Issues</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 8).map((r) => (
                      <tr key={r.rowIndex}>
                        <td className="t-td num">{r.rowIndex}</td>
                        <td className="t-td">{r.itemName || <span className="text-brand-500">(blank)</span>}</td>
                        <td className="t-td num">{r.itemCode || <span className="text-brand-500">(blank)</span>}</td>
                        <td className="t-td num">{r.quantity}</td>
                        <td className="t-td num">{r.minStockLevel}</td>
                        <td className="t-td num">{r.unitPrice.toFixed(2)}</td>
                        <td className={`t-td ${r.errors.length ? 'text-brand-500' : 'text-ink-700'}`}>
                          {r.errors.length === 0 ? '—' : r.errors.join(' · ')}
                        </td>
                      </tr>
                    ))}
                    {rows.length > 8 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-2 text-center font-sans text-xs text-ink-700">
                          and {rows.length - 8} more row{rows.length - 8 === 1 ? '' : 's'}…
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Per-row server failures (only after attempted import) */}
        {serverErrors.length > 0 && (
          <div
            className="rounded-xl px-3 py-2 font-sans text-sm text-brand-500"
            style={{ background: '#F5EBED', border: '1px solid rgba(122,31,43,0.18)' }}
            role="alert"
          >
            <div className="font-semibold mb-1">{serverErrors.length} row{serverErrors.length === 1 ? '' : 's'} rejected by the server:</div>
            <ul className="list-disc pl-4 leading-relaxed">
              {serverErrors.slice(0, 6).map((e) => (
                <li key={e.rowIndex}>Row {e.rowIndex}: {e.message}</li>
              ))}
              {serverErrors.length > 6 && <li>and {serverErrors.length - 6} more…</li>}
            </ul>
          </div>
        )}

        {!importing && progress.total > 0 && progress.done === progress.total && progress.failed === 0 && (
          <div
            className="rounded-xl px-3 py-2 font-sans text-sm text-ink-900"
            style={{ background: '#F0F4EE', border: '1px solid rgba(48,109,72,0.30)' }}
          >
            <span className="inline-flex items-center gap-1.5">
              ✅ Imported {progress.succeeded} part{progress.succeeded === 1 ? '' : 's'}.
            </span>
          </div>
        )}
      </div>
    </Modal>
  );
}
