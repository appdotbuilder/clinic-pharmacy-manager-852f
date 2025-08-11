import { db } from '../db';
import { paymentsTable, patientsTable, prescriptionsTable, usersTable } from '../db/schema';
import { type CreatePaymentInput, type Payment } from '../schema';
import { eq, and, gte, lte, between, sql } from 'drizzle-orm';
import { type SQL } from 'drizzle-orm';

// Create a new payment
export async function createPayment(input: CreatePaymentInput): Promise<Payment> {
  try {
    // Verify patient exists
    const patient = await db.select()
      .from(patientsTable)
      .where(eq(patientsTable.id, input.patient_id))
      .limit(1)
      .execute();

    if (patient.length === 0) {
      throw new Error(`Patient with ID ${input.patient_id} not found`);
    }

    // Verify prescription exists if provided
    if (input.prescription_id) {
      const prescription = await db.select()
        .from(prescriptionsTable)
        .where(eq(prescriptionsTable.id, input.prescription_id))
        .limit(1)
        .execute();

      if (prescription.length === 0) {
        throw new Error(`Prescription with ID ${input.prescription_id} not found`);
      }
    }

    // Verify created_by user exists
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.created_by))
      .limit(1)
      .execute();

    if (user.length === 0) {
      throw new Error(`User with ID ${input.created_by} not found`);
    }

    // Insert payment record
    const result = await db.insert(paymentsTable)
      .values({
        patient_id: input.patient_id,
        prescription_id: input.prescription_id || null,
        amount: input.amount.toString(), // Convert number to string for numeric column
        payment_method: input.payment_method,
        notes: input.notes || null,
        created_by: input.created_by
      })
      .returning()
      .execute();

    // Convert numeric field back to number
    const payment = result[0];
    return {
      ...payment,
      amount: parseFloat(payment.amount) // Convert string back to number
    };
  } catch (error) {
    console.error('Payment creation failed:', error);
    throw error;
  }
}

// Get all payments
export async function getPayments(): Promise<Payment[]> {
  try {
    const results = await db.select()
      .from(paymentsTable)
      .execute();

    // Convert numeric fields back to numbers
    return results.map(payment => ({
      ...payment,
      amount: parseFloat(payment.amount)
    }));
  } catch (error) {
    console.error('Failed to fetch payments:', error);
    throw error;
  }
}

// Get payment by ID
export async function getPaymentById(id: number): Promise<Payment | null> {
  try {
    const results = await db.select()
      .from(paymentsTable)
      .where(eq(paymentsTable.id, id))
      .limit(1)
      .execute();

    if (results.length === 0) {
      return null;
    }

    const payment = results[0];
    return {
      ...payment,
      amount: parseFloat(payment.amount)
    };
  } catch (error) {
    console.error('Failed to fetch payment by ID:', error);
    throw error;
  }
}

// Get payments by patient ID
export async function getPaymentsByPatientId(patientId: number): Promise<Payment[]> {
  try {
    const results = await db.select()
      .from(paymentsTable)
      .where(eq(paymentsTable.patient_id, patientId))
      .execute();

    return results.map(payment => ({
      ...payment,
      amount: parseFloat(payment.amount)
    }));
  } catch (error) {
    console.error('Failed to fetch payments by patient ID:', error);
    throw error;
  }
}

// Get payments by date range
export async function getPaymentsByDateRange(startDate: Date, endDate: Date): Promise<Payment[]> {
  try {
    const results = await db.select()
      .from(paymentsTable)
      .where(
        and(
          gte(paymentsTable.payment_date, startDate),
          lte(paymentsTable.payment_date, endDate)
        )
      )
      .execute();

    return results.map(payment => ({
      ...payment,
      amount: parseFloat(payment.amount)
    }));
  } catch (error) {
    console.error('Failed to fetch payments by date range:', error);
    throw error;
  }
}

// Get payments by prescription ID
export async function getPaymentsByPrescriptionId(prescriptionId: number): Promise<Payment[]> {
  try {
    const results = await db.select()
      .from(paymentsTable)
      .where(eq(paymentsTable.prescription_id, prescriptionId))
      .execute();

    return results.map(payment => ({
      ...payment,
      amount: parseFloat(payment.amount)
    }));
  } catch (error) {
    console.error('Failed to fetch payments by prescription ID:', error);
    throw error;
  }
}

// Get daily payment summary
export async function getDailyPaymentSummary(date: Date): Promise<{ total: number; count: number; byMethod: Record<string, number> }> {
  try {
    // Get start and end of the day
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const results = await db.select({
      amount: paymentsTable.amount,
      payment_method: paymentsTable.payment_method
    })
    .from(paymentsTable)
    .where(
      between(paymentsTable.payment_date, startOfDay, endOfDay)
    )
    .execute();

    // Calculate summary statistics
    let total = 0;
    const count = results.length;
    const byMethod: Record<string, number> = {};

    results.forEach(payment => {
      const amount = parseFloat(payment.amount);
      total += amount;
      
      if (byMethod[payment.payment_method]) {
        byMethod[payment.payment_method] += amount;
      } else {
        byMethod[payment.payment_method] = amount;
      }
    });

    return {
      total,
      count,
      byMethod
    };
  } catch (error) {
    console.error('Failed to fetch daily payment summary:', error);
    throw error;
  }
}