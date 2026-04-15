USE master;
GO

-- Create database if it doesn't exist
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'Pipe3DPro')
BEGIN
    CREATE DATABASE Pipe3DPro;
END
GO

USE Pipe3DPro;
GO

-- Create Inventory table if it doesn't exist
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Inventory]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[Inventory] (
        [id] INT IDENTITY(1,1) PRIMARY KEY,
        [component_type] NVARCHAR(100) NOT NULL,
        [material] NVARCHAR(100) NOT NULL,
        [quantity] DECIMAL(18, 2) DEFAULT 0,
        [unit] NVARCHAR(20) DEFAULT 'pcs',
        [last_updated] DATETIME DEFAULT GETDATE()
    );

    -- Seed initial data
    INSERT INTO [dbo].[Inventory] (component_type, material, quantity, unit)
    VALUES 
    ('straight', 'upvc', 150.5, 'm'),
    ('straight', 'cpvc', 85.0, 'm'),
    ('straight', 'pvc', 200.0, 'm'),
    ('elbow', 'upvc', 50, 'pcs'),
    ('elbow', 'cpvc', 30, 'pcs'),
    ('elbow', 'pvc', 100, 'pcs'),
    ('t-joint', 'upvc', 25, 'pcs'),
    ('t-joint', 'cpvc', 15, 'pcs'),
    ('coupling', 'upvc', 100, 'pcs'),
    ('coupling', 'cpvc', 75, 'pcs'),
    ('tank', 'pvc', 10, 'pcs'),
    ('industrial-tank', 'industrial_yellow', 5, 'pcs');
END
GO

-- Create Users table for Auth if it doesn't exist
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Users]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[Users] (
        [id] INT IDENTITY(1,1) PRIMARY KEY,
        [name] NVARCHAR(100) NOT NULL,
        [email] NVARCHAR(255) UNIQUE NOT NULL,
        [password_hash] NVARCHAR(MAX) NOT NULL,
        [company] NVARCHAR(100),
        [created_at] DATETIME DEFAULT GETDATE()
    );

    -- Seed a default user (password: admin123)
    INSERT INTO [dbo].[Users] (name, email, password_hash, company)
    VALUES ('Admin', 'admin@pipe3d.pro', 'admin123', 'Pipe3D Solutions');
END
GO

-- Create Projects table for saving designs (history)
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
END
GO
