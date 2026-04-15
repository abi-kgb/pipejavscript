import sql from 'mssql';
import dotenv from 'dotenv';
dotenv.config();

const ports = [1433, 1434];
const servers = ['localhost', '127.0.0.1'];

async function testConnection(server, port) {
    const config = {
        user: process.env.DB_USER || 'sa',
        password: process.env.DB_PASSWORD || 'Pipe3D@2026',
        server: server,
        database: process.env.DB_DATABASE || 'Pipe3DPro',
        port: port,
        options: {
            encrypt: true,
            trustServerCertificate: true,
            connectTimeout: 5000
        }
    };

    console.log(`Testing: ${server}:${port}...`);
    try {
        const pool = await sql.connect(config);
        console.log(`✅ SUCCESS: ${server}:${port} connected!`);
        await pool.close();
        return true;
    } catch (err) {
        console.log(`❌ FAILED: ${server}:${port} - ${err.message}`);
        return false;
    }
}

async function runTests() {
    for (const server of servers) {
        for (const port of ports) {
            const success = await testConnection(server, port);
            if (success) {
                console.log(`\nWorking configuration found: ${server}:${port}`);
                process.exit(0);
            }
        }
    }
    console.log('\nNo working connection found with the current credentials.');
    process.exit(1);
}

runTests();
