import { z } from 'zod';

// Status enum schema
export const appointmentStatusSchema = z.enum([
  'Received', 
  'Contacted', 
  'Confirmed', 
  'Completed', 
  'Cancelled'
]);

export type AppointmentStatus = z.infer<typeof appointmentStatusSchema>;

// Main appointment schema
export const appointmentSchema = z.object({
  id: z.number(),
  name: z.string(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  tests: z.array(z.string()).min(1, 'At least one test is required'),
  preferred_date: z.coerce.date(),
  notes: z.string().nullable(),
  address_house_no: z.string().nullable(),
  address_house_name: z.string().nullable(),
  address_street: z.string().nullable(),
  address_locality: z.string().nullable(),
  address_city: z.string().nullable(),
  address_state: z.string().nullable(),
  address_pincode: z.string().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  status: appointmentStatusSchema,
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
  last_reminder_sent_at: z.coerce.date().nullable(),
  slot_hint: z.string().nullable(),
  fasting_required: z.boolean()
});

export type Appointment = z.infer<typeof appointmentSchema>;

// Input schema for creating appointments
export const createAppointmentInputSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().nullable(),
  email: z.string().email('Invalid email format').nullable(),
  tests: z.array(z.string()).min(1, 'At least one test is required'),
  preferred_date: z.coerce.date(),
  notes: z.string().nullable(),
  address_house_no: z.string().nullable(),
  address_house_name: z.string().nullable(),
  address_street: z.string().nullable(),
  address_locality: z.string().nullable(),
  address_city: z.string().nullable(),
  address_state: z.string().nullable(),
  address_pincode: z.string().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  slot_hint: z.string().nullable()
}).refine(
  (data) => data.phone !== null || data.email !== null,
  {
    message: 'At least one of phone or email is required',
    path: ['phone']
  }
).refine(
  (data) => {
    // Validate that preferred_date is not in the past
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return data.preferred_date >= today;
  },
  {
    message: 'Preferred date cannot be in the past',
    path: ['preferred_date']
  }
).refine(
  (data) => {
    // Validate address - either map pin (lat/lng) or minimal manual fields
    const hasMapPin = data.lat !== null && data.lng !== null;
    const hasMinimalAddress = data.address_street !== null && 
                             data.address_locality !== null && 
                             data.address_city !== null;
    return hasMapPin || hasMinimalAddress;
  },
  {
    message: 'Address requires either a map pin or street, locality, and city',
    path: ['lat']
  }
);

export type CreateAppointmentInput = z.infer<typeof createAppointmentInputSchema>;

// Input schema for updating appointment status
export const updateAppointmentStatusInputSchema = z.object({
  id: z.number(),
  status: appointmentStatusSchema,
  notes: z.string().nullable().optional()
});

export type UpdateAppointmentStatusInput = z.infer<typeof updateAppointmentStatusInputSchema>;

// Schema for filtering appointments
export const getAppointmentsFilterSchema = z.object({
  status: appointmentStatusSchema.optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  search: z.string().optional() // Search by name, phone, or email
});

export type GetAppointmentsFilter = z.infer<typeof getAppointmentsFilterSchema>;

// Admin authentication schema
export const adminAuthInputSchema = z.object({
  password: z.string()
});

export type AdminAuthInput = z.infer<typeof adminAuthInputSchema>;

// Response schemas
export const appointmentCreatedResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  appointment: appointmentSchema
});

export type AppointmentCreatedResponse = z.infer<typeof appointmentCreatedResponseSchema>;

export const adminAuthResponseSchema = z.object({
  success: z.boolean(),
  message: z.string()
});

export type AdminAuthResponse = z.infer<typeof adminAuthResponseSchema>;