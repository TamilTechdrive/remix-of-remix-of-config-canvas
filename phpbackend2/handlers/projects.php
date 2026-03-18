<?php
/**
 * Project handlers - uses MSSQL via ODBC for projects/builds/teams
 * PHP 5.3.10 compatible
 */

function projects_list($params, $body) {
    $user = Auth::requireAuth();

    $db = Database::forTable('projects');
    if ($db['type'] === 'mssql') {
        $result = Database::odbcQuery(
            "SELECT id, name, description, status, owner_id, tags, created_at, updated_at FROM projects WHERE owner_id = ? ORDER BY updated_at DESC",
            array($user['userId'])
        );
        $projects = $result ? Database::odbcFetchAll($result) : array();
    } else {
        $result = Database::mysqlQuery(
            "SELECT id, name, description, status, owner_id, tags, created_at, updated_at FROM projects WHERE owner_id = ? ORDER BY updated_at DESC",
            array($user['userId'])
        );
        $projects = $result ? Database::mysqlFetchAll($result) : array();
    }

    // Fetch STB models and builds for each project
    foreach ($projects as &$project) {
        $project['tags'] = json_decode($project['tags'], true);
        if (!$project['tags']) $project['tags'] = array();
        $project['stbModels'] = _getStbModels($project['id']);
    }

    Response::success($projects);
}

function projects_get($params, $body) {
    $user = Auth::requireAuth();
    $id = $params['id'];

    $db = Database::forTable('projects');
    if ($db['type'] === 'mssql') {
        $result = Database::odbcQuery("SELECT * FROM projects WHERE id = ? AND owner_id = ?", array($id, $user['userId']));
        $rows = $result ? Database::odbcFetchAll($result) : array();
    } else {
        $result = Database::mysqlQuery("SELECT * FROM projects WHERE id = ? AND owner_id = ?", array($id, $user['userId']));
        $rows = $result ? Database::mysqlFetchAll($result) : array();
    }

    if (count($rows) === 0) {
        Response::error('Project not found', 404);
    }

    $project = $rows[0];
    $project['tags'] = json_decode($project['tags'], true);
    if (!$project['tags']) $project['tags'] = array();
    $project['stbModels'] = _getStbModels($project['id']);

    Response::success($project);
}

function projects_create($params, $body) {
    $user = Auth::requireAuth();

    $name = isset($body['name']) ? Security::sanitize($body['name']) : '';
    $description = isset($body['description']) ? Security::sanitize($body['description']) : '';
    $tags = isset($body['tags']) ? $body['tags'] : array();

    if (!$name) {
        Response::error('Project name required', 400);
    }

    $id = Database::uuid();
    $tagsJson = json_encode($tags);

    $db = Database::forTable('projects');
    if ($db['type'] === 'mssql') {
        Database::odbcQuery(
            "INSERT INTO projects (id, name, description, status, owner_id, tags, created_at, updated_at) VALUES (?, ?, ?, 'active', ?, ?, GETDATE(), GETDATE())",
            array($id, $name, $description, $user['userId'], $tagsJson)
        );
    } else {
        Database::mysqlQuery(
            "INSERT INTO projects (id, name, description, status, owner_id, tags, created_at, updated_at) VALUES (?, ?, ?, 'active', ?, ?, NOW(), NOW())",
            array($id, $name, $description, $user['userId'], $tagsJson)
        );
    }

    Response::json(array('success' => true, 'id' => $id, 'name' => $name), 201);
}

function projects_update($params, $body) {
    $user = Auth::requireAuth();
    $id = $params['id'];

    $sets = array();
    $vals = array();

    if (isset($body['name'])) { $sets[] = "name = ?"; $vals[] = Security::sanitize($body['name']); }
    if (isset($body['description'])) { $sets[] = "description = ?"; $vals[] = Security::sanitize($body['description']); }
    if (isset($body['status'])) { $sets[] = "status = ?"; $vals[] = Security::sanitize($body['status']); }
    if (isset($body['tags'])) { $sets[] = "tags = ?"; $vals[] = json_encode($body['tags']); }

    if (count($sets) === 0) {
        Response::error('No fields to update', 400);
    }

    $db = Database::forTable('projects');
    $dateFn = $db['type'] === 'mssql' ? 'GETDATE()' : 'NOW()';
    $sets[] = "updated_at = " . $dateFn;
    $vals[] = $id;
    $vals[] = $user['userId'];

    $sql = "UPDATE projects SET " . implode(', ', $sets) . " WHERE id = ? AND owner_id = ?";

    if ($db['type'] === 'mssql') {
        Database::odbcQuery($sql, $vals);
    } else {
        Database::mysqlQuery($sql, $vals);
    }

    Response::success(null, 'Project updated');
}

function projects_delete($params, $body) {
    $user = Auth::requireAuth();
    $id = $params['id'];

    $db = Database::forTable('projects');
    if ($db['type'] === 'mssql') {
        Database::odbcQuery("DELETE FROM projects WHERE id = ? AND owner_id = ?", array($id, $user['userId']));
    } else {
        Database::mysqlQuery("DELETE FROM projects WHERE id = ? AND owner_id = ?", array($id, $user['userId']));
    }

    Response::success(null, 'Project deleted');
}

// ===== HELPER =====
function _getStbModels($projectId) {
    $db = Database::forTable('stb_models');
    if ($db['type'] === 'mssql') {
        $result = Database::odbcQuery("SELECT * FROM stb_models WHERE project_id = ? ORDER BY created_at", array($projectId));
        $models = $result ? Database::odbcFetchAll($result) : array();
    } else {
        $result = Database::mysqlQuery("SELECT * FROM stb_models WHERE project_id = ? ORDER BY created_at", array($projectId));
        $models = $result ? Database::mysqlFetchAll($result) : array();
    }

    foreach ($models as &$model) {
        $model['builds'] = _getBuilds($model['id']);
    }
    return $models;
}

function _getBuilds($modelId) {
    $db = Database::forTable('builds');
    if ($db['type'] === 'mssql') {
        $result = Database::odbcQuery("SELECT * FROM builds WHERE stb_model_id = ? ORDER BY created_at", array($modelId));
        return $result ? Database::odbcFetchAll($result) : array();
    } else {
        $result = Database::mysqlQuery("SELECT * FROM builds WHERE stb_model_id = ? ORDER BY created_at", array($modelId));
        return $result ? Database::mysqlFetchAll($result) : array();
    }
}
