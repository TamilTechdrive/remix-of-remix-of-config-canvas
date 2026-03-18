<?php
/**
 * Parser session handlers (MySQL)
 */

function parser_seed($params, $body) {
    $user = Auth::requireAuth();

    $sessionName = isset($body['sessionName']) ? Security::sanitize($body['sessionName']) : 'Import ' . date('Y-m-d H:i:s');
    $jsonData = isset($body['jsonData']) ? $body['jsonData'] : null;

    $sessionId = Database::uuid();

    // Insert session
    Database::mysqlQuery(
        "INSERT INTO parser_sessions (id, user_id, session_name, source_file_name, total_processed_files, total_included_files, total_define_vars, created_at) VALUES (?, ?, ?, ?, 0, 0, 0, NOW())",
        array($sessionId, $user['userId'], $sessionName, 'uploaded')
    );

    $processedCount = 0;
    $includedCount = 0;
    $defineCount = 0;

    if ($jsonData) {
        // Process ProcessedFiles
        if (isset($jsonData['ProcessedFiles'])) {
            foreach ($jsonData['ProcessedFiles'] as $fileName => $fileData) {
                $module = _extractModule($fileName);
                $fileId = Database::uuid();
                Database::mysqlQuery(
                    "INSERT INTO parser_processed_files (id, session_id, file_name, file_name_full, file_type, input_line_count, cond_if, cond_else, cond_endif, cond_nest_block, def_hit_count, macro_hit_count, time_delta, source_module) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    array(
                        $fileId, $sessionId,
                        basename($fileName), $fileName,
                        isset($fileData['FileType']) ? $fileData['FileType'] : 'c',
                        isset($fileData['InputLineCount']) ? $fileData['InputLineCount'] : 0,
                        isset($fileData['COND_IF']) ? $fileData['COND_IF'] : 0,
                        isset($fileData['COND_ELSE']) ? $fileData['COND_ELSE'] : 0,
                        isset($fileData['COND_ENDIF']) ? $fileData['COND_ENDIF'] : 0,
                        isset($fileData['COND_NestBlock']) ? $fileData['COND_NestBlock'] : 0,
                        isset($fileData['DefHitCount']) ? $fileData['DefHitCount'] : 0,
                        isset($fileData['MacroHitCount']) ? $fileData['MacroHitCount'] : 0,
                        isset($fileData['TimeDelta']) ? $fileData['TimeDelta'] : 0,
                        $module
                    )
                );
                $processedCount++;
            }
        }

        // Process DefineVars
        if (isset($jsonData['DefineVars'])) {
            foreach ($jsonData['DefineVars'] as $varName => $varData) {
                $module = '';
                $sourceFile = '';
                $sourceLine = 0;

                if (isset($varData['1stHitInfo']['HitSLNR'])) {
                    $slnr = $varData['1stHitInfo']['HitSLNR'];
                    $parts = _parseSLNR($slnr);
                    $module = $parts['module'];
                    $sourceFile = $parts['file'];
                    $sourceLine = $parts['line'];
                }

                $varId = Database::uuid();
                $varType = isset($varData['1stHitInfo']['VarType']) ? $varData['1stHitInfo']['VarType'] : '';
                $hitScope = isset($varData['1stHitInfo']['HitSrcScope']) ? $varData['1stHitInfo']['HitSrcScope'] : '';

                // Generate diagnostic
                $diagLevel = 'info';
                $diagMsg = '';
                if ($hitScope === 'COND_IF' || $hitScope === 'COND_ELSE') {
                    $diagLevel = 'warning';
                    $diagMsg = "Conditional define ($hitScope) - may be excluded depending on build configuration";
                }

                Database::mysqlQuery(
                    "INSERT INTO parser_define_vars (id, session_id, var_name, first_hit_var_type, first_hit_src_scope, first_hit_slnr, source_module, source_file_name, source_line_number, diagnostic_level, diagnostic_message) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    array($varId, $sessionId, $varName, $varType, $hitScope,
                        isset($varData['1stHitInfo']['HitSLNR']) ? $varData['1stHitInfo']['HitSLNR'] : '',
                        $module, $sourceFile, $sourceLine, $diagLevel, $diagMsg)
                );

                // Parents
                if (isset($varData['ParList'])) {
                    foreach ($varData['ParList'] as $par) {
                        Database::mysqlQuery(
                            "INSERT INTO parser_define_var_relations (id, define_var_id, relation_type, related_var_name) VALUES (?, ?, 'parent', ?)",
                            array(Database::uuid(), $varId, $par)
                        );
                    }
                }
                // Siblings
                if (isset($varData['SibList'])) {
                    foreach ($varData['SibList'] as $sib) {
                        Database::mysqlQuery(
                            "INSERT INTO parser_define_var_relations (id, define_var_id, relation_type, related_var_name) VALUES (?, ?, 'sibling', ?)",
                            array(Database::uuid(), $varId, $sib)
                        );
                    }
                }
                // Children
                if (isset($varData['ChList'])) {
                    foreach ($varData['ChList'] as $ch) {
                        Database::mysqlQuery(
                            "INSERT INTO parser_define_var_relations (id, define_var_id, relation_type, related_var_name) VALUES (?, ?, 'child', ?)",
                            array(Database::uuid(), $varId, $ch)
                        );
                    }
                }

                // All hits
                if (isset($varData['AllHitInfo'])) {
                    foreach ($varData['AllHitInfo'] as $hit) {
                        $hitParts = isset($hit['HitSLNR']) ? _parseSLNR($hit['HitSLNR']) : array('module'=>'','file'=>'','line'=>0);
                        Database::mysqlQuery(
                            "INSERT INTO parser_define_var_hits (id, define_var_id, var_type, hit_mode, depth, hit_slnr, hit_src_scope, source_file_name, source_line_number, source_module) VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?)",
                            array(
                                Database::uuid(), $varId,
                                isset($hit['VarType']) ? $hit['VarType'] : '',
                                isset($hit['HitMode']) ? $hit['HitMode'] : '',
                                isset($hit['HitSLNR']) ? $hit['HitSLNR'] : '',
                                isset($hit['HitSrcScope']) ? $hit['HitSrcScope'] : '',
                                $hitParts['file'], $hitParts['line'], $hitParts['module']
                            )
                        );
                    }
                }

                $defineCount++;
            }
        }

        // Process IncludedFiles
        if (isset($jsonData['IncludedFiles'])) {
            foreach ($jsonData['IncludedFiles'] as $incName => $incData) {
                $module = _extractModule($incName);
                Database::mysqlQuery(
                    "INSERT INTO parser_included_files (id, session_id, include_file_name, source_line_ref, source_module) VALUES (?, ?, ?, ?, ?)",
                    array(Database::uuid(), $sessionId, basename($incName), $incName, $module)
                );
                $includedCount++;
            }
        }
    }

    // Update counts
    Database::mysqlQuery(
        "UPDATE parser_sessions SET total_processed_files = ?, total_included_files = ?, total_define_vars = ? WHERE id = ?",
        array($processedCount, $includedCount, $defineCount, $sessionId)
    );

    Response::success(array(
        'sessionId' => $sessionId,
        'stats' => array(
            'processedFiles' => $processedCount,
            'includedFiles' => $includedCount,
            'defineVars' => $defineCount,
        ),
    ));
}

