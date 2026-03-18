<?php
/**
 * Health check handler
 */

function health_check($params, $body) {
    $mysqlOk = false;
    $mssqlOk = false;

    // Test MySQL
    $conn = Database::mysql();
    if ($conn) {
        $mysqlOk = true;
    }

    // Test MSSQL
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
        'security' => array(
            'csrf' => $GLOBALS['CONFIG']['security']['csrf_enabled'],
            'rate_limiting' => $GLOBALS['CONFIG']['security']['rate_limiting_enabled'],
        ),
        'timestamp' => date('Y-m-d H:i:s'),
    ));
}
