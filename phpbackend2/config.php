<?php
/**
 * Configuration - PHP 5.3.10 compatible
 * Edit these values for your environment.
 */

$GLOBALS['CONFIG'] = array(
    // Base URL path (if hosted in subfolder, e.g., '/phpbackend2')
    'base_path' => '/phpbackend2',

    // CORS allowed origins
    'allowed_origins' => array(
        'http://localhost:5173',
        'http://localhost:3000',
        'http://localhost:8080',
    ),

    // JWT secret (change in production!)
    'jwt_secret' => 'your-secret-key-change-this-in-production-2026',
    'jwt_expiry' => 3600, // 1 hour

    // Security features toggle (disable if PHP version doesn't support)
    'security' => array(
        'csrf_enabled' => true,
        'rate_limiting_enabled' => false, // requires APCu or file-based, disable if not available
        'password_hash_algo' => 'sha256', // PHP 5.3 doesn't have password_hash, use sha256+salt
        'session_timeout' => 3600,
        'max_login_attempts' => 5,
        'lockout_duration' => 900, // 15 minutes
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

    // MSSQL via ODBC connection (for projects/builds/teams)
    'mssql' => array(
        'enabled' => true,
        'dsn' => 'Driver={SQL Server};Server=localhost;Database=configflow_projects;',
        'username' => 'sa',
        'password' => '',
    ),

    // Which DB to use for which data
    'db_mapping' => array(
        'projects' => 'mssql',    // projects, stb_models, builds stored in MSSQL
        'builds' => 'mssql',
        'stb_models' => 'mssql',
        'features' => 'mssql',
        'users' => 'mysql',       // users, auth in MySQL
        'parser' => 'mysql',      // parser data in MySQL
        'configurations' => 'mysql',
    ),
);
