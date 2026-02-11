/**
 * @fileoverview Server-side functions for the consignments module database.
 */
"use server";

import { connectDb } from '@/modules/core/lib/db';
import type { ConsignmentAgreement, ConsignmentProduct, CountingSession, CountingSessionLine, RestockBoleta, BoletaLine, BoletaHistory } from '@/modules/core/types';
import { logError, logInfo } from '@/modules/core/lib/logger';
import { sendEmail } from '@/modules/core/lib/email-service';
import { getPlannerSettings } from '@/modules/planner/lib/db';

const CONSIGNMENTS_DB_FILE = 'consignments.db';

export async function initializeConsignmentsDb(db: import('better-sqlite3').Database) {
    const schema = `
        CREATE TABLE IF NOT EXISTS consignment_agreements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id TEXT UNIQUE NOT NULL,
            client_name TEXT NOT NULL,
            erp_warehouse_id TEXT,
            next_boleta_number INTEGER NOT NULL DEFAULT 1,
            notes TEXT,
            is_active BOOLEAN NOT NULL DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS consignment_products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            agreement_id INTEGER NOT NULL,
            product_id TEXT NOT NULL,
            max_stock REAL NOT NULL,
            price REAL NOT NULL,
            FOREIGN KEY (agreement_id) REFERENCES consignment_agreements(id) ON DELETE CASCADE,
            UNIQUE(agreement_id, product_id)
        );

        CREATE TABLE IF NOT EXISTS counting_sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            agreement_id INTEGER NOT NULL,
            user_id INTEGER NOT NULL,
            status TEXT NOT NULL,
            created_at TEXT NOT NULL,
            FOREIGN KEY (agreement_id) REFERENCES consignment_agreements(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS counting_session_lines (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL,
            product_id TEXT NOT NULL,
            counted_quantity REAL NOT NULL,
            FOREIGN KEY (session_id) REFERENCES counting_sessions(id) ON DELETE CASCADE,
            UNIQUE(session_id, product_id)
        );

        CREATE TABLE IF NOT EXISTS restock_boletas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            consecutive TEXT UNIQUE NOT NULL,
            agreement_id INTEGER NOT NULL,
            status TEXT NOT NULL,
            created_by TEXT,
            created_at TEXT,
            approved_by TEXT,
            approved_at TEXT,
            erp_invoice_number TEXT,
            FOREIGN KEY (agreement_id) REFERENCES consignment_agreements(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS boleta_lines (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            boleta_id INTEGER NOT NULL,
            product_id TEXT NOT NULL,
            product_description TEXT NOT NULL,
            counted_quantity REAL NOT NULL,
            replenish_quantity REAL NOT NULL,
            max_stock REAL NOT NULL,
            price REAL NOT NULL,
            FOREIGN KEY (boleta_id) REFERENCES restock_boletas(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS boleta_history (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            boleta_id INTEGER NOT NULL,
            timestamp TEXT NOT NULL,
            status TEXT NOT NULL,
            notes TEXT,
            updatedBy TEXT NOT NULL,
            FOREIGN KEY (boleta_id) REFERENCES restock_boletas(id) ON DELETE CASCADE
        );
    `;
    db.exec(schema);
    console.log(`Database ${CONSIGNMENTS_DB_FILE} initialized for Consignments module.`);
}

export async function runConsignmentsMigrations(db: import('better-sqlite3').Database) {
    // Placeholder for future migrations.
}

export async function getAgreements(): Promise<ConsignmentAgreement[]> {
    const db = await connectDb(CONSIGNMENTS_DB_FILE);
    const agreements = db.prepare('SELECT * FROM consignment_agreements ORDER BY client_name').all() as ConsignmentAgreement[];
    return JSON.parse(JSON.stringify(agreements));
}

export async function getBoletasByDateRange(agreementId: string, dateRange: { from: Date; to: Date }): Promise<{ boletas: (RestockBoleta & { lines: BoletaLine[] })[] }> {
    const db = await connectDb(CONSIGNMENTS_DB_FILE);
    const boletas = db.prepare(`
            SELECT * FROM restock_boletas 
            WHERE agreement_id = ? AND created_at BETWEEN ? AND ?
        `).all(agreementId, dateRange.from.toISOString(), dateRange.to.toISOString()) as RestockBoleta[];
    
    if (boletas.length === 0) return { boletas: [] };

    const boletaIds = boletas.map(b => b.id);
    const placeholders = boletaIds.map(() => '?').join(',');

    const allLines = db.prepare(`SELECT * FROM boleta_lines WHERE boleta_id IN (${placeholders})`).all(...boletaIds) as BoletaLine[];

    const boletasWithLines = boletas.map(b => ({
        ...b,
        lines: allLines.filter(l => l.boleta_id === b.id)
    }));

    return { boletas: JSON.parse(JSON.stringify(boletasWithLines)) };
}
    
