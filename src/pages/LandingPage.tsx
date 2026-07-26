import { Link } from 'react-router-dom';
import {
  ArrowRight, Wrench, Sparkles, MessageSquare, BarChart3,
  Calendar, Mail, MessageCircle, FileSpreadsheet,
  Check, ShieldCheck, Plus, Minus, LucideIcon,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import aglLogo from '../assets/agl-logo.jpeg';

export function LandingPage() {
  return (
    <div className="relative min-h-screen bg-canvas overflow-x-hidden">
      <PublicNav />
      <Hero />
      <ProvenanceStrip />
      <Pillars />
      <Integrations />
      <Pricing />
      <Testimonial />
      <FAQ />
      <FooterCTA />
      <PublicFooter />
    </div>
  );
}

/* ───────────────────────────────  NAV  ─────────────────────────────── */

function PublicNav() {
  return (
    <header className="sticky top-0 z-40 bg-ink-900/95 backdrop-blur-md text-neutral-50">
      <div className="mx-auto w-full flex items-center justify-between gap-6 px-4 py-3" style={{ maxWidth: 'min(1280px, 100% - 48px)' }}>
        <Link to="/welcome" className="flex items-center gap-2 min-w-0">
          <img src={aglLogo} alt="AGL" className="w-7 h-7 rounded-md object-cover shrink-0 ring-1 ring-white/15" />
          <span className="text-sm font-bold tracking-tight uppercase leading-none">
            AGL<span className="text-brand-400 ml-0.5">·</span><span className="ml-0.5">OPS</span>
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-x-6 font-sans text-sm text-neutral-50/80">
          <a href="#pillars"       className="hover:text-neutral-50 transition-colors">Capabilities</a>
          <a href="#integrations"  className="hover:text-neutral-50 transition-colors">Integrations</a>
          <a href="#pricing"       className="hover:text-neutral-50 transition-colors">Pricing</a>
          <a href="#faq"           className="hover:text-neutral-50 transition-colors">Questions</a>
        </nav>
        <div className="flex items-center gap-3">
          <Link to="/" className="font-sans text-sm text-neutral-50/80 hover:text-neutral-50 transition-colors">Sign In</Link>
          <span className="h-4 w-px bg-white/15" />
          <Link to="/" className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-sm font-semibold text-white bg-gradient-to-b from-red-600 to-red-700 shadow-card hover:brightness-105 transition-all">
            Open Command Center <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ───────────────────────────────  HERO  ────────────────────────────── */

function Hero() {
  // CSS-only parallax — track scroll, expose as a custom property the
  // sedan transform reads. No framer-motion required.
  useEffect(() => {
    const onScroll = () => {
      const y = Math.min(window.scrollY, 600);
      document.documentElement.style.setProperty('--agl-hero-scroll', String(y));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const words = 'The quiet authority of a workshop run'.split(' ');

  return (
    <section className="relative bg-ink-900 text-neutral-50 overflow-hidden agl-welcome-hero">
      <div className="blob bg-brand-500/30 w-[36rem] h-[36rem] -top-24 -left-24" />
      <div className="blob bg-brand-400/20 w-[28rem] h-[28rem] top-12  right-10" />
      <div className="blob bg-ink-900/60   w-[36rem] h-[36rem] -bottom-32 -right-16" />

      {/* Ambient red glow behind the sedan */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none agl-hero-glow"
        style={{ background: 'radial-gradient(circle at 70% 60%, rgba(220,38,38,0.18), transparent 60%)' }}
      />

      {/* Red sedan — transparent PNG floating in the hero with red glow + parallax. */}
      <div
        aria-hidden="true"
        className="agl-hero-sedan hidden md:block absolute pointer-events-none select-none"
        style={{
          right: '2%',
          top: '12%',
          width: '50%',
          maxWidth: 880,
        }}
      >
        <div
          className="absolute left-[12%] right-[12%] h-12 bottom-2 rounded-full blur-2xl"
          style={{ background: 'radial-gradient(ellipse at center, rgba(220,38,38,0.55), transparent 70%)' }}
        />
        <img
          src="/brand/sedan-red.png"
          alt=""
          className="relative block w-full h-auto"
          style={{ filter: 'drop-shadow(0 60px 80px rgba(220,38,38,0.30)) drop-shadow(0 30px 40px rgba(0,0,0,0.45))' }}
        />
      </div>

      <div className="relative mx-auto w-full px-3 py-12 md:py-16" style={{ maxWidth: 'min(1280px, 100% - 48px)' }}>
        <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-2xs font-sans font-semibold uppercase tracking-luxe bg-white/10 text-neutral-50 ring-1 ring-white/15 anim-fade-up">
          <span className="w-1 h-1 rounded-full bg-brand-400" />
          Automobile Operations · Crafted for Principals
        </span>

        <h1 className="font-serif font-medium mt-3 text-neutral-50" style={{
          fontSize: 'clamp(2.5rem, 6vw, 5rem)',
          lineHeight: 1.02,
          letterSpacing: '-0.015em',
          maxWidth: '20ch',
          textWrap: 'balance' as const,
        }}>
          {words.map((w, i) => (
            <span key={i} className="inline-block mr-[0.22em] agl-word" style={{ animationDelay: `${i * 40}ms` }}>
              {w}
            </span>
          ))}{' '}
          <span
            className="font-serif italic font-medium text-brand-400 inline-block agl-word"
            style={{ animationDelay: `${words.length * 40 + 120}ms` }}
          >
            without compromise
          </span>.
        </h1>

        <p
          className="font-sans mt-3 text-neutral-50/80 leading-relaxed anim-fade-up"
          style={{ fontSize: 'clamp(1rem, 1.4vw, 1.25rem)', maxWidth: '64ch', animationDelay: '420ms' }}
        >
          AGL Ops is the management platform engineered for automobile workshops that serve principals who notice everything.
          One unified surface for jobs, customers, finance, recurring revenue and intelligent oversight.
        </p>

        <div className="mt-5 flex flex-wrap items-center gap-2 anim-fade-up" style={{ animationDelay: '520ms' }}>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg text-sm font-semibold text-white bg-gradient-to-b from-red-600 to-red-700 shadow-card hover:brightness-110 hover:-translate-y-px active:scale-[0.98] transition-all duration-200"
          >
            Open Command Center <ArrowRight size={14} />
          </Link>
          <a
            href="#pricing"
            className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg text-sm font-medium text-neutral-50/90 bg-white/5 border border-white/15 hover:bg-white/10 hover:-translate-y-px active:scale-[0.98] transition-all duration-200"
          >
            View Pricing
          </a>
          <span className="font-sans text-xs text-neutral-50/60 ml-2 inline-flex items-center gap-1">
            <ShieldCheck size={12} /> Audit trail · Role-based access
          </span>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-3 pt-6" style={{ borderTop: '1px solid rgba(250,247,242,0.08)' }}>
          {[
            { value: '24 / 7',  label: 'Operations Visibility' },
            { value: '< 1 min', label: 'From Question To Answer' },
            { value: '0',       label: 'Spreadsheets Required' },
          ].map((s, i) => (
            <div key={s.label} className="flex flex-col gap-1 min-w-0 anim-fade-up" style={{ animationDelay: `${640 + i * 80}ms` }}>
              <span className="font-serif num text-neutral-50" style={{ fontSize: 'clamp(2rem, 3.4vw, 3rem)', lineHeight: 1, letterSpacing: '-0.01em' }}>
                {s.value}
              </span>
              <span className="font-sans text-2xs font-semibold uppercase text-neutral-50/60" style={{ letterSpacing: '0.18em' }}>
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer hairline */}
      <div aria-hidden="true" className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-600/40 to-transparent" />
    </section>
  );
}

/* ─────────────────────────  PROVENANCE STRIP  ──────────────────────── */

function ProvenanceStrip() {
  return (
    <section className="bg-white" style={{ borderBottom: '1px solid rgba(26,22,18,0.06)' }}>
      <div className="mx-auto w-full px-3 py-5 grid grid-cols-1 md:grid-cols-3 gap-4 items-center" style={{ maxWidth: 'min(1280px, 100% - 48px)' }}>
        <p className="font-serif italic text-ink-700 text-base md:text-md leading-relaxed" style={{ maxWidth: '40ch' }}>
          For workshops where every detail is on the record — and every record on the ledger.
        </p>
        <div className="grid grid-cols-3 gap-3">
          {[
            { value: '01', label: 'Workshop Floor' },
            { value: '02', label: 'Customer Ledger' },
            { value: '03', label: 'Treasury' },
          ].map(s => (
            <div key={s.label} className="flex flex-col gap-1 min-w-0" style={{ borderLeft: '1px solid rgba(26,22,18,0.08)', paddingLeft: 16 }}>
              <span className="font-serif num text-ink-900" style={{ fontSize: '1.953rem', lineHeight: 1 }}>{s.value}</span>
              <span className="font-sans text-2xs font-semibold uppercase text-ink-700" style={{ letterSpacing: '0.18em' }}>{s.label}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center md:justify-end gap-2">
          <ShieldCheck size={18} className="text-brand-500" />
          <span className="font-sans text-sm text-ink-700">Single source of truth · Audited continuously</span>
        </div>
      </div>
    </section>
  );
}

/* ────────────────────────────  PILLARS  ────────────────────────────── */

interface Pillar { icon: LucideIcon; title: string; description: string; tone: 'red' | 'ink' }

const pillars: Pillar[] = [
  { icon: Wrench,        title: 'Workshop Management',  description: 'Live job board across every bay. Intake, work in progress, ready for collection — held in continuous view.',           tone: 'red' },
  { icon: Sparkles,      title: 'FixBot Assistance',    description: 'A discreet operations assistant that consults every ledger and replies with cited figures, not approximations.',         tone: 'ink' },
  { icon: MessageSquare, title: 'WhatsApp Reminders',   description: 'Service due notices and renewals delivered with the calm consistency of a private office. Templates, schedule, log.',     tone: 'red' },
  { icon: BarChart3,     title: 'Audited Reports',      description: 'Revenue, retention, receivables and subscription health — formatted for the principals who expect a written record.',     tone: 'ink' },
];

function Pillars() {
  return (
    <section id="pillars" className="bg-canvas">
      <div className="mx-auto w-full px-3 py-12 md:py-16" style={{ maxWidth: 'min(1280px, 100% - 48px)' }}>
        <div className="grid grid-cols-12 gap-4 mb-6">
          <div className="col-span-12 md:col-span-5">
            <span className="font-sans text-xs font-semibold uppercase text-brand-500" style={{ letterSpacing: '0.22em' }}>Capabilities</span>
            <h2 className="font-serif font-medium text-ink-900 mt-1" style={{ fontSize: 'clamp(2rem, 3.6vw, 3rem)', lineHeight: 1.08, letterSpacing: '-0.01em' }}>
              Four pillars. One unhurried surface.
            </h2>
          </div>
          <p className="col-span-12 md:col-span-7 font-sans text-base text-ink-700 leading-relaxed self-end" style={{ maxWidth: '64ch' }}>
            AGL Ops does not chase trends. It carries the daily operation of a workshop with the discretion of a private secretary — and the precision of a Swiss complication.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {pillars.map(p => (
            <article
              key={p.title}
              className="bg-white rounded-2xl p-5 flex items-start gap-3 min-w-0"
              style={{ border: '1px solid rgba(26,22,18,0.06)' }}
            >
              <span
                className={`w-6 h-6 rounded-2xl grid place-items-center shrink-0 ${
                  p.tone === 'red' ? 'bg-brand-500 text-neutral-50' : 'bg-ink-900 text-neutral-50'
                }`}
              >
                <p.icon size={24} />
              </span>
              <div className="min-w-0">
                <h3 className="font-serif font-medium text-ink-900" style={{ fontSize: '1.5rem', lineHeight: 1.2 }}>{p.title}</h3>
                <p className="font-sans text-sm text-ink-700 mt-1 leading-relaxed">{p.description}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────  INTEGRATIONS  ─────────────────────────── */

const integrations = [
  { icon: MessageCircle,   name: 'WhatsApp Business', detail: 'Outbound reminders and conversations, end-to-end encrypted.' },
  { icon: Calendar,        name: 'Google Calendar',   detail: 'Two-way sync of bays, technicians and customer appointments.' },
  { icon: Mail,            name: 'Gmail and Outlook', detail: 'Send statements, quotes and reports without leaving the ledger.' },
  { icon: FileSpreadsheet, name: 'Excel and CSV',     detail: 'Import existing customer ledgers; export every report on demand.' },
];

function Integrations() {
  return (
    <section id="integrations" className="bg-white" style={{ borderTop: '1px solid rgba(26,22,18,0.06)', borderBottom: '1px solid rgba(26,22,18,0.06)' }}>
      <div className="mx-auto w-full px-3 py-12 md:py-16" style={{ maxWidth: 'min(1280px, 100% - 48px)' }}>
        <div className="text-center mb-6">
          <span className="font-sans text-xs font-semibold uppercase text-brand-500" style={{ letterSpacing: '0.22em' }}>Connections</span>
          <h2 className="font-serif font-medium text-ink-900 mt-1" style={{ fontSize: 'clamp(2rem, 3.6vw, 3rem)', lineHeight: 1.08, letterSpacing: '-0.01em' }}>
            The platform speaks fluently with the tools the operation already trusts.
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {integrations.map(i => (
            <article
              key={i.name}
              className="rounded-2xl p-4 flex flex-col gap-2 min-w-0"
              style={{ background: '#F5EBED', border: '1px solid rgba(122,31,43,0.18)' }}
            >
              <span className="w-5 h-5 rounded-xl bg-brand-500 text-neutral-50 grid place-items-center">
                <i.icon size={20} />
              </span>
              <h3 className="font-sans text-base font-semibold text-ink-900">{i.name}</h3>
              <p className="font-sans text-sm text-ink-700 leading-relaxed">{i.detail}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ───────────────────────────  PRICING  ────────────────────────────── */

interface Tier {
  name: string;
  price: string;
  cadence: string;
  description: string;
  features: string[];
  highlight?: boolean;
  cta: string;
}

const tiers: Tier[] = [
  {
    name: 'Atelier',
    price: 'GHS 800',
    cadence: 'per month',
    description: 'For the independent workshop establishing its records.',
    features: [
      'Single workshop bay',
      'Up to two team members',
      'Customer and vehicle ledger',
      'WhatsApp reminders, two templates',
      'Monthly profit and loss',
    ],
    cta: 'Begin Atelier',
  },
  {
    name: 'Maison',
    price: 'GHS 2,400',
    cadence: 'per month',
    description: 'For the workshop serving discerning regular clientele.',
    features: [
      'Up to six workshop bays',
      'Unlimited team members',
      'Full customer and vehicle ledger',
      'WhatsApp templates · scheduling · delivery log',
      'FixBot assistant, conversational',
      'Audited reports across treasury',
      'Subscription and recurring revenue',
    ],
    highlight: true,
    cta: 'Choose Maison',
  },
  {
    name: 'Privé',
    price: 'On request',
    cadence: 'bespoke terms',
    description: 'For multi-site operations and exclusive marque specialists.',
    features: [
      'Unlimited workshops and bays',
      'Single sign-on and bespoke roles',
      'Dedicated success principal',
      'White-glove migration and training',
      'Custom integrations',
      'Service-level agreement',
    ],
    cta: 'Speak To Us',
  },
];

function Pricing() {
  return (
    <section id="pricing" className="bg-canvas">
      <div className="mx-auto w-full px-3 py-12 md:py-16" style={{ maxWidth: 'min(1280px, 100% - 48px)' }}>
        <div className="text-center mb-6">
          <span className="font-sans text-xs font-semibold uppercase text-brand-500" style={{ letterSpacing: '0.22em' }}>Pricing</span>
          <h2 className="font-serif font-medium text-ink-900 mt-1" style={{ fontSize: 'clamp(2rem, 3.6vw, 3rem)', lineHeight: 1.08, letterSpacing: '-0.01em' }}>
            Three tiers. One standard.
          </h2>
          <p className="font-sans text-base text-ink-700 mt-2 leading-relaxed mx-auto" style={{ maxWidth: '64ch' }}>
            Each tier delivers the same disciplined surface. The only difference is the scale of the operation it carries.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {tiers.map(t => (
            <article
              key={t.name}
              className={`rounded-2xl p-5 flex flex-col gap-3 min-w-0 ${
                t.highlight ? 'bg-ink-900 text-neutral-50 shadow-pop' : 'bg-white text-ink-900'
              }`}
              style={{
                border: t.highlight ? '1px solid rgba(160,48,64,0.5)' : '1px solid rgba(26,22,18,0.06)',
              }}
            >
              {t.highlight && (
                <span className="self-start inline-flex items-center rounded-full px-2 py-0.5 text-2xs font-sans font-semibold uppercase tracking-luxe bg-brand-500 text-neutral-50">
                  Most chosen
                </span>
              )}
              <header className="min-w-0">
                <h3 className="font-serif font-medium" style={{ fontSize: '1.953rem', lineHeight: 1.1 }}>{t.name}</h3>
                <p className={`font-sans text-sm mt-1 leading-relaxed ${t.highlight ? 'text-neutral-50/70' : 'text-ink-700'}`}>{t.description}</p>
              </header>
              <div className="flex items-baseline gap-1">
                <span className="font-serif num font-medium" style={{ fontSize: 'clamp(2.25rem, 3.4vw, 3rem)', lineHeight: 1, letterSpacing: '-0.01em' }}>{t.price}</span>
                <span className={`font-sans text-sm ${t.highlight ? 'text-neutral-50/70' : 'text-ink-700'}`}>{t.cadence}</span>
              </div>
              <ul className="grid gap-1.5">
                {t.features.map(f => (
                  <li key={f} className="flex items-start gap-1.5 font-sans text-sm leading-relaxed">
                    <Check size={16} className={`mt-0.5 shrink-0 ${t.highlight ? 'text-brand-400' : 'text-brand-500'}`} />
                    <span className={t.highlight ? 'text-neutral-50/85' : 'text-ink-900'}>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                to="/"
                className={`text-sm mt-1 ${t.highlight ? 'btn-primary' : 'btn-outline'}`}
              >
                {t.cta} <ArrowRight size={14} />
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ──────────────────────────  TESTIMONIAL  ─────────────────────────── */

function Testimonial() {
  return (
    <section className="bg-white" style={{ borderTop: '1px solid rgba(26,22,18,0.06)', borderBottom: '1px solid rgba(26,22,18,0.06)' }}>
      <div className="mx-auto w-full px-3 py-12 md:py-16 grid grid-cols-12 gap-4 items-center" style={{ maxWidth: 'min(1280px, 100% - 48px)' }}>
        <div className="col-span-12 md:col-span-2 flex md:justify-center">
          <span className="font-serif text-brand-500" style={{ fontSize: '5rem', lineHeight: 0.6 }}>“</span>
        </div>
        <blockquote className="col-span-12 md:col-span-10 min-w-0">
          <p className="font-serif italic text-ink-900 leading-snug" style={{ fontSize: 'clamp(1.5rem, 2.4vw, 2.25rem)', maxWidth: '52ch' }}>
            For the first time, the workshop runs to the same standard as the cars we look after. The records are immaculate; the conversations are calm; nothing is forgotten.
          </p>
          <footer className="mt-3 flex items-center gap-2">
            <span className="w-4 h-4 rounded-full bg-brand-500 text-neutral-50 grid place-items-center font-serif font-medium text-base">A</span>
            <div>
              <div className="font-sans text-sm font-semibold text-ink-900">Workshop Principal</div>
              <div className="font-sans text-xs text-ink-700">Marque specialist · Accra</div>
            </div>
          </footer>
        </blockquote>
      </div>
    </section>
  );
}

/* ─────────────────────────────  FAQ  ──────────────────────────────── */

const faqs = [
  {
    q: 'Is AGL Ops suitable for a single-bay workshop?',
    a: 'Yes. The Atelier tier is designed for the independent workshop. The discipline of the platform applies whether you are running one bay or twelve.',
  },
  {
    q: 'How does FixBot handle sensitive customer data?',
    a: 'FixBot operates with read-only access by default and every interaction is recorded in the audit trail. Write actions require explicit role-based permission and confirmation.',
  },
  {
    q: 'Can existing customer records be imported?',
    a: 'Yes. The platform accepts Excel and CSV imports during onboarding. Privé clients receive a dedicated migration principal who carries the work for you.',
  },
  {
    q: 'Which channels are used for customer reminders?',
    a: 'WhatsApp Business is the primary channel. Email is supported through Gmail and Outlook integrations. Voice notes can be attached to any reminder.',
  },
  {
    q: 'What is the data residency arrangement?',
    a: 'All operational data is encrypted in transit and at rest. Privé clients may elect a dedicated, regional residency arrangement.',
  },
];

function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section id="faq" className="bg-canvas">
      <div className="mx-auto w-full px-3 py-12 md:py-16 grid grid-cols-12 gap-4" style={{ maxWidth: 'min(1280px, 100% - 48px)' }}>
        <div className="col-span-12 md:col-span-4">
          <span className="font-sans text-xs font-semibold uppercase text-brand-500" style={{ letterSpacing: '0.22em' }}>Questions</span>
          <h2 className="font-serif font-medium text-ink-900 mt-1" style={{ fontSize: 'clamp(2rem, 3.6vw, 3rem)', lineHeight: 1.08, letterSpacing: '-0.01em' }}>
            The matters most often raised.
          </h2>
          <p className="font-sans text-base text-ink-700 mt-2 leading-relaxed">
            For anything not addressed below, our team responds within one working day.
          </p>
        </div>
        <div className="col-span-12 md:col-span-8 grid gap-2 min-w-0">
          {faqs.map((f, i) => {
            const isOpen = open === i;
            return (
              <article
                key={i}
                className="bg-white rounded-2xl px-4 py-3 min-w-0"
                style={{ border: '1px solid rgba(26,22,18,0.06)' }}
              >
                <button
                  className="w-full flex items-start justify-between gap-2 text-left"
                  onClick={() => setOpen(isOpen ? null : i)}
                  aria-expanded={isOpen}
                >
                  <span className="font-serif font-medium text-ink-900" style={{ fontSize: '1.25rem', lineHeight: 1.3 }}>
                    {f.q}
                  </span>
                  <span className="w-4 h-4 rounded-full bg-brand-50 text-brand-500 grid place-items-center shrink-0">
                    {isOpen ? <Minus size={14} /> : <Plus size={14} />}
                  </span>
                </button>
                {isOpen && (
                  <p className="font-sans text-sm text-ink-700 mt-2 leading-relaxed">{f.a}</p>
                )}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────  FOOTER CTA  ───────────────────────────── */

function FooterCTA() {
  return (
    <section className="bg-ink-900 text-neutral-50 relative overflow-hidden">
      <div className="blob bg-brand-500/30 w-[28rem] h-[28rem] -top-12 left-1/4" />
      <div className="relative mx-auto w-full px-3 py-12 md:py-16 text-center" style={{ maxWidth: 'min(960px, 100% - 48px)' }}>
        <h2 className="font-serif font-medium text-neutral-50" style={{ fontSize: 'clamp(2rem, 4vw, 3.5rem)', lineHeight: 1.05, letterSpacing: '-0.01em', textWrap: 'balance' as const }}>
          Run the workshop the way the cars deserve to be run.
        </h2>
        <p className="font-sans text-base text-neutral-50/80 mt-3 mx-auto leading-relaxed" style={{ maxWidth: '54ch' }}>
          A standing demonstration is available on request. We will walk through the platform with the Principal of the operation, in private.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          <Link to="/" className="btn-primary text-sm">Open Command Center <ArrowRight size={14} /></Link>
          <a href="#pricing" className="btn-ghost text-sm">Review Pricing</a>
        </div>
      </div>
    </section>
  );
}

/* ─────────────────────────  PUBLIC FOOTER  ────────────────────────── */

function PublicFooter() {
  return (
    <footer className="bg-white" style={{ borderTop: '1px solid rgba(26,22,18,0.06)' }}>
      <div className="mx-auto w-full px-3 py-6 grid grid-cols-12 gap-4" style={{ maxWidth: 'min(1280px, 100% - 48px)' }}>
        <div className="col-span-12 md:col-span-5 min-w-0">
          <Link to="/welcome" className="flex items-center gap-1.5">
            <img src={aglLogo} alt="AGL" className="w-4 h-4 rounded-sm object-cover ring-1 ring-ink-900/10" />
            <span className="font-serif text-sm font-medium tracking-luxe uppercase text-ink-900">
              AGL<span className="text-brand-500 ml-1">·</span><span className="ml-1">Ops</span>
            </span>
          </Link>
          <p className="font-sans text-sm text-ink-700 mt-2 leading-relaxed" style={{ maxWidth: '40ch' }}>
            Operations management for automobile workshops with a standard to uphold.
          </p>
        </div>
        <FooterColumn title="Platform" items={['Capabilities', 'Integrations', 'Pricing', 'Command Center']} />
        <FooterColumn title="Company"  items={['About', 'Press', 'Careers', 'Contact']} />
        <FooterColumn title="Legal"    items={['Privacy', 'Terms', 'Data Residency', 'Status']} />
      </div>
      <div className="border-t" style={{ borderColor: 'rgba(26,22,18,0.06)' }}>
        <div className="mx-auto w-full px-3 py-3 flex items-center justify-between flex-wrap gap-2" style={{ maxWidth: 'min(1280px, 100% - 48px)' }}>
          <span className="font-sans text-xs text-ink-700">© AGL Automobile Ultimate Ltd · All rights reserved.</span>
          <span className="font-sans text-xs text-ink-700">Crafted in Accra · Held to a private standard.</span>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="col-span-6 md:col-span-2 min-w-0">
      <h4 className="font-sans text-2xs font-semibold uppercase text-ink-700" style={{ letterSpacing: '0.22em' }}>{title}</h4>
      <ul className="mt-2 grid gap-1">
        {items.map(it => (
          <li key={it}>
            <a href="#" className="font-sans text-sm text-ink-900 hover:text-brand-500 transition-colors">{it}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
