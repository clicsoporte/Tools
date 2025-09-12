// @/modules/core/lib/sql-service.ts
'use server';
import sql from 'mssql';
import { logError } from './logger';
import { getSqlConfig } from './config-db';

let pool: sql.ConnectionPool | null = null;
let isConnecting = false;

async function getDbConfig(): Promise<sql.config> {
    const dbConfig = await getSqlConfig();

    if (!dbConfig || !dbConfig.user || !dbConfig.host || !dbConfig.database) {
        throw new Error("Las credenciales de SQL Server no están configuradas. Por favor, verifica el usuario, servidor y base de datos en la pantalla de administración.");
    }
    
    const config = {
        user: dbConfig.user,
        password: dbConfig.password,
        server: dbConfig.host,
        database: dbConfig.database,
        port: Number(dbConfig.port) || 1433,
        options: {
            encrypt: true,
            trustServerCertificate: true,
            connectTimeout: 30000,
            requestTimeout: 30000,
            enableArithAbort: true
        },
        pool: {
            max: 10,
            min: 0,
            idleTimeoutMillis: 30000
        }
    };

    return config;
}

// Función para validar que solo sea SELECT
function validateSelectOnly(query: string): void {
    const cleanedQuery = query.trim().toLowerCase();
    
    // Lista de palabras clave prohibidas
    const forbiddenKeywords = [
        'insert', 'update', 'delete', 'drop', 'alter', 'create', 
        'truncate', 'execute', 'exec', 'grant', 'revoke'
    ];
    
    // Verificar que comience con SELECT
    if (!cleanedQuery.startsWith('select')) {
        throw new Error("Solo se permiten consultas SELECT.");
    }
    
    // Verificar que no contenga palabras prohibidas
    for (const keyword of forbiddenKeywords) {
        if (cleanedQuery.includes(` ${keyword} `) || 
            cleanedQuery.includes(` ${keyword};`) ||
            cleanedQuery.includes(` ${keyword}\n`) ||
            cleanedQuery.includes(` ${keyword}\r`)) {
            throw new Error(`La consulta contiene la palabra prohibida: ${keyword}`);
        }
    }
    
    // Verificar que no tenga punto y coma múltiple (posible SQL injection)
    if ((cleanedQuery.match(/;/g) || []).length > 1) {
        throw new Error("La consulta contiene múltiples statements.");
    }
}

async function getConnectionPool(): Promise<sql.ConnectionPool> {
    // Si ya tenemos un pool y está conectado, lo devolvemos
    if (pool && pool.connected) {
        return pool;
    }

    // Si ya se está intentando conectar, esperamos un poco
    if (isConnecting) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        if (pool && pool.connected) return pool;
        if (isConnecting) throw new Error('Conexión a la base de datos en progreso, por favor intente de nuevo en unos segundos.');
    }
    
    isConnecting = true;

    try {
        const config = await getDbConfig();
        
        pool = new sql.ConnectionPool(config);
        
        pool.on('error', err => {
            logError('Error en el pool de SQL Server', { error: err });
            pool = null; // Reseteamos el pool si hay un error
        });

        await pool.connect();
        
        console.log('✅ Conexión a SQL Server establecida');
        return pool;

    } catch (err: any) {
        pool = null; // Reseteamos el pool en caso de error de conexión
        logError("Error al conectar con SQL Server", { 
            error: {
                message: err.message,
                code: err.code,
            },
            server: (await getDbConfig()).server
        });
        
        throw new Error(`No se pudo establecer la conexión con la base de datos de SQL Server.`);
    } finally {
        isConnecting = false;
    }
}

export async function executeQuery(query: string): Promise<any[]> {
    // Validar que sea solo SELECT
    validateSelectOnly(query);
    
    let connection: sql.ConnectionPool | null = null;
    
    try {
        connection = await getConnectionPool();
        const result = await connection.request().query(query);
        return result.recordset;
        
    } catch (err: any) {
        logError("Error al ejecutar consulta SELECT", { 
            error: err.message,
            code: err.code,
            query: query.substring(0, 500)
        });
        
        if (err.code === 'ESOCKET' || err.code === 'ECONNCLOSED') {
            pool = null;
        }
        
        throw new Error(`Error en la consulta SQL: ${err.message}`);
    }
}
