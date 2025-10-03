/**
 * @fileoverview This file contains client-side functions for interacting with server-side authentication logic.
 * This abstraction layer prevents direct DB access from the client and ensures that server-side
 * functions are called correctly. It's safe to use these functions in "use client" components.
 */
'use client';

import type { User } from '@/modules/core/types';
import { getAllUsers as getAllUsersServer, login as loginServer, saveAllUsers as saveAllUsersServer, comparePasswords as comparePasswordsServer, addUser as addUserServer, logout as logoutServer } from './auth';

const CURRENT_USER_ID_KEY = 'currentUserId';

/**
 * Logs in a user and stores their ID in session storage.
 * @param {string} email - The user's email.
 * @param {string} password - The password provided by the user.
 * @returns {Promise<boolean>} A promise that resolves to true if login is successful, false otherwise.
 */
export async function login(email: string, password: string): Promise<boolean> {
    const user = await loginServer(email, password);
    if (user) {
        sessionStorage.setItem(CURRENT_USER_ID_KEY, String(user.id));
        return true;
    }
    return false;
}

/**
 * Logs out the current user by removing their ID from session storage.
 * Dispatches a "storage" event to notify other components of the logout.
 */
export async function logout() {
    const userId = sessionStorage.getItem(CURRENT_USER_ID_KEY);
    if (userId) {
        await logoutServer(Number(userId));
    }
    sessionStorage.removeItem(CURRENT_USER_ID_KEY);
    window.dispatchEvent(new Event("storage"));
}

/**
 * Retrieves the currently logged-in user from the server.
 * Reads the user ID from session storage and fetches the full user object.
 * @returns {Promise<User | null>} A promise that resolves to the user object, or null if no user is logged in.
 */
export async function getCurrentUser(): Promise<User | null> {
    const currentUserId = sessionStorage.getItem(CURRENT_USER_ID_KEY);
    if (!currentUserId) return null;

    const allUsers = await getAllUsersServer();
    const user = allUsers.find(u => u.id === Number(currentUserId));
    return user || null;
}

/**
 * Retrieves all users from the server.
 * This is a client-side wrapper for the server-side function.
 * @returns {Promise<User[]>} A promise that resolves to an array of all users.
 */
export async function getAllUsers(): Promise<User[]> {
    return getAllUsersServer();
}

/**
 * Adds a new user via a server action.
 * @param userData - The new user's data.
 * @returns The created user object.
 */
export async function addUser(userData: Omit<User, 'id' | 'avatar' | 'recentActivity' | 'securityQuestion' | 'securityAnswer'> & { password: string }): Promise<User> {
    return addUserServer(userData);
}

/**
 * Saves the entire list of users to the database via the server.
 * This is a client-side wrapper for the server-side function.
 * @param {User[]} users - The full array of users to save.
 * @returns {Promise<void>} A promise that resolves when the users are saved.
 */
export async function saveAllUsers(users: User[]): Promise<void> {
    return saveAllUsersServer(users);
}

/**
 * Compares a plaintext password with a stored bcrypt hash for a given user.
 * This is a client-side wrapper for the server-side password comparison.
 * @param {number} userId - The ID of the user whose password hash should be retrieved.
 * @param {string} password - The plaintext password to check.
 * @param {object} [clientInfo] - Optional client IP and host for logging.
 * @returns {Promise<boolean>} True if the password matches the hash.
 */
export async function comparePasswords(userId: number, password: string, clientInfo?: { ip: string, host: string }): Promise<boolean> {
    return await comparePasswordsServer(userId, password, clientInfo);
}
