/**
 * @fileoverview Server-side authentication and user management functions.
 * These functions interact directly with the database to handle user data.
 * This file implements secure password handling using bcryptjs.
 * All functions in this file are server-only.
 */
"use server";

import { connectDb, getAllRoles, getCompanySettings, getAllCustomers, getAllProducts, getAllStock, getAllExemptions, getExemptionLaws, getDbModules } from './db';
import type { User, ExchangeRateApiResponse } from '../types';
import bcrypt from 'bcryptjs';
import { logInfo, logWarn, logError } from './logger';
import { headers } from 'next/headers';
import { getExchangeRate } from './api-actions';
import { getUnreadSuggestionsCount } from './suggestions-actions';


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
  const requestHeaders = headers();
  const clientIp = requestHeaders.get('x-forwarded-for') ?? 'Unknown IP';
  const clientHost = requestHeaders.get('host') ?? 'Unknown Host';
  const logMeta = { email, ip: clientIp, host: clientHost };
  try {
    const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
    const user: User | undefined = stmt.get(email) as User | undefined;

    if (user && user.password) {
      const isMatch = await bcrypt.compare(passwordProvided, user.password);
      if (isMatch) {
        // Do not send the password hash back to the client.
        const { password, ...userWithoutPassword } = user;
        await logInfo(`User '${user.name}' logged in successfully.`, logMeta);
        return userWithoutPassword as User;
      }
    }
    await logWarn(`Failed login attempt for email: ${email}`, logMeta);
    return null;
  } catch (error: any) {
    console.error("Login error:", error);
    await logWarn(`Login process failed for email: ${email} with error: ${error.message}`, logMeta);
    return null;
  }
}


export async function logout(userId: number): Promise<void> {
    const db = await connectDb();
    const user = db.prepare('SELECT name FROM users WHERE id = ?').get(userId) as { name: string } | undefined;
    if (user) {
        await logInfo(`User '${user.name}' logged out.`, { userId });
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

/**
 * Adds a new user to the database.
 * @param userData - The data for the new user, including a plaintext password.
 * @returns The newly created user object, without the password hash.
 */
export async function addUser(userData: Omit<User, 'id' | 'avatar' | 'recentActivity' | 'securityQuestion' | 'securityAnswer'> & { password: string }): Promise<User> {
  const db = await connectDb();
  
  const hashedPassword = bcrypt.hashSync(userData.password, SALT_ROUNDS);

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
    phone: userData.phone || "",
    whatsapp: userData.whatsapp || "",
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
  await logInfo(`Admin added a new user: ${userToCreate.name}`, { role: userToCreate.role });
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
   const upsert = db.prepare(`
    INSERT INTO users (id, name, email, password, phone, whatsapp, avatar, role, recentActivity, securityQuestion, securityAnswer) 
    VALUES (@id, @name, @email, @password, @phone, @whatsapp, @avatar, @role, @recentActivity, @securityQuestion, @securityAnswer)
    ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        email = excluded.email,
        password = excluded.password,
        phone = excluded.phone,
        whatsapp = excluded.whatsapp,
        avatar = excluded.avatar,
        role = excluded.role,
        recentActivity = excluded.recentActivity,
        securityQuestion = excluded.securityQuestion,
        securityAnswer = excluded.securityAnswer
   `);

    const transaction = db.transaction((usersToSave: User[]) => {
        const existingUsersMap = new Map<number, string | undefined>(
            (db.prepare('SELECT id, password FROM users').all() as User[]).map(u => [u.id, u.password])
        );

        for (const user of usersToSave) {
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
          upsert.run(userToInsert);
        }
    });

    try {
        transaction(users);
        await logInfo(`${users.length} user records were updated.`);
    } catch (error) {
        console.error("Failed to save all users:", error);
        await logError("Failed to save all users.", { error: (error as Error).message });
        throw new Error("Database transaction failed to save users.");
    }
}

/**
 * Securely compares a plaintext password with a user's stored bcrypt hash.
 * @param {number} userId - The ID of the user whose password should be checked.
 * @param {string} password - The plaintext password to check.
 * @param {object} [clientInfo] - Optional client IP and host for logging.
 * @returns {Promise<boolean>} True if the password matches the hash.
 */
export async function comparePasswords(userId: number, password: string, clientInfo?: { ip: string, host: string }): Promise<boolean> {
    const db = await connectDb();
    const user = db.prepare('SELECT password FROM users WHERE id = ?').get(userId) as User | undefined;

    if (!user || !user.password) {
        return false;
    }
    
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      await logWarn('Password comparison failed during settings update/recovery.', clientInfo);
    }
    return isMatch;
}

/**
 * Fetches all the initial data required for the application's authentication context.
 * This is a server action that aggregates data from various database functions.
 */
export async function getInitialAuthData() {
    // Ensure all databases are initialized on first authenticated load
    const dbModules = await getDbModules();
    for (const module of dbModules) {
        await connectDb(module.dbFile);
    }
    
    const [
        roles,
        companySettings,
        customers,
        products,
        stock,
        exemptions,
        exemptionLaws,
        exchangeRate,
        unreadSuggestions
    ] = await Promise.all([
        getAllRoles(),
        getCompanySettings(),
        getAllCustomers(),
        getAllProducts(),
        getAllStock(),
        getAllExemptions(),
        getExemptionLaws(),
        getExchangeRate(),
        getUnreadSuggestionsCount()
    ]);
    
    let rateData = { rate: null, date: null };
    const exchangeRateResponse = exchangeRate as ExchangeRateApiResponse;
    if (exchangeRateResponse?.venta?.valor) {
        rateData.rate = exchangeRateResponse.venta.valor;
        rateData.date = new Date(exchangeRateResponse.venta.fecha).toLocaleDateString('es-CR', { day: '2-digit', month: '2-digit', year: '2-digit' });
    }

    return {
        roles,
        companySettings,
        customers,
        products,
        stock,
        exemptions,
        exemptionLaws,
        exchangeRate: rateData,
        unreadSuggestions
    };
}
