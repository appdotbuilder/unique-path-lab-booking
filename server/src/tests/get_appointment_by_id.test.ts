import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { appointmentsTable } from '../db/schema';
import { getAppointmentById } from '../handlers/get_appointment_by_id';

// Test appointment data
const testAppointmentData = {
  name: 'John Doe',
  phone: '1234567890',
  email: 'john@example.com',
  tests: ['Blood Test', 'X-Ray'],
  preferred_date: new Date('2024-12-25'),
  notes: 'Patient has allergies',
  address_house_no: '123',
  address_house_name: 'Green Villa',
  address_street: 'Main Street',
  address_locality: 'Downtown',
  address_city: 'Mumbai',
  address_state: 'Maharashtra',
  address_pincode: '400001',
  lat: 19.0760,
  lng: 72.8777,
  status: 'Received' as const,
  slot_hint: 'Morning preferred',
  fasting_required: true
};

describe('getAppointmentById', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return appointment when it exists', async () => {
    // Insert test appointment
    const insertResult = await db.insert(appointmentsTable)
      .values({
        ...testAppointmentData,
        tests: JSON.stringify(testAppointmentData.tests) // Store as JSON
      })
      .returning()
      .execute();

    const insertedId = insertResult[0].id;

    // Test the handler
    const result = await getAppointmentById(insertedId);

    expect(result).not.toBeNull();
    expect(result!.id).toEqual(insertedId);
    expect(result!.name).toEqual('John Doe');
    expect(result!.phone).toEqual('1234567890');
    expect(result!.email).toEqual('john@example.com');
    expect(result!.tests).toEqual(['Blood Test', 'X-Ray']);
    expect(result!.preferred_date).toBeInstanceOf(Date);
    expect(result!.preferred_date.getFullYear()).toEqual(2024);
    expect(result!.notes).toEqual('Patient has allergies');
    expect(result!.address_house_no).toEqual('123');
    expect(result!.address_house_name).toEqual('Green Villa');
    expect(result!.address_street).toEqual('Main Street');
    expect(result!.address_locality).toEqual('Downtown');
    expect(result!.address_city).toEqual('Mumbai');
    expect(result!.address_state).toEqual('Maharashtra');
    expect(result!.address_pincode).toEqual('400001');
    expect(result!.lat).toEqual(19.0760);
    expect(result!.lng).toEqual(72.8777);
    expect(result!.status).toEqual('Received');
    expect(result!.slot_hint).toEqual('Morning preferred');
    expect(result!.fasting_required).toEqual(true);
    expect(result!.created_at).toBeInstanceOf(Date);
    expect(result!.updated_at).toBeInstanceOf(Date);
    expect(result!.last_reminder_sent_at).toBeNull();
  });

  it('should return null when appointment does not exist', async () => {
    const result = await getAppointmentById(99999);
    expect(result).toBeNull();
  });

  it('should handle appointment with minimal data', async () => {
    // Insert appointment with minimal required fields
    const minimalData = {
      name: 'Jane Smith',
      phone: null,
      email: 'jane@example.com',
      tests: ['Blood Test'],
      preferred_date: new Date('2024-12-20'),
      notes: null,
      address_house_no: null,
      address_house_name: null,
      address_street: 'Oak Avenue',
      address_locality: 'Uptown',
      address_city: 'Delhi',
      address_state: null,
      address_pincode: null,
      lat: null,
      lng: null,
      status: 'Confirmed' as const,
      slot_hint: null,
      fasting_required: false
    };

    const insertResult = await db.insert(appointmentsTable)
      .values({
        ...minimalData,
        tests: JSON.stringify(minimalData.tests)
      })
      .returning()
      .execute();

    const insertedId = insertResult[0].id;

    const result = await getAppointmentById(insertedId);

    expect(result).not.toBeNull();
    expect(result!.name).toEqual('Jane Smith');
    expect(result!.phone).toBeNull();
    expect(result!.email).toEqual('jane@example.com');
    expect(result!.tests).toEqual(['Blood Test']);
    expect(result!.notes).toBeNull();
    expect(result!.address_house_no).toBeNull();
    expect(result!.address_house_name).toBeNull();
    expect(result!.lat).toBeNull();
    expect(result!.lng).toBeNull();
    expect(result!.status).toEqual('Confirmed');
    expect(result!.slot_hint).toBeNull();
    expect(result!.fasting_required).toEqual(false);
  });

  it('should handle appointment with last_reminder_sent_at', async () => {
    const reminderDate = new Date('2024-12-15T10:30:00Z');
    
    // Insert appointment with reminder date
    const appointmentWithReminder = {
      ...testAppointmentData,
      last_reminder_sent_at: reminderDate
    };

    const insertResult = await db.insert(appointmentsTable)
      .values({
        ...appointmentWithReminder,
        tests: JSON.stringify(appointmentWithReminder.tests)
      })
      .returning()
      .execute();

    const insertedId = insertResult[0].id;

    const result = await getAppointmentById(insertedId);

    expect(result).not.toBeNull();
    expect(result!.last_reminder_sent_at).toBeInstanceOf(Date);
    expect(result!.last_reminder_sent_at!.getTime()).toEqual(reminderDate.getTime());
  });

  it('should handle different appointment statuses', async () => {
    const statuses = ['Received', 'Contacted', 'Confirmed', 'Completed', 'Cancelled'] as const;

    for (const status of statuses) {
      const appointmentData = {
        ...testAppointmentData,
        name: `Patient ${status}`,
        status: status
      };

      const insertResult = await db.insert(appointmentsTable)
        .values({
          ...appointmentData,
          tests: JSON.stringify(appointmentData.tests)
        })
        .returning()
        .execute();

      const insertedId = insertResult[0].id;
      const result = await getAppointmentById(insertedId);

      expect(result).not.toBeNull();
      expect(result!.status).toEqual(status);
      expect(result!.name).toEqual(`Patient ${status}`);
    }
  });

  it('should properly convert multiple test types from JSONB', async () => {
    const complexTests = ['Complete Blood Count', 'Lipid Profile', 'Thyroid Function Test', 'HbA1c', 'Vitamin D'];
    
    const insertResult = await db.insert(appointmentsTable)
      .values({
        ...testAppointmentData,
        tests: JSON.stringify(complexTests)
      })
      .returning()
      .execute();

    const insertedId = insertResult[0].id;
    const result = await getAppointmentById(insertedId);

    expect(result).not.toBeNull();
    expect(result!.tests).toEqual(complexTests);
    expect(Array.isArray(result!.tests)).toBe(true);
    expect(result!.tests.length).toEqual(5);
  });
});