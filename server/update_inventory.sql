USE Pipe3DPro;
GO

-- TRUNCATE and SEED fresh to ensure 100 for ALL types
DELETE FROM [dbo].[Inventory];
GO

INSERT INTO [dbo].[Inventory] (component_type, material, quantity, unit)
VALUES 
('straight', 'pvc', 10000.0, 'm'),
('straight', 'upvc', 10000.0, 'm'),
('straight', 'cpvc', 10000.0, 'm'),
('vertical', 'pvc', 10000.0, 'm'),
('vertical', 'upvc', 10000.0, 'm'),
('vertical', 'cpvc', 10000.0, 'm'),
('elbow', 'pvc', 100, 'pcs'),
('elbow', 'upvc', 100, 'pcs'),
('elbow', 'cpvc', 100, 'pcs'),
('elbow-45', 'pvc', 100, 'pcs'),
('elbow-45', 'upvc', 100, 'pcs'),
('t-joint', 'pvc', 100, 'pcs'),
('t-joint', 'upvc', 100, 'pcs'),
('t-joint', 'cpvc', 100, 'pcs'),
('cross', 'pvc', 100, 'pcs'),
('cross', 'upvc', 100, 'pcs'),
('reducer', 'pvc', 100, 'pcs'),
('reducer', 'upvc', 100, 'pcs'),
('flange', 'pvc', 100, 'pcs'),
('union', 'pvc', 100, 'pcs'),
('coupling', 'pvc', 100, 'pcs'),
('valve', 'pvc', 100, 'pcs'),
('filter', 'pvc', 100, 'pcs'),
('tank', 'pvc', 100, 'pcs'),
('cap', 'pvc', 100, 'pcs'),
('plug', 'pvc', 100, 'pcs'),
('water-tap', 'brass', 100, 'pcs'),
('cylinder', 'pvc', 100, 'pcs'),
('cube', 'pvc', 100, 'pcs'),
('cone', 'pvc', 100, 'pcs'),
('industrial-tank', 'industrial_yellow', 100, 'pcs');
GO

-- Verification query
SELECT * FROM [dbo].[Inventory];
GO
