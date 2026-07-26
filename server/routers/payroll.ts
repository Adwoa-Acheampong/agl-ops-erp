import { z } from 'zod';
import { and, eq, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { router } from '../_core/trpc';
import { tenantProcedure } from '../_core/procedures';
import { canEditLedgers } from '../_core/ledgerAccess';
import { buildAccessRoleByEmail, isAttendanceReportingRole, isAttendanceReportingStaffWithAccess } from '../_core/staffAttendanceEligibility';
import { db } from '../db';
import { payrollRuns, staff, staffAttendance, staffAttendanceLogs } from '../../drizzle/schema';

const PAYROLL_WORKING_DAYS = 26;
const LATE_PENALTY_GHS = 10;
const MISSED_PUNCH_PENALTY_GHS = 5;
const OVERTIME_MULTIPLIER = 1.5;

const payrollInput = z.object({
  year: z.number().int(),
  month: z.number().int().min(1).max(12),
});

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function normName(value: unknown): string {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
}

function money(n: number): number {
  return Number((Number.isFinite(n) ? n : 0).toFixed(2));
}

function parseHour(value: unknown): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(value ?? '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  if (h === 0 && min === 0) return null;
  return h + min / 60;
}

function nameTokens(value: unknown): string[] {
  return normName(value).split(' ').filter((t) => t.length > 1);
}

function nameMatchScore(a: unknown, b: unknown): number {
  const na = normName(a);
  const nb = normName(b);
  if (!na || !nb) return 0;
  if (na === nb) return 100;
  const at = nameTokens(na);
  const bt = nameTokens(nb);
  if (!at.length || !bt.length) return 0;
  const overlap = at.filter((t) => bt.includes(t)).length;
  if (!overlap) return 0;
  if (overlap === Math.min(at.length, bt.length)) return 80 + overlap;
  return overlap * 10;
}

function findMemberForAttendanceName(members: any[], staffName: unknown) {
  let best: any = null;
  let bestScore = 0;
  for (const member of members) {
    const score = nameMatchScore(staffName, member.name);
    if (score > bestScore) {
      best = member;
      bestScore = score;
    }
  }
  return bestScore > 0 ? best : null;
}

function hoursPerDay(member: any): number {
  const start = parseHour(member.workStart);
  const end = parseHour(member.workEnd);
  if (start != null && end != null) {
    const span = end - start;
    if (span > 0 && span <= 16) return span;
  }
  return 10;
}

function isExcused(notes: unknown): boolean {
  return /\b(holiday|pto|sick|sickday|sick day)\b/i.test(String(notes ?? ''));
}

function monthBounds(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { start, end, startYmd: ymd(start), endYmd: ymd(new Date(end.getTime() - 1)) };
}

async function requirePayrollEditor(user: any, tenantId: number) {
  if (!(await canEditLedgers(user, tenantId))) {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Manager, owner, or principal account required.' });
  }
}

async function computeMonthlyPayroll(tenantId: number, input: z.infer<typeof payrollInput>) {
  const { start, end, startYmd, endYmd } = monthBounds(input.year, input.month);

  const allMembers = await db
    .select()
    .from(staff)
    .where(and(eq(staff.tenantId, tenantId), eq(staff.status, 'active')))
    .orderBy(staff.name);
  const accessRoleByEmail = await buildAccessRoleByEmail();
  const members = (allMembers as any[]).filter((member) =>
    isAttendanceReportingStaffWithAccess(member, accessRoleByEmail)
  );

  const memberById = new Map(members.map((m: any) => [m.id, m]));
  const importedRows = await db
    .select()
    .from(staffAttendance)
    .where(and(
      sql`${staffAttendance.clockInDate} >= ${startYmd}`,
      sql`${staffAttendance.clockInDate} <= ${endYmd}`,
    ));
  const imported = (importedRows as any[]).filter((row) => isAttendanceReportingRole(row.role));

  const liveLogs = await db
    .select()
    .from(staffAttendanceLogs)
    .where(and(
      sql`${staffAttendanceLogs.clockInTime} >= ${start}`,
      sql`${staffAttendanceLogs.clockInTime} < ${end}`,
    ));
  const eligibleLiveLogs = (liveLogs as any[]).filter((row) => memberById.has(row.staffId));

  const rowsByStaff = new Map<number, any[]>();
  for (const m of members as any[]) rowsByStaff.set(m.id, []);

  let matchedImportedRows = 0;
  let unmatchedImportedRows = 0;
  for (const row of imported as any[]) {
    const member = findMemberForAttendanceName(members as any[], row.staffName);
    if (member) {
      matchedImportedRows += 1;
      rowsByStaff.get(member.id)?.push({ kind: 'imported', row });
    } else {
      unmatchedImportedRows += 1;
    }
  }

  for (const row of eligibleLiveLogs) {
    if (memberById.has(row.staffId)) rowsByStaff.get(row.staffId)?.push({ kind: 'live', row });
  }

  const breakdowns = (members as any[]).map((member) => {
    const baseMonthlyNet = Number(member.baseMonthlyNet ?? 0);
    const standardHoursPerDay = hoursPerDay(member);
    const hourlyRate = member.hourlyRate
      ? Number(member.hourlyRate)
      : (baseMonthlyNet > 0 ? baseMonthlyNet / (PAYROLL_WORKING_DAYS * standardHoursPerDay) : 0);

    let regularHours = 0;
    let overtimeHours = 0;
    let lateCount = 0;
    let missedPunchCount = 0;
    let excusedAbsences = 0;

    for (const item of rowsByStaff.get(member.id) ?? []) {
      const row: any = item.row;
      if (item.kind === 'imported') {
        const excused = isExcused(row.notes);
        if (excused) {
          excusedAbsences += 1;
          continue;
        }

        const clockIn = parseHour(row.clockInTime);
        const clockOut = parseHour(row.clockOutTime);
        if (clockIn == null) missedPunchCount += 1;
        if (clockOut == null) missedPunchCount += 1;
        if (row.isLate && clockIn != null) lateCount += 1;
        if (row.hoursWorked != null) {
          regularHours += Number(row.hoursWorked) || 0;
        }
        if (clockIn != null && clockOut != null) {
          const expectedEnd = parseHour(member.workEnd) ?? 18;
          overtimeHours += Math.max(0, clockOut - expectedEnd);
        }
      } else {
        if (!row.clockInTime || !row.clockOutTime) {
          missedPunchCount += 1;
          continue;
        }
        const ci = new Date(row.clockInTime);
        const co = new Date(row.clockOutTime);
        const startOfDay = new Date(ci);
        startOfDay.setUTCHours(8, 0, 0, 0);
        if (ci.getTime() > startOfDay.getTime()) lateCount += 1;

        const endOfRegular = new Date(ci);
        endOfRegular.setUTCHours(18, 0, 0, 0);
        const regularEnd = co < endOfRegular ? co : endOfRegular;
        regularHours += Math.max(0, regularEnd.getTime() - ci.getTime()) / 3_600_000;
        overtimeHours += Math.max(0, co.getTime() - endOfRegular.getTime()) / 3_600_000;
      }
    }

    const latePenalty = lateCount * LATE_PENALTY_GHS;
    const noClockOutPenalty = missedPunchCount * MISSED_PUNCH_PENALTY_GHS;
    const overtimePay = overtimeHours * hourlyRate * OVERTIME_MULTIPLIER;
    const bonusShare = 0;
    const recallPenaltyShare = 0;
    const netPay = baseMonthlyNet + bonusShare + overtimePay - latePenalty - noClockOutPenalty - recallPenaltyShare;

    return {
      staffId: member.id,
      staffName: member.name,
      role: member.role,
      baseMonthlyNet: money(baseMonthlyNet),
      hourlyRate: money(hourlyRate),
      regularHours: money(regularHours),
      overtimeHours: money(overtimeHours),
      lateCount,
      missedPunchCount,
      excusedAbsences,
      bonusShare: money(bonusShare),
      overtimePay: money(overtimePay),
      latePenalty: money(latePenalty),
      noClockOutPenalty: money(noClockOutPenalty),
      recallPenaltyShare: money(recallPenaltyShare),
      netPay: money(netPay),
    };
  });

  const mechanicCount = breakdowns.filter((b) => String(b.role).toLowerCase().includes('mechanic')).length;
  const summary = {
    year: input.year,
    month: input.month,
    staffCount: breakdowns.length,
    standardHoursPerDay: 10,
    servicePoolGHS: 0,
    mechanicCount,
    importedAttendanceRows: imported.length,
    matchedImportedRows,
    unmatchedImportedRows,
    liveAttendanceRows: eligibleLiveLogs.length,
    excusedAbsences: breakdowns.reduce((s, b) => s + b.excusedAbsences, 0),
  };

  return { success: true as const, summary, breakdowns };
}

export const payrollRouter = router({
  computeMonthly: tenantProcedure.input(payrollInput).query(async ({ ctx, input }) => {
    try {
      return await computeMonthlyPayroll(ctx.tenantId, input);
    } catch (error) {
      return { success: false as const, error: (error as Error).message, breakdowns: [] };
    }
  }),

  listRuns: tenantProcedure
    .input(z.object({ year: z.number().int().optional() }).optional())
    .query(async ({ ctx, input }) => {
      try {
        const rows = await db.select().from(payrollRuns).where(
          input?.year
            ? and(eq(payrollRuns.tenantId, ctx.tenantId), eq(payrollRuns.year, input.year))
            : eq(payrollRuns.tenantId, ctx.tenantId),
        );
        return { success: true as const, runs: rows };
      } catch (error) {
        return { success: false as const, error: (error as Error).message, runs: [] };
      }
    }),

  finalizeMonthly: tenantProcedure.input(payrollInput).mutation(async ({ ctx, input }) => {
    await requirePayrollEditor(ctx.user, ctx.tenantId);
    const computed = await computeMonthlyPayroll(ctx.tenantId, input);
    await db.delete(payrollRuns).where(and(
      eq(payrollRuns.tenantId, ctx.tenantId),
      eq(payrollRuns.year, input.year),
      eq(payrollRuns.month, input.month),
    ));
    if (computed.breakdowns.length) {
      await db.insert(payrollRuns).values(computed.breakdowns.map((b) => ({
        tenantId: ctx.tenantId,
        staffId: b.staffId,
        year: input.year,
        month: input.month,
        baseMonthlyNet: String(b.baseMonthlyNet),
        bonusShare: String(b.bonusShare),
        overtimePay: String(b.overtimePay),
        latePenalty: String(b.latePenalty),
        noClockOutPenalty: String(b.noClockOutPenalty),
        recallPenaltyShare: String(b.recallPenaltyShare),
        netPay: String(b.netPay),
        finalizedBy: ctx.user?.email ?? ctx.user?.name ?? String(ctx.user?.id ?? ''),
      })));
    }
    return { success: true as const, count: computed.breakdowns.length };
  }),
});
