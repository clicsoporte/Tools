/**
 * @fileoverview Server Actions related to user management, like creation.
 * Separated from auth.ts to avoid circular dependencies and keep logic clean.
 */
"use server";

import { connectDb, getUserCount } from "./db";
import type { User } from "../types";
import bcrypt from 'bcryptjs';
import { logInfo, logError } from './logger';

const SALT_ROUNDS = 10;

/**
 * Creates the very first user in the system, assigning them the 'admin' role.
 * This function includes a check to ensure it only runs if no other users exist.
 * @param userData - The data for the new admin user.
 * @param clientInfo - Information about the client making the request, for logging.
 * @throws {Error} If a user already exists in the database.
 */
export async function createFirstUser(
  userData: Omit<User, 'id' | 'avatar' | 'recentActivity' | 'securityQuestion' | 'securityAnswer' | 'role'> & { password: string },
  clientInfo: { ip: string, host: string }
): Promise<void> {
  const db = await connectDb();
  
  const userCount = getUserCount();
  if (userCount > 0) {
    await logError("Attempted to create first user when users already exist.", clientInfo);
    throw new Error("La configuración inicial ya fue completada. No se puede crear otro usuario administrador de esta forma.");
  }
  
  const hashedPassword = bcrypt.hashSync(userData.password, SALT_ROUNDS);

  const userToCreate: User = {
    id: 1, // First user always gets ID 1
    name: userData.name,
    email: userData.email,
    password: hashedPassword,
    role: "admin", // Assign admin role
    avatar: "",
    recentActivity: "Primer usuario administrador creado.",
    phone: "",
    whatsapp: "",
  };
  
  const stmt = db.prepare(
    `INSERT INTO users (id, name, email, password, phone, whatsapp, avatar, role, recentActivity) 
     VALUES (@id, @name, @email, @password, @phone, @whatsapp, @avatar, @role, @recentActivity)`
  );
  
  try {
    stmt.run({
        ...userToCreate,
        phone: userToCreate.phone || null,
        whatsapp: userToCreate.whatsapp || null,
    });
    await logInfo(`Initial admin user '${userToCreate.name}' created successfully.`, clientInfo);
  } catch (error: any) {
    await logError("Database error during first user creation", { error: error.message, ...clientInfo });
    throw new Error("Hubo un error al guardar el usuario en la base de datos.");
  }
}
