import sql from 'mssql';
import dotenv from 'dotenv';
dotenv.config();

const DB_CONFIG = {
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || 'Pipe3D@2026',
    database: process.env.DB_DATABASE || 'Pipe3DPro',
    server: process.env.DB_SERVER || 'localhost',
    port: parseInt(process.env.DB_PORT) || 1433, // Default to 1433 for standard MSSQLSERVER
    options: {
        encrypt: false,
        trustServerCertificate: true,
        connectTimeout: 30000,
        requestTimeout: 120000,
        enableArithAbort: true,
        packetSize: 32768
    },
    pool: {
        max: 50,
        min: 5,
        idleTimeoutMillis: 30000
    }
};

/**
 * Highly Robust Database Manager (Performance Optimized for i3/Lower-end Servers)
 * Handles singleton connection, request locking, and auto-recovery.
 */
class DatabaseManager {
    constructor() {
        this.pool = null;
        this.isConnecting = false;
        this.connectionPromise = null;
        this.lastHealthCheck = 0;
    }

    async getPool() {
        // 1. Return already healthy pool
        if (this.pool && this.pool.connected) {
            // Periodic health check (every 30s)
            const now = Date.now();
            if (now - this.lastHealthCheck > 30000) {
                try {
                    await this.pool.request().query('SELECT 1');
                    this.lastHealthCheck = now;
                } catch (err) {
                    console.warn('[DB] Stale pool detected during health check. Reconnecting...');
                    await this.closePool();
                }
            }
            if (this.pool) return this.pool;
        }

        // 2. If already connecting, wait for that promise
        if (this.isConnecting && this.connectionPromise) {
            return this.connectionPromise;
        }

        // 3. Initiate new connection with lock
        this.isConnecting = true;
        this.connectionPromise = (async () => {
            try {
                console.log(`[DB] Attempting connection to ${DB_CONFIG.server}:${DB_CONFIG.port}...`);
                const newPool = await new sql.ConnectionPool(DB_CONFIG).connect();
                this.pool = newPool;
                this.lastHealthCheck = Date.now();
                console.log('✅ MSSQL Connected Successfully');
                return newPool;
            } catch (err) {
                console.error('❌ MSSQL Connection Failed:', err.message);
                
                // Fallback attempt: Try port 1434 if 1433 failed (Common for named instances/configs)
                if (DB_CONFIG.port === 1433) {
                    try {
                        console.log('[DB] Fallback: Retrying on port 1434...');
                        const fallbackPool = await new sql.ConnectionPool({ ...DB_CONFIG, port: 1434 }).connect();
                        this.pool = fallbackPool;
                        this.lastHealthCheck = Date.now();
                        console.log('✅ MSSQL Connected Successfully (on Port 1434)');
                        return fallbackPool;
                    } catch (err2) {
                        console.error('❌ MSSQL Fallback Failed:', err2.message);
                    }
                }
                
                this.pool = null;
                throw err;
            } finally {
                this.isConnecting = false;
                this.connectionPromise = null;
            }
        })();

        return this.connectionPromise;
    }

    async closePool() {
        if (this.pool) {
            try {
                await this.pool.close();
            } catch (err) {
                // Silently ignore close errors
            }
            this.pool = null;
        }
    }

    /**
     * Helper to execute a query with auto-pool management
     */
    async query(queryString, inputs = {}) {
        const pool = await this.getPool();
        const request = pool.request();
        for (const [key, val] of Object.entries(inputs)) {
            request.input(key, val.type || sql.NVarChar, val.value !== undefined ? val.value : val);
        }
        return request.query(queryString);
    }
}

export const dbManager = new DatabaseManager();
export default dbManager;
