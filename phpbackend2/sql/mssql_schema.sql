-- MSSQL 2008 Compatible Schema
-- Run this on SQL Server for projects/builds/teams/features

-- Projects
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='projects' AND xtype='U')
CREATE TABLE projects (
    id VARCHAR(36) PRIMARY KEY,
    name NVARCHAR(200) NOT NULL,
    description NVARCHAR(MAX) NULL,
    status VARCHAR(20) DEFAULT 'active',
    owner_id VARCHAR(36) NOT NULL,
    tags NVARCHAR(MAX) DEFAULT '[]',
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE()
);
GO

CREATE INDEX idx_projects_owner ON projects(owner_id, status);
GO

-- STB Models
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='stb_models' AND xtype='U')
CREATE TABLE stb_models (
    id VARCHAR(36) PRIMARY KEY,
    project_id VARCHAR(36) NOT NULL,
    name NVARCHAR(200) NOT NULL,
    description NVARCHAR(MAX) NULL,
    chipset VARCHAR(100) NULL,
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);
GO

CREATE INDEX idx_stb_project ON stb_models(project_id);
GO

-- Builds
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='builds' AND xtype='U')
CREATE TABLE builds (
    id VARCHAR(36) PRIMARY KEY,
    stb_model_id VARCHAR(36) NOT NULL,
    name NVARCHAR(200) NOT NULL,
    version VARCHAR(50) DEFAULT 'v1.0.0',
    description NVARCHAR(MAX) NULL,
    status VARCHAR(20) DEFAULT 'draft',
    parent_build_id VARCHAR(36) NULL,
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE(),
    FOREIGN KEY (stb_model_id) REFERENCES stb_models(id) ON DELETE CASCADE
);
GO

CREATE INDEX idx_builds_model ON builds(stb_model_id, status);
GO

-- Features table (per project/build/module)
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='features' AND xtype='U')
CREATE TABLE features (
    id VARCHAR(36) PRIMARY KEY,
    project_id VARCHAR(36) NULL,
    build_id VARCHAR(36) NULL,
    module VARCHAR(100) NULL,
    name NVARCHAR(200) NOT NULL,
    enabled BIT DEFAULT 1,
    details NVARCHAR(MAX) DEFAULT '{}',
    created_at DATETIME DEFAULT GETDATE(),
    updated_at DATETIME DEFAULT GETDATE()
);
GO

CREATE INDEX idx_features_project ON features(project_id);
CREATE INDEX idx_features_build ON features(build_id);
CREATE INDEX idx_features_module ON features(module);
GO
