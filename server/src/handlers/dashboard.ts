import { db } from '../db';
import { 
    usersTable, 
    patientsTable, 
    medicinesTable, 
    prescriptionsTable, 
    prescriptionItemsTable, 
    paymentsTable 
} from '../db/schema';
import { count, eq, gte, and, desc, sql, SQL } from 'drizzle-orm';

// Dashboard data structures for different user roles
export interface AdminDashboardData {
    totalPatients: number;
    totalDoctors: number;
    totalMedicines: number;
    totalPrescriptions: number;
    todaySales: number;
    todayPatients: number;
    lowStockCount: number;
    pendingPrescriptions: number;
    recentActivities: Array<{
        type: 'patient' | 'prescription' | 'payment' | 'medicine';
        description: string;
        timestamp: Date;
        userId: number;
    }>;
}

export interface DoctorDashboardData {
    myPrescriptionsToday: number;
    myPatientsToday: number;
    myTotalPrescriptions: number;
    pendingPrescriptions: number;
    recentPatients: Array<{
        id: number;
        name: string;
        lastVisit: Date;
    }>;
    prescriptionStats: {
        thisWeek: number;
        thisMonth: number;
        mostPrescribedMedicine: string;
    };
}

export interface CashierDashboardData {
    todaySales: number;
    todayTransactions: number;
    pendingPayments: number;
    lowStockAlerts: number;
    recentPayments: Array<{
        id: number;
        patientName: string;
        amount: number;
        paymentMethod: string;
        timestamp: Date;
    }>;
    paymentStats: {
        cashPayments: number;
        cardPayments: number;
        insurancePayments: number;
    };
}

// Get admin dashboard data
export async function getAdminDashboard(): Promise<AdminDashboardData> {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Get total counts
        const [totalPatients] = await db
            .select({ count: count() })
            .from(patientsTable)
            .execute();

        const [totalDoctors] = await db
            .select({ count: count() })
            .from(usersTable)
            .where(and(
                eq(usersTable.role, 'doctor'),
                eq(usersTable.is_active, true)
            ))
            .execute();

        const [totalMedicines] = await db
            .select({ count: count() })
            .from(medicinesTable)
            .execute();

        const [totalPrescriptions] = await db
            .select({ count: count() })
            .from(prescriptionsTable)
            .execute();

        // Get today's sales
        const todaySalesResult = await db
            .select({ total: sql`COALESCE(SUM(${paymentsTable.amount}), 0)` })
            .from(paymentsTable)
            .where(gte(paymentsTable.payment_date, today))
            .execute();

        const todaySales = parseFloat(todaySalesResult[0]?.total as string) || 0;

        // Get today's new patients
        const [todayPatients] = await db
            .select({ count: count() })
            .from(patientsTable)
            .where(gte(patientsTable.created_at, today))
            .execute();

        // Get low stock count (medicines with stock < 10)
        const [lowStockCount] = await db
            .select({ count: count() })
            .from(medicinesTable)
            .where(sql`${medicinesTable.stock_quantity} < 10`)
            .execute();

        // Get pending prescriptions
        const [pendingPrescriptions] = await db
            .select({ count: count() })
            .from(prescriptionsTable)
            .where(eq(prescriptionsTable.status, 'pending'))
            .execute();

        // Get recent activities (latest 10)
        const recentActivities = await db
            .select({
                type: sql`'prescription'`.as('type'),
                description: sql`CONCAT('New prescription for patient #', ${prescriptionsTable.patient_id})`.as('description'),
                timestamp: prescriptionsTable.created_at,
                userId: prescriptionsTable.doctor_id
            })
            .from(prescriptionsTable)
            .orderBy(desc(prescriptionsTable.created_at))
            .limit(10)
            .execute();

        return {
            totalPatients: totalPatients.count,
            totalDoctors: totalDoctors.count,
            totalMedicines: totalMedicines.count,
            totalPrescriptions: totalPrescriptions.count,
            todaySales,
            todayPatients: todayPatients.count,
            lowStockCount: lowStockCount.count,
            pendingPrescriptions: pendingPrescriptions.count,
            recentActivities: recentActivities.map(activity => ({
                type: activity.type as 'patient' | 'prescription' | 'payment' | 'medicine',
                description: activity.description as string,
                timestamp: activity.timestamp,
                userId: activity.userId
            }))
        };
    } catch (error) {
        console.error('Admin dashboard fetch failed:', error);
        throw error;
    }
}

