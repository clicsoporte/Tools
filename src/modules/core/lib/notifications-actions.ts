/**
 * @fileoverview Server Actions for the notification system.
 */
"use server";

import { revalidatePath } from 'next/cache';
import { getNotifications as dbGetNotifications, markNotificationsAsRead as dbMarkAsRead, createNotification as dbCreateNotification } from './db';
import type { Notification } from '../types';

/**
 * Creates a new notification for a user.
 * @param userId - The ID of the user who will receive the notification.
 * @param message - The notification message.
 * @param href - An optional URL for the notification to link to.
 */
export async function createNotification(userId: number, message: string, href: string): Promise<void> {
    await dbCreateNotification({ userId, message, href });
}

/**
 * Fetches all unread notifications for a specific user.
 * @param userId - The ID of the user.
 * @returns A promise that resolves to an array of notifications.
 */
export async function getNotificationsForUser(userId: number): Promise<Notification[]> {
    return dbGetNotifications(userId);
}

/**
 * Marks a specific notification as read.
 * @param notificationId - The ID of the notification to mark as read.
 * @param userId - The ID of the user who owns the notification, for security.
 */
export async function markNotificationAsRead(notificationId: number, userId: number): Promise<void> {
    await dbMarkAsRead([notificationId], userId);
    // Revalidate the path to update the UI, though polling will also catch it.
    revalidatePath('/dashboard');
}

/**
 * Marks all of a user's notifications as read.
 * @param userId - The ID of the user whose notifications should be marked as read.
 */
export async function markAllNotificationsAsRead(userId: number): Promise<void> {
    const notifications = await dbGetNotifications(userId);
    const unreadIds = notifications.filter(n => !n.isRead && typeof n.id === 'number').map(n => n.id as number);
    if (unreadIds.length > 0) {
        await dbMarkAsRead(unreadIds, userId);
        revalidatePath('/dashboard');
    }
}
