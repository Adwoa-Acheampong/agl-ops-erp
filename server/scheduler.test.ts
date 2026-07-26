import { describe, it, expect, beforeEach } from "vitest";
import {
  createSchedule,
  listSchedules,
  deleteSchedule,
  setEnabled,
  computeNextRun,
  _resetSchedules,
} from "./scheduler";

describe("scheduler", () => {
  beforeEach(() => _resetSchedules());

  it("creates and lists schedules", () => {
    const s = createSchedule({
      reportType: "daily-ceo",
      frequency: "daily",
      recipientEmail: "ceo@agl.com",
      hourOfDay: 8,
    });
    expect(s.id).toMatch(/^sch_/);
    expect(listSchedules().length).toBe(1);
    expect(listSchedules()[0].nextRunAt).toBeInstanceOf(Date);
  });

  it("delete removes a schedule", () => {
    const s = createSchedule({
      reportType: "weekly-management",
      frequency: "weekly",
      recipientEmail: "ops@agl.com",
    });
    expect(deleteSchedule(s.id)).toBe(true);
    expect(listSchedules().length).toBe(0);
  });

  it("setEnabled toggles", () => {
    const s = createSchedule({
      reportType: "monthly-financial",
      frequency: "monthly",
      recipientEmail: "cfo@agl.com",
    });
    setEnabled(s.id, false);
    expect(listSchedules()[0].enabled).toBe(false);
  });

  it("computeNextRun for daily picks future hour", () => {
    const from = new Date("2026-04-07T10:00:00");
    const next = computeNextRun("daily", 8, from);
    expect(next.getDate()).toBe(8); // next day
    expect(next.getHours()).toBe(8);
  });

  it("computeNextRun for hourly advances 1 hour", () => {
    const from = new Date("2026-04-07T10:30:00");
    const next = computeNextRun("hourly", 0, from);
    expect(next.getHours()).toBe(11);
    expect(next.getMinutes()).toBe(0);
  });
});
