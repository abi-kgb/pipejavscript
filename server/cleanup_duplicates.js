
import sql from 'mssql';

const DB_CONFIG = {
    user: 'sa',
    password: 'Pipe3D@2026',
    server: '127.0.0.1',
    port: 1434,
    database: 'Pipe3DPro',
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

async function cleanupDuplicates() {
    try {
        console.log('--- SESSION-WIDE DUPLICATE CLEANUP ---');
        const pool = await sql.connect(DB_CONFIG);

        const query = `
            WITH CTE AS (
                SELECT 
                    id, 
                    ROW_NUMBER() OVER (
                        PARTITION BY name, user_id 
                        ORDER BY updated_at DESC
                    ) as row_num
                FROM Projects
            )
            DELETE FROM Projects 
            WHERE id IN (
                SELECT id FROM CTE WHERE row_num > 1
            );
        `;

        const result = await pool.request().query(query);
        console.log(`✅ Success! Duplicates merged. Rows affected: ${result.rowsAffected[0]}`);
        
        await pool.close();
    } catch (err) {
        console.error('❌ Failed to cleanup duplicates:', err);
    }
}

cleanupDuplicates();
