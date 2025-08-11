import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { paymentsTable, patientsTable, prescriptionsTable, usersTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import { type CreatePaymentInput } from '../schema';
import {
  createPayment,
  getPayments,
  getPaymentById,
  getPaymentsByPatientId,
  getPaymentsByDateRange,
  getPaymentsByPrescriptionId,
  getDailyPaymentSummary
} from '../handlers/payments';

// Test data
const testPatient = {
  first_name: 'John',
  last_name: 'Doe',
  email: 'john.doe@example.com',
  phone: '555-0123',
  address: '123 Main St',
  gender: 'male' as const,
  birthdate: '1990-01-01', // Use string format for date column
  allergies: 'Penicillin',
  chronic_conditions: null,
  medical_history: null
};

const testDoctor = {
  email: 'doctor@example.com',
  password_hash: 'hashed_password',
  role: 'doctor' as const,
  first_name: 'Dr. Jane',
  last_name: 'Smith',
  phone: '555-0124',
  is_active: true
};

const testCashier = {
  email: 'cashier@example.com',
  password_hash: 'hashed_password',
  role: 'cashier' as const,
  first_name: 'Mike',
  last_name: 'Johnson',
  phone: '555-0125',
  is_active: true
};

const testPrescription = {
  patient_id: 1, // Will be set after patient creation
  doctor_id: 1, // Will be set after doctor creation
  status: 'pending' as const,
  notes: 'Test prescription'
};

describe('Payment Handlers', () => {
  let patientId: number;
  let doctorId: number;
  let cashierId: number;
  let prescriptionId: number;

  beforeEach(async () => {
    await createDB();

    // Create test patient
    const patientResult = await db.insert(patientsTable)
      .values(testPatient)
      .returning()
      .execute();
    patientId = patientResult[0].id;

    // Create test doctor
    const doctorResult = await db.insert(usersTable)
      .values(testDoctor)
      .returning()
      .execute();
    doctorId = doctorResult[0].id;

    // Create test cashier
    const cashierResult = await db.insert(usersTable)
      .values(testCashier)
      .returning()
      .execute();
    cashierId = cashierResult[0].id;

    // Create test prescription
    const prescriptionResult = await db.insert(prescriptionsTable)
      .values({
        ...testPrescription,
        patient_id: patientId,
        doctor_id: doctorId
      })
      .returning()
      .execute();
    prescriptionId = prescriptionResult[0].id;
  });

  afterEach(resetDB);

  describe('createPayment', () => {
    const validPaymentInput: CreatePaymentInput = {
      patient_id: 1, // Will be set in test
      prescription_id: 1, // Will be set in test
      amount: 150.75,
      payment_method: 'cash',
      notes: 'Payment for prescription',
      created_by: 1 // Will be set in test
    };

    it('should create a payment with prescription', async () => {
      const input = {
        ...validPaymentInput,
        patient_id: patientId,
        prescription_id: prescriptionId,
        created_by: cashierId
      };

      const result = await createPayment(input);

      expect(result.id).toBeDefined();
      expect(result.patient_id).toEqual(patientId);
      expect(result.prescription_id).toEqual(prescriptionId);
      expect(result.amount).toEqual(150.75);
      expect(typeof result.amount).toBe('number');
      expect(result.payment_method).toEqual('cash');
      expect(result.notes).toEqual('Payment for prescription');
      expect(result.created_by).toEqual(cashierId);
      expect(result.payment_date).toBeInstanceOf(Date);
      expect(result.created_at).toBeInstanceOf(Date);
    });

    it('should create a payment without prescription', async () => {
      const input = {
        ...validPaymentInput,
        patient_id: patientId,
        prescription_id: null,
        created_by: cashierId
      };

      const result = await createPayment(input);

      expect(result.id).toBeDefined();
      expect(result.patient_id).toEqual(patientId);
      expect(result.prescription_id).toBeNull();
      expect(result.amount).toEqual(150.75);
      expect(result.payment_method).toEqual('cash');
      expect(result.created_by).toEqual(cashierId);
    });

    it('should save payment to database', async () => {
      const input = {
        ...validPaymentInput,
        patient_id: patientId,
        prescription_id: prescriptionId,
        created_by: cashierId
      };

      const result = await createPayment(input);

      const savedPayments = await db.select()
        .from(paymentsTable)
        .where(eq(paymentsTable.id, result.id))
        .execute();

      expect(savedPayments).toHaveLength(1);
      expect(savedPayments[0].patient_id).toEqual(patientId);
      expect(parseFloat(savedPayments[0].amount)).toEqual(150.75);
      expect(savedPayments[0].payment_method).toEqual('cash');
    });

    it('should throw error for non-existent patient', async () => {
      const input = {
        ...validPaymentInput,
        patient_id: 9999,
        created_by: cashierId
      };

      await expect(createPayment(input)).rejects.toThrow('Patient with ID 9999 not found');
    });

    it('should throw error for non-existent prescription', async () => {
      const input = {
        ...validPaymentInput,
        patient_id: patientId,
        prescription_id: 9999,
        created_by: cashierId
      };

      await expect(createPayment(input)).rejects.toThrow('Prescription with ID 9999 not found');
    });

    it('should throw error for non-existent user', async () => {
      const input = {
        ...validPaymentInput,
        patient_id: patientId,
        created_by: 9999
      };

      await expect(createPayment(input)).rejects.toThrow('User with ID 9999 not found');
    });
  });

  describe('getPayments', () => {
    beforeEach(async () => {
      // Create test payments
      await db.insert(paymentsTable)
        .values([
          {
            patient_id: patientId,
            prescription_id: prescriptionId,
            amount: '100.50',
            payment_method: 'cash',
            notes: 'First payment',
            created_by: cashierId
          },
          {
            patient_id: patientId,
            prescription_id: null,
            amount: '75.25',
            payment_method: 'card',
            notes: 'Second payment',
            created_by: cashierId
          }
        ])
        .execute();
    });

    it('should return all payments', async () => {
      const result = await getPayments();

      expect(result).toHaveLength(2);
      expect(result[0].amount).toEqual(100.50);
      expect(typeof result[0].amount).toBe('number');
      expect(result[0].payment_method).toEqual('cash');
      expect(result[1].amount).toEqual(75.25);
      expect(result[1].payment_method).toEqual('card');
    });

    it('should return empty array when no payments exist', async () => {
      await resetDB();
      await createDB();

      const result = await getPayments();

      expect(result).toHaveLength(0);
    });
  });

  describe('getPaymentById', () => {
    let paymentId: number;

    beforeEach(async () => {
      const paymentResult = await db.insert(paymentsTable)
        .values({
          patient_id: patientId,
          prescription_id: prescriptionId,
          amount: '200.00',
          payment_method: 'insurance',
          notes: 'Insurance payment',
          created_by: cashierId
        })
        .returning()
        .execute();
      paymentId = paymentResult[0].id;
    });

    it('should return payment by ID', async () => {
      const result = await getPaymentById(paymentId);

      expect(result).not.toBeNull();
      expect(result!.id).toEqual(paymentId);
      expect(result!.amount).toEqual(200.00);
      expect(typeof result!.amount).toBe('number');
      expect(result!.payment_method).toEqual('insurance');
      expect(result!.notes).toEqual('Insurance payment');
    });

    it('should return null for non-existent ID', async () => {
      const result = await getPaymentById(9999);

      expect(result).toBeNull();
    });
  });

  describe('getPaymentsByPatientId', () => {
    let otherPatientId: number;

    beforeEach(async () => {
      // Create another patient
      const otherPatientResult = await db.insert(patientsTable)
        .values({
          ...testPatient,
          email: 'other@example.com',
          first_name: 'Jane'
        })
        .returning()
        .execute();
      otherPatientId = otherPatientResult[0].id;

      // Create payments for both patients
      await db.insert(paymentsTable)
        .values([
          {
            patient_id: patientId,
            prescription_id: null,
            amount: '50.00',
            payment_method: 'cash',
            created_by: cashierId
          },
          {
            patient_id: patientId,
            prescription_id: null,
            amount: '75.00',
            payment_method: 'card',
            created_by: cashierId
          },
          {
            patient_id: otherPatientId,
            prescription_id: null,
            amount: '100.00',
            payment_method: 'cash',
            created_by: cashierId
          }
        ])
        .execute();
    });

    it('should return payments for specific patient', async () => {
      const result = await getPaymentsByPatientId(patientId);

      expect(result).toHaveLength(2);
      expect(result.every(p => p.patient_id === patientId)).toBe(true);
      expect(result[0].amount).toEqual(50.00);
      expect(result[1].amount).toEqual(75.00);
    });

    it('should return empty array for patient with no payments', async () => {
      // Create a new patient without payments
      const newPatientResult = await db.insert(patientsTable)
        .values({
          ...testPatient,
          email: 'nopayments@example.com',
          first_name: 'NoPayments'
        })
        .returning()
        .execute();

      const result = await getPaymentsByPatientId(newPatientResult[0].id);

      expect(result).toHaveLength(0);
    });
  });

  describe('getPaymentsByDateRange', () => {
    beforeEach(async () => {
      const today = new Date();
      today.setHours(12, 0, 0, 0); // Set to noon to avoid timezone issues
      
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);
      
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Create payments with different dates
      await db.insert(paymentsTable)
        .values([
          {
            patient_id: patientId,
            prescription_id: null,
            amount: '50.00',
            payment_method: 'cash',
            payment_date: yesterday,
            created_by: cashierId
          },
          {
            patient_id: patientId,
            prescription_id: null,
            amount: '75.00',
            payment_method: 'card',
            payment_date: today,
            created_by: cashierId
          },
          {
            patient_id: patientId,
            prescription_id: null,
            amount: '100.00',
            payment_method: 'cash',
            payment_date: tomorrow,
            created_by: cashierId
          }
        ])
        .execute();
    });

    it('should return payments within date range', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Set to start of day for proper comparison
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(23, 59, 59, 999); // Set to end of tomorrow

      const result = await getPaymentsByDateRange(today, tomorrow);

      expect(result).toHaveLength(2);
      expect(result[0].amount).toEqual(75.00);
      expect(result[1].amount).toEqual(100.00);
    });

    it('should return empty array when no payments in range', async () => {
      const futureStart = new Date();
      futureStart.setDate(futureStart.getDate() + 10);
      const futureEnd = new Date();
      futureEnd.setDate(futureEnd.getDate() + 20);

      const result = await getPaymentsByDateRange(futureStart, futureEnd);

      expect(result).toHaveLength(0);
    });
  });

  describe('getPaymentsByPrescriptionId', () => {
    let otherPrescriptionId: number;

    beforeEach(async () => {
      // Create another prescription
      const otherPrescriptionResult = await db.insert(prescriptionsTable)
        .values({
          patient_id: patientId,
          doctor_id: doctorId,
          status: 'pending',
          notes: 'Another prescription'
        })
        .returning()
        .execute();
      otherPrescriptionId = otherPrescriptionResult[0].id;

      // Create payments for both prescriptions
      await db.insert(paymentsTable)
        .values([
          {
            patient_id: patientId,
            prescription_id: prescriptionId,
            amount: '60.00',
            payment_method: 'cash',
            created_by: cashierId
          },
          {
            patient_id: patientId,
            prescription_id: prescriptionId,
            amount: '40.00',
            payment_method: 'card',
            created_by: cashierId
          },
          {
            patient_id: patientId,
            prescription_id: otherPrescriptionId,
            amount: '80.00',
            payment_method: 'cash',
            created_by: cashierId
          }
        ])
        .execute();
    });

    it('should return payments for specific prescription', async () => {
      const result = await getPaymentsByPrescriptionId(prescriptionId);

      expect(result).toHaveLength(2);
      expect(result.every(p => p.prescription_id === prescriptionId)).toBe(true);
      expect(result[0].amount).toEqual(60.00);
      expect(result[1].amount).toEqual(40.00);
    });

    it('should return empty array for prescription with no payments', async () => {
      // Create a new prescription without payments
      const newPrescriptionResult = await db.insert(prescriptionsTable)
        .values({
          patient_id: patientId,
          doctor_id: doctorId,
          status: 'pending',
          notes: 'No payments prescription'
        })
        .returning()
        .execute();

      const result = await getPaymentsByPrescriptionId(newPrescriptionResult[0].id);

      expect(result).toHaveLength(0);
    });
  });

  describe('getDailyPaymentSummary', () => {
    beforeEach(async () => {
      const today = new Date();
      today.setHours(10, 0, 0, 0); // Set to middle of day
      
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      // Create payments for today and yesterday
      await db.insert(paymentsTable)
        .values([
          // Today's payments
          {
            patient_id: patientId,
            prescription_id: null,
            amount: '100.00',
            payment_method: 'cash',
            payment_date: today,
            created_by: cashierId
          },
          {
            patient_id: patientId,
            prescription_id: null,
            amount: '150.50',
            payment_method: 'card',
            payment_date: today,
            created_by: cashierId
          },
          {
            patient_id: patientId,
            prescription_id: null,
            amount: '75.25',
            payment_method: 'cash',
            payment_date: today,
            created_by: cashierId
          },
          // Yesterday's payment (should not be included)
          {
            patient_id: patientId,
            prescription_id: null,
            amount: '200.00',
            payment_method: 'insurance',
            payment_date: yesterday,
            created_by: cashierId
          }
        ])
        .execute();
    });

    it('should return daily payment summary', async () => {
      const today = new Date();
      
      const result = await getDailyPaymentSummary(today);

      expect(result.total).toEqual(325.75); // 100 + 150.50 + 75.25
      expect(result.count).toEqual(3);
      expect(result.byMethod['cash']).toEqual(175.25); // 100 + 75.25
      expect(result.byMethod['card']).toEqual(150.50);
      expect(result.byMethod['insurance']).toBeUndefined();
    });

    it('should return zero summary for day with no payments', async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);

      const result = await getDailyPaymentSummary(tomorrow);

      expect(result.total).toEqual(0);
      expect(result.count).toEqual(0);
      expect(Object.keys(result.byMethod)).toHaveLength(0);
    });
  });
});