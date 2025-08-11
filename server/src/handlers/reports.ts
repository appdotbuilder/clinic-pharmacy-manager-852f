import { db } from '../db';
import { 
  paymentsTable, 
  prescriptionsTable, 
  prescriptionItemsTable, 
  medicinesTable, 
  usersTable,
  patientsTable
} from '../db/schema';
import { type SalesReportInput, type MedicineUsageReportInput } from '../schema';
import { eq, gte, lte, and, sum, count, sql, desc, asc } from 'drizzle-orm';

// Sales report data structure
export interface SalesReportData {
    totalSales: number;
    totalTransactions: number;
    salesByDate: Array<{ date: string; amount: number; transactions: number }>;
    salesByDoctor: Array<{ doctorId: number; doctorName: string; amount: number; transactions: number }>;
    salesByCategory: Array<{ category: string; amount: number; transactions: number }>;
}

// Medicine usage report data structure
export interface MedicineUsageData {
    totalMedicinesDispensed: number;
    usageByMedicine: Array<{
        medicineId: number;
        medicineName: string;
        category: string;
        quantityDispensed: number;
        timesDispensed: number;
    }>;
    usageByCategory: Array<{
        category: string;
        quantityDispensed: number;
        timesDispensed: number;
    }>;
    usageByDate: Array<{
        date: string;
        quantityDispensed: number;
        timesDispensed: number;
    }>;
}

// Low stock alert data structure
export interface LowStockAlert {
    medicineId: number;
    medicineName: string;
    category: string;
    currentStock: number;
    recommendedReorderLevel: number;
    supplier: string | null;
}

// Generate sales report
export async function generateSalesReport(input: SalesReportInput): Promise<SalesReportData> {
    try {
        // Base query conditions
        const conditions: any[] = [
            gte(paymentsTable.payment_date, input.start_date),
            lte(paymentsTable.payment_date, input.end_date)
        ];

        // Get total sales and transactions
        const totalQuery = db.select({
            totalSales: sum(paymentsTable.amount),
            totalTransactions: count(paymentsTable.id)
        }).from(paymentsTable)
          .where(and(...conditions));

        const totalResults = await totalQuery.execute();
        const totals = totalResults[0];

        // Sales by date
        const salesByDateQuery = db.select({
            date: sql<string>`DATE(${paymentsTable.payment_date})`,
            amount: sum(paymentsTable.amount),
            transactions: count(paymentsTable.id)
        }).from(paymentsTable)
          .where(and(...conditions))
          .groupBy(sql`DATE(${paymentsTable.payment_date})`)
          .orderBy(asc(sql`DATE(${paymentsTable.payment_date})`));

        const salesByDate = await salesByDateQuery.execute();

        // Sales by doctor (through prescriptions)
        const doctorConditions = [...conditions];
        if (input.doctor_id) {
            doctorConditions.push(eq(prescriptionsTable.doctor_id, input.doctor_id));
        }

        const salesByDoctorQuery = db.select({
            doctorId: prescriptionsTable.doctor_id,
            doctorName: sql<string>`CONCAT(${usersTable.first_name}, ' ', ${usersTable.last_name})`,
            amount: sum(paymentsTable.amount),
            transactions: count(paymentsTable.id)
        }).from(paymentsTable)
          .innerJoin(prescriptionsTable, eq(paymentsTable.prescription_id, prescriptionsTable.id))
          .innerJoin(usersTable, eq(prescriptionsTable.doctor_id, usersTable.id))
          .where(and(...doctorConditions))
          .groupBy(prescriptionsTable.doctor_id, usersTable.first_name, usersTable.last_name)
          .orderBy(desc(sum(paymentsTable.amount)));

        const salesByDoctor = await salesByDoctorQuery.execute();

        // Sales by medicine category (through prescription items)
        const categoryConditions = [...conditions];
        if (input.medicine_category) {
            categoryConditions.push(eq(medicinesTable.category, input.medicine_category));
        }

        const salesByCategoryQuery = db.select({
            category: medicinesTable.category,
            amount: sum(paymentsTable.amount),
            transactions: count(paymentsTable.id)
        }).from(paymentsTable)
          .innerJoin(prescriptionsTable, eq(paymentsTable.prescription_id, prescriptionsTable.id))
          .innerJoin(prescriptionItemsTable, eq(prescriptionsTable.id, prescriptionItemsTable.prescription_id))
          .innerJoin(medicinesTable, eq(prescriptionItemsTable.medicine_id, medicinesTable.id))
          .where(and(...categoryConditions))
          .groupBy(medicinesTable.category)
          .orderBy(desc(sum(paymentsTable.amount)));

        const salesByCategory = await salesByCategoryQuery.execute();

        return {
            totalSales: parseFloat(totals.totalSales || '0'),
            totalTransactions: totals.totalTransactions || 0,
            salesByDate: salesByDate.map(row => ({
                date: row.date,
                amount: parseFloat(row.amount || '0'),
                transactions: row.transactions
            })),
            salesByDoctor: salesByDoctor.map(row => ({
                doctorId: row.doctorId,
                doctorName: row.doctorName,
                amount: parseFloat(row.amount || '0'),
                transactions: row.transactions
            })),
            salesByCategory: salesByCategory.map(row => ({
                category: row.category,
                amount: parseFloat(row.amount || '0'),
                transactions: row.transactions
            }))
        };
    } catch (error) {
        console.error('Sales report generation failed:', error);
        throw error;
    }
}

