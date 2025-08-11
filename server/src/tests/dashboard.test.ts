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
import { getAdminDashboard, getDoctorDashboard, getCashierDashboard } from '../handlers/dashboard';

describe('Dashboard handlers', () => {
    beforeEach(createDB);
    afterEach(resetDB);

    describe('getAdminDashboard', () => {
        it('should return basic dashboard data with zero counts for empty database', async () => {
            const result = await getAdminDashboard();

            expect(result.totalPatients).toEqual(0);
            expect(result.totalDoctors).toEqual(0);
            expect(result.totalMedicines).toEqual(0);
            expect(result.totalPrescriptions).toEqual(0);
            expect(result.todaySales).toEqual(0);
            expect(result.todayPatients).toEqual(0);
            expect(result.lowStockCount).toEqual(0);
            expect(result.pendingPrescriptions).toEqual(0);
            expect(result.recentActivities).toEqual([]);
        });

        it('should return correct counts with test data', async () => {
            // Create test data
            const [doctor] = await db.insert(usersTable).values({
                email: 'doctor@test.com',
                password_hash: 'hash123',
                role: 'doctor',
                first_name: 'Dr. John',
                last_name: 'Doe',
                is_active: true
            }).returning().execute();

            const [patient1] = await db.insert(patientsTable).values({
                first_name: 'Patient',
                last_name: 'One',
                gender: 'male',
                birthdate: '1990-01-01'
            }).returning().execute();

            const [patient2] = await db.insert(patientsTable).values({
                first_name: 'Patient',
                last_name: 'Two',
                gender: 'female',
                birthdate: '1985-05-15'
            }).returning().execute();

            const [medicine1] = await db.insert(medicinesTable).values({
                name: 'Test Medicine 1',
                category: 'antibiotics',
                stock_quantity: 5, // Low stock
                price_per_unit: '10.50'
            }).returning().execute();

            const [medicine2] = await db.insert(medicinesTable).values({
                name: 'Test Medicine 2',
                category: 'pain_relievers',
                stock_quantity: 50,
                price_per_unit: '5.25'
            }).returning().execute();

            const [prescription1] = await db.insert(prescriptionsTable).values({
                patient_id: patient1.id,
                doctor_id: doctor.id,
                status: 'pending'
            }).returning().execute();

            const [prescription2] = await db.insert(prescriptionsTable).values({
                patient_id: patient2.id,
                doctor_id: doctor.id,
                status: 'filled'
            }).returning().execute();

            // Create payment for today
            await db.insert(paymentsTable).values({
                patient_id: patient1.id,
                prescription_id: prescription1.id,
                amount: '25.75',
                payment_method: 'cash',
                created_by: doctor.id
            }).execute();

            const result = await getAdminDashboard();

            expect(result.totalPatients).toEqual(2);
            expect(result.totalDoctors).toEqual(1);
            expect(result.totalMedicines).toEqual(2);
            expect(result.totalPrescriptions).toEqual(2);
            expect(result.todaySales).toEqual(25.75);
            expect(result.todayPatients).toEqual(2); // Both patients created today
            expect(result.lowStockCount).toEqual(1); // medicine1 has stock < 10
            expect(result.pendingPrescriptions).toEqual(1);
            expect(result.recentActivities.length).toEqual(2);
            expect(result.recentActivities[0].type).toEqual('prescription');
        });
    });

    describe('getDoctorDashboard', () => {
        it('should return zero stats for doctor with no activity', async () => {
            // Create doctor
            const [doctor] = await db.insert(usersTable).values({
                email: 'doctor@test.com',
                password_hash: 'hash123',
                role: 'doctor',
                first_name: 'Dr. John',
                last_name: 'Doe',
                is_active: true
            }).returning().execute();

            const result = await getDoctorDashboard(doctor.id);

            expect(result.myPrescriptionsToday).toEqual(0);
            expect(result.myPatientsToday).toEqual(0);
            expect(result.myTotalPrescriptions).toEqual(0);
            expect(result.pendingPrescriptions).toEqual(0);
            expect(result.recentPatients).toEqual([]);
            expect(result.prescriptionStats.thisWeek).toEqual(0);
            expect(result.prescriptionStats.thisMonth).toEqual(0);
            expect(result.prescriptionStats.mostPrescribedMedicine).toEqual('None');
        });

        it('should return correct stats for active doctor', async () => {
            // Create doctor
            const [doctor] = await db.insert(usersTable).values({
                email: 'doctor@test.com',
                password_hash: 'hash123',
                role: 'doctor',
                first_name: 'Dr. John',
                last_name: 'Doe',
                is_active: true
            }).returning().execute();

            // Create patients
            const [patient1] = await db.insert(patientsTable).values({
                first_name: 'Patient',
                last_name: 'One',
                gender: 'male',
                birthdate: '1990-01-01'
            }).returning().execute();

            const [patient2] = await db.insert(patientsTable).values({
                first_name: 'Patient',
                last_name: 'Two',
                gender: 'female',
                birthdate: '1985-05-15'
            }).returning().execute();

            // Create medicine
            const [medicine] = await db.insert(medicinesTable).values({
                name: 'Aspirin',
                category: 'pain_relievers',
                stock_quantity: 100,
                price_per_unit: '5.25'
            }).returning().execute();

            // Create prescriptions for today
            const [prescription1] = await db.insert(prescriptionsTable).values({
                patient_id: patient1.id,
                doctor_id: doctor.id,
                status: 'pending'
            }).returning().execute();

            const [prescription2] = await db.insert(prescriptionsTable).values({
                patient_id: patient2.id,
                doctor_id: doctor.id,
                status: 'filled'
            }).returning().execute();

            // Create prescription items
            await db.insert(prescriptionItemsTable).values({
                prescription_id: prescription1.id,
                medicine_id: medicine.id,
                quantity_prescribed: 30,
                quantity_filled: 0
            }).execute();

            await db.insert(prescriptionItemsTable).values({
                prescription_id: prescription2.id,
                medicine_id: medicine.id,
                quantity_prescribed: 20,
                quantity_filled: 20
            }).execute();

            const result = await getDoctorDashboard(doctor.id);

            expect(result.myPrescriptionsToday).toEqual(2);
            expect(result.myPatientsToday).toEqual(2);
            expect(result.myTotalPrescriptions).toEqual(2);
            expect(result.pendingPrescriptions).toEqual(1);
            expect(result.recentPatients.length).toEqual(2);
            expect(result.recentPatients[0].name).toContain('Patient');
            expect(result.prescriptionStats.thisWeek).toEqual(2);
            expect(result.prescriptionStats.thisMonth).toEqual(2);
            expect(result.prescriptionStats.mostPrescribedMedicine).toEqual('Aspirin');
        });

        it('should handle different doctors separately', async () => {
            // Create two doctors
            const [doctor1] = await db.insert(usersTable).values({
                email: 'doctor1@test.com',
                password_hash: 'hash123',
                role: 'doctor',
                first_name: 'Dr. John',
                last_name: 'Doe',
                is_active: true
            }).returning().execute();

            const [doctor2] = await db.insert(usersTable).values({
                email: 'doctor2@test.com',
                password_hash: 'hash123',
                role: 'doctor',
                first_name: 'Dr. Jane',
                last_name: 'Smith',
                is_active: true
            }).returning().execute();

            // Create patient
            const [patient] = await db.insert(patientsTable).values({
                first_name: 'Patient',
                last_name: 'Test',
                gender: 'male',
                birthdate: '1990-01-01'
            }).returning().execute();

            // Create prescription for doctor1 only
            await db.insert(prescriptionsTable).values({
                patient_id: patient.id,
                doctor_id: doctor1.id,
                status: 'pending'
            }).execute();

            const doctor1Result = await getDoctorDashboard(doctor1.id);
            const doctor2Result = await getDoctorDashboard(doctor2.id);

            expect(doctor1Result.myTotalPrescriptions).toEqual(1);
            expect(doctor2Result.myTotalPrescriptions).toEqual(0);
        });
    });

    describe('getCashierDashboard', () => {
        it('should return zero stats for empty database', async () => {
            const result = await getCashierDashboard();

            expect(result.todaySales).toEqual(0);
            expect(result.todayTransactions).toEqual(0);
            expect(result.pendingPayments).toEqual(0);
            expect(result.lowStockAlerts).toEqual(0);
            expect(result.recentPayments).toEqual([]);
            expect(result.paymentStats.cashPayments).toEqual(0);
            expect(result.paymentStats.cardPayments).toEqual(0);
            expect(result.paymentStats.insurancePayments).toEqual(0);
        });

        it('should return correct stats with payment data', async () => {
            // Create test data
            const [doctor] = await db.insert(usersTable).values({
                email: 'doctor@test.com',
                password_hash: 'hash123',
                role: 'doctor',
                first_name: 'Dr. John',
                last_name: 'Doe',
                is_active: true
            }).returning().execute();

            const [cashier] = await db.insert(usersTable).values({
                email: 'cashier@test.com',
                password_hash: 'hash123',
                role: 'cashier',
                first_name: 'Jane',
                last_name: 'Smith',
                is_active: true
            }).returning().execute();

            const [patient1] = await db.insert(patientsTable).values({
                first_name: 'Patient',
                last_name: 'One',
                gender: 'male',
                birthdate: '1990-01-01'
            }).returning().execute();

            const [patient2] = await db.insert(patientsTable).values({
                first_name: 'Patient',
                last_name: 'Two',
                gender: 'female',
                birthdate: '1985-05-15'
            }).returning().execute();

            // Create medicine with low stock
            await db.insert(medicinesTable).values({
                name: 'Low Stock Medicine',
                category: 'antibiotics',
                stock_quantity: 3, // Low stock
                price_per_unit: '15.00'
            }).execute();

            // Create prescriptions
            const [prescription1] = await db.insert(prescriptionsTable).values({
                patient_id: patient1.id,
                doctor_id: doctor.id,
                status: 'pending'
            }).returning().execute();

            const [prescription2] = await db.insert(prescriptionsTable).values({
                patient_id: patient2.id,
                doctor_id: doctor.id,
                status: 'filled'
            }).returning().execute();

            // Create payments with different methods
            await db.insert(paymentsTable).values({
                patient_id: patient1.id,
                prescription_id: prescription1.id,
                amount: '50.00',
                payment_method: 'cash',
                created_by: cashier.id
            }).execute();

            await db.insert(paymentsTable).values({
                patient_id: patient2.id,
                prescription_id: prescription2.id,
                amount: '75.25',
                payment_method: 'card',
                created_by: cashier.id
            }).execute();

            await db.insert(paymentsTable).values({
                patient_id: patient1.id,
                amount: '30.50',
                payment_method: 'insurance',
                created_by: cashier.id
            }).execute();

            const result = await getCashierDashboard();

            expect(result.todaySales).toEqual(155.75); // 50 + 75.25 + 30.50
            expect(result.todayTransactions).toEqual(3);
            expect(result.pendingPayments).toEqual(1); // prescription1 is pending
            expect(result.lowStockAlerts).toEqual(1); // Low Stock Medicine has stock < 10
            expect(result.recentPayments.length).toEqual(3);
            expect(result.recentPayments[0].patientName).toContain('Patient');
            expect(typeof result.recentPayments[0].amount).toEqual('number');
            expect(result.paymentStats.cashPayments).toEqual(1);
            expect(result.paymentStats.cardPayments).toEqual(1);
            expect(result.paymentStats.insurancePayments).toEqual(1);
        });

        it('should handle numeric conversions correctly', async () => {
            // Create minimal test data
            const [doctor] = await db.insert(usersTable).values({
                email: 'doctor@test.com',
                password_hash: 'hash123',
                role: 'doctor',
                first_name: 'Dr. John',
                last_name: 'Doe',
                is_active: true
            }).returning().execute();

            const [patient] = await db.insert(patientsTable).values({
                first_name: 'Test',
                last_name: 'Patient',
                gender: 'male',
                birthdate: '1990-01-01'
            }).returning().execute();

            // Create payment with decimal amount
            await db.insert(paymentsTable).values({
                patient_id: patient.id,
                amount: '123.45',
                payment_method: 'cash',
                created_by: doctor.id
            }).execute();

            const result = await getCashierDashboard();

            expect(result.todaySales).toEqual(123.45);
            expect(typeof result.todaySales).toEqual('number');
            expect(result.recentPayments[0].amount).toEqual(123.45);
            expect(typeof result.recentPayments[0].amount).toEqual('number');
        });
    });

    describe('Error handling', () => {
        it('should handle non-existent doctor ID gracefully', async () => {
            // Non-existent doctor should return zero stats, not throw
            const result = await getDoctorDashboard(-1);
            
            expect(result.myPrescriptionsToday).toEqual(0);
            expect(result.myPatientsToday).toEqual(0);
            expect(result.myTotalPrescriptions).toEqual(0);
            expect(result.pendingPrescriptions).toEqual(0);
            expect(result.recentPatients).toEqual([]);
            expect(result.prescriptionStats.thisWeek).toEqual(0);
            expect(result.prescriptionStats.thisMonth).toEqual(0);
            expect(result.prescriptionStats.mostPrescribedMedicine).toEqual('None');
        });
    });
});