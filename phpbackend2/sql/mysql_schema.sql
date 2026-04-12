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
    total_env_vars INT DEFAULT 0,
    total_toolset_vars INT DEFAULT 0,
    project_id VARCHAR(36) DEFAULT '',
    build_id VARCHAR(36) DEFAULT '',
    module_id VARCHAR(100) DEFAULT '',
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
    file_type INT DEFAULT 0,
    file_type_key VARCHAR(20) DEFAULT '',
    input_line_count INT DEFAULT 0,
    used_line_count INT DEFAULT 0,
    empty_comment_line_count INT DEFAULT 0,
    multi_line_count INT DEFAULT 0,
    max_line_length INT DEFAULT 0,
    min_line_length INT DEFAULT 0,
    max_line_ref VARCHAR(500),
    min_line_ref VARCHAR(500),
    start_ts DECIMAL(20,10) DEFAULT 0,
    end_ts DECIMAL(20,10) DEFAULT 0,
    time_delta DECIMAL(20,10) DEFAULT 0,
    cond_if INT DEFAULT 0,
    cond_elif INT DEFAULT 0,
    cond_else INT DEFAULT 0,
    cond_endif INT DEFAULT 0,
    cond_nest_block INT DEFAULT 0,
    assign_direct INT DEFAULT 0,
    assign_rhs INT DEFAULT 0,
    def_var_count INT DEFAULT 0,
    def_hit_count INT DEFAULT 0,
    undef_hit_count INT DEFAULT 0,
    ctl_def_hit_count INT DEFAULT 0,
    macro_hit_count INT DEFAULT 0,
    comp_opt_def INT DEFAULT 0,
    comp_opt_inc INT DEFAULT 0,
    source_module VARCHAR(100),
    source_path_prefix VARCHAR(500),
    FOREIGN KEY (session_id) REFERENCES parser_sessions(id) ON DELETE CASCADE,
    INDEX idx_session (session_id),
    INDEX idx_module (source_module)
) ENGINE=InnoDB;

-- Parser Included Files (MOFP.IncFiles and CSHFP.IncFiles)
CREATE TABLE IF NOT EXISTS parser_included_files (
    id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(36) NOT NULL,
    include_type VARCHAR(20) NOT NULL DEFAULT 'MOFP',
    include_file_name VARCHAR(255),
    source_line_ref VARCHAR(500),
    source_module VARCHAR(100),
    source_file_name VARCHAR(500),
    source_line_number INT,
    FOREIGN KEY (session_id) REFERENCES parser_sessions(id) ON DELETE CASCADE,
    INDEX idx_session (session_id),
    INDEX idx_type (include_type)
) ENGINE=InnoDB;

