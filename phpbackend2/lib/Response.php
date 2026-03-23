<?php
/**
 * Response helper - PHP 5.3.10 compatible
 */

class Response {
    public static function json($data, $statusCode = 200) {
        http_response_code($statusCode);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($data);
        exit;
    }

    public static function success($data = null, $message = 'Success') {
        self::json(array(
            'success' => true,
            'message' => $message,
            'data' => $data,
        ));
    }

    public static function error($message, $statusCode = 400) {
        self::json(array(
            'success' => false,
            'error' => $message,
        ), $statusCode);
    }
}

// Polyfill http_response_code for PHP < 5.4
if (!function_exists('http_response_code')) {
    function http_response_code($code = NULL) {
        if ($code !== NULL) {
            switch ($code) {
                case 200: $text = 'OK'; break;
                case 201: $text = 'Created'; break;
                case 204: $text = 'No Content'; break;
                case 400: $text = 'Bad Request'; break;
                case 401: $text = 'Unauthorized'; break;
                case 403: $text = 'Forbidden'; break;
                case 404: $text = 'Not Found'; break;
                case 409: $text = 'Conflict'; break;
                case 429: $text = 'Too Many Requests'; break;
                case 500: $text = 'Internal Server Error'; break;
                default: $text = 'Unknown'; break;
            }
            $protocol = isset($_SERVER['SERVER_PROTOCOL']) ? $_SERVER['SERVER_PROTOCOL'] : 'HTTP/1.0';
            header($protocol . ' ' . $code . ' ' . $text, true, $code);
        }
    }
}
