<?php
/**
 * Simple Router - PHP 5.3.10 compatible
 */

class Router {
    private $routes = array();

    public function get($path, $handler) {
        $this->routes[] = array('method' => 'GET', 'path' => $path, 'handler' => $handler);
    }

    public function post($path, $handler) {
        $this->routes[] = array('method' => 'POST', 'path' => $path, 'handler' => $handler);
    }

    public function put($path, $handler) {
        $this->routes[] = array('method' => 'PUT', 'path' => $path, 'handler' => $handler);
    }

    public function delete($path, $handler) {
        $this->routes[] = array('method' => 'DELETE', 'path' => $path, 'handler' => $handler);
    }

    public function dispatch($method, $path, $body = array()) {
        foreach ($this->routes as $route) {
            if ($route['method'] !== $method) continue;

            $params = $this->matchPath($route['path'], $path);
            if ($params !== false) {
                $handlerName = $route['handler'];
                $handlerFile = dirname(dirname(__FILE__)) . '/handlers/' . $this->handlerFile($handlerName);

                if (file_exists($handlerFile)) {
                    require_once $handlerFile;
                    if (function_exists($handlerName)) {
                        call_user_func($handlerName, $params, $body);
                        return;
                    }
                }

                Response::json(array('error' => 'Handler not found: ' . $handlerName), 500);
                return;
            }
        }

        Response::json(array('error' => 'Route not found', 'path' => $path), 404);
    }

    private function matchPath($pattern, $path) {
        $patternParts = explode('/', trim($pattern, '/'));
        $pathParts = explode('/', trim($path, '/'));

        if (count($patternParts) !== count($pathParts)) return false;

        $params = array();
        for ($i = 0; $i < count($patternParts); $i++) {
            if (strpos($patternParts[$i], ':') === 0) {
                $paramName = substr($patternParts[$i], 1);
                $params[$paramName] = $pathParts[$i];
            } elseif ($patternParts[$i] !== $pathParts[$i]) {
                return false;
            }
        }

        return $params;
    }

    private $handlerMap = array();

    public function mapHandler($handlerName, $fileName) {
        $this->handlerMap[$handlerName] = $fileName;
    }

    private function handlerFile($handlerName) {
        if (isset($this->handlerMap[$handlerName])) {
            return $this->handlerMap[$handlerName];
        }
        $parts = explode('_', $handlerName, 2);
        return $parts[0] . '.php';
    }
}
