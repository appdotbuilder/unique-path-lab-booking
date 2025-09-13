import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { authenticateAdmin } from '../handlers/authenticate_admin';
import { type AdminAuthInput } from '../schema';

// Mock environment variable for testing
const originalAdminPass = process.env['ADMIN_PASS'];

describe('authenticateAdmin', () => {
  afterEach(() => {
    // Restore original environment variable after each test
    if (originalAdminPass !== undefined) {
      process.env['ADMIN_PASS'] = originalAdminPass;
    } else {
      delete process.env['ADMIN_PASS'];
    }
  });

  it('should authenticate successfully with correct password', async () => {
    // Set test admin password
    process.env['ADMIN_PASS'] = 'test_admin_password';

    const input: AdminAuthInput = {
      password: 'test_admin_password'
    };

    const result = await authenticateAdmin(input);

    expect(result.success).toBe(true);
    expect(result.message).toBe('Authentication successful');
  });

  it('should reject authentication with incorrect password', async () => {
    // Set test admin password
    process.env['ADMIN_PASS'] = 'correct_password';

    const input: AdminAuthInput = {
      password: 'wrong_password'
    };

    const result = await authenticateAdmin(input);

    expect(result.success).toBe(false);
    expect(result.message).toBe('Invalid password');
  });

  it('should reject authentication with empty password', async () => {
    // Set test admin password
    process.env['ADMIN_PASS'] = 'test_password';

    const input: AdminAuthInput = {
      password: ''
    };

    const result = await authenticateAdmin(input);

    expect(result.success).toBe(false);
    expect(result.message).toBe('Invalid password');
  });

  it('should handle missing ADMIN_PASS environment variable', async () => {
    // Remove admin password from environment
    delete process.env['ADMIN_PASS'];

    const input: AdminAuthInput = {
      password: 'any_password'
    };

    const result = await authenticateAdmin(input);

    expect(result.success).toBe(false);
    expect(result.message).toBe('Authentication system not configured');
  });

  it('should handle case-sensitive password comparison', async () => {
    // Set test admin password
    process.env['ADMIN_PASS'] = 'CaseSensitivePassword';

    const input: AdminAuthInput = {
      password: 'casesensitivepassword' // Different case
    };

    const result = await authenticateAdmin(input);

    expect(result.success).toBe(false);
    expect(result.message).toBe('Invalid password');
  });

  it('should authenticate with special characters in password', async () => {
    // Set complex admin password
    process.env['ADMIN_PASS'] = 'P@$$w0rd!@#$%^&*()';

    const input: AdminAuthInput = {
      password: 'P@$$w0rd!@#$%^&*()'
    };

    const result = await authenticateAdmin(input);

    expect(result.success).toBe(true);
    expect(result.message).toBe('Authentication successful');
  });

  it('should handle whitespace in passwords correctly', async () => {
    // Set admin password with spaces
    process.env['ADMIN_PASS'] = ' password with spaces ';

    const inputCorrect: AdminAuthInput = {
      password: ' password with spaces '
    };

    const inputIncorrect: AdminAuthInput = {
      password: 'password with spaces' // Missing spaces
    };

    const resultCorrect = await authenticateAdmin(inputCorrect);
    const resultIncorrect = await authenticateAdmin(inputIncorrect);

    expect(resultCorrect.success).toBe(true);
    expect(resultCorrect.message).toBe('Authentication successful');
    
    expect(resultIncorrect.success).toBe(false);
    expect(resultIncorrect.message).toBe('Invalid password');
  });
});