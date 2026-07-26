import { sql } from "drizzle-orm";
import { db } from "../db";
import { users } from "../../drizzle/schema";

const NON_ATTENDANCE_ROLES = new Set(["admin", "owner", "principal"]);

export function emailKey(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

export function accessRoleKey(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

export function isAttendanceReportingRole(role: unknown): boolean {
  return !NON_ATTENDANCE_ROLES.has(accessRoleKey(role));
}

export async function buildAccessRoleByEmail(): Promise<Map<string, string>> {
  const rows = await db.select({ email: users.email, role: users.role }).from(users);
  const out = new Map<string, string>();
  for (const row of rows as any[]) {
    const email = emailKey(row.email);
    if (email) out.set(email, accessRoleKey(row.role));
  }
  return out;
}

export function isAttendanceReportingStaffWithAccess(member: any, accessRoleByEmail: Map<string, string>): boolean {
  if (!isAttendanceReportingRole(member?.role)) return false;
  return isAttendanceReportingRole(accessRoleByEmail.get(emailKey(member?.email)));
}

export async function isAttendanceReportingStaff(member: any): Promise<boolean> {
  if (!isAttendanceReportingRole(member?.role)) return false;
  const email = emailKey(member?.email);
  if (!email) return true;

  const [user] = await db
    .select({ role: users.role })
    .from(users)
    .where(sql`LOWER(${users.email}) = ${email}`)
    .limit(1);

  return isAttendanceReportingRole((user as any)?.role);
}
