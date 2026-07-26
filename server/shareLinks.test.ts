import { describe, it, expect } from "vitest";
import {
  createShareLink,
  verifyShareLink,
  listShareLinks,
  revokeShareLink,
} from "./shareLinks";

describe("share links", () => {
  it("creates and verifies a token", () => {
    const link = createShareLink({ scope: "dashboard" });
    expect(link.token).toMatch(/^[a-f0-9]{32}$/);
    expect(verifyShareLink(link.token)?.scope).toBe("dashboard");
  });

  it("expires after ttl", async () => {
    const link = createShareLink({ scope: "kpi", ttlMs: 5 });
    await new Promise((r) => setTimeout(r, 15));
    expect(verifyShareLink(link.token)).toBeNull();
  });

  it("revoke removes the link", () => {
    const link = createShareLink({ scope: "reports" });
    expect(revokeShareLink(link.token)).toBe(true);
    expect(verifyShareLink(link.token)).toBeNull();
  });

  it("list returns active links", () => {
    createShareLink({ scope: "dashboard", label: "demo" });
    const all = listShareLinks();
    expect(all.length).toBeGreaterThan(0);
  });
});
