<?php
/**
 * PHP 5.3.10 Compatible Backend - Single Entry Point
 * All requests via: index.php?rtype=xxx&action=yyy&id=zzz
 * No Apache rewrite rules needed.
 */

error_reporting(E_ALL);
ini_set('display_errors', 0);
ini_set('log_errors', 1);

// Load libs
require_once dirname(__FILE__) . '/config.php';
require_once dirname(__FILE__) . '/lib/Database.php';
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

// Parse request body
$body = array();
$rawBody = file_get_contents('php://input');
if ($rawBody) {
    $decoded = json_decode($rawBody, true);
    if ($decoded !== null) {
        $body = $decoded;
    }
}

// Query params
$rtype  = isset($_GET['rtype'])  ? strtolower(trim($_GET['rtype']))  : '';
$action = isset($_GET['action']) ? strtolower(trim($_GET['action'])) : '';
$id     = isset($_GET['id'])     ? trim($_GET['id'])     : '';
$pid    = isset($_GET['pid'])    ? trim($_GET['pid'])    : '';  // parent id (project_id, model_id, etc.)

if (!$rtype) {
    Response::error('Missing rtype parameter', 400);
}

// ===== HANDLER DISPATCH =====

// Load handler files on demand
$handlerFiles = array(
    'health'   => 'health.php',
    'csrf'     => 'health.php',
    'auth'     => 'auth.php',
    'projects' => 'projects.php',
    'stb'      => 'stb.php',
    'builds'   => 'builds.php',
    'parser'   => 'parser.php',
    'features' => 'features.php',
);

$handlerFile = isset($handlerFiles[$rtype]) ? $handlerFiles[$rtype] : null;
if (!$handlerFile) {
    Response::error('Unknown rtype: ' . $rtype, 400);
}

require_once dirname(__FILE__) . '/handlers/' . $handlerFile;

// Build params array from query string
$params = array(
    'id'        => $id,
    'pid'       => $pid,
    'projectId' => $pid ? $pid : (isset($_GET['projectId']) ? $_GET['projectId'] : ''),
    'modelId'   => isset($_GET['modelId']) ? $_GET['modelId'] : $pid,
    'buildId'   => isset($_GET['buildId']) ? $_GET['buildId'] : '',
    'module'    => isset($_GET['module'])  ? $_GET['module']  : '',
);

// ===== ROUTE TABLE =====
// Format: rtype => array( action => handler_function )

switch ($rtype) {

    // ----- Health -----
    case 'health':
        health_check($params, $body);
        break;

    // ----- CSRF -----
    case 'csrf':
        if ($action === 'token' || $action === 'generate') {
            csrf_token($params, $body);
        } elseif ($action === 'verify') {
            $token = isset($body['token']) ? $body['token'] : (isset($_GET['token']) ? $_GET['token'] : '');
            $valid = Security::validateCsrfToken($token);
            Response::success(array('valid' => $valid));
        } else {
            csrf_token($params, $body);
        }
        break;

    // ----- Auth -----
    case 'auth':
        switch ($action) {
            case 'login':    auth_login($params, $body);    break;
            case 'register': auth_register($params, $body); break;
            case 'logout':   auth_logout($params, $body);   break;
            case 'me':       auth_me($params, $body);       break;
            default:         Response::error('Unknown auth action: ' . $action, 400);
        }
        break;

    // ----- Projects -----
    case 'projects':
        switch ($action) {
            case 'list':   projects_list($params, $body);   break;
            case 'get':    projects_get($params, $body);    break;
            case 'create': projects_create($params, $body); break;
            case 'update': projects_update($params, $body); break;
            case 'delete': projects_delete($params, $body); break;
            default:       Response::error('Unknown projects action: ' . $action, 400);
        }
        break;

    // ----- STB Models -----
    case 'stb':
        switch ($action) {
            case 'create': stb_models_create($params, $body); break;
            case 'update': stb_models_update($params, $body); break;
            case 'delete': stb_models_delete($params, $body); break;
            default:       Response::error('Unknown stb action: ' . $action, 400);
        }
        break;

    // ----- Builds -----
    case 'builds':
        switch ($action) {
            case 'create': builds_create($params, $body); break;
            case 'update': builds_update($params, $body); break;
            case 'delete': builds_delete($params, $body); break;
            default:       Response::error('Unknown builds action: ' . $action, 400);
        }
        break;

    // ----- Parser -----
    case 'parser':
        switch ($action) {
            case 'seed':           parser_seed($params, $body);           break;
            case 'sessions':
            case 'sessions_list':  parser_sessions_list($params, $body);  break;
            case 'session_get':    parser_sessions_get($params, $body);   break;
            case 'session_delete': parser_sessions_delete($params, $body); break;
            default:               Response::error('Unknown parser action: ' . $action, 400);
        }
        break;

    // ----- Features -----
    case 'features':
        switch ($action) {
            case 'list':   features_list($params, $body);   break;
            case 'create': features_create($params, $body); break;
            case 'update': features_update($params, $body); break;
            case 'delete': features_delete($params, $body); break;
            default:       Response::error('Unknown features action: ' . $action, 400);
        }
        break;

    default:
        Response::error('Unknown rtype: ' . $rtype, 400);
}
