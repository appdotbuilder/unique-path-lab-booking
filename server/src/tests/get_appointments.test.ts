import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { appointmentsTable } from '../db/schema';
import { type GetAppointmentsFilter } from '../schema';
import { getAppointments } from '../handlers/get_appointments';

// Test data setup
const createTestAppointment = async (overrides = {}) => {
  const baseAppointment = {
    name: 'John Doe',
    phone: '+1234567890',
    email: 'john@example.com',
    tests: JSON.stringify(['Blood Test', 'X-Ray']),
    preferred_date: new Date('2024-12-25'),
    notes: 'Test notes',
    address_street: '123 Main St',
    address_locality: 'Downtown',
    address_city: 'Test City',
    address_state: 'Test State',
    address_pincode: '12345',
    lat: 40.7128,
    lng: -74.0060,
    status: 'Received' as const,
    slot_hint: 'Morning preferred',
    fasting_required: false,
    ...overrides
  };

  const result = await db.insert(appointmentsTable)
    .values(baseAppointment)
    .returning()
    .execute();

  return result[0];
};

describe('getAppointments', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return all appointments when no filter is provided', async () => {
    // Create test appointments
    await createTestAppointment({ name: 'John Doe' });
    await createTestAppointment({ name: 'Jane Smith' });
    await createTestAppointment({ name: 'Bob Johnson' });

    const result = await getAppointments();

    expect(result).toHaveLength(3);
    expect(result[0].name).toEqual('Bob Johnson'); // Most recent first due to DESC order
    expect(result[1].name).toEqual('Jane Smith');
    expect(result[2].name).toEqual('John Doe');

    // Verify proper type conversion
    expect(Array.isArray(result[0].tests)).toBe(true);
    expect(result[0].tests).toEqual(['Blood Test', 'X-Ray']);
    expect(result[0].preferred_date).toBeInstanceOf(Date);
    expect(result[0].created_at).toBeInstanceOf(Date);
  });

  it('should filter appointments by status', async () => {
    await createTestAppointment({ name: 'John Doe', status: 'Received' });
    await createTestAppointment({ name: 'Jane Smith', status: 'Confirmed' });
    await createTestAppointment({ name: 'Bob Johnson', status: 'Completed' });

    const filter: GetAppointmentsFilter = { status: 'Confirmed' };
    const result = await getAppointments(filter);

    expect(result).toHaveLength(1);
    expect(result[0].name).toEqual('Jane Smith');
    expect(result[0].status).toEqual('Confirmed');
  });

  it('should filter appointments by date range', async () => {
    await createTestAppointment({ 
      name: 'Old Appointment', 
      preferred_date: new Date('2024-01-15') 
    });
    await createTestAppointment({ 
      name: 'Current Appointment', 
      preferred_date: new Date('2024-06-15') 
    });
    await createTestAppointment({ 
      name: 'Future Appointment', 
      preferred_date: new Date('2024-12-15') 
    });

    // Filter for appointments between June and December
    const filter: GetAppointmentsFilter = {
      startDate: new Date('2024-06-01'),
      endDate: new Date('2024-12-31')
    };
    const result = await getAppointments(filter);

    expect(result).toHaveLength(2);
    expect(result.map(a => a.name)).toContain('Current Appointment');
    expect(result.map(a => a.name)).toContain('Future Appointment');
    expect(result.map(a => a.name)).not.toContain('Old Appointment');
  });

  it('should search appointments by name', async () => {
    await createTestAppointment({ name: 'John Smith' });
    await createTestAppointment({ name: 'Jane Doe' });
    await createTestAppointment({ name: 'Bob Wilson' });

    const filter: GetAppointmentsFilter = { search: 'Smith' };
    const result = await getAppointments(filter);

    expect(result).toHaveLength(1);
    expect(result[0].name).toEqual('John Smith');
  });

  it('should search appointments case-insensitively', async () => {
    await createTestAppointment({ name: 'John Smith' });
    await createTestAppointment({ name: 'jane doe' });
    await createTestAppointment({ name: 'Bob Wilson' });

    const filter: GetAppointmentsFilter = { search: 'JANE' };
    const result = await getAppointments(filter);

    expect(result).toHaveLength(1);
    expect(result[0].name).toEqual('jane doe');
  });

  it('should search appointments by phone', async () => {
    await createTestAppointment({ 
      name: 'John Doe', 
      phone: '+1234567890' 
    });
    await createTestAppointment({ 
      name: 'Jane Smith', 
      phone: '+9876543210' 
    });
    await createTestAppointment({ 
      name: 'Bob Johnson', 
      phone: '+5555555555' 
    });

    const filter: GetAppointmentsFilter = { search: '987' };
    const result = await getAppointments(filter);

    expect(result).toHaveLength(1);
    expect(result[0].name).toEqual('Jane Smith');
    expect(result[0].phone).toEqual('+9876543210');
  });

  it('should search appointments by email', async () => {
    await createTestAppointment({ 
      name: 'John Doe', 
      email: 'john@gmail.com' 
    });
    await createTestAppointment({ 
      name: 'Jane Smith', 
      email: 'jane@yahoo.com' 
    });
    await createTestAppointment({ 
      name: 'Bob Johnson', 
      email: 'bob@outlook.com' 
    });

    const filter: GetAppointmentsFilter = { search: 'gmail' };
    const result = await getAppointments(filter);

    expect(result).toHaveLength(1);
    expect(result[0].name).toEqual('John Doe');
    expect(result[0].email).toEqual('john@gmail.com');
  });

  it('should apply multiple filters simultaneously', async () => {
    // Create appointments with different statuses and dates
    await createTestAppointment({
      name: 'John Confirmed',
      status: 'Confirmed',
      preferred_date: new Date('2024-06-15')
    });
    await createTestAppointment({
      name: 'Jane Confirmed',
      status: 'Confirmed',
      preferred_date: new Date('2024-12-15')
    });
    await createTestAppointment({
      name: 'Bob Received',
      status: 'Received',
      preferred_date: new Date('2024-06-20')
    });

    // Filter for confirmed appointments in a specific date range with name search
    const filter: GetAppointmentsFilter = {
      status: 'Confirmed',
      startDate: new Date('2024-06-01'),
      endDate: new Date('2024-06-30'),
      search: 'John'
    };
    const result = await getAppointments(filter);

    expect(result).toHaveLength(1);
    expect(result[0].name).toEqual('John Confirmed');
    expect(result[0].status).toEqual('Confirmed');
  });

  it('should return appointments ordered by created_at DESC', async () => {
    // Create appointments with slight delays to ensure different created_at times
    const first = await createTestAppointment({ name: 'First' });
    
    // Small delay to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));
    const second = await createTestAppointment({ name: 'Second' });
    
    await new Promise(resolve => setTimeout(resolve, 10));
    const third = await createTestAppointment({ name: 'Third' });

    const result = await getAppointments();

    expect(result).toHaveLength(3);
    // Most recent should be first
    expect(result[0].name).toEqual('Third');
    expect(result[1].name).toEqual('Second');
    expect(result[2].name).toEqual('First');

    // Verify timestamps are in descending order
    expect(result[0].created_at >= result[1].created_at).toBe(true);
    expect(result[1].created_at >= result[2].created_at).toBe(true);
  });

  it('should return empty array when no appointments match filters', async () => {
    await createTestAppointment({ status: 'Received' });
    await createTestAppointment({ status: 'Confirmed' });

    const filter: GetAppointmentsFilter = { status: 'Cancelled' };
    const result = await getAppointments(filter);

    expect(result).toHaveLength(0);
  });

  it('should handle appointments with null fields correctly', async () => {
    await createTestAppointment({
      name: 'Test User',
      phone: null,
      email: 'test@example.com',
      notes: null,
      last_reminder_sent_at: null
    });

    const result = await getAppointments();

    expect(result).toHaveLength(1);
    expect(result[0].name).toEqual('Test User');
    expect(result[0].phone).toBeNull();
    expect(result[0].email).toEqual('test@example.com');
    expect(result[0].notes).toBeNull();
    expect(result[0].last_reminder_sent_at).toBeNull();
  });
});