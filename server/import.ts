import * as XLSX from 'xlsx';
import { getDb } from './db';
import { 
  salesTransactions, 
  workshopJobs, 
  staffAttendance, 
  expenses, 
  purchaseOrders,
  monthlySummary,
  creditSales 
} from '../drizzle/schema';

export async function importExcelData(filePath: string) {
  try {
    const workbook = XLSX.readFile(filePath);
    const db = await getDb();
    
    if (!db) {
      throw new Error('Database connection failed');
    }

    let summaryCount = 0;
    let salesCount = 0;
    let workshopCount = 0;
    let staffCount = 0;
    let expenseCount = 0;
    let poCount = 0;

    // Import Monthly Summary
    if (workbook.SheetNames.includes('Monthly Summary')) {
      const summarySheet = workbook.Sheets['Monthly Summary'];
      const summaryData = XLSX.utils.sheet_to_json(summarySheet);
      
      for (const row of summaryData) {
        const data: any = row;
        await db.insert(monthlySummary).values({
          month: data['Month'] ? new Date(data['Month']) : new Date(),
          totalRevenue: parseFloat(data['Total Revenue'] || 0) as any,
          totalExpenses: parseFloat(data['Total Expenses'] || 0) as any,
          netPosition: parseFloat(data['Net Position'] || 0) as any,
          totalTransactions: parseInt(data['Total Transactions'] || 0),
          totalVehiclesServiced: parseInt(data['Vehicles Serviced'] || 0),
        }).onDuplicateKeyUpdate({
          set: {
            totalRevenue: parseFloat(data['Total Revenue'] || 0) as any,
            totalExpenses: parseFloat(data['Total Expenses'] || 0) as any,
            netPosition: parseFloat(data['Net Position'] || 0) as any,
          }
        });
        summaryCount++;
      }
    }

    // Import Sales & Customer Log
    if (workbook.SheetNames.includes('Sales & Customer Log')) {
      const salesSheet = workbook.Sheets['Sales & Customer Log'];
      const salesData = XLSX.utils.sheet_to_json(salesSheet);
      
      for (const row of salesData) {
        const data: any = row;
        await db.insert(salesTransactions).values({
          transactionDate: data['Date'] ? new Date(data['Date']) : new Date(),
          customerName: data['Customer Name'] || null,
          customerContact: data['Contact'] || null,
          channel: (data['Channel'] || 'Walk-In') as any,
          vehicle: data['Vehicle'] || null,
          partService: data['Part/Service'] || '',
          quantity: parseFloat(data['Quantity'] || 1) as any,
          unitPrice: parseFloat(data['Unit Price'] || 0) as any,
          totalAmount: parseFloat(data['Total Amount'] || 0) as any,
          paymentMethod: (data['Payment Method'] || 'Cash') as any,
          status: (data['Status'] || 'Completed') as any,
          salesRep: data['Sales Rep'] || null,
          receiptNo: data['Receipt No'] || null,
          mechanic: data['Mechanic'] || null,
          workmanshipFee: parseFloat(data['Workmanship Fee'] || 0) as any,
          notes: data['Notes'] || null,
        }).onDuplicateKeyUpdate({
          set: {
            status: (data['Status'] || 'Completed') as any,
            totalAmount: parseFloat(data['Total Amount'] || 0) as any,
          }
        });
        salesCount++;
      }
    }

    // Import Workshop Daily Log
    if (workbook.SheetNames.includes('Workshop Daily Log')) {
      const workshopSheet = workbook.Sheets['Workshop Daily Log'];
      const workshopData = XLSX.utils.sheet_to_json(workshopSheet);
      
      for (const row of workshopData) {
        const data: any = row;
        await db.insert(workshopJobs).values({
          jobDate: data['Date'] ? new Date(data['Date']) : new Date(),
          vehicle: data['Vehicle'] || '',
          registrationNo: data['Registration No'] || null,
          mechanics: data['Mechanics'] || '',
          jobDescription: data['Job Description'] || '',
          status: (data['Status'] || 'Pending') as any,
          notes: data['Notes'] || null,
        }).onDuplicateKeyUpdate({
          set: {
            status: (data['Status'] || 'Pending') as any,
          }
        });
        workshopCount++;
      }
    }

    // Import Staff Clock-In
    if (workbook.SheetNames.includes('Staff Clock-In')) {
      const staffSheet = workbook.Sheets['Staff Clock-In'];
      const staffData = XLSX.utils.sheet_to_json(staffSheet);
      
      for (const row of staffData) {
        const data: any = row;
        await db.insert(staffAttendance).values({
          staffName: data['Staff Name'] || '',
          role: data['Role'] || 'Mechanic',
          clockInDate: data['Date'] ? new Date(data['Date']) : new Date(),
          clockInTime: data['Clock In'] || null,
          clockOutTime: data['Clock Out'] || null,
          hoursWorked: data['Hours Worked'] ? (parseFloat(data['Hours Worked']) as any) : undefined,
          isLate: data['Late'] === 'Yes' || data['Late'] === true,
          notes: data['Notes'] || null,
        }).onDuplicateKeyUpdate({
          set: {
            clockOutTime: data['Clock Out'] || null,
            hoursWorked: data['Hours Worked'] ? (parseFloat(data['Hours Worked']) as any) : undefined,
          }
        });
        staffCount++;
      }
    }

    // Import Expense Log
    if (workbook.SheetNames.includes('Expense Log')) {
      const expenseSheet = workbook.Sheets['Expense Log'];
      const expenseData = XLSX.utils.sheet_to_json(expenseSheet);
      
      for (const row of expenseData) {
        const data: any = row;
        await db.insert(expenses).values({
          expenseDate: data['Date'] ? new Date(data['Date']) : new Date(),
          category: data['Category'] || 'Other',
          description: data['Description'] || '',
          amount: parseFloat(data['Amount'] || 0) as any,
          vendor: data['Vendor'] || null,
          notes: data['Notes'] || null,
        }).onDuplicateKeyUpdate({
          set: {
            amount: parseFloat(data['Amount'] || 0) as any,
          }
        });
        expenseCount++;
      }
    }

    // Import Purchase Orders
    if (workbook.SheetNames.includes('Purchase Orders')) {
      const poSheet = workbook.Sheets['Purchase Orders'];
      const poData = XLSX.utils.sheet_to_json(poSheet);
      
      for (const row of poData) {
        const data: any = row;
        await db.insert(purchaseOrders).values({
          poNumber: data['PO Number'] || '',
          poDate: data['Date'] ? new Date(data['Date']) : new Date(),
          vendor: data['Vendor'] || '',
          description: data['Description'] || data['Item'] || '',
          amount: parseFloat(data['Amount'] || 0) as any,
          status: (data['Status'] || 'Pending') as any,
          deliveryDate: data['Delivery Date'] ? new Date(data['Delivery Date']) : undefined,
          notes: data['Notes'] || null,
        }).onDuplicateKeyUpdate({
          set: {
            status: (data['Status'] || 'Pending') as any,
            amount: parseFloat(data['Amount'] || 0) as any,
            description: data['Description'] || data['Item'] || '',
          }
        });
        poCount++;
      }
    }

    // Count imported records for stats
    const stats: Record<string, number> = {
      monthlySummary: summaryCount || 0,
      salesCustomerLog: salesCount || 0,
      workshopDailyLog: workshopCount || 0,
      staffClockIn: staffCount || 0,
      expenseLog: expenseCount || 0,
      purchaseOrders: poCount || 0,
    };

    return { success: true, message: 'Data imported successfully', stats };
  } catch (error) {
    console.error('Import error:', error);
    throw error;
  }
}
