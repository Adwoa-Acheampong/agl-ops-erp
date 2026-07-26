import { z } from 'zod';
import * as crypto from 'node:crypto';
import { and, desc, eq, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { router } from '../_core/trpc';
import { tenantProcedure } from '../_core/procedures';
import { isAttendanceReportingStaff } from '../_core/staffAttendanceEligibility';
import { db } from '../db';
import {
  serviceAppointments,
  staff,
  staffAttendance,
  staffPerformance,
  staffTraining,
  tasks,
} from '../../drizzle/schema';

const TZ = 'Africa/Accra';
const CLOCK_IN_OPEN_MINUTES = 7 * 60 + 30;
const CLOCK_OUT_OPEN_MINUTES = 18 * 60;
const PAYROLL_WORKING_DAYS = 26;
const LATE_PENALTY_GHS = 10;
const MISSED_PUNCH_PENALTY_GHS = 5;
const OVERTIME_MULTIPLIER = 1.5;
const QR_STEP_SECONDS = 30;
const QR_ALLOWED_DRIFT_BLOCKS = 1;
const DEFAULT_QR_SITE = 'main-workshop';
const STAFF_QR_SECRET =
  process.env.STAFF_QR_SECRET ||
  process.env.SESSION_SECRET ||
  process.env.JWT_SECRET ||
  'agl-ops-dev-staff-qr-secret-change-me';

const clockQrSchema = z.object({
  qrToken: z.string().min(20),
  site: z.string().optional(),
  deviceFingerprint: z.string().optional(),
  locationGPS: z.string().optional(),
});

function localNow(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  const ymd = `${get('year')}-${get('month')}-${get('day')}`;
  const hm = `${get('hour')}:${get('minute')}`;
  const minutes = Number(get('hour')) * 60 + Number(get('minute'));
  return { ymd, hm, minutes };
}

function dateFromYmd(ymd: string) {
  return new Date(`${ymd}T12:00:00.000Z`);
}

function dateOnly(value: unknown): string {
  if (!value) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const raw = String(value);
  const iso = raw.match(/^\d{4}-\d{2}-\d{2}/);
  if (iso) return iso[0];
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw.slice(0, 10) : parsed.toISOString().slice(0, 10);
}

function parseClock(value: unknown): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(value ?? '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  if (h === 0 && min === 0) return null;
  return h + min / 60;
}

function money(n: number) {
  return Number((Number.isFinite(n) ? n : 0).toFixed(2));
}

function normName(value: unknown) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function nameTokens(value: unknown) {
  return normName(value).split(' ').filter((t) => t.length > 1);
}

function sameStaffName(a: unknown, b: unknown): boolean {
  const na = normName(a);
  const nb = normName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const at = nameTokens(na);
  const bt = nameTokens(nb);
  return at.length > 0 && bt.length > 0 && (at.every((t) => bt.includes(t)) || bt.every((t) => at.includes(t)));
}

function isExcused(notes: unknown): boolean {
  return /\b(holiday|pto|sick|sickday|sick day)\b/i.test(String(notes ?? ''));
}

function expectedWorkDates(fromYmd: string, toYmd: string) {
  const out: string[] = [];
  const d = dateFromYmd(fromYmd);
  const end = dateFromYmd(toYmd);
  while (d <= end) {
    if (d.getUTCDay() !== 0) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

function monthBoundsForToday(todayYmd: string) {
  const [year, month] = todayYmd.split('-').map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return {
    year,
    month,
    startYmd: start.toISOString().slice(0, 10),
    endYmd: new Date(end.getTime() - 1).toISOString().slice(0, 10),
  };
}

function hoursPerDay(member: any) {
  const start = parseClock(member.workStart);
  const end = parseClock(member.workEnd);
  if (start != null && end != null) {
    const span = end - start;
    if (span > 0 && span <= 16) return span;
  }
  return 10;
}

function portalExternalId(staffId: number, ymd: string) {
  return `staff-portal-${staffId}-${ymd}`;
}

function cleanSite(value: unknown) {
  return String(value ?? DEFAULT_QR_SITE)
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48) || DEFAULT_QR_SITE;
}

function qrBlock(date = new Date()) {
  return Math.floor(date.getTime() / 1000 / QR_STEP_SECONDS);
}

function signQrBlock(tenantId: number, site: string, block: number) {
  const payload = `${tenantId}:${cleanSite(site)}:${block}`;
  return crypto.createHmac('sha256', STAFF_QR_SECRET).update(payload).digest('base64url');
}

function makeQrToken(tenantId: number, site: string, block = qrBlock()) {
  return `${block}.${signQrBlock(tenantId, site, block)}`;
}

function qrPayload(site: string, token: string) {
  return `agl-clock://scan?site=${encodeURIComponent(cleanSite(site))}&t=${encodeURIComponent(token)}`;
}

function verifyQrToken(tenantId: number, rawSite: unknown, rawToken: unknown) {
  const site = cleanSite(rawSite);
  const token = String(rawToken ?? '');
  const [blockText, sig] = token.split('.');
  const block = Number(blockText);
  if (!Number.isInteger(block) || !sig) {
    return { ok: false as const, site, error: 'Invalid QR token.' };
  }
  const current = qrBlock();
  const ageBlocks = current - block;
  if (ageBlocks < 0 || ageBlocks > QR_ALLOWED_DRIFT_BLOCKS) {
    return { ok: false as const, site, error: 'QR expired. Scan the live shop QR again.' };
  }
  const expected = signQrBlock(tenantId, site, block);
  const got = Buffer.from(sig);
  const want = Buffer.from(expected);
  if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) {
    return { ok: false as const, site, error: 'QR verification failed. Scan the live shop QR again.' };
  }
  return { ok: true as const, site, block, ageBlocks };
}

function requireKioskUser(ctx: any) {
  const role = String(ctx.user?.role ?? '').toLowerCase();
  const allowed = new Set(['admin', 'owner', 'manager', 'principal', 'operations_manager']);
  if (!allowed.has(role)) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Only owner, manager, or admin accounts can display the shop clock QR.',
    });
  }
}

