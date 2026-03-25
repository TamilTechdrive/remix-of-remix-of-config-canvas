<?php
/**
 * STB Model handlers - with list action
 */

function stb_models_list($params, $body) {
    Auth::requireAuth();
    $projectId = $params['pid'];

    if (!$projectId) Response::error('Project ID required', 400);

    $db = Database::forTable('stb_models');
    if ($db['type'] === 'mssql') {
        $result = Database::odbcQuery("SELECT * FROM stb_models WHERE project_id = ? ORDER BY created_at", array($projectId));
        $models = $result ? Database::odbcFetchAll($result) : array();
    } else {
        $result = Database::mysqlQuery("SELECT * FROM stb_models WHERE project_id = ? ORDER BY created_at", array($projectId));
        $models = $result ? Database::mysqlFetchAll($result) : array();
    }

    Response::success($models);
}

function stb_models_create($params, $body) {
    Auth::requireAuth();
    $projectId = $params['pid'];

    if (!$projectId) $projectId = $params['projectId'];

    $name = isset($body['name']) ? Security::sanitize($body['name']) : '';
    $description = isset($body['description']) ? Security::sanitize($body['description']) : '';
    $chipset = isset($body['chipset']) ? Security::sanitize($body['chipset']) : '';

    if (!$name) Response::error('Name required', 400);

    $id = Database::uuid();
    $db = Database::forTable('stb_models');
    $dateFn = $db['type'] === 'mssql' ? 'GETDATE()' : 'NOW()';

    if ($db['type'] === 'mssql') {
        Database::odbcQuery(
            "INSERT INTO stb_models (id, project_id, name, description, chipset, created_at, updated_at) VALUES (?, ?, ?, ?, ?, $dateFn, $dateFn)",
            array($id, $projectId, $name, $description, $chipset)
        );
    } else {
        Database::mysqlQuery(
            "INSERT INTO stb_models (id, project_id, name, description, chipset, created_at, updated_at) VALUES (?, ?, ?, ?, ?, $dateFn, $dateFn)",
            array($id, $projectId, $name, $description, $chipset)
        );
    }

    Response::success(array('id' => $id), 'Created');
}

function stb_models_update($params, $body) {
    Auth::requireAuth();
    $id = $params['id'];

    $sets = array();
    $vals = array();
    if (isset($body['name'])) { $sets[] = "name = ?"; $vals[] = Security::sanitize($body['name']); }
    if (isset($body['description'])) { $sets[] = "description = ?"; $vals[] = Security::sanitize($body['description']); }
    if (isset($body['chipset'])) { $sets[] = "chipset = ?"; $vals[] = Security::sanitize($body['chipset']); }

    if (count($sets) === 0) Response::error('No fields', 400);

    $db = Database::forTable('stb_models');
    $dateFn = $db['type'] === 'mssql' ? 'GETDATE()' : 'NOW()';
    $sets[] = "updated_at = $dateFn";
    $vals[] = $id;

    $sql = "UPDATE stb_models SET " . implode(', ', $sets) . " WHERE id = ?";
    if ($db['type'] === 'mssql') { Database::odbcQuery($sql, $vals); }
    else { Database::mysqlQuery($sql, $vals); }

    Response::success(null, 'Updated');
}

function stb_models_delete($params, $body) {
    Auth::requireAuth();
    $id = $params['id'];

    $db = Database::forTable('stb_models');
    if ($db['type'] === 'mssql') { Database::odbcQuery("DELETE FROM stb_models WHERE id = ?", array($id)); }
    else { Database::mysqlQuery("DELETE FROM stb_models WHERE id = ?", array($id)); }

    Response::success(null, 'Deleted');
}