// Generate medicine usage report
export async function generateMedicineUsageReport(input: MedicineUsageReportInput): Promise<MedicineUsageData> {
    try {
        // Base conditions for prescription items through prescriptions
        const conditions: any[] = [
            gte(prescriptionsTable.created_at, input.start_date),
            lte(prescriptionsTable.created_at, input.end_date)
        ];

        // Get total medicines dispensed
        const totalQuery = db.select({
            totalDispensed: sum(prescriptionItemsTable.quantity_filled)
        }).from(prescriptionItemsTable)
          .innerJoin(prescriptionsTable, eq(prescriptionItemsTable.prescription_id, prescriptionsTable.id))
          .where(and(...conditions));

        const totalResult = await totalQuery.execute();
        const totalMedicinesDispensed = parseInt(totalResult[0]?.totalDispensed || '0');

        // Usage by medicine
        const medicineConditions = [...conditions];
        if (input.medicine_id) {
            medicineConditions.push(eq(medicinesTable.id, input.medicine_id));
        }

        const usageByMedicineQuery = db.select({
            medicineId: medicinesTable.id,
            medicineName: medicinesTable.name,
            category: medicinesTable.category,
            quantityDispensed: sum(prescriptionItemsTable.quantity_filled),
            timesDispensed: count(prescriptionItemsTable.id)
        }).from(prescriptionItemsTable)
          .innerJoin(prescriptionsTable, eq(prescriptionItemsTable.prescription_id, prescriptionsTable.id))
          .innerJoin(medicinesTable, eq(prescriptionItemsTable.medicine_id, medicinesTable.id))
          .where(and(...medicineConditions))
          .groupBy(medicinesTable.id, medicinesTable.name, medicinesTable.category)
          .orderBy(desc(sum(prescriptionItemsTable.quantity_filled)));

        const usageByMedicine = await usageByMedicineQuery.execute();

        // Usage by category
        const usageByCategoryQuery = db.select({
            category: medicinesTable.category,
            quantityDispensed: sum(prescriptionItemsTable.quantity_filled),
            timesDispensed: count(prescriptionItemsTable.id)
        }).from(prescriptionItemsTable)
          .innerJoin(prescriptionsTable, eq(prescriptionItemsTable.prescription_id, prescriptionsTable.id))
          .innerJoin(medicinesTable, eq(prescriptionItemsTable.medicine_id, medicinesTable.id))
          .where(and(...conditions))
          .groupBy(medicinesTable.category)
          .orderBy(desc(sum(prescriptionItemsTable.quantity_filled)));

        const usageByCategory = await usageByCategoryQuery.execute();

        // Usage by date
        const usageByDateQuery = db.select({
            date: sql<string>`DATE(${prescriptionsTable.created_at})`,
            quantityDispensed: sum(prescriptionItemsTable.quantity_filled),
            timesDispensed: count(prescriptionItemsTable.id)
        }).from(prescriptionItemsTable)
          .innerJoin(prescriptionsTable, eq(prescriptionItemsTable.prescription_id, prescriptionsTable.id))
          .where(and(...conditions))
          .groupBy(sql`DATE(${prescriptionsTable.created_at})`)
          .orderBy(asc(sql`DATE(${prescriptionsTable.created_at})`));

        const usageByDate = await usageByDateQuery.execute();

        return {
            totalMedicinesDispensed,
            usageByMedicine: usageByMedicine.map(row => ({
                medicineId: row.medicineId,
                medicineName: row.medicineName,
                category: row.category,
                quantityDispensed: parseInt(row.quantityDispensed || '0'),
                timesDispensed: row.timesDispensed
            })),
            usageByCategory: usageByCategory.map(row => ({
                category: row.category,
                quantityDispensed: parseInt(row.quantityDispensed || '0'),
                timesDispensed: row.timesDispensed
            })),
            usageByDate: usageByDate.map(row => ({
                date: row.date,
                quantityDispensed: parseInt(row.quantityDispensed || '0'),
                timesDispensed: row.timesDispensed
            }))
        };
    } catch (error) {
        console.error('Medicine usage report generation failed:', error);
        throw error;
    }
}

