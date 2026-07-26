import { ArrowRight, PlayCircle, ShieldCheck } from 'lucide-react';

export function CommandCenterHero() {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-black text-white p-8 md:p-14">
      <div className="blob bg-brand-500/40 w-96 h-96 -top-24 -left-24" />
      <div className="blob bg-black/60    w-96 h-96 -bottom-28 -right-16" />

      <div className="relative">
        <div>
          <span className="chip bg-white/10 text-white ring-1 ring-white/20">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
            AGL OPS ENTERPRISE
          </span>
          <h1 className="h-display mt-5 text-white">
            Live <span className="text-brand-500">Command</span> Center
          </h1>
          <p className="mt-5 text-lg text-white/70 max-w-[52ch] leading-relaxed">
            Unified visibility across workshop, finance, team, and customer
            operations — one calm, decisive workspace for managers who move fast.
          </p>
          <ul className="mt-6 grid gap-2 text-white/85">
            {['Real-time job board across bays',
              'Finance, MRR and churn at a glance',
              'AI-assisted alerts for managers'].map(t => (
              <li key={t} className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-brand-500" /> {t}
              </li>
            ))}
          </ul>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href="/workshop" className="btn-primary">
              Open Job Board <ArrowRight size={16} />
            </a>
            <a href="/customers" className="btn-ghost">
              <PlayCircle size={16} /> Customer CRM
            </a>
          </div>
          <div className="mt-6 text-xs text-white/55 flex items-center gap-2">
            <ShieldCheck size={14} /> Role-based access · Audit trail · SOC-ready logs
          </div>
        </div>
      </div>
    </section>
  );
}
