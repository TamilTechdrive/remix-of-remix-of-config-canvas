<?php
/**
 * Configurations CRUD handlers (MySQL)
 */

function configurations_list($params, $body) {
    Auth::requireAuth();
    $status = $params['status'];
    $page = max(1, $params['page']);
    $limit = min(100, max(1, $params['limit']));
    $offset = ($page - 1) * $limit;

    $sql = "SELECT id, name, description, status, created_at, updated_at FROM configurations WHERE 1=1";
    $vals = array();

    if ($status) { $sql .= " AND status = ?"; $vals[] = $status; }
    $sql .= " ORDER BY updated_at DESC LIMIT $limit OFFSET $offset";

    $result = Database::mysqlQuery($sql, $vals);
    $configs = $result ? Database::mysqlFetchAll($result) : array();

    Response::success($configs);
}

function configurations_get($params, $body) {
    Auth::requireAuth();
    $id = $params['id'];

    $result = Database::mysqlQuery("SELECT * FROM configurations WHERE id = ?", array($id));
    $rows = Database::mysqlFetchAll($result);
    if (count($rows) === 0) Response::error('Configuration not found', 404);

    $config = $rows[0];
    if (isset($config['config_data'])) {
        $config['configData'] = json_decode($config['config_data'], true);
    }

    Response::success($config);
}

function configurations_create($params, $body) {
    Auth::requireAuth();

    $name = isset($body['name']) ? Security::sanitize($body['name']) : '';
    $description = isset($body['description']) ? Security::sanitize($body['description']) : '';
    $configData = isset($body['configData']) ? json_encode($body['configData']) : '{}';

    if (!$name) Response::error('Name required', 400);

    $id = Database::uuid();
    Database::mysqlQuery(
        "INSERT INTO configurations (id, name, description, config_data, status, created_at, updated_at) VALUES (?, ?, ?, ?, 'draft', NOW(), NOW())",
        array($id, $name, $description, $configData)
    );

    Response::success(array('id' => $id), 'Created');
}

function configurations_update($params, $body) {
    Auth::requireAuth();
    $id = $params['id'];

    $sets = array();
    $vals = array();
    if (isset($body['name'])) { $sets[] = "name = ?"; $vals[] = Security::sanitize($body['name']); }
    if (isset($body['description'])) { $sets[] = "description = ?"; $vals[] = Security::sanitize($body['description']); }
    if (isset($body['configData'])) { $sets[] = "config_data = ?"; $vals[] = json_encode($body['configData']); }
    if (isset($body['status'])) { $sets[] = "status = ?"; $vals[] = Security::sanitize($body['status']); }

    if (count($sets) === 0) Response::error('No fields', 400);

    $sets[] = "updated_at = NOW()";
    $vals[] = $id;

    $sql = "UPDATE configurations SET " . implode(', ', $sets) . " WHERE id = ?";
    Database::mysqlQuery($sql, $vals);

    Response::success(null, 'Updated');
}

function configurations_delete($params, $body) {
    Auth::requireAuth();
    $id = $params['id'];

    Database::mysqlQuery("DELETE FROM configurations WHERE id = ?", array($id));
    Response::success(null, 'Deleted');
}
