import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { appointmentsTable } from '../db/schema';
import { type CreateAppointmentInput, type Appointment } from '../schema';
import { sendNextDayReminders, sendAppointmentNotifications } from '../handlers/send_reminders';
import { eq } from 'drizzle-orm';

// Helper to create test appointments
const createTestAppointment = async (overrides: Partial<CreateAppointmentInput> = {}): Promise<Appointment> => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(10, 0, 0, 0);

  const defaultInput: CreateAppointmentInput = {
    name: 'John Doe',
    phone: '+919876543210',
    email: 'john@example.com',
    tests: ['Blood Test', 'X-Ray'],
    preferred_date: tomorrow,
    notes: 'Test appointment',
    address_house_no: '123',
    address_house_name: null,
    address_street: 'Main Street',
    address_locality: 'Central Area',
    address_city: 'Mumbai',
    address_state: 'Maharashtra',
    address_pincode: '400001',
    lat: 19.0760,
    lng: 72.8777,
    slot_hint: '10:00 AM'
  };

  const input = { ...defaultInput, ...overrides };

  const result = await db.insert(appointmentsTable)
    .values({
      name: input.name,
      phone: input.phone,
      email: input.email,
      tests: input.tests,
      preferred_date: input.preferred_date,
      notes: input.notes,
      address_house_no: input.address_house_no,
      address_house_name: input.address_house_name,
      address_street: input.address_street,
      address_locality: input.address_locality,
      address_city: input.address_city,
      address_state: input.address_state,
      address_pincode: input.address_pincode,
      lat: input.lat,
      lng: input.lng,
      slot_hint: input.slot_hint
    })
    .returning()
    .execute();

  return {
    ...result[0],
    tests: result[0].tests as string[],
    preferred_date: result[0].preferred_date,
    created_at: result[0].created_at,
    updated_at: result[0].updated_at,
    last_reminder_sent_at: result[0].last_reminder_sent_at
  };
};

describe('sendNextDayReminders', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should process appointments for tomorrow with Received status', async () => {
    // Create an appointment for tomorrow with 'Received' status
    await createTestAppointment({
      name: 'Test Patient',
      email: 'patient@example.com',
      phone: '+919876543210'
    });

    // Set status to 'Received' manually
    await db.update(appointmentsTable)
      .set({ status: 'Received' })
      .execute();

    const result = await sendNextDayReminders();

    expect(result.processed).toBe(1);
    expect(result.sent).toBe(1);
  });

  it('should process appointments for tomorrow with Confirmed status', async () => {
    // Create an appointment for tomorrow
    await createTestAppointment({
      name: 'Confirmed Patient',
      email: 'confirmed@example.com'
    });

    // Set status to 'Confirmed'
    await db.update(appointmentsTable)
      .set({ status: 'Confirmed' })
      .execute();

    const result = await sendNextDayReminders();

    expect(result.processed).toBe(1);
    expect(result.sent).toBe(1);
  });

  it('should not process appointments with Completed status', async () => {
    // Create an appointment for tomorrow
    await createTestAppointment({
      name: 'Completed Patient',
      email: 'completed@example.com'
    });

    // Set status to 'Completed'
    await db.update(appointmentsTable)
      .set({ status: 'Completed' })
      .execute();

    const result = await sendNextDayReminders();

    expect(result.processed).toBe(0);
    expect(result.sent).toBe(0);
  });

  it('should not process appointments with Cancelled status', async () => {
    // Create an appointment for tomorrow
    await createTestAppointment({
      name: 'Cancelled Patient',
      email: 'cancelled@example.com'
    });

    // Set status to 'Cancelled'
    await db.update(appointmentsTable)
      .set({ status: 'Cancelled' })
      .execute();

    const result = await sendNextDayReminders();

    expect(result.processed).toBe(0);
    expect(result.sent).toBe(0);
  });

  it('should not process appointments that are not for tomorrow', async () => {
    // Create an appointment for the day after tomorrow
    const dayAfterTomorrow = new Date();
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

    await createTestAppointment({
      name: 'Future Patient',
      email: 'future@example.com',
      preferred_date: dayAfterTomorrow
    });

    const result = await sendNextDayReminders();

    expect(result.processed).toBe(0);
    expect(result.sent).toBe(0);
  });

  it('should not process appointments that already received reminders today', async () => {
    // Create an appointment
    const appointment = await createTestAppointment({
      name: 'Already Reminded Patient',
      email: 'reminded@example.com'
    });

    // Update last_reminder_sent_at to today
    await db.update(appointmentsTable)
      .set({ 
        status: 'Received',
        last_reminder_sent_at: new Date() 
      })
      .where(eq(appointmentsTable.id, appointment.id))
      .execute();

    const result = await sendNextDayReminders();

    expect(result.processed).toBe(0);
    expect(result.sent).toBe(0);
  });

  it('should process appointments that received reminders yesterday', async () => {
    // Create an appointment
    const appointment = await createTestAppointment({
      name: 'Yesterday Reminded Patient',
      email: 'yesterday@example.com'
    });

    // Update last_reminder_sent_at to yesterday
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    await db.update(appointmentsTable)
      .set({ 
        status: 'Received',
        last_reminder_sent_at: yesterday 
      })
      .where(eq(appointmentsTable.id, appointment.id))
      .execute();

    const result = await sendNextDayReminders();

    expect(result.processed).toBe(1);
    expect(result.sent).toBe(1);
  });

  it('should update last_reminder_sent_at after sending reminder', async () => {
    // Create an appointment
    const appointment = await createTestAppointment({
      name: 'Update Test Patient',
      email: 'update@example.com'
    });

    await sendNextDayReminders();

    // Check that last_reminder_sent_at was updated
    const updatedAppointments = await db.select()
      .from(appointmentsTable)
      .where(eq(appointmentsTable.id, appointment.id))
      .execute();

    expect(updatedAppointments).toHaveLength(1);
    expect(updatedAppointments[0].last_reminder_sent_at).toBeInstanceOf(Date);

    // Should be updated today (within the last minute)
    const now = new Date();
    const reminderTime = updatedAppointments[0].last_reminder_sent_at!;
    const timeDiff = now.getTime() - reminderTime.getTime();
    expect(timeDiff).toBeLessThan(60000); // Less than 1 minute
  });

  it('should handle appointments with only phone contact', async () => {
    await createTestAppointment({
      name: 'Phone Only Patient',
      phone: '+919876543210',
      email: null
    });

    const result = await sendNextDayReminders();

    expect(result.processed).toBe(1);
    expect(result.sent).toBe(1);
  });

  it('should handle appointments with only email contact', async () => {
    await createTestAppointment({
      name: 'Email Only Patient',
      phone: null,
      email: 'email@example.com'
    });

    const result = await sendNextDayReminders();

    expect(result.processed).toBe(1);
    expect(result.sent).toBe(1);
  });

  it('should process multiple eligible appointments', async () => {
    // Create multiple appointments for tomorrow
    await createTestAppointment({
      name: 'Patient 1',
      email: 'patient1@example.com'
    });

    await createTestAppointment({
      name: 'Patient 2',
      email: 'patient2@example.com'
    });

    await createTestAppointment({
      name: 'Patient 3',
      phone: '+919876543210',
      email: null
    });

    const result = await sendNextDayReminders();

    expect(result.processed).toBe(3);
    expect(result.sent).toBe(3);
  });
});

