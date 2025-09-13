import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { appointmentsTable } from '../db/schema';
import { type CreateAppointmentInput } from '../schema';
import { createAppointment } from '../handlers/create_appointment';
import { eq } from 'drizzle-orm';

// Base test input with all required fields
const baseTestInput: CreateAppointmentInput = {
  name: 'John Doe',
  phone: '+1234567890',
  email: 'john.doe@example.com',
  tests: ['Blood Test', 'X-Ray'],
  preferred_date: new Date('2024-12-25'),
  notes: 'Please call before arrival',
  address_house_no: '123',
  address_house_name: 'Test House',
  address_street: 'Main Street',
  address_locality: 'Downtown',
  address_city: 'Test City',
  address_state: 'Test State',
  address_pincode: '12345',
  lat: 40.7128,
  lng: -74.0060,
  slot_hint: 'Morning preferred'
};

// Test input with map pin (lat/lng) only
const mapPinInput: CreateAppointmentInput = {
  name: 'Jane Smith',
  phone: '+0987654321',
  email: null,
  tests: ['CBC', 'Lipid Profile'],
  preferred_date: new Date('2024-12-26'),
  notes: null,
  address_house_no: null,
  address_house_name: null,
  address_street: null,
  address_locality: null,
  address_city: null,
  address_state: null,
  address_pincode: null,
  lat: 37.7749,
  lng: -122.4194,
  slot_hint: null
};

// Test input with manual address only
const manualAddressInput: CreateAppointmentInput = {
  name: 'Bob Johnson',
  phone: null,
  email: 'bob.johnson@example.com',
  tests: ['KFT'],
  preferred_date: new Date('2024-12-27'),
  notes: 'Has parking issues',
  address_house_no: '456',
  address_house_name: null,
  address_street: 'Oak Avenue',
  address_locality: 'Uptown',
  address_city: 'Another City',
  address_state: 'Another State',
  address_pincode: '54321',
  lat: null,
  lng: null,
  slot_hint: 'Evening preferred'
};

