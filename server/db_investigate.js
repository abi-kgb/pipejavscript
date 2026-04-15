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
    server: process.env.DB_SERVER || 'localhost',
    port: parseInt(process.env.DB_PORT) || 1434,
    options: {
        encrypt: true,
        trustServerCertificate: true
    }
};

async function check() {
    try {
        console.log('Connecting to MSSQL...');
        const pool = await sql.connect(config);
        
        const countRes = await pool.request().query('SELECT COUNT(*) as total FROM Projects');
        console.log('Total projects in DB:', countRes.recordset[0].total);
        
        const perUser = await pool.request().query('SELECT user_id, COUNT(*) as count FROM Projects GROUP BY user_id');
        console.log('Projects per user:', JSON.stringify(perUser.recordset));
        
        const users = await pool.request().query('SELECT id, email FROM Users');
        console.log('Users in DB:', JSON.stringify(users.recordset));

        const oldest = await pool.request().query('SELECT TOP 5 id, name, created_at FROM Projects ORDER BY created_at ASC');
        console.log('Oldest projects:', JSON.stringify(oldest.recordset));

        await pool.close();
    } catch (err) {
        console.error('Error connecting to DB:', err);
    }
}

check();
