import sql from 'mssql';
import dotenv from 'dotenv';
dotenv.config();

const dbConfig = {
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || 'Pipe3D@2026',
    server: process.env.DB_SERVER || 'ABINAYA-ARUNKUMAR', // Try the one from index.js
    database: process.env.DB_DATABASE || 'Pipe3DPro',
    port: 1434,
    options: {
        encrypt: true,
        trustServerCertificate: true,
        connectTimeout: 5000
    }
};

async function createTable() {
    try {
        console.log('Connecting to create Projects table...');
        // Fallback to localhost if ABINAYA-ARUNKUMAR fails
        let pool;
        try {
            pool = await sql.connect(dbConfig);
        } catch (e) {
            console.log('Failed DB_SERVER, trying localhost...', e.message);
            dbConfig.server = 'localhost';
            pool = await sql.connect(dbConfig);
        }

        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Projects]') AND type in (N'U'))
            BEGIN
                CREATE TABLE [dbo].[Projects] (
                    [id] INT IDENTITY(1,1) PRIMARY KEY,
                    [user_id] INT NULL FOREIGN KEY REFERENCES [dbo].[Users]([id]),
                    [name] NVARCHAR(255) NOT NULL,
                    [components_json] NVARCHAR(MAX) NOT NULL,
                    [bom_json] NVARCHAR(MAX) NOT NULL,
                    [image_data] NVARCHAR(MAX) NOT NULL,
                    [created_at] DATETIME DEFAULT GETDATE()
                );
                PRINT 'Table created';
            END
            ELSE
            BEGIN
                PRINT 'Table already exists';
            END
        `);
        console.log('Successfully ran Projects table script!');
        await pool.close();
    } catch (err) {
        console.error('Table creation error:', err.message);
    }
}

createTable();
