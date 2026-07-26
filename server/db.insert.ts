import { getDb } from "./db";
import {
  salesTransactions,
  workshopJobs,
  expenses,
  purchaseOrders,
  inventory,
  creditSales,
  notifications,
} from "../drizzle/schema";
import { toDateOnly } from "./dateOnly";

export async function insertSalesTransaction(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(salesTransactions).values({
    ...data,
    transactionDate: toDateOnly(data.transactionDate) as any,
    quantity: data.quantity != null ? String(data.quantity) : data.quantity,
    unitPrice: data.unitPrice != null ? String(data.unitPrice) : data.unitPrice,
    totalAmount: data.totalAmount != null ? String(data.totalAmount) : data.totalAmount,
    workmanshipFee: data.workmanshipFee != null ? String(data.workmanshipFee) : data.workmanshipFee,
  });
  return { success: true, id: result[0] };
}

export async function insertWorkshopJob(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(workshopJobs).values(data);
  return { success: true, id: result[0] };
}

export async function insertExpense(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(expenses).values({
    ...data,
    expenseDate: toDateOnly(data.expenseDate) as any,
  });
  return { success: true, id: result[0] };
}

export async function insertPurchaseOrder(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(purchaseOrders).values(data);
  return { success: true, id: result[0] };
}

export async function insertInventory(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // The decimal columns (quantity, minStockLevel, unitPrice) accept
  // strings from drizzle, so coerce any numeric payload here before
  // forwarding to .values(). Allows fractional units like 1.5 L.
  const coerced = {
    ...data,
    quantity:      data.quantity      != null ? String(data.quantity)      : data.quantity,
    minStockLevel: data.minStockLevel != null ? String(data.minStockLevel) : data.minStockLevel,
    unitPrice:     data.unitPrice     != null ? String(data.unitPrice)     : data.unitPrice,
  };
  const result = await db.insert(inventory).values(coerced);
  return { success: true, id: result[0] };
}

export async function insertCreditSale(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(creditSales).values(data);
  return { success: true, id: result[0] };
}

export async function insertNotification(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const result = await db.insert(notifications).values(data);
  return { success: true, id: result[0] };
}
