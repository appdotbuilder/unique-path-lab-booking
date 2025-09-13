import { db } from '../db';
import { appointmentsTable } from '../db/schema';
import { type UpdateAppointmentStatusInput, type Appointment } from '../schema';
import { eq } from 'drizzle-orm';

export async function updateAppointmentStatus(input: UpdateAppointmentStatusInput): Promise<Appointment | null> {
  try {
    // Prepare update values - always update status and updated_at
    const updateValues: any = {
      status: input.status,
      updated_at: new Date()
    };

    // Add notes to update if provided
    if (input.notes !== undefined) {
      updateValues.notes = input.notes;
    }

    // Update the appointment and return the updated record
    const result = await db.update(appointmentsTable)
      .set(updateValues)
      .where(eq(appointmentsTable.id, input.id))
      .returning()
      .execute();

    // Return null if appointment not found
    if (result.length === 0) {
      return null;
    }

    // Convert the result to match the Appointment schema
    const appointment = result[0];
    return {
      ...appointment,
      tests: appointment.tests as string[], // Cast JSONB to string array
      lat: appointment.lat, // Real numbers don't need conversion
      lng: appointment.lng,
      preferred_date: appointment.preferred_date!,
      created_at: appointment.created_at!,
      updated_at: appointment.updated_at!
    };
  } catch (error) {
    console.error('Appointment status update failed:', error);
    throw error;
  }
}