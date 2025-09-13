import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { appointmentsTable } from '../db/schema';
import { type UpdateAppointmentStatusInput } from '../schema';
import { updateAppointmentStatus } from '../handlers/update_appointment_status';
import { eq } from 'drizzle-orm';

// Create a test appointment in the database
const createTestAppointment = async () => {
  const result = await db.insert(appointmentsTable)
    .values({
      name: 'John Doe',
      phone: '+1234567890',
      email: 'john@example.com',
      tests: ['Blood Test', 'X-Ray'],
      preferred_date: new Date('2024-12-25'),
      notes: 'Initial notes',
      address_street: 'Main Street',
      address_locality: 'Downtown',
      address_city: 'Test City',
      address_state: 'Test State',
      address_pincode: '12345',
      lat: 40.7128,
      lng: -74.0060,
      status: 'Received',
      slot_hint: 'Morning preferred',
      fasting_required: true
    })
    .returning()
    .execute();

  return result[0];
};

describe('updateAppointmentStatus', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should update appointment status successfully', async () => {
    const testAppointment = await createTestAppointment();
    
    const updateInput: UpdateAppointmentStatusInput = {
      id: testAppointment.id,
      status: 'Contacted'
    };

    const result = await updateAppointmentStatus(updateInput);

    expect(result).not.toBeNull();
    expect(result!.id).toEqual(testAppointment.id);
    expect(result!.status).toEqual('Contacted');
    expect(result!.name).toEqual('John Doe');
    expect(result!.tests).toEqual(['Blood Test', 'X-Ray']);
    expect(result!.lat).toEqual(40.7128);
    expect(result!.lng).toEqual(-74.0060);
    expect(result!.updated_at).toBeInstanceOf(Date);
    expect(result!.updated_at.getTime()).toBeGreaterThan(testAppointment.updated_at!.getTime());
  });

  it('should update status and notes when both provided', async () => {
    const testAppointment = await createTestAppointment();
    
    const updateInput: UpdateAppointmentStatusInput = {
      id: testAppointment.id,
      status: 'Confirmed',
      notes: 'Patient confirmed appointment via phone call'
    };

    const result = await updateAppointmentStatus(updateInput);

    expect(result).not.toBeNull();
    expect(result!.status).toEqual('Confirmed');
    expect(result!.notes).toEqual('Patient confirmed appointment via phone call');
    expect(result!.updated_at).toBeInstanceOf(Date);
    expect(result!.updated_at.getTime()).toBeGreaterThan(testAppointment.updated_at!.getTime());
  });

  it('should update status to null notes when notes is explicitly null', async () => {
    const testAppointment = await createTestAppointment();
    
    const updateInput: UpdateAppointmentStatusInput = {
      id: testAppointment.id,
      status: 'Completed',
      notes: null
    };

    const result = await updateAppointmentStatus(updateInput);

    expect(result).not.toBeNull();
    expect(result!.status).toEqual('Completed');
    expect(result!.notes).toBeNull();
  });

  it('should preserve existing notes when notes not provided', async () => {
    const testAppointment = await createTestAppointment();
    
    const updateInput: UpdateAppointmentStatusInput = {
      id: testAppointment.id,
      status: 'Cancelled'
    };

    const result = await updateAppointmentStatus(updateInput);

    expect(result).not.toBeNull();
    expect(result!.status).toEqual('Cancelled');
    expect(result!.notes).toEqual('Initial notes'); // Should preserve original notes
  });

  it('should return null for non-existent appointment', async () => {
    const updateInput: UpdateAppointmentStatusInput = {
      id: 99999, // Non-existent ID
      status: 'Contacted'
    };

    const result = await updateAppointmentStatus(updateInput);

    expect(result).toBeNull();
  });

  it('should save updated appointment to database', async () => {
    const testAppointment = await createTestAppointment();
    
    const updateInput: UpdateAppointmentStatusInput = {
      id: testAppointment.id,
      status: 'Confirmed',
      notes: 'Database persistence test'
    };

    await updateAppointmentStatus(updateInput);

    // Verify the update was persisted in database
    const appointments = await db.select()
      .from(appointmentsTable)
      .where(eq(appointmentsTable.id, testAppointment.id))
      .execute();

    expect(appointments).toHaveLength(1);
    expect(appointments[0].status).toEqual('Confirmed');
    expect(appointments[0].notes).toEqual('Database persistence test');
    expect(appointments[0].updated_at!.getTime()).toBeGreaterThan(testAppointment.updated_at!.getTime());
  });

  it('should handle all valid appointment statuses', async () => {
    const testAppointment = await createTestAppointment();
    
    const statuses = ['Received', 'Contacted', 'Confirmed', 'Completed', 'Cancelled'] as const;
    
    for (const status of statuses) {
      const updateInput: UpdateAppointmentStatusInput = {
        id: testAppointment.id,
        status: status,
        notes: `Status changed to ${status}`
      };

      const result = await updateAppointmentStatus(updateInput);

      expect(result).not.toBeNull();
      expect(result!.status).toEqual(status);
      expect(result!.notes).toEqual(`Status changed to ${status}`);
    }
  });

  it('should preserve all other appointment fields during update', async () => {
    const testAppointment = await createTestAppointment();
    
    const updateInput: UpdateAppointmentStatusInput = {
      id: testAppointment.id,
      status: 'Contacted'
    };

    const result = await updateAppointmentStatus(updateInput);

    expect(result).not.toBeNull();
    
    // Verify all original fields are preserved
    expect(result!.name).toEqual('John Doe');
    expect(result!.phone).toEqual('+1234567890');
    expect(result!.email).toEqual('john@example.com');
    expect(result!.tests).toEqual(['Blood Test', 'X-Ray']);
    expect(result!.preferred_date).toEqual(new Date('2024-12-25'));
    expect(result!.address_street).toEqual('Main Street');
    expect(result!.address_locality).toEqual('Downtown');
    expect(result!.address_city).toEqual('Test City');
    expect(result!.address_state).toEqual('Test State');
    expect(result!.address_pincode).toEqual('12345');
    expect(result!.lat).toEqual(40.7128);
    expect(result!.lng).toEqual(-74.0060);
    expect(result!.slot_hint).toEqual('Morning preferred');
    expect(result!.fasting_required).toEqual(true);
    expect(result!.created_at).toEqual(testAppointment.created_at);
    expect(result!.last_reminder_sent_at).toBeNull();
  });
});