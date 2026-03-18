<?php
/**
 * Security utilities - PHP 5.3.10 compatible
 * Provides what's possible without modern PHP extensions
 */

class Security {

    /**
     * Set security headers (compatible with older PHP)
     */
    public static function setHeaders() {
        header('X-Content-Type-Options: nosniff');
        header('X-Frame-Options: DENY');
        header('X-XSS-Protection: 1; mode=block');
        // Note: CSP and HSTS may not be supported by all older browsers
        // but setting them doesn't hurt
        header('Content-Security-Policy: default-src \'self\'');
        header('Cache-Control: no-store, no-cache, must-revalidate');
        header('Pragma: no-cache');
    }

    /**
     * Generate CSRF token
     */
    public static function generateCsrfToken() {
        if (session_id() === '') {
            session_start();
        }
        if (!isset($_SESSION['csrf_token'])) {
            // PHP 5.3 compatible random token
            $_SESSION['csrf_token'] = hash('sha256', uniqid(mt_rand(), true));
        }
        return $_SESSION['csrf_token'];
    }

    /**
     * Validate CSRF token
     */
    public static function validateCsrfToken($token) {
        if (!$GLOBALS['CONFIG']['security']['csrf_enabled']) {
            return true;
        }
        if (session_id() === '') {
            session_start();
        }
        return isset($_SESSION['csrf_token']) && $_SESSION['csrf_token'] === $token;
    }

    /**
     * Check rate limiting (file-based, no extensions needed)
     */
    public static function checkRateLimit($identifier, $maxAttempts, $windowSeconds) {
        if (!$GLOBALS['CONFIG']['security']['rate_limiting_enabled']) {
            return true;
        }

        $file = sys_get_temp_dir() . '/rate_' . md5($identifier) . '.json';
        $now = time();
        $data = array('attempts' => array());

        if (file_exists($file)) {
            $content = file_get_contents($file);
            $decoded = json_decode($content, true);
            if ($decoded) $data = $decoded;
        }

        // Clean old attempts
        $data['attempts'] = array_filter($data['attempts'], function($ts) use ($now, $windowSeconds) {
            return ($now - $ts) < $windowSeconds;
        });

        if (count($data['attempts']) >= $maxAttempts) {
            return false;
        }

        $data['attempts'][] = $now;
        file_put_contents($file, json_encode($data));
        return true;
    }

    /**
     * Sanitize input string
     */
    public static function sanitize($input) {
        if (is_array($input)) {
            return array_map(array('Security', 'sanitize'), $input);
        }
        $input = trim((string)$input);
        $input = htmlspecialchars($input, ENT_QUOTES, 'UTF-8');
        return $input;
    }

    /**
     * Validate email
     */
    public static function isValidEmail($email) {
        // PHP 5.3 compatible email validation
        return (bool)preg_match('/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/', $email);
    }
}
