import sql from 'mssql';
import dotenv from 'dotenv';
import { dbManager } from './db.js';

dotenv.config();

const LIBRARY_PARTS = [
  'straight', 'elbow', 'elbow-45', 'vertical', 't-joint', 'cross', 'reducer', 'flange', 'union', 'coupling', 'valve', 'filter', 'tank', 'cap', 'plug', 'water-tap', 'cylinder', 'cube', 'cone', 'industrial-tank', 'wall', 'y-cross', 'stere-cross', 's-trap', 'p-trap', 'y-tee', 'h-pipe', 'equal-tee', 'unequal-tee', 'equal-cross', 'unequal-cross', 'water-stop-ring', 'expansion-joint', 'rainwater-funnel', 'unequal-coupling', 'lucency-cap', 'checking-hole', 'floor-leakage', 'clamp', 'hang-clamp', 'expand-clamp'
];

// Single Material for speed (PVC is default usually)
const DEFAULT_MATERIALS = ['pvc'];

async function seedLibraryFast() {
  console.log('🚀 Starting FAST Library Registration...');
  
  try {
    const pool = await dbManager.getPool();
    console.log('✅ Connected to Node/SQL Pool.');

    // Build the VALUES part of the query
    let valuesBlocks = [];
    for (const type of LIBRARY_PARTS) {
      for (const mat of DEFAULT_MATERIALS) {
        const unit = type.includes('straight') || type.includes('vertical') ? 'm' : 'pcs';
        const defaultPrice = (type.includes('tank')) ? 1500.00 : 10.00;
        
        // Single quote strings
        valuesBlocks.push(`('${type}', '${mat}', 1500, 0, '${unit}', ${defaultPrice})`);
      }
    }

    const query = `
      MERGE INTO Inventory AS Target
      USING (VALUES
        ${valuesBlocks.join(',\n')}
      ) AS Source (component_type, material, quantity, used_quantity, unit, price)
      ON LOWER(Target.component_type) = LOWER(Source.component_type) 
         AND LOWER(Target.material) = LOWER(Source.material)
      WHEN NOT MATCHED THEN
        INSERT (component_type, material, quantity, used_quantity, unit, price)
        VALUES (Source.component_type, Source.material, Source.quantity, Source.used_quantity, Source.unit, Source.price);
    `;

    console.log('Executing Bulk MERGE...');
    const result = await pool.request().query(query);
    
    console.log(`\n✨ Fast Seeding Complete!`);
    console.log(`Rows affected:`, result.rowsAffected);
    
    process.exit(0);
  } catch (err) {
    console.error('❌ Fast Seeding Failed:', err.message);
    process.exit(1);
  }
}

seedLibraryFast();
