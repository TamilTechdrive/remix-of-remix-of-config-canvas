<?php
/**
 * Database abstraction for MySQL + MSSQL/ODBC
 * PHP 5.3.10 compatible - no PDO required (uses mysql_* and odbc_*)
 */

class Database {
    private static $mysqlConn = null;
    private static $odbcConn = null;

    /**
     * Get MySQL connection
     */
    public static function mysql() {
        if (self::$mysqlConn !== null) {
            return self::$mysqlConn;
        }

        $cfg = $GLOBALS['CONFIG']['mysql'];

        // Use mysqli if available, fall back to mysql_*
        if (function_exists('mysqli_connect')) {
            self::$mysqlConn = mysqli_connect(
                $cfg['host'],
                $cfg['username'],
                $cfg['password'],
                $cfg['database'],
                $cfg['port']
            );
            if (!self::$mysqlConn) {
                error_log('MySQL connection failed: ' . mysqli_connect_error());
                return null;
            }
            mysqli_set_charset(self::$mysqlConn, $cfg['charset']);
        } else {
            // Legacy mysql_* functions
            self::$mysqlConn = mysql_connect(
                $cfg['host'] . ':' . $cfg['port'],
                $cfg['username'],
                $cfg['password']
            );
            if (!self::$mysqlConn) {
                error_log('MySQL connection failed: ' . mysql_error());
                return null;
            }
            mysql_select_db($cfg['database'], self::$mysqlConn);
            mysql_set_charset($cfg['charset'], self::$mysqlConn);
        }

        return self::$mysqlConn;
    }

    /**
     * Get MSSQL ODBC connection
     */
    public static function mssql() {
        if (self::$odbcConn !== null) {
            return self::$odbcConn;
        }

        $cfg = $GLOBALS['CONFIG']['mssql'];
        if (!$cfg['enabled']) {
            return null;
        }

        self::$odbcConn = odbc_connect($cfg['dsn'], $cfg['username'], $cfg['password']);
        if (!self::$odbcConn) {
            error_log('ODBC/MSSQL connection failed: ' . odbc_errormsg());
            return null;
        }

        return self::$odbcConn;
    }

    /**
     * Get connection by table name (based on db_mapping config)
     */
    public static function forTable($table) {
        $mapping = $GLOBALS['CONFIG']['db_mapping'];
        $dbType = isset($mapping[$table]) ? $mapping[$table] : 'mysql';

        if ($dbType === 'mssql') {
            return array('type' => 'mssql', 'conn' => self::mssql());
        }
        return array('type' => 'mysql', 'conn' => self::mysql());
    }

    /**
     * Execute query on MySQL
     */
    public static function mysqlQuery($sql, $params = array()) {
        $conn = self::mysql();
        if (!$conn) return false;

        // Simple parameter binding (escape params)
        foreach ($params as $param) {
            $escaped = self::mysqlEscape($param);
            $pos = strpos($sql, '?');
            if ($pos !== false) {
                $sql = substr_replace($sql, "'" . $escaped . "'", $pos, 1);
            }
        }

        if (function_exists('mysqli_query')) {
            $result = mysqli_query($conn, $sql);
            if ($result === false) {
                error_log('MySQL query error: ' . mysqli_error($conn) . ' SQL: ' . $sql);
                return false;
            }
            return $result;
        } else {
            $result = mysql_query($sql, $conn);
            if ($result === false) {
                error_log('MySQL query error: ' . mysql_error($conn) . ' SQL: ' . $sql);
                return false;
            }
            return $result;
        }
    }

    /**
     * Fetch all rows from MySQL result
     */
    public static function mysqlFetchAll($result) {
        $rows = array();
        if (function_exists('mysqli_fetch_assoc')) {
            while ($row = mysqli_fetch_assoc($result)) {
                $rows[] = $row;
            }
        } else {
            while ($row = mysql_fetch_assoc($result)) {
                $rows[] = $row;
            }
        }
        return $rows;
    }

    /**
     * Get last insert ID for MySQL
     */
    public static function mysqlInsertId() {
        $conn = self::mysql();
        if (function_exists('mysqli_insert_id')) {
            return mysqli_insert_id($conn);
        }
        return mysql_insert_id($conn);
    }

    /**
     * Escape string for MySQL
     */
    public static function mysqlEscape($str) {
        $conn = self::mysql();
        if ($str === null) return 'NULL';
        $str = (string)$str;
        if (function_exists('mysqli_real_escape_string')) {
            return mysqli_real_escape_string($conn, $str);
        }
        return mysql_real_escape_string($str, $conn);
    }

    /**
     * Execute query on MSSQL via ODBC
     */
    public static function odbcQuery($sql, $params = array()) {
        $conn = self::mssql();
        if (!$conn) return false;

        // Bind params
        foreach ($params as $param) {
            $escaped = str_replace("'", "''", (string)$param);
            $pos = strpos($sql, '?');
            if ($pos !== false) {
                $sql = substr_replace($sql, "'" . $escaped . "'", $pos, 1);
            }
        }

        $result = odbc_exec($conn, $sql);
        if (!$result) {
            error_log('ODBC query error: ' . odbc_errormsg($conn) . ' SQL: ' . $sql);
            return false;
        }
        return $result;
    }

    /**
     * Fetch all rows from ODBC result
     */
    public static function odbcFetchAll($result) {
        $rows = array();
        while ($row = odbc_fetch_array($result)) {
            $rows[] = $row;
        }
        return $rows;
    }

    /**
     * Universal query - routes to correct DB based on table
     */
    public static function query($table, $sql, $params = array()) {
        $db = self::forTable($table);
        if ($db['type'] === 'mssql') {
            return self::odbcQuery($sql, $params);
        }
        return self::mysqlQuery($sql, $params);
    }

    /**
     * Universal fetchAll
     */
    public static function fetchAll($table, $result) {
        $db = self::forTable($table);
        if ($db['type'] === 'mssql') {
            return self::odbcFetchAll($result);
        }
        return self::mysqlFetchAll($result);
    }

    /**
     * Generate UUID (PHP 5.3 compatible)
     */
    public static function uuid() {
        return sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0, 0xffff), mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0x0fff) | 0x4000,
            mt_rand(0, 0x3fff) | 0x8000,
            mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
        );
    }
}
