import { type AdminAuthInput, type AdminAuthResponse } from '../schema';

export const authenticateAdmin = async (input: AdminAuthInput): Promise<AdminAuthResponse> => {
  try {
    // Get admin password from environment variables
    const adminPassword = process.env['ADMIN_PASS'];

    // Check if admin password is configured
    if (!adminPassword) {
      console.error('ADMIN_PASS environment variable not configured');
      return {
        success: false,
        message: 'Authentication system not configured'
      };
    }

    // Validate the provided password
    const isValid = input.password === adminPassword;

    return {
      success: isValid,
      message: isValid ? 'Authentication successful' : 'Invalid password'
    };
  } catch (error) {
    console.error('Admin authentication failed:', error);
    throw error;
  }
};