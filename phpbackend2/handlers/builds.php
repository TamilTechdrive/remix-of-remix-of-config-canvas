<?php
/**
 * Build handlers - with list action
 */

function builds_list($params, $body) {
    Auth::requireAuth();
    $modelId = $params['pid'];

    if (!$modelId) $modelId = $params['modelId'];
    if (!$modelId) Response::error('Model ID required', 400);

    $db = Database::forTable('builds');
    if ($db['type'] === 'mssql') {
        $result = Database::odbcQuery("SELECT * FROM builds WHERE stb_model_id = ? ORDER BY created_at", array($modelId));
        $builds = $result ? Database::odbcFetchAll($result) : array();
    } else {
        $result = Database::mysqlQuery("SELECT * FROM builds WHERE stb_model_id = ? ORDER BY created_at", array($modelId));
        $builds = $result ? Database::mysqlFetchAll($result) : array();
    }

    Response::success($builds);
}

function builds_create($params, $body) {
    Auth::requireAuth();
    $modelId = $params['pid'];
    if (!$modelId) $modelId = $params['modelId'];

    $name = isset($body['name']) ? Security::sanitize($body['name']) : '';
    $version = isset($body['version']) ? Security::sanitize($body['version']) : 'v1.0.0';
    $description = isset($body['description']) ? Security::sanitize($body['description']) : '';

    if (!$name) Response::error('Name required', 400);

    $id = Database::uuid();
    $db = Database::forTable('builds');
    $dateFn = $db['type'] === 'mssql' ? 'GETDATE()' : 'NOW()';

    if ($db['type'] === 'mssql') {
        Database::odbcQuery(
            "INSERT INTO builds (id, stb_model_id, name, version, description, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'draft', $dateFn, $dateFn)",
            array($id, $modelId, $name, $version, $description)
        );
    } else {
        Database::mysqlQuery(
            "INSERT INTO builds (id, stb_model_id, name, version, description, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 'draft', $dateFn, $dateFn)",
            array($id, $modelId, $name, $version, $description)
        );
    }

    Response::success(array('id' => $id), 'Created');
}

function builds_update($params, $body) {
    Auth::requireAuth();
    $id = $params['id'];

    $sets = array();
    $vals = array();
    if (isset($body['name'])) { $sets[] = "name = ?"; $vals[] = Security::sanitize($body['name']); }
    if (isset($body['version'])) { $sets[] = "version = ?"; $vals[] = Security::sanitize($body['version']); }
    if (isset($body['description'])) { $sets[] = "description = ?"; $vals[] = Security::sanitize($body['description']); }
    if (isset($body['status'])) { $sets[] = "status = ?"; $vals[] = Security::sanitize($body['status']); }

    if (count($sets) === 0) Response::error('No fields', 400);

    $db = Database::forTable('builds');
    $dateFn = $db['type'] === 'mssql' ? 'GETDATE()' : 'NOW()';
    $sets[] = "updated_at = $dateFn";
    $vals[] = $id;

    $sql = "UPDATE builds SET " . implode(', ', $sets) . " WHERE id = ?";
    if ($db['type'] === 'mssql') { Database::odbcQuery($sql, $vals); }
    else { Database::mysqlQuery($sql, $vals); }

    Response::success(null, 'Updated');
}

function builds_delete($params, $body) {
    Auth::requireAuth();
    $id = $params['id'];

    $db = Database::forTable('builds');
    if ($db['type'] === 'mssql') { Database::odbcQuery("DELETE FROM builds WHERE id = ?", array($id)); }
    else { Database::mysqlQuery("DELETE FROM builds WHERE id = ?", array($id)); }

    Response::success(null, 'Deleted');
}
