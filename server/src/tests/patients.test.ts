import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { patientsTable } from '../db/schema';
import { type CreatePatientInput, type UpdatePatientInput } from '../schema';
import { 
  createPatient, 
  getPatients, 
  getPatientById, 
  updatePatient, 
  searchPatients 
} from '../handlers/patients';
import { eq } from 'drizzle-orm';

// Test input data
const testPatientInput: CreatePatientInput = {
  first_name: 'John',
  last_name: 'Doe',
  email: 'john.doe@example.com',
  phone: '+1234567890',
  address: '123 Main St, City, State',
  gender: 'male',
  birthdate: new Date('1985-05-15'),
  allergies: 'Penicillin, Peanuts',
  chronic_conditions: 'Hypertension',
  medical_history: 'Previous heart surgery in 2020'
};

const minimalPatientInput: CreatePatientInput = {
  first_name: 'Jane',
  last_name: 'Smith',
  gender: 'female',
  birthdate: new Date('1990-08-20')
};

describe('Patient Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('createPatient', () => {
    it('should create a patient with all fields', async () => {
      const result = await createPatient(testPatientInput);

      expect(result.first_name).toEqual('John');
      expect(result.last_name).toEqual('Doe');
      expect(result.email).toEqual('john.doe@example.com');
      expect(result.phone).toEqual('+1234567890');
      expect(result.address).toEqual('123 Main St, City, State');
      expect(result.gender).toEqual('male');
      expect(result.birthdate).toBeInstanceOf(Date);
      expect(result.birthdate.toISOString().split('T')[0]).toEqual('1985-05-15');
      expect(result.allergies).toEqual('Penicillin, Peanuts');
      expect(result.chronic_conditions).toEqual('Hypertension');
      expect(result.medical_history).toEqual('Previous heart surgery in 2020');
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should create a patient with minimal required fields', async () => {
      const result = await createPatient(minimalPatientInput);

      expect(result.first_name).toEqual('Jane');
      expect(result.last_name).toEqual('Smith');
      expect(result.gender).toEqual('female');
      expect(result.birthdate).toBeInstanceOf(Date);
      expect(result.email).toBeNull();
      expect(result.phone).toBeNull();
      expect(result.address).toBeNull();
      expect(result.allergies).toBeNull();
      expect(result.chronic_conditions).toBeNull();
      expect(result.medical_history).toBeNull();
      expect(result.id).toBeDefined();
    });

    it('should save patient to database', async () => {
      const result = await createPatient(testPatientInput);

      const patients = await db.select()
        .from(patientsTable)
        .where(eq(patientsTable.id, result.id))
        .execute();

      expect(patients).toHaveLength(1);
      expect(patients[0].first_name).toEqual('John');
      expect(patients[0].last_name).toEqual('Doe');
      expect(patients[0].email).toEqual('john.doe@example.com');
    });
  });

  describe('getPatients', () => {
    it('should return empty array when no patients exist', async () => {
      const patients = await getPatients();
      expect(patients).toEqual([]);
    });

    it('should return all patients', async () => {
      await createPatient(testPatientInput);
      await createPatient(minimalPatientInput);

      const patients = await getPatients();

      expect(patients).toHaveLength(2);
      expect(patients[0].first_name).toEqual('John');
      expect(patients[1].first_name).toEqual('Jane');
    });

    it('should return patients with correct field types', async () => {
      await createPatient(testPatientInput);

      const patients = await getPatients();

      expect(patients).toHaveLength(1);
      const patient = patients[0];
      expect(patient.id).toEqual(expect.any(Number));
      expect(patient.birthdate).toBeInstanceOf(Date);
      expect(patient.created_at).toBeInstanceOf(Date);
      expect(patient.updated_at).toBeInstanceOf(Date);
    });
  });

  describe('getPatientById', () => {
    it('should return null for non-existent patient', async () => {
      const patient = await getPatientById(999);
      expect(patient).toBeNull();
    });

    it('should return patient by ID', async () => {
      const created = await createPatient(testPatientInput);

      const patient = await getPatientById(created.id);

      expect(patient).not.toBeNull();
      expect(patient!.id).toEqual(created.id);
      expect(patient!.first_name).toEqual('John');
      expect(patient!.last_name).toEqual('Doe');
      expect(patient!.email).toEqual('john.doe@example.com');
    });

    it('should return correct field types', async () => {
      const created = await createPatient(testPatientInput);

      const patient = await getPatientById(created.id);

      expect(patient).not.toBeNull();
      expect(patient!.birthdate).toBeInstanceOf(Date);
      expect(patient!.created_at).toBeInstanceOf(Date);
      expect(patient!.updated_at).toBeInstanceOf(Date);
    });
  });

  describe('updatePatient', () => {
    it('should update patient with partial data', async () => {
      const created = await createPatient(testPatientInput);

      const updateInput: UpdatePatientInput = {
        id: created.id,
        first_name: 'Johnny',
        phone: '+9876543210'
      };

      const updated = await updatePatient(updateInput);

      expect(updated.id).toEqual(created.id);
      expect(updated.first_name).toEqual('Johnny');
      expect(updated.last_name).toEqual('Doe'); // Unchanged
      expect(updated.phone).toEqual('+9876543210');
      expect(updated.email).toEqual('john.doe@example.com'); // Unchanged
      expect(updated.updated_at).not.toEqual(created.updated_at);
    });

    it('should update all patient fields', async () => {
      const created = await createPatient(minimalPatientInput);

      const updateInput: UpdatePatientInput = {
        id: created.id,
        first_name: 'Janet',
        last_name: 'Johnson',
        email: 'janet.johnson@example.com',
        phone: '+1111111111',
        address: '456 Oak Ave',
        gender: 'other',
        birthdate: new Date('1992-12-25'),
        allergies: 'Shellfish',
        chronic_conditions: 'Diabetes',
        medical_history: 'No significant history'
      };

      const updated = await updatePatient(updateInput);

      expect(updated.first_name).toEqual('Janet');
      expect(updated.last_name).toEqual('Johnson');
      expect(updated.email).toEqual('janet.johnson@example.com');
      expect(updated.phone).toEqual('+1111111111');
      expect(updated.address).toEqual('456 Oak Ave');
      expect(updated.gender).toEqual('other');
      expect(updated.birthdate.toISOString().split('T')[0]).toEqual('1992-12-25');
      expect(updated.allergies).toEqual('Shellfish');
      expect(updated.chronic_conditions).toEqual('Diabetes');
      expect(updated.medical_history).toEqual('No significant history');
    });

    it('should handle nullable fields correctly', async () => {
      const created = await createPatient(testPatientInput);

      const updateInput: UpdatePatientInput = {
        id: created.id,
        email: null,
        phone: null,
        allergies: null
      };

      const updated = await updatePatient(updateInput);

      expect(updated.email).toBeNull();
      expect(updated.phone).toBeNull();
      expect(updated.allergies).toBeNull();
      expect(updated.first_name).toEqual('John'); // Unchanged
    });

    it('should persist changes to database', async () => {
      const created = await createPatient(testPatientInput);

      await updatePatient({
        id: created.id,
        first_name: 'Updated John'
      });

      const patient = await db.select()
        .from(patientsTable)
        .where(eq(patientsTable.id, created.id))
        .execute();

      expect(patient[0].first_name).toEqual('Updated John');
    });

    it('should throw error for non-existent patient', async () => {
      const updateInput: UpdatePatientInput = {
        id: 999,
        first_name: 'Non-existent'
      };

      await expect(updatePatient(updateInput)).rejects.toThrow(/Patient with ID 999 not found/);
    });
  });

  describe('searchPatients', () => {
    beforeEach(async () => {
      await createPatient({
        first_name: 'John',
        last_name: 'Doe',
        gender: 'male',
        birthdate: new Date('1985-05-15')
      });

      await createPatient({
        first_name: 'Jane',
        last_name: 'Smith',
        gender: 'female',
        birthdate: new Date('1990-08-20')
      });

      await createPatient({
        first_name: 'Bob',
        last_name: 'Johnson',
        gender: 'male',
        birthdate: new Date('1982-03-10')
      });
    });

    it('should return empty array for no matches', async () => {
      const patients = await searchPatients('xyz');
      expect(patients).toEqual([]);
    });

    it('should search by first name', async () => {
      const patients = await searchPatients('John');

      expect(patients).toHaveLength(2); // John and Johnson
      const names = patients.map(p => `${p.first_name} ${p.last_name}`).sort();
      expect(names).toEqual(['Bob Johnson', 'John Doe']);
    });

    it('should search by last name', async () => {
      const patients = await searchPatients('Smith');

      expect(patients).toHaveLength(1);
      expect(patients[0].first_name).toEqual('Jane');
      expect(patients[0].last_name).toEqual('Smith');
    });

    it('should be case insensitive', async () => {
      const patients = await searchPatients('john');

      expect(patients).toHaveLength(2); // John and Johnson
      const names = patients.map(p => `${p.first_name} ${p.last_name}`).sort();
      expect(names).toEqual(['Bob Johnson', 'John Doe']);
    });

    it('should search partial matches', async () => {
      const patients = await searchPatients('Jo');

      expect(patients).toHaveLength(2);
      const names = patients.map(p => `${p.first_name} ${p.last_name}`).sort();
      expect(names).toEqual(['Bob Johnson', 'John Doe']);
    });

    it('should search both first and last names', async () => {
      const patients = await searchPatients('o');

      expect(patients).toHaveLength(2); // John Doe and Bob Johnson
      const names = patients.map(p => `${p.first_name} ${p.last_name}`).sort();
      expect(names).toEqual(['Bob Johnson', 'John Doe']);
    });

    it('should return patients with correct field types', async () => {
      const patients = await searchPatients('John');

      expect(patients).toHaveLength(2); // John and Johnson
      const patient = patients[0];
      expect(patient.id).toEqual(expect.any(Number));
      expect(patient.birthdate).toBeInstanceOf(Date);
      expect(patient.created_at).toBeInstanceOf(Date);
      expect(patient.updated_at).toBeInstanceOf(Date);
    });
  });
});