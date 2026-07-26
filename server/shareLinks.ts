/**
 * Shareable read-only dashboard links.
 * In-memory store of tokens with optional expiry + scope.
 */
import { randomBytes } from "crypto";

export type ShareScope = "dashboard" | "kpi" | "reports";

export interface ShareLink {
  token: string;
  scope: ShareScope;
  createdAt: Date;
  expiresAt: Date | null;
  createdBy: string | null;
  label?: string;
}

const links = new Map<string, ShareLink>();

export function createShareLink(opts: {
  scope: ShareScope;
  ttlMs?: number; // null/undefined = never expires
  createdBy?: string | null;
  label?: string;
}): ShareLink {
  const token = randomBytes(16).toString("hex");
  const now = new Date();
  const link: ShareLink = {
    token,
    scope: opts.scope,
    createdAt: now,
    expiresAt: opts.ttlMs ? new Date(now.getTime() + opts.ttlMs) : null,
    createdBy: opts.createdBy ?? null,
    label: opts.label,
  };
  links.set(token, link);
  return link;
}

export function verifyShareLink(token: string): ShareLink | null {
  const link = links.get(token);
  if (!link) return null;
  if (link.expiresAt && link.expiresAt.getTime() < Date.now()) {
    links.delete(token);
    return null;
  }
  return link;
}

export function listShareLinks(): ShareLink[] {
  // sweep expired
  links.forEach((l, t) => {
    if (l.expiresAt && l.expiresAt.getTime() < Date.now()) links.delete(t);
  });
  return Array.from(links.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}

export function revokeShareLink(token: string): boolean {
  return links.delete(token);
}
