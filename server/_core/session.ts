/**
 * Zero-dependency session token + password-hash helpers.
 *
 * Uses only Node's built-in `crypto` — no bcrypt, no jsonwebtoken. The
 * standalone AGL build needed an auth layer when the SDK-backed
 * `authenticateRequest` proved unreliable. This module gives the new
 * authRouter primitives for issuing + verifying session cookies and
 * for hashing + comparing user passwords.
 */
import crypto from 'node:crypto';

const SECRET = process.env.JWT_SECRET || 'agl-ops-dev-secret-do-not-use-in-prod';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

export const SESSION_COOKIE = 'agl_session';

export interface SessionPayload {
  userId: number;
  role: string;
  exp: number;   // unix seconds
}

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString('base64')
    .replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function b64urlDecode(str: string): Buffer {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

/** Issue a compact signed token: `<base64(payload)>.<base64(hmac)>`. */
export function signSession(userId: number, role: string): string {
  const payload: SessionPayload = {
    userId,
    role,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  };
  const head = b64url(JSON.stringify(payload));
  const sig = b64url(crypto.createHmac('sha256', SECRET).update(head).digest());
  return `${head}.${sig}`;
}

/** Verify a session token. Returns the payload on success, null on failure. */
export function verifySession(token: string | undefined | null): SessionPayload | null {
  if (!token || typeof token !== 'string') return null;
  const [head, sig] = token.split('.');
  if (!head || !sig) return null;
  const expected = b64url(crypto.createHmac('sha256', SECRET).update(head).digest());
  // Constant-time comparison to dodge timing attacks.
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(b64urlDecode(head).toString('utf8')) as SessionPayload;
    if (!payload || typeof payload.userId !== 'number' || !payload.role) return null;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

/* ──────────────────────────  Password hashing  ─────────────────────────── */

/** scrypt → "scrypt$<saltHex>$<hashHex>" — re-implementable without bcrypt. */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPassword(password: string, stored: string | null | undefined): boolean {
  if (!stored) return false;
  const parts = stored.split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  try {
    const salt = Buffer.from(parts[1], 'hex');
    const expected = Buffer.from(parts[2], 'hex');
    const actual = crypto.scryptSync(password, salt, expected.length);
    return crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}