function parser_sessions_list($params, $body) {
    $user = Auth::requireAuth();

    $result = Database::mysqlQuery(
        "SELECT id, session_name, source_file_name, total_processed_files, total_included_files, total_define_vars, created_at FROM parser_sessions WHERE user_id = ? ORDER BY created_at DESC",
        array($user['userId'])
    );

    $sessions = $result ? Database::mysqlFetchAll($result) : array();
    Response::success($sessions);
}

function parser_sessions_get($params, $body) {
    Auth::requireAuth();
    $id = $params['id'];

    // Session
    $result = Database::mysqlQuery("SELECT * FROM parser_sessions WHERE id = ?", array($id));
    $rows = Database::mysqlFetchAll($result);
    if (count($rows) === 0) Response::error('Session not found', 404);
    $session = $rows[0];

    // Processed files
    $pf = Database::mysqlQuery("SELECT * FROM parser_processed_files WHERE session_id = ?", array($id));
    $session['processedFiles'] = $pf ? Database::mysqlFetchAll($pf) : array();

    // Included files
    $inf = Database::mysqlQuery("SELECT * FROM parser_included_files WHERE session_id = ?", array($id));
    $session['includedFiles'] = $inf ? Database::mysqlFetchAll($inf) : array();

    // Define vars with relations and hits
    $dv = Database::mysqlQuery("SELECT * FROM parser_define_vars WHERE session_id = ?", array($id));
    $defineVars = $dv ? Database::mysqlFetchAll($dv) : array();

    $modules = array();
    $diagSummary = array('errors' => 0, 'warnings' => 0, 'info' => 0);

    foreach ($defineVars as &$var) {
        if ($var['source_module'] && !in_array($var['source_module'], $modules)) {
            $modules[] = $var['source_module'];
        }

        $level = isset($var['diagnostic_level']) ? $var['diagnostic_level'] : 'info';
        if ($level === 'error') $diagSummary['errors']++;
        elseif ($level === 'warning') $diagSummary['warnings']++;
        else $diagSummary['info']++;

        // Relations
        $rel = Database::mysqlQuery("SELECT relation_type, related_var_name FROM parser_define_var_relations WHERE define_var_id = ?", array($var['id']));
        $relations = $rel ? Database::mysqlFetchAll($rel) : array();

        $var['parents'] = array();
        $var['siblings'] = array();
        $var['children'] = array();
        foreach ($relations as $r) {
            if ($r['relation_type'] === 'parent') $var['parents'][] = $r['related_var_name'];
            elseif ($r['relation_type'] === 'sibling') $var['siblings'][] = $r['related_var_name'];
            else $var['children'][] = $r['related_var_name'];
        }

        // Hits
        $hits = Database::mysqlQuery("SELECT * FROM parser_define_var_hits WHERE define_var_id = ?", array($var['id']));
        $var['allHits'] = $hits ? Database::mysqlFetchAll($hits) : array();
    }

    $session['defineVars'] = $defineVars;
    $session['modules'] = $modules;
    $session['diagnosticsSummary'] = $diagSummary;

    Response::success($session);
}

function parser_sessions_delete($params, $body) {
    Auth::requireAuth();
    $id = $params['id'];

    Database::mysqlQuery("DELETE FROM parser_sessions WHERE id = ?", array($id));
    Response::success(null, 'Session deleted');
}

// ===== HELPERS =====

function _extractModule($path) {
    // Extract module from path like Samples\eDBE\src\file.c
    $path = str_replace('\\', '/', $path);
    if (preg_match('/Samples\/([^\/]+)/', $path, $matches)) {
        return $matches[1];
    }
    if (preg_match('/^([a-zA-Z]+)\//', $path, $matches)) {
        return $matches[1];
    }
    return '';
}

function _parseSLNR($slnr) {
    // Parse "Samples\eDBE\src\ndbfcm.c:#127"
    $slnr = str_replace('\\', '/', $slnr);
    $parts = explode(':#', $slnr);
    $filePath = isset($parts[0]) ? $parts[0] : '';
    $line = isset($parts[1]) ? intval($parts[1]) : 0;
    $module = _extractModule($filePath);
    $file = basename($filePath);

    return array('module' => $module, 'file' => $file, 'line' => $line);
}
