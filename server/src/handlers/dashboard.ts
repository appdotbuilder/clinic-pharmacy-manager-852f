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
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is fetching comprehensive dashboard data
    // for admin users including system overview and recent activities.
    return Promise.resolve({
        totalPatients: 0,
        totalDoctors: 0,
        totalMedicines: 0,
        totalPrescriptions: 0,
        todaySales: 0,
        todayPatients: 0,
        lowStockCount: 0,
        pendingPrescriptions: 0,
        recentActivities: []
    });
}

// Get doctor dashboard data
export async function getDoctorDashboard(doctorId: number): Promise<DoctorDashboardData> {
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is fetching dashboard data specific to a doctor
    // including their prescription statistics and recent patients.
    return Promise.resolve({
        myPrescriptionsToday: 0,
        myPatientsToday: 0,
        myTotalPrescriptions: 0,
        pendingPrescriptions: 0,
        recentPatients: [],
        prescriptionStats: {
            thisWeek: 0,
            thisMonth: 0,
            mostPrescribedMedicine: ''
        }
    });
}

// Get cashier dashboard data
export async function getCashierDashboard(): Promise<CashierDashboardData> {
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is fetching dashboard data for cashier/receptionist
    // including payment statistics and low stock alerts.
    return Promise.resolve({
        todaySales: 0,
        todayTransactions: 0,
        pendingPayments: 0,
        lowStockAlerts: 0,
        recentPayments: [],
        paymentStats: {
            cashPayments: 0,
            cardPayments: 0,
            insurancePayments: 0
        }
    });
}