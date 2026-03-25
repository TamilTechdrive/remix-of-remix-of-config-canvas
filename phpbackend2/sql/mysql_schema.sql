-- MySQL 5.x Compatible Schema
-- Run this to set up the MySQL database

CREATE DATABASE IF NOT EXISTS configflow CHARACTER SET utf8 COLLATE utf8_general_ci;
USE configflow;

-- Users
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    username VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(200),
    password_hash VARCHAR(500) NOT NULL,
    is_active TINYINT(1) DEFAULT 1,
    failed_login_attempts INT DEFAULT 0,
    locked_until DATETIME NULL,
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    INDEX idx_email (email),
    INDEX idx_username (username)
) ENGINE=InnoDB;

-- User Roles
CREATE TABLE IF NOT EXISTS user_roles (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    UNIQUE KEY unique_user_role (user_id, role),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(36),
    event VARCHAR(100),
    resource VARCHAR(100),
    ip_address VARCHAR(45),
    details TEXT,
    created_at DATETIME NOT NULL,
    INDEX idx_user (user_id),
    INDEX idx_event (event)
) ENGINE=InnoDB;

-- Parser Sessions
CREATE TABLE IF NOT EXISTS parser_sessions (
    id VARCHAR(36) PRIMARY KEY,
    user_id VARCHAR(36) NOT NULL,
    session_name VARCHAR(200),
    source_file_name VARCHAR(500),
    total_processed_files INT DEFAULT 0,
    total_included_files INT DEFAULT 0,
    total_define_vars INT DEFAULT 0,
    created_at DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_user (user_id)
) ENGINE=InnoDB;

-- Parser Processed Files
CREATE TABLE IF NOT EXISTS parser_processed_files (
    id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(36) NOT NULL,
    file_name VARCHAR(255),
    file_name_full VARCHAR(500),
    file_type VARCHAR(20),
    input_line_count INT DEFAULT 0,
    cond_if INT DEFAULT 0,
    cond_else INT DEFAULT 0,
    cond_endif INT DEFAULT 0,
    cond_nest_block INT DEFAULT 0,
    def_hit_count INT DEFAULT 0,
    macro_hit_count INT DEFAULT 0,
    time_delta DECIMAL(10,6) DEFAULT 0,
    source_module VARCHAR(100),
    source_path_prefix VARCHAR(500),
    FOREIGN KEY (session_id) REFERENCES parser_sessions(id) ON DELETE CASCADE,
    INDEX idx_session (session_id),
    INDEX idx_module (source_module)
) ENGINE=InnoDB;

-- Parser Included Files
CREATE TABLE IF NOT EXISTS parser_included_files (
    id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(36) NOT NULL,
    include_file_name VARCHAR(255),
    source_line_ref VARCHAR(500),
    source_module VARCHAR(100),
    source_file_name VARCHAR(500),
    source_line_number INT,
    FOREIGN KEY (session_id) REFERENCES parser_sessions(id) ON DELETE CASCADE,
    INDEX idx_session (session_id)
) ENGINE=InnoDB;

-- Parser Define Vars
CREATE TABLE IF NOT EXISTS parser_define_vars (
    id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(36) NOT NULL,
    var_name VARCHAR(255),
    first_hit_var_type VARCHAR(50),
    first_hit_src_scope VARCHAR(100),
    first_hit_slnr VARCHAR(500),
    cond_ord_depth INT,
    cond_ord_dir VARCHAR(50),
    cond_ord_slnr VARCHAR(500),
    source_module VARCHAR(100),
    source_file_name VARCHAR(500),
    source_line_number INT,
    diagnostic_level VARCHAR(20) DEFAULT 'info',
    diagnostic_message TEXT,
    FOREIGN KEY (session_id) REFERENCES parser_sessions(id) ON DELETE CASCADE,
    INDEX idx_session (session_id),
    INDEX idx_module (source_module),
    INDEX idx_diag (diagnostic_level)
) ENGINE=InnoDB;

-- Parser Define Var Relations (parent/sibling/child)
CREATE TABLE IF NOT EXISTS parser_define_var_relations (
    id VARCHAR(36) PRIMARY KEY,
    define_var_id VARCHAR(36) NOT NULL,
    relation_type VARCHAR(20) NOT NULL,
    related_var_name VARCHAR(255) NOT NULL,
    FOREIGN KEY (define_var_id) REFERENCES parser_define_vars(id) ON DELETE CASCADE,
    INDEX idx_var (define_var_id)
) ENGINE=InnoDB;

-- Parser Define Var Hits
CREATE TABLE IF NOT EXISTS parser_define_var_hits (
    id VARCHAR(36) PRIMARY KEY,
    define_var_id VARCHAR(36) NOT NULL,
    var_type VARCHAR(50),
    hit_mode VARCHAR(50),
    depth INT DEFAULT 0,
    hit_slnr VARCHAR(500),
    hit_src_scope VARCHAR(100),
    source_file_name VARCHAR(500),
    source_line_number INT,
    source_module VARCHAR(100),
    FOREIGN KEY (define_var_id) REFERENCES parser_define_vars(id) ON DELETE CASCADE,
    INDEX idx_var (define_var_id)
) ENGINE=InnoDB;

-- Parser Sessions - add project/build/module columns
-- ALTER TABLE parser_sessions ADD COLUMN project_id VARCHAR(36) DEFAULT '';
-- ALTER TABLE parser_sessions ADD COLUMN build_id VARCHAR(36) DEFAULT '';
-- ALTER TABLE parser_sessions ADD COLUMN module_id VARCHAR(100) DEFAULT '';

-- Configurations
CREATE TABLE IF NOT EXISTS configurations (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    config_data LONGTEXT,
    status VARCHAR(20) DEFAULT 'draft',
    user_id VARCHAR(36),
    build_id VARCHAR(36),
    parser_session_id VARCHAR(36),
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    INDEX idx_user (user_id),
    INDEX idx_build (build_id)
) ENGINE=InnoDB;

-- Config Nodes
CREATE TABLE IF NOT EXISTS config_nodes (
    id VARCHAR(36) PRIMARY KEY,
    config_id VARCHAR(36) NOT NULL,
    node_type VARCHAR(50),
    label VARCHAR(255),
    position_x DECIMAL(10,2) DEFAULT 0,
    position_y DECIMAL(10,2) DEFAULT 0,
    properties LONGTEXT,
    created_at DATETIME NOT NULL,
    FOREIGN KEY (config_id) REFERENCES configurations(id) ON DELETE CASCADE,
    INDEX idx_config (config_id)
) ENGINE=InnoDB;

-- Config Edges
CREATE TABLE IF NOT EXISTS config_edges (
    id VARCHAR(36) PRIMARY KEY,
    config_id VARCHAR(36) NOT NULL,
    source_id VARCHAR(36),
    target_id VARCHAR(36),
    edge_type VARCHAR(50) DEFAULT 'default',
    label VARCHAR(255),
    created_at DATETIME NOT NULL,
    FOREIGN KEY (config_id) REFERENCES configurations(id) ON DELETE CASCADE,
    INDEX idx_config (config_id)
) ENGINE=InnoDB;

-- Config Snapshots
CREATE TABLE IF NOT EXISTS config_snapshots (
    id VARCHAR(36) PRIMARY KEY,
    config_id VARCHAR(36) NOT NULL,
    name VARCHAR(200),
    description TEXT,
    snapshot_data LONGTEXT,
    created_at DATETIME NOT NULL,
    FOREIGN KEY (config_id) REFERENCES configurations(id) ON DELETE CASCADE,
    INDEX idx_config (config_id)
) ENGINE=InnoDB;
