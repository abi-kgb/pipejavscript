import sql from 'mssql';
import dotenv from 'dotenv';
import { dbManager } from './db.js';

dotenv.config();

/**
 * SEED SCRIPT: Register all 3D Library Components into the Inventory Database
 * This ensures that for every part in the Side Panel, there are stock records 
 * across primary materials (PVC, GI, SS304).
 */

const LIBRARY_PARTS = [
  'straight', 'elbow', 'elbow-45', 'vertical', 't-joint', 'cross', 'reducer', 'flange', 'union', 'coupling', 'valve', 'filter', 'tank', 'cap', 'plug', 'water-tap', 'cylinder', 'cube', 'cone', 'industrial-tank', 'wall', 'y-cross', 'stere-cross', 's-trap', 'p-trap', 'y-tee', 'h-pipe', 'equal-tee', 'unequal-tee', 'equal-cross', 'unequal-cross', 'water-stop-ring', 'expansion-joint', 'rainwater-funnel', 'unequal-coupling', 'lucency-cap', 'checking-hole', 'floor-leakage', 'clamp', 'hang-clamp', 'expand-clamp'
];

const DEFAULT_MATERIALS = ['pvc', 'gi', 'ss304'];

async function seedLibrary() {
  console.log('🚀 Starting Library Registration in SQL Database...');
  
  try {
    const pool = await dbManager.getPool();
    console.log('✅ Connected to Node/SQL Pool.');

    let addedCount = 0;
    let skippedCount = 0;

    for (const type of LIBRARY_PARTS) {
      for (const mat of DEFAULT_MATERIALS) {
        // Use lowercase matching to prevent case-sensitive duplicates
        const checkResult = await pool.request()
          .input('type', sql.NVarChar, type)
          .input('mat', sql.NVarChar, mat)
          .query('SELECT TOP 1 id FROM Inventory WHERE LOWER(component_type) = LOWER(@type) AND LOWER(material) = LOWER(@mat)');

        if (checkResult.recordset.length === 0) {
          const unit = type.includes('straight') || type.includes('vertical') ? 'm' : 'pcs';
          const defaultPrice = (type.includes('tank')) ? 1500.00 : 10.00;
          
          await pool.request()
            .input('type', sql.NVarChar, type)
            .input('mat', sql.NVarChar, mat)
            .input('unit', sql.NVarChar, unit)
            .input('price', sql.Decimal(18,2), defaultPrice)
            .query('INSERT INTO Inventory (component_type, material, quantity, used_quantity, unit, price) VALUES (@type, @mat, 1500, 0, @unit, @price)');
          
          console.log(` [+] Registered: ${type} [${mat.toUpperCase()}]`);
          addedCount++;
        } else {
          skippedCount++;
        }
      }
    }

    console.log(`\n✨ Seeding Complete!`);
    console.log(`   - New Component-Material Pairs: ${addedCount}`);
    console.log(`   - Already in Database: ${skippedCount}`);
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding Failed:', err.message);
    process.exit(1);
  }
}

seedLibrary();
