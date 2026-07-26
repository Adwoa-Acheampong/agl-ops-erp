import { z } from "zod";
import { eq, and, gte, lte, desc, asc, like } from "drizzle-orm";
import { router, protectedProcedure } from "../_core/trpc";
import { db } from "../db";
import { serviceAppointments, customers, vehicles, appointmentDiagnostics, appointmentParts, inventory, appointmentRecalls } from "../../drizzle/schema";
import type { ServiceAppointment } from "../../drizzle/schema";

const STATUS_ENUM = ["Scheduled", "Checked In", "In Progress", "Ready", "Completed", "Cancelled"] as const;

const appointmentInputSchema = z.object({
  customerId: z.number().int(),
  vehicleId: z.number().int(),
  scheduledDate: z.string().min(1),
  scheduledTime: z.string().optional(),
  serviceType: z.string().min(1),
  assignedMechanic: z.string().optional(),
  estimatedCost: z.number().optional(),
  notes: z.string().optional(),
  status: z.enum(STATUS_ENUM).default("Scheduled"),
});

const updateStatusSchema = z.object({
  id: z.number().int(),
  status: z.enum(STATUS_ENUM),
});

const cancelSchema = z.object({
  id: z.number().int(),
  reason: z.string().min(1),
});

export const appointmentsRouter = router({
  list: protectedProcedure
    .input(
      z
        .object({
          status: z.enum(STATUS_ENUM).optional(),
          dateRange: z
            .object({ start: z.string().optional(), end: z.string().optional() })
            .optional(),
          assignedMechanic: z.string().optional(),
        })
        .optional()
    )
    .query(async ({ input }) => {
      try {
        const conditions = [];

        if (input?.status) {
          conditions.push(eq(serviceAppointments.status, input.status));
        }
        if (input?.dateRange?.start) {
          conditions.push(gte(serviceAppointments.scheduledDate, input.dateRange.start));
        }
        if (input?.dateRange?.end) {
          conditions.push(lte(serviceAppointments.scheduledDate, input.dateRange.end));
        }
        if (input?.assignedMechanic) {
          conditions.push(like(serviceAppointments.assignedMechanic, `%${input.assignedMechanic}%`));
        }

        const results = await db
          .select({ appointment: serviceAppointments, customer: customers, vehicle: vehicles })
          .from(serviceAppointments)
          .innerJoin(customers, eq(serviceAppointments.customerId, customers.id))
          .innerJoin(vehicles, eq(serviceAppointments.vehicleId, vehicles.id))
          .where(conditions.length ? and(...conditions) : undefined)
          .orderBy(asc(serviceAppointments.scheduledDate));

        return { success: true, appointments: results };
      } catch (error) {
        console.error("Error listing appointments:", error);
        return { success: false, error: (error as Error).message };
      }
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ input }) => {
      try {
        const result = await db
          .select({ appointment: serviceAppointments, customer: customers, vehicle: vehicles })
          .from(serviceAppointments)
          .innerJoin(customers, eq(serviceAppointments.customerId, customers.id))
          .innerJoin(vehicles, eq(serviceAppointments.vehicleId, vehicles.id))
          .where(eq(serviceAppointments.id, input.id))
          .limit(1);

        if (!result.length) {
          return { success: false, error: "Appointment not found" };
        }

        return { success: true, appointment: result[0] };
      } catch (error) {
        console.error("Error fetching appointment:", error);
        return { success: false, error: (error as Error).message };
      }
    }),

  create: protectedProcedure
    .input(appointmentInputSchema)
    .mutation(async ({ input }) => {
      try {
        const customerExists = await db
          .select()
          .from(customers)
          .where(eq(customers.id, input.customerId))
          .limit(1);

        if (!customerExists.length) {
          return { success: false, error: "Customer not found" };
        }

        const vehicleExists = await db
          .select()
          .from(vehicles)
          .where(and(eq(vehicles.id, input.vehicleId), eq(vehicles.customerId, input.customerId)))
          .limit(1);

        if (!vehicleExists.length) {
          return { success: false, error: "Vehicle not found or does not belong to customer" };
        }

        const [{ id }] = await db.insert(serviceAppointments).values(input).$returningId();
        const [newAppointment] = await db
          .select()
          .from(serviceAppointments)
          .where(eq(serviceAppointments.id, id))
          .limit(1);

        return { success: true, appointment: newAppointment };
      } catch (error) {
        console.error("Error creating appointment:", error);
        return { success: false, error: (error as Error).message };
      }
    }),

  updateStatus: protectedProcedure
    .input(updateStatusSchema)
    .mutation(async ({ input }) => {
      try {
        const updateData: Partial<ServiceAppointment> = {
          status: input.status,
          updatedAt: new Date(),
        };

        if (input.status === "Ready" || input.status === "Completed") {
          updateData.notifiedAt = new Date().toISOString();
        }

        await db
          .update(serviceAppointments)
          .set(updateData)
          .where(eq(serviceAppointments.id, input.id));

        const [updatedAppointment] = await db
          .select()
          .from(serviceAppointments)
          .where(eq(serviceAppointments.id, input.id))
          .limit(1);

        if (!updatedAppointment) {
          return { success: false, error: "Appointment not found" };
        }

        return { success: true, appointment: updatedAppointment };
      } catch (error) {
        console.error("Error updating appointment status:", error);
        return { success: false, error: (error as Error).message };
      }
    }),

  cancel: protectedProcedure
    .input(cancelSchema)
    .mutation(async ({ input }) => {
      try {
        await db
          .update(serviceAppointments)
          .set({ status: "Cancelled", notes: input.reason, updatedAt: new Date() })
          .where(eq(serviceAppointments.id, input.id));

        const [cancelledAppointment] = await db
          .select()
          .from(serviceAppointments)
          .where(eq(serviceAppointments.id, input.id))
          .limit(1);

        if (!cancelledAppointment) {
          return { success: false, error: "Appointment not found" };
        }

        return { success: true, appointment: cancelledAppointment };
      } catch (error) {
        console.error("Error cancelling appointment:", error);
        return { success: false, error: (error as Error).message };
      }
    }),

  // Parts ledger per appointment.
  listParts: protectedProcedure
    .input(z.object({ appointmentId: z.number().int() }))
    .query(async ({ input }) => {
      try {
        const rows = await db.select().from(appointmentParts).where(eq(appointmentParts.appointmentId, input.appointmentId)).orderBy(appointmentParts.id);
        return { success: true as const, parts: rows };
      } catch (error) {
        return { success: false as const, error: (error as Error).message };
      }
    }),

  addPart: protectedProcedure
    .input(z.object({
      appointmentId: z.number().int(),
      inventoryItemId: z.number().int().optional(),
      partName: z.string().min(1),
      supplier: z.string().optional(),
      buyPrice: z.number().nonnegative(),
      sellPrice: z.number().nonnegative(),
      quantity: z.number().int().positive().default(1),
    }))
    .mutation(async ({ input }) => {
      try {
        if (input.inventoryItemId) {
          const [it] = await db.select().from(inventory).where(eq(inventory.id, input.inventoryItemId)).limit(1);
          if (!it) return { success: false as const, error: "Inventory item not found." };
          const onHand = Number(it.quantity ?? 0);
          if (onHand < input.quantity) return { success: false as const, error: `Insufficient stock for ${it.itemName}: ${onHand} on hand.` };
          await db.update(inventory).set({ quantity: onHand - input.quantity }).where(eq(inventory.id, input.inventoryItemId));
        }
        const [{ id }] = await db.insert(appointmentParts).values({
          appointmentId: input.appointmentId,
          inventoryItemId: input.inventoryItemId,
          partName: input.partName,
          supplier: input.supplier,
          buyPrice: input.buyPrice.toString(),
          sellPrice: input.sellPrice.toString(),
          quantity: input.quantity,
        }).$returningId();
        const [created] = await db.select().from(appointmentParts).where(eq(appointmentParts.id, id)).limit(1);
        return { success: true as const, part: created };
      } catch (error) {
        return { success: false as const, error: (error as Error).message };
      }
    }),

  removePart: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      try {
        const [p] = await db.select().from(appointmentParts).where(eq(appointmentParts.id, input.id)).limit(1);
        if (p?.inventoryItemId) {
          const [it] = await db.select().from(inventory).where(eq(inventory.id, p.inventoryItemId)).limit(1);
          if (it) await db.update(inventory).set({ quantity: Number(it.quantity ?? 0) + (p.quantity ?? 0) }).where(eq(inventory.id, p.inventoryItemId));
        }
        await db.delete(appointmentParts).where(eq(appointmentParts.id, input.id));
        return { success: true as const };
      } catch (error) {
        return { success: false as const, error: (error as Error).message };
      }
    }),

  // Diagnostics editor — replace-all semantics for the appointment's list.
  listDiagnostics: protectedProcedure
    .input(z.object({ appointmentId: z.number().int() }))
    .query(async ({ input }) => {
      try {
        const rows = await db.select().from(appointmentDiagnostics).where(eq(appointmentDiagnostics.appointmentId, input.appointmentId)).orderBy(asc(appointmentDiagnostics.sequence));
        return { success: true as const, diagnostics: rows };
      } catch (error) {
        return { success: false as const, error: (error as Error).message };
      }
    }),

  setDiagnostics: protectedProcedure
    .input(z.object({
      appointmentId: z.number().int(),
      items: z.array(z.object({
        faultCode: z.string().min(1),
        severity: z.enum(["low","medium","high","critical"]),
        workOrder: z.string().optional(),
      })),
    }))
    .mutation(async ({ input }) => {
      try {
        await db.delete(appointmentDiagnostics).where(eq(appointmentDiagnostics.appointmentId, input.appointmentId));
        if (input.items.length > 0) {
          await db.insert(appointmentDiagnostics).values(input.items.map((it, idx) => ({
            appointmentId: input.appointmentId,
            faultCode: it.faultCode,
            severity: it.severity,
            workOrder: it.workOrder,
            sequence: idx + 1,
          })));
        }
        return { success: true as const, count: input.items.length };
      } catch (error) {
        return { success: false as const, error: (error as Error).message };
      }
    }),

  // Recalls + penalties tagged to this appointment (job-card "Penalties" tab).
  recallsForAppointment: protectedProcedure
    .input(z.object({ appointmentId: z.number().int() }))
    .query(async ({ input }) => {
      try {
        const rows = await db.select().from(appointmentRecalls).where(eq(appointmentRecalls.originalAppointmentId, input.appointmentId)).orderBy(desc(appointmentRecalls.createdAt));
        return { success: true as const, recalls: rows };
      } catch (error) {
        return { success: false as const, error: (error as Error).message };
      }
    }),
});
