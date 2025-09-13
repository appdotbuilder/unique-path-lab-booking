import { db } from '../db';
import { appointmentsTable } from '../db/schema';
import { type Appointment } from '../schema';
import { eq, and, or, isNull, lte, gte } from 'drizzle-orm';

interface ReminderStats {
  processed: number;
  sent: number;
}

export async function sendNextDayReminders(): Promise<ReminderStats> {
  try {
    // Calculate tomorrow's date (in Asia/Kolkata timezone context)
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const dayAfterTomorrow = new Date(tomorrow);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);

    // Query appointments for tomorrow that need reminders
    const appointments = await db.select()
      .from(appointmentsTable)
      .where(
        and(
          // Preferred date is tomorrow
          gte(appointmentsTable.preferred_date, tomorrow),
          lte(appointmentsTable.preferred_date, dayAfterTomorrow),
          // Status is either 'Received' or 'Confirmed'
          or(
            eq(appointmentsTable.status, 'Received'),
            eq(appointmentsTable.status, 'Confirmed')
          ),
          // Either no reminder sent yet or last reminder was sent before today
          or(
            isNull(appointmentsTable.last_reminder_sent_at),
            lte(appointmentsTable.last_reminder_sent_at, new Date(Date.now() - 24 * 60 * 60 * 1000))
          )
        )
      )
      .execute();

    let processed = 0;
    let sent = 0;

    for (const appointment of appointments) {
      processed++;
      
      // Convert appointment to proper schema format
      const appointmentData: Appointment = {
        ...appointment,
        tests: appointment.tests as string[],
        preferred_date: appointment.preferred_date,
        created_at: appointment.created_at,
        updated_at: appointment.updated_at,
        last_reminder_sent_at: appointment.last_reminder_sent_at
      };

      try {
        // Send reminder notifications
        const reminderSent = await sendReminderNotifications(appointmentData);
        
        if (reminderSent) {
          sent++;
          
          // Update last_reminder_sent_at timestamp
          await db.update(appointmentsTable)
            .set({
              last_reminder_sent_at: new Date(),
              updated_at: new Date()
            })
            .where(eq(appointmentsTable.id, appointment.id))
            .execute();
        }
      } catch (error) {
        console.error(`Failed to send reminder for appointment ${appointment.id}:`, error);
        // Continue processing other appointments even if one fails
      }
    }

    console.log(`Reminder batch completed: ${processed} processed, ${sent} sent`);
    
    return {
      processed,
      sent
    };
  } catch (error) {
    console.error('Failed to send next day reminders:', error);
    throw error;
  }
}

export async function sendAppointmentNotifications(appointment: Appointment): Promise<void> {
  try {
    // Send customer notifications
    const notifications: Promise<boolean>[] = [];
    
    // Send customer email notification if email is provided
    if (appointment.email) {
      notifications.push(sendCustomerEmailNotification(appointment));
    }
    
    // Send customer WhatsApp message if phone is provided
    if (appointment.phone) {
      notifications.push(sendCustomerWhatsAppNotification(appointment));
    }
    
    // Send admin notifications (always)
    notifications.push(sendAdminEmailNotification(appointment));
    notifications.push(sendAdminWhatsAppNotification(appointment));
    
    // Wait for all notifications to complete
    await Promise.all(notifications);
    
    console.log(`All notifications sent for appointment ${appointment.id}`);
  } catch (error) {
    console.error(`Failed to send appointment notifications for appointment ${appointment.id}:`, error);
    throw error;
  }
}

async function sendReminderNotifications(appointment: Appointment): Promise<boolean> {
  try {
    const notifications: Promise<boolean>[] = [];
    
    // Send reminder email if customer has email
    if (appointment.email) {
      notifications.push(sendCustomerReminderEmail(appointment));
    }
    
    // Send reminder WhatsApp if customer has phone
    if (appointment.phone) {
      notifications.push(sendCustomerReminderWhatsApp(appointment));
    }
    
    // If no contact method available, skip this appointment
    if (notifications.length === 0) {
      console.log(`No contact method available for appointment ${appointment.id}, skipping reminder`);
      return false;
    }
    
    // Wait for all reminder notifications to complete
    const results = await Promise.all(notifications);
    
    // Return true if at least one notification was sent successfully
    return results.some(result => result);
  } catch (error) {
    console.error(`Failed to send reminder notifications for appointment ${appointment.id}:`, error);
    return false;
  }
}

// Customer notification functions
async function sendCustomerEmailNotification(appointment: Appointment): Promise<boolean> {
  try {
    // TODO: Implement actual email sending logic using SMTP
    // This would use environment variables for SMTP configuration
    console.log(`Sending appointment confirmation email to ${appointment.email} for appointment ${appointment.id}`);
    
    const emailContent = generateCustomerEmailContent(appointment);
    // await sendEmail(appointment.email, 'Appointment Confirmation', emailContent);
    
    return true;
  } catch (error) {
    console.error(`Failed to send customer email notification:`, error);
    return false;
  }
}

async function sendCustomerWhatsAppNotification(appointment: Appointment): Promise<boolean> {
  try {
    // TODO: Implement actual WhatsApp sending logic using WhatsApp API
    console.log(`Sending appointment confirmation WhatsApp to ${appointment.phone} for appointment ${appointment.id}`);
    
    const whatsappContent = generateCustomerWhatsAppContent(appointment);
    // await sendWhatsApp(appointment.phone, whatsappContent);
    
    return true;
  } catch (error) {
    console.error(`Failed to send customer WhatsApp notification:`, error);
    return false;
  }
}

