
"use server";

import { addLog as dbAddLog, getLogs as dbGetLogs, clearLogs as dbClearLogs } from './db';
import type { LogEntry, DateRange } from "@/modules/core/types";

export async function logInfo(message: string, details?: Record<string, any>) {
  await dbAddLog({ type: "INFO", message, details });
}

export async function logWarn(message: string, details?: Record<string, any>) {
  await dbAddLog({ type: "WARN", message, details });
}

export async function logError(message: string, details?: Record<string, any>) {
  await dbAddLog({ type: "ERROR", message, details });
}

export async function getLogs(filters: {
    type?: 'operational' | 'system' | 'all';
    search?: string;
    dateRange?: DateRange;
} = {}): Promise<LogEntry[]> {
  return await dbGetLogs(filters);
}

export async function clearLogs() {
  return await dbClearLogs();
}
