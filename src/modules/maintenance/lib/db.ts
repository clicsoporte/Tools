/**
 * @fileoverview Server-side functions for system maintenance tasks like backups and restores.
 */
"use server";

import fs from 'fs';
import path from 'path';
import { connectDb, addLog } from '../../core/lib/db';
import { DB_MODULES } from '../../core/lib/data-modules';
import type { UpdateBackupInfo } from '../../core/types';

const dbDirectory = path.join(process.cwd(), 'dbs');
const backupDir = path.join(dbDirectory, 'update_backups');

export async function backupAllForUpdate(): Promise<void> {
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    const timestamp = new Date().toISOString();
    for (const module of DB_MODULES) {
        const dbPath = path.join(dbDirectory, module.dbFile);
        if (fs.existsSync(dbPath)) {
            const backupPath = path.join(backupDir, `${timestamp}_${module.dbFile}`);
            fs.copyFileSync(dbPath, backupPath);
        }
    }
}

export async function listAllUpdateBackups(): Promise<UpdateBackupInfo[]> {
    if (!fs.existsSync(backupDir)) return [];
    const files = fs.readdirSync(backupDir);
    return files.map(file => {
        const [date, ...rest] = file.split('_');
        const dbFile = rest.join('_');
        const module = DB_MODULES.find(m => m.dbFile === dbFile);
        return {
            moduleId: module?.id || 'unknown',
            moduleName: module?.name || 'Base de Datos Desconocida',
            fileName: file,
            date: date
        };
    }).sort((a, b) => b.date.localeCompare(a.date));
}

export async function uploadBackupFile(formData: FormData): Promise<number> {
    const files = formData.getAll('backupFiles') as File[];
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
    const timestamp = new Date().toISOString();

    for (const file of files) {
        const buffer = Buffer.from(await file.arrayBuffer());
        const backupPath = path.join(backupDir, `${timestamp}_${file.name}`);
        fs.writeFileSync(backupPath, buffer);
    }
    return files.length;
}

export async function restoreAllFromUpdateBackup(timestamp: string): Promise<void> {
    const backups = await listAllUpdateBackups();
    const backupsToRestore = backups.filter(b => b.date === timestamp);

    if (backupsToRestore.length === 0) throw new Error("No se encontraron backups para la fecha seleccionada.");

    // This is a global map in db.ts, so we need to clear it from here
    // a more advanced solution would be a connection manager class
    const { dbConnections } = await import('../../core/lib/db');
    for (const [key, connection] of dbConnections.entries()) {
        if (connection.open) connection.close();
        dbConnections.delete(key);
    }
    
    for (const backup of backupsToRestore) {
        const module = DB_MODULES.find(m => m.id === backup.moduleId);
        if (module) {
            const backupPath = path.join(backupDir, backup.fileName);
            const dbPath = path.join(dbDirectory, module.dbFile);
            fs.copyFileSync(backupPath, dbPath);
        }
    }
}

export async function deleteOldUpdateBackups(): Promise<number> {
    const backups = await listAllUpdateBackups();
    const uniqueTimestamps = [...new Set(backups.map(b => b.date))].sort((a,b) => b.localeCompare(a));
    if (uniqueTimestamps.length <= 1) return 0;
    
    const timestampsToDelete = uniqueTimestamps.slice(1);
    let deletedCount = 0;
    for (const timestamp of timestampsToDelete) {
        const filesToDelete = fs.readdirSync(backupDir).filter(file => file.startsWith(timestamp));
        for (const file of filesToDelete) {
            fs.unlinkSync(path.join(backupDir, file));
            deletedCount++;
        }
    }
    return deletedCount;
}

export async function factoryReset(moduleId: string): Promise<void> {
    await addLog({ type: 'WARN', message: `FACTORY RESET triggered for module: ${moduleId}` });

    const modulesToReset = moduleId === '__all__' ? DB_MODULES : DB_MODULES.filter(m => m.id === moduleId);

    if (modulesToReset.length === 0) throw new Error("Módulo no encontrado para resetear.");
    
    const { dbConnections } = await import('../../core/lib/db');

    for (const module of modulesToReset) {
        const dbPath = path.join(dbDirectory, module.dbFile);
        if (dbConnections.has(module.dbFile)) {
            const connection = dbConnections.get(module.dbFile);
            if (connection?.open) {
                connection.close();
            }
            dbConnections.delete(module.dbFile);
        }
        if (fs.existsSync(dbPath)) {
            try {
                fs.unlinkSync(dbPath);
                 console.log(`Successfully deleted ${dbPath}`);
            } catch(e) {
                console.error(`Error deleting database file ${dbPath}`, e);
                throw e;
            }
        }
    }
}
