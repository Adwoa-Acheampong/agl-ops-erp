import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";
import { recordAudit } from "../audit";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export { t };

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    try {
      recordAudit({
        userId: null,
        userName: null,
        action: opts.path,
        category: "access",
        ip: ctx.req?.ip ?? null,
        meta: { outcome: "denied", reason: "unauthenticated", type: opts.type },
      });
    } catch {
      /* never fail a request because of audit */
    }
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

const auditMutations = t.middleware(async (opts) => {
  const startedAt = Date.now();
  const result = await opts.next();
  if (opts.type === "mutation") {
    try {
      const ok = (result as any).ok !== false;
      recordAudit({
        userId: (opts.ctx as TrpcContext).user?.openId ?? null,
        userName: (opts.ctx as TrpcContext).user?.name ?? null,
        action: opts.path,
        category: "mutation",
        ip: (opts.ctx as TrpcContext).req?.ip ?? null,
        meta: {
          outcome: ok ? "success" : "failure",
          durationMs: Date.now() - startedAt,
          error: ok ? undefined : ((result as any).error?.message ?? "Procedure failed"),
        },
      });
    } catch {
      /* never fail a request because of audit */
    }
  }
  return result;
});

export const protectedProcedure = t.procedure.use(requireUser).use(auditMutations);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    if (!ctx.user || ctx.user.role !== 'admin') {
      try {
        recordAudit({
          userId: ctx.user?.openId ?? null,
          userName: ctx.user?.name ?? null,
          action: opts.path,
          category: "access",
          ip: ctx.req?.ip ?? null,
          meta: { outcome: "denied", reason: "admin_required", type: opts.type },
        });
      } catch {
        /* never fail a request because of audit */
      }
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    const startedAt = Date.now();
    const result = await next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
    if (opts.type === "mutation") {
      try {
        const ok = (result as any).ok !== false;
        recordAudit({
          userId: ctx.user.openId ?? null,
          userName: ctx.user.name ?? null,
          action: opts.path,
          category: "mutation",
          ip: ctx.req?.ip ?? null,
          meta: {
            outcome: ok ? "success" : "failure",
            durationMs: Date.now() - startedAt,
            adminOnly: true,
            error: ok ? undefined : ((result as any).error?.message ?? "Procedure failed"),
          },
        });
      } catch {
        /* never fail a request because of audit */
      }
    }
    return result;
  }),
);
