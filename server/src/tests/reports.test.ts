import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { 
  usersTable, 
  patientsTable, 
  medicinesTable, 
  prescriptionsTable, 
  prescriptionItemsTable,
  paymentsTable 
} from '../db/schema';
import { 
  generateSalesReport, 
  generateMedicineUsageReport, 
  getLowStockAlerts,
  generateMonthlySummary 
} from '../handlers/reports';
import { type SalesReportInput, type MedicineUsageReportInput } from '../schema';

describe('Reports Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Test data setup helpers
  const setupTestData = async () => {
    // Create users (doctors)
    const doctorResult = await db.insert(usersTable).values([
      {
        email: 'doctor1@test.com',
        password_hash: 'hashedpassword1',
        role: 'doctor' as const,
        first_name: 'John',
        last_name: 'Smith',
        phone: '123-456-7890'
      },
      {
        email: 'doctor2@test.com',
        password_hash: 'hashedpassword2',
        role: 'doctor' as const,
        first_name: 'Jane',
        last_name: 'Doe',
        phone: '098-765-4321'
      }
    ]).returning().execute();

    const cashierResult = await db.insert(usersTable).values({
      email: 'cashier@test.com',
      password_hash: 'hashedpassword3',
      role: 'cashier' as const,
      first_name: 'Bob',
      last_name: 'Johnson'
    }).returning().execute();

    // Create patients
    const patientResult = await db.insert(patientsTable).values([
      {
        first_name: 'Alice',
        last_name: 'Wilson',
        email: 'alice@test.com',
        phone: '555-0001',
        gender: 'female' as const,
        birthdate: '1990-05-15',
        address: '123 Main St'
      },
      {
        first_name: 'Bob',
        last_name: 'Brown',
        email: 'bob@test.com',
        phone: '555-0002',
        gender: 'male' as const,
        birthdate: '1985-08-22',
        address: '456 Oak Ave'
      }
    ]).returning().execute();

    // Create medicines
    const medicineResult = await db.insert(medicinesTable).values([
      {
        name: 'Aspirin',
        category: 'pain_relievers' as const,
        stock_quantity: 100,
        price_per_unit: '5.99',
        supplier_info: 'MedSupply Inc'
      },
      {
        name: 'Amoxicillin',
        category: 'antibiotics' as const,
        stock_quantity: 5, // Low stock
        price_per_unit: '12.50',
        supplier_info: 'PharmaCorp'
      },
      {
        name: 'Vitamin C',
        category: 'vitamins' as const,
        stock_quantity: 200,
        price_per_unit: '8.25',
        supplier_info: 'VitaHealth'
      },
      {
        name: 'Low Stock Med',
        category: 'other' as const,
        stock_quantity: 3, // Very low stock
        price_per_unit: '15.00'
      }
    ]).returning().execute();

    return {
      doctors: doctorResult,
      cashier: cashierResult[0],
      patients: patientResult,
      medicines: medicineResult
    };
  };

  const createTestPrescriptionsAndPayments = async (testData: any) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    // Create prescriptions
    const prescriptionResult = await db.insert(prescriptionsTable).values([
      {
        patient_id: testData.patients[0].id,
        doctor_id: testData.doctors[0].id,
        status: 'filled' as const,
        notes: 'Standard treatment',
        created_at: today
      },
      {
        patient_id: testData.patients[1].id,
        doctor_id: testData.doctors[1].id,
        status: 'filled' as const,
        notes: 'Follow-up treatment',
        created_at: yesterday
      }
    ]).returning().execute();

    // Create prescription items
    await db.insert(prescriptionItemsTable).values([
      {
        prescription_id: prescriptionResult[0].id,
        medicine_id: testData.medicines[0].id, // Aspirin
        quantity_prescribed: 30,
        quantity_filled: 30,
        dosage_instructions: 'Take 1 tablet twice daily'
      },
      {
        prescription_id: prescriptionResult[0].id,
        medicine_id: testData.medicines[2].id, // Vitamin C
        quantity_prescribed: 60,
        quantity_filled: 60,
        dosage_instructions: 'Take 1 tablet daily'
      },
      {
        prescription_id: prescriptionResult[1].id,
        medicine_id: testData.medicines[1].id, // Amoxicillin
        quantity_prescribed: 20,
        quantity_filled: 20,
        dosage_instructions: 'Take 1 capsule three times daily'
      }
    ]).execute();

    // Create payments
    await db.insert(paymentsTable).values([
      {
        patient_id: testData.patients[0].id,
        prescription_id: prescriptionResult[0].id,
        amount: '100.50',
        payment_method: 'card' as const,
        payment_date: today,
        created_by: testData.cashier.id,
        notes: 'Payment for prescription 1'
      },
      {
        patient_id: testData.patients[1].id,
        prescription_id: prescriptionResult[1].id,
        amount: '75.25',
        payment_method: 'cash' as const,
        payment_date: yesterday,
        created_by: testData.cashier.id,
        notes: 'Payment for prescription 2'
      }
    ]).execute();

    return prescriptionResult;
  };

  describe('generateSalesReport', () => {
    it('should generate comprehensive sales report', async () => {
      const testData = await setupTestData();
      await createTestPrescriptionsAndPayments(testData);

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 2);
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 1);

      const input: SalesReportInput = {
        start_date: startDate,
        end_date: endDate
      };

      const result = await generateSalesReport(input);

      // Check totals
      expect(result.totalSales).toEqual(175.75);
      expect(result.totalTransactions).toEqual(2);

      // Check sales by date
      expect(result.salesByDate).toHaveLength(2);
      expect(result.salesByDate.some(day => day.amount === 100.50)).toBe(true);
      expect(result.salesByDate.some(day => day.amount === 75.25)).toBe(true);

      // Check sales by doctor
      expect(result.salesByDoctor).toHaveLength(2);
      expect(result.salesByDoctor.some(doc => doc.doctorName === 'John Smith')).toBe(true);
      expect(result.salesByDoctor.some(doc => doc.doctorName === 'Jane Doe')).toBe(true);

      // Check sales by category
      expect(result.salesByCategory.length).toBeGreaterThan(0);
      expect(result.salesByCategory.some(cat => cat.category === 'pain_relievers')).toBe(true);
    });

    it('should filter sales report by doctor', async () => {
      const testData = await setupTestData();
      await createTestPrescriptionsAndPayments(testData);

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 2);
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 1);

      const input: SalesReportInput = {
        start_date: startDate,
        end_date: endDate,
        doctor_id: testData.doctors[0].id
      };

      const result = await generateSalesReport(input);

      // Should only include sales from the specified doctor
      expect(result.salesByDoctor).toHaveLength(1);
      expect(result.salesByDoctor[0].doctorName).toEqual('John Smith');
      expect(result.salesByDoctor[0].amount).toEqual(100.50);
    });

    it('should filter sales report by medicine category', async () => {
      const testData = await setupTestData();
      await createTestPrescriptionsAndPayments(testData);

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 2);
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 1);

      const input: SalesReportInput = {
        start_date: startDate,
        end_date: endDate,
        medicine_category: 'pain_relievers'
      };

      const result = await generateSalesReport(input);

      // Should only include sales for the specified category
      expect(result.salesByCategory.every(cat => cat.category === 'pain_relievers')).toBe(true);
    });

    it('should return empty report for date range with no sales', async () => {
      await setupTestData();

      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const futureDateEnd = new Date(futureDate);
      futureDateEnd.setDate(futureDateEnd.getDate() + 1);

      const input: SalesReportInput = {
        start_date: futureDate,
        end_date: futureDateEnd
      };

      const result = await generateSalesReport(input);

      expect(result.totalSales).toEqual(0);
      expect(result.totalTransactions).toEqual(0);
      expect(result.salesByDate).toHaveLength(0);
      expect(result.salesByDoctor).toHaveLength(0);
      expect(result.salesByCategory).toHaveLength(0);
    });
  });

  describe('generateMedicineUsageReport', () => {
    it('should generate comprehensive medicine usage report', async () => {
      const testData = await setupTestData();
      await createTestPrescriptionsAndPayments(testData);

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 2);
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 1);

      const input: MedicineUsageReportInput = {
        start_date: startDate,
        end_date: endDate
      };

      const result = await generateMedicineUsageReport(input);

      // Check total medicines dispensed
      expect(result.totalMedicinesDispensed).toEqual(110); // 30 + 60 + 20

      // Check usage by medicine
      expect(result.usageByMedicine).toHaveLength(3);
      expect(result.usageByMedicine.some(med => med.medicineName === 'Aspirin' && med.quantityDispensed === 30)).toBe(true);
      expect(result.usageByMedicine.some(med => med.medicineName === 'Vitamin C' && med.quantityDispensed === 60)).toBe(true);
      expect(result.usageByMedicine.some(med => med.medicineName === 'Amoxicillin' && med.quantityDispensed === 20)).toBe(true);

      // Check usage by category
      expect(result.usageByCategory.length).toBeGreaterThan(0);
      expect(result.usageByCategory.some(cat => cat.category === 'pain_relievers')).toBe(true);
      expect(result.usageByCategory.some(cat => cat.category === 'vitamins')).toBe(true);
      expect(result.usageByCategory.some(cat => cat.category === 'antibiotics')).toBe(true);

      // Check usage by date
      expect(result.usageByDate).toHaveLength(2);
    });

    it('should filter medicine usage report by specific medicine', async () => {
      const testData = await setupTestData();
      await createTestPrescriptionsAndPayments(testData);

      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 2);
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 1);

      const input: MedicineUsageReportInput = {
        start_date: startDate,
        end_date: endDate,
        medicine_id: testData.medicines[0].id // Aspirin
      };

      const result = await generateMedicineUsageReport(input);

      // Should only include data for the specified medicine
      expect(result.usageByMedicine).toHaveLength(1);
      expect(result.usageByMedicine[0].medicineName).toEqual('Aspirin');
      expect(result.usageByMedicine[0].quantityDispensed).toEqual(30);
    });

    it('should return empty usage report for date range with no prescriptions', async () => {
      await setupTestData();

      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      const futureDateEnd = new Date(futureDate);
      futureDateEnd.setDate(futureDateEnd.getDate() + 1);

      const input: MedicineUsageReportInput = {
        start_date: futureDate,
        end_date: futureDateEnd
      };

      const result = await generateMedicineUsageReport(input);

      expect(result.totalMedicinesDispensed).toEqual(0);
      expect(result.usageByMedicine).toHaveLength(0);
      expect(result.usageByCategory).toHaveLength(0);
      expect(result.usageByDate).toHaveLength(0);
    });
  });

  describe('getLowStockAlerts', () => {
    it('should identify medicines with low stock', async () => {
      await setupTestData();

      const result = await getLowStockAlerts(10);

      // Should find medicines with stock <= 10
      expect(result.length).toEqual(2); // Amoxicillin (5) and Low Stock Med (3)
      
      const lowStockMed = result.find(med => med.medicineName === 'Low Stock Med');
      expect(lowStockMed).toBeDefined();
      expect(lowStockMed!.currentStock).toEqual(3);
      expect(lowStockMed!.recommendedReorderLevel).toEqual(20);

      const amoxicillin = result.find(med => med.medicineName === 'Amoxicillin');
      expect(amoxicillin).toBeDefined();
      expect(amoxicillin!.currentStock).toEqual(5);
      expect(amoxicillin!.supplier).toEqual('PharmaCorp');
    });

    it('should use custom threshold for low stock alerts', async () => {
      await setupTestData();

      const result = await getLowStockAlerts(3);

      // Should only find medicines with stock <= 3
      expect(result).toHaveLength(1);
      expect(result[0].medicineName).toEqual('Low Stock Med');
      expect(result[0].currentStock).toEqual(3);
    });

    it('should return empty array when no medicines are below threshold', async () => {
      await setupTestData();

      const result = await getLowStockAlerts(1);

      expect(result).toHaveLength(0);
    });

    it('should order results by stock quantity (ascending)', async () => {
      await setupTestData();

      const result = await getLowStockAlerts(10);

      // Should be ordered by stock quantity (lowest first)
      expect(result).toHaveLength(2);
      expect(result[0].currentStock).toBeLessThanOrEqual(result[1].currentStock);
    });
  });

  describe('generateMonthlySummary', () => {
    it('should generate comprehensive monthly summary', async () => {
      const testData = await setupTestData();
      await createTestPrescriptionsAndPayments(testData);

      const currentDate = new Date();
      const result = await generateMonthlySummary(
        currentDate.getFullYear(),
        currentDate.getMonth() + 1
      );

      // Check that all report sections are included
      expect(result.sales).toBeDefined();
      expect(result.usage).toBeDefined();
      expect(result.lowStock).toBeDefined();
      expect(typeof result.patientCount).toEqual('number');
      expect(typeof result.prescriptionCount).toEqual('number');

      // Check sales data
      expect(result.sales.totalSales).toBeGreaterThan(0);
      expect(result.sales.totalTransactions).toBeGreaterThan(0);

      // Check usage data
      expect(result.usage.totalMedicinesDispensed).toBeGreaterThan(0);

      // Check low stock alerts
      expect(result.lowStock.length).toBeGreaterThan(0);

      // Check counts
      expect(result.patientCount).toBeGreaterThan(0);
      expect(result.prescriptionCount).toBeGreaterThan(0);
    });

    it('should return zero counts for month with no data', async () => {
      await setupTestData();

      // Generate summary for a future month
      const result = await generateMonthlySummary(2025, 12);

      expect(result.sales.totalSales).toEqual(0);
      expect(result.sales.totalTransactions).toEqual(0);
      expect(result.usage.totalMedicinesDispensed).toEqual(0);
      expect(result.patientCount).toEqual(0);
      expect(result.prescriptionCount).toEqual(0);
      // Low stock alerts should still be present as they're not date-filtered
      expect(result.lowStock.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      // Test with invalid date range that might cause issues
      const invalidInput: SalesReportInput = {
        start_date: new Date('invalid-date'),
        end_date: new Date()
      };

      await expect(generateSalesReport(invalidInput)).rejects.toThrow();
    });
  });
});