async function sendCustomerReminderEmail(appointment: Appointment): Promise<boolean> {
  try {
    console.log(`Sending reminder email to ${appointment.email} for appointment ${appointment.id}`);
    
    const emailContent = generateReminderEmailContent(appointment);
    // await sendEmail(appointment.email, 'Appointment Reminder - Tomorrow', emailContent);
    
    return true;
  } catch (error) {
    console.error(`Failed to send customer reminder email:`, error);
    return false;
  }
}

async function sendCustomerReminderWhatsApp(appointment: Appointment): Promise<boolean> {
  try {
    console.log(`Sending reminder WhatsApp to ${appointment.phone} for appointment ${appointment.id}`);
    
    const whatsappContent = generateReminderWhatsAppContent(appointment);
    // await sendWhatsApp(appointment.phone, whatsappContent);
    
    return true;
  } catch (error) {
    console.error(`Failed to send customer reminder WhatsApp:`, error);
    return false;
  }
}

// Admin notification functions
async function sendAdminEmailNotification(appointment: Appointment): Promise<boolean> {
  try {
    console.log(`Sending admin email notification for new appointment ${appointment.id}`);
    
    const emailContent = generateAdminEmailContent(appointment);
    // await sendEmail(process.env.ADMIN_EMAIL, 'New Appointment Received', emailContent);
    
    return true;
  } catch (error) {
    console.error(`Failed to send admin email notification:`, error);
    return false;
  }
}

async function sendAdminWhatsAppNotification(appointment: Appointment): Promise<boolean> {
  try {
    console.log(`Sending admin WhatsApp notification for new appointment ${appointment.id}`);
    
    const whatsappContent = generateAdminWhatsAppContent(appointment);
    // await sendWhatsApp(process.env.ADMIN_PHONE, whatsappContent);
    
    return true;
  } catch (error) {
    console.error(`Failed to send admin WhatsApp notification:`, error);
    return false;
  }
}

// Content generation functions
function generateCustomerEmailContent(appointment: Appointment): string {
  const preferredDateStr = appointment.preferred_date.toLocaleDateString('en-IN');
  const testsStr = appointment.tests.join(', ');
  
  return `
    Dear ${appointment.name},
    
    Thank you for booking your appointment with us!
    
    Appointment Details:
    - Tests: ${testsStr}
    - Preferred Date: ${preferredDateStr}
    - Fasting Required: ${appointment.fasting_required ? 'Yes' : 'No'}
    ${appointment.slot_hint ? `- Preferred Time: ${appointment.slot_hint}` : ''}
    ${appointment.notes ? `- Notes: ${appointment.notes}` : ''}
    
    We will contact you soon to confirm the exact time and provide further instructions.
    
    Best regards,
    Healthcare Team
  `;
}

function generateCustomerWhatsAppContent(appointment: Appointment): string {
  const preferredDateStr = appointment.preferred_date.toLocaleDateString('en-IN');
  const testsStr = appointment.tests.join(', ');
  
  return `Hello ${appointment.name}! Your appointment has been received for ${testsStr} on ${preferredDateStr}. ${appointment.fasting_required ? 'Fasting required.' : ''} We'll contact you soon to confirm timing.`;
}

function generateReminderEmailContent(appointment: Appointment): string {
  const preferredDateStr = appointment.preferred_date.toLocaleDateString('en-IN');
  const testsStr = appointment.tests.join(', ');
  
  return `
    Dear ${appointment.name},
    
    This is a friendly reminder about your appointment tomorrow!
    
    Appointment Details:
    - Tests: ${testsStr}
    - Date: ${preferredDateStr}
    - Fasting Required: ${appointment.fasting_required ? 'Yes - Please fast for 8-12 hours before your appointment' : 'No'}
    ${appointment.slot_hint ? `- Time: ${appointment.slot_hint}` : ''}
    
    Please ensure you are prepared for your appointment. If you need to reschedule, please contact us as soon as possible.
    
    Best regards,
    Healthcare Team
  `;
}

function generateReminderWhatsAppContent(appointment: Appointment): string {
  const testsStr = appointment.tests.join(', ');
  
  return `Reminder: Your appointment for ${testsStr} is tomorrow! ${appointment.fasting_required ? 'Please fast 8-12 hours before your appointment.' : ''} Contact us if you need to reschedule.`;
}

function generateAdminEmailContent(appointment: Appointment): string {
  const preferredDateStr = appointment.preferred_date.toLocaleDateString('en-IN');
  const testsStr = appointment.tests.join(', ');
  
  return `
    New Appointment Received - ID: ${appointment.id}
    
    Customer Details:
    - Name: ${appointment.name}
    - Phone: ${appointment.phone || 'Not provided'}
    - Email: ${appointment.email || 'Not provided'}
    
    Appointment Details:
    - Tests: ${testsStr}
    - Preferred Date: ${preferredDateStr}
    - Fasting Required: ${appointment.fasting_required ? 'Yes' : 'No'}
    - Slot Hint: ${appointment.slot_hint || 'Not specified'}
    - Notes: ${appointment.notes || 'None'}
    
    Address:
    ${appointment.address_house_no || ''} ${appointment.address_house_name || ''}
    ${appointment.address_street || ''}
    ${appointment.address_locality || ''}
    ${appointment.address_city || ''}, ${appointment.address_state || ''}
    ${appointment.address_pincode || ''}
    ${appointment.lat && appointment.lng ? `Location: ${appointment.lat}, ${appointment.lng}` : ''}
    
    Please process this appointment and contact the customer to confirm timing.
  `;
}

function generateAdminWhatsAppContent(appointment: Appointment): string {
  const preferredDateStr = appointment.preferred_date.toLocaleDateString('en-IN');
  const testsStr = appointment.tests.join(', ');
  
  return `New Appointment #${appointment.id}: ${appointment.name} (${appointment.phone || appointment.email}) - ${testsStr} on ${preferredDateStr}. Please review and confirm.`;
}