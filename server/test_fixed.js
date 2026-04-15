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
    port: parseInt(process.env.DB_PORT) || 1434,
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

async function test() {
    try {
        console.log(`Attempting connection to ${config.server}:${config.port} as ${config.user}...`);
        await sql.connect(config);
        console.log('✅ CONNECTED');
        const res = await sql.query('SELECT name FROM sys.databases WHERE name = \'Pipe3DPro\'');
        if (res.recordset.length > 0) {
            console.log('✅ DATABASE Pipe3DPro FOUND');
        } else {
            console.warn('⚠️ DATABASE Pipe3DPro NOT FOUND');
        }
        await sql.close();
    } catch(err) {
        console.error('❌ FAILED:', err.message);
    }
}
test();
