import { z } from 'zod';

// User Roles
export const userRoleSchema = z.enum(['admin', 'doctor', 'cashier']);
export type UserRole = z.infer<typeof userRoleSchema>;

// Gender enum
export const genderSchema = z.enum(['male', 'female', 'other']);
export type Gender = z.infer<typeof genderSchema>;

// Payment methods
export const paymentMethodSchema = z.enum(['cash', 'card', 'insurance']);
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;

// Prescription status
export const prescriptionStatusSchema = z.enum(['pending', 'filled', 'partially_filled']);
export type PrescriptionStatus = z.infer<typeof prescriptionStatusSchema>;

// Medicine categories
export const medicineCategorySchema = z.enum([
  'pain_relievers', 'antibiotics', 'antiviral', 'antifungal', 'cardiovascular',
  'respiratory', 'gastrointestinal', 'diabetes', 'vitamins', 'other'
]);
export type MedicineCategory = z.infer<typeof medicineCategorySchema>;

// User schema
export const userSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  password_hash: z.string(),
  role: userRoleSchema,
  first_name: z.string(),
  last_name: z.string(),
  phone: z.string().nullable(),
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});
export type User = z.infer<typeof userSchema>;

// Patient schema
export const patientSchema = z.object({
  id: z.number(),
  first_name: z.string(),
  last_name: z.string(),
  email: z.string().email().nullable(),
  phone: z.string().nullable(),
  address: z.string().nullable(),
  gender: genderSchema,
  birthdate: z.coerce.date(),
  allergies: z.string().nullable(),
  chronic_conditions: z.string().nullable(),
  medical_history: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});
export type Patient = z.infer<typeof patientSchema>;

// Medicine schema
export const medicineSchema = z.object({
  id: z.number(),
  name: z.string(),
  category: medicineCategorySchema,
  stock_quantity: z.number().int(),
  price_per_unit: z.number(),
  supplier_info: z.string().nullable(),
  batch_number: z.string().nullable(),
  expiry_date: z.coerce.date().nullable(),
  storage_conditions: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});
export type Medicine = z.infer<typeof medicineSchema>;

// Prescription schema
export const prescriptionSchema = z.object({
  id: z.number(),
  patient_id: z.number(),
  doctor_id: z.number(),
  status: prescriptionStatusSchema,
  notes: z.string().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});
export type Prescription = z.infer<typeof prescriptionSchema>;

// Prescription item schema
export const prescriptionItemSchema = z.object({
  id: z.number(),
  prescription_id: z.number(),
  medicine_id: z.number(),
  quantity_prescribed: z.number().int(),
  quantity_filled: z.number().int(),
  dosage_instructions: z.string().nullable(),
  created_at: z.coerce.date()
});
export type PrescriptionItem = z.infer<typeof prescriptionItemSchema>;

// Payment schema
export const paymentSchema = z.object({
  id: z.number(),
  patient_id: z.number(),
  prescription_id: z.number().nullable(),
  amount: z.number(),
  payment_method: paymentMethodSchema,
  payment_date: z.coerce.date(),
  notes: z.string().nullable(),
  created_by: z.number(),
  created_at: z.coerce.date()
});
export type Payment = z.infer<typeof paymentSchema>;

// Input schemas for creating records
export const createUserInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  role: userRoleSchema,
  first_name: z.string(),
  last_name: z.string(),
  phone: z.string().nullable().optional()
});
export type CreateUserInput = z.infer<typeof createUserInputSchema>;

export const createPatientInputSchema = z.object({
  first_name: z.string(),
  last_name: z.string(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  gender: genderSchema,
  birthdate: z.coerce.date(),
  allergies: z.string().nullable().optional(),
  chronic_conditions: z.string().nullable().optional(),
  medical_history: z.string().nullable().optional()
});
export type CreatePatientInput = z.infer<typeof createPatientInputSchema>;

export const createMedicineInputSchema = z.object({
  name: z.string(),
  category: medicineCategorySchema,
  stock_quantity: z.number().int().nonnegative(),
  price_per_unit: z.number().positive(),
  supplier_info: z.string().nullable().optional(),
  batch_number: z.string().nullable().optional(),
  expiry_date: z.coerce.date().nullable().optional(),
  storage_conditions: z.string().nullable().optional()
});
export type CreateMedicineInput = z.infer<typeof createMedicineInputSchema>;

export const createPrescriptionInputSchema = z.object({
  patient_id: z.number(),
  doctor_id: z.number(),
  notes: z.string().nullable().optional(),
  items: z.array(z.object({
    medicine_id: z.number(),
    quantity_prescribed: z.number().int().positive(),
    dosage_instructions: z.string().nullable().optional()
  }))
});
export type CreatePrescriptionInput = z.infer<typeof createPrescriptionInputSchema>;

export const createPaymentInputSchema = z.object({
  patient_id: z.number(),
  prescription_id: z.number().nullable().optional(),
  amount: z.number().positive(),
  payment_method: paymentMethodSchema,
  notes: z.string().nullable().optional(),
  created_by: z.number()
});
export type CreatePaymentInput = z.infer<typeof createPaymentInputSchema>;

// Update schemas
export const updatePatientInputSchema = z.object({
  id: z.number(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  gender: genderSchema.optional(),
  birthdate: z.coerce.date().optional(),
  allergies: z.string().nullable().optional(),
  chronic_conditions: z.string().nullable().optional(),
  medical_history: z.string().nullable().optional()
});
export type UpdatePatientInput = z.infer<typeof updatePatientInputSchema>;

export const updateMedicineInputSchema = z.object({
  id: z.number(),
  name: z.string().optional(),
  category: medicineCategorySchema.optional(),
  stock_quantity: z.number().int().nonnegative().optional(),
  price_per_unit: z.number().positive().optional(),
  supplier_info: z.string().nullable().optional(),
  batch_number: z.string().nullable().optional(),
  expiry_date: z.coerce.date().nullable().optional(),
  storage_conditions: z.string().nullable().optional()
});
export type UpdateMedicineInput = z.infer<typeof updateMedicineInputSchema>;

export const updatePrescriptionStatusInputSchema = z.object({
  id: z.number(),
  status: prescriptionStatusSchema
});
export type UpdatePrescriptionStatusInput = z.infer<typeof updatePrescriptionStatusInputSchema>;

// Authentication schemas
export const loginInputSchema = z.object({
  email: z.string().email(),
  password: z.string()
});
export type LoginInput = z.infer<typeof loginInputSchema>;

// Report input schemas
export const salesReportInputSchema = z.object({
  start_date: z.coerce.date(),
  end_date: z.coerce.date(),
  doctor_id: z.number().optional(),
  medicine_category: medicineCategorySchema.optional()
});
export type SalesReportInput = z.infer<typeof salesReportInputSchema>;

export const medicineUsageReportInputSchema = z.object({
  start_date: z.coerce.date(),
  end_date: z.coerce.date(),
  medicine_id: z.number().optional()
});
export type MedicineUsageReportInput = z.infer<typeof medicineUsageReportInputSchema>;