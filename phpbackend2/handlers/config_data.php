<?php
/**
 * Config data handlers - nodes/edges/snapshots (MySQL)
 */

function config_data_save_full($params, $body) {
    Auth::requireAuth();
    $configId = $params['id'];

    $nodes = isset($body['nodes']) ? $body['nodes'] : array();
    $edges = isset($body['edges']) ? $body['edges'] : array();

    // Delete existing
    Database::mysqlQuery("DELETE FROM config_edges WHERE config_id = ?", array($configId));
    Database::mysqlQuery("DELETE FROM config_nodes WHERE config_id = ?", array($configId));

    // Insert nodes
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

    // Insert edges
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

    Response::success(array('saved' => true, 'nodes' => count($nodes), 'edges' => count($edges)));
}

function config_data_load_full($params, $body) {
    Auth::requireAuth();
    $configId = $params['id'];

    $nodesResult = Database::mysqlQuery("SELECT * FROM config_nodes WHERE config_id = ? ORDER BY created_at", array($configId));
    $nodesRaw = $nodesResult ? Database::mysqlFetchAll($nodesResult) : array();

    $edgesResult = Database::mysqlQuery("SELECT * FROM config_edges WHERE config_id = ? ORDER BY created_at", array($configId));
    $edgesRaw = $edgesResult ? Database::mysqlFetchAll($edgesResult) : array();

    // Convert to flow format
    $nodes = array();
    foreach ($nodesRaw as $n) {
        $data = json_decode($n['properties'], true);
        if (!$data) $data = array();
        $data['label'] = isset($n['label']) ? $n['label'] : '';
        $nodes[] = array(
            'id' => $n['id'],
            'type' => $n['node_type'],
            'position' => array('x' => floatval($n['position_x']), 'y' => floatval($n['position_y'])),
            'data' => $data,
        );
    }

    $edges = array();
    foreach ($edgesRaw as $e) {
        $edges[] = array(
            'id' => $e['id'],
            'source' => $e['source_id'],
            'target' => $e['target_id'],
            'type' => $e['edge_type'],
            'label' => isset($e['label']) ? $e['label'] : '',
        );
    }

    Response::success(array('nodes' => $nodes, 'edges' => $edges));
}

function config_data_create_snapshot($params, $body) {
    Auth::requireAuth();
    $configId = $params['id'];
    $name = isset($body['name']) ? Security::sanitize($body['name']) : 'Snapshot ' . date('Y-m-d H:i:s');
    $description = isset($body['description']) ? Security::sanitize($body['description']) : '';

    // Load current data
    $nodesResult = Database::mysqlQuery("SELECT * FROM config_nodes WHERE config_id = ?", array($configId));
    $edgesResult = Database::mysqlQuery("SELECT * FROM config_edges WHERE config_id = ?", array($configId));
    $nodes = $nodesResult ? Database::mysqlFetchAll($nodesResult) : array();
    $edges = $edgesResult ? Database::mysqlFetchAll($edgesResult) : array();

    $snapshotId = Database::uuid();
    Database::mysqlQuery(
        "INSERT INTO config_snapshots (id, config_id, name, description, snapshot_data, created_at) VALUES (?, ?, ?, ?, ?, NOW())",
        array($snapshotId, $configId, $name, $description, json_encode(array('nodes' => $nodes, 'edges' => $edges)))
    );

    Response::success(array('id' => $snapshotId));
}

function config_data_list_snapshots($params, $body) {
    Auth::requireAuth();
    $configId = $params['id'];

    $result = Database::mysqlQuery(
        "SELECT id, config_id, name, description, created_at FROM config_snapshots WHERE config_id = ? ORDER BY created_at DESC",
        array($configId)
    );
    $snapshots = $result ? Database::mysqlFetchAll($result) : array();

    Response::success($snapshots);
}

function config_data_restore_snapshot($params, $body) {
    Auth::requireAuth();
    $configId = $params['id'];
    $snapshotId = $params['sid'];

    $result = Database::mysqlQuery("SELECT snapshot_data FROM config_snapshots WHERE id = ? AND config_id = ?", array($snapshotId, $configId));
    $rows = Database::mysqlFetchAll($result);
    if (count($rows) === 0) Response::error('Snapshot not found', 404);

    $data = json_decode($rows[0]['snapshot_data'], true);

    // Clear and restore
    Database::mysqlQuery("DELETE FROM config_edges WHERE config_id = ?", array($configId));
    Database::mysqlQuery("DELETE FROM config_nodes WHERE config_id = ?", array($configId));

    if (isset($data['nodes'])) {
        foreach ($data['nodes'] as $n) {
            Database::mysqlQuery(
                "INSERT INTO config_nodes (id, config_id, node_type, label, position_x, position_y, properties, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())",
                array($n['id'], $configId, $n['node_type'], $n['label'], $n['position_x'], $n['position_y'], $n['properties'])
            );
        }
    }
    if (isset($data['edges'])) {
        foreach ($data['edges'] as $e) {
            Database::mysqlQuery(
                "INSERT INTO config_edges (id, config_id, source_id, target_id, edge_type, label, created_at) VALUES (?, ?, ?, ?, ?, ?, NOW())",
                array($e['id'], $configId, $e['source_id'], $e['target_id'], $e['edge_type'], isset($e['label']) ? $e['label'] : '')
            );
        }
    }

    Response::success(null, 'Snapshot restored');
}
