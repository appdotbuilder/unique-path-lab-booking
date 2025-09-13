import { db } from '../db';
import { appointmentsTable } from '../db/schema';
import { type GetAppointmentsFilter } from '../schema';
import { eq, gte, lte, and, or, ilike, type SQL } from 'drizzle-orm';

// Helper function to escape CSV values
function escapeCSV(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }
  
  const str = String(value);
  
  // If the value contains comma, quote, or newline, wrap it in quotes and escape quotes
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  
  return str;
}

// Helper function to format address into a single field
function formatAddress(appointment: any): string {
  const addressParts = [
    appointment.address_house_no,
    appointment.address_house_name,
    appointment.address_street,
    appointment.address_locality,
    appointment.address_city,
    appointment.address_state,
    appointment.address_pincode
  ].filter(part => part !== null && part !== undefined && part !== '');
  
  return addressParts.join(', ');
}

// Helper function to format coordinates
function formatCoordinates(lat: number | null, lng: number | null): string {
  if (lat !== null && lng !== null) {
    return `${lat}, ${lng}`;
  }
  return '';
}

export async function exportAppointmentsCSV(filter?: GetAppointmentsFilter): Promise<string> {
  try {
    // Build the query with filters
    const conditions: SQL<unknown>[] = [];
    
    if (filter?.status) {
      conditions.push(eq(appointmentsTable.status, filter.status));
    }
    
    if (filter?.startDate) {
      conditions.push(gte(appointmentsTable.preferred_date, filter.startDate));
    }
    
    if (filter?.endDate) {
      conditions.push(lte(appointmentsTable.preferred_date, filter.endDate));
    }
    
    if (filter?.search) {
      const searchTerm = `%${filter.search}%`;
      const searchCondition = or(
        ilike(appointmentsTable.name, searchTerm),
        ilike(appointmentsTable.phone, searchTerm),
        ilike(appointmentsTable.email, searchTerm)
      );
      if (searchCondition) {
        conditions.push(searchCondition);
      }
    }
    
    // Execute query with or without conditions
    const appointments = conditions.length > 0
      ? await db.select().from(appointmentsTable)
          .where(conditions.length === 1 ? conditions[0] : and(...conditions))
          .execute()
      : await db.select().from(appointmentsTable).execute();
    
    // Define CSV headers
    const headers = [
      'ID',
      'Name', 
      'Phone',
      'Email',
      'Tests',
      'Preferred Date',
      'Status',
      'Address',
      'Coordinates',
      'Notes',
      'Slot Hint',
      'Fasting Required',
      'Created At',
      'Updated At',
      'Last Reminder Sent'
    ];
    
    // Create CSV content
    const csvRows = [headers.join(',')];
    
    for (const appointment of appointments) {
      const row = [
        escapeCSV(appointment.id),
        escapeCSV(appointment.name),
        escapeCSV(appointment.phone),
        escapeCSV(appointment.email),
        escapeCSV(Array.isArray(appointment.tests) ? appointment.tests.join('; ') : String(appointment.tests)),
        escapeCSV(appointment.preferred_date ? appointment.preferred_date.toISOString().split('T')[0] : ''),
        escapeCSV(appointment.status),
        escapeCSV(formatAddress(appointment)),
        escapeCSV(formatCoordinates(appointment.lat, appointment.lng)),
        escapeCSV(appointment.notes),
        escapeCSV(appointment.slot_hint),
        escapeCSV(appointment.fasting_required ? 'Yes' : 'No'),
        escapeCSV(appointment.created_at ? appointment.created_at.toISOString() : ''),
        escapeCSV(appointment.updated_at ? appointment.updated_at.toISOString() : ''),
        escapeCSV(appointment.last_reminder_sent_at ? appointment.last_reminder_sent_at.toISOString() : '')
      ];
      
      csvRows.push(row.join(','));
    }
    
    return csvRows.join('\n');
  } catch (error) {
    console.error('CSV export failed:', error);
    throw error;
  }
}