import { db } from '../db';
import { appointmentsTable } from '../db/schema';
import { type CreateAppointmentInput, type Appointment } from '../schema';

export const createAppointment = async (input: CreateAppointmentInput): Promise<Appointment> => {
  try {
    // Determine if fasting is required based on tests
    const fastingTests = ['CBC', 'KFT', 'Lipid Profile'];
    const fasting_required = input.tests.some(test => 
      fastingTests.includes(test)
    );

    // Insert appointment record
    const result = await db.insert(appointmentsTable)
      .values({
        name: input.name,
        phone: input.phone,
        email: input.email,
        tests: input.tests, // JSONB column - no conversion needed
        preferred_date: input.preferred_date,
        notes: input.notes,
        address_house_no: input.address_house_no,
        address_house_name: input.address_house_name,
        address_street: input.address_street,
        address_locality: input.address_locality,
        address_city: input.address_city,
        address_state: input.address_state,
        address_pincode: input.address_pincode,
        lat: input.lat, // Real column - no conversion needed
        lng: input.lng, // Real column - no conversion needed
        slot_hint: input.slot_hint,
        fasting_required,
        status: 'Received' // Default status for new appointments
      })
      .returning()
      .execute();

    const appointment = result[0];
    
    // Return the created appointment (no numeric conversions needed for this schema)
    return {
      ...appointment,
      tests: appointment.tests as string[] // Ensure proper typing for JSONB field
    };
  } catch (error) {
    console.error('Appointment creation failed:', error);
    throw error;
  }
};