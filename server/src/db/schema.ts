import { 
  serial, 
  text, 
  pgTable, 
  timestamp, 
  boolean, 
  jsonb,
  real,
  pgEnum
} from 'drizzle-orm/pg-core';

// Define the status enum for PostgreSQL
export const appointmentStatusEnum = pgEnum('appointment_status', [
  'Received',
  'Contacted', 
  'Confirmed',
  'Completed',
  'Cancelled'
]);

// Main appointments table
export const appointmentsTable = pgTable('appointments', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  phone: text('phone'), // Nullable by default
  email: text('email'), // Nullable by default
  tests: jsonb('tests').notNull(), // Array of strings stored as JSONB
  preferred_date: timestamp('preferred_date').notNull(),
  notes: text('notes'), // Nullable by default
  address_house_no: text('address_house_no'), // Nullable by default
  address_house_name: text('address_house_name'), // Nullable by default
  address_street: text('address_street'), // Nullable by default
  address_locality: text('address_locality'), // Nullable by default
  address_city: text('address_city'), // Nullable by default
  address_state: text('address_state'), // Nullable by default
  address_pincode: text('address_pincode'), // Nullable by default
  lat: real('lat'), // Nullable by default, using real for decimal numbers
  lng: real('lng'), // Nullable by default, using real for decimal numbers
  status: appointmentStatusEnum('status').default('Received').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
  last_reminder_sent_at: timestamp('last_reminder_sent_at'), // Nullable by default
  slot_hint: text('slot_hint'), // Nullable by default
  fasting_required: boolean('fasting_required').default(false).notNull()
});

// TypeScript types for the table schema
export type Appointment = typeof appointmentsTable.$inferSelect; // For SELECT operations
export type NewAppointment = typeof appointmentsTable.$inferInsert; // For INSERT operations

// Export all tables for proper query building
export const tables = { 
  appointments: appointmentsTable 
};