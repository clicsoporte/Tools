/**
 * @fileoverview Centralized logging functions that interact with the database logger.
 * These server-side functions abstract away the direct database calls, providing a clean API
 * for logging different types of events (Info, Warn, Error).
 */
"use server";

import { addLog as dbAddLog, getLogs as dbGetLogs, clearLogs as dbClearLogs } from './db';
import type { LogEntry, DateRange } from "@/modules/core/types";

/**
 * Logs an informational message.
 * @param message The main message to log.
 * @param details Optional structured data to include.
 */
export async function logInfo(message: string, details?: Record<string, any>) {
  await dbAddLog({ type: "INFO", message, details });
}

/**
 * Logs a warning message.
 * @param message The warning message to log.
 * @param details Optional structured data to include.
 */
export async function logWarn(message: string, details?: Record<string, any>) {
  await dbAddLog({ type: "WARN", message, details });
}

/**
 * Logs an error message.
 * @param message The error message to log.
 * @param details Optional structured data, often including the error object.
 */
export async function logError(message: string, details?: Record<string, any>) {
  await dbAddLog({ type: "ERROR", message, details });
}

/**
 * Retrieves logs from the database based on specified filters.
 * @param filters Optional filters for log type, search term, and date range.
 * @returns A promise that resolves to an array of log entries.
 */
export async function getLogs(filters: {
    type?: 'operational' | 'system' | 'all';
    search?: string;
    dateRange?: DateRange;
} = {}): Promise<LogEntry[]> {
  return await dbGetLogs(filters);
}

/**
 * Clears all logs from the database, but first records who did it.
 * @param {string} clearedBy - The name of the user clearing the logs.
 */
export async function clearLogs(clearedBy: string) {
  // Log the action before clearing the logs.
  await logWarn(`System logs cleared by user: ${clearedBy}.`);
  return await dbClearLogs();
}
