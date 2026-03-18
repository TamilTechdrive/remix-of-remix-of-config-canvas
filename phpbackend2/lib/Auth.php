<?php
/**
 * Authentication - PHP 5.3.10 compatible
 * Uses SHA256 + salt (no password_hash available in 5.3)
 */

class Auth {

    /**
     * Hash password with salt
     */
    public static function hashPassword($password) {
        $salt = self::generateSalt();
        $hash = hash('sha256', $salt . $password);
        return $salt . ':' . $hash;
    }

    /**
     * Verify password against stored hash
     */
    public static function verifyPassword($password, $storedHash) {
        $parts = explode(':', $storedHash, 2);
        if (count($parts) !== 2) return false;
        $salt = $parts[0];
        $hash = $parts[1];
        return hash('sha256', $salt . $password) === $hash;
    }

    /**
     * Generate a simple JWT-like token (PHP 5.3 compatible)
     */
    public static function generateToken($userId, $email) {
        $secret = $GLOBALS['CONFIG']['jwt_secret'];
        $expiry = time() + $GLOBALS['CONFIG']['jwt_expiry'];

        $header = base64_encode(json_encode(array('alg' => 'HS256', 'typ' => 'JWT')));
        $payload = base64_encode(json_encode(array(
            'userId' => $userId,
            'email' => $email,
            'exp' => $expiry,
            'iat' => time(),
        )));

        $signature = hash_hmac('sha256', $header . '.' . $payload, $secret);
        return $header . '.' . $payload . '.' . $signature;
    }

    /**
     * Validate token
     */
    public static function validateToken($token) {
        $secret = $GLOBALS['CONFIG']['jwt_secret'];
        $parts = explode('.', $token);
        if (count($parts) !== 3) return false;

        $header = $parts[0];
        $payload = $parts[1];
        $signature = $parts[2];

        $expectedSig = hash_hmac('sha256', $header . '.' . $payload, $secret);
        if ($signature !== $expectedSig) return false;

        $data = json_decode(base64_decode($payload), true);
        if (!$data) return false;

        if (isset($data['exp']) && $data['exp'] < time()) return false;

        return $data;
    }

    /**
     * Get current user from request
     */
    public static function getCurrentUser() {
        $authHeader = isset($_SERVER['HTTP_AUTHORIZATION']) ? $_SERVER['HTTP_AUTHORIZATION'] : '';
        if (strpos($authHeader, 'Bearer ') !== 0) return null;

        $token = substr($authHeader, 7);
        return self::validateToken($token);
    }

    /**
     * Require authentication
     */
    public static function requireAuth() {
        $user = self::getCurrentUser();
        if (!$user) {
            Response::error('Authentication required', 401);
        }
        return $user;
    }

    private static function generateSalt() {
        $chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        $salt = '';
        for ($i = 0; $i < 32; $i++) {
            $salt .= $chars[mt_rand(0, strlen($chars) - 1)];
        }
        return $salt;
    }
}
