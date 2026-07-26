import { z } from "zod";
import { eq, like, and, desc, or, inArray } from "drizzle-orm";
import { router, protectedProcedure } from "../_core/trpc";
import { db } from "../db";
import { customers, vehicles, serviceAppointments } from "../../drizzle/schema";

const customerInputSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(1),
  email: z.string().email().optional(),
  preferredContact: z.enum(["sms", "whatsapp", "email"]).optional(),
  notificationsEnabled: z.boolean().optional(),
  notes: z.string().optional(),
});

const updateCustomerInputSchema = customerInputSchema.partial().extend({
  id: z.number().int(),
});

export const customersRouter = router({
  list: protectedProcedure
    .input(z.object({
      search: z.string().optional(),
      limit: z.number().int().min(1).max(500).optional(),
      offset: z.number().int().min(0).optional(),
    }).optional())
    .query(async ({ input }) => {
      try {
        const searchTerm = input?.search?.trim();
        const limit = input?.limit ?? 100;
        const offset = input?.offset ?? 0;

        // Was N+1: list customers, then for each customer fire a separate
        // SELECT against vehicles. For 143 customers that's 144 queries
        // serialised — visible as multi-second lag in the UI. Fixed to one
        // SELECT for customers + one SELECT IN for vehicles, grouped client-side.
        const customersList = await db
          .select()
          .from(customers)
          .where(
            searchTerm
              ? or(like(customers.name, `%${searchTerm}%`), like(customers.phone, `%${searchTerm}%`))
              : undefined
          )
          .orderBy(desc(customers.createdAt))
          .limit(limit)
          .offset(offset);

        const ids = customersList.map(c => c.id);
        const allVehicles = ids.length > 0
          ? await db.select().from(vehicles).where(inArray(vehicles.customerId, ids))
          : [];
        const vehiclesByCustomerId = new Map<number, any[]>();
        for (const v of allVehicles) {
          const list = vehiclesByCustomerId.get(v.customerId) ?? [];
          list.push(v);
          vehiclesByCustomerId.set(v.customerId, list);
        }

        const result = customersList.map(c => ({ ...c, vehicles: vehiclesByCustomerId.get(c.id) ?? [] }));
        return { success: true, customers: result, hasMore: result.length === limit };
      } catch (error) {
        console.error("Error listing customers:", error);
        return { success: false, error: (error as Error).message };
      }
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .query(async ({ input }) => {
      try {
        const customer = await db
          .select()
          .from(customers)
          .where(eq(customers.id, input.id))
          .limit(1);

        if (!customer.length) {
          return { success: false, error: "Customer not found" };
        }

        const customerVehicles = await db
          .select()
          .from(vehicles)
          .where(eq(vehicles.customerId, input.id));

        const recentAppointments = await db
          .select()
          .from(serviceAppointments)
          .where(eq(serviceAppointments.customerId, input.id))
          .orderBy(desc(serviceAppointments.scheduledDate))
          .limit(10);

        return {
          success: true,
          customer: { ...customer[0], vehicles: customerVehicles, recentAppointments },
        };
      } catch (error) {
        console.error("Error fetching customer:", error);
        return { success: false, error: (error as Error).message };
      }
    }),

  create: protectedProcedure
    .input(customerInputSchema)
    .mutation(async ({ input }) => {
      try {
        const existing = await db
          .select()
          .from(customers)
          .where(eq(customers.phone, input.phone))
          .limit(1);

        if (existing.length) {
          return { success: false, error: "Phone number already exists" };
        }

        const [{ id }] = await db.insert(customers).values(input).$returningId();
        const [newCustomer] = await db.select().from(customers).where(eq(customers.id, id)).limit(1);

        return { success: true, customer: newCustomer };
      } catch (error) {
        console.error("Error creating customer:", error);
        return { success: false, error: (error as Error).message };
      }
    }),

  update: protectedProcedure
    .input(updateCustomerInputSchema)
    .mutation(async ({ input }) => {
      try {
        const { id, ...updateData } = input;

        if (updateData.phone) {
          const existing = await db
            .select()
            .from(customers)
            .where(eq(customers.phone, updateData.phone))
            .limit(1);

          if (existing.length && existing[0].id !== id) {
            return { success: false, error: "Phone number already in use by another customer" };
          }
        }

        await db
          .update(customers)
          .set({ ...updateData, updatedAt: new Date() })
          .where(eq(customers.id, id));

        const [updatedCustomer] = await db
          .select()
          .from(customers)
          .where(eq(customers.id, id))
          .limit(1);

        if (!updatedCustomer) {
          return { success: false, error: "Customer not found" };
        }

        return { success: true, customer: updatedCustomer };
      } catch (error) {
        console.error("Error updating customer:", error);
        return { success: false, error: (error as Error).message };
      }
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      try {
        await db.delete(customers).where(eq(customers.id, input.id));
        return { success: true, message: "Customer deleted successfully" };
      } catch (error) {
        console.error("Error deleting customer:", error);
        return { success: false, error: (error as Error).message };
      }
    }),
});