describe('createAppointment', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should create appointment with all fields', async () => {
    const result = await createAppointment(baseTestInput);

    // Validate all basic fields
    expect(result.name).toEqual('John Doe');
    expect(result.phone).toEqual('+1234567890');
    expect(result.email).toEqual('john.doe@example.com');
    expect(result.tests).toEqual(['Blood Test', 'X-Ray']);
    expect(result.preferred_date).toEqual(new Date('2024-12-25'));
    expect(result.notes).toEqual('Please call before arrival');
    
    // Address fields
    expect(result.address_house_no).toEqual('123');
    expect(result.address_house_name).toEqual('Test House');
    expect(result.address_street).toEqual('Main Street');
    expect(result.address_locality).toEqual('Downtown');
    expect(result.address_city).toEqual('Test City');
    expect(result.address_state).toEqual('Test State');
    expect(result.address_pincode).toEqual('12345');
    expect(result.lat).toEqual(40.7128);
    expect(result.lng).toEqual(-74.0060);
    
    // Auto-generated fields
    expect(result.id).toBeDefined();
    expect(result.status).toEqual('Received');
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.last_reminder_sent_at).toBeNull();
    expect(result.slot_hint).toEqual('Morning preferred');
    expect(result.fasting_required).toEqual(false); // No fasting tests in this input
  });

  it('should save appointment to database', async () => {
    const result = await createAppointment(baseTestInput);

    // Verify database record
    const appointments = await db.select()
      .from(appointmentsTable)
      .where(eq(appointmentsTable.id, result.id))
      .execute();

    expect(appointments).toHaveLength(1);
    const dbAppointment = appointments[0];
    
    expect(dbAppointment.name).toEqual('John Doe');
    expect(dbAppointment.phone).toEqual('+1234567890');
    expect(dbAppointment.email).toEqual('john.doe@example.com');
    expect(dbAppointment.tests).toEqual(['Blood Test', 'X-Ray']);
    expect(dbAppointment.status).toEqual('Received');
    expect(dbAppointment.fasting_required).toEqual(false);
    expect(dbAppointment.created_at).toBeInstanceOf(Date);
    expect(dbAppointment.updated_at).toBeInstanceOf(Date);
  });

  it('should set fasting_required to true for fasting tests', async () => {
    const fastingInput: CreateAppointmentInput = {
      ...baseTestInput,
      tests: ['CBC', 'Regular Test']
    };

    const result = await createAppointment(fastingInput);
    expect(result.fasting_required).toEqual(true);

    // Test with KFT
    const kftInput: CreateAppointmentInput = {
      ...baseTestInput,
      tests: ['KFT']
    };

    const kftResult = await createAppointment(kftInput);
    expect(kftResult.fasting_required).toEqual(true);

    // Test with Lipid Profile
    const lipidInput: CreateAppointmentInput = {
      ...baseTestInput,
      tests: ['Lipid Profile', 'Blood Test']
    };

    const lipidResult = await createAppointment(lipidInput);
    expect(lipidResult.fasting_required).toEqual(true);
  });

  it('should set fasting_required to false for non-fasting tests', async () => {
    const nonFastingInput: CreateAppointmentInput = {
      ...baseTestInput,
      tests: ['Blood Test', 'X-Ray', 'Ultrasound']
    };

    const result = await createAppointment(nonFastingInput);
    expect(result.fasting_required).toEqual(false);
  });

  it('should create appointment with map pin address only', async () => {
    const result = await createAppointment(mapPinInput);

    expect(result.name).toEqual('Jane Smith');
    expect(result.phone).toEqual('+0987654321');
    expect(result.email).toBeNull();
    expect(result.tests).toEqual(['CBC', 'Lipid Profile']);
    expect(result.lat).toEqual(37.7749);
    expect(result.lng).toEqual(-122.4194);
    
    // Manual address fields should be null
    expect(result.address_street).toBeNull();
    expect(result.address_locality).toBeNull();
    expect(result.address_city).toBeNull();
    
    expect(result.fasting_required).toEqual(true); // CBC and Lipid Profile require fasting
    expect(result.status).toEqual('Received');
  });

  it('should create appointment with manual address only', async () => {
    const result = await createAppointment(manualAddressInput);

    expect(result.name).toEqual('Bob Johnson');
    expect(result.phone).toBeNull();
    expect(result.email).toEqual('bob.johnson@example.com');
    expect(result.tests).toEqual(['KFT']);
    expect(result.address_street).toEqual('Oak Avenue');
    expect(result.address_locality).toEqual('Uptown');
    expect(result.address_city).toEqual('Another City');
    
    // Map coordinates should be null
    expect(result.lat).toBeNull();
    expect(result.lng).toBeNull();
    
    expect(result.fasting_required).toEqual(true); // KFT requires fasting
    expect(result.status).toEqual('Received');
  });

  it('should handle multiple appointments correctly', async () => {
    // Create first appointment
    const first = await createAppointment(baseTestInput);
    
    // Create second appointment with different data
    const secondInput: CreateAppointmentInput = {
      ...mapPinInput,
      name: 'Different Person'
    };
    const second = await createAppointment(secondInput);

    // Verify both exist and have different IDs
    expect(first.id).not.toEqual(second.id);
    expect(first.name).toEqual('John Doe');
    expect(second.name).toEqual('Different Person');

    // Verify database has both records
    const allAppointments = await db.select()
      .from(appointmentsTable)
      .execute();

    expect(allAppointments).toHaveLength(2);
  });

  it('should handle null values correctly', async () => {
    const nullFieldsInput: CreateAppointmentInput = {
      name: 'Minimal User',
      phone: '+1111111111',
      email: null,
      tests: ['Basic Test'],
      preferred_date: new Date('2024-12-28'),
      notes: null,
      address_house_no: null,
      address_house_name: null,
      address_street: 'Simple Street',
      address_locality: 'Simple Locality',
      address_city: 'Simple City',
      address_state: null,
      address_pincode: null,
      lat: null,
      lng: null,
      slot_hint: null
    };

    const result = await createAppointment(nullFieldsInput);

    expect(result.email).toBeNull();
    expect(result.notes).toBeNull();
    expect(result.address_house_no).toBeNull();
    expect(result.address_house_name).toBeNull();
    expect(result.address_state).toBeNull();
    expect(result.address_pincode).toBeNull();
    expect(result.lat).toBeNull();
    expect(result.lng).toBeNull();
    expect(result.slot_hint).toBeNull();
    expect(result.last_reminder_sent_at).toBeNull();
  });

  it('should handle JSONB tests array correctly', async () => {
    const multipleTestsInput: CreateAppointmentInput = {
      ...baseTestInput,
      tests: ['Test 1', 'Test 2', 'Test 3', 'CBC', 'Custom Lab Work']
    };

    const result = await createAppointment(multipleTestsInput);
    
    expect(result.tests).toEqual(['Test 1', 'Test 2', 'Test 3', 'CBC', 'Custom Lab Work']);
    expect(result.fasting_required).toEqual(true); // CBC requires fasting
    
    // Verify in database
    const dbRecord = await db.select()
      .from(appointmentsTable)
      .where(eq(appointmentsTable.id, result.id))
      .execute();
    
    expect(dbRecord[0].tests).toEqual(['Test 1', 'Test 2', 'Test 3', 'CBC', 'Custom Lab Work']);
  });
});