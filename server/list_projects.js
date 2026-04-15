import sql from 'mssql';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const config = {
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || 'Pipe3D@2026',
    database: process.env.DB_DATABASE || 'Pipe3DPro',
    server: '127.0.0.1',
    port: 1434,
    options: {
        encrypt: true,
        trustServerCertificate: true
    }
};

async function list() {
    try {
        const pool = await sql.connect(config);
        const result = await pool.request().query('SELECT id, name, user_id, created_at FROM Projects ORDER BY created_at DESC');
        console.log(JSON.stringify(result.recordset, null, 2));
        await pool.close();
    } catch (err) {
        // Silent
    }
}

list();
