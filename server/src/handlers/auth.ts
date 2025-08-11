import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput, type LoginInput, type User } from '../schema';
import { eq } from 'drizzle-orm';
import * as crypto from 'crypto';

// Simple JWT implementation for demonstration
function generateToken(userId: number): string {
  const payload = {
    userId,
    exp: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
  };
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64');
  return `jwt.${encoded}.signature`;
}

function verifyToken(token: string): { userId: number; exp: number } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3 || parts[0] !== 'jwt') {
      return null;
    }
    
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    
    if (!payload.userId || !payload.exp) {
      return null;
    }
    
    if (Date.now() > payload.exp) {
      return null; // Token expired
    }
    
    return payload;
  } catch {
    return null;
  }
}

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

// Register a new user
export async function registerUser(input: CreateUserInput): Promise<User> {
  try {
    // Check if user already exists
    const existingUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, input.email))
      .execute();

    if (existingUser.length > 0) {
      throw new Error('User with this email already exists');
    }

    // Hash the password
    const passwordHash = hashPassword(input.password);

    // Insert the new user
    const result = await db.insert(usersTable)
      .values({
        email: input.email,
        password_hash: passwordHash,
        role: input.role,
        first_name: input.first_name,
        last_name: input.last_name,
        phone: input.phone || null,
        is_active: true
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('User registration failed:', error);
    throw error;
  }
}

// Login user
export async function loginUser(input: LoginInput): Promise<{ user: User; token: string }> {
  try {
    // Find user by email
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, input.email))
      .execute();

    if (users.length === 0) {
      throw new Error('Invalid email or password');
    }

    const user = users[0];

    // Check if user is active
    if (!user.is_active) {
      throw new Error('Account is inactive');
    }

    // Verify password
    if (!verifyPassword(input.password, user.password_hash)) {
      throw new Error('Invalid email or password');
    }

    // Generate JWT token
    const token = generateToken(user.id);

    return {
      user,
      token
    };
  } catch (error) {
    console.error('User login failed:', error);
    throw error;
  }
}

// Get current user by token
export async function getCurrentUser(token: string): Promise<User | null> {
  try {
    // Verify and decode token
    const payload = verifyToken(token);
    if (!payload) {
      return null;
    }

    // Find user by ID
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, payload.userId))
      .execute();

    if (users.length === 0) {
      return null;
    }

    const user = users[0];

    // Check if user is still active
    if (!user.is_active) {
      return null;
    }

    return user;
  } catch (error) {
    console.error('Get current user failed:', error);
    return null;
  }
}