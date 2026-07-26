import { useState, FormEvent } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ArrowRight, ShieldCheck, Lock } from 'lucide-react';
import aglLogo from '../assets/agl-logo.jpeg';
import { trpc } from '../lib/trpc';
import { useAuth } from '../contexts/AuthContext';

type Mode = 'login' | 'register';

/**
 * Login / Register surface.
 *
 * Visual: AGL palette (black / red / white) with Cormorant Garamond serif
 * headlines for the luxury voice the rest of the marketing site uses.
 * A transparent red sedan PNG floats inline between the headline and
 * the sub-copy on the dark brand panel — drop-shadow + reflected
 * ground glow tie it back to brand red.
 */
export function LoginPage() {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { refetch } = useAuth();

  const stateRedirectTo = (location.state as { from?: string } | null)?.from;
  const host = typeof window === 'undefined' ? '' : window.location.hostname.toLowerCase();
  const isStaffHost = host === 'staff.agl.software' || host.startsWith('staff.');
  const isStaffPath = location.pathname.startsWith('/staff') || Boolean(stateRedirectTo?.startsWith('/staff'));
  const isStaffPortal =
    isStaffHost ||
    isStaffPath;
  const redirectTo = stateRedirectTo ?? (isStaffPath ? '/staff' : '/');
  const portalName = isStaffPortal ? 'Staff Portal' : 'Command Center';

  const loginMutation = trpc.auth.login.useMutation({
    onSuccess: async () => {
      await refetch();
      navigate(redirectTo, { replace: true });
    },
    onError: (e) => setError(e.message),
  });

  const registerMutation = trpc.auth.register.useMutation({
    onSuccess: async () => {
      await refetch();
      navigate(redirectTo, { replace: true });
    },
    onError: (e) => setError(e.message),
  });

  const isPending = loginMutation.isLoading || registerMutation.isLoading;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (mode === 'login') {
      loginMutation.mutate({ email, password });
    } else {
      registerMutation.mutate({ email, password, name: name || undefined });
    }
  };

  return (
    <div className="agl-login relative min-h-screen bg-white overflow-x-hidden grid lg:grid-cols-[1.1fr_1fr]">
      {/* ───────  Left panel: black brand statement with sedan  ─────── */}
      <aside className="agl-login-brand relative hidden lg:flex flex-col justify-between bg-black text-white p-10 overflow-hidden">
        {/* Subdued red blobs — matches the Dashboard hero. */}
        <div className="blob bg-brand-500/30 w-[28rem] h-[28rem] -top-20 -left-20" />
        <div className="blob bg-brand-600/20 w-[24rem] h-[24rem] bottom-8 -right-16" />
        <div className="blob bg-black/60     w-[22rem] h-[22rem] -bottom-16 left-1/3" />

        <Link to="/welcome" className="relative z-10 flex items-center gap-2.5 group anim-fade-up">
          <img
            src={aglLogo}
            alt="AGL"
            className="w-11 h-11 rounded-control object-cover ring-1 ring-white/20 group-hover:ring-white/40 transition-all"
          />
          <span className="text-lg font-extrabold tracking-wide leading-none">
            AGL<span className="text-brand-500 ml-1">OPS</span>
          </span>
        </Link>

        <div className="relative z-10 anim-fade-up flex flex-col" style={{ animationDelay: '120ms' }}>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-[0.22em] bg-white/10 text-white ring-1 ring-white/20 self-start mt-12">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-500" />
            {isStaffPortal ? 'Staff Portal' : 'Command Center · Enterprise'}
          </span>
          <h1
            className="agl-headline mt-6 text-white"
            style={{
              fontSize: 'clamp(2.5rem, 5vw, 4.5rem)',
              lineHeight: 1.02,
              letterSpacing: '-0.02em',
              maxWidth: '18ch',
              textWrap: 'balance' as const,
            }}
          >
            Run your workshop with the <em className="agl-italic text-brand-500">quiet authority</em> of a system that never forgets.
          </h1>

          {/* Sedan — inline between the headline and the sub-copy.
              Transparent PNG with red drop-shadow + reflected floor glow. */}
          <div
            aria-hidden="true"
            className="agl-login-sedan relative mt-6 mb-2 mx-auto pointer-events-none select-none"
            style={{ width: '90%', maxWidth: 460 }}
          >
            <div
              className="absolute left-[15%] right-[15%] h-10 -bottom-2 rounded-full blur-2xl"
              style={{ background: 'radial-gradient(ellipse at center, rgba(220,38,38,0.50), transparent 70%)' }}
            />
            <img
              src="/brand/sedan-red.png"
              alt=""
              className="relative block w-full h-auto"
              style={{
                filter: 'drop-shadow(0 30px 50px rgba(220,38,38,0.35)) drop-shadow(0 15px 25px rgba(0,0,0,0.45))',
              }}
            />
          </div>

          <p className="text-base text-white/70 mt-4 leading-relaxed" style={{ maxWidth: '48ch' }}>
            {isStaffPortal
              ? 'Sign in to the Staff Portal. Clock activity, payroll, tasks, training, and workshop updates stay synced with the main ledger.'
              : 'Sign in to the Command Center. Every action is recorded, every record is on the ledger, and nothing is forgotten without a trace.'}
          </p>

          <ul className="grid gap-2 mt-3 text-sm text-white/85">
            {['Real-time job board across bays',
              'Finance, MRR and churn at a glance',
              'AI-assisted alerts for managers'].map((t, i) => (
              <li key={t} className="flex items-center gap-2.5 anim-fade-up" style={{ animationDelay: `${200 + i * 80}ms` }}>
                <span className="w-2 h-2 rounded-sm bg-brand-500" /> {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative z-10 flex items-center gap-2 text-2xs text-white/60 anim-fade-up mt-10" style={{ animationDelay: '500ms' }}>
          <ShieldCheck size={12} /> Role-based access · Audit trail · Encrypted at rest
        </div>
      </aside>

      {/* ───────  Right panel: form  ─────── */}
      <main className="relative flex flex-col justify-center items-center px-5 py-10 min-w-0 bg-canvas">
        <Link to="/welcome" className="lg:hidden flex items-center gap-2 mb-6 anim-fade-up">
          <img src={aglLogo} alt="AGL" className="w-9 h-9 rounded-control object-cover ring-1 ring-black/10" />
          <span className="text-base font-extrabold tracking-wide text-black leading-none">
            AGL<span className="text-brand-500 ml-1">OPS</span>
          </span>
        </Link>

        <section
          className="agl-card bg-white border border-line rounded-card p-8 w-full shadow-pop anim-rise"
          style={{ maxWidth: 480 }}
        >
          <header className="mb-6">
            {isStaffPortal && mode === 'login' && (
              <p className="mb-2 font-sans text-xs font-bold uppercase tracking-[0.22em] text-neutral-500">
                Staff Portal
              </p>
            )}
            <span className="inline-flex items-center gap-1.5 text-2xs font-bold uppercase tracking-[0.22em] text-brand-600">
              <Lock size={11} /> {mode === 'login' ? 'Sign In' : 'Create Account'}
            </span>
            <h2
              className="agl-headline mt-3 text-black"
              style={{
                fontSize: 'clamp(2rem, 3.5vw, 2.75rem)',
                lineHeight: 1.05,
                letterSpacing: '-0.015em',
              }}
            >
              {mode === 'login'
                ? isStaffPortal
                  ? <>Welcome back,</>
                  : <>Welcome back, <em className="agl-italic text-brand-500">Principal</em>.</>
                : <>Open the <em className="agl-italic text-brand-500">ledger</em>.</>}
            </h2>
            <p className="text-sm text-neutral-700 mt-2 leading-relaxed">
              {mode === 'login'
                ? `Enter your credentials to continue to ${isStaffPortal ? 'staff portal' : `the ${portalName}`}.`
                : 'The first account becomes the operations administrator. Subsequent accounts join with read-only access until promoted.'}
            </p>
          </header>

          <form onSubmit={onSubmit} className="grid gap-3.5">
            {mode === 'register' && (
              <Field label="Full name" hint="Optional. Shown in audit logs.">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  className="auth-input"
                  placeholder="Yaw Mensah"
                />
              </Field>
            )}

            <Field label="Email address">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="auth-input"
                placeholder="principal@workshop.com"
              />
            </Field>

            <Field label="Password" hint={mode === 'register' ? 'At least 8 characters.' : undefined}>
              <input
                type="password"
                required
                minLength={mode === 'register' ? 8 : 1}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                className="auth-input"
                placeholder="••••••••"
              />
            </Field>

            {error && (
              <div
                className="font-sans text-sm text-brand-500 px-3 py-2 rounded-lg flex items-start gap-2"
                style={{ background: '#FEF2F2', border: '1px solid rgba(220,38,38,0.25)' }}
                role="alert"
              >
                <span className="w-4 h-4 rounded-full bg-brand-500 text-white text-2xs font-bold grid place-items-center shrink-0 mt-0.5">!</span>
                <span className="leading-snug">{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isPending}
              className="btn-primary text-sm justify-center mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isPending
                ? 'One moment…'
                : mode === 'login' ? 'Sign In' : 'Create Account'}
              <ArrowRight size={14} />
            </button>
          </form>

          <footer className="mt-6 pt-4 flex items-center justify-between gap-2 flex-wrap border-t border-line">
            <span className="font-sans text-sm text-neutral-700">
              {mode === 'login' ? 'No account yet?' : 'Already registered?'}
            </span>
            <button
              type="button"
              onClick={() => { setError(null); setMode(mode === 'login' ? 'register' : 'login'); }}
              className="font-sans text-sm font-semibold text-brand-500 hover:text-brand-600 transition-colors"
            >
              {mode === 'login' ? 'Create one →' : '← Back to sign in'}
            </button>
          </footer>
        </section>

        <p className="font-sans text-2xs text-neutral-600 mt-5 text-center anim-fade" style={{ maxWidth: 480 }}>
          By signing in you agree that your actions will be recorded in the audit trail.
        </p>
      </main>

      <style>{`
        .agl-headline {
          font-family: 'Cormorant Garamond', ui-serif, Georgia, serif;
          font-feature-settings: 'liga', 'kern';
        }
        .agl-italic { font-style: italic; }

        .auth-input {
          width: 100%;
          background: #FAFAFA;
          border: 1px solid #E5E5E5;
          border-radius: 12px;
          padding: 12px 14px;
          font-family: 'Inter', sans-serif;
          font-size: 16.5px;
          letter-spacing: -0.005em;
          color: #111;
          outline: none;
          transition: border-color .2s ease-out, background .2s ease-out, box-shadow .2s ease-out;
        }
        .auth-input:focus {
          border-color: #DC2626;
          background: #ffffff;
          box-shadow: 0 0 0 3px rgba(220,38,38,0.15);
        }
        .auth-input::placeholder { color: rgba(0,0,0,0.32); }
      `}</style>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1">
      <span
        className="font-sans text-2xs font-bold uppercase text-neutral-700"
        style={{ letterSpacing: '0.12em' }}
      >
        {label}
      </span>
      {children}
      {hint && <span className="font-sans text-2xs text-neutral-600">{hint}</span>}
    </label>
  );
}
