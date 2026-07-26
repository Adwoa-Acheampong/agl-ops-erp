import { z } from "zod";
import { eq, and, desc, sql } from "drizzle-orm";
import { router } from "../_core/trpc";
import { tenantProcedure } from "../_core/procedures";
import { canEditLedgers } from "../_core/ledgerAccess";
import { isAttendanceReportingRole, isAttendanceReportingStaff } from "../_core/staffAttendanceEligibility";
import { db } from "../db";
import fs from 'node:fs';
import path from 'node:path';
import { staff, staffAttendance, staffAttendanceLogs, staffDocuments, staffPerformance } from "../../drizzle/schema";

const createStaffSchema = z.object({
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  role: z.enum([
    "owner",
    "manager",
    "mechanic",
    "receptionist",
    "accountant",
    "sales_attendant",
    "sales_supervisor",
    "workshop_supervisor",
    "inventory_attendant",
  ]),
  hireDate: z.string().optional(),
  status: z.enum(["active", "suspended", "terminated"]).default("active"),
  hourlyRate: z.number().positive().optional(),
  baseMonthlyNet: z.number().nonnegative().optional(),
  salaryType: z.enum(["hourly", "salary", "monthly", "commission"]),
  // New compliance + onboarding fields requested by HR.
  ghanaCardId: z.string().optional(),
  ssnit: z.string().optional(),
  healthInsurance: z.string().optional(),
  // Daily working hours envelope (e.g. "08:00" → "18:00"). Used when
  // salaryType = monthly to auto-derive the implied hourly rate via
  // hourlyRate = baseMonthlyNet / (26 * hoursPerDay).
  workStart: z.string().optional(),
  workEnd:   z.string().optional(),
});

const clockInSchema = z.object({
  staffId: z.number().int(),
  locationGPS: z.string().optional(),
  deviceFingerprint: z.string().optional(),
});

const clockOutSchema = z.object({
  attendanceLogId: z.number().int(),
  approvedBy: z.number().int().optional(),
});

const performanceSchema = z.object({
  staffId: z.number().int(),
  monthStart: z.string(),
  monthEnd: z.string(),
  jobsCompleted: z.number().int().min(0).optional(),
  avgJobTime: z.number().optional(),
  customerRating: z.number().min(0).max(5).optional(),
  revenueGenerated: z.number().optional(),
  deductionsApplied: z.number().optional(),
});

const LEGAL_ABSENCES = ['holiday', 'pto', 'sickday'] as const;

async function requireLedgerEditor(user: any, tenantId: number) {
  if (!(await canEditLedgers(user, tenantId))) {
    throw new Error('Manager, owner, or principal account required.');
  }
}

function isLegalAbsence(notes: unknown): boolean {
  return /\b(holiday|pto|sick|sickday|sick day)\b/i.test(String(notes ?? ''));
}

