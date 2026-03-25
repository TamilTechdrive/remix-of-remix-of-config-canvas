<?php
/**
 * Configuration - PHP 5.3.10 compatible
 * Edit these values for your environment.
 */

$GLOBALS['CONFIG'] = array(
    // Base URL path (kept for reference)
    'base_path' => '/phpbackend2',

    // CORS allowed origins
    'allowed_origins' => array(
        'http://localhost:5173',
        'http://localhost:3000',
        'http://localhost:8080',
        'https://id-preview--f0b79d3a-e8ee-427b-b894-2489e7b67dce.lovable.app',
    ),

    // JWT secret (change in production!)
    'jwt_secret' => 'your-secret-key-change-this-in-production-2026',
    'jwt_expiry' => 3600, // 1 hour

    // ===== SECURITY TOGGLE =====
    // Set to false to disable all auth checks (JWT, CSRF, rate limiting)
    'security_enabled' => true,

    // Security sub-features (only apply when security_enabled = true)
    'security' => array(
        'csrf_enabled' => false,
        'rate_limiting_enabled' => false,
        'password_hash_algo' => 'sha256',
        'session_timeout' => 3600,
        'max_login_attempts' => 5,
        'lockout_duration' => 900,
    ),

    // MySQL connection
    'mysql' => array(
        'host' => 'localhost',
        'port' => 3306,
        'database' => 'configflow',
        'username' => 'root',
        'password' => '',
        'charset' => 'utf8',
    ),

    // MSSQL via ODBC connection
    'mssql' => array(
        'enabled' => true,
        'dsn' => 'Driver={SQL Server};Server=localhost;Database=configflow_projects;',
        'username' => 'sa',
        'password' => '',
    ),

    // Which DB to use for which data
    'db_mapping' => array(
        'projects' => 'mssql',
        'builds' => 'mssql',
        'stb_models' => 'mssql',
        'features' => 'mssql',
        'users' => 'mysql',
        'parser' => 'mysql',
        'configurations' => 'mysql',
        'config_nodes' => 'mysql',
        'config_snapshots' => 'mysql',
        'audit_logs' => 'mysql',
        'user_roles' => 'mysql',
    ),
);
