import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { appointmentsTable } from '../db/schema';
import { type GetAppointmentsFilter } from '../schema';
import { exportAppointmentsCSV } from '../handlers/export_appointments_csv';

// Test data setup
const createTestAppointment = async (overrides: any = {}) => {
  const defaultData = {
    name: 'John Doe',
    phone: '+1234567890',
    email: 'john@example.com',
    tests: JSON.stringify(['Blood Test', 'X-Ray']),
    preferred_date: new Date('2024-12-25'),
    notes: 'Regular checkup',
    address_house_no: '123',
    address_house_name: 'Sunrise Apartments',
    address_street: 'Main Street',
    address_locality: 'Downtown',
    address_city: 'Mumbai',
    address_state: 'Maharashtra',
    address_pincode: '400001',
    lat: 19.0760,
    lng: 72.8777,
    status: 'Received',
    slot_hint: 'Morning preferred',
    fasting_required: true,
    ...overrides
  };

  const result = await db.insert(appointmentsTable)
    .values(defaultData)
    .returning()
    .execute();
    
  return result[0];
};

describe('exportAppointmentsCSV', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should export basic appointment data as CSV', async () => {
    await createTestAppointment();
    
    const csv = await exportAppointmentsCSV();
    
    const lines = csv.split('\n');
    expect(lines.length).toBe(2); // Header + 1 data row
    
    // Check headers
    const headers = lines[0];
    expect(headers).toContain('ID,Name,Phone,Email,Tests,Preferred Date,Status');
    expect(headers).toContain('Address,Coordinates,Notes,Slot Hint,Fasting Required');
    expect(headers).toContain('Created At,Updated At,Last Reminder Sent');
    
    // Check data row
    const dataRow = lines[1];
    expect(dataRow).toContain('John Doe');
    expect(dataRow).toContain('+1234567890');
    expect(dataRow).toContain('john@example.com');
    expect(dataRow).toContain('Blood Test; X-Ray');
    expect(dataRow).toContain('2024-12-25');
    expect(dataRow).toContain('Received');
    expect(dataRow).toContain('Yes'); // fasting_required = true
  });

  it('should handle appointments with no filters', async () => {
    await createTestAppointment({ name: 'Alice Smith', status: 'Confirmed' });
    await createTestAppointment({ name: 'Bob Johnson', status: 'Completed' });
    
    const csv = await exportAppointmentsCSV();
    
    const lines = csv.split('\n');
    expect(lines.length).toBe(3); // Header + 2 data rows
    expect(csv).toContain('Alice Smith');
    expect(csv).toContain('Bob Johnson');
    expect(csv).toContain('Confirmed');
    expect(csv).toContain('Completed');
  });

  it('should filter appointments by status', async () => {
    await createTestAppointment({ name: 'Alice Smith', status: 'Confirmed' });
    await createTestAppointment({ name: 'Bob Johnson', status: 'Completed' });
    await createTestAppointment({ name: 'Charlie Brown', status: 'Cancelled' });
    
    const filter: GetAppointmentsFilter = { status: 'Confirmed' };
    const csv = await exportAppointmentsCSV(filter);
    
    const lines = csv.split('\n');
    expect(lines.length).toBe(2); // Header + 1 data row
    expect(csv).toContain('Alice Smith');
    expect(csv).toContain('Confirmed');
    expect(csv).not.toContain('Bob Johnson');
    expect(csv).not.toContain('Charlie Brown');
  });

  it('should filter appointments by date range', async () => {
    await createTestAppointment({ 
      name: 'Alice Smith', 
      preferred_date: new Date('2024-12-20') 
    });
    await createTestAppointment({ 
      name: 'Bob Johnson', 
      preferred_date: new Date('2024-12-25') 
    });
    await createTestAppointment({ 
      name: 'Charlie Brown', 
      preferred_date: new Date('2024-12-30') 
    });
    
    const filter: GetAppointmentsFilter = { 
      startDate: new Date('2024-12-22'),
      endDate: new Date('2024-12-28')
    };
    const csv = await exportAppointmentsCSV(filter);
    
    const lines = csv.split('\n');
    expect(lines.length).toBe(2); // Header + 1 data row
    expect(csv).toContain('Bob Johnson');
    expect(csv).not.toContain('Alice Smith');
    expect(csv).not.toContain('Charlie Brown');
  });

  it('should filter appointments by search term', async () => {
    await createTestAppointment({ 
      name: 'Alice Smith',
      phone: '+1111111111',
      email: 'alice@example.com'
    });
    await createTestAppointment({ 
      name: 'Bob Johnson',
      phone: '+2222222222', 
      email: 'bob@test.com'
    });
    
    // Search by name
    let filter: GetAppointmentsFilter = { search: 'Alice' };
    let csv = await exportAppointmentsCSV(filter);
    expect(csv).toContain('Alice Smith');
    expect(csv).not.toContain('Bob Johnson');
    
    // Search by phone
    filter = { search: '2222' };
    csv = await exportAppointmentsCSV(filter);
    expect(csv).toContain('Bob Johnson');
    expect(csv).not.toContain('Alice Smith');
    
    // Search by email
    filter = { search: 'test.com' };
    csv = await exportAppointmentsCSV(filter);
    expect(csv).toContain('Bob Johnson');
    expect(csv).not.toContain('Alice Smith');
  });

  it('should handle CSV escaping for special characters', async () => {
    await createTestAppointment({
      name: 'John "Johnny" Doe',
      notes: 'Patient has allergies, requires special care',
      address_street: 'Main Street, Building A'
    });
    
    const csv = await exportAppointmentsCSV();
    
    // Check that quotes are properly escaped
    expect(csv).toContain('"John ""Johnny"" Doe"');
    // Check that commas trigger quote wrapping
    expect(csv).toContain('"Patient has allergies, requires special care"');
    // Address field combines multiple parts, so check for the street part
    expect(csv).toContain('Main Street, Building A');
  });

  it('should format address fields correctly', async () => {
    await createTestAppointment({
      address_house_no: '123',
      address_house_name: 'Sunrise Apartments',
      address_street: 'Main Street',
      address_locality: 'Downtown',
      address_city: 'Mumbai',
      address_state: 'Maharashtra',
      address_pincode: '400001'
    });
    
    const csv = await exportAppointmentsCSV();
    
    // Address should be formatted as comma-separated values
    expect(csv).toContain('123, Sunrise Apartments, Main Street, Downtown, Mumbai, Maharashtra, 400001');
  });

  it('should format coordinates correctly', async () => {
    await createTestAppointment({
      lat: 19.0760,
      lng: 72.8777
    });
    
    const csv = await exportAppointmentsCSV();
    
    expect(csv).toContain('19.076, 72.8777');
  });

  it('should handle null and empty values gracefully', async () => {
    await createTestAppointment({
      phone: null,
      email: null,
      notes: null,
      address_house_no: null,
      address_house_name: null,
      address_street: 'Main Street', // Keep minimal required fields
      address_locality: 'Downtown',  
      address_city: 'Mumbai',
      address_state: null, // Make state null to avoid confusion
      address_pincode: null, // Make pincode null too
      lat: null,
      lng: null,
      slot_hint: null,
      last_reminder_sent_at: null
    });
    
    const csv = await exportAppointmentsCSV();
    
    // Debug: log the actual CSV to see the format
    console.log('CSV Output:', csv);
    
    // Check that null fields are properly handled as empty strings
    expect(csv).toContain(',,'); // Adjacent commas for null phone and email
    expect(csv).toContain('Main Street, Downtown, Mumbai'); // Address with only non-null parts
    
    // Check that coordinates field is empty when lat/lng are null
    // Since address contains commas, it will be quoted, so we look for the pattern
    const lines = csv.split('\n');
    const dataRow = lines[1];
    
    // Look for empty coordinates field - should be between address and notes
    expect(dataRow).toContain('Mumbai",,'); // Quoted address followed by empty coordinates and notes
  });

  it('should handle appointments with different test arrays', async () => {
    await createTestAppointment({
      name: 'Single Test Patient',
      tests: JSON.stringify(['Blood Test'])
    });
    await createTestAppointment({
      name: 'Multiple Test Patient',
      tests: JSON.stringify(['Blood Test', 'X-Ray', 'MRI', 'CT Scan'])
    });
    
    const csv = await exportAppointmentsCSV();
    
    expect(csv).toContain('Blood Test'); // Single test
    expect(csv).toContain('Blood Test; X-Ray; MRI; CT Scan'); // Multiple tests
  });

  it('should format boolean fasting_required correctly', async () => {
    await createTestAppointment({
      name: 'Fasting Patient',
      fasting_required: true
    });
    await createTestAppointment({
      name: 'Non-Fasting Patient',
      fasting_required: false
    });
    
    const csv = await exportAppointmentsCSV();
    
    const lines = csv.split('\n');
    expect(lines[1]).toContain('Yes'); // fasting_required = true
    expect(lines[2]).toContain('No');  // fasting_required = false
  });

  it('should format dates correctly in CSV', async () => {
    const preferredDate = new Date('2024-12-25T10:30:00Z');
    await createTestAppointment({
      preferred_date: preferredDate
    });
    
    const csv = await exportAppointmentsCSV();
    
    // Preferred date should be formatted as YYYY-MM-DD
    expect(csv).toContain('2024-12-25');
    // Created/Updated dates should be ISO strings
    expect(csv).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });

  it('should return empty CSV with headers when no appointments match filter', async () => {
    await createTestAppointment({ status: 'Confirmed' });
    
    const filter: GetAppointmentsFilter = { status: 'Cancelled' };
    const csv = await exportAppointmentsCSV(filter);
    
    const lines = csv.split('\n');
    expect(lines.length).toBe(1); // Only headers
    expect(lines[0]).toContain('ID,Name,Phone,Email');
  });
});