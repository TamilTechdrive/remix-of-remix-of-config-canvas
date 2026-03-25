<?php
/**
 * Audit log handlers (MySQL)
 */

function audit_list($params, $body) {
    Auth::requireAuth();

    $page = max(1, $params['page']);
    $limit = min(100, max(1, $params['limit']));
    $offset = ($page - 1) * $limit;

    $sql = "SELECT * FROM audit_logs WHERE 1=1";
    $vals = array();

    if ($params['event']) { $sql .= " AND event = ?"; $vals[] = $params['event']; }
    if ($params['severity']) { $sql .= " AND severity = ?"; $vals[] = $params['severity']; }

    $sql .= " ORDER BY created_at DESC LIMIT $limit OFFSET $offset";

    $result = Database::mysqlQuery($sql, $vals);
    $logs = $result ? Database::mysqlFetchAll($result) : array();

    Response::success($logs);
}

function audit_dashboard($params, $body) {
    Auth::requireAuth();

    // Get counts
    $totalResult = Database::mysqlQuery("SELECT COUNT(*) as cnt FROM audit_logs");
    $totalRows = Database::mysqlFetchAll($totalResult);
    $total = isset($totalRows[0]['cnt']) ? intval($totalRows[0]['cnt']) : 0;

    $todayResult = Database::mysqlQuery("SELECT COUNT(*) as cnt FROM audit_logs WHERE DATE(created_at) = CURDATE()");
    $todayRows = Database::mysqlFetchAll($todayResult);
    $today = isset($todayRows[0]['cnt']) ? intval($todayRows[0]['cnt']) : 0;

    // Recent events
    $recentResult = Database::mysqlQuery("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 10");
    $recent = $recentResult ? Database::mysqlFetchAll($recentResult) : array();

    Response::success(array(
        'totalEvents' => $total,
        'todayEvents' => $today,
        'recentEvents' => $recent,
    ));
}
