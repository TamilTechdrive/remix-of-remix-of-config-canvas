<?php
/**
 * Auth handlers - PHP 5.3.10 compatible
 */

function auth_login($params, $body) {
    $email = isset($body['email']) ? Security::sanitize($body['email']) : '';
    $password = isset($body['password']) ? $body['password'] : '';

    if (!$email || !$password) {
        Response::error('Email and password required', 400);
    }

    // Check rate limiting
    if (!Security::checkRateLimit('login_' . $email, $GLOBALS['CONFIG']['security']['max_login_attempts'], $GLOBALS['CONFIG']['security']['lockout_duration'])) {
        Response::error('Too many login attempts. Try again later.', 429);
    }

    $result = Database::mysqlQuery(
        "SELECT id, email, username, display_name, password_hash, is_active FROM users WHERE email = ? LIMIT 1",
        array($email)
    );

    if (!$result) {
        Response::error('Database error', 500);
    }

    $rows = Database::mysqlFetchAll($result);
    if (count($rows) === 0) {
        Response::error('Invalid credentials', 401);
    }

    $user = $rows[0];
    if (!$user['is_active']) {
        Response::error('Account is disabled', 403);
    }

    if (!Auth::verifyPassword($password, $user['password_hash'])) {
        Response::error('Invalid credentials', 401);
    }

    $token = Auth::generateToken($user['id'], $user['email']);

    // Log audit
    Database::mysqlQuery(
        "INSERT INTO audit_logs (user_id, event, resource, ip_address, created_at) VALUES (?, ?, ?, ?, NOW())",
        array($user['id'], 'LOGIN', 'auth', isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : '')
    );

    Response::success(array(
        'accessToken' => $token,
        'user' => array(
            'id' => $user['id'],
            'email' => $user['email'],
            'username' => $user['username'],
            'displayName' => $user['display_name'],
        ),
    ), 'Login successful');
}

function auth_register($params, $body) {
    $email = isset($body['email']) ? Security::sanitize($body['email']) : '';
    $username = isset($body['username']) ? Security::sanitize($body['username']) : '';
    $password = isset($body['password']) ? $body['password'] : '';
    $displayName = isset($body['displayName']) ? Security::sanitize($body['displayName']) : $username;

    if (!$email || !$username || !$password) {
        Response::error('Email, username, and password required', 400);
    }

    if (!Security::isValidEmail($email)) {
        Response::error('Invalid email format', 400);
    }

    if (strlen($password) < 6) {
        Response::error('Password must be at least 6 characters', 400);
    }

    // Check existing
    $result = Database::mysqlQuery("SELECT id FROM users WHERE email = ? OR username = ? LIMIT 1", array($email, $username));
    $rows = Database::mysqlFetchAll($result);
    if (count($rows) > 0) {
        Response::error('Email or username already taken', 409);
    }

    $id = Database::uuid();
    $hash = Auth::hashPassword($password);

    Database::mysqlQuery(
        "INSERT INTO users (id, email, username, display_name, password_hash, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 1, NOW(), NOW())",
        array($id, $email, $username, $displayName, $hash)
    );

    $token = Auth::generateToken($id, $email);

    Response::json(array(
        'success' => true,
        'accessToken' => $token,
        'user' => array(
            'id' => $id,
            'email' => $email,
            'username' => $username,
            'displayName' => $displayName,
        ),
    ), 201);
}

function auth_logout($params, $body) {
    Response::success(null, 'Logged out');
}

function auth_me($params, $body) {
    $user = Auth::requireAuth();

    $result = Database::mysqlQuery(
        "SELECT id, email, username, display_name, is_active, created_at FROM users WHERE id = ? LIMIT 1",
        array($user['userId'])
    );
    $rows = Database::mysqlFetchAll($result);
    if (count($rows) === 0) {
        Response::error('User not found', 404);
    }

    $u = $rows[0];

    // Get roles
    $rolesResult = Database::mysqlQuery(
        "SELECT role FROM user_roles WHERE user_id = ?",
        array($u['id'])
    );
    $roles = array();
    if ($rolesResult) {
        $roleRows = Database::mysqlFetchAll($rolesResult);
        foreach ($roleRows as $r) {
            $roles[] = $r['role'];
        }
    }

    Response::success(array(
        'id' => $u['id'],
        'email' => $u['email'],
        'username' => $u['username'],
        'displayName' => $u['display_name'],
        'isActive' => (bool)$u['is_active'],
        'roles' => $roles,
        'createdAt' => $u['created_at'],
    ));
}
