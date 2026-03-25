<?php
/**
 * Health check and utility handlers
 */

function health_check($params, $body) {
    $mysqlOk = false;
    $mssqlOk = false;

    $conn = Database::mysql();
    if ($conn) {
        $mysqlOk = true;
    }

    if ($GLOBALS['CONFIG']['mssql']['enabled']) {
        $conn = Database::mssql();
        if ($conn) {
            $mssqlOk = true;
        }
    }

    Response::success(array(
        'status' => 'ok',
        'php_version' => phpversion(),
        'mysql' => $mysqlOk ? 'connected' : 'disconnected',
        'mssql_odbc' => $GLOBALS['CONFIG']['mssql']['enabled'] ? ($mssqlOk ? 'connected' : 'disconnected') : 'disabled',
        'security_enabled' => !empty($GLOBALS['CONFIG']['security_enabled']),
        'security' => array(
            'csrf' => $GLOBALS['CONFIG']['security']['csrf_enabled'],
            'rate_limiting' => $GLOBALS['CONFIG']['security']['rate_limiting_enabled'],
        ),
        'timestamp' => date('Y-m-d H:i:s'),
    ));
}
