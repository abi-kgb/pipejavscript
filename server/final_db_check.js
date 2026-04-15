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
        trustServerCertificate: true,
        connectTimeout: 5000
    }
};

async function finalVerify() {
    try {
        console.log('--- Database Verification ---');
        const pool = await sql.connect(dbConfig);
        const result = await pool.request()
            .input('type', sql.NVarChar, 'straight')
            .input('material', sql.NVarChar, 'pvc')
            .query('SELECT component_type, material, quantity, unit FROM Inventory WHERE component_type = @type AND material = @material');

        if (result.recordset.length > 0) {
            const row = result.recordset[0];
            console.log(`Component: ${row.component_type}`);
            console.log(`Material:  ${row.material}`);
            console.log(`Quantity:  ${row.quantity} ${row.unit}`);

            if (row.quantity === 90) {
                console.log('\n✅ VERIFIED: The database correctly shows 90.0 units after our test reduction.');
            } else {
                console.log(`\nℹ️ Current database value is ${row.quantity}.`);
            }
        } else {
            console.log('❌ Item not found in database.');
        }

        await pool.close();
    } catch (err) {
        console.error('Database connection error:', err.message);
    }
}

finalVerify();
