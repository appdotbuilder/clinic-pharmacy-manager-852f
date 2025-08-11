import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, patientsTable, medicinesTable, prescriptionsTable, prescriptionItemsTable } from '../db/schema';
import { type CreatePrescriptionInput, type UpdatePrescriptionStatusInput } from '../schema';
import {
  createPrescription,
  getPrescriptions,
  getPrescriptionById,
  getPrescriptionsByPatientId,
  getPrescriptionsByDoctorId,
  updatePrescriptionStatus,
  fillPrescriptionItem,
  getPendingPrescriptions
} from '../handlers/prescriptions';
import { eq } from 'drizzle-orm';

// Test data
const testDoctor = {
  email: 'doctor@test.com',
  password_hash: 'hashedpassword',
  role: 'doctor' as const,
  first_name: 'Dr. John',
  last_name: 'Smith',
  phone: '555-0123'
};

const testPatient = {
  first_name: 'Jane',
  last_name: 'Doe',
  email: 'jane@test.com',
  phone: '555-0124',
  address: '123 Main St',
  gender: 'female' as const,
  birthdate: '1990-01-01',
  allergies: 'Peanuts',
  chronic_conditions: null,
  medical_history: null
};

const testMedicine1 = {
  name: 'Aspirin',
  category: 'pain_relievers' as const,
  stock_quantity: 100,
  price_per_unit: '5.99',
  supplier_info: 'Pharma Corp',
  batch_number: 'ASP001',
  expiry_date: '2025-12-31',
  storage_conditions: 'Room temperature'
};

const testMedicine2 = {
  name: 'Amoxicillin',
  category: 'antibiotics' as const,
  stock_quantity: 50,
  price_per_unit: '12.99',
  supplier_info: 'Med Supply Co',
  batch_number: 'AMX001',
  expiry_date: '2025-06-30',
  storage_conditions: 'Cool, dry place'
};