describe('sendAppointmentNotifications', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should send notifications for appointment with both email and phone', async () => {
    const appointment = await createTestAppointment({
      name: 'Full Contact Patient',
      email: 'full@example.com',
      phone: '+919876543210'
    });

    // Should not throw an error
    await expect(sendAppointmentNotifications(appointment)).resolves.toBeUndefined();
  });

  it('should send notifications for appointment with only email', async () => {
    const appointment = await createTestAppointment({
      name: 'Email Only Patient',
      email: 'email@example.com',
      phone: null
    });

    await expect(sendAppointmentNotifications(appointment)).resolves.toBeUndefined();
  });

  it('should send notifications for appointment with only phone', async () => {
    const appointment = await createTestAppointment({
      name: 'Phone Only Patient',
      email: null,
      phone: '+919876543210'
    });

    await expect(sendAppointmentNotifications(appointment)).resolves.toBeUndefined();
  });

  it('should handle appointments with fasting required', async () => {
    const appointment = await createTestAppointment({
      name: 'Fasting Patient',
      email: 'fasting@example.com',
      tests: ['Blood Sugar Test', 'Cholesterol Test']
    });

    // Update to require fasting
    await db.update(appointmentsTable)
      .set({ fasting_required: true })
      .where(eq(appointmentsTable.id, appointment.id))
      .execute();

    // Get updated appointment
    const updatedAppointments = await db.select()
      .from(appointmentsTable)
      .where(eq(appointmentsTable.id, appointment.id))
      .execute();

    const updatedAppointment: Appointment = {
      ...updatedAppointments[0],
      tests: updatedAppointments[0].tests as string[],
      preferred_date: updatedAppointments[0].preferred_date,
      created_at: updatedAppointments[0].created_at,
      updated_at: updatedAppointments[0].updated_at,
      last_reminder_sent_at: updatedAppointments[0].last_reminder_sent_at
    };

    await expect(sendAppointmentNotifications(updatedAppointment)).resolves.toBeUndefined();
  });

  it('should handle appointments with multiple tests', async () => {
    const appointment = await createTestAppointment({
      name: 'Multi Test Patient',
      email: 'multi@example.com',
      tests: ['Blood Test', 'Urine Test', 'X-Ray', 'ECG']
    });

    await expect(sendAppointmentNotifications(appointment)).resolves.toBeUndefined();
  });

  it('should handle appointments with comprehensive address details', async () => {
    const appointment = await createTestAppointment({
      name: 'Full Address Patient',
      email: 'address@example.com',
      address_house_no: '123',
      address_house_name: 'Sunrise Apartments',
      address_street: 'MG Road',
      address_locality: 'Bandra West',
      address_city: 'Mumbai',
      address_state: 'Maharashtra',
      address_pincode: '400050',
      lat: 19.0760,
      lng: 72.8777
    });

    await expect(sendAppointmentNotifications(appointment)).resolves.toBeUndefined();
  });
});