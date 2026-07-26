import { describe, it, expect, beforeEach } from "vitest";
import { recordAudit, getAudit, clearAudit } from "./audit";

describe("audit log", () => {
  beforeEach(() => clearAudit());

  it("records and retrieves entries newest-first", () => {
    recordAudit({ userId: "u1", userName: "Alice", action: "sales.create", category: "mutation" });
    recordAudit({ userId: "u2", userName: "Bob", action: "expenses.create", category: "mutation" });
    const log = getAudit();
    expect(log.length).toBe(2);
    expect(log[0].action).toBe("expenses.create");
  });

  it("respects max entries cap", () => {
    for (let i = 0; i < 600; i++) {
      recordAudit({ userId: "u", userName: "x", action: `op-${i}`, category: "mutation" });
    }
    expect(getAudit(500).length).toBe(500);
  });

  it("limit param controls returned size", () => {
    for (let i = 0; i < 10; i++) {
      recordAudit({ userId: null, userName: null, action: `op-${i}`, category: "mutation" });
    }
    expect(getAudit(3).length).toBe(3);
  });
});
