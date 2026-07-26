import { TRPCError } from "@trpc/server";
import { NOT_ADMIN_ERR_MSG } from "@shared/const";
import { protectedProcedure, t } from "./trpc";
import { tenantMiddleware } from "../middleware/tenant";
import { requireTier } from "../middleware/feature-gate";

export const tenantProcedure = protectedProcedure.use(tenantMiddleware);

export const tenantAdminProcedure = tenantProcedure.use(
  t.middleware(async ({ ctx, next }) => {
    if (!ctx.user || ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }
    return next({ ctx });
  }),
);

export const starterProcedure = tenantProcedure.use(requireTier("starter"));
export const proProcedure = tenantProcedure.use(requireTier("pro"));
export const enterpriseProcedure = tenantProcedure.use(requireTier("enterprise"));