describe('Prescription Handlers', () => {
  let doctorId: number;
  let patientId: number;
  let medicine1Id: number;
  let medicine2Id: number;

  beforeEach(async () => {
    await createDB();

    // Create test doctor
    const doctorResult = await db.insert(usersTable)
      .values(testDoctor)
      .returning()
      .execute();
    doctorId = doctorResult[0].id;

    // Create test patient
    const patientResult = await db.insert(patientsTable)
      .values(testPatient)
      .returning()
      .execute();
    patientId = patientResult[0].id;

    // Create test medicines
    const medicine1Result = await db.insert(medicinesTable)
      .values(testMedicine1)
      .returning()
      .execute();
    medicine1Id = medicine1Result[0].id;

    const medicine2Result = await db.insert(medicinesTable)
      .values(testMedicine2)
      .returning()
      .execute();
    medicine2Id = medicine2Result[0].id;
  });

  afterEach(resetDB);

  describe('createPrescription', () => {
    it('should create a prescription with items', async () => {
      const input: CreatePrescriptionInput = {
        patient_id: patientId,
        doctor_id: doctorId,
        notes: 'Take with food',
        items: [
          {
            medicine_id: medicine1Id,
            quantity_prescribed: 10,
            dosage_instructions: '1 tablet twice daily'
          },
          {
            medicine_id: medicine2Id,
            quantity_prescribed: 5,
            dosage_instructions: '500mg once daily'
          }
        ]
      };

      const result = await createPrescription(input);

      expect(result.patient_id).toEqual(patientId);
      expect(result.doctor_id).toEqual(doctorId);
      expect(result.status).toEqual('pending');
      expect(result.notes).toEqual('Take with food');
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);

      // Check prescription items were created
      const items = await db.select()
        .from(prescriptionItemsTable)
        .where(eq(prescriptionItemsTable.prescription_id, result.id))
        .execute();

      expect(items).toHaveLength(2);
      expect(items[0].medicine_id).toEqual(medicine1Id);
      expect(items[0].quantity_prescribed).toEqual(10);
      expect(items[0].quantity_filled).toEqual(0);
      expect(items[0].dosage_instructions).toEqual('1 tablet twice daily');

      // Check medicine stock was updated
      const medicines = await db.select()
        .from(medicinesTable)
        .where(eq(medicinesTable.id, medicine1Id))
        .execute();
      expect(medicines[0].stock_quantity).toEqual(90); // 100 - 10
    });

    it('should reject prescription with insufficient stock', async () => {
      const input: CreatePrescriptionInput = {
        patient_id: patientId,
        doctor_id: doctorId,
        notes: null,
        items: [
          {
            medicine_id: medicine1Id,
            quantity_prescribed: 150, // More than available (100)
            dosage_instructions: null
          }
        ]
      };

      await expect(createPrescription(input)).rejects.toThrow(/Insufficient stock/);
    });

    it('should reject prescription with non-existent patient', async () => {
      const input: CreatePrescriptionInput = {
        patient_id: 99999,
        doctor_id: doctorId,
        notes: null,
        items: [
          {
            medicine_id: medicine1Id,
            quantity_prescribed: 5,
            dosage_instructions: null
          }
        ]
      };

      await expect(createPrescription(input)).rejects.toThrow(/Patient with id 99999 does not exist/);
    });

    it('should reject prescription with non-existent doctor', async () => {
      const input: CreatePrescriptionInput = {
        patient_id: patientId,
        doctor_id: 99999,
        notes: null,
        items: [
          {
            medicine_id: medicine1Id,
            quantity_prescribed: 5,
            dosage_instructions: null
          }
        ]
      };

      await expect(createPrescription(input)).rejects.toThrow(/Doctor with id 99999 does not exist/);
    });

    it('should reject prescription with non-existent medicine', async () => {
      const input: CreatePrescriptionInput = {
        patient_id: patientId,
        doctor_id: doctorId,
        notes: null,
        items: [
          {
            medicine_id: 99999,
            quantity_prescribed: 5,
            dosage_instructions: null
          }
        ]
      };

      await expect(createPrescription(input)).rejects.toThrow(/Medicine with id 99999 does not exist/);
    });
  });

  describe('getPrescriptions', () => {
    it('should get all prescriptions', async () => {
      // Create test prescriptions
      const input1: CreatePrescriptionInput = {
        patient_id: patientId,
        doctor_id: doctorId,
        notes: 'First prescription',
        items: [
          {
            medicine_id: medicine1Id,
            quantity_prescribed: 10,
            dosage_instructions: '1 tablet daily'
          }
        ]
      };

      const input2: CreatePrescriptionInput = {
        patient_id: patientId,
        doctor_id: doctorId,
        notes: 'Second prescription',
        items: [
          {
            medicine_id: medicine2Id,
            quantity_prescribed: 5,
            dosage_instructions: '500mg daily'
          }
        ]
      };

      await createPrescription(input1);
      await createPrescription(input2);

      const result = await getPrescriptions();

      expect(result).toHaveLength(2);
      expect(result[0].notes).toEqual('First prescription');
      expect(result[1].notes).toEqual('Second prescription');
    });

    it('should return empty array when no prescriptions exist', async () => {
      const result = await getPrescriptions();
      expect(result).toHaveLength(0);
    });
  });

  describe('getPrescriptionById', () => {
    it('should get prescription with items', async () => {
      const input: CreatePrescriptionInput = {
        patient_id: patientId,
        doctor_id: doctorId,
        notes: 'Test prescription',
        items: [
          {
            medicine_id: medicine1Id,
            quantity_prescribed: 10,
            dosage_instructions: '1 tablet daily'
          }
        ]
      };

      const prescription = await createPrescription(input);
      const result = await getPrescriptionById(prescription.id);

      expect(result).not.toBeNull();
      expect(result!.id).toEqual(prescription.id);
      expect(result!.notes).toEqual('Test prescription');
      expect(result!.items).toHaveLength(1);
      expect(result!.items[0].medicine_id).toEqual(medicine1Id);
      expect(result!.items[0].quantity_prescribed).toEqual(10);
    });

    it('should return null for non-existent prescription', async () => {
      const result = await getPrescriptionById(99999);
      expect(result).toBeNull();
    });
  });

  describe('getPrescriptionsByPatientId', () => {
    it('should get prescriptions for specific patient', async () => {
      // Create another patient
      const patient2Result = await db.insert(patientsTable)
        .values({
          ...testPatient,
          email: 'patient2@test.com'
        })
        .returning()
        .execute();
      const patient2Id = patient2Result[0].id;

      // Create prescriptions for both patients
      const input1: CreatePrescriptionInput = {
        patient_id: patientId,
        doctor_id: doctorId,
        notes: 'For patient 1',
        items: [
          {
            medicine_id: medicine1Id,
            quantity_prescribed: 10,
            dosage_instructions: null
          }
        ]
      };

      const input2: CreatePrescriptionInput = {
        patient_id: patient2Id,
        doctor_id: doctorId,
        notes: 'For patient 2',
        items: [
          {
            medicine_id: medicine2Id,
            quantity_prescribed: 5,
            dosage_instructions: null
          }
        ]
      };

      await createPrescription(input1);
      await createPrescription(input2);

      const result = await getPrescriptionsByPatientId(patientId);

      expect(result).toHaveLength(1);
      expect(result[0].patient_id).toEqual(patientId);
      expect(result[0].notes).toEqual('For patient 1');
    });

    it('should return empty array for patient with no prescriptions', async () => {
      const result = await getPrescriptionsByPatientId(99999);
      expect(result).toHaveLength(0);
    });
  });

  describe('getPrescriptionsByDoctorId', () => {
    it('should get prescriptions for specific doctor', async () => {
      // Create another doctor
      const doctor2Result = await db.insert(usersTable)
        .values({
          ...testDoctor,
          email: 'doctor2@test.com'
        })
        .returning()
        .execute();
      const doctor2Id = doctor2Result[0].id;

      // Create prescriptions for both doctors
      const input1: CreatePrescriptionInput = {
        patient_id: patientId,
        doctor_id: doctorId,
        notes: 'From doctor 1',
        items: [
          {
            medicine_id: medicine1Id,
            quantity_prescribed: 10,
            dosage_instructions: null
          }
        ]
      };

      const input2: CreatePrescriptionInput = {
        patient_id: patientId,
        doctor_id: doctor2Id,
        notes: 'From doctor 2',
        items: [
          {
            medicine_id: medicine2Id,
            quantity_prescribed: 5,
            dosage_instructions: null
          }
        ]
      };

      await createPrescription(input1);
      await createPrescription(input2);

      const result = await getPrescriptionsByDoctorId(doctorId);

      expect(result).toHaveLength(1);
      expect(result[0].doctor_id).toEqual(doctorId);
      expect(result[0].notes).toEqual('From doctor 1');
    });

    it('should return empty array for doctor with no prescriptions', async () => {
      const result = await getPrescriptionsByDoctorId(99999);
      expect(result).toHaveLength(0);
    });
  });

  describe('updatePrescriptionStatus', () => {
    it('should update prescription status', async () => {
      const input: CreatePrescriptionInput = {
        patient_id: patientId,
        doctor_id: doctorId,
        notes: 'Test prescription',
        items: [
          {
            medicine_id: medicine1Id,
            quantity_prescribed: 10,
            dosage_instructions: null
          }
        ]
      };

      const prescription = await createPrescription(input);

      const updateInput: UpdatePrescriptionStatusInput = {
        id: prescription.id,
        status: 'filled'
      };

      const result = await updatePrescriptionStatus(updateInput);

      expect(result.id).toEqual(prescription.id);
      expect(result.status).toEqual('filled');
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should reject update for non-existent prescription', async () => {
      const updateInput: UpdatePrescriptionStatusInput = {
        id: 99999,
        status: 'filled'
      };

      await expect(updatePrescriptionStatus(updateInput)).rejects.toThrow(/Prescription with id 99999 not found/);
    });
  });

  describe('fillPrescriptionItem', () => {
    it('should fill prescription item and update prescription status', async () => {
      const input: CreatePrescriptionInput = {
        patient_id: patientId,
        doctor_id: doctorId,
        notes: 'Test prescription',
        items: [
          {
            medicine_id: medicine1Id,
            quantity_prescribed: 10,
            dosage_instructions: null
          }
        ]
      };

      const prescription = await createPrescription(input);
      const prescriptionWithItems = await getPrescriptionById(prescription.id);
      const itemId = prescriptionWithItems!.items[0].id;

      const result = await fillPrescriptionItem(itemId, 5);

      expect(result.id).toEqual(itemId);
      expect(result.quantity_filled).toEqual(5);

      // Check prescription status updated to partially_filled
      const updatedPrescription = await getPrescriptionById(prescription.id);
      expect(updatedPrescription!.status).toEqual('partially_filled');
    });

    it('should update prescription status to filled when all items filled', async () => {
      const input: CreatePrescriptionInput = {
        patient_id: patientId,
        doctor_id: doctorId,
        notes: 'Test prescription',
        items: [
          {
            medicine_id: medicine1Id,
            quantity_prescribed: 10,
            dosage_instructions: null
          }
        ]
      };

      const prescription = await createPrescription(input);
      const prescriptionWithItems = await getPrescriptionById(prescription.id);
      const itemId = prescriptionWithItems!.items[0].id;

      await fillPrescriptionItem(itemId, 10); // Fill completely

      const updatedPrescription = await getPrescriptionById(prescription.id);
      expect(updatedPrescription!.status).toEqual('filled');
    });

    it('should reject overfilling prescription item', async () => {
      const input: CreatePrescriptionInput = {
        patient_id: patientId,
        doctor_id: doctorId,
        notes: 'Test prescription',
        items: [
          {
            medicine_id: medicine1Id,
            quantity_prescribed: 10,
            dosage_instructions: null
          }
        ]
      };

      const prescription = await createPrescription(input);
      const prescriptionWithItems = await getPrescriptionById(prescription.id);
      const itemId = prescriptionWithItems!.items[0].id;

      await expect(fillPrescriptionItem(itemId, 15)).rejects.toThrow(/Cannot fill more than prescribed/);
    });

    it('should reject filling non-existent prescription item', async () => {
      await expect(fillPrescriptionItem(99999, 5)).rejects.toThrow(/Prescription item with id 99999 not found/);
    });
  });

  describe('getPendingPrescriptions', () => {
    it('should get only pending prescriptions', async () => {
      // Create prescriptions with different statuses
      const input1: CreatePrescriptionInput = {
        patient_id: patientId,
        doctor_id: doctorId,
        notes: 'Pending prescription',
        items: [
          {
            medicine_id: medicine1Id,
            quantity_prescribed: 10,
            dosage_instructions: null
          }
        ]
      };

      const input2: CreatePrescriptionInput = {
        patient_id: patientId,
        doctor_id: doctorId,
        notes: 'Another prescription',
        items: [
          {
            medicine_id: medicine2Id,
            quantity_prescribed: 5,
            dosage_instructions: null
          }
        ]
      };

      const prescription1 = await createPrescription(input1);
      const prescription2 = await createPrescription(input2);

      // Update one prescription to filled
      await updatePrescriptionStatus({
        id: prescription2.id,
        status: 'filled'
      });

      const result = await getPendingPrescriptions();

      expect(result).toHaveLength(1);
      expect(result[0].id).toEqual(prescription1.id);
      expect(result[0].status).toEqual('pending');
    });

    it('should return empty array when no pending prescriptions exist', async () => {
      const result = await getPendingPrescriptions();
      expect(result).toHaveLength(0);
    });
  });
});