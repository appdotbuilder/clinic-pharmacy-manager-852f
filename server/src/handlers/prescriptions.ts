import { db } from '../db';
import { prescriptionsTable, prescriptionItemsTable, medicinesTable, patientsTable, usersTable } from '../db/schema';
import { type CreatePrescriptionInput, type UpdatePrescriptionStatusInput, type Prescription, type PrescriptionItem } from '../schema';
import { eq, sql, and, SQL } from 'drizzle-orm';

// Create a new prescription with items
export async function createPrescription(input: CreatePrescriptionInput): Promise<Prescription> {
  try {
    // Verify patient exists
    const patientExists = await db.select({ id: patientsTable.id })
      .from(patientsTable)
      .where(eq(patientsTable.id, input.patient_id))
      .execute();
    
    if (patientExists.length === 0) {
      throw new Error(`Patient with id ${input.patient_id} does not exist`);
    }

    // Verify doctor exists
    const doctorExists = await db.select({ id: usersTable.id })
      .from(usersTable)
      .where(and(eq(usersTable.id, input.doctor_id), eq(usersTable.role, 'doctor')))
      .execute();
    
    if (doctorExists.length === 0) {
      throw new Error(`Doctor with id ${input.doctor_id} does not exist`);
    }

    // Verify all medicines exist and have sufficient stock
    for (const item of input.items) {
      const medicine = await db.select({ id: medicinesTable.id, stock_quantity: medicinesTable.stock_quantity })
        .from(medicinesTable)
        .where(eq(medicinesTable.id, item.medicine_id))
        .execute();
      
      if (medicine.length === 0) {
        throw new Error(`Medicine with id ${item.medicine_id} does not exist`);
      }
      
      if (medicine[0].stock_quantity < item.quantity_prescribed) {
        throw new Error(`Insufficient stock for medicine id ${item.medicine_id}. Available: ${medicine[0].stock_quantity}, Required: ${item.quantity_prescribed}`);
      }
    }

    // Create prescription
    const prescriptionResult = await db.insert(prescriptionsTable)
      .values({
        patient_id: input.patient_id,
        doctor_id: input.doctor_id,
        notes: input.notes || null,
        status: 'pending'
      })
      .returning()
      .execute();

    const prescription = prescriptionResult[0];

    // Create prescription items and update medicine stock
    for (const item of input.items) {
      await db.insert(prescriptionItemsTable)
        .values({
          prescription_id: prescription.id,
          medicine_id: item.medicine_id,
          quantity_prescribed: item.quantity_prescribed,
          quantity_filled: 0,
          dosage_instructions: item.dosage_instructions || null
        })
        .execute();

      // Update medicine stock
      await db.update(medicinesTable)
        .set({
          stock_quantity: sql`${medicinesTable.stock_quantity} - ${item.quantity_prescribed}`,
          updated_at: sql`NOW()`
        })
        .where(eq(medicinesTable.id, item.medicine_id))
        .execute();
    }

    return prescription;
  } catch (error) {
    console.error('Prescription creation failed:', error);
    throw error;
  }
}

// Get all prescriptions
export async function getPrescriptions(): Promise<Prescription[]> {
  try {
    const prescriptions = await db.select()
      .from(prescriptionsTable)
      .execute();

    return prescriptions;
  } catch (error) {
    console.error('Get prescriptions failed:', error);
    throw error;
  }
}

// Get prescription by ID with items
export async function getPrescriptionById(id: number): Promise<(Prescription & { items: PrescriptionItem[] }) | null> {
  try {
    const prescriptions = await db.select()
      .from(prescriptionsTable)
      .where(eq(prescriptionsTable.id, id))
      .execute();

    if (prescriptions.length === 0) {
      return null;
    }

    const prescription = prescriptions[0];

    const items = await db.select()
      .from(prescriptionItemsTable)
      .where(eq(prescriptionItemsTable.prescription_id, id))
      .execute();

    return {
      ...prescription,
      items: items
    };
  } catch (error) {
    console.error('Get prescription by ID failed:', error);
    throw error;
  }
}

