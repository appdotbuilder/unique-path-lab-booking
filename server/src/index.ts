import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schemas
import { 
  createAppointmentInputSchema,
  updateAppointmentStatusInputSchema,
  getAppointmentsFilterSchema,
  adminAuthInputSchema
} from './schema';

// Import handlers
import { createAppointment } from './handlers/create_appointment';
import { getAppointments } from './handlers/get_appointments';
import { getAppointmentById } from './handlers/get_appointment_by_id';
import { updateAppointmentStatus } from './handlers/update_appointment_status';
import { authenticateAdmin } from './handlers/authenticate_admin';
import { exportAppointmentsCSV } from './handlers/export_appointments_csv';
import { sendNextDayReminders } from './handlers/send_reminders';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check endpoint
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Public booking endpoint
  createAppointment: publicProcedure
    .input(createAppointmentInputSchema)
    .mutation(async ({ input }) => {
      const appointment = await createAppointment(input);
      return {
        success: true,
        message: 'Booking received — you will be contacted for further info.',
        appointment
      };
    }),

  // Admin authentication
  authenticateAdmin: publicProcedure
    .input(adminAuthInputSchema)
    .mutation(({ input }) => authenticateAdmin(input)),

  // Admin endpoints - in production, these should be protected with authentication middleware
  getAppointments: publicProcedure
    .input(getAppointmentsFilterSchema.optional())
    .query(({ input }) => getAppointments(input)),

  getAppointmentById: publicProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => getAppointmentById(input.id)),

  updateAppointmentStatus: publicProcedure
    .input(updateAppointmentStatusInputSchema)
    .mutation(({ input }) => updateAppointmentStatus(input)),

  exportAppointmentsCSV: publicProcedure
    .input(getAppointmentsFilterSchema.optional())
    .query(async ({ input }) => {
      const csvData = await exportAppointmentsCSV(input);
      return { csvData };
    }),

  // Scheduled task endpoint - should be protected in production
  sendNextDayReminders: publicProcedure
    .mutation(() => sendNextDayReminders()),
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
  console.log('Available endpoints:');
  console.log('- POST /createAppointment - Create new appointment');
  console.log('- POST /authenticateAdmin - Admin authentication');
  console.log('- POST /getAppointments - Get filtered appointments');
  console.log('- POST /getAppointmentById - Get single appointment');
  console.log('- POST /updateAppointmentStatus - Update appointment status');
  console.log('- POST /exportAppointmentsCSV - Export appointments as CSV');
  console.log('- POST /sendNextDayReminders - Send scheduled reminders');
}

start();