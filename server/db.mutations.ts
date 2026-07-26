import { salesTransactions, workshopJobs, expenses, purchaseOrders, inventory, creditSales, notifications } from "../drizzle/schema";
import { getDb } from "./db";

export async function insertSalesTransaction(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(salesTransactions).values([
    {
      transactionDate: data.transactionDate,
      customerName: data.customerName,
      customerContact: data.customerContact,
      channel: data.channel,
      vehicle: data.vehicle,
      partService: data.partService,
      quantity: data.quantity ? data.quantity.toString() : null,
      unitPrice: data.unitPrice ? data.unitPrice.toString() : null,
      totalAmount: data.totalAmount.toString(),
      paymentMethod: data.paymentMethod,
      receiptNo: data.receiptNo,
      salesRep: data.salesRep,
      mechanic: data.mechanic,
      status: data.status,
      workmanshipFee: data.workmanshipFee ? data.workmanshipFee.toString() : null,
      notes: data.notes,
    },
  ]);

  return result;
}

export async function insertWorkshopJob(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(workshopJobs).values({
    jobDate: data.jobDate,
    vehicle: data.vehicle,
    registrationNo: data.registrationNo,
    mechanics: JSON.stringify(data.mechanics),
    jobDescription: data.jobDescription,
    status: data.status,
    notes: data.notes,
  });

  return result;
}

export async function insertExpense(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(expenses).values([
    {
      expenseDate: data.expenseDate,
      category: data.category,
      description: data.description,
      amount: data.amount.toString(),
      paymentMethod: data.paymentMethod,
      vendor: data.vendor,
      approvedBy: data.approvedBy,
      notes: data.notes,
    },
  ]);

  return result;
}

export async function insertPurchaseOrder(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(purchaseOrders).values([
    {
      poNumber: data.poNumber,
      poDate: data.poDate,
      vendor: data.vendor,
      description: data.description,
      amount: data.amount.toString(),
      status: data.status,
      deliveryDate: data.deliveryDate,
      notes: data.notes,
    },
  ]);

  return result;
}

export async function insertInventory(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(inventory).values([
    {
      itemName: data.itemName,
      itemCode: data.itemCode,
      category: data.category,
      vehicleMake: data.vehicleMake,
      vehicleModel: data.vehicleModel,
      yearMin: data.yearMin,
      yearMax: data.yearMax,
      engineCapacity: data.engineCapacity,
      cleanDescription: data.cleanDescription ?? data.itemName,
      quantity: data.quantity?.toString(),
      minStockLevel: data.minStockLevel?.toString(),
      unitPrice: data.unitPrice?.toString(),
      supplier: data.supplier,
      notes: data.notes,
    },
  ]);

  return result;
}

export async function insertCreditSale(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(creditSales).values([
    {
      customerName: data.customerName,
      customerContact: data.customerContact,
      totalAmount: data.totalAmount.toString(),
      amountPaid: data.amountPaid ? data.amountPaid.toString() : "0",
      amountDue: data.amountDue.toString(),
      saleDate: data.saleDate,
      dueDate: data.dueDate,
      status: data.status,
      notes: data.notes,
    },
  ]);

  return result;
}

export async function insertNotification(data: any) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(notifications).values({
    title: data.title,
    content: data.content,
    type: data.type,
    recipientRole: data.recipientRole,
  });

  return result;
}
