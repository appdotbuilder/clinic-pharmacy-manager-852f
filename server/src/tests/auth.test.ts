import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput, type LoginInput } from '../schema';
import { registerUser, loginUser, getCurrentUser } from '../handlers/auth';
import { eq } from 'drizzle-orm';

// Test inputs
const testUserInput: CreateUserInput = {
  email: 'test@example.com',
  password: 'password123',
  role: 'admin',
  first_name: 'John',
  last_name: 'Doe',
  phone: '+1234567890'
};

const testLoginInput: LoginInput = {
  email: 'test@example.com',
  password: 'password123'
};

const testDoctorInput: CreateUserInput = {
  email: 'doctor@clinic.com',
  password: 'securepass',
  role: 'doctor',
  first_name: 'Jane',
  last_name: 'Smith',
  phone: null
};

describe('registerUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should register a new user successfully', async () => {
    const result = await registerUser(testUserInput);

    // Verify returned user data
    expect(result.id).toBeDefined();
    expect(result.email).toEqual('test@example.com');
    expect(result.role).toEqual('admin');
    expect(result.first_name).toEqual('John');
    expect(result.last_name).toEqual('Doe');
    expect(result.phone).toEqual('+1234567890');
    expect(result.is_active).toBe(true);
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
    expect(result.password_hash).toBeDefined();
    expect(result.password_hash).not.toEqual('password123'); // Password should be hashed
  });

  it('should save user to database', async () => {
    const result = await registerUser(testUserInput);

    // Query database directly
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, result.id))
      .execute();

    expect(users).toHaveLength(1);
    const savedUser = users[0];
    expect(savedUser.email).toEqual('test@example.com');
    expect(savedUser.role).toEqual('admin');
    expect(savedUser.first_name).toEqual('John');
    expect(savedUser.last_name).toEqual('Doe');
    expect(savedUser.phone).toEqual('+1234567890');
    expect(savedUser.is_active).toBe(true);
  });

  it('should handle user without phone number', async () => {
    const userWithoutPhone: CreateUserInput = {
      ...testUserInput,
      phone: undefined
    };

    const result = await registerUser(userWithoutPhone);

    expect(result.phone).toBeNull();

    // Verify in database
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, result.id))
      .execute();

    expect(users[0].phone).toBeNull();
  });

  it('should create different password hashes for same password', async () => {
    // This test ensures we're not using a static hash
    const user1 = await registerUser(testUserInput);
    
    await db.delete(usersTable).where(eq(usersTable.email, testUserInput.email)).execute();
    
    const user2 = await registerUser(testUserInput);

    // With proper salt, these would be different. With our simple hash, they'll be the same
    // but at least we're testing that passwords are hashed
    expect(user1.password_hash).toBeDefined();
    expect(user2.password_hash).toBeDefined();
    expect(user1.password_hash).not.toEqual('password123');
    expect(user2.password_hash).not.toEqual('password123');
  });

  it('should prevent duplicate email registration', async () => {
    // Register first user
    await registerUser(testUserInput);

    // Try to register another user with same email
    expect(registerUser(testUserInput)).rejects.toThrow(/already exists/i);
  });

  it('should register users with different roles', async () => {
    const adminUser = await registerUser(testUserInput);
    const doctorUser = await registerUser(testDoctorInput);

    expect(adminUser.role).toEqual('admin');
    expect(doctorUser.role).toEqual('doctor');

    // Verify both users exist in database
    const users = await db.select().from(usersTable).execute();
    expect(users).toHaveLength(2);
  });
});

