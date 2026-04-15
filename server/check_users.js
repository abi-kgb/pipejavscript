import sql from 'mssql';
import dotenv from 'dotenv';
dotenv.config();

const dbConfig = {
    user: 'sa',
    password: 'Pipe3D@2026',
    server: 'localhost',
    database: 'Pipe3DPro',
    port: 1434,
    options: {
        encrypt: true,
        trustServerCertificate: true,
        connectTimeout: 30000,
        requestTimeout: 30000
    }
};

async function checkUsers() {
    try {
        console.log('Connecting to database...');
        await sql.connect(dbConfig);
        console.log('✅ Connected.');

        const result = await sql.query('SELECT * FROM Users');
        console.log('Users found:', result.recordset.length);
        console.log(result.recordset);

        await sql.close();
    } catch (err) {
        console.error('❌ Error details:', err);
    }
}

checkUsers();
