<?php
/**
 * PHP 5.3.10 Compatible Backend - Main Entry Point
 * No composer, no modern extensions required.
 * ODBC + MSSQL 2008 + MySQL dual connection support.
 */

error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// Load config
require_once dirname(__FILE__) . '/config.php';
require_once dirname(__FILE__) . '/lib/Database.php';
require_once dirname(__FILE__) . '/lib/Router.php';
require_once dirname(__FILE__) . '/lib/Response.php';
require_once dirname(__FILE__) . '/lib/Auth.php';
require_once dirname(__FILE__) . '/lib/Security.php';

// Security headers
Security::setHeaders();

// CORS handling
$origin = isset($_SERVER['HTTP_ORIGIN']) ? $_SERVER['HTTP_ORIGIN'] : '';
if (in_array($origin, $GLOBALS['CONFIG']['allowed_origins'])) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-CSRF-Token, X-Device-Fingerprint');
}

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// Parse request
$method = $_SERVER['REQUEST_METHOD'];
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$basePath = $GLOBALS['CONFIG']['base_path'];
$path = substr($uri, strlen($basePath));
if ($path === false) $path = '/';

// Get request body
$body = array();
$rawBody = file_get_contents('php://input');
if ($rawBody) {
    $decoded = json_decode($rawBody, true);
    if ($decoded !== null) {
        $body = $decoded;
    }
}

// Initialize router
$router = new Router();

// ===== ROUTES =====

// Health check
$router->get('/health', 'health_check');

// CSRF token endpoint
$router->get('/api/csrf-token', 'csrf_token');

// Auth routes
$router->post('/api/auth/login', 'auth_login');
$router->post('/api/auth/register', 'auth_register');
$router->post('/api/auth/logout', 'auth_logout');
$router->get('/api/auth/me', 'auth_me');

// Project routes
$router->get('/api/projects', 'projects_list');
$router->get('/api/projects/:id', 'projects_get');
$router->post('/api/projects', 'projects_create');
$router->put('/api/projects/:id', 'projects_update');
$router->delete('/api/projects/:id', 'projects_delete');

// STB Model routes
$router->post('/api/projects/:projectId/stb-models', 'stb_models_create');
$router->put('/api/projects/stb-models/:id', 'stb_models_update');
$router->delete('/api/projects/stb-models/:id', 'stb_models_delete');

// Build routes
$router->post('/api/projects/stb-models/:modelId/builds', 'builds_create');
$router->put('/api/projects/builds/:id', 'builds_update');
$router->delete('/api/projects/builds/:id', 'builds_delete');

// Parser routes
$router->post('/api/parser/seed', 'parser_seed');
$router->get('/api/parser/sessions', 'parser_sessions_list');
$router->get('/api/parser/sessions/:id', 'parser_sessions_get');
$router->delete('/api/parser/sessions/:id', 'parser_sessions_delete');

// Features table
$router->get('/api/features', 'features_list');
$router->post('/api/features', 'features_create');
$router->put('/api/features/:id', 'features_update');
$router->delete('/api/features/:id', 'features_delete');

// Dispatch
$router->dispatch($method, $path, $body);
