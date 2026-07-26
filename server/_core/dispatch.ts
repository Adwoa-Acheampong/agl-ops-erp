/**
 * WS5-B — Outbound dispatchers (email + WhatsApp).
 *
 * Defaults to console-only delivery so the dev box ships nothing real
 * by accident. Providers wire in via env:
 *
 *   • Email    — SMTP_URL=smtps://user:pass@host:465 (uses nodemailer)
 *                EMAIL_FROM=ops@agl.com.gh
 *   • WhatsApp — WA_API_URL=…  WA_API_TOKEN=… (any "JSON POST" gateway:
 *                Cloud API, 360dialog, Twilio, Wassenger, etc.)
 *
 * Each dispatcher returns a `DispatchResult` so the caller can log the
 * outcome (and the bell can downgrade quietly when offline).
 */
export interface DispatchResult { ok: boolean; providerId?: string; error?: string; }

/** Console fallback used when no provider env is set — keeps dev quiet
 *  but visibly logged so the team can confirm the trigger fired. */
function logFallback(channel: 'email' | 'whatsapp', payload: Record<string, unknown>) {
  // eslint-disable-next-line no-console
  console.log(`[dispatch:${channel}]`, JSON.stringify(payload));
}

export async function dispatchEmail({ to, subject, body }: { to: string; subject: string; body: string }): Promise<DispatchResult> {
  const smtp = process.env.SMTP_URL;
  if (!smtp) {
    logFallback('email', { to, subject, body });
    return { ok: true, providerId: 'console' };
  }
  try {
    // Lazy import so the prod path doesn't require nodemailer on the
    // dev box. Falls through to console if the dep is missing.
    const mod = await import('nodemailer').catch(() => null as any);
    if (!mod) { logFallback('email', { to, subject, body }); return { ok: true, providerId: 'console' }; }
    const tx = mod.createTransport(smtp);
    const from = process.env.EMAIL_FROM ?? 'ops@aglops.gh';
    const info = await tx.sendMail({ from, to, subject, text: body });
    return { ok: true, providerId: (info as any)?.messageId };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

export async function dispatchWhatsapp({ to, body }: { to: string; body: string }): Promise<DispatchResult> {
  const url   = process.env.WA_API_URL;
  const token = process.env.WA_API_TOKEN;
  if (!url || !token) {
    logFallback('whatsapp', { to, body });
    return { ok: true, providerId: 'console' };
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ to, body }),
    });
    if (!res.ok) return { ok: false, error: `Provider responded ${res.status}` };
    const json: any = await res.json().catch(() => ({}));
    return { ok: true, providerId: json?.id ?? json?.messageId ?? undefined };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}
