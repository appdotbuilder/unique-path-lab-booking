import { db } from '../db';
import { appointmentsTable } from '../db/schema';
import { eq } from 'drizzle-orm';
import { type Appointment } from '../schema';

export async function getAppointmentById(id: number): Promise<Appointment | null> {
  try {
    // Query appointment by ID
    const result = await db.select()
      .from(appointmentsTable)
      .where(eq(appointmentsTable.id, id))
      .execute();

    if (result.length === 0) {
      return null;
    }

    const appointment = result[0];
    
    // Convert database record to expected schema format
    return {
      ...appointment,
      tests: appointment.tests as string[], // JSONB array conversion
      preferred_date: new Date(appointment.preferred_date),
      created_at: new Date(appointment.created_at),
      updated_at: new Date(appointment.updated_at),
      last_reminder_sent_at: appointment.last_reminder_sent_at 
        ? new Date(appointment.last_reminder_sent_at) 
        : null
    };
  } catch (error) {
    console.error('Failed to get appointment by ID:', error);
    throw error;
  }
}