/**
 * In-process report scheduler.
 * Stores schedules in memory and runs them on a fixed interval tick (1 min).
 * Each run "delivers" the report to a recipient (logged + retained as last run).
 *
 * For real email, swap deliverReport() to call an SMTP / SendGrid / SES client.
 */

import { syncAllSheetData } from "./googleSheets";
import {
  generateDailyCEOReport,
  generateWeeklyManagementReport,
  generateMonthlyFinancialReport,
  generateFullOperationsReport,
  exportReportAsText,
} from "./reports";
import { recordAudit } from "./audit";

export type ReportType = "daily-ceo" | "weekly-management" | "monthly-financial" | "full-operations";
export type Frequency = "hourly" | "daily" | "weekly" | "monthly";

export interface ReportSchedule {
  id: string;
  reportType: ReportType;
  frequency: Frequency;
  recipientEmail: string;
  hourOfDay: number; // 0-23
  enabled: boolean;
  createdAt: Date;
  lastRunAt: Date | null;
  lastRunStatus: "ok" | "error" | null;
  lastRunMessage: string | null;
  nextRunAt: Date;
}

const schedules = new Map<string, ReportSchedule>();
let tickTimer: NodeJS.Timeout | null = null;

function uid() {
  return `sch_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function computeNextRun(frequency: Frequency, hourOfDay: number, from = new Date()): Date {
  const next = new Date(from);
  next.setSeconds(0, 0);
  switch (frequency) {
    case "hourly":
      next.setMinutes(0);
      next.setHours(next.getHours() + 1);
      break;
    case "daily":
      next.setHours(hourOfDay, 0, 0, 0);
      if (next <= from) next.setDate(next.getDate() + 1);
      break;
    case "weekly":
      next.setHours(hourOfDay, 0, 0, 0);
      // Run on Mondays
      const day = next.getDay();
      const delta = (8 - day) % 7 || 7;
      next.setDate(next.getDate() + delta);
      break;
    case "monthly":
      next.setHours(hourOfDay, 0, 0, 0);
      next.setMonth(next.getMonth() + 1, 1);
      break;
  }
  return next;
}

export function listSchedules(): ReportSchedule[] {
  return Array.from(schedules.values()).sort(
    (a, b) => a.nextRunAt.getTime() - b.nextRunAt.getTime(),
  );
}

export function createSchedule(opts: {
  reportType: ReportType;
  frequency: Frequency;
  recipientEmail: string;
  hourOfDay?: number;
}): ReportSchedule {
  const id = uid();
  const hourOfDay = opts.hourOfDay ?? 8;
  const sch: ReportSchedule = {
    id,
    reportType: opts.reportType,
    frequency: opts.frequency,
    recipientEmail: opts.recipientEmail,
    hourOfDay,
    enabled: true,
    createdAt: new Date(),
    lastRunAt: null,
    lastRunStatus: null,
    lastRunMessage: null,
    nextRunAt: computeNextRun(opts.frequency, hourOfDay),
  };
  schedules.set(id, sch);
  return sch;
}

export function deleteSchedule(id: string): boolean {
  return schedules.delete(id);
}

export function setEnabled(id: string, enabled: boolean): ReportSchedule | null {
  const s = schedules.get(id);
  if (!s) return null;
  s.enabled = enabled;
  return s;
}

async function deliverReport(sch: ReportSchedule): Promise<void> {
  const data = await syncAllSheetData();
  let report: any;
  switch (sch.reportType) {
    case "daily-ceo":
      report = generateDailyCEOReport(data);
      break;
    case "weekly-management":
      report = generateWeeklyManagementReport(data);
      break;
    case "monthly-financial":
      report = generateMonthlyFinancialReport(data);
      break;
    case "full-operations":
      report = generateFullOperationsReport(data);
      break;
  }
  const body = exportReportAsText(report);
  // TODO: replace with real email transport
  console.log(`[scheduler] Delivering ${sch.reportType} to ${sch.recipientEmail}`);
  console.log(body.slice(0, 400));
  recordAudit({
    userId: null,
    userName: "scheduler",
    action: `report.deliver.${sch.reportType}`,
    category: "mutation",
    meta: { recipient: sch.recipientEmail, scheduleId: sch.id },
  });
}

export async function runScheduleNow(id: string): Promise<ReportSchedule | null> {
  const s = schedules.get(id);
  if (!s) return null;
  try {
    await deliverReport(s);
    s.lastRunAt = new Date();
    s.lastRunStatus = "ok";
    s.lastRunMessage = "Delivered";
  } catch (e) {
    s.lastRunAt = new Date();
    s.lastRunStatus = "error";
    s.lastRunMessage = (e as Error).message;
  }
  s.nextRunAt = computeNextRun(s.frequency, s.hourOfDay);
  return s;
}

async function tick() {
  const now = Date.now();
  for (const s of Array.from(schedules.values())) {
    if (!s.enabled) continue;
    if (s.nextRunAt.getTime() <= now) {
      await runScheduleNow(s.id);
    }
  }
}

export function startScheduler() {
  if (tickTimer) return;
  tickTimer = setInterval(() => {
    tick().catch((e) => console.error("[scheduler] tick failed:", e));
  }, 60_000);
  console.log("[scheduler] started (1 min tick)");
}

export function stopScheduler() {
  if (tickTimer) {
    clearInterval(tickTimer);
    tickTimer = null;
  }
}

// Test helpers
export function _resetSchedules() {
  schedules.clear();
}
export { computeNextRun };
