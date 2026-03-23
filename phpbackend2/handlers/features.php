<?php
/**
 * Features table handlers - stored in MSSQL
 * Tracks feature flags and details per project/build/team
 */

function features_list($params, $body) {
    Auth::requireAuth();

    $projectId = isset($_GET['projectId']) ? $_GET['projectId'] : null;
    $buildId = isset($_GET['buildId']) ? $_GET['buildId'] : null;
    $module = isset($_GET['module']) ? $_GET['module'] : null;

    $db = Database::forTable('features');
    $sql = "SELECT * FROM features WHERE 1=1";
    $vals = array();

    if ($projectId) { $sql .= " AND project_id = ?"; $vals[] = $projectId; }
    if ($buildId) { $sql .= " AND build_id = ?"; $vals[] = $buildId; }
    if ($module) { $sql .= " AND module = ?"; $vals[] = $module; }

    $sql .= " ORDER BY created_at DESC";

    if ($db['type'] === 'mssql') {
        $result = Database::odbcQuery($sql, $vals);
        $features = $result ? Database::odbcFetchAll($result) : array();
    } else {
        $result = Database::mysqlQuery($sql, $vals);
        $features = $result ? Database::mysqlFetchAll($result) : array();
    }

    Response::success($features);
}

function features_create($params, $body) {
    Auth::requireAuth();

    $id = Database::uuid();
    $projectId = isset($body['projectId']) ? $body['projectId'] : '';
    $buildId = isset($body['buildId']) ? $body['buildId'] : '';
    $module = isset($body['module']) ? Security::sanitize($body['module']) : '';
    $featureName = isset($body['name']) ? Security::sanitize($body['name']) : '';
    $enabled = isset($body['enabled']) ? ($body['enabled'] ? 1 : 0) : 1;
    $details = isset($body['details']) ? json_encode($body['details']) : '{}';

    if (!$featureName) Response::error('Feature name required', 400);

    $db = Database::forTable('features');
    $dateFn = $db['type'] === 'mssql' ? 'GETDATE()' : 'NOW()';

    $sql = "INSERT INTO features (id, project_id, build_id, module, name, enabled, details, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, $dateFn, $dateFn)";

    if ($db['type'] === 'mssql') {
        Database::odbcQuery($sql, array($id, $projectId, $buildId, $module, $featureName, $enabled, $details));
    } else {
        Database::mysqlQuery($sql, array($id, $projectId, $buildId, $module, $featureName, $enabled, $details));
    }

    Response::json(array('success' => true, 'id' => $id), 201);
}

function features_update($params, $body) {
    Auth::requireAuth();
    $id = $params['id'];

    $sets = array();
    $vals = array();
    if (isset($body['name'])) { $sets[] = "name = ?"; $vals[] = Security::sanitize($body['name']); }
    if (isset($body['enabled'])) { $sets[] = "enabled = ?"; $vals[] = $body['enabled'] ? 1 : 0; }
    if (isset($body['details'])) { $sets[] = "details = ?"; $vals[] = json_encode($body['details']); }
    if (isset($body['module'])) { $sets[] = "module = ?"; $vals[] = Security::sanitize($body['module']); }

    if (count($sets) === 0) Response::error('No fields', 400);

    $db = Database::forTable('features');
    $dateFn = $db['type'] === 'mssql' ? 'GETDATE()' : 'NOW()';
    $sets[] = "updated_at = $dateFn";
    $vals[] = $id;

    $sql = "UPDATE features SET " . implode(', ', $sets) . " WHERE id = ?";
    if ($db['type'] === 'mssql') { Database::odbcQuery($sql, $vals); }
    else { Database::mysqlQuery($sql, $vals); }

    Response::success(null, 'Feature updated');
}

function features_delete($params, $body) {
    Auth::requireAuth();
    $id = $params['id'];

    $db = Database::forTable('features');
    if ($db['type'] === 'mssql') { Database::odbcQuery("DELETE FROM features WHERE id = ?", array($id)); }
    else { Database::mysqlQuery("DELETE FROM features WHERE id = ?", array($id)); }

    Response::success(null, 'Feature deleted');
}
