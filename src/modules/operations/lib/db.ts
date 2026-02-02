/**
 * @fileoverview Server-side functions for the new Operations module database.
 * This file handles all direct interactions with the `operations.db` SQLite database,
 * including schema initialization and migrations.
 */
"use server";

import { connectDb } from '@/modules/core/lib/db';
import type { OperationsDocumentType } from '@/modules/core/types';

const OPERATIONS_DB_FILE = 'operations.db';

export async function initializeOperationsDb(db: import('better-sqlite3').Database) {
    const schema = `
        CREATE TABLE IF NOT EXISTS operations_document_types (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            prefix TEXT NOT NULL UNIQUE,
            nextNumber INTEGER NOT NULL DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS operations_documents (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            consecutive TEXT UNIQUE NOT NULL,
            documentTypeId TEXT NOT NULL,
            status TEXT NOT NULL, -- e.g., pending, in_review, approved, processed
            requestDate TEXT NOT NULL,
            notes TEXT,
            -- Foreign Keys to other systems
            relatedProductionOrderId INTEGER,
            relatedPurchaseRequestId INTEGER,
            relatedCustomerId TEXT,
            -- Signatures / Confirmations
            requesterId INTEGER,
            requesterName TEXT,
            requesterSignedAt TEXT,
            processorId INTEGER,
            processorName TEXT,
            processorSignedAt TEXT,
            FOREIGN KEY (documentTypeId) REFERENCES operations_document_types(id)
        );

        CREATE TABLE IF NOT EXISTS operations_document_lines (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            documentId INTEGER NOT NULL,
            itemId TEXT NOT NULL,
            itemDescription TEXT,
            quantity REAL NOT NULL,
            lotId TEXT,
            sourceLocationId INTEGER,
            destinationLocationId INTEGER,
            FOREIGN KEY (documentId) REFERENCES operations_documents(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS operations_document_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            documentId INTEGER NOT NULL,
            timestamp TEXT NOT NULL,
            status TEXT NOT NULL,
            notes TEXT,
            updatedBy TEXT NOT NULL,
            FOREIGN KEY (documentId) REFERENCES operations_documents(id) ON DELETE CASCADE
        );
    `;
    db.exec(schema);

    // Populate with initial document types
    const insertType = db.prepare('INSERT OR IGNORE INTO operations_document_types (id, name, description, prefix, nextNumber) VALUES (@id, @name, @description, @prefix, @nextNumber)');
    const transaction = db.transaction((types: OperationsDocumentType[]) => {
        for (const type of types) insertType.run(type);
    });

    const defaultTypes: OperationsDocumentType[] = [
        { id: 'prod-to-wh', name: 'Entrega de Producción a Bodega', description: 'Registra el traslado de producto terminado desde producción al almacén.', prefix: 'ENT-BOD-', nextNumber: 1 },
        { id: 'wh-to-prod', name: 'Salida de Material a Producción', description: 'Registra la salida de materia prima o componentes hacia una orden de producción.', prefix: 'SAL-PROD-', nextNumber: 1 },
        { id: 'wh-transfer', name: 'Movimiento entre Bodegas', description: 'Registra un traslado de inventario entre dos bodegas o ubicaciones internas.', prefix: 'MOV-INT-', nextNumber: 1 },
        { id: 'customer-sample', name: 'Envío de Muestra a Cliente', description: 'Registra la salida de una muestra para un cliente.', prefix: 'MUE-CLI-', nextNumber: 1 },
        { id: 'customer-return', name: 'Devolución de Cliente', description: 'Registra el reingreso de mercancía devuelta por un cliente.', prefix: 'DEV-CLI-', nextNumber: 1 },
    ];

    transaction(defaultTypes);
    
    console.log(`Database ${OPERATIONS_DB_FILE} initialized for Operations module.`);
}

export async function runOperationsMigrations(db: import('better-sqlite3').Database) {
    // Placeholder for future migrations. No migrations needed on initial creation.
    try {
        // Example:
        // const tableInfo = db.prepare(`PRAGMA table_info(operations_documents)`).all() as { name: string }[];
        // if (!tableInfo.some(c => c.name === 'new_column')) {
        //     db.exec(`ALTER TABLE operations_documents ADD COLUMN new_column TEXT`);
        // }
    } catch (error) {
        console.error("Error during operations module migrations:", error);
    }
}