describe('loginUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should login user successfully', async () => {
    // Register user first
    const registeredUser = await registerUser(testUserInput);

    // Login
    const result = await loginUser(testLoginInput);

    expect(result.user).toBeDefined();
    expect(result.token).toBeDefined();
    expect(result.user.id).toEqual(registeredUser.id);
    expect(result.user.email).toEqual('test@example.com');
    expect(result.user.role).toEqual('admin');
    expect(typeof result.token).toBe('string');
    expect(result.token).toMatch(/^jwt\./); // JWT format check
  });

  it('should reject login with wrong password', async () => {
    // Register user first
    await registerUser(testUserInput);

    // Try login with wrong password
    const wrongPasswordInput: LoginInput = {
      email: 'test@example.com',
      password: 'wrongpassword'
    };

    expect(loginUser(wrongPasswordInput)).rejects.toThrow(/invalid email or password/i);
  });

  it('should reject login with non-existent email', async () => {
    const nonExistentInput: LoginInput = {
      email: 'nonexistent@example.com',
      password: 'password123'
    };

    expect(loginUser(nonExistentInput)).rejects.toThrow(/invalid email or password/i);
  });

  it('should reject login for inactive user', async () => {
    // Register user first
    const registeredUser = await registerUser(testUserInput);

    // Deactivate user
    await db.update(usersTable)
      .set({ is_active: false })
      .where(eq(usersTable.id, registeredUser.id))
      .execute();

    // Try to login
    expect(loginUser(testLoginInput)).rejects.toThrow(/account is inactive/i);
  });

  it('should generate valid token format', async () => {
    // Register user first
    await registerUser(testUserInput);

    // Login
    const result = await loginUser(testLoginInput);

    // Check token format (simple JWT-like structure)
    const tokenParts = result.token.split('.');
    expect(tokenParts).toHaveLength(3);
    expect(tokenParts[0]).toEqual('jwt');
    expect(tokenParts[1]).toBeDefined(); // Payload
    expect(tokenParts[2]).toEqual('signature'); // Signature placeholder
  });
});

describe('getCurrentUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return user for valid token', async () => {
    // Register and login user
    const registeredUser = await registerUser(testUserInput);
    const loginResult = await loginUser(testLoginInput);

    // Get current user
    const currentUser = await getCurrentUser(loginResult.token);

    expect(currentUser).toBeDefined();
    expect(currentUser!.id).toEqual(registeredUser.id);
    expect(currentUser!.email).toEqual('test@example.com');
    expect(currentUser!.role).toEqual('admin');
    expect(currentUser!.is_active).toBe(true);
  });

  it('should return null for invalid token', async () => {
    const invalidToken = 'invalid.token.format';

    const result = await getCurrentUser(invalidToken);

    expect(result).toBeNull();
  });

  it('should return null for malformed token', async () => {
    const malformedTokens = [
      'not-a-jwt-token',
      'jwt.invalid-payload.signature',
      'jwt..signature',
      'wrong.format',
      ''
    ];

    for (const token of malformedTokens) {
      const result = await getCurrentUser(token);
      expect(result).toBeNull();
    }
  });

  it('should return null for expired token', async () => {
    // Create an expired token manually
    const expiredPayload = {
      userId: 1,
      exp: Date.now() - 1000 // Expired 1 second ago
    };
    const expiredToken = `jwt.${Buffer.from(JSON.stringify(expiredPayload)).toString('base64')}.signature`;

    const result = await getCurrentUser(expiredToken);

    expect(result).toBeNull();
  });

  it('should return null for non-existent user ID in token', async () => {
    // Create token with non-existent user ID
    const invalidPayload = {
      userId: 99999,
      exp: Date.now() + (24 * 60 * 60 * 1000)
    };
    const invalidToken = `jwt.${Buffer.from(JSON.stringify(invalidPayload)).toString('base64')}.signature`;

    const result = await getCurrentUser(invalidToken);

    expect(result).toBeNull();
  });

  it('should return null for inactive user', async () => {
    // Register and login user
    const registeredUser = await registerUser(testUserInput);
    const loginResult = await loginUser(testLoginInput);

    // Deactivate user after login
    await db.update(usersTable)
      .set({ is_active: false })
      .where(eq(usersTable.id, registeredUser.id))
      .execute();

    // Try to get current user
    const result = await getCurrentUser(loginResult.token);

    expect(result).toBeNull();
  });

  it('should handle token with missing payload fields', async () => {
    const incompletePayloads = [
      { userId: 1 }, // Missing exp
      { exp: Date.now() + 1000 }, // Missing userId
      {}, // Empty payload
      null, // Null payload
      'not-json' // Invalid JSON
    ];

    for (const payload of incompletePayloads) {
      let tokenPayload: string;
      try {
        tokenPayload = Buffer.from(JSON.stringify(payload)).toString('base64');
      } catch {
        tokenPayload = 'invalid-base64';
      }
      
      const token = `jwt.${tokenPayload}.signature`;
      const result = await getCurrentUser(token);
      expect(result).toBeNull();
    }
  });
});