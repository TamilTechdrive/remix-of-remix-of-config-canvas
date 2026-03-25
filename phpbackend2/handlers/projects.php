<?php
/**
 * Project handlers - with parser config save/load
 */

function projects_list($params, $body) {
    $user = Auth::requireAuth();

    $db = Database::forTable('projects');
    $ownerClause = Auth::isEnabled() ? " WHERE owner_id = ?" : "";
    $ownerVals = Auth::isEnabled() ? array($user['userId']) : array();

    if ($db['type'] === 'mssql') {
        $result = Database::odbcQuery(
            "SELECT id, name, description, status, owner_id, tags, created_at, updated_at FROM projects" . $ownerClause . " ORDER BY updated_at DESC",
            $ownerVals
        );
        $projects = $result ? Database::odbcFetchAll($result) : array();
    } else {
        $result = Database::mysqlQuery(
            "SELECT id, name, description, status, owner_id, tags, created_at, updated_at FROM projects" . $ownerClause . " ORDER BY updated_at DESC",
            $ownerVals
        );
        $projects = $result ? Database::mysqlFetchAll($result) : array();
    }

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
        $result = Database::odbcQuery("SELECT * FROM projects WHERE id = ?", array($id));
        $rows = $result ? Database::odbcFetchAll($result) : array();
    } else {
        $result = Database::mysqlQuery("SELECT * FROM projects WHERE id = ?", array($id));
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

    Response::success(array('id' => $id, 'name' => $name), 'Created');
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

    $sql = "UPDATE projects SET " . implode(', ', $sets) . " WHERE id = ?";

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
        Database::odbcQuery("DELETE FROM projects WHERE id = ?", array($id));
    } else {
        Database::mysqlQuery("DELETE FROM projects WHERE id = ?", array($id));
    }

    Response::success(null, 'Project deleted');
}

// ===== Parser Config save/load for builds =====

function projects_save_parser_config($params, $body) {
    Auth::requireAuth();
    $buildId = $params['id'];

    $configName = isset($body['configName']) ? Security::sanitize($body['configName']) : 'Config ' . date('Y-m-d H:i:s');
    $parserSessionId = isset($body['parserSessionId']) ? $body['parserSessionId'] : '';
    $nodes = isset($body['nodes']) ? $body['nodes'] : array();
    $edges = isset($body['edges']) ? $body['edges'] : array();

    // Create configuration
    $configId = Database::uuid();
    Database::mysqlQuery(
        "INSERT INTO configurations (id, name, description, config_data, status, build_id, parser_session_id, created_at, updated_at) VALUES (?, ?, ?, ?, 'active', ?, ?, NOW(), NOW())",
        array($configId, $configName, 'From parser', json_encode(array('nodes' => $nodes, 'edges' => $edges)), $buildId, $parserSessionId)
    );

    // Save nodes and edges
    foreach ($nodes as $node) {
        $nodeId = isset($node['id']) ? $node['id'] : Database::uuid();
        Database::mysqlQuery(
            "INSERT INTO config_nodes (id, config_id, node_type, label, position_x, position_y, properties, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())",
            array(
                $nodeId, $configId,
                isset($node['type']) ? $node['type'] : 'option',
                isset($node['data']['label']) ? $node['data']['label'] : '',
                isset($node['position']['x']) ? $node['position']['x'] : 0,
                isset($node['position']['y']) ? $node['position']['y'] : 0,
                json_encode(isset($node['data']) ? $node['data'] : array())
            )
        );
    }

    foreach ($edges as $edge) {
        $edgeId = isset($edge['id']) ? $edge['id'] : Database::uuid();
        Database::mysqlQuery(
            "INSERT INTO config_edges (id, config_id, source_id, target_id, edge_type, label, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())",
            array(
                $edgeId, $configId,
                isset($edge['source']) ? $edge['source'] : '',
                isset($edge['target']) ? $edge['target'] : '',
                isset($edge['type']) ? $edge['type'] : 'default',
                isset($edge['label']) ? $edge['label'] : ''
            )
        );
    }

    Response::success(array('configId' => $configId));
}

function projects_load_config($params, $body) {
    Auth::requireAuth();
    $configId = $params['id'];

    $result = Database::mysqlQuery("SELECT * FROM configurations WHERE id = ?", array($configId));
    $rows = Database::mysqlFetchAll($result);
    if (count($rows) === 0) Response::error('Config not found', 404);

    $config = $rows[0];

    // Load nodes/edges
    $nodesResult = Database::mysqlQuery("SELECT * FROM config_nodes WHERE config_id = ?", array($configId));
    $edgesResult = Database::mysqlQuery("SELECT * FROM config_edges WHERE config_id = ?", array($configId));

    $nodes = array();
    $nodesRaw = $nodesResult ? Database::mysqlFetchAll($nodesResult) : array();
    foreach ($nodesRaw as $n) {
        $data = json_decode($n['properties'], true);
        if (!$data) $data = array();
        $data['label'] = $n['label'];
        $nodes[] = array(
            'id' => $n['id'],
            'type' => $n['node_type'],
            'position' => array('x' => floatval($n['position_x']), 'y' => floatval($n['position_y'])),
            'data' => $data,
        );
    }

    $edges = array();
    $edgesRaw = $edgesResult ? Database::mysqlFetchAll($edgesResult) : array();
    foreach ($edgesRaw as $e) {
        $edges[] = array(
            'id' => $e['id'],
            'source' => $e['source_id'],
            'target' => $e['target_id'],
            'type' => $e['edge_type'],
        );
    }

    Response::success(array(
        'config' => $config,
        'nodes' => $nodes,
        'edges' => $edges,
    ));
}

function projects_list_configs($params, $body) {
    Auth::requireAuth();
    $buildId = $params['id'];

    $result = Database::mysqlQuery(
        "SELECT id, name, description, status, created_at, updated_at FROM configurations WHERE build_id = ? ORDER BY updated_at DESC",
        array($buildId)
    );
    $configs = $result ? Database::mysqlFetchAll($result) : array();

    Response::success($configs);
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
