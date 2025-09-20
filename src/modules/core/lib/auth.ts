/**
 * @fileoverview Server-side authentication and user management functions.
 * These functions interact directly with the database to handle user data.
 * This file implements secure password handling using bcryptjs.
 * All functions in this file are server-only.
 */
"use server";

import { connectDb } from './db';
import type { User } from '../types';
import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

/**
 * Attempts to log in a user with the given credentials.
 * It securely compares the provided password with the stored hash.
 * @param {string} email - The user's email.
 * @param {string} passwordProvided - The password provided by the user.
 * @returns {Promise<User | null>} The user object if login is successful, null otherwise.
 */
export async function login(email: string, passwordProvided: string): Promise<User | null> {
  const db = await connectDb();
  try {
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    const user: User | undefined = stmt.get(email) as User | undefined;

    if (user && user.password) {
      const isMatch = await bcrypt.compare(passwordProvided, user.password);
      if (isMatch) {
        // Do not send the password hash back to the client.
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword as User;
      }
    }
    return null;
  } catch (error) {
    console.error("Login error:", error);
    return null;
  }
}

/**
 * Retrieves all users from the database.
 * Passwords are removed before sending the data to the client.
 * @returns {Promise<User[]>} A promise that resolves to an array of all users.
 */
export async function getAllUsers(): Promise<User[]> {
    const db = await connectDb();
    try {
        const stmt = db.prepare('SELECT * FROM users ORDER BY name');
        const users = stmt.all() as User[];
        // Ensure passwords are never sent to the client.
        return users.map(u => {
            const { password, ...userWithoutPassword } = u;
            return userWithoutPassword;
        }) as User[];
    } catch (error) {
        console.error("Failed to get all users:", error);
        return [];
    }
}

export async function addUser(userData: Omit<User, 'id' | 'avatar' | 'recentActivity' | 'securityQuestion' | 'securityAnswer' | 'phone' | 'whatsapp'>): Promise<User> {
  const db = await connectDb();
  
  const hashedPassword = bcrypt.hashSync(userData.password!, SALT_ROUNDS);

  const highestIdResult = db.prepare('SELECT MAX(id) as maxId FROM users').get() as { maxId: number | null };
  const nextId = (highestIdResult.maxId || 0) + 1;

  const userToCreate: User = {
    id: nextId,
    name: userData.name,
    email: userData.email,
    password: hashedPassword,
    role: userData.role,
    avatar: "",
    recentActivity: "Usuario recién creado.",
    phone: "",
    whatsapp: "",
  };
  
  const stmt = db.prepare(
    `INSERT INTO users (id, name, email, password, phone, whatsapp, avatar, role, recentActivity, securityQuestion, securityAnswer) 
     VALUES (@id, @name, @email, @password, @phone, @whatsapp, @avatar, @role, @recentActivity, @securityQuestion, @securityAnswer)`
  );
  
  stmt.run({
    ...userToCreate,
    phone: userToCreate.phone || null,
    whatsapp: userToCreate.whatsapp || null,
    securityQuestion: userToCreate.securityQuestion || null,
    securityAnswer: userToCreate.securityAnswer || null,
  });

  const { password, ...userWithoutPassword } = userToCreate;
  return userWithoutPassword as User;
}

/**
 * Saves the entire list of users to the database.
 * This is an "all-or-nothing" operation that replaces all existing users.
 * It handles password hashing for new or changed passwords.
 * @param {User[]} users - The full array of users to save.
 * @returns {Promise<void>}
 */
export async function saveAllUsers(users: User[]): Promise<void> {
   const db = await connectDb();
   const insert = db.prepare('INSERT INTO users (id, name, email, password, phone, whatsapp, avatar, role, recentActivity, securityQuestion, securityAnswer) VALUES (@id, @name, @email, @password, @phone, @whatsapp, @avatar, @role, @recentActivity, @securityQuestion, @securityAnswer)');

    const transaction = db.transaction((usersToSave: User[]) => {
        const existingUsers: User[] = db.prepare('SELECT id, password FROM users').all() as User[];
        const existingUsersMap = new Map(existingUsers.map(u => [u.id, u.password]));

        db.prepare('DELETE FROM users').run(); 
        
        for (const user of usersToSave) {
          // Hash password only if it's new or has changed.
          // A password is considered "changed" if it doesn't look like a bcrypt hash.
          let passwordToSave = user.password;
          const existingPassword = existingUsersMap.get(user.id);
          
          if (passwordToSave && passwordToSave !== existingPassword) {
              if (!passwordToSave.startsWith('$2a$')) { // Basic check if it's not already a hash
                  passwordToSave = bcrypt.hashSync(passwordToSave, SALT_ROUNDS);
              }
          } else {
             passwordToSave = existingPassword;
          }

          const userToInsert = {
            ...user,
            password: passwordToSave,
            phone: user.phone || null,
            whatsapp: user.whatsapp || null,
            securityQuestion: user.securityQuestion || null,
            securityAnswer: user.securityAnswer || null,
          };
          insert.run(userToInsert);
        }
    });

    try {
        transaction(users);
    } catch (error) {
        console.error("Failed to save all users:", error);
        throw new Error("Database transaction failed to save users.");
    }
}

/**
 * Securely compares a plaintext password with a stored bcrypt hash.
 * @param {string} password - The plaintext password.
 * @param {string} hash - The stored bcrypt hash.
 * @returns {Promise<boolean>} True if the password matches the hash.
 */
export async function comparePasswords(password: string, hash: string): Promise<boolean> {
    return await bcrypt.compare(password, hash);
}