-- Parser Define Vars
CREATE TABLE IF NOT EXISTS parser_define_vars (
    id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(36) NOT NULL,
    var_name VARCHAR(255),
    first_hit_src VARCHAR(100),
    first_hit_var_type VARCHAR(50),
    first_hit_var_scope VARCHAR(100),
    first_hit_val_prop VARCHAR(50),
    first_hit_src_scope VARCHAR(100),
    first_hit_slnr VARCHAR(500),
    first_hit_flags INT DEFAULT 0,
    last_hit_slnr VARCHAR(500),
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

-- Parser Define Var Relations (parent/sibling/child/ref/env_parent/env_sibling)
CREATE TABLE IF NOT EXISTS parser_define_var_relations (
    id VARCHAR(36) PRIMARY KEY,
    define_var_id VARCHAR(36) NOT NULL,
    relation_type VARCHAR(20) NOT NULL,
    related_var_name VARCHAR(255) NOT NULL,
    FOREIGN KEY (define_var_id) REFERENCES parser_define_vars(id) ON DELETE CASCADE,
    INDEX idx_var (define_var_id),
    INDEX idx_type (relation_type)
) ENGINE=InnoDB;

-- Parser Define Var Hits
CREATE TABLE IF NOT EXISTS parser_define_var_hits (
    id VARCHAR(36) PRIMARY KEY,
    define_var_id VARCHAR(36) NOT NULL,
    hit_src VARCHAR(100),
    var_type VARCHAR(50),
    var_scope VARCHAR(100),
    val_prop VARCHAR(50),
    hit_mode VARCHAR(50),
    hit_flags INT DEFAULT 0,
    depth INT DEFAULT 0,
    hit_slnr VARCHAR(500),
    hit_src_scope VARCHAR(100),
    cond_ord_depth INT,
    cond_ord_dir VARCHAR(50),
    cond_ord_slnr VARCHAR(500),
    source_file_name VARCHAR(500),
    source_line_number INT,
    source_module VARCHAR(100),
    FOREIGN KEY (define_var_id) REFERENCES parser_define_vars(id) ON DELETE CASCADE,
    INDEX idx_var (define_var_id)
) ENGINE=InnoDB;

-- Parser Define Var Values
CREATE TABLE IF NOT EXISTS parser_define_var_values (
    id VARCHAR(36) PRIMARY KEY,
    define_var_id VARCHAR(36) NOT NULL,
    value_key VARCHAR(500),
    value_items LONGTEXT,
    FOREIGN KEY (define_var_id) REFERENCES parser_define_vars(id) ON DELETE CASCADE,
    INDEX idx_var (define_var_id)
) ENGINE=InnoDB;

-- Parser Environment Variables (EnvVars) - same structure as DefineVars
CREATE TABLE IF NOT EXISTS parser_env_vars (
    id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(36) NOT NULL,
    var_name VARCHAR(255),
    first_hit_src VARCHAR(100),
    first_hit_var_type VARCHAR(50),
    first_hit_var_scope VARCHAR(100),
    first_hit_val_prop VARCHAR(50),
    first_hit_slnr VARCHAR(500),
    last_hit_slnr VARCHAR(500),
    cond_ord_depth INT,
    cond_ord_dir VARCHAR(50),
    cond_ord_slnr VARCHAR(500),
    source_module VARCHAR(100),
    source_file_name VARCHAR(500),
    source_line_number INT,
    FOREIGN KEY (session_id) REFERENCES parser_sessions(id) ON DELETE CASCADE,
    INDEX idx_session (session_id),
    INDEX idx_var_name (var_name)
) ENGINE=InnoDB;

-- Parser Env Var Relations
CREATE TABLE IF NOT EXISTS parser_env_var_relations (
    id VARCHAR(36) PRIMARY KEY,
    env_var_id VARCHAR(36) NOT NULL,
    relation_type VARCHAR(20) NOT NULL,
    related_var_name VARCHAR(255) NOT NULL,
    FOREIGN KEY (env_var_id) REFERENCES parser_env_vars(id) ON DELETE CASCADE,
    INDEX idx_var (env_var_id)
) ENGINE=InnoDB;

-- Parser Env Var Hits
CREATE TABLE IF NOT EXISTS parser_env_var_hits (
    id VARCHAR(36) PRIMARY KEY,
    env_var_id VARCHAR(36) NOT NULL,
    hit_src VARCHAR(100),
    var_type VARCHAR(50),
    var_scope VARCHAR(100),
    val_prop VARCHAR(50),
    hit_slnr VARCHAR(500),
    cond_ord_depth INT,
    cond_ord_dir VARCHAR(50),
    cond_ord_slnr VARCHAR(500),
    source_file_name VARCHAR(500),
    source_line_number INT,
    source_module VARCHAR(100),
    FOREIGN KEY (env_var_id) REFERENCES parser_env_vars(id) ON DELETE CASCADE,
    INDEX idx_var (env_var_id)
) ENGINE=InnoDB;

-- Parser Env Var Values
CREATE TABLE IF NOT EXISTS parser_env_var_values (
    id VARCHAR(36) PRIMARY KEY,
    env_var_id VARCHAR(36) NOT NULL,
    value_key VARCHAR(500),
    value_items LONGTEXT,
    FOREIGN KEY (env_var_id) REFERENCES parser_env_vars(id) ON DELETE CASCADE,
    INDEX idx_var (env_var_id)
) ENGINE=InnoDB;

-- Parser Toolset Variables (ToolsetVars - CFLAGS etc.)
CREATE TABLE IF NOT EXISTS parser_toolset_vars (
    id VARCHAR(36) PRIMARY KEY,
    session_id VARCHAR(36) NOT NULL,
    toolset_name VARCHAR(100) NOT NULL,
    src_line_ref VARCHAR(500),
    source_module VARCHAR(100),
    FOREIGN KEY (session_id) REFERENCES parser_sessions(id) ON DELETE CASCADE,
    INDEX idx_session (session_id)
) ENGINE=InnoDB;

-- Parser Toolset Switch Options (SWOpt entries: -I, -D, -O, -W, etc.)
CREATE TABLE IF NOT EXISTS parser_toolset_switch_opts (
    id VARCHAR(36) PRIMARY KEY,
    toolset_var_id VARCHAR(36) NOT NULL,
    switch_key VARCHAR(20) NOT NULL,
    opt_name VARCHAR(500) NOT NULL,
    opt_source VARCHAR(100),
    opt_value VARCHAR(500),
    opt_line_ref VARCHAR(500),
    FOREIGN KEY (toolset_var_id) REFERENCES parser_toolset_vars(id) ON DELETE CASCADE,
    INDEX idx_toolset (toolset_var_id),
    INDEX idx_switch (switch_key)
) ENGINE=InnoDB;

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

-- Projects
CREATE TABLE IF NOT EXISTS projects (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    status VARCHAR(20) DEFAULT 'active',
    user_id VARCHAR(36),
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL,
    INDEX idx_user (user_id)
) ENGINE=InnoDB;

-- STB Models
CREATE TABLE IF NOT EXISTS stb_models (
    id VARCHAR(36) PRIMARY KEY,
    project_id VARCHAR(36) NOT NULL,
    name VARCHAR(200) NOT NULL,
    chipset VARCHAR(100),
    description TEXT,
    created_at DATETIME NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
    INDEX idx_project (project_id)
) ENGINE=InnoDB;

-- Builds
CREATE TABLE IF NOT EXISTS builds (
    id VARCHAR(36) PRIMARY KEY,
    stb_model_id VARCHAR(36) NOT NULL,
    name VARCHAR(200) NOT NULL,
    version VARCHAR(50),
    status VARCHAR(20) DEFAULT 'draft',
    created_at DATETIME NOT NULL,
    FOREIGN KEY (stb_model_id) REFERENCES stb_models(id) ON DELETE CASCADE,
    INDEX idx_model (stb_model_id)
) ENGINE=InnoDB;

-- Features
CREATE TABLE IF NOT EXISTS features (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    status VARCHAR(20) DEFAULT 'active',
    created_at DATETIME NOT NULL,
    updated_at DATETIME NOT NULL
) ENGINE=InnoDB;