function qrAudit(action: 'clock-in' | 'clock-out', site: string, input: { locationGPS?: string; deviceFingerprint?: string }, existing?: unknown) {
  const parts = [
    existing ? String(existing) : '',
    `Staff portal ${action}`,
    `QR verified`,
    `site=${site}`,
  ].filter(Boolean);
  if (input.locationGPS) parts.push(`gps=${input.locationGPS}`);
  if (input.deviceFingerprint) parts.push(`device=${input.deviceFingerprint}`);
  return Array.from(new Set(parts)).join(' | ');
}

async function selfStaff(ctx: any) {
  const email = String(ctx.user?.email ?? '').trim().toLowerCase();
  if (!email) throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Your login has no email address.' });
  const [member] = await db
    .select()
    .from(staff)
    .where(and(
      eq(staff.tenantId, ctx.tenantId),
      eq(staff.status, 'active'),
      sql`LOWER(${staff.email}) = ${email}`,
    ))
    .limit(1);
  if (!member) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'No active roster profile matches this login email. Ask HR to put this email on your roster record.',
    });
  }
  if (!(await isAttendanceReportingStaff(member))) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Owner/admin accounts do not use the staff clock. Use the main ERP workspace.',
    });
  }
  return member as any;
}

async function todayAttendanceRow(member: any, ymd: string) {
  const [byExternalId] = await db
    .select()
    .from(staffAttendance)
    .where(eq(staffAttendance.externalId, portalExternalId(member.id, ymd)))
    .limit(1);
  if (byExternalId) return byExternalId as any;

  const [byNameAndDate] = await db
    .select()
    .from(staffAttendance)
    .where(and(
      sql`LOWER(${staffAttendance.staffName}) = ${String(member.name ?? '').toLowerCase()}`,
      sql`${staffAttendance.clockInDate} = ${ymd}`,
    ))
    .limit(1);
  return byNameAndDate as any | undefined;
}

