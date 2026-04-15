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

async function seedUser() {
    try {
        console.log('Connecting to database...');
        await sql.connect(dbConfig);
        console.log('✅ Connected.');

        // Check if Admin exists
        const result = await sql.query("SELECT * FROM Users WHERE email = 'admin@pipe3d.pro'");
        
        if (result.recordset.length === 0) {
            console.log('Seeding Admin user...');
            await sql.query(`
                INSERT INTO Users (name, email, password_hash, company)
                VALUES ('Admin', 'admin@pipe3d.pro', 'admin123', 'Pipe3D Solutions')
            `);
            console.log('✅ Admin user seeded.');
        } else {
            console.log('Admin user already exists.');
        }

        const users = await sql.query('SELECT * FROM Users');
        console.log('Current Users:');
        console.table(users.recordset);

        await sql.close();
    } catch (err) {
        console.error('❌ Error details:', err);
    }
}

seedUser();