function normName(value: unknown): string {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function dateOnlyYmd(value: unknown): string {
  if (!value) return '';
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const raw = String(value);
  const iso = raw.match(/^\d{4}-\d{2}-\d{2}/);
  if (iso) return iso[0];
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? raw.slice(0, 10) : parsed.toISOString().slice(0, 10);
}

function nameTokens(value: unknown): string[] {
  return normName(value).split(' ').filter((t) => t.length > 1);
}

function sameStaffName(a: unknown, b: unknown): boolean {
  const na = normName(a);
  const nb = normName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const at = nameTokens(na);
  const bt = nameTokens(nb);
  if (!at.length || !bt.length) return false;
  const aInB = at.every((t) => bt.includes(t));
  const bInA = bt.every((t) => at.includes(t));
  return aInB || bInA;
}

function findTenantStaffByName(tenantStaff: any[], name: unknown) {
  return tenantStaff.find((s) => sameStaffName(s.name, name));
}

function normTime(t?: string | null) {
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(t);
  if (!m) return null;
  const hh = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const mm = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  const out = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  return out === '00:00' ? null : out;
}

function attendanceHours(ci: string | null, co: string | null) {
  if (!ci || !co) return null;
  const [ah, am] = ci.split(':').map(Number);
  const [bh, bm] = co.split(':').map(Number);
  const diff = (bh * 60 + bm) - (ah * 60 + am);
  return diff > 0 ? Number((diff / 60).toFixed(2)) : null;
}

function attendanceNotes(notes?: string | null, absenceType?: typeof LEGAL_ABSENCES[number] | 'none') {
  const raw = String(notes ?? '')
    .replace(/\s*\|\s*Absence:\s*(Holiday|PTO|Sickday)\b/gi, '')
    .replace(/^Absence:\s*(Holiday|PTO|Sickday)\b\s*\|\s*/gi, '')
    .trim();
  if (!absenceType || absenceType === 'none') return raw || null;
  const label = absenceType === 'holiday' ? 'Holiday' : absenceType === 'pto' ? 'PTO' : 'Sickday';
  return [raw, `Absence: ${label}`].filter(Boolean).join(' | ');
}

export const staffRouter = router({
  list: tenantProcedure
    .input(
      z.object({
        role: z.enum([
          "owner",
          "manager",
          "mechanic",
          "receptionist",
          "accountant",
          "sales_attendant",
          "sales_supervisor",
          "workshop_supervisor",
          "inventory_attendant",
        ]).optional(),
        status: z.enum(["active", "suspended", "terminated"]).optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      try {
        const conditions = [eq(staff.tenantId, ctx.tenantId)];
        if (input?.role) conditions.push(eq(staff.role, input.role));
        if (input?.status) conditions.push(eq(staff.status, input.status));

        const list = await db
          .select()
          .from(staff)
          .where(and(...conditions))
          .orderBy(staff.name);

        return { success: true, staff: list };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    }),

  create: tenantProcedure.input(createStaffSchema).mutation(async ({ ctx, input }) => {
    try {
      const { hourlyRate, baseMonthlyNet, hireDate, ...rest } = input;
      const values: any = {
        ...rest,
        tenantId: ctx.tenantId,
        hourlyRate:     hourlyRate     != null ? String(hourlyRate)     : null,
        baseMonthlyNet: baseMonthlyNet != null ? String(baseMonthlyNet) : null,
        hireDate:       hireDate ? new Date(hireDate) : null,
      };
      const [{ id }] = await db.insert(staff).values(values).$returningId();
      const [created] = await db.select().from(staff).where(eq(staff.id, id)).limit(1);
      return { success: true, staff: created };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }),

  update: tenantProcedure
    .input(createStaffSchema.partial().extend({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const { id, hourlyRate, baseMonthlyNet, hireDate, ...rest } = input;
        const patch: any = { ...rest };
        if (hourlyRate     !== undefined) patch.hourlyRate     = hourlyRate     != null ? String(hourlyRate)     : null;
        if (baseMonthlyNet !== undefined) patch.baseMonthlyNet = baseMonthlyNet != null ? String(baseMonthlyNet) : null;
        if (hireDate       !== undefined) patch.hireDate       = hireDate ? new Date(hireDate) : null;
        await db.update(staff).set(patch).where(and(eq(staff.id, id), eq(staff.tenantId, ctx.tenantId)));
        const [row] = await db.select().from(staff).where(eq(staff.id, id)).limit(1);
        return { success: true, staff: row };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    }),

  delete: tenantProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      try {
        await db.update(staff)
          .set({ status: 'terminated' })
          .where(and(eq(staff.id, input.id), eq(staff.tenantId, ctx.tenantId)));
        return { success: true as const };
      } catch (error) {
        return { success: false as const, error: (error as Error).message };
      }
    }),

  /**
   * WS2-B — Clock-event ledger view. Returns every IN and OUT event
   * (NOT sessions) so the audit log can verify each punch independently.
   */
  ledger: tenantProcedure
    .input(z.object({
      from: z.string().optional(),
      to:   z.string().optional(),
      staffId: z.number().int().optional(),
    }).optional())
    .query(async ({ ctx, input }) => {
      try {
        const baseConditions = [eq(staff.tenantId, ctx.tenantId)];
        if (input?.staffId) baseConditions.push(eq(staffAttendanceLogs.staffId, input.staffId));
        const rows = await db
          .select({ log: staffAttendanceLogs, staffName: staff.name, role: staff.role })
          .from(staffAttendanceLogs)
          .innerJoin(staff, eq(staffAttendanceLogs.staffId, staff.id))
          .where(and(...baseConditions))
          .orderBy(desc(staffAttendanceLogs.clockInTime));
        const events: any[] = [];
        for (const r of rows) {
          if (r.log.clockInTime)  events.push({ id: `${r.log.id}-in`,  attendanceLogId: r.log.id, staffId: r.log.staffId, staffName: r.staffName, role: r.role, action: 'IN',  ts: r.log.clockInTime,  deviceFingerprint: r.log.deviceFingerprint, locationGps: r.log.locationGps });
          if (r.log.clockOutTime) events.push({ id: `${r.log.id}-out`, attendanceLogId: r.log.id, staffId: r.log.staffId, staffName: r.staffName, role: r.role, action: 'OUT', ts: r.log.clockOutTime, deviceFingerprint: r.log.deviceFingerprint, locationGps: r.log.locationGps });
        }
        events.sort((a, b) => new Date(b.ts).getTime() - new Date(a.ts).getTime());
        const filtered = (input?.from || input?.to)
          ? events.filter(e => {
              const d = new Date(e.ts).toISOString().slice(0, 10);
              if (input.from && d < input.from) return false;
              if (input.to   && d > input.to)   return false;
              return true;
            })
          : events;
        return { success: true as const, events: filtered.filter((e: any) => isAttendanceReportingRole(e.role)) };
      } catch (error) {
        return { success: false as const, error: (error as Error).message };
      }
    }),

  clockIn: tenantProcedure.input(clockInSchema).mutation(async ({ ctx, input }) => {
    try {
      const [member] = await db
        .select()
        .from(staff)
        .where(and(eq(staff.id, input.staffId), eq(staff.tenantId, ctx.tenantId), eq(staff.status, "active")))
        .limit(1);

      if (!member) return { success: false, error: "Staff member not found or inactive" };
      if (!(await isAttendanceReportingStaff(member))) {
        return { success: false, error: "Owner/admin accounts are not required to record daily attendance." };
      }

      const [open] = await db
        .select()
        .from(staffAttendanceLogs)
        .where(and(eq(staffAttendanceLogs.staffId, input.staffId), sql`${staffAttendanceLogs.clockOutTime} IS NULL`))
        .limit(1);

      if (open) return { success: false, error: "Staff member already clocked in" };

      const [{ id }] = await db
        .insert(staffAttendanceLogs)
        .values({
          staffId: input.staffId,
          clockInTime: new Date(),
          locationGps: input.locationGPS ?? null,
          deviceFingerprint: input.deviceFingerprint ?? null,
        })
        .$returningId();

      await db.update(staff).set({ lastClockIn: new Date() }).where(eq(staff.id, input.staffId));

      const [log] = await db.select().from(staffAttendanceLogs).where(eq(staffAttendanceLogs.id, id)).limit(1);
      return { success: true, attendanceLog: log };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }),

  clockOut: tenantProcedure.input(clockOutSchema).mutation(async ({ ctx, input }) => {
    try {
      const [log] = await db
        .select({ log: staffAttendanceLogs, member: staff })
        .from(staffAttendanceLogs)
        .innerJoin(staff, eq(staffAttendanceLogs.staffId, staff.id))
        .where(
          and(
            eq(staffAttendanceLogs.id, input.attendanceLogId),
            eq(staff.tenantId, ctx.tenantId),
            sql`${staffAttendanceLogs.clockOutTime} IS NULL`
          )
        )
        .limit(1);

      if (!log) return { success: false, error: "Attendance record not found or already clocked out" };
      if (!(await isAttendanceReportingStaff(log.member))) {
        return { success: false, error: "Owner/admin accounts are not required to record daily attendance." };
      }

      const clockOutTime = new Date();
      const clockInTime = new Date(log.log.clockInTime!);
      const hoursWorked = (clockOutTime.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);
      const overtimeHours = Math.max(0, hoursWorked - 8).toString();

      await db
        .update(staffAttendanceLogs)
        .set({
          clockOutTime,
          overtimeHours,
          approvedBy: input.approvedBy ?? null,
          updatedAt: new Date(),
        })
        .where(eq(staffAttendanceLogs.id, input.attendanceLogId));

      await db.update(staff).set({ lastClockOut: clockOutTime }).where(eq(staff.id, log.log.staffId));

      const [updated] = await db
        .select()
        .from(staffAttendanceLogs)
        .where(eq(staffAttendanceLogs.id, input.attendanceLogId))
        .limit(1);

      return { success: true, attendanceLog: updated };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }),

  /**
   * Manual / backdated attendance entry. Writes directly into the
   * `staff_attendance` (historical) table — bypasses the live clock
   * since the operator is filling in a past day. Recomputes `is_late`
   * and `hours_worked` server-side so the ledger stays consistent.
   */
  manualAttendance: tenantProcedure
    .input(z.object({
      staffId:     z.number().int(),
      clockInDate: z.string(),              // YYYY-MM-DD
      clockInTime: z.string().optional(),   // HH:MM
      clockOutTime: z.string().optional(),  // HH:MM
      absenceType: z.enum(LEGAL_ABSENCES).optional(),
      notes:        z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const [member] = await db
          .select()
          .from(staff)
          .where(and(eq(staff.id, input.staffId), eq(staff.tenantId, ctx.tenantId)))
          .limit(1);
        if (!member) return { success: false as const, error: 'Staff member not found.' };
        if (!(await isAttendanceReportingStaff(member))) {
          return { success: false as const, error: 'Owner/admin accounts are not required to record daily attendance.' };
        }

        const ci = normTime(input.clockInTime);
        const co = normTime(input.clockOutTime);
        if (!ci && !co && !input.absenceType) return { success: false as const, error: 'Provide a clock time or legal absence type.' };

        const hours = attendanceHours(ci, co);
        const isLate = input.absenceType ? 0 : (ci && ci > '08:00' ? 1 : 0);

        const [{ id }] = await db.insert(staffAttendance).values({
          staffName:     member.name,
          role:          member.role,
          clockInDate:   new Date(input.clockInDate),
          clockInTime:   ci ?? null,
          clockOutTime:  co ?? null,
          hoursWorked:   hours != null ? String(hours) : null,
          isLate,
          notes:         attendanceNotes(input.notes, input.absenceType),
        } as any).$returningId();
        return { success: true as const, id };
      } catch (error) {
        return { success: false as const, error: (error as Error).message };
      }
    }),

  recordPerformance: tenantProcedure.input(performanceSchema).mutation(async ({ ctx, input }) => {
    try {
      const [member] = await db
        .select()
        .from(staff)
        .where(and(eq(staff.id, input.staffId), eq(staff.tenantId, ctx.tenantId)))
        .limit(1);

      if (!member) return { success: false, error: "Staff member not found" };

      const [{ id }] = await db
        .insert(staffPerformance)
        .values({
          staffId: input.staffId,
          monthStart: input.monthStart,
          monthEnd: input.monthEnd,
          jobsCompleted: input.jobsCompleted ?? 0,
          avgJobTime: input.avgJobTime?.toString() ?? null,
          customerRating: input.customerRating?.toString() ?? null,
          revenueGenerated: input.revenueGenerated?.toString() ?? null,
          deductionsApplied: input.deductionsApplied?.toString() ?? null,
        })
        .$returningId();

      const [created] = await db
        .select()
        .from(staffPerformance)
        .where(eq(staffPerformance.id, id))
        .limit(1);

      return { success: true, performance: created };
    } catch (error) {
      return { success: false, error: (error as Error).message };
    }
  }),

  listAttendance: tenantProcedure
    .input(z.object({ staffId: z.number().int().optional() }).optional())
    .query(async ({ ctx, input }) => {
      try {
        const conditions = input?.staffId
          ? [eq(staffAttendanceLogs.staffId, input.staffId), eq(staff.tenantId, ctx.tenantId)]
          : [eq(staff.tenantId, ctx.tenantId)];

        const logs = await db
          .select({ log: staffAttendanceLogs, staffName: staff.name, role: staff.role })
          .from(staffAttendanceLogs)
          .innerJoin(staff, eq(staffAttendanceLogs.staffId, staff.id))
          .where(and(...conditions))
          .orderBy(desc(staffAttendanceLogs.clockInTime));

        const attendanceLogs = logs.filter((r: any) => isAttendanceReportingRole(r.role));
        return { success: true, attendanceLogs };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    }),

  /**
   * WS5-A — Documents per staff member. Returns metadata only.
   * Files persist under `<repo>/uploads/staff-docs/<staffId>/<n>.<ext>`.
   */
  listDocuments: tenantProcedure
    .input(z.object({ staffId: z.number().int().optional() }).optional())
    .query(async ({ ctx, input }) => {
      try {
        const conds: any[] = [eq(staffDocuments.tenantId, ctx.tenantId)];
        if (input?.staffId) conds.push(eq(staffDocuments.staffId, input.staffId));
        const rows = await db.select().from(staffDocuments).where(and(...conds)).orderBy(desc(staffDocuments.createdAt));
        const today = new Date();
        const enriched = rows.map((r: any) => {
          const exp = r.expiresAt ? new Date(r.expiresAt) : null;
          let status: 'valid' | 'expiring' | 'expired' = 'valid';
          if (exp) {
            const days = Math.floor((exp.getTime() - today.getTime()) / 86_400_000);
            if (days < 0)  status = 'expired';
            else if (days <= 30) status = 'expiring';
          }
          return { ...r, status };
        });
        return { success: true as const, documents: enriched };
      } catch (error) {
        return { success: false as const, error: (error as Error).message, documents: [] };
      }
    }),

  uploadDocument: tenantProcedure
    .input(z.object({
      staffId:  z.number().int(),
      docType:  z.enum(['contract','national_id','ghana_card','drivers_license','certification','medical','training','other']),
      filename: z.string().min(1).max(200),
      mimeType: z.string().min(1).max(100),
      base64:   z.string().min(1),
      expiresAt: z.string().optional(),
      notes:    z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const dir = path.resolve(process.cwd(), 'uploads', 'staff-docs', String(input.staffId));
        fs.mkdirSync(dir, { recursive: true });
        const safeName = input.filename.replace(/[^A-Za-z0-9._-]/g, '_');
        const stamped  = `${Date.now()}-${safeName}`;
        const dest     = path.join(dir, stamped);
        const buf      = Buffer.from(input.base64, 'base64');
        fs.writeFileSync(dest, buf);
        const relPath  = path.relative(path.resolve(process.cwd()), dest).replace(/\\/g, '/');
        const [{ id }] = await db.insert(staffDocuments).values({
          tenantId:    ctx.tenantId,
          staffId:     input.staffId,
          docType:     input.docType,
          filename:    input.filename,
          mimeType:    input.mimeType,
          sizeBytes:   buf.length,
          storagePath: relPath,
          expiresAt:   input.expiresAt ? new Date(input.expiresAt) : null,
          notes:       input.notes ?? null,
        }).$returningId();
        return { success: true as const, id };
      } catch (error) {
        return { success: false as const, error: (error as Error).message };
      }
    }),

  deleteDocument: tenantProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      try {
        const [row] = await db.select().from(staffDocuments)
          .where(and(eq(staffDocuments.id, input.id), eq(staffDocuments.tenantId, ctx.tenantId))).limit(1);
        if (!row) return { success: false as const, error: 'Document not found.' };
        try { fs.unlinkSync(path.resolve(process.cwd(), row.storagePath)); } catch { /* file already gone */ }
        await db.delete(staffDocuments).where(eq(staffDocuments.id, input.id));
        return { success: true as const };
      } catch (error) {
        return { success: false as const, error: (error as Error).message };
      }
    }),

  /**
   * WS5-B — Pre-expiry roll-up. Reports documents inside the 30-day
   * window so the bell, HR banner, and BI dashboard can light up.
   */
  expiringDocuments: tenantProcedure
    .input(z.object({ withinDays: z.number().int().positive().max(365).default(30) }).optional())
    .query(async ({ ctx, input }) => {
      try {
        const horizon = new Date();
        horizon.setDate(horizon.getDate() + (input?.withinDays ?? 30));
        const rows = await db
          .select({ doc: staffDocuments, staffName: staff.name })
          .from(staffDocuments)
          .innerJoin(staff, eq(staffDocuments.staffId, staff.id))
          .where(and(
            eq(staffDocuments.tenantId, ctx.tenantId),
            sql`${staffDocuments.expiresAt} IS NOT NULL`,
            sql`${staffDocuments.expiresAt} <= ${horizon}`,
          ))
          .orderBy(staffDocuments.expiresAt);
        return { success: true as const, rows };
      } catch (error) {
        return { success: false as const, error: (error as Error).message, rows: [] };
      }
    }),

  /**
   * Imported attendance ledger — reads from the `staff_attendance` table
   * populated by the master-sheet Excel importer. Distinct from the live
   * clock-in/out logs (`staff_attendance_logs`) which only capture
   * sessions started in the app itself.
   *
   * Returns rows sorted newest-first. Lightweight server filtering by
   * staff name + date range; full search lives in the UI.
   */
  listImportedAttendance: tenantProcedure
    .input(z.object({
      staffName: z.string().optional(),
      from:      z.string().optional(), // YYYY-MM-DD
      to:        z.string().optional(),
      limit:     z.number().int().positive().max(2000).optional(),
    }).optional())
    .query(async ({ input }) => {
      try {
        const rows = await db
          .select()
          .from(staffAttendance)
          .orderBy(desc(staffAttendance.clockInDate));
        // Filter out rows where BOTH punches are null (orphans). The
        // cleanup script removes most of these but the safety guard
        // protects against future bad imports.
        let filtered = rows.filter((r: any) => isAttendanceReportingRole(r.role) && (r.clockInTime || r.clockOutTime || isLegalAbsence(r.notes)));
        if (input?.from) filtered = filtered.filter((r: any) => dateOnlyYmd(r.clockInDate) >= input.from!);
        if (input?.to)   filtered = filtered.filter((r: any) => dateOnlyYmd(r.clockInDate) <= input.to!);
        if (input?.staffName) {
          const s = input.staffName.toLowerCase();
          filtered = filtered.filter((r: any) => String(r.staffName ?? '').toLowerCase().includes(s));
        }
        if (input?.limit) filtered = filtered.slice(0, input.limit);
        return { success: true, rows: filtered };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    }),

  updateImportedAttendance: tenantProcedure
    .input(z.object({
      id: z.number().int(),
      staffId: z.number().int().optional(),
      clockInDate: z.string().optional(),
      clockInTime: z.string().nullable().optional(),
      clockOutTime: z.string().nullable().optional(),
      absenceType: z.enum([...LEGAL_ABSENCES, 'none'] as const).optional(),
      notes: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        await requireLedgerEditor(ctx.user, ctx.tenantId);

        const [existing] = await db.select().from(staffAttendance).where(eq(staffAttendance.id, input.id)).limit(1);
        if (!existing) return { success: false as const, error: 'Attendance row not found.' };

        const tenantStaff = await db.select().from(staff).where(eq(staff.tenantId, ctx.tenantId));
        const staffById = new Map(tenantStaff.map((s: any) => [s.id, s]));
        if (!findTenantStaffByName(tenantStaff, existing.staffName)) {
          return { success: false as const, error: 'Attendance row does not belong to this tenant roster.' };
        }

        const patch: any = {};
        if (input.staffId !== undefined) {
          const member = staffById.get(input.staffId);
          if (!member) return { success: false as const, error: 'Selected staff member not found.' };
          if (!(await isAttendanceReportingStaff(member))) {
            return { success: false as const, error: 'Owner/admin accounts are not required to record daily attendance.' };
          }
          patch.staffName = member.name;
          patch.role = member.role;
        }
        if (input.clockInDate !== undefined) patch.clockInDate = new Date(input.clockInDate);

        const nextIn = input.clockInTime !== undefined ? normTime(input.clockInTime) : (existing.clockInTime ?? null);
        const nextOut = input.clockOutTime !== undefined ? normTime(input.clockOutTime) : (existing.clockOutTime ?? null);
        if (input.clockInTime !== undefined) patch.clockInTime = nextIn;
        if (input.clockOutTime !== undefined) patch.clockOutTime = nextOut;

        const nextNotes = input.notes !== undefined ? input.notes : existing.notes;
        const absenceType = input.absenceType === undefined ? undefined : input.absenceType;
        if (input.notes !== undefined || input.absenceType !== undefined) {
          patch.notes = attendanceNotes(nextNotes, absenceType);
        }

        const excused = input.absenceType && input.absenceType !== 'none';
        patch.hoursWorked = excused ? null : (attendanceHours(nextIn, nextOut) != null ? String(attendanceHours(nextIn, nextOut)) : null);
        patch.isLate = excused ? 0 : (nextIn && nextIn > '08:00' ? 1 : 0);

        await db.update(staffAttendance).set(patch).where(eq(staffAttendance.id, input.id));
        const [row] = await db.select().from(staffAttendance).where(eq(staffAttendance.id, input.id)).limit(1);
        return { success: true as const, row };
      } catch (error) {
        return { success: false as const, error: (error as Error).message };
      }
    }),

  /**
   * Monthly attendance + payroll math for one staff member.
   *
   * Rules (per AGL policy 2026-05):
   *   • Work day starts at 08:00, ends at 18:00 (10 working hours).
   *   • Clock-in after 08:00 → late penalty GHS 10.
   *   • Missing clock-in OR clock-out → penalty GHS 5 each.
   *   • Hours worked beyond 18:00 are overtime at 1.5× hourly.
   *   • Hourly rate = baseMonthlyNet ÷ (26 working days × hoursPerDay).
   */
  monthlyAttendanceSummary: tenantProcedure
    .input(z.object({
      staffId: z.number().int(),
      year: z.number().int(),
      month: z.number().int().min(1).max(12),
      workingDaysOverride: z.number().int().min(1).max(31).optional(),
      latePenaltyGhs: z.number().min(0).default(10),
      missedPunchPenaltyGhs: z.number().min(0).default(5),
      overtimeMultiplier: z.number().min(1).default(1.5),
    }))
    .query(async ({ ctx, input }) => {
      try {
        const [member] = await db
          .select()
          .from(staff)
          .where(and(eq(staff.id, input.staffId), eq(staff.tenantId, ctx.tenantId)))
          .limit(1);
        if (!member) return { success: false, error: "Staff member not found" };
        if (!(await isAttendanceReportingStaff(member))) {
          return { success: false, error: "Owner/admin accounts are not required to record daily attendance" };
        }

        const monthStart = new Date(Date.UTC(input.year, input.month - 1, 1));
        const monthEnd = new Date(Date.UTC(input.year, input.month, 1));

        const logs = await db
          .select()
          .from(staffAttendanceLogs)
          .where(and(
            eq(staffAttendanceLogs.staffId, input.staffId),
            sql`${staffAttendanceLogs.clockInTime} >= ${monthStart}`,
            sql`${staffAttendanceLogs.clockInTime} < ${monthEnd}`,
          ))
          .orderBy(staffAttendanceLogs.clockInTime);

        // AGL policy: payroll math is calibrated to a 26-working-day month.
        // We still count actual weekdays for reporting purposes, but the
        // hourly rate divisor stays at 26 so a leaner month doesn't
        // produce an inflated hourly figure.
        let defaultWorkingDays = 0;
        for (let d = new Date(monthStart); d < monthEnd; d.setUTCDate(d.getUTCDate() + 1)) {
          const dow = d.getUTCDay(); // 0=Sun..6=Sat
          if (dow !== 0) defaultWorkingDays += 1;
        }
        const workingDays = input.workingDaysOverride ?? defaultWorkingDays;

        const baseMonthlyNet = Number(member.baseMonthlyNet ?? 0);
        // Hours per day inferred from the work envelope on the staff
        // record if present, otherwise default to 10 (08:00–18:00).
        const PAYROLL_WORKING_DAYS = 26;
        const hoursPerDay = (() => {
          const start = (member as any).workStart as string | null | undefined;
          const end   = (member as any).workEnd   as string | null | undefined;
          if (start && end && /^\d{1,2}:\d{2}$/.test(start) && /^\d{1,2}:\d{2}$/.test(end)) {
            const [sh, sm] = start.split(':').map(Number);
            const [eh, em] = end.split(':').map(Number);
            const span = (eh + em / 60) - (sh + sm / 60);
            if (span > 0 && span <= 16) return span;
          }
          return 10;
        })();
        const hourlyRate = member.hourlyRate
          ? Number(member.hourlyRate)
          : (baseMonthlyNet > 0 ? baseMonthlyNet / (PAYROLL_WORKING_DAYS * hoursPerDay) : 0);

        let regularHours = 0;
        let overtimeHours = 0;
        let lateCount = 0;
        let missedPunchCount = 0;

        for (const log of logs) {
          if (!log.clockInTime) { missedPunchCount += 1; continue; }
          if (!log.clockOutTime) { missedPunchCount += 1; continue; }
          const ci = new Date(log.clockInTime);
          const co = new Date(log.clockOutTime);

          // Late = clock-in past 08:00 local (UTC-relative; tenant TZ would refine).
          const startOfDay = new Date(ci); startOfDay.setUTCHours(8, 0, 0, 0);
          if (ci.getTime() > startOfDay.getTime()) lateCount += 1;

          // Split worked time into ≤18:00 (regular) and >18:00 (overtime).
          const endOfRegular = new Date(ci); endOfRegular.setUTCHours(18, 0, 0, 0);
          const regularEnd = co < endOfRegular ? co : endOfRegular;
          const regularMs = Math.max(0, regularEnd.getTime() - ci.getTime());
          const overtimeMs = Math.max(0, co.getTime() - endOfRegular.getTime());
          regularHours += regularMs / 3_600_000;
          overtimeHours += overtimeMs / 3_600_000;
        }

        const latePenalty = lateCount * input.latePenaltyGhs;
        const missedPenalty = missedPunchCount * input.missedPunchPenaltyGhs;
        const totalPenalty = latePenalty + missedPenalty;
        const overtimePay = overtimeHours * hourlyRate * input.overtimeMultiplier;
        const grossPay = baseMonthlyNet + overtimePay - totalPenalty;

        return {
          success: true,
          summary: {
            staffId: member.id,
            staffName: member.name,
            year: input.year,
            month: input.month,
            workingDays,
            hourlyRate: Number(hourlyRate.toFixed(2)),
            baseMonthlyNet,
            regularHours: Number(regularHours.toFixed(2)),
            overtimeHours: Number(overtimeHours.toFixed(2)),
            overtimePay: Number(overtimePay.toFixed(2)),
            lateCount,
            missedPunchCount,
            latePenalty,
            missedPenalty,
            totalPenalty,
            grossPay: Number(grossPay.toFixed(2)),
          },
        };
      } catch (error) {
        return { success: false, error: (error as Error).message };
      }
    }),
});