// Get low stock alerts
export async function getLowStockAlerts(threshold: number = 10): Promise<LowStockAlert[]> {
    try {
        const query = db.select({
            medicineId: medicinesTable.id,
            medicineName: medicinesTable.name,
            category: medicinesTable.category,
            currentStock: medicinesTable.stock_quantity,
            supplier: medicinesTable.supplier_info
        }).from(medicinesTable)
          .where(lte(medicinesTable.stock_quantity, threshold))
          .orderBy(asc(medicinesTable.stock_quantity));

        const results = await query.execute();

        return results.map(medicine => ({
            medicineId: medicine.medicineId,
            medicineName: medicine.medicineName,
            category: medicine.category,
            currentStock: medicine.currentStock,
            recommendedReorderLevel: Math.max(threshold * 2, 20), // Simple reorder logic
            supplier: medicine.supplier
        }));
    } catch (error) {
        console.error('Low stock alerts generation failed:', error);
        throw error;
    }
}

// Generate monthly summary report
export async function generateMonthlySummary(year: number, month: number): Promise<{
    sales: SalesReportData;
    usage: MedicineUsageData;
    lowStock: LowStockAlert[];
    patientCount: number;
    prescriptionCount: number;
}> {
    try {
        // Calculate start and end dates for the month
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0); // Last day of the month

        // Generate sales and usage reports for the month
        const [sales, usage, lowStock] = await Promise.all([
            generateSalesReport({ start_date: startDate, end_date: endDate }),
            generateMedicineUsageReport({ start_date: startDate, end_date: endDate }),
            getLowStockAlerts()
        ]);

        // Get patient count for the month
        const patientCountQuery = db.select({
            count: count(patientsTable.id)
        }).from(patientsTable)
          .where(and(
            gte(patientsTable.created_at, startDate),
            lte(patientsTable.created_at, endDate)
          ));

        const patientCountResult = await patientCountQuery.execute();
        const patientCount = patientCountResult[0]?.count || 0;

        // Get prescription count for the month
        const prescriptionCountQuery = db.select({
            count: count(prescriptionsTable.id)
        }).from(prescriptionsTable)
          .where(and(
            gte(prescriptionsTable.created_at, startDate),
            lte(prescriptionsTable.created_at, endDate)
          ));

        const prescriptionCountResult = await prescriptionCountQuery.execute();
        const prescriptionCount = prescriptionCountResult[0]?.count || 0;

        return {
            sales,
            usage,
            lowStock,
            patientCount,
            prescriptionCount
        };
    } catch (error) {
        console.error('Monthly summary generation failed:', error);
        throw error;
    }
}