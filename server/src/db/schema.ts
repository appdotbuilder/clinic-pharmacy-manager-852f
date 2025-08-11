import { serial, text, pgTable, timestamp, numeric, integer, boolean, pgEnum, date, foreignKey } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums
export const userRoleEnum = pgEnum('user_role', ['admin', 'doctor', 'cashier']);
export const genderEnum = pgEnum('gender', ['male', 'female', 'other']);
export const paymentMethodEnum = pgEnum('payment_method', ['cash', 'card', 'insurance']);
export const prescriptionStatusEnum = pgEnum('prescription_status', ['pending', 'filled', 'partially_filled']);
export const medicineCategoryEnum = pgEnum('medicine_category', [
  'pain_relievers', 'antibiotics', 'antiviral', 'antifungal', 'cardiovascular',
  'respiratory', 'gastrointestinal', 'diabetes', 'vitamins', 'other'
]);

// Users table
export const usersTable = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  password_hash: text('password_hash').notNull(),
  role: userRoleEnum('role').notNull(),
  first_name: text('first_name').notNull(),
  last_name: text('last_name').notNull(),
  phone: text('phone'),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Patients table
export const patientsTable = pgTable('patients', {
  id: serial('id').primaryKey(),
  first_name: text('first_name').notNull(),
  last_name: text('last_name').notNull(),
  email: text('email'),
  phone: text('phone'),
  address: text('address'),
  gender: genderEnum('gender').notNull(),
  birthdate: date('birthdate').notNull(),
  allergies: text('allergies'),
  chronic_conditions: text('chronic_conditions'),
  medical_history: text('medical_history'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Medicines table
export const medicinesTable = pgTable('medicines', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  category: medicineCategoryEnum('category').notNull(),
  stock_quantity: integer('stock_quantity').notNull(),
  price_per_unit: numeric('price_per_unit', { precision: 10, scale: 2 }).notNull(),
  supplier_info: text('supplier_info'),
  batch_number: text('batch_number'),
  expiry_date: date('expiry_date'),
  storage_conditions: text('storage_conditions'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Prescriptions table
export const prescriptionsTable = pgTable('prescriptions', {
  id: serial('id').primaryKey(),
  patient_id: integer('patient_id').notNull(),
  doctor_id: integer('doctor_id').notNull(),
  status: prescriptionStatusEnum('status').notNull().default('pending'),
  notes: text('notes'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  patientFk: foreignKey({
    columns: [table.patient_id],
    foreignColumns: [patientsTable.id],
    name: 'prescriptions_patient_fk'
  }),
  doctorFk: foreignKey({
    columns: [table.doctor_id],
    foreignColumns: [usersTable.id],
    name: 'prescriptions_doctor_fk'
  })
}));

// Prescription items table
export const prescriptionItemsTable = pgTable('prescription_items', {
  id: serial('id').primaryKey(),
  prescription_id: integer('prescription_id').notNull(),
  medicine_id: integer('medicine_id').notNull(),
  quantity_prescribed: integer('quantity_prescribed').notNull(),
  quantity_filled: integer('quantity_filled').notNull().default(0),
  dosage_instructions: text('dosage_instructions'),
  created_at: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  prescriptionFk: foreignKey({
    columns: [table.prescription_id],
    foreignColumns: [prescriptionsTable.id],
    name: 'prescription_items_prescription_fk'
  }),
  medicineFk: foreignKey({
    columns: [table.medicine_id],
    foreignColumns: [medicinesTable.id],
    name: 'prescription_items_medicine_fk'
  })
}));

// Payments table
export const paymentsTable = pgTable('payments', {
  id: serial('id').primaryKey(),
  patient_id: integer('patient_id').notNull(),
  prescription_id: integer('prescription_id'),
  amount: numeric('amount', { precision: 10, scale: 2 }).notNull(),
  payment_method: paymentMethodEnum('payment_method').notNull(),
  payment_date: timestamp('payment_date').defaultNow().notNull(),
  notes: text('notes'),
  created_by: integer('created_by').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  patientFk: foreignKey({
    columns: [table.patient_id],
    foreignColumns: [patientsTable.id],
    name: 'payments_patient_fk'
  }),
  prescriptionFk: foreignKey({
    columns: [table.prescription_id],
    foreignColumns: [prescriptionsTable.id],
    name: 'payments_prescription_fk'
  }),
  createdByFk: foreignKey({
    columns: [table.created_by],
    foreignColumns: [usersTable.id],
    name: 'payments_created_by_fk'
  })
}));

// Relations
export const usersRelations = relations(usersTable, ({ many }) => ({
  prescriptions: many(prescriptionsTable),
  payments: many(paymentsTable),
}));

export const patientsRelations = relations(patientsTable, ({ many }) => ({
  prescriptions: many(prescriptionsTable),
  payments: many(paymentsTable),
}));

export const medicinesRelations = relations(medicinesTable, ({ many }) => ({
  prescriptionItems: many(prescriptionItemsTable),
}));

export const prescriptionsRelations = relations(prescriptionsTable, ({ one, many }) => ({
  patient: one(patientsTable, {
    fields: [prescriptionsTable.patient_id],
    references: [patientsTable.id],
  }),
  doctor: one(usersTable, {
    fields: [prescriptionsTable.doctor_id],
    references: [usersTable.id],
  }),
  items: many(prescriptionItemsTable),
  payments: many(paymentsTable),
}));

export const prescriptionItemsRelations = relations(prescriptionItemsTable, ({ one }) => ({
  prescription: one(prescriptionsTable, {
    fields: [prescriptionItemsTable.prescription_id],
    references: [prescriptionsTable.id],
  }),
  medicine: one(medicinesTable, {
    fields: [prescriptionItemsTable.medicine_id],
    references: [medicinesTable.id],
  }),
}));

export const paymentsRelations = relations(paymentsTable, ({ one }) => ({
  patient: one(patientsTable, {
    fields: [paymentsTable.patient_id],
    references: [patientsTable.id],
  }),
  prescription: one(prescriptionsTable, {
    fields: [paymentsTable.prescription_id],
    references: [prescriptionsTable.id],
  }),
  createdBy: one(usersTable, {
    fields: [paymentsTable.created_by],
    references: [usersTable.id],
  }),
}));

// Export all tables for relation queries
export const tables = {
  users: usersTable,
  patients: patientsTable,
  medicines: medicinesTable,
  prescriptions: prescriptionsTable,
  prescriptionItems: prescriptionItemsTable,
  payments: paymentsTable,
};

// TypeScript types for the table schemas
export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;
export type Patient = typeof patientsTable.$inferSelect;
export type NewPatient = typeof patientsTable.$inferInsert;
export type Medicine = typeof medicinesTable.$inferSelect;
export type NewMedicine = typeof medicinesTable.$inferInsert;
export type Prescription = typeof prescriptionsTable.$inferSelect;
export type NewPrescription = typeof prescriptionsTable.$inferInsert;
export type PrescriptionItem = typeof prescriptionItemsTable.$inferSelect;
export type NewPrescriptionItem = typeof prescriptionItemsTable.$inferInsert;
export type Payment = typeof paymentsTable.$inferSelect;
export type NewPayment = typeof paymentsTable.$inferInsert;