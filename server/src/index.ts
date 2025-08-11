import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schemas
import {
  createUserInputSchema,
  loginInputSchema,
  createPatientInputSchema,
  updatePatientInputSchema,
  createMedicineInputSchema,
  updateMedicineInputSchema,
  createPrescriptionInputSchema,
  updatePrescriptionStatusInputSchema,
  createPaymentInputSchema,
  salesReportInputSchema,
  medicineUsageReportInputSchema
} from './schema';

// Import handlers
import { registerUser, loginUser, getCurrentUser } from './handlers/auth';
import { 
  createPatient, 
  getPatients, 
  getPatientById, 
  updatePatient, 
  searchPatients 
} from './handlers/patients';
import { 
  createMedicine, 
  getMedicines, 
  getMedicineById, 
  updateMedicine, 
  getLowStockMedicines, 
  searchMedicines,
  updateMedicineStock 
} from './handlers/medicines';
import { 
  createPrescription, 
  getPrescriptions, 
  getPrescriptionById, 
  getPrescriptionsByPatientId, 
  getPrescriptionsByDoctorId, 
  updatePrescriptionStatus, 
  fillPrescriptionItem, 
  getPendingPrescriptions 
} from './handlers/prescriptions';
import { 
  createPayment, 
  getPayments, 
  getPaymentById, 
  getPaymentsByPatientId, 
  getPaymentsByDateRange, 
  getPaymentsByPrescriptionId, 
  getDailyPaymentSummary 
} from './handlers/payments';
import { 
  generateSalesReport, 
  generateMedicineUsageReport, 
  getLowStockAlerts, 
  generateMonthlySummary 
} from './handlers/reports';
import { 
  getAdminDashboard, 
  getDoctorDashboard, 
  getCashierDashboard 
} from './handlers/dashboard';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Authentication routes
  auth: router({
    register: publicProcedure
      .input(createUserInputSchema)
      .mutation(({ input }) => registerUser(input)),
    
    login: publicProcedure
      .input(loginInputSchema)
      .mutation(({ input }) => loginUser(input)),
    
    getCurrentUser: publicProcedure
      .input(z.object({ token: z.string() }))
      .query(({ input }) => getCurrentUser(input.token)),
  }),

  // Patient management routes
  patients: router({
    create: publicProcedure
      .input(createPatientInputSchema)
      .mutation(({ input }) => createPatient(input)),
    
    getAll: publicProcedure
      .query(() => getPatients()),
    
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getPatientById(input.id)),
    
    update: publicProcedure
      .input(updatePatientInputSchema)
      .mutation(({ input }) => updatePatient(input)),
    
    search: publicProcedure
      .input(z.object({ query: z.string() }))
      .query(({ input }) => searchPatients(input.query)),
  }),

  // Medicine management routes
  medicines: router({
    create: publicProcedure
      .input(createMedicineInputSchema)
      .mutation(({ input }) => createMedicine(input)),
    
    getAll: publicProcedure
      .query(() => getMedicines()),
    
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getMedicineById(input.id)),
    
    update: publicProcedure
      .input(updateMedicineInputSchema)
      .mutation(({ input }) => updateMedicine(input)),
    
    getLowStock: publicProcedure
      .input(z.object({ threshold: z.number().optional() }))
      .query(({ input }) => getLowStockMedicines(input.threshold)),
    
    search: publicProcedure
      .input(z.object({ query: z.string() }))
      .query(({ input }) => searchMedicines(input.query)),
    
    updateStock: publicProcedure
      .input(z.object({ id: z.number(), quantity: z.number() }))
      .mutation(({ input }) => updateMedicineStock(input.id, input.quantity)),
  }),

  // Prescription management routes
  prescriptions: router({
    create: publicProcedure
      .input(createPrescriptionInputSchema)
      .mutation(({ input }) => createPrescription(input)),
    
    getAll: publicProcedure
      .query(() => getPrescriptions()),
    
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getPrescriptionById(input.id)),
    
    getByPatientId: publicProcedure
      .input(z.object({ patientId: z.number() }))
      .query(({ input }) => getPrescriptionsByPatientId(input.patientId)),
    
    getByDoctorId: publicProcedure
      .input(z.object({ doctorId: z.number() }))
      .query(({ input }) => getPrescriptionsByDoctorId(input.doctorId)),
    
    updateStatus: publicProcedure
      .input(updatePrescriptionStatusInputSchema)
      .mutation(({ input }) => updatePrescriptionStatus(input)),
    
    fillItem: publicProcedure
      .input(z.object({ prescriptionItemId: z.number(), quantityFilled: z.number() }))
      .mutation(({ input }) => fillPrescriptionItem(input.prescriptionItemId, input.quantityFilled)),
    
    getPending: publicProcedure
      .query(() => getPendingPrescriptions()),
  }),

  // Payment management routes
  payments: router({
    create: publicProcedure
      .input(createPaymentInputSchema)
      .mutation(({ input }) => createPayment(input)),
    
    getAll: publicProcedure
      .query(() => getPayments()),
    
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getPaymentById(input.id)),
    
    getByPatientId: publicProcedure
      .input(z.object({ patientId: z.number() }))
      .query(({ input }) => getPaymentsByPatientId(input.patientId)),
    
    getByDateRange: publicProcedure
      .input(z.object({ startDate: z.coerce.date(), endDate: z.coerce.date() }))
      .query(({ input }) => getPaymentsByDateRange(input.startDate, input.endDate)),
    
    getByPrescriptionId: publicProcedure
      .input(z.object({ prescriptionId: z.number() }))
      .query(({ input }) => getPaymentsByPrescriptionId(input.prescriptionId)),
    
    getDailySummary: publicProcedure
      .input(z.object({ date: z.coerce.date() }))
      .query(({ input }) => getDailyPaymentSummary(input.date)),
  }),

  // Reports routes
  reports: router({
    sales: publicProcedure
      .input(salesReportInputSchema)
      .query(({ input }) => generateSalesReport(input)),
    
    medicineUsage: publicProcedure
      .input(medicineUsageReportInputSchema)
      .query(({ input }) => generateMedicineUsageReport(input)),
    
    lowStockAlerts: publicProcedure
      .input(z.object({ threshold: z.number().optional() }))
      .query(({ input }) => getLowStockAlerts(input.threshold)),
    
    monthlySummary: publicProcedure
      .input(z.object({ year: z.number(), month: z.number() }))
      .query(({ input }) => generateMonthlySummary(input.year, input.month)),
  }),

  // Dashboard routes
  dashboard: router({
    admin: publicProcedure
      .query(() => getAdminDashboard()),
    
    doctor: publicProcedure
      .input(z.object({ doctorId: z.number() }))
      .query(({ input }) => getDoctorDashboard(input.doctorId)),
    
    cashier: publicProcedure
      .query(() => getCashierDashboard()),
  }),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`TRPC server listening at port: ${port}`);
}

start();