<?php
/**
 * Users handlers (MySQL)
 */

function users_list($params, $body) {
    Auth::requireAuth();

    $result = Database::mysqlQuery(
        "SELECT id, email, username, display_name, is_active, created_at FROM users ORDER BY created_at DESC"
    );
    $users = $result ? Database::mysqlFetchAll($result) : array();

    // Add roles
    foreach ($users as &$u) {
        $rolesResult = Database::mysqlQuery("SELECT role FROM user_roles WHERE user_id = ?", array($u['id']));
        $roles = array();
        if ($rolesResult) {
            $roleRows = Database::mysqlFetchAll($rolesResult);
            foreach ($roleRows as $r) $roles[] = $r['role'];
        }
        $u['roles'] = $roles;
        $u['displayName'] = isset($u['display_name']) ? $u['display_name'] : $u['username'];
    }

    Response::success($users);
}

function users_get($params, $body) {
    Auth::requireAuth();
    $id = $params['id'];

    $result = Database::mysqlQuery("SELECT id, email, username, display_name, is_active, created_at FROM users WHERE id = ?", array($id));
    $rows = Database::mysqlFetchAll($result);
    if (count($rows) === 0) Response::error('User not found', 404);

    $u = $rows[0];
    $rolesResult = Database::mysqlQuery("SELECT role FROM user_roles WHERE user_id = ?", array($u['id']));
    $roles = array();
    if ($rolesResult) {
        $roleRows = Database::mysqlFetchAll($rolesResult);
        foreach ($roleRows as $r) $roles[] = $r['role'];
    }
    $u['roles'] = $roles;
    $u['displayName'] = isset($u['display_name']) ? $u['display_name'] : $u['username'];

    Response::success($u);
}

function users_update($params, $body) {
    Auth::requireAuth();
    $id = $params['id'];

    $sets = array();
    $vals = array();
    if (isset($body['displayName'])) { $sets[] = "display_name = ?"; $vals[] = Security::sanitize($body['displayName']); }
    if (isset($body['isActive'])) { $sets[] = "is_active = ?"; $vals[] = $body['isActive'] ? 1 : 0; }

    if (count($sets) === 0) Response::error('No fields', 400);

    $sets[] = "updated_at = NOW()";
    $vals[] = $id;

    Database::mysqlQuery("UPDATE users SET " . implode(', ', $sets) . " WHERE id = ?", $vals);
    Response::success(null, 'Updated');
}

function users_assign_role($params, $body) {
    Auth::requireAuth();
    $userId = $params['id'];
    $roleName = isset($body['roleName']) ? Security::sanitize($body['roleName']) : '';

    if (!$roleName) Response::error('Role name required', 400);

    $id = Database::uuid();
    Database::mysqlQuery(
        "INSERT INTO user_roles (id, user_id, role) VALUES (?, ?, ?)",
        array($id, $userId, $roleName)
    );

    Response::success(null, 'Role assigned');
}

function users_remove_role($params, $body) {
    Auth::requireAuth();
    $userId = $params['id'];
    $roleName = isset($body['roleName']) ? Security::sanitize($body['roleName']) : '';

    if (!$roleName) Response::error('Role name required', 400);

    Database::mysqlQuery("DELETE FROM user_roles WHERE user_id = ? AND role = ?", array($userId, $roleName));
    Response::success(null, 'Role removed');
}

function users_unlock($params, $body) {
    Auth::requireAuth();
    $userId = $params['id'];

    Database::mysqlQuery("UPDATE users SET is_active = 1, updated_at = NOW() WHERE id = ?", array($userId));
    Response::success(null, 'User unlocked');
}

function users_devices($params, $body) {
    Auth::requireAuth();
    // Devices tracking not implemented in PHP - return empty
    Response::success(array());
}
