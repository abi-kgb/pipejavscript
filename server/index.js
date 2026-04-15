import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import sql from 'mssql';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dbManager } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ limit: '100mb', extended: true }));

// ─────────────────────────────────────────
// Database Configuration (Strict Port 1434)
// ─────────────────────────────────────────

// ─────────────────────────────────────────
// Robust SINGLE Database Pool (Managed by dbManager)
// ─────────────────────────────────────────
async function getPool() {
    return dbManager.getPool();
}

// ─────────────────────────────────────────
// Auto Schema Initializer
// ─────────────────────────────────────────
async function ensureTablesExist() {
    let pool;
    try {
        pool = await getPool();
    } catch (err) {
        console.error('❌ Cannot initialize schema — no DB connection:', err.message);
        return;
    }

    console.log('[DB] Verifying schema...');
    try {
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Users]') AND type = 'U')
            BEGIN
                CREATE TABLE [dbo].[Users] (
                    [id]            INT IDENTITY(1,1) PRIMARY KEY,
                    [name]          NVARCHAR(100) NOT NULL,
                    [email]         NVARCHAR(255) UNIQUE NOT NULL,
                    [password_hash] NVARCHAR(MAX) NOT NULL,
                    [company]       NVARCHAR(100),
                    [created_at]    DATETIME DEFAULT GETDATE()
                );
            END
            
            -- Ensure at least the Admin user exists
            IF NOT EXISTS (SELECT * FROM [dbo].[Users] WHERE email = 'admin@pipe3d.pro')
            BEGIN
                INSERT INTO [dbo].[Users] (name, email, password_hash, company)
                VALUES ('Admin', 'admin@pipe3d.pro', 'admin123', 'Pipe3D Solutions');
            END
        `);

        // 2. Projects (depends on Users) ------------------------------------
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Projects]') AND type = 'U')
            BEGIN
                CREATE TABLE [dbo].[Projects] (
                    [id]              INT IDENTITY(1,1) PRIMARY KEY,
                    [user_id]         INT NULL FOREIGN KEY REFERENCES [dbo].[Users]([id]),
                    [name]            NVARCHAR(255) NOT NULL,
                    [components_json] NVARCHAR(MAX) NOT NULL,
                    [bom_json]        NVARCHAR(MAX) NOT NULL,
                    [image_data]      NVARCHAR(MAX) NOT NULL,
                    [created_at]      DATETIME DEFAULT GETDATE(),
                    [updated_at]      DATETIME DEFAULT GETDATE()
                );
            END
            ELSE
            BEGIN
                -- Ensure image_data column exists (for older schemas)
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Projects]') AND name = 'image_data')
                    ALTER TABLE [dbo].[Projects] ADD [image_data] NVARCHAR(MAX) NULL;
                
                -- Ensure updated_at column exists
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Projects]') AND name = 'updated_at')
                    ALTER TABLE [dbo].[Projects] ADD [updated_at] DATETIME DEFAULT GETDATE();

                -- Ensure is_favourite column exists
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Projects]') AND name = 'is_favourite')
                    ALTER TABLE [dbo].[Projects] ADD [is_favourite] BIT DEFAULT 0;
            END
        `);

        // Maintenance: Cleanup Duplicates Endpoint
        app.post('/api/maintenance/cleanup-duplicates', async (req, res) => {
            try {
                const pool = await getPool();
                console.log('[Maintenance] Merging duplicate project names...');
                
                const query = `
                    WITH CTE AS (
                        SELECT id, ROW_NUMBER() OVER (PARTITION BY name, user_id ORDER BY created_at DESC) as row_num
                        FROM Projects
                    )
                    DELETE FROM Projects WHERE id IN (SELECT id FROM CTE WHERE row_num > 1);
                `;
                
                const result = await pool.request().query(query);
                res.json({ ok: true, merged: result.rowsAffected[0] });
            } catch (err) {
                res.status(500).json({ error: err.message });
            }
        });

        // 3. Inventory ------------------------------------------------------
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Inventory]') AND type = 'U')
            BEGIN
                CREATE TABLE [dbo].[Inventory] (
                    [id]             INT IDENTITY(1,1) PRIMARY KEY,
                    [component_type] NVARCHAR(100) NOT NULL,
                    [material]       NVARCHAR(100) NOT NULL,
                    [quantity]       DECIMAL(18, 2) DEFAULT 0,
                    [used_quantity]  DECIMAL(18, 2) DEFAULT 0,
                    [unit]           NVARCHAR(20)  DEFAULT 'pcs',
                    [price]          DECIMAL(18, 2) DEFAULT 0,
                    [last_updated]   DATETIME DEFAULT GETDATE()
                );
            END
            ELSE
            BEGIN
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Inventory]') AND name = 'price')
                BEGIN
                    ALTER TABLE [dbo].[Inventory] ADD [price] DECIMAL(18, 2) DEFAULT 0;
                END
                IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Inventory]') AND name = 'used_quantity')
                BEGIN
                    ALTER TABLE [dbo].[Inventory] ADD [used_quantity] DECIMAL(18, 2) DEFAULT 0;
                END
            END
        `);

        // 4. SystemMasterData (Unified Config) -------------------------------
        await pool.request().query(`
            IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[SystemMasterData]') AND type = 'U')
            BEGIN
                CREATE TABLE [dbo].[SystemMasterData] (
                    [id]             INT IDENTITY(1,1) PRIMARY KEY,
                    [category]       NVARCHAR(50)  NOT NULL, -- 'NamingPrefix', 'MaterialPrice'
                    [item_key]       NVARCHAR(100) NOT NULL, -- 'straight', 'pvc'
                    [item_value]     NVARCHAR(200) NOT NULL, -- 'P', '60.00'
                    [description]    NVARCHAR(MAX) NULL
                );
            END
        `);

        console.log('✅ Database schema verified.');
    } catch (err) {
        console.error('❌ Schema verification error:', err.message);
    }
}

// ─────────────────────────────────────────
// Routes
// ─────────────────────────────────────────

app.get('/api/health', async (req, res) => {
    try {
        const pool = await getPool();
        res.json({ status: 'OK', database: pool.connected ? 'Connected' : 'Disconnected', timestamp: new Date() });
    } catch (err) {
        res.status(503).json({ status: 'Degraded', database: 'Unreachable', error: err.message });
    }
});

// --- Inventory Endpoints ---
app.get('/api/inventory', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query('SELECT * FROM Inventory ORDER BY component_type, material');
        res.json(result.recordset);
    } catch (err) {
        console.error('API Error (/api/inventory):', err.message);
        res.status(503).json({ error: 'Database Unavailable', details: err.message });
    }
});

app.get('/api/inventory/materials', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query('SELECT DISTINCT material FROM Inventory');
        res.json(result.recordset.map(r => r.material));
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get('/api/inventory/check', async (req, res) => {
    const { type, material } = req.query;
    if (!type || !material) {
        return res.status(400).json({ error: 'Missing type or material' });
    }

    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('type', sql.NVarChar, type)
            .input('material', sql.NVarChar, material)
            .query('SELECT quantity, unit FROM Inventory WHERE component_type = @type AND material = @material');

        if (result.recordset.length === 0) {
            return res.json({ quantity: 0, unit: 'pcs', exists: false });
        }

        res.json({ quantity: result.recordset[0].quantity, unit: result.recordset[0].unit, exists: true });
    } catch (err) {
        console.error('API Error (/api/inventory/check):', err.message);
        res.status(500).json({ error: 'Check Failed', details: err.message });
    }
});

// Batch check for multiple items: { items: [{ type, material, amount }] }
app.post('/api/inventory/check-batch', async (req, res) => {
    const { items } = req.body;
    if (!Array.isArray(items)) {
        return res.status(400).json({ error: 'items must be an array' });
    }

    try {
        const pool = await getPool();
        const results = [];
        for (const item of items) {
            const result = await pool.request()
                .input('type', sql.NVarChar, item.type)
                .input('material', sql.NVarChar, item.material)
                .query('SELECT quantity, unit FROM Inventory WHERE LOWER(component_type) = LOWER(@type) AND LOWER(material) = LOWER(@material)');

            if (result.recordset.length === 0) {
                results.push({ type: item.type, material: item.material, quantity: 0, unit: 'pcs', exists: false, insufficient: true });
            } else {
                const stock = result.recordset[0];
                results.push({
                    type: item.type,
                    material: item.material,
                    quantity: stock.quantity,
                    unit: stock.unit,
                    exists: true,
                    insufficient: stock.quantity < (item.amount || 1)
                });
            }
        }

        const anyInsufficient = results.find(r => r.insufficient);
        res.json({ ok: !anyInsufficient, results, failedItem: anyInsufficient || null });
    } catch (err) {
        console.error('API Error (/api/inventory/check-batch):', err.message);
        res.status(500).json({ error: 'Batch Check Failed', details: err.message });
    }
});

app.put('/api/inventory', async (req, res) => {
    const { items } = req.body;
    if (!Array.isArray(items)) {
        return res.status(400).json({ error: 'Invalid items format' });
    }

    try {
        const pool = await getPool();
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            for (const item of items) {
                await new sql.Request(transaction)
                    .input('id', sql.Int, item.id)
                    .input('quantity', sql.Decimal(18, 2), item.quantity)
                    .input('used_quantity', sql.Decimal(18, 2), item.used_quantity || 0)
                    .input('price', sql.Decimal(18, 2), item.price || 0)
                    .query('UPDATE Inventory SET quantity = @quantity, used_quantity = @used_quantity, price = @price, last_updated = GETDATE() WHERE id = @id');
            }
            await transaction.commit();
            res.json({ message: 'Inventory updated successfully' });
        } catch (txErr) {
            await transaction.rollback();
            throw txErr;
        }
    } catch (err) {
        console.error('API Error (PUT /api/inventory):', err.message);
        res.status(500).json({ error: 'Update Failed', details: err.message });
    }
});

// Create new inventory item (Admin tool)
app.post('/api/inventory', async (req, res) => {
    const { type, material, quantity = 0, unit = 'pcs', price = 0 } = req.body;
    if (!type || !material) {
        return res.status(400).json({ error: 'Type and Material are required' });
    }

    try {
        const pool = await getPool();
        
        // Check if exists
        const check = await pool.request()
            .input('type', sql.NVarChar, type)
            .input('material', sql.NVarChar, material)
            .query('SELECT id FROM Inventory WHERE LOWER(component_type) = LOWER(@type) AND LOWER(material) = LOWER(@material)');

        if (check.recordset.length > 0) {
            return res.status(409).json({ error: 'Component already exists in inventory. Use Update instead.' });
        }

        await pool.request()
            .input('type', sql.NVarChar, type)
            .input('material', sql.NVarChar, material)
            .input('quantity', sql.Decimal(18, 2), quantity)
            .input('unit', sql.NVarChar, unit)
            .input('price', sql.Decimal(18, 2), price)
            .query('INSERT INTO Inventory (component_type, material, quantity, unit, price) VALUES (@type, @material, @quantity, @unit, @price)');

        res.status(201).json({ message: 'Inventory item created successfully' });
    } catch (err) {
        console.error('API Error (POST /api/inventory):', err.message);
        res.status(500).json({ error: 'Creation Failed', details: err.message });
    }
});

app.post('/api/inventory/seed-library', async (req, res) => {
    try {
        const pool = await getPool();
        const LIBRARY_PARTS = [
          'straight', 'elbow', 'elbow-45', 'vertical', 't-joint', 'cross', 'reducer', 
          'flange', 'union', 'coupling', 'valve', 'filter', 'tank', 'cap', 'plug', 
          'water-tap', 'cylinder', 'cube', 'cone', 'industrial-tank', 'wall', 
          'y-cross', 'stere-cross', 's-trap', 'p-trap', 'y-tee', 'h-pipe', 
          'equal-tee', 'unequal-tee', 'equal-cross', 'unequal-cross', 'water-stop-ring', 
          'expansion-joint', 'rainwater-funnel', 'unequal-coupling', 'lucency-cap', 
          'checking-hole', 'floor-leakage', 'clamp', 'hang-clamp', 'expand-clamp'
        ];
        const DEFAULT_MATERIALS = ['pvc', 'gi', 'ss304'];
        
        let addedCount = 0;
        for (const type of LIBRARY_PARTS) {
            for (const mat of DEFAULT_MATERIALS) {
                const check = await pool.request()
                    .input('type', sql.NVarChar, type)
                    .input('material', sql.NVarChar, mat)
                    .query('SELECT id FROM Inventory WHERE LOWER(component_type) = LOWER(@type) AND LOWER(material) = LOWER(@material)');
                
                if (check.recordset.length === 0) {
                    const unit = type.includes('straight') || type.includes('vertical') ? 'm' : 'pcs';
                    const defaultPrice = (type.includes('tank')) ? 1500.00 : 10.00;
                    
                    await pool.request()
                        .input('type', sql.NVarChar, type)
                        .input('mat', sql.NVarChar, mat)
                        .input('unit', sql.NVarChar, unit)
                        .input('price', sql.Decimal(18, 2), defaultPrice)
                        .query('INSERT INTO Inventory (component_type, material, quantity, used_quantity, unit, price) VALUES (@type, @mat, 1500, 0, @unit, @price)');
                    addedCount++;
                }
            }
        }
        res.json({ message: 'Seeding completed', newItems: addedCount });
    } catch (err) {
        console.error('API Error (POST /api/inventory/seed-library):', err.message);
        res.status(500).json({ error: 'Seeding Failed', details: err.message });
    }
});

app.post('/api/inventory/use', async (req, res) => {
    let { component_type, material, amount } = req.body;

    // Map frontend types to database types if they differ
    const typeMap = {
        'straight': 'straight', 'vertical': 'vertical', 'elbow': 'elbow',
        'elbow-45': 'elbow-45', 't-joint': 't-joint', 'cross': 'cross',
        'reducer': 'reducer', 'flange': 'flange', 'union': 'union',
        'coupling': 'coupling', 'valve': 'valve', 'filter': 'filter',
        'tank': 'tank', 'cap': 'cap', 'plug': 'plug', 'water-tap': 'water-tap',
        'cylinder': 'cylinder', 'cube': 'cube', 'cone': 'cone',
        'industrial-tank': 'industrial-tank', 'wall': 'wall'
    };
    const dbType = typeMap[component_type] || component_type;

    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('type', sql.NVarChar, dbType)
            .input('material', sql.NVarChar, material)
            .input('amount', sql.Decimal(18, 2), amount)
            .query('UPDATE Inventory SET quantity = quantity - @amount, used_quantity = used_quantity + @amount, last_updated = GETDATE() WHERE component_type = @type AND material = @material');

        if (result.rowsAffected[0] === 0) {
            console.warn(`Inventory Warning: No match found for ${dbType} (${material})`);
            return res.status(404).json({ error: 'Item not found in inventory' });
        }

        console.log(`✅ Inventory Reduced: ${dbType} (${material}) by ${amount}`);
        res.json({ message: 'Inventory updated' });
    } catch (err) {
        console.error('API Error (/api/inventory/use):', err.message);
        res.status(500).json({ error: 'Failed to update inventory', details: err.message });
    }
});

// Batch inventory decrement - accepts array of { component_type, material, amount }
app.post('/api/inventory/use-batch', async (req, res) => {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'items must be a non-empty array' });
    }

    try {
        const pool = await getPool();
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            console.log(`[Inventory] Batch update received. Items: ${items.length}`);
            for (const item of items) {
                const { component_type, material, amount = 1 } = item;
                if (!component_type || !material) {
                    console.warn(`[Inventory] Skipping invalid item: type=${component_type}, mat=${material}`);
                    continue;
                }

                console.log(`[Inventory] Deducting: ${amount} units of ${component_type} (${material})`);

                const result = await new sql.Request(transaction)
                    .input('type', sql.NVarChar, component_type)
                    .input('material', sql.NVarChar, material)
                    .input('amount', sql.Decimal(18, 2), amount)
                    .query('UPDATE Inventory SET quantity = quantity - @amount, used_quantity = used_quantity + @amount, last_updated = GETDATE() WHERE LOWER(component_type) = LOWER(@type) AND LOWER(material) = LOWER(@material)');

                if (result.rowsAffected[0] === 0) {
                    console.warn(`[Inventory] UPDATE FAILED: No match in DB for type="${component_type}" material="${material}"`);
                }
            }
            await transaction.commit();
            console.log(`✅ Inventory Batch Reduced: ${items.length} items`);
            res.json({ message: `Batch updated ${items.length} inventory items` });
        } catch (txErr) {
            await transaction.rollback();
            throw txErr;
        }
    } catch (err) {
        console.error('API Error (/api/inventory/use-batch):', err.message);
        res.status(500).json({ error: 'Failed to update batch inventory', details: err.message });
    }
});

app.post('/api/inventory/reset', async (req, res) => {
    try {
        const pool = await getPool();

        // Ensure price column exists
        await pool.request().query("IF NOT EXISTS (SELECT * FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[Inventory]') AND name = 'price') ALTER TABLE [dbo].[Inventory] ADD [price] DECIMAL(18,2) DEFAULT 0;");

        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            // Clean slate
            await new sql.Request(transaction).query('DELETE FROM Inventory');

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

            const pipePrices = {
                pvc: 60, upvc: 70, cpvc: 85, ppr: 75, hdpe: 60, mdpe: 50,
                gi: 500, ms: 400, steel: 600, ss304: 350, ss316: 450,
                copper: 700, aluminium: 450, ci: 600, default: 100
            };

            const fittingPrices = {
                'elbow': 28, 'elbow-45': 22, 't-joint': 35, 'cross': 60,
                'reducer': 45, 'coupling': 22, 'union': 175, 'nipple': 155,
                'cap': 28, 'plug': 32, 'flange': 1600, 'valve': 1050, 
                'filter': 450, 'tank': 15000, 'water-tap': 450, 'default': 50
            };

            const materialMultipliers = {
                pvc: 1.0, upvc: 1.2, cpvc: 2.5, hdpe: 1.5,
                gi: 8.0, ms: 6.0, steel: 10.0, ss304: 15.0, ss316: 25.0,
                copper: 20.0, brass: 15.0, ci: 7.0, default: 2.0
            };

            for (const comp of components) {
                for (const mat of materials) {
                    const isPipe = ['straight', 'vertical', 'wall'].includes(comp);
                    const unit = isPipe ? 'm' : 'pcs';
                    const quantity = isPipe ? 10000 : 100;
                    
                    let price = isPipe ? (pipePrices[mat] || pipePrices.default) 
                                      : (fittingPrices[comp] || fittingPrices.default) * (materialMultipliers[mat] || materialMultipliers.default);

                    await new sql.Request(transaction)
                        .input('type', sql.NVarChar, comp)
                        .input('material', sql.NVarChar, mat)
                        .input('unit', sql.NVarChar, unit)
                        .input('quantity', sql.Decimal(18, 2), quantity)
                        .input('price', sql.Decimal(18, 2), price)
                        .query('INSERT INTO Inventory (component_type, material, quantity, used_quantity, unit, price) VALUES (@type, @material, @quantity, 0, @unit, @price)');
                }
            }
            await transaction.commit();
            res.json({ message: 'Inventory reset with Feb 2026 pricing.' });
        } catch (txErr) {
            await transaction.rollback();
            throw txErr;
        }
    } catch (err) {
        console.error('API Error (/api/inventory/reset):', err.message);
        res.status(500).json({ error: 'Reset Failed', details: err.message });
    }
});

// --- Configuration Registry Endpoints ---
app.get('/api/config', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query('SELECT category, item_key, item_value FROM SystemMasterData');
        
        // Group by category for easier frontend use
        const config = result.recordset.reduce((acc, row) => {
            if (!acc[row.category]) acc[row.category] = {};
            acc[row.category][row.item_key] = row.item_value;
            return acc;
        }, {});

        res.json(config);
    } catch (err) {
        console.error('API Error (/api/config):', err.message);
        res.status(500).json({ error: 'Failed to fetch config', details: err.message });
    }
});

app.post('/api/config/reset', async (req, res) => {
    try {
        const pool = await getPool();
        const transaction = new sql.Transaction(pool);
        await transaction.begin();

        try {
            await new sql.Request(transaction).query('DELETE FROM SystemMasterData');

            const naming = {
                'straight': 'P', 'vertical': 'P', 'elbow': 'E', 'elbow-45': 'E',
                't-joint': 'T', 'cross': 'C', 'reducer': 'R', 'flange': 'F',
                'union': 'U', 'coupling': 'K', 'valve': 'V', 'filter': 'S',
                'tank': 'TK', 'cap': 'X', 'plug': 'Z', 'water-tap': 'TAP',
                'cylinder': 'CYL', 'cube': 'BOX', 'cone': 'CN', 'industrial-tank': 'ITK',
                'wall': 'W'
            };

            const prices = {
                'pvc': '60', 'upvc': '70', 'cpvc': '85', 'ppr': '75', 'hdpe': '60', 'mdpe': '50',
                'gi': '500', 'ms': '400', 'steel': '600', 'ss304': '350', 'ss316': '450',
                'copper': '700', 'aluminium': '450', 'ci': '600'
            };

            const multipliers = {
                'pvc': '1.0', 'upvc': '1.2', 'cpvc': '2.5', 'hdpe': '1.5',
                'gi': '8.0', 'ms': '6.0', 'steel': '10.0', 'ss304': '15.0', 'ss316': '25.0',
                'copper': '20.0', 'brass': '15.0', 'ci': '7.0'
            };

            // Insert Naming Prefixes
            for (const [key, val] of Object.entries(naming)) {
                await new sql.Request(transaction)
                    .input('cat', sql.NVarChar, 'NamingPrefix')
                    .input('key', sql.NVarChar, key)
                    .input('val', sql.NVarChar, val)
                    .query('INSERT INTO SystemMasterData (category, item_key, item_value) VALUES (@cat, @key, @val)');
            }

            // Insert Pipe Prices
            for (const [key, val] of Object.entries(prices)) {
                await new sql.Request(transaction)
                    .input('cat', sql.NVarChar, 'PipePrice')
                    .input('key', sql.NVarChar, key)
                    .input('val', sql.NVarChar, val)
                    .query('INSERT INTO SystemMasterData (category, item_key, item_value) VALUES (@cat, @key, @val)');
            }

            // Insert Multipliers
            for (const [key, val] of Object.entries(multipliers)) {
                await new sql.Request(transaction)
                    .input('cat', sql.NVarChar, 'MaterialMultiplier')
                    .input('key', sql.NVarChar, key)
                    .input('val', sql.NVarChar, val)
                    .query('INSERT INTO SystemMasterData (category, item_key, item_value) VALUES (@cat, @key, @val)');
            }

            await transaction.commit();
            res.json({ message: 'System configuration reset successfully.' });
        } catch (txErr) {
            await transaction.rollback();
            throw txErr;
        }
    } catch (err) {
        console.error('API Error (/api/config/reset):', err.message);
        res.status(500).json({ error: 'Config Reset Failed', details: err.message });
    }
});
app.post('/api/projects', async (req, res) => {
    console.log(`[API] POST /api/projects - Name: ${req.body?.name}, Size: ${JSON.stringify(req.body).length} bytes`);
    let { user_id, name, components_json, bom_json, image_data } = req.body;

    // Ensure user_id is null or a valid integer for MSSQL INT column
    const parsedUserId = parseInt(user_id);
    user_id = isNaN(parsedUserId) ? null : parsedUserId;

    if (!name || !components_json || !bom_json) {
        return res.status(400).json({ error: 'Missing required project data' });
    }

    const safeImageData = (typeof image_data === 'string') ? image_data : '';

    try {
        const pool = await getPool();
        
        // --- DUPLICATE PREVENTION LOGIC ---
        // If a project with same name exists for this user, convert this POST to an UPDATE (PUT) logic
        const existing = await pool.request()
            .input('name', sql.NVarChar, name)
            .input('user_id', sql.Int, user_id)
            .query('SELECT id, image_data FROM Projects WHERE name = @name AND (user_id = @user_id OR (user_id IS NULL AND @user_id IS NULL))');

        if (existing.recordset.length > 0) {
            const existingId = existing.recordset[0].id;
            const existingImageData = existing.recordset[0].image_data;

            // Image Stability Guard: Only use new image_data if it looks like a valid 3D render (>10KB).
            // Otherwise, stick with whatever image we already have in history.
            if (!image_data || image_data.length < 15000) { // Assuming a "black" or empty image is small
                image_data = existingImageData || '';
            }
            
            console.log(`[Deduplicate] Converting POST to UPDATE for "${name}" (ID: ${existingId})`);
            await pool.request()
                .input('id', sql.Int, existingId)
                .input('name', sql.NVarChar, name)
                .input('components_json', sql.NVarChar(sql.MAX), components_json)
                .input('bom_json', sql.NVarChar(sql.MAX), bom_json)
                .input('image_data', sql.NVarChar(sql.MAX), image_data)
                .query(`
                    UPDATE Projects 
                    SET name = @name, components_json = @components_json, bom_json = @bom_json, image_data = @image_data 
                    WHERE id = @id
                `);
            const updatedResult = await pool.request()
                .input('id', sql.Int, existingId)
                .query('SELECT p.*, u.name as owner_name FROM Projects p LEFT JOIN Users u ON p.user_id = u.id WHERE p.id = @id');

            return res.json({ 
                ...updatedResult.recordset[0],
                message: 'Existing project updated',
                isUpdate: true
            });
        }

        // Cross-check if user_id exists to avoid FK conflict
        if (user_id) {
            const userCheck = await pool.request()
                .input('id', sql.Int, user_id)
                .query('SELECT id FROM Users WHERE id = @id');
            if (userCheck.recordset.length === 0) {
                console.warn(`[API] Save attempt with invalid user_id: ${user_id}. Falling back to null.`);
                user_id = null;
            }
        }

        const result = await pool.request()
            .input('user_id', sql.Int, user_id)
            .input('name', sql.NVarChar, name)
            .input('components_json', sql.NVarChar(sql.MAX), components_json)
            .input('bom_json', sql.NVarChar(sql.MAX), bom_json)
            .input('image_data', sql.NVarChar(sql.MAX), safeImageData)
            .query(`
                INSERT INTO Projects (user_id, name, components_json, bom_json, image_data)
                OUTPUT INSERTED.id
                VALUES (@user_id, @name, @components_json, @bom_json, @image_data)
            `);

        const newId = result.recordset[0].id;
        const freshProject = await pool.request()
            .input('id', sql.Int, newId)
            .query('SELECT p.*, u.name as owner_name FROM Projects p LEFT JOIN Users u ON p.user_id = u.id WHERE p.id = @id');

        res.status(201).json(freshProject.recordset[0]);
    } catch (err) {
        console.error('API Error (POST /api/projects):', err.message);
        res.status(500).json({ error: 'Failed to save project', details: err.message });
    }
});

app.get('/api/projects', async (req, res) => {
    try {
        const pool = await getPool();
        
        let query = `
            SELECT p.id, p.user_id, p.name, p.bom_json, p.created_at, p.image_data, p.is_favourite, u.name as owner_name
            FROM Projects p
            LEFT JOIN Users u ON p.user_id = u.id
            ORDER BY p.created_at DESC
        `;

        const result = await pool.request().query(query);
        res.json(result.recordset);
    } catch (err) {
        console.error('API Error (GET /api/projects):', err);
        res.status(500).json({ error: 'Failed to fetch projects', details: err.message });
    }
});

app.put('/api/projects/:id', async (req, res) => {
    let { name, components_json, bom_json, image_data } = req.body;
    const { id } = req.params;

    if (!name || !components_json || !bom_json) {
        return res.status(400).json({ error: 'Missing required project data' });
    }

    try {
        const pool = await getPool();
        await pool.request()
            .input('id', sql.Int, id)
            .input('name', sql.NVarChar, name)
            .input('components_json', sql.NVarChar(sql.MAX), components_json)
            .input('bom_json', sql.NVarChar(sql.MAX), bom_json)
            .input('image_data', sql.NVarChar(sql.MAX), (typeof image_data === 'string') ? image_data : '')
            .query(`
                UPDATE Projects
                SET name = @name,
                    components_json = @components_json,
                    bom_json = @bom_json,
                    image_data = @image_data,
                    created_at = GETDATE()
                WHERE id = @id
            `);

        res.json({ message: 'Project updated successfully' });
    } catch (err) {
        console.error('API Error (PUT /api/projects/:id):', err.message);
        res.status(500).json({ error: 'Failed to update project', details: err.message });
    }
});

app.patch('/api/projects/:id/favourite', async (req, res) => {
    const { id } = req.params;
    try {
        const pool = await getPool();
        // Toggle the BIT value (1 - current value, handling NULL)
        await pool.request()
            .input('id', sql.Int, id)
            .query('UPDATE Projects SET is_favourite = 1 - ISNULL(is_favourite, 0) WHERE id = @id');
        
        const result = await pool.request()
            .input('id', sql.Int, id)
            .query('SELECT is_favourite FROM Projects WHERE id = @id');
            
        res.json({ ok: true, is_favourite: result.recordset[0].is_favourite === 1 });
    } catch (err) {
        console.error('API Error (PATCH /api/projects/:id/favourite):', err.message);
        res.status(500).json({ error: 'Toggle Failed', details: err.message });
    }
});

app.patch('/api/projects/:id/rename', async (req, res) => {
    const { id } = req.params;
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });
    try {
        const pool = await getPool();
        await pool.request()
            .input('id', sql.Int, id)
            .input('name', sql.NVarChar, name)
            .query('UPDATE Projects SET name = @name WHERE id = @id');
        res.json({ ok: true, name });
    } catch (err) {
        console.error('API Error (PATCH /api/projects/:id/rename):', err.message);
        res.status(500).json({ error: 'Rename Failed', details: err.message });
    }
});

app.get('/api/projects/:id', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('SELECT * FROM Projects WHERE id = @id');

        if (result.recordset.length === 0) {
            return res.status(404).json({ error: 'Project not found' });
        }

        res.json(result.recordset[0]);
    } catch (err) {
        console.error('API Error (GET /api/projects/:id):', err.message);
        res.status(500).json({ error: 'Failed to fetch project', details: err.message });
    }
});

app.delete('/api/projects/:id', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query('DELETE FROM Projects WHERE id = @id');

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({ error: 'Project not found' });
        }

        res.json({ message: 'Project deleted successfully' });
    } catch (err) {
        console.error('API Error (DELETE /api/projects/:id):', err.message);
        res.status(500).json({ error: 'Failed to delete project', details: err.message });
    }
});

// --- Auth Endpoints ---
app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const pool = await getPool();
        const result = await pool.request()
            .input('email', sql.NVarChar, email)
            .query('SELECT * FROM Users WHERE email = @email');

        const user = result.recordset[0];
        if (user && user.password_hash === password) {
            const { password_hash, ...safeUser } = user;
            res.json(safeUser);
        } else {
            res.status(401).json({ error: 'Invalid credentials' });
        }
    } catch (err) {
        res.status(500).json({ error: 'Auth Service Down', details: err.message });
    }
});

app.post('/api/auth/signup', async (req, res) => {
    const { name, email, password, company } = req.body;
    try {
        const pool = await getPool();
        await pool.request()
            .input('name', sql.NVarChar, name)
            .input('email', sql.NVarChar, email)
            .input('password', sql.NVarChar, password)
            .input('company', sql.NVarChar, company)
            .query('INSERT INTO Users (name, email, password_hash, company) VALUES (@name, @email, @password, @company)');
        
        res.status(201).json({ message: 'User created' });
    } catch (err) {
        res.status(500).json({ error: 'Signup Failed', details: err.message });
    }
});

// ─────────────────────────────────────────
// Start Server — auto-connect and verify DB on boot
// ─────────────────────────────────────────
app.listen(PORT, '0.0.0.0', async () => {
    console.log(`🚀 Pipe3D PRO Server running on http://0.0.0.0:${PORT}`);
    await ensureTablesExist();
});