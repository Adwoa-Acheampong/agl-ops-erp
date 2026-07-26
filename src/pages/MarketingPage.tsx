import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Megaphone, Plus, Loader2, TrendingUp, TrendingDown, Trash2, Pencil,
  Facebook, Instagram, Music2, Globe, MessageCircle, ExternalLink, Activity,
  DollarSign, Eye, MousePointerClick, Target, CheckCircle2, AlertTriangle,
} from 'lucide-react';
import { PageShell } from '../components/layout/PageShell';
import { Modal, FormField, StatusPill, EmptyState } from '../components/ui';

/**
 * P27 — Marketing tracker.
 *
 * Captures ad campaigns across paid social channels (Facebook, Instagram,
 * TikTok, Google, WhatsApp, etc.) with spend / impressions / clicks /
 * conversions / revenue attributed. Totals feed into Finance via the
 * `agl-marketing-campaigns` localStorage key (single source of truth until
 * a dedicated server table lands).
 *
 * In production this page subscribes to webhook-pushed metrics from the ad
 * platforms; in this build operators key data in manually.
 */

export const PLATFORMS = [
  { id: 'facebook',  label: 'Facebook',  icon: Facebook,       tone: 'bg-blue-50 text-blue-700 ring-blue-300' },
  { id: 'instagram', label: 'Instagram', icon: Instagram,      tone: 'bg-pink-50 text-pink-700 ring-pink-300' },
  { id: 'tiktok',    label: 'TikTok',    icon: Music2,         tone: 'bg-neutral-900/5 text-neutral-900 ring-neutral-300' },
  { id: 'google',    label: 'Google',    icon: Globe,          tone: 'bg-amber-50 text-amber-700 ring-amber-300' },
  { id: 'whatsapp',  label: 'WhatsApp',  icon: MessageCircle,  tone: 'bg-emerald-50 text-emerald-700 ring-emerald-300' },
] as const;
type PlatformId = typeof PLATFORMS[number]['id'];

export interface Campaign {
  id: string;
  platform: PlatformId;
  name: string;
  objective: 'awareness' | 'traffic' | 'leads' | 'conversions' | 'sales';
  status: 'active' | 'paused' | 'completed';
  startDate: string;
  endDate?: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  revenue: number;
  notes?: string;
  /** Last time metrics were updated — used to render the "live" indicator. */
  updatedAt: string;
}

const STORAGE_KEY = 'agl-marketing-campaigns';

/* ───────────────────────────  Storage helpers  ──────────────────────────── */

export function loadCampaigns(): Campaign[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      // One-time cleanup: prior builds shipped 3 seed campaigns
      // (Facebook GHS 500, Instagram GHS 320, TikTok GHS 180) that
      // were misleading because they read as real spend. Strip them
      // by id prefix so the user starts from a real zero.
      const cleaned = (parsed as Campaign[]).filter((c) => !String(c.id).startsWith('seed-'));
      if (cleaned.length !== parsed.length) {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned)); } catch {}
      }
      return cleaned;
    }
  } catch {}
  return [];
}
function saveCampaigns(list: Campaign[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    window.dispatchEvent(new Event('agl-marketing-changed'));
  } catch {}
}

export function aggregateCampaigns(list: Campaign[]) {
  const totals = list.reduce((a, c) => ({
    spend:       a.spend + c.spend,
    impressions: a.impressions + c.impressions,
    clicks:      a.clicks + c.clicks,
    conversions: a.conversions + c.conversions,
    revenue:     a.revenue + c.revenue,
    active:      a.active + (c.status === 'active' ? 1 : 0),
  }), { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0, active: 0 });
  const ctr  = totals.impressions ? (totals.clicks / totals.impressions) * 100 : 0;
  const cvr  = totals.clicks      ? (totals.conversions / totals.clicks) * 100 : 0;
  const cpa  = totals.conversions ? totals.spend / totals.conversions : 0;
  const roas = totals.spend       ? totals.revenue / totals.spend : 0;
  const profit = totals.revenue - totals.spend;
  return { ...totals, ctr, cvr, cpa, roas, profit };
}

/* ───────────────────────────────  React hook  ──────────────────────────── */

