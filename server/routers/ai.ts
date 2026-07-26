import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { invokeLLM } from "../_core/llm";
import { salesTransactions, workshopJobs, staffAttendance, expenses } from "../../drizzle/schema";

export const aiRouter = router({
  chat: protectedProcedure
    .input(z.object({ query: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) {
        throw new Error("Database not available");
      }

      try {
        // Fetch relevant data based on query
        const [sales, workshop, staff, expensesData] = await Promise.all([
          db.select().from(salesTransactions).limit(100),
          db.select().from(workshopJobs).limit(100),
          db.select().from(staffAttendance).limit(100),
          db.select().from(expenses).limit(100),
        ]);

        // Prepare context for LLM
        const totalRevenue = sales.reduce((sum: number, s: any) => sum + parseFloat(s.totalAmount?.toString() || "0"), 0);
        const totalExpenses = expensesData.reduce((sum: number, e: any) => sum + parseFloat(e.amount?.toString() || "0"), 0);
        const totalHours = staff.reduce((sum: number, s: any) => sum + (s.hoursWorked ? parseFloat(s.hoursWorked.toString()) : 0), 0);
        const staffNamesSet = new Set(staff.map((s: any) => s.staffName));
        const staffNames = Array.from(staffNamesSet);
        
        const context = `
You are an AI assistant for AGL Command Center, an automotive workshop management system.
You have access to the following operational data:

Sales Transactions (${sales.length} records):
- Channels: Walk-In, WhatsApp, Phone, Instagram, TikTok, Boss
- Payment Methods: Cash, MoMo, Bank Transfer, Credit, POS
- Total Revenue: ₵${totalRevenue.toLocaleString()}

Workshop Jobs (${workshop.length} records):
- Statuses: Completed, In Progress, Pending, On Hold
- Total Jobs: ${workshop.length}

Staff Attendance (${staff.length} records):
- Staff Members: ${staffNames.join(", ")}\n- Total Hours: ${totalHours.toFixed(2)}
Expenses (${expensesData.length} records):
- Total Expenses: ₵${totalExpenses.toLocaleString()}

User Query: ${input.query}

Provide a helpful, concise response with specific data insights when relevant. Format currency with ₵ symbol.
`;

        const response = await invokeLLM({
          messages: [
            {
              role: "system",
              content: context,
            },
            {
              role: "user",
              content: input.query,
            },
          ],
        });

        const answer =
          (response.choices[0]?.message?.content as string) ||
          "I couldn't process your query. Please try again.";

        return { answer };
      } catch (error: any) {
        console.error("AI chat error:", error);
        throw new Error("Failed to process your query");
      }
    }),
});
