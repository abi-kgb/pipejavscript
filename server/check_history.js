
import sql from 'mssql';
import dotenv from 'dotenv';
dotenv.config();

const dbConfig = {
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || 'Pipe3D@2026',
    server: process.env.DB_SERVER || 'localhost',
    database: process.env.DB_DATABASE || 'Pipe3DPro',
    port: 1434,
    options: {
        encrypt: true,
        trustServerCertificate: true
    }
};

async function checkHistory() {
    try {
        console.log('Connecting to database...');
        const pool = await sql.connect(dbConfig);
        console.log('✅ Connected.');

        const lastProjects = await pool.request()
            .query('SELECT TOP 10 id, name, created_at FROM Projects ORDER BY created_at DESC');
        
        console.log('\n--- Latest 10 projects in database ---');
        lastProjects.recordset.forEach(p => {
            console.log(`ID: ${String(p.id).padEnd(5)} | Name: ${String(p.name).padEnd(20)} | Date: ${p.created_at}`);
        });

        await pool.close();
    } catch (err) {
        console.error('❌ Error:', err.message);
    }
}

checkHistory();
