/**
 * AGL Ops auth router — local credential login, no external SDK.
 *
 * Issues an HMAC-signed session cookie (`agl_session`) that
 * `_core/context.ts` reads on every tRPC request to populate `ctx.user`.
 * Passwords are scrypt-hashed in the users.passwordHash column.
 */
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { router, publicProcedure, protectedProcedure, adminProcedure } from '../_core/trpc';
import { getDb } from '../db';
import { users } from '../../drizzle/schema';
import { canEditLedgers } from '../_core/ledgerAccess';
import { recordAudit } from '../audit';
import {
  SESSION_COOKIE,
  signSession,
  verifySession,
  hashPassword,
  verifyPassword,
} from '../_core/session';

const SESSION_MAX_AGE_MS = 60 * 60 * 24 * 7 * 1000; // 7 days

/** Build a fresh cookie string. */
function buildSessionCookie(token: string, secure: boolean): string {
  const attrs = [
    `${SESSION_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.floor(SESSION_MAX_AGE_MS / 1000)}`,
  ];
  if (secure) attrs.push('Secure');
  return attrs.join('; ');
}
function buildClearCookie(): string {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

/** Read the `agl_session` cookie from a request's Cookie header. */
export function readSessionFromReq(req: { headers?: Record<string, string | string[] | undefined> }): { userId: number; role: string } | null {
  const raw = req.headers?.cookie;
  if (!raw || Array.isArray(raw)) return null;
  const match = String(raw).split(/;\s*/).find((p) => p.startsWith(`${SESSION_COOKIE}=`));
  if (!match) return null;
  const token = match.slice(SESSION_COOKIE.length + 1);
  const payload = verifySession(token);
  if (!payload) return null;
  return { userId: payload.userId, role: payload.role };
}

export const authRouter = router({
  /** Current user. Returns `{ user: null }` when not signed in. */
  me: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user) return { user: null };
    return {
      user: {
        id: ctx.user.id,
        openId: ctx.user.openId,
        name: ctx.user.name,
        email: ctx.user.email,
        role: ctx.user.role,
        canEditLedgers: await canEditLedgers(ctx.user),
      },
    };
  }),

  /** Resolve the tenant for the signed-in user. Stub returns 1 for now
   *  since the demo build is single-tenant; full multi-tenant lookup
   *  belongs in a real user_tenant join. */
  myTenant: publicProcedure.query(async ({ ctx }) => {
    if (!ctx.user) return { tenantId: null as number | null };
    return { tenantId: 1 as number | null };
  }),

  /** Authenticate against the users table, set a signed session cookie. */
  login: publicProcedure
    .input(z.object({ email: z.string().email(), password: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database unavailable.' });
      const [user] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
      if (!user || !verifyPassword(input.password, user.passwordHash)) {
        recordAudit({
          userId: null,
          userName: null,
          action: 'auth.login',
          category: 'auth',
          ip: ctx.req?.ip ?? null,
          meta: { outcome: 'failure', email: input.email },
        });
        // Same message for both cases so the caller can't enumerate accounts.
        throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Email or password is incorrect.' });
      }
      const signedInAt = new Date();
      await db.update(users).set({ lastSignedIn: signedInAt }).where(eq(users.id, user.id));
      const token = signSession(user.id, user.role);
      const secure = (ctx.req as any).secure === true || ((ctx.req as any).headers?.['x-forwarded-proto'] === 'https');
      (ctx.res as any).setHeader?.('Set-Cookie', buildSessionCookie(token, secure));
      recordAudit({
        userId: user.openId,
        userName: user.name,
        action: 'auth.login',
        category: 'auth',
        ip: ctx.req?.ip ?? null,
        meta: { outcome: 'success', email: user.email, role: user.role },
      });
      return {
        success: true as const,
        user: { id: user.id, name: user.name, email: user.email, role: user.role },
      };
    }),

  /** Create a user. First-ever account is promoted to admin. */
  register: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string().min(8),
      name: z.string().max(120).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database unavailable.' });
      const [existing] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
      if (existing) throw new TRPCError({ code: 'CONFLICT', message: 'An account with that email already exists.' });

      const count = await db.select({ id: users.id }).from(users);
      const role: 'admin' | 'user' = count.length === 0 ? 'admin' : 'user';
      const passwordHash = hashPassword(input.password);
      const openId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      await db.insert(users).values({
        openId,
        name: input.name ?? null,
        email: input.email,
        loginMethod: 'local',
        role,
        passwordHash,
        lastSignedIn: new Date(),
      });
      const [created] = await db.select().from(users).where(eq(users.email, input.email)).limit(1);
      if (!created) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Account created but could not be read back.' });

      const token = signSession(created.id, created.role);
      const secure = (ctx.req as any).secure === true || ((ctx.req as any).headers?.['x-forwarded-proto'] === 'https');
      (ctx.res as any).setHeader?.('Set-Cookie', buildSessionCookie(token, secure));
      recordAudit({
        userId: created.openId,
        userName: created.name,
        action: 'auth.register',
        category: 'auth',
        ip: ctx.req?.ip ?? null,
        meta: { outcome: 'success', email: created.email, role: created.role },
      });
      return {
        success: true as const,
        user: { id: created.id, name: created.name, email: created.email, role: created.role },
      };
    }),

  /** Clear the session cookie. */
  logout: publicProcedure.mutation(async ({ ctx }) => {
    recordAudit({
      userId: ctx.user?.openId ?? null,
      userName: ctx.user?.name ?? null,
      action: 'auth.logout',
      category: 'auth',
      ip: ctx.req?.ip ?? null,
      meta: { outcome: 'success', email: ctx.user?.email ?? null },
    });
    (ctx.res as any).setHeader?.('Set-Cookie', buildClearCookie());
    return { success: true as const };
  }),

  /** Smoke test for the protected procedure pipeline. */
  whoami: protectedProcedure.query(async ({ ctx }) => {
    return { user: ctx.user };
  }),

  deleteUser: adminProcedure
    .input(z.object({ userId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database unavailable.' });

      if (ctx.user.id === input.userId) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: "You can't delete your own account." });
      }

      const [target] = await db.select().from(users).where(eq(users.id, input.userId)).limit(1);
      if (!target) return { success: true as const };

      if (target.role === 'admin') {
        const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, 'admin'));
        if (admins.length <= 1) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'The final admin account cannot be deleted.' });
        }
      }

      await db.delete(users).where(eq(users.id, input.userId));
      recordAudit({
        userId: ctx.user.openId,
        userName: ctx.user.name,
        action: 'auth.deleteUser',
        category: 'auth',
        ip: ctx.req?.ip ?? null,
        meta: {
          outcome: 'success',
          targetId: target.id,
          targetEmail: target.email,
          targetName: target.name,
          targetRole: target.role,
        },
      });
      return { success: true as const };
    }),
});