// Get doctor dashboard data
export async function getDoctorDashboard(doctorId: number): Promise<DoctorDashboardData> {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);

        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);

        // Get today's prescriptions by this doctor
        const [myPrescriptionsToday] = await db
            .select({ count: count() })
            .from(prescriptionsTable)
            .where(and(
                eq(prescriptionsTable.doctor_id, doctorId),
                gte(prescriptionsTable.created_at, today)
            ))
            .execute();

        // Get unique patients seen today
        const myPatientsToday = await db
            .select({ patient_id: prescriptionsTable.patient_id })
            .from(prescriptionsTable)
            .where(and(
                eq(prescriptionsTable.doctor_id, doctorId),
                gte(prescriptionsTable.created_at, today)
            ))
            .execute();

        // Get total prescriptions by this doctor
        const [myTotalPrescriptions] = await db
            .select({ count: count() })
            .from(prescriptionsTable)
            .where(eq(prescriptionsTable.doctor_id, doctorId))
            .execute();

        // Get pending prescriptions by this doctor
        const [pendingPrescriptions] = await db
            .select({ count: count() })
            .from(prescriptionsTable)
            .where(and(
                eq(prescriptionsTable.doctor_id, doctorId),
                eq(prescriptionsTable.status, 'pending')
            ))
            .execute();

        // Get recent patients (latest 5)
        const recentPatientsData = await db
            .select({
                id: patientsTable.id,
                first_name: patientsTable.first_name,
                last_name: patientsTable.last_name,
                lastVisit: prescriptionsTable.created_at
            })
            .from(prescriptionsTable)
            .innerJoin(patientsTable, eq(prescriptionsTable.patient_id, patientsTable.id))
            .where(eq(prescriptionsTable.doctor_id, doctorId))
            .orderBy(desc(prescriptionsTable.created_at))
            .limit(5)
            .execute();

        const recentPatients = recentPatientsData.map(patient => ({
            id: patient.id,
            name: `${patient.first_name} ${patient.last_name}`,
            lastVisit: patient.lastVisit
        }));

        // Get weekly prescriptions
        const [thisWeekPrescriptions] = await db
            .select({ count: count() })
            .from(prescriptionsTable)
            .where(and(
                eq(prescriptionsTable.doctor_id, doctorId),
                gte(prescriptionsTable.created_at, weekAgo)
            ))
            .execute();

        // Get monthly prescriptions
        const [thisMonthPrescriptions] = await db
            .select({ count: count() })
            .from(prescriptionsTable)
            .where(and(
                eq(prescriptionsTable.doctor_id, doctorId),
                gte(prescriptionsTable.created_at, monthAgo)
            ))
            .execute();

        // Get most prescribed medicine by this doctor
        const mostPrescribedResult = await db
            .select({
                name: medicinesTable.name,
                count: count()
            })
            .from(prescriptionItemsTable)
            .innerJoin(prescriptionsTable, eq(prescriptionItemsTable.prescription_id, prescriptionsTable.id))
            .innerJoin(medicinesTable, eq(prescriptionItemsTable.medicine_id, medicinesTable.id))
            .where(eq(prescriptionsTable.doctor_id, doctorId))
            .groupBy(medicinesTable.id, medicinesTable.name)
            .orderBy(desc(count()))
            .limit(1)
            .execute();

        const mostPrescribedMedicine = mostPrescribedResult[0]?.name || 'None';

        return {
            myPrescriptionsToday: myPrescriptionsToday.count,
            myPatientsToday: myPatientsToday.length,
            myTotalPrescriptions: myTotalPrescriptions.count,
            pendingPrescriptions: pendingPrescriptions.count,
            recentPatients,
            prescriptionStats: {
                thisWeek: thisWeekPrescriptions.count,
                thisMonth: thisMonthPrescriptions.count,
                mostPrescribedMedicine
            }
        };
    } catch (error) {
        console.error('Doctor dashboard fetch failed:', error);
        throw error;
    }
}

// Get cashier dashboard data
export async function getCashierDashboard(): Promise<CashierDashboardData> {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Get today's sales total
        const todaySalesResult = await db
            .select({ total: sql`COALESCE(SUM(${paymentsTable.amount}), 0)` })
            .from(paymentsTable)
            .where(gte(paymentsTable.payment_date, today))
            .execute();

        const todaySales = parseFloat(todaySalesResult[0]?.total as string) || 0;

        // Get today's transaction count
        const [todayTransactions] = await db
            .select({ count: count() })
            .from(paymentsTable)
            .where(gte(paymentsTable.payment_date, today))
            .execute();

        // Get pending payments (prescriptions without full payment)
        const [pendingPayments] = await db
            .select({ count: count() })
            .from(prescriptionsTable)
            .where(eq(prescriptionsTable.status, 'pending'))
            .execute();

        // Get low stock alerts (medicines with stock < 10)
        const [lowStockAlerts] = await db
            .select({ count: count() })
            .from(medicinesTable)
            .where(sql`${medicinesTable.stock_quantity} < 10`)
            .execute();

        // Get recent payments (latest 5)
        const recentPaymentsData = await db
            .select({
                id: paymentsTable.id,
                first_name: patientsTable.first_name,
                last_name: patientsTable.last_name,
                amount: paymentsTable.amount,
                payment_method: paymentsTable.payment_method,
                timestamp: paymentsTable.payment_date
            })
            .from(paymentsTable)
            .innerJoin(patientsTable, eq(paymentsTable.patient_id, patientsTable.id))
            .orderBy(desc(paymentsTable.payment_date))
            .limit(5)
            .execute();

        const recentPayments = recentPaymentsData.map(payment => ({
            id: payment.id,
            patientName: `${payment.first_name} ${payment.last_name}`,
            amount: parseFloat(payment.amount),
            paymentMethod: payment.payment_method,
            timestamp: payment.timestamp
        }));

        // Get payment method statistics for today
        const paymentStatsData = await db
            .select({
                payment_method: paymentsTable.payment_method,
                count: count()
            })
            .from(paymentsTable)
            .where(gte(paymentsTable.payment_date, today))
            .groupBy(paymentsTable.payment_method)
            .execute();

        const paymentStats = {
            cashPayments: paymentStatsData.find(stat => stat.payment_method === 'cash')?.count || 0,
            cardPayments: paymentStatsData.find(stat => stat.payment_method === 'card')?.count || 0,
            insurancePayments: paymentStatsData.find(stat => stat.payment_method === 'insurance')?.count || 0
        };

        return {
            todaySales,
            todayTransactions: todayTransactions.count,
            pendingPayments: pendingPayments.count,
            lowStockAlerts: lowStockAlerts.count,
            recentPayments,
            paymentStats
        };
    } catch (error) {
        console.error('Cashier dashboard fetch failed:', error);
        throw error;
    }
}