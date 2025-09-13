import { db } from '../db';
import { appointmentsTable } from '../db/schema';
import { type GetAppointmentsFilter, type Appointment } from '../schema';
import { eq, and, gte, lte, or, ilike, desc } from 'drizzle-orm';
import type { SQL } from 'drizzle-orm';

export const getAppointments = async (filter?: GetAppointmentsFilter): Promise<Appointment[]> => {
  try {
    // Build conditions array
    const conditions: SQL<unknown>[] = [];

    if (filter) {
      // Status filtering
      if (filter.status) {
        conditions.push(eq(appointmentsTable.status, filter.status));
      }

      // Date range filtering
      if (filter.startDate) {
        conditions.push(gte(appointmentsTable.preferred_date, filter.startDate));
      }

      if (filter.endDate) {
        conditions.push(lte(appointmentsTable.preferred_date, filter.endDate));
      }

      // Text search across name, phone, and email
      if (filter.search && filter.search.trim()) {
        const searchTerm = `%${filter.search.trim()}%`;
        conditions.push(
          or(
            ilike(appointmentsTable.name, searchTerm),
            ilike(appointmentsTable.phone, searchTerm),
            ilike(appointmentsTable.email, searchTerm)
          )!
        );
      }
    }

    // Build query with conditions
    const baseQuery = db.select().from(appointmentsTable);
    
    const queryWithConditions = conditions.length > 0
      ? baseQuery.where(conditions.length === 1 ? conditions[0] : and(...conditions))
      : baseQuery;

    // Execute query with ordering
    const results = await queryWithConditions
      .orderBy(desc(appointmentsTable.created_at))
      .execute();

    // Convert database results to proper Appointment type
    return results.map(result => ({
      ...result,
      tests: result.tests as string[], // JSONB field needs type assertion
      preferred_date: result.preferred_date as Date,
      created_at: result.created_at as Date,
      updated_at: result.updated_at as Date,
      last_reminder_sent_at: result.last_reminder_sent_at as Date | null
    }));
  } catch (error) {
    console.error('Get appointments failed:', error);
    throw error;
  }
};