// Get prescriptions by patient ID
export async function getPrescriptionsByPatientId(patientId: number): Promise<Prescription[]> {
  try {
    const prescriptions = await db.select()
      .from(prescriptionsTable)
      .where(eq(prescriptionsTable.patient_id, patientId))
      .execute();

    return prescriptions;
  } catch (error) {
    console.error('Get prescriptions by patient ID failed:', error);
    throw error;
  }
}

// Get prescriptions by doctor ID
export async function getPrescriptionsByDoctorId(doctorId: number): Promise<Prescription[]> {
  try {
    const prescriptions = await db.select()
      .from(prescriptionsTable)
      .where(eq(prescriptionsTable.doctor_id, doctorId))
      .execute();

    return prescriptions;
  } catch (error) {
    console.error('Get prescriptions by doctor ID failed:', error);
    throw error;
  }
}

// Update prescription status
export async function updatePrescriptionStatus(input: UpdatePrescriptionStatusInput): Promise<Prescription> {
  try {
    const result = await db.update(prescriptionsTable)
      .set({
        status: input.status,
        updated_at: sql`NOW()`
      })
      .where(eq(prescriptionsTable.id, input.id))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error(`Prescription with id ${input.id} not found`);
    }

    return result[0];
  } catch (error) {
    console.error('Update prescription status failed:', error);
    throw error;
  }
}

// Fill prescription item (update quantity filled)
export async function fillPrescriptionItem(prescriptionItemId: number, quantityFilled: number): Promise<PrescriptionItem> {
  try {
    // Get the current prescription item
    const items = await db.select()
      .from(prescriptionItemsTable)
      .where(eq(prescriptionItemsTable.id, prescriptionItemId))
      .execute();

    if (items.length === 0) {
      throw new Error(`Prescription item with id ${prescriptionItemId} not found`);
    }

    const item = items[0];
    const newQuantityFilled = item.quantity_filled + quantityFilled;

    if (newQuantityFilled > item.quantity_prescribed) {
      throw new Error(`Cannot fill more than prescribed. Prescribed: ${item.quantity_prescribed}, Already filled: ${item.quantity_filled}, Attempting to fill: ${quantityFilled}`);
    }

    // Update prescription item
    const updatedItems = await db.update(prescriptionItemsTable)
      .set({
        quantity_filled: newQuantityFilled
      })
      .where(eq(prescriptionItemsTable.id, prescriptionItemId))
      .returning()
      .execute();

    // Check if prescription should be updated to filled or partially filled
    const allItems = await db.select()
      .from(prescriptionItemsTable)
      .where(eq(prescriptionItemsTable.prescription_id, item.prescription_id))
      .execute();

    let prescriptionStatus: 'pending' | 'filled' | 'partially_filled' = 'pending';
    let allFilled = true;
    let anyFilled = false;

    for (const prescItem of allItems) {
      const currentQuantityFilled = prescItem.id === prescriptionItemId ? newQuantityFilled : prescItem.quantity_filled;
      
      if (currentQuantityFilled > 0) {
        anyFilled = true;
      }
      if (currentQuantityFilled < prescItem.quantity_prescribed) {
        allFilled = false;
      }
    }

    if (allFilled) {
      prescriptionStatus = 'filled';
    } else if (anyFilled) {
      prescriptionStatus = 'partially_filled';
    }

    // Update prescription status if necessary
    await db.update(prescriptionsTable)
      .set({
        status: prescriptionStatus,
        updated_at: sql`NOW()`
      })
      .where(eq(prescriptionsTable.id, item.prescription_id))
      .execute();

    return updatedItems[0];
  } catch (error) {
    console.error('Fill prescription item failed:', error);
    throw error;
  }
}

// Get pending prescriptions
export async function getPendingPrescriptions(): Promise<Prescription[]> {
  try {
    const prescriptions = await db.select()
      .from(prescriptionsTable)
      .where(eq(prescriptionsTable.status, 'pending'))
      .execute();

    return prescriptions;
  } catch (error) {
    console.error('Get pending prescriptions failed:', error);
    throw error;
  }
}