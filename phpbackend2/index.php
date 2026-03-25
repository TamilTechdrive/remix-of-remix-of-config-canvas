<?php
/**
 * PHP 5.3.10 Compatible Backend - Single Entry Point
 * All requests via: index.php?rtype=xxx&action=yyy&id=zzz
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

// Security headers (only if enabled)
if (!empty($GLOBALS['CONFIG']['security_enabled'])) {
    Security::setHeaders();
}

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
$pid    = isset($_GET['pid'])    ? trim($_GET['pid'])    : '';
$sid    = isset($_GET['sid'])    ? trim($_GET['sid'])    : '';  // snapshot id etc.

if (!$rtype) {
    Response::success(array(
        'status' => 'ok',
        'message' => 'PHP Backend API',
        'version' => '1.0',
        'security_enabled' => !empty($GLOBALS['CONFIG']['security_enabled']),
    ));
}

// ===== HANDLER DISPATCH =====
$handlerFiles = array(
    'health'          => 'health.php',
    'auth'            => 'auth.php',
    'projects'        => 'projects.php',
    'stb'             => 'stb.php',
    'builds'          => 'builds.php',
    'parser'          => 'parser.php',
    'features'        => 'features.php',
    'configurations'  => 'configurations.php',
    'config_data'     => 'config_data.php',
    'users'           => 'users.php',
    'audit'           => 'audit.php',
);

$handlerFile = isset($handlerFiles[$rtype]) ? $handlerFiles[$rtype] : null;
if (!$handlerFile) {
    Response::error('Unknown rtype: ' . $rtype, 400);
}

$handlerPath = dirname(__FILE__) . '/handlers/' . $handlerFile;
if (!file_exists($handlerPath)) {
    Response::error('Handler not implemented: ' . $rtype, 501);
}

require_once $handlerPath;

// Build params array
$params = array(
    'id'        => $id,
    'pid'       => $pid,
    'sid'       => $sid,
    'projectId' => $pid ? $pid : (isset($_GET['projectId']) ? $_GET['projectId'] : ''),
    'modelId'   => isset($_GET['modelId']) ? $_GET['modelId'] : $pid,
    'buildId'   => isset($_GET['buildId']) ? $_GET['buildId'] : '',
    'module'    => isset($_GET['module'])  ? $_GET['module']  : '',
    'status'    => isset($_GET['status'])  ? $_GET['status']  : '',
    'page'      => isset($_GET['page'])    ? intval($_GET['page']) : 1,
    'limit'     => isset($_GET['limit'])   ? intval($_GET['limit']) : 50,
    'event'     => isset($_GET['event'])   ? $_GET['event']  : '',
    'severity'  => isset($_GET['severity']) ? $_GET['severity'] : '',
    'sheet'     => isset($_GET['sheet'])   ? $_GET['sheet']   : '',
);

// ===== ROUTE TABLE =====
switch ($rtype) {

    case 'health':
        health_check($params, $body);
        break;

    case 'auth':
        switch ($action) {
            case 'login':    auth_login($params, $body);    break;
            case 'register': auth_register($params, $body); break;
            case 'logout':   auth_logout($params, $body);   break;
            case 'me':       auth_me($params, $body);       break;
            default:         Response::error('Unknown auth action: ' . $action, 400);
        }
        break;

    case 'projects':
        switch ($action) {
            case 'list':               projects_list($params, $body);   break;
            case 'get':                projects_get($params, $body);    break;
            case 'create':             projects_create($params, $body); break;
            case 'update':             projects_update($params, $body); break;
            case 'delete':             projects_delete($params, $body); break;
            case 'save_parser_config': projects_save_parser_config($params, $body); break;
            case 'load_config':        projects_load_config($params, $body); break;
            case 'list_configs':       projects_list_configs($params, $body); break;
            default:                   Response::error('Unknown projects action: ' . $action, 400);
        }
        break;

    case 'stb':
        switch ($action) {
            case 'list':   stb_models_list($params, $body);   break;
            case 'create': stb_models_create($params, $body); break;
            case 'update': stb_models_update($params, $body); break;
            case 'delete': stb_models_delete($params, $body); break;
            default:       Response::error('Unknown stb action: ' . $action, 400);
        }
        break;

    case 'builds':
        switch ($action) {
            case 'list':   builds_list($params, $body);   break;
            case 'create': builds_create($params, $body); break;
            case 'update': builds_update($params, $body); break;
            case 'delete': builds_delete($params, $body); break;
            default:       Response::error('Unknown builds action: ' . $action, 400);
        }
        break;

    case 'parser':
        switch ($action) {
            case 'seed':           parser_seed($params, $body);           break;
            case 'sessions':
            case 'sessions_list':  parser_sessions_list($params, $body);  break;
            case 'session_get':    parser_sessions_get($params, $body);   break;
            case 'session_delete': parser_sessions_delete($params, $body); break;
            case 'export':         parser_export($params, $body);          break;
            default:               Response::error('Unknown parser action: ' . $action, 400);
        }
        break;

    case 'features':
        switch ($action) {
            case 'list':   features_list($params, $body);   break;
            case 'create': features_create($params, $body); break;
            case 'update': features_update($params, $body); break;
            case 'delete': features_delete($params, $body); break;
            default:       Response::error('Unknown features action: ' . $action, 400);
        }
        break;

    case 'configurations':
        switch ($action) {
            case 'list':   configurations_list($params, $body);   break;
            case 'get':    configurations_get($params, $body);    break;
            case 'create': configurations_create($params, $body); break;
            case 'update': configurations_update($params, $body); break;
            case 'delete': configurations_delete($params, $body); break;
            default:       Response::error('Unknown configurations action: ' . $action, 400);
        }
        break;

    case 'config_data':
        switch ($action) {
            case 'save_full':         config_data_save_full($params, $body);     break;
            case 'load_full':         config_data_load_full($params, $body);     break;
            case 'create_snapshot':   config_data_create_snapshot($params, $body); break;
            case 'list_snapshots':    config_data_list_snapshots($params, $body); break;
            case 'restore_snapshot':  config_data_restore_snapshot($params, $body); break;
            default:                  Response::error('Unknown config_data action: ' . $action, 400);
        }
        break;

    case 'users':
        switch ($action) {
            case 'list':        users_list($params, $body);        break;
            case 'get':         users_get($params, $body);         break;
            case 'update':      users_update($params, $body);      break;
            case 'assign_role': users_assign_role($params, $body); break;
            case 'remove_role': users_remove_role($params, $body); break;
            case 'unlock':      users_unlock($params, $body);      break;
            case 'devices':     users_devices($params, $body);     break;
            default:            Response::error('Unknown users action: ' . $action, 400);
        }
        break;

    case 'audit':
        switch ($action) {
            case 'list':      audit_list($params, $body);      break;
            case 'dashboard': audit_dashboard($params, $body); break;
            default:          Response::error('Unknown audit action: ' . $action, 400);
        }
        break;

    default:
        Response::error('Unknown rtype: ' . $rtype, 400);
}