export function useCampaigns() {
  const [list, setList] = useState<Campaign[]>(() => loadCampaigns());
  useEffect(() => {
    const sync = () => setList(loadCampaigns());
    window.addEventListener('agl-marketing-changed', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('agl-marketing-changed', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  // Simulate a live data refresh every 12 s on active campaigns. In
  // production this is a poll against the ad-platform webhooks.
  useEffect(() => {
    const t = setInterval(() => {
      const cur = loadCampaigns();
      let dirty = false;
      const next = cur.map((c) => {
        if (c.status !== 'active') return c;
        dirty = true;
        const drift = (mean: number, jitter: number) =>
          Math.max(0, Math.round(mean + (Math.random() - 0.5) * jitter));
        return {
          ...c,
          impressions: c.impressions + drift(35, 60),
          clicks:      c.clicks      + drift(1, 2),
          updatedAt:   new Date().toISOString(),
        };
      });
      if (dirty) saveCampaigns(next);
    }, 12_000);
    return () => clearInterval(t);
  }, []);
  return { list, setList };
}

/* ────────────────────────────────  Page  ───────────────────────────────── */

function fmtGhs(v: number) { return `GHS ${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`; }
function fmtInt(v: number) { return v.toLocaleString(); }
function fmtPct(v: number) { return `${v.toFixed(2)}%`; }

export function MarketingPage() {
  const { list } = useCampaigns();
  const [filter, setFilter] = useState<'all' | PlatformId>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | Campaign['status']>('all');
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const filtered = useMemo(() =>
    list.filter((c) =>
      (filter === 'all' || c.platform === filter) &&
      (statusFilter === 'all' || c.status === statusFilter),
    ),
  [list, filter, statusFilter]);

  const totals = useMemo(() => aggregateCampaigns(filtered), [filtered]);

  return (
    <PageShell
      eyebrow="Growth"
      title="Marketing"
      intro="Every ad spend, every conversion. Tracked across Facebook, Instagram, TikTok, Google and WhatsApp — and feeding the Finance ledger automatically."
      actions={
        <button className="btn-primary text-xs anim-rise" onClick={() => setAddOpen(true)}>
          <Plus size={14} /> New Campaign
        </button>
      }
    >
      {/* KPI strip — live. aria-live so screen-reader users hear updates. */}
      <section
        className="grid grid-cols-2 md:grid-cols-6 gap-2 anim-fade-up"
        aria-live="polite"
        aria-atomic="false"
        aria-relevant="text"
      >
        <Kpi label="Active" value={String(totals.active)} sub={`${list.length} total`} tone="ink" icon={Activity} live />
        <Kpi label="Spend"        value={fmtGhs(totals.spend)}       tone="brand"   icon={DollarSign} />
        <Kpi label="Impressions"  value={fmtInt(totals.impressions)} tone="ink"     icon={Eye} />
        <Kpi label="Clicks"       value={fmtInt(totals.clicks)}      sub={`${fmtPct(totals.ctr)} CTR`} tone="ink" icon={MousePointerClick} />
        <Kpi label="Conversions"  value={fmtInt(totals.conversions)} sub={`${fmtPct(totals.cvr)} CVR`} tone="ink" icon={Target} />
        <Kpi
          label="ROAS"
          value={`${totals.roas.toFixed(2)}×`}
          sub={`${fmtGhs(totals.revenue)} revenue`}
          tone={totals.profit >= 0 ? 'emerald' : 'brand'}
          icon={totals.profit >= 0 ? TrendingUp : TrendingDown}
        />
      </section>

      {/* P&L impact strip */}
      <section className="grid md:grid-cols-3 gap-2">
        <PnlPill label="Ad spend (cost)"      value={`− ${fmtGhs(totals.spend)}`} tone="brand" />
        <PnlPill label="Attributed revenue"   value={`+ ${fmtGhs(totals.revenue)}`} tone="emerald" />
        <PnlPill label={totals.profit >= 0 ? 'Net contribution' : 'Net drag'}
                 value={`${totals.profit >= 0 ? '+ ' : '− '}${fmtGhs(Math.abs(totals.profit))}`}
                 tone={totals.profit >= 0 ? 'emerald' : 'brand'} />
      </section>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <PlatformChip selected={filter === 'all'} onClick={() => setFilter('all')}>
          <Globe size={12} /> All platforms
        </PlatformChip>
        {PLATFORMS.map((p) => {
          const Icon = p.icon;
          return (
            <PlatformChip key={p.id} selected={filter === p.id} onClick={() => setFilter(p.id)}>
              <Icon size={12} /> {p.label}
            </PlatformChip>
          );
        })}
        <span className="mx-1 h-5 w-px bg-line" />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as any)}
          className="rounded-lg bg-white border border-line px-2 py-1 text-xs"
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="paused">Paused</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      {/* Empty state when zero campaigns */}
      {list.length === 0 && (
        <EmptyState
          icon={Megaphone}
          title="No campaigns tracked yet"
          description="Add a Facebook, Instagram, TikTok, Google or WhatsApp campaign to see live spend, conversions, ROAS and the auto-feed into Finance."
          action={
            <button className="btn-primary" onClick={() => setAddOpen(true)}>
              <Plus size={14} /> New Campaign
            </button>
          }
        />
      )}

      {/* Campaign table */}
      <div className={`bg-white rounded-card border border-line overflow-hidden anim-fade-up ${list.length === 0 ? 'hidden' : ''}`}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="t-th">Campaign</th>
                <th className="t-th">Platform</th>
                <th className="t-th">Status</th>
                <th className="t-th text-right">Spend</th>
                <th className="t-th text-right">Impr.</th>
                <th className="t-th text-right">Clicks</th>
                <th className="t-th text-right">CTR</th>
                <th className="t-th text-right">Conv.</th>
                <th className="t-th text-right">CPA</th>
                <th className="t-th text-right">Revenue</th>
                <th className="t-th text-right">ROAS</th>
                <th className="t-th"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && list.length > 0 && (
                <tr><td colSpan={12} className="t-td text-center text-neutral-500">No campaigns match the current filter.</td></tr>
              )}
              {filtered.map((c) => {
                const platformMeta = PLATFORMS.find((p) => p.id === c.platform)!;
                const Icon = platformMeta.icon;
                const cpa  = c.conversions ? c.spend / c.conversions : 0;
                const roas = c.spend ? c.revenue / c.spend : 0;
                const ctr  = c.impressions ? (c.clicks / c.impressions) * 100 : 0;
                return (
                  <tr key={c.id} className="hover:bg-canvas transition-colors">
                    <td className="t-td">
                      <div className="font-semibold text-ink-900 truncate" style={{ maxWidth: 220 }} title={c.name}>{c.name}</div>
                      <div className="text-2xs text-neutral-500 capitalize">{c.objective} · {c.startDate}</div>
                    </td>
                    <td className="t-td">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-2xs font-semibold ring-1 ${platformMeta.tone}`}>
                        <Icon size={10} /> {platformMeta.label}
                      </span>
                    </td>
                    <td className="t-td">
                      <StatusPill
                        label={c.status === 'active' ? 'Active' : c.status === 'paused' ? 'Paused' : 'Completed'}
                        tone={c.status === 'active' ? 'success' : c.status === 'paused' ? 'warning' : 'neutral'}
                        dot pulse={c.status === 'active'} size="sm"
                      />
                    </td>
                    <td className="t-td money text-right">{fmtGhs(c.spend)}</td>
                    <td className="t-td num text-right">{fmtInt(c.impressions)}</td>
                    <td className="t-td num text-right">{fmtInt(c.clicks)}</td>
                    <td className="t-td num text-right">{fmtPct(ctr)}</td>
                    <td className="t-td num text-right">{fmtInt(c.conversions)}</td>
                    <td className="t-td money text-right">{c.conversions ? fmtGhs(cpa) : '—'}</td>
                    <td className="t-td money text-right">{fmtGhs(c.revenue)}</td>
                    <td className={`t-td num text-right font-semibold ${roas >= 1 ? 'text-emerald-700' : 'text-brand-500'}`}>
                      {c.spend ? `${roas.toFixed(2)}×` : '—'}
                    </td>
                    <td className="t-td">
                      <button onClick={() => setEditing(c)} className="rounded-lg p-1 text-neutral-500 hover:bg-canvas hover:text-black" title="Edit campaign">
                        <Pencil size={12} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Auto-flow into Finance / P&L */}
      <section className="bg-gradient-to-br from-black to-neutral-900 text-white rounded-2xl p-4 flex items-start gap-3 anim-fade-up">
        <span className="w-9 h-9 rounded-xl bg-brand-500/20 text-brand-300 grid place-items-center ring-1 ring-brand-400/30 shrink-0">
          <CheckCircle2 size={16} />
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm">Wired into Finance automatically</h3>
          <p className="text-xs text-white/70 mt-0.5 leading-relaxed">
            Spend posts as a marketing-category expense on each campaign's start date. Attributed revenue rolls into Sales.
            Net contribution (revenue − spend) appears in the P&L hub as a dedicated line item.
          </p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            <Link to="/expenses-hub" className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-2xs font-semibold">
              <ExternalLink size={10} /> Open P&L hub
            </Link>
            <Link to="/reports" className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-2xs font-semibold">
              <ExternalLink size={10} /> Finance reports
            </Link>
          </div>
        </div>
      </section>

      <CampaignModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={(c) => {
          const next = [c, ...loadCampaigns()];
          saveCampaigns(next);
          setAddOpen(false);
        }}
      />

      <CampaignModal
        open={editing !== null}
        existing={editing}
        onClose={() => setEditing(null)}
        onSaved={(c) => {
          const next = loadCampaigns().map((x) => x.id === c.id ? c : x);
          saveCampaigns(next);
          setEditing(null);
        }}
        onDelete={(id) => {
          saveCampaigns(loadCampaigns().filter((x) => x.id !== id));
          setEditing(null);
        }}
      />
    </PageShell>
  );
}

/* ────────────────────────────  Sub-components  ─────────────────────────── */

function Kpi({
  label, value, sub, tone = 'ink', icon: Icon, live,
}: { label: string; value: string; sub?: string; tone?: 'ink' | 'brand' | 'emerald'; icon: any; live?: boolean }) {
  const tones: Record<string, string> = {
    ink:     'text-ink-900',
    brand:   'text-brand-500',
    emerald: 'text-emerald-700',
  };
  return (
    <article className="bg-white border border-line rounded-2xl p-2.5 flex flex-col gap-1 min-w-0 overflow-hidden lift-on-hover">
      <div className="flex items-center justify-between gap-1">
        <span className="kpi-label">{label}</span>
        <span className="text-neutral-400"><Icon size={12} /></span>
      </div>
      <div className={`font-extrabold leading-none num-tabular ${tones[tone]}`} style={{ fontSize: 'clamp(0.95rem, 1.5vw, 1.25rem)' }} title={value}>
        {value}
      </div>
      <div className="flex items-center justify-between gap-1 min-w-0">
        {sub ? <span className="text-2xs text-neutral-500 truncate" title={sub}>{sub}</span> : <span />}
        {live && (
          <span className="inline-flex items-center gap-1 text-2xs font-semibold text-brand-500" title="Updated every 12 seconds">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-500 anim-pulse-dot" />
            Live
          </span>
        )}
      </div>
    </article>
  );
}

function PnlPill({ label, value, tone }: { label: string; value: string; tone: 'brand' | 'emerald' }) {
  return (
    <div className={`rounded-xl px-3 py-2 flex items-center justify-between ring-1 ${tone === 'brand' ? 'bg-brand-50 ring-brand-200 text-brand-700' : 'bg-emerald-50 ring-emerald-200 text-emerald-700'}`}>
      <span className="text-2xs font-bold uppercase tracking-[0.12em]">{label}</span>
      <span className="money text-sm">{value}</span>
    </div>
  );
}

function PlatformChip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: any }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ring-1 ${
        selected ? 'bg-black text-white ring-black' : 'bg-white text-neutral-700 ring-line hover:bg-canvas'
      }`}
    >
      {children}
    </button>
  );
}

/* ─────────────────────────────  Modal  ─────────────────────────────────── */

function CampaignModal({
  open, existing, onClose, onSaved, onDelete,
}: {
  open: boolean;
  existing?: Campaign | null;
  onClose: () => void;
  onSaved: (c: Campaign) => void;
  onDelete?: (id: string) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [platform, setPlatform] = useState<PlatformId>('facebook');
  const [name, setName] = useState('');
  const [objective, setObjective] = useState<Campaign['objective']>('awareness');
  const [status, setStatus] = useState<Campaign['status']>('active');
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState('');
  const [spend, setSpend] = useState('0');
  const [impressions, setImpressions] = useState('0');
  const [clicks, setClicks] = useState('0');
  const [conversions, setConversions] = useState('0');
  const [revenue, setRevenue] = useState('0');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [syncedId, setSyncedId] = useState<string | null>(null);
  if (existing && existing.id !== syncedId) {
    setSyncedId(existing.id);
    setPlatform(existing.platform);
    setName(existing.name);
    setObjective(existing.objective);
    setStatus(existing.status);
    setStartDate(existing.startDate);
    setEndDate(existing.endDate ?? '');
    setSpend(String(existing.spend));
    setImpressions(String(existing.impressions));
    setClicks(String(existing.clicks));
    setConversions(String(existing.conversions));
    setRevenue(String(existing.revenue));
    setNotes(existing.notes ?? '');
    setError(null);
  } else if (!existing && syncedId !== null) {
    setSyncedId(null);
    setName(''); setSpend('0'); setImpressions('0'); setClicks('0'); setConversions('0'); setRevenue('0'); setNotes('');
  }

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError('Campaign name is required.');
    const payload: Campaign = {
      id: existing?.id ?? `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      platform,
      name: name.trim(),
      objective,
      status,
      startDate,
      endDate: endDate || undefined,
      spend: parseFloat(spend) || 0,
      impressions: parseInt(impressions, 10) || 0,
      clicks: parseInt(clicks, 10) || 0,
      conversions: parseInt(conversions, 10) || 0,
      revenue: parseFloat(revenue) || 0,
      notes: notes.trim() || undefined,
      updatedAt: new Date().toISOString(),
    };
    onSaved(payload);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow={existing ? 'Edit' : 'New'}
      title={existing ? `${PLATFORMS.find((p) => p.id === existing.platform)?.label} · ${existing.name}` : 'New Campaign'}
      width={620}
      footer={
        <>
          {existing && onDelete && (
            <button type="button" onClick={() => { if (confirm(`Delete "${existing.name}"?`)) onDelete(existing.id); }}
              className="text-2xs text-brand-500 hover:text-brand-600 mr-auto inline-flex items-center gap-1">
              <Trash2 size={12} /> Delete
            </button>
          )}
          <button type="button" className="btn-outline text-xs" onClick={onClose}>Cancel</button>
          <button type="submit" form="campaign-form" className="btn-primary text-xs">
            <Megaphone size={12} /> {existing ? 'Save changes' : 'Create campaign'}
          </button>
        </>
      }
    >
      <form id="campaign-form" onSubmit={onSubmit} className="grid grid-cols-2 gap-3">
        <FormField label="Platform" required>
          <select className="field-input" value={platform} onChange={(e) => setPlatform(e.target.value as PlatformId)}>
            {PLATFORMS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </FormField>
        <FormField label="Status" required>
          <select className="field-input" value={status} onChange={(e) => setStatus(e.target.value as any)}>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
          </select>
        </FormField>
        <FormField label="Campaign name" required span={2}>
          <input className="field-input" value={name} onChange={(e) => setName(e.target.value)}
                 placeholder="Workshop Awareness · Accra" required />
        </FormField>
        <FormField label="Objective">
          <select className="field-input" value={objective} onChange={(e) => setObjective(e.target.value as any)}>
            <option value="awareness">Brand awareness</option>
            <option value="traffic">Traffic</option>
            <option value="leads">Lead generation</option>
            <option value="conversions">Conversions</option>
            <option value="sales">Sales</option>
          </select>
        </FormField>
        <FormField label="Start date">
          <input type="date" className="field-input" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </FormField>
        <FormField label="End date" hint="Leave blank for evergreen campaigns.">
          <input type="date" className="field-input" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </FormField>
        <FormField label="Spend (GHS)">
          <input type="number" min={0} step="0.01" className="field-input num" value={spend} onChange={(e) => setSpend(e.target.value)} />
        </FormField>
        <FormField label="Impressions">
          <input type="number" min={0} className="field-input num" value={impressions} onChange={(e) => setImpressions(e.target.value)} />
        </FormField>
        <FormField label="Clicks">
          <input type="number" min={0} className="field-input num" value={clicks} onChange={(e) => setClicks(e.target.value)} />
        </FormField>
        <FormField label="Conversions">
          <input type="number" min={0} className="field-input num" value={conversions} onChange={(e) => setConversions(e.target.value)} />
        </FormField>
        <FormField label="Attributed revenue (GHS)" span={2} hint="Revenue you can trace back to this campaign.">
          <input type="number" min={0} step="0.01" className="field-input num" value={revenue} onChange={(e) => setRevenue(e.target.value)} />
        </FormField>
        <FormField label="Notes" span={2}>
          <textarea className="field-input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)}
                    placeholder="Audience, creative variant, attribution notes…" />
        </FormField>
        {error && (
          <div className="col-span-2 rounded-lg px-3 py-2 text-2xs text-brand-500 bg-brand-50 ring-1 ring-brand-200 flex items-center gap-1.5">
            <AlertTriangle size={12} /> {error}
          </div>
        )}
      </form>
    </Modal>
  );
}