async function computeSelfSummary(member: any, tenantId: number, todayYmd: string) {
  const bounds = monthBoundsForToday(todayYmd);
  const rows = await db
    .select()
    .from(staffAttendance)
    .where(and(
      sql`${staffAttendance.clockInDate} >= ${bounds.startYmd}`,
      sql`${staffAttendance.clockInDate} <= ${todayYmd}`,
    ));
  const mine = (rows as any[]).filter((row) => sameStaffName(row.staffName, member.name));
  const expected = expectedWorkDates(bounds.startYmd, todayYmd);
  const loggedDates = new Set(mine.map((row) => dateOnly(row.clockInDate)).filter(Boolean));
  const payableDates = new Set<string>();

  let regularHours = 0;
  let overtimeHours = 0;
  let lateCount = 0;
  let missedOut = 0;
  let excusedAbsences = 0;

  for (const row of mine) {
    const day = dateOnly(row.clockInDate);
    if (day) payableDates.add(day);
    if (isExcused(row.notes)) {
      excusedAbsences += 1;
      continue;
    }
    const ci = parseClock(row.clockInTime);
    const co = parseClock(row.clockOutTime);
    if ((row.isLate || (ci != null && ci > 8)) && ci != null) lateCount += 1;
    if (co == null) missedOut += 1;
    if (ci != null && co != null) {
      const expectedEnd = parseClock(member.workEnd) ?? 18;
      regularHours += Math.max(0, Math.min(co, expectedEnd) - ci);
      overtimeHours += Math.max(0, co - expectedEnd);
    } else if (row.hoursWorked != null) {
      regularHours += Number(row.hoursWorked) || 0;
    }
  }

  const unloggedDates = expected.filter((day) => !loggedDates.has(day));
  const baseMonthlyNet = Number(member.baseMonthlyNet ?? 0);
  const standardHours = hoursPerDay(member);
  const hourlyRate = member.hourlyRate
    ? Number(member.hourlyRate)
    : (baseMonthlyNet > 0 ? baseMonthlyNet / (PAYROLL_WORKING_DAYS * standardHours) : 0);
  const payableDays = Math.min(PAYROLL_WORKING_DAYS, payableDates.size);
  const baseEarned = baseMonthlyNet > 0 ? (baseMonthlyNet / PAYROLL_WORKING_DAYS) * payableDays : regularHours * hourlyRate;
  const latePenalty = lateCount * LATE_PENALTY_GHS;
  const missedOutPenalty = missedOut * MISSED_PUNCH_PENALTY_GHS;
  const overtimePay = overtimeHours * hourlyRate * OVERTIME_MULTIPLIER;
  const netPay = baseEarned + overtimePay - latePenalty - missedOutPenalty;

  const [latestPerformance] = await db
    .select()
    .from(staffPerformance)
    .where(eq(staffPerformance.staffId, member.id))
    .orderBy(desc(staffPerformance.monthStart))
    .limit(1);

  const training = await db
    .select()
    .from(staffTraining)
    .where(and(eq(staffTraining.tenantId, tenantId), eq(staffTraining.staffId, member.id)))
    .orderBy(desc(staffTraining.sessionDate))
    .limit(20);

  const assignedTasks = await db
    .select()
    .from(tasks)
    .where(and(sql`${tasks.tenantId} = ${String(tenantId)}`, eq(tasks.assignedTo, member.id)))
    .orderBy(desc(tasks.createdAt))
    .limit(20);

  return {
    period: bounds,
    attendance: {
      sessions: mine.filter((row) => !isExcused(row.notes)).length,
      payableDays,
      unloggedDays: unloggedDates.length,
      unloggedDates,
      lateCount,
      missedOut,
      excusedAbsences,
      regularHours: money(regularHours),
      overtimeHours: money(overtimeHours),
    },
    payroll: {
      baseMonthlyNet: money(baseMonthlyNet),
      baseEarned: money(baseEarned),
      hourlyRate: money(hourlyRate),
      overtimePay: money(overtimePay),
      penalties: money(latePenalty + missedOutPenalty),
      netPay: money(netPay),
    },
    performance: latestPerformance ?? null,
    training,
    tasks: assignedTasks,
  };
}

async function workshopLog(member: any, tenantId: number) {
  if (member.role !== 'workshop_supervisor') return [];
  return await db
    .select()
    .from(serviceAppointments)
    .where(sql`${serviceAppointments.tenantId} IS NULL OR ${serviceAppointments.tenantId} = ${String(tenantId)}`)
    .orderBy(desc(serviceAppointments.createdAt))
    .limit(30);
}

