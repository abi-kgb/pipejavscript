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
        encrypt: false,
        trustServerCertificate: true
    }
};

async function reset() {
    try {
        console.log('Connecting to MSSQL...');
        const pool = await sql.connect(config);
        console.log('CONNECTED');
        
        await pool.request().query('DELETE FROM Inventory');
        console.log('DELETED OLD INVENTORY');
        
        const components = [
            'straight', 'vertical', 'elbow', 'elbow-45', 't-joint', 'cross', 'reducer',
            'flange', 'union', 'coupling', 'valve', 'filter', 'tank', 'cap', 'plug',
            'water-tap', 'cylinder', 'cube', 'cone', 'industrial-tank', 'wall'
        ];
        const materials = [
            'steel', 'ms', 'gi', 'ss304', 'ss316', 'copper', 'brass', 'ci',
            'pvc', 'cpvc', 'upvc', 'hdpe', 'sq_steel', 'sq_aluminium',
            'industrial_yellow', 'wall_concrete'
        ];
        
        console.log(`Starting populate check for first 10 combinations...`);
        let count = 0;
        for (const comp of components) {
            for (const mat of materials) {
                if (count >= 10) break;
                const isPipe = ['straight', 'vertical', 'wall'].includes(comp);
                const unit = isPipe ? 'm' : 'pcs';
                const quantity = isPipe ? 10000 : 100;
                const price = isPipe ? 60 : 50; 
                
                await pool.request()
                    .input('type', sql.NVarChar, comp)
                    .input('material', sql.NVarChar, mat)
                    .input('unit', sql.NVarChar, unit)
                    .input('quantity', sql.Decimal(18, 2), quantity)
                    .input('price', sql.Decimal(18, 2), price)
                    .query('INSERT INTO Inventory (component_type, material, quantity, used_quantity, unit, price) VALUES (@type, @material, @quantity, 0, @unit, @price)');
                count++;
            }
            if (count >= 10) break;
        }
        console.log('✅ INVENTORY RESET SUCCESSFUL (100 pcs / 10,000 m baseline)');
        await pool.close();
    } catch (err) {
        console.error('❌ FAILED:', err.message);
    }
}
reset();
