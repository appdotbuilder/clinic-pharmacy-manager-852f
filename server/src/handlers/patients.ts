import { db } from '../db';
import { patientsTable } from '../db/schema';
import { type CreatePatientInput, type UpdatePatientInput, type Patient } from '../schema';
import { eq, or, ilike } from 'drizzle-orm';

// Create a new patient
export async function createPatient(input: CreatePatientInput): Promise<Patient> {
  try {
    const result = await db.insert(patientsTable)
      .values({
        first_name: input.first_name,
        last_name: input.last_name,
        email: input.email || null,
        phone: input.phone || null,
        address: input.address || null,
        gender: input.gender,
        birthdate: input.birthdate.toISOString().split('T')[0], // Convert Date to string
        allergies: input.allergies || null,
        chronic_conditions: input.chronic_conditions || null,
        medical_history: input.medical_history || null
      })
      .returning()
      .execute();

    // Convert string dates back to Date objects
    const patient = result[0];
    return {
      ...patient,
      birthdate: new Date(patient.birthdate)
    };
  } catch (error) {
    console.error('Patient creation failed:', error);
    throw error;
  }
}

// Get all patients
export async function getPatients(): Promise<Patient[]> {
  try {
    const patients = await db.select()
      .from(patientsTable)
      .execute();

    // Convert string dates back to Date objects
    return patients.map(patient => ({
      ...patient,
      birthdate: new Date(patient.birthdate)
    }));
  } catch (error) {
    console.error('Failed to fetch patients:', error);
    throw error;
  }
}

// Get patient by ID
export async function getPatientById(id: number): Promise<Patient | null> {
  try {
    const patients = await db.select()
      .from(patientsTable)
      .where(eq(patientsTable.id, id))
      .execute();

    if (patients.length === 0) {
      return null;
    }

    // Convert string dates back to Date objects
    const patient = patients[0];
    return {
      ...patient,
      birthdate: new Date(patient.birthdate)
    };
  } catch (error) {
    console.error('Failed to fetch patient by ID:', error);
    throw error;
  }
}

// Update patient information
export async function updatePatient(input: UpdatePatientInput): Promise<Patient> {
  try {
    // Build update object with only defined fields
    const updateData: Record<string, any> = {};
    
    if (input.first_name !== undefined) updateData['first_name'] = input.first_name;
    if (input.last_name !== undefined) updateData['last_name'] = input.last_name;
    if (input.email !== undefined) updateData['email'] = input.email;
    if (input.phone !== undefined) updateData['phone'] = input.phone;
    if (input.address !== undefined) updateData['address'] = input.address;
    if (input.gender !== undefined) updateData['gender'] = input.gender;
    if (input.birthdate !== undefined) updateData['birthdate'] = input.birthdate.toISOString().split('T')[0];
    if (input.allergies !== undefined) updateData['allergies'] = input.allergies;
    if (input.chronic_conditions !== undefined) updateData['chronic_conditions'] = input.chronic_conditions;
    if (input.medical_history !== undefined) updateData['medical_history'] = input.medical_history;
    
    // Always update the updated_at timestamp
    updateData['updated_at'] = new Date();

    const result = await db.update(patientsTable)
      .set(updateData)
      .where(eq(patientsTable.id, input.id))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error(`Patient with ID ${input.id} not found`);
    }

    // Convert string dates back to Date objects
    const patient = result[0];
    return {
      ...patient,
      birthdate: new Date(patient.birthdate)
    };
  } catch (error) {
    console.error('Patient update failed:', error);
    throw error;
  }
}

// Search patients by name
export async function searchPatients(query: string): Promise<Patient[]> {
  try {
    const searchPattern = `%${query}%`;
    
    const patients = await db.select()
      .from(patientsTable)
      .where(
        or(
          ilike(patientsTable.first_name, searchPattern),
          ilike(patientsTable.last_name, searchPattern)
        )
      )
      .execute();

    // Convert string dates back to Date objects
    return patients.map(patient => ({
      ...patient,
      birthdate: new Date(patient.birthdate)
    }));
  } catch (error) {
    console.error('Patient search failed:', error);
    throw error;
  }
}