export const staffPortalRouter = router({
  qrChallenge: tenantProcedure
    .input(z.object({ site: z.string().optional() }).optional())
    .query(({ ctx, input }) => {
      requireKioskUser(ctx);
      const site = cleanSite(input?.site);
      const block = qrBlock();
      const token = makeQrToken(ctx.tenantId, site, block);
      const payload = qrPayload(site, token);
      const nowSeconds = Math.floor(Date.now() / 1000);
      const expiresInSeconds = QR_STEP_SECONDS - (nowSeconds % QR_STEP_SECONDS);
      return {
        site,
        block,
        token,
        payload,
        expiresInSeconds,
        stepSeconds: QR_STEP_SECONDS,
      };
    }),

  dashboard: tenantProcedure.query(async ({ ctx }) => {
    const member = await selfStaff(ctx);
    const now = localNow();
    const today = await todayAttendanceRow(member, now.ymd);
    const clockedIn = !!today?.clockInTime && !today?.clockOutTime;
    const canClockIn = now.minutes >= CLOCK_IN_OPEN_MINUTES && now.minutes < CLOCK_OUT_OPEN_MINUTES && !today?.clockInTime;
    const canClockOut = now.minutes >= CLOCK_OUT_OPEN_MINUTES && !today?.clockOutTime;
    const summary = await computeSelfSummary(member, ctx.tenantId, now.ymd);
    const supervisorLog = await workshopLog(member, ctx.tenantId);
    return {
      success: true as const,
      now,
      staff: member,
      today,
      clockedIn,
      canClockIn,
      canClockOut,
      clockWindow: {
        clockInOpens: '07:30',
        clockOutOpens: '18:00',
      },
      clockSecurity: {
        qrRequired: true,
        qrStepSeconds: QR_STEP_SECONDS,
      },
      ...summary,
      workshopLog: supervisorLog,
    };
  }),

  clockIn: tenantProcedure
    .input(clockQrSchema)
    .mutation(async ({ ctx, input }) => {
      const member = await selfStaff(ctx);
      const now = localNow();
      const qr = verifyQrToken(ctx.tenantId, input.site, input.qrToken);
      if (!qr.ok) return { success: false as const, error: qr.error };
      if (now.minutes < CLOCK_IN_OPEN_MINUTES || now.minutes >= CLOCK_OUT_OPEN_MINUTES) {
        return { success: false as const, error: 'Clock-in opens from 7:30 AM until 6:00 PM.' };
      }
      const existing = await todayAttendanceRow(member, now.ymd);
      if (existing && isExcused(existing.notes)) return { success: false as const, error: 'This day is marked as a legal absence.' };
      if (existing?.clockInTime) return { success: false as const, error: 'You have already clocked in today.' };

      const patch: any = {
        staffName: member.name,
        role: member.role,
        clockInDate: dateFromYmd(now.ymd),
        clockInTime: now.hm,
        isLate: now.hm > '08:00' ? 1 : 0,
        externalId: portalExternalId(member.id, now.ymd),
        notes: qrAudit('clock-in', qr.site, input, existing?.notes),
      };
      if (existing) {
        await db.update(staffAttendance).set(patch).where(eq(staffAttendance.id, existing.id));
      } else {
        await db.insert(staffAttendance).values({ ...patch, clockOutTime: null, hoursWorked: null, notes: 'Staff portal clock-in' });
      }
      await db.update(staff).set({ lastClockIn: new Date() }).where(eq(staff.id, member.id));
      return { success: true as const };
    }),

  clockOut: tenantProcedure.input(clockQrSchema).mutation(async ({ ctx, input }) => {
    const member = await selfStaff(ctx);
    const now = localNow();
    const qr = verifyQrToken(ctx.tenantId, input.site, input.qrToken);
    if (!qr.ok) return { success: false as const, error: qr.error };
    if (now.minutes < CLOCK_OUT_OPEN_MINUTES) {
      return { success: false as const, error: 'Clock-out opens at 6:00 PM.' };
    }
    const existing = await todayAttendanceRow(member, now.ymd);
    if (existing && isExcused(existing.notes)) return { success: false as const, error: 'This day is marked as a legal absence.' };
    if (existing?.clockOutTime) return { success: false as const, error: 'You have already clocked out today.' };

    const ci = parseClock(existing?.clockInTime);
    const co = parseClock(now.hm);
    const hoursWorked = ci != null && co != null && co > ci ? money(co - ci) : null;
    const patch: any = {
      staffName: member.name,
      role: member.role,
      clockInDate: dateFromYmd(now.ymd),
      clockOutTime: now.hm,
      hoursWorked: hoursWorked != null ? String(hoursWorked) : null,
      externalId: portalExternalId(member.id, now.ymd),
      notes: qrAudit('clock-out', qr.site, input, existing?.notes),
    };
    if (existing) {
      await db.update(staffAttendance).set(patch).where(eq(staffAttendance.id, existing.id));
    } else {
      await db.insert(staffAttendance).values({
        ...patch,
        clockInTime: null,
        isLate: 0,
        notes: 'Staff portal clock-out without clock-in',
      });
    }
    await db.update(staff).set({ lastClockOut: new Date() }).where(eq(staff.id, member.id));
    return { success: true as const };
  }),
});
