import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Loader2 } from 'lucide-react';
import { trpc } from '../lib/trpc';
import { useAuth } from '../contexts/AuthContext';

/**
 * Stand-alone onboarding screen. Reached when an authenticated user has no
 * tenant association (P6.14 made the tenantMiddleware refuse such users).
 * Submits to `tenants.create` with `ownerEmail` set to the user's email,
 * which guarantees the next `auth.myTenant` resolves cleanly.
 */
export function OnboardingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const [businessName, setBusinessName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState(user?.email ?? '');
  const [tier, setTier] = useState<'free' | 'starter' | 'pro' | 'enterprise'>('free');
  const [error, setError] = useState<string | null>(null);

  const createMutation = trpc.tenants.create.useMutation({
    onSuccess: async (data) => {
      if (data?.success === false) {
        setError(data.error ?? 'Failed to create tenant.');
        return;
      }
      // Force a fresh `auth.myTenant` fetch so RequireTenant lets us through.
      await utils.auth.myTenant.invalidate();
      navigate('/', { replace: true });
    },
    onError: (e) => setError(e.message),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!businessName.trim()) return setError('Business name is required.');
    if (!ownerEmail.trim()) return setError('Owner email is required.');
    createMutation.mutate({
      businessName: businessName.trim(),
      ownerEmail: ownerEmail.trim(),
      subscriptionTier: tier,
    });
  };

  return (
    <div className="min-h-screen bg-canvas grid place-items-center px-6 py-10">
      <div
        className="w-full max-w-xl bg-white rounded-2xl p-8"
        style={{ border: '1px solid rgba(26,22,18,0.06)' }}
      >
        <div className="flex items-center gap-3 mb-2">
          <span className="w-10 h-10 rounded-xl bg-brand-50 text-brand-500 grid place-items-center">
            <Building2 size={20} />
          </span>
          <span
            className="font-sans text-xs font-semibold uppercase text-ink-700"
            style={{ letterSpacing: '0.08em' }}
          >
            Welcome to AGL Ops
          </span>
        </div>
        <h1
          className="font-serif font-medium text-ink-900"
          style={{ fontSize: '1.75rem', lineHeight: 1.15 }}
        >
          Set up your workshop
        </h1>
        <p className="font-sans text-sm text-ink-700 mt-2 leading-relaxed">
          Your account is signed in but isn't yet bound to a tenant. Tell us a
          little about the business and we'll create the workspace where every
          customer, vehicle, job, and ledger entry will live.
        </p>

        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 mt-5">
          <label className="flex flex-col gap-1">
            <span className="field-label">Business Name <span className="text-brand-500">*</span></span>
            <input
              className="field-input"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="AGL Auto"
              autoFocus
              required
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="field-label">Owner Email <span className="text-brand-500">*</span></span>
            <input
              type="email"
              className="field-input"
              value={ownerEmail}
              onChange={(e) => setOwnerEmail(e.target.value)}
              required
            />
            <span className="field-hint">
              The middleware uses this to resolve your tenant on every request.
              Keep it the same as your sign-in email unless you know better.
            </span>
          </label>

          <label className="flex flex-col gap-1">
            <span className="field-label">Subscription Tier</span>
            <select
              className="field-input"
              value={tier}
              onChange={(e) => setTier(e.target.value as typeof tier)}
            >
              <option value="free">Free — bootstrap</option>
              <option value="starter">Starter</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </label>

          {error && (
            <div
              className="rounded-xl px-3 py-2 font-sans text-sm text-brand-500"
              style={{ background: '#F5EBED', border: '1px solid rgba(122,31,43,0.18)' }}
              role="alert"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            className="btn-primary text-sm mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
            disabled={createMutation.isLoading}
          >
            {createMutation.isLoading ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Creating…
              </>
            ) : (
              'Create Workspace'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
