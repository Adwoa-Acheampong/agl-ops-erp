import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { eq } from "drizzle-orm";
import type { User } from "../../drizzle/schema";
import { users } from "../../drizzle/schema";
import { sdk } from "./sdk";
import { readSessionFromReq } from "../routers/auth";
import { getDb } from "../db";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  let user: User | null = null;

  // 1. Try the AGL signed session cookie first (local credential auth).
  try {
    const session = readSessionFromReq(opts.req);
    if (session) {
      const db = await getDb();
      if (db) {
        const [row] = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
        if (row) user = row;
      }
    }
  } catch {
    // ignore — fall through to the SDK path
  }

  // 2. Fallback: the original Manuscript SDK path (kept for compatibility
  //    with deployments that still use it).
  if (!user) {
    try {
      user = await sdk.authenticateRequest(opts.req);
    } catch {
      user = null;
    }
  }

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
