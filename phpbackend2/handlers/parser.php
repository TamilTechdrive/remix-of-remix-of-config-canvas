<?php
/**
 * Parser session handlers (MySQL) - Full JSON support
 * Handles: ProcessedFiles, MOFP.IncFiles, CSHFP.IncFiles, EnvVars, DefineVars, ToolsetVars
 */

function parser_seed($params, $body) {
    $user = Auth::requireAuth();

    $sessionName = isset($body['sessionName']) ? Security::sanitize($body['sessionName']) : 'Import ' . date('Y-m-d H:i:s');
    $jsonData = isset($body['jsonData']) ? $body['jsonData'] : null;
    $projectId = isset($body['projectId']) ? $body['projectId'] : '';
    $buildId = isset($body['buildId']) ? $body['buildId'] : '';
    $moduleId = isset($body['moduleId']) ? $body['moduleId'] : '';

    $sessionId = Database::uuid();

    Database::mysqlQuery(
        "INSERT INTO parser_sessions (id, user_id, session_name, source_file_name, total_processed_files, total_included_files, total_define_vars, total_env_vars, total_toolset_vars, project_id, build_id, module_id, created_at) VALUES (?, ?, ?, ?, 0, 0, 0, 0, 0, ?, ?, ?, NOW())",
        array($sessionId, $user['userId'], $sessionName, 'uploaded', $projectId, $buildId, $moduleId)
    );

    $processedCount = 0;
    $includedCount = 0;
    $defineCount = 0;
    $envVarCount = 0;
    $toolsetCount = 0;

    if ($jsonData) {
        // ═══ Process ProcessedFiles (keyed by FileType number) ═══
        if (isset($jsonData['ProcessedFiles'])) {
            foreach ($jsonData['ProcessedFiles'] as $fileTypeKey => $filesArray) {
                // Can be array of file objects or single object
                $files = is_array($filesArray) && isset($filesArray[0]) ? $filesArray : array($filesArray);
                foreach ($files as $fileData) {
                    $module = _extractModule(isset($fileData['FNameFull']) ? $fileData['FNameFull'] : '');
                    $fileId = Database::uuid();
                    Database::mysqlQuery(
                        "INSERT INTO parser_processed_files (id, session_id, file_name, file_name_full, file_type, file_type_key, input_line_count, used_line_count, empty_comment_line_count, multi_line_count, max_line_length, min_line_length, max_line_ref, min_line_ref, start_ts, end_ts, time_delta, cond_if, cond_elif, cond_else, cond_endif, cond_nest_block, assign_direct, assign_rhs, def_var_count, def_hit_count, undef_hit_count, ctl_def_hit_count, macro_hit_count, comp_opt_def, comp_opt_inc, source_module) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                        array(
                            $fileId, $sessionId,
                            isset($fileData['FName']) ? $fileData['FName'] : basename(isset($fileData['FNameFull']) ? $fileData['FNameFull'] : ''),
                            isset($fileData['FNameFull']) ? $fileData['FNameFull'] : '',
                            isset($fileData['FileType']) ? intval($fileData['FileType']) : intval($fileTypeKey),
                            $fileTypeKey,
                            _g($fileData, 'InpLC', 0), _g($fileData, 'UsedLC', 0),
                            _gAlt($fileData, array('EmpCmtLC', 'EmpLC'), 0),
                            _g($fileData, 'MultLC', 0),
                            _g($fileData, 'MaxLL', 0), _g($fileData, 'MinLL', 0),
                            _g($fileData, 'MaxLNR', ''), _g($fileData, 'MinLNR', ''),
                            _g($fileData, 'StartTS', 0), _g($fileData, 'EndTS', 0), _g($fileData, 'TimeDelta', 0),
                            _g($fileData, 'CondIf', 0), _g($fileData, 'CondElif', 0),
                            _g($fileData, 'CondElse', 0), _g($fileData, 'CondEndif', 0),
                            _g($fileData, 'CondNestBlk', 0),
                            _g($fileData, 'AssignDir', 0), _g($fileData, 'AssignRHS', 0),
                            _g($fileData, 'DefVarCnt', 0), _g($fileData, 'DefHitCnt', 0),
                            _g($fileData, 'UndefHitCnt', 0), _g($fileData, 'CtlDefHitCnt', 0),
                            _g($fileData, 'MacroHitCnt', 0),
                            _g($fileData, 'CompOptDef', 0), _g($fileData, 'CompOptInc', 0),
                            $module
                        )
                    );
                    $processedCount++;
                }
            }
        }

        // ═══ Process MOFP.IncFiles (Make Opt File Parser includes) ═══
        if (isset($jsonData['MOFP.IncFiles'])) {
            $includedCount += _seedIncludedFiles($sessionId, $jsonData['MOFP.IncFiles'], 'MOFP');
        }

        // ═══ Process CSHFP.IncFiles (C/C++ SH Header File Parser includes) ═══
        if (isset($jsonData['CSHFP.IncFiles'])) {
            $includedCount += _seedIncludedFiles($sessionId, $jsonData['CSHFP.IncFiles'], 'CSHFP');
        }

        // Legacy IncludedFiles support
        if (isset($jsonData['IncludedFiles'])) {
            $includedCount += _seedIncludedFiles($sessionId, $jsonData['IncludedFiles'], 'MOFP');
        }

        // ═══ Process EnvVars ═══
        if (isset($jsonData['EnvVars'])) {
            foreach ($jsonData['EnvVars'] as $varName => $varData) {
                $envVarCount += _seedEnvVar($sessionId, $varName, $varData);
            }
        }

        // ═══ Process DefineVars ═══
        if (isset($jsonData['DefineVars'])) {
            foreach ($jsonData['DefineVars'] as $varName => $varData) {
                $defineCount += _seedDefineVar($sessionId, $varName, $varData);
            }
        }

        // ═══ Process ToolsetVars (CFLAGS etc.) ═══
        if (isset($jsonData['ToolsetVars'])) {
            foreach ($jsonData['ToolsetVars'] as $toolsetName => $toolsetData) {
                $toolsetCount += _seedToolsetVar($sessionId, $toolsetName, $toolsetData);
            }
        }
    }

    Database::mysqlQuery(
        "UPDATE parser_sessions SET total_processed_files = ?, total_included_files = ?, total_define_vars = ?, total_env_vars = ?, total_toolset_vars = ? WHERE id = ?",
        array($processedCount, $includedCount, $defineCount, $envVarCount, $toolsetCount, $sessionId)
    );

    Response::success(array(
        'sessionId' => $sessionId,
        'stats' => array(
            'processedFiles' => $processedCount,
            'includedFiles' => $includedCount,
            'defineVars' => $defineCount,
            'envVars' => $envVarCount,
            'toolsetVars' => $toolsetCount,
        ),
    ));
}

// ═══ SEED HELPERS ═══

function _seedIncludedFiles($sessionId, $files, $includeType) {
    $count = 0;
    foreach ($files as $inc) {
        $slnr = isset($inc['SrcLineRef']) ? $inc['SrcLineRef'] : '';
        $parts = _parseSLNR($slnr);
        Database::mysqlQuery(
            "INSERT INTO parser_included_files (id, session_id, include_type, include_file_name, source_line_ref, source_module, source_file_name, source_line_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            array(Database::uuid(), $sessionId, $includeType,
                isset($inc['IncFName']) ? str_replace('"', '', $inc['IncFName']) : '',
                $slnr, $parts['module'], $parts['file'], $parts['line'])
        );
        $count++;
    }
    return $count;
}

function _seedEnvVar($sessionId, $varName, $varData) {
    $slnr = _g1st($varData, 'HitSLNR', '');
    $parts = _parseSLNR($slnr);

    $varId = Database::uuid();
    Database::mysqlQuery(
        "INSERT INTO parser_env_vars (id, session_id, var_name, first_hit_src, first_hit_var_type, first_hit_var_scope, first_hit_val_prop, first_hit_slnr, last_hit_slnr, cond_ord_depth, cond_ord_dir, cond_ord_slnr, source_module, source_file_name, source_line_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        array($varId, $sessionId, $varName,
            _g1st($varData, 'HitSrc', ''), _g1st($varData, 'VarType', ''),
            _g1st($varData, 'VarScope', ''), _g1st($varData, 'ValProp', ''),
            $slnr, _g($varData, 'LastHitSLNR', ''),
            _gCond($varData, 'OrdDepth'), _gCond($varData, 'CondDir'), _gCond($varData, 'CondSLNR'),
            $parts['module'], $parts['file'], $parts['line'])
    );

    // Relations: ParList, SibList, ChList, RefList
    _seedRelations('parser_env_var_relations', 'env_var_id', $varId, $varData);

    // AllHitInfo
    if (isset($varData['AllHitInfo'])) {
        foreach ($varData['AllHitInfo'] as $hit) {
            $hitParts = _parseSLNR(_g($hit, 'HitSLNR', ''));
            Database::mysqlQuery(
                "INSERT INTO parser_env_var_hits (id, env_var_id, hit_src, var_type, var_scope, val_prop, hit_slnr, cond_ord_depth, cond_ord_dir, cond_ord_slnr, source_file_name, source_line_number, source_module) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                array(Database::uuid(), $varId,
                    _g($hit, 'HitSrc', ''), _g($hit, 'VarType', ''),
                    _g($hit, 'VarScope', ''), _g($hit, 'ValProp', ''),
                    _g($hit, 'HitSLNR', ''),
                    isset($hit['CondOrd']['OrdDepth']) ? $hit['CondOrd']['OrdDepth'] : null,
                    isset($hit['CondOrd']['CondDir']) ? $hit['CondOrd']['CondDir'] : null,
                    isset($hit['CondOrd']['CondSLNR']) ? $hit['CondOrd']['CondSLNR'] : null,
                    $hitParts['file'], $hitParts['line'], $hitParts['module'])
            );
        }
    }

    // ValEntries
    _seedValEntries('parser_env_var_values', 'env_var_id', $varId, $varData);

    return 1;
}

function _seedDefineVar($sessionId, $varName, $varData) {
    $slnr = _g1st($varData, 'HitSLNR', '');
    $parts = _parseSLNR($slnr);

    $varId = Database::uuid();
    $hitSrc = _g1st($varData, 'HitSrc', '');
    $varType = _g1st($varData, 'VarType', '');
    $varScope = _g1st($varData, 'VarScope', '');
    $valProp = _g1st($varData, 'ValProp', '');
    $hitFlags = _g1st($varData, 'HitFlags', 0);

    // Diagnostic based on source and scope
    $diagLevel = 'info';
    $diagMsg = '';
    if (strpos($varScope, 'RHS') !== false && strpos($hitSrc, 'COND') !== false) {
        $diagLevel = 'warning';
        $diagMsg = "Conditional reference ($hitSrc) - value depends on build path";
    }

    Database::mysqlQuery(
        "INSERT INTO parser_define_vars (id, session_id, var_name, first_hit_src, first_hit_var_type, first_hit_var_scope, first_hit_val_prop, first_hit_src_scope, first_hit_slnr, first_hit_flags, last_hit_slnr, cond_ord_depth, cond_ord_dir, cond_ord_slnr, source_module, source_file_name, source_line_number, diagnostic_level, diagnostic_message) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        array($varId, $sessionId, $varName,
            $hitSrc, $varType, $varScope, $valProp, $varScope, $slnr, $hitFlags,
            _g($varData, 'LastHitSLNR', ''),
            _gCond($varData, 'OrdDepth'), _gCond($varData, 'CondDir'), _gCond($varData, 'CondSLNR'),
            $parts['module'], $parts['file'], $parts['line'],
            $diagLevel, $diagMsg)
    );

    // Relations: ParList, SibList, ChList, RefList, EnvParList, EnvSibList
    _seedRelations('parser_define_var_relations', 'define_var_id', $varId, $varData);

    // AllHitInfo
    if (isset($varData['AllHitInfo'])) {
        foreach ($varData['AllHitInfo'] as $hit) {
            $hitParts = _parseSLNR(_g($hit, 'HitSLNR', ''));
            Database::mysqlQuery(
                "INSERT INTO parser_define_var_hits (id, define_var_id, hit_src, var_type, var_scope, val_prop, hit_mode, hit_flags, depth, hit_slnr, hit_src_scope, cond_ord_depth, cond_ord_dir, cond_ord_slnr, source_file_name, source_line_number, source_module) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                array(Database::uuid(), $varId,
                    _g($hit, 'HitSrc', ''), _g($hit, 'VarType', ''),
                    _g($hit, 'VarScope', ''), _g($hit, 'ValProp', ''),
                    _g($hit, 'HitMode', ''), _g($hit, 'HitFlags', 0), _g($hit, 'Depth', 0),
                    _g($hit, 'HitSLNR', ''), _g($hit, 'VarScope', ''),
                    isset($hit['CondOrd']['OrdDepth']) ? $hit['CondOrd']['OrdDepth'] : null,
                    isset($hit['CondOrd']['CondDir']) ? $hit['CondOrd']['CondDir'] : null,
                    isset($hit['CondOrd']['CondSLNR']) ? $hit['CondOrd']['CondSLNR'] : null,
                    $hitParts['file'], $hitParts['line'], $hitParts['module'])
            );
        }
    }

    // ValEntries
    _seedValEntries('parser_define_var_values', 'define_var_id', $varId, $varData);

    return 1;
}

function _seedToolsetVar($sessionId, $toolsetName, $toolsetData) {
    $toolsetId = Database::uuid();
    $srcLineRef = isset($toolsetData['SrcLineNoRef']) ? $toolsetData['SrcLineNoRef'] : '';
    $module = _extractModule($srcLineRef);

    Database::mysqlQuery(
        "INSERT INTO parser_toolset_vars (id, session_id, toolset_name, src_line_ref, source_module) VALUES (?, ?, ?, ?, ?)",
        array($toolsetId, $sessionId, $toolsetName, $srcLineRef, $module)
    );

    // Process SWOpt (switch options: I, D, O, EL, g, m, f, W, etc.)
    if (isset($toolsetData['SWOpt'])) {
        foreach ($toolsetData['SWOpt'] as $switchKey => $optEntries) {
            foreach ($optEntries as $optName => $hits) {
                // Each hit is an array of [source, value, lineRef]
                foreach ($hits as $hitArr) {
                    $optSource = isset($hitArr[0]) ? $hitArr[0] : '';
                    $optValue = isset($hitArr[1]) ? $hitArr[1] : '';
                    $optLineRef = isset($hitArr[2]) ? $hitArr[2] : '';

                    Database::mysqlQuery(
                        "INSERT INTO parser_toolset_switch_opts (id, toolset_var_id, switch_key, opt_name, opt_source, opt_value, opt_line_ref) VALUES (?, ?, ?, ?, ?, ?, ?)",
                        array(Database::uuid(), $toolsetId, $switchKey, $optName, $optSource, $optValue, $optLineRef)
                    );
                }
            }
        }
    }

    return 1;
}

function _seedRelations($table, $fkCol, $varId, $varData) {
    $relationMaps = array(
        'ParList' => 'parent',
        'SibList' => 'sibling',
        'ChList' => 'child',
        'RefList' => 'ref',
        'EnvParList' => 'env_parent',
        'EnvSibList' => 'env_sibling',
    );

    foreach ($relationMaps as $key => $relType) {
        if (isset($varData[$key]) && is_array($varData[$key])) {
            foreach ($varData[$key] as $rel) {
                Database::mysqlQuery(
                    "INSERT INTO $table (id, $fkCol, relation_type, related_var_name) VALUES (?, ?, ?, ?)",
                    array(Database::uuid(), $varId, $relType, $rel)
                );
            }
        }
    }
}

function _seedValEntries($table, $fkCol, $varId, $varData) {
    if (isset($varData['ValEntries']) && is_array($varData['ValEntries'])) {
        foreach ($varData['ValEntries'] as $valKey => $valItems) {
            Database::mysqlQuery(
                "INSERT INTO $table (id, $fkCol, value_key, value_items) VALUES (?, ?, ?, ?)",
                array(Database::uuid(), $varId, $valKey, json_encode($valItems))
            );
        }
    }
}

// ═══ SESSION LIST / GET / DELETE ═══

function parser_sessions_list($params, $body) {
    $user = Auth::requireAuth();

    $result = Database::mysqlQuery(
        "SELECT id, session_name, source_file_name, total_processed_files, total_included_files, total_define_vars, total_env_vars, total_toolset_vars, project_id, build_id, module_id, created_at FROM parser_sessions WHERE user_id = ? ORDER BY created_at DESC",
        array($user['userId'])
    );

    $sessions = $result ? Database::mysqlFetchAll($result) : array();
    Response::success($sessions);
}

function parser_sessions_get($params, $body) {
    Auth::requireAuth();
    $id = $params['id'];

    $result = Database::mysqlQuery("SELECT * FROM parser_sessions WHERE id = ?", array($id));
    $rows = Database::mysqlFetchAll($result);
    if (count($rows) === 0) Response::error('Session not found', 404);
    $session = $rows[0];

    // Processed files
    $pf = Database::mysqlQuery("SELECT * FROM parser_processed_files WHERE session_id = ? ORDER BY file_type, file_name", array($id));
    $session['processedFiles'] = $pf ? Database::mysqlFetchAll($pf) : array();

    // Included files (both MOFP and CSHFP)
    $inf = Database::mysqlQuery("SELECT * FROM parser_included_files WHERE session_id = ? ORDER BY include_type, include_file_name", array($id));
    $session['includedFiles'] = $inf ? Database::mysqlFetchAll($inf) : array();

    // ═══ Define Vars with relations, hits, values ═══
    $dv = Database::mysqlQuery("SELECT * FROM parser_define_vars WHERE session_id = ? ORDER BY var_name", array($id));
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

        _enrichVarRelationsAndHits($var, 'parser_define_var_relations', 'define_var_id', 'parser_define_var_hits', 'define_var_id', 'parser_define_var_values', 'define_var_id');
    }

    // ═══ Env Vars with relations, hits, values ═══
    $ev = Database::mysqlQuery("SELECT * FROM parser_env_vars WHERE session_id = ? ORDER BY var_name", array($id));
    $envVars = $ev ? Database::mysqlFetchAll($ev) : array();

    foreach ($envVars as &$evar) {
        if ($evar['source_module'] && !in_array($evar['source_module'], $modules)) {
            $modules[] = $evar['source_module'];
        }
        _enrichVarRelationsAndHits($evar, 'parser_env_var_relations', 'env_var_id', 'parser_env_var_hits', 'env_var_id', 'parser_env_var_values', 'env_var_id');
    }

    // ═══ Toolset Vars with switch options ═══
    $tv = Database::mysqlQuery("SELECT * FROM parser_toolset_vars WHERE session_id = ?", array($id));
    $toolsetVars = $tv ? Database::mysqlFetchAll($tv) : array();

    foreach ($toolsetVars as &$tvar) {
        $opts = Database::mysqlQuery("SELECT * FROM parser_toolset_switch_opts WHERE toolset_var_id = ? ORDER BY switch_key, opt_name", array($tvar['id']));
        $tvar['switchOpts'] = $opts ? Database::mysqlFetchAll($opts) : array();

        // Group by switch_key for frontend
        $grouped = array();
        foreach ($tvar['switchOpts'] as $opt) {
            $key = $opt['switch_key'];
            if (!isset($grouped[$key])) $grouped[$key] = array();
            $grouped[$key][] = $opt;
        }
        $tvar['switchOptsByKey'] = $grouped;
    }

    $session['defineVars'] = $defineVars;
    $session['envVars'] = $envVars;
    $session['toolsetVars'] = $toolsetVars;
    $session['modules'] = $modules;
    $session['diagnosticsSummary'] = $diagSummary;

    Response::success($session);
}

function _enrichVarRelationsAndHits(&$var, $relTable, $relFk, $hitTable, $hitFk, $valTable, $valFk) {
    // Relations
    $rel = Database::mysqlQuery("SELECT relation_type, related_var_name FROM $relTable WHERE $relFk = ?", array($var['id']));
    $relations = $rel ? Database::mysqlFetchAll($rel) : array();

    $var['parents'] = array();
    $var['siblings'] = array();
    $var['children'] = array();
    $var['refs'] = array();
    $var['envParents'] = array();
    $var['envSiblings'] = array();

    foreach ($relations as $r) {
        switch ($r['relation_type']) {
            case 'parent': $var['parents'][] = $r['related_var_name']; break;
            case 'sibling': $var['siblings'][] = $r['related_var_name']; break;
            case 'child': $var['children'][] = $r['related_var_name']; break;
            case 'ref': $var['refs'][] = $r['related_var_name']; break;
            case 'env_parent': $var['envParents'][] = $r['related_var_name']; break;
            case 'env_sibling': $var['envSiblings'][] = $r['related_var_name']; break;
        }
    }

    // Hits
    $hits = Database::mysqlQuery("SELECT * FROM $hitTable WHERE $hitFk = ?", array($var['id']));
    $var['allHits'] = $hits ? Database::mysqlFetchAll($hits) : array();

    // Values
    $vals = Database::mysqlQuery("SELECT * FROM $valTable WHERE $valFk = ?", array($var['id']));
    $var['valEntries'] = $vals ? Database::mysqlFetchAll($vals) : array();
}

function parser_sessions_delete($params, $body) {
    Auth::requireAuth();
    $id = $params['id'];
    Database::mysqlQuery("DELETE FROM parser_sessions WHERE id = ?", array($id));
    Response::success(null, 'Session deleted');
}

function parser_export($params, $body) {
    Auth::requireAuth();
    $id = $params['id'];
    $sheet = $params['sheet'];

    $result = Database::mysqlQuery("SELECT * FROM parser_sessions WHERE id = ?", array($id));
    $rows = Database::mysqlFetchAll($result);
    if (count($rows) === 0) Response::error('Session not found', 404);

    $csv = '';

    if ($sheet === 'processedFiles' || $sheet === 'processed_files') {
        $pf = Database::mysqlQuery("SELECT * FROM parser_processed_files WHERE session_id = ?", array($id));
        $files = $pf ? Database::mysqlFetchAll($pf) : array();
        $csv = "File Name,Full Path,Type,Lines,Used Lines,Empty/Comment,Multi-Line,Max LL,Min LL,COND_IF,COND_ELIF,COND_ELSE,COND_ENDIF,Nest Blocks,Assign Direct,Assign RHS,Def Vars,Def Hits,Undef Hits,Ctl Def Hits,Macro Hits,Module\n";
        foreach ($files as $f) {
            $csv .= '"' . $f['file_name'] . '","' . $f['file_name_full'] . '",' . $f['file_type'] . ','
                . $f['input_line_count'] . ',' . $f['used_line_count'] . ',' . $f['empty_comment_line_count'] . ','
                . $f['multi_line_count'] . ',' . $f['max_line_length'] . ',' . $f['min_line_length'] . ','
                . $f['cond_if'] . ',' . $f['cond_elif'] . ',' . $f['cond_else'] . ',' . $f['cond_endif'] . ','
                . $f['cond_nest_block'] . ',' . $f['assign_direct'] . ',' . $f['assign_rhs'] . ','
                . $f['def_var_count'] . ',' . $f['def_hit_count'] . ',' . $f['undef_hit_count'] . ','
                . $f['ctl_def_hit_count'] . ',' . $f['macro_hit_count'] . ',"' . $f['source_module'] . "\"\n";
        }
    } elseif ($sheet === 'defineVars' || $sheet === 'define_vars') {
        $dv = Database::mysqlQuery("SELECT * FROM parser_define_vars WHERE session_id = ?", array($id));
        $vars = $dv ? Database::mysqlFetchAll($dv) : array();
        $csv = "Variable,HitSrc,VarType,VarScope,ValProp,Source File,Line,Module,LastHitSLNR,Diagnostic\n";
        foreach ($vars as $v) {
            $csv .= '"' . $v['var_name'] . '","' . $v['first_hit_src'] . '","' . $v['first_hit_var_type'] . '","'
                . $v['first_hit_var_scope'] . '","' . $v['first_hit_val_prop'] . '","'
                . $v['source_file_name'] . '",' . $v['source_line_number'] . ',"' . $v['source_module'] . '","'
                . $v['last_hit_slnr'] . '","' . $v['diagnostic_message'] . "\"\n";
        }
    } elseif ($sheet === 'envVars' || $sheet === 'env_vars') {
        $ev = Database::mysqlQuery("SELECT * FROM parser_env_vars WHERE session_id = ?", array($id));
        $vars = $ev ? Database::mysqlFetchAll($ev) : array();
        $csv = "Variable,HitSrc,VarType,VarScope,ValProp,Source File,Line,Module,LastHitSLNR\n";
        foreach ($vars as $v) {
            $csv .= '"' . $v['var_name'] . '","' . $v['first_hit_src'] . '","' . $v['first_hit_var_type'] . '","'
                . $v['first_hit_var_scope'] . '","' . $v['first_hit_val_prop'] . '","'
                . $v['source_file_name'] . '",' . $v['source_line_number'] . ',"' . $v['source_module'] . '","'
                . $v['last_hit_slnr'] . "\"\n";
        }
    } elseif ($sheet === 'toolsetVars' || $sheet === 'toolset_vars') {
        $tv = Database::mysqlQuery("SELECT tv.toolset_name, so.switch_key, so.opt_name, so.opt_source, so.opt_value, so.opt_line_ref FROM parser_toolset_vars tv JOIN parser_toolset_switch_opts so ON so.toolset_var_id = tv.id WHERE tv.session_id = ? ORDER BY tv.toolset_name, so.switch_key", array($id));
        $rows = $tv ? Database::mysqlFetchAll($tv) : array();
        $csv = "Toolset,Switch,Option,Source,Value,Line Ref\n";
        foreach ($rows as $r) {
            $csv .= '"' . $r['toolset_name'] . '","' . $r['switch_key'] . '","' . $r['opt_name'] . '","'
                . $r['opt_source'] . '","' . $r['opt_value'] . '","' . $r['opt_line_ref'] . "\"\n";
        }
    } else {
        $inf = Database::mysqlQuery("SELECT * FROM parser_included_files WHERE session_id = ?", array($id));
        $files = $inf ? Database::mysqlFetchAll($inf) : array();
        $csv = "Type,Include File,Source Ref,Module\n";
        foreach ($files as $f) {
            $csv .= '"' . $f['include_type'] . '","' . $f['include_file_name'] . '","' . $f['source_line_ref'] . '","' . $f['source_module'] . "\"\n";
        }
    }

    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="export_' . $sheet . '.csv"');
    echo $csv;
    exit;
}

// ═══ UTILITY HELPERS ═══

function _g($data, $key, $default = '') {
    return isset($data[$key]) ? $data[$key] : $default;
}

function _gAlt($data, $keys, $default = '') {
    foreach ($keys as $k) {
        if (isset($data[$k])) return $data[$k];
    }
    return $default;
}

function _g1st($varData, $key, $default = '') {
    return isset($varData['1stHitInfo'][$key]) ? $varData['1stHitInfo'][$key] : $default;
}

function _gCond($varData, $key) {
    return isset($varData['1stHitInfo']['CondOrd'][$key]) ? $varData['1stHitInfo']['CondOrd'][$key] : null;
}

function _extractModule($path) {
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
    $slnr = str_replace('\\', '/', $slnr);
    $parts = explode(':#', $slnr);
    $filePath = isset($parts[0]) ? $parts[0] : '';
    $line = isset($parts[1]) ? intval($parts[1]) : 0;
    $module = _extractModule($filePath);
    $file = basename($filePath);
    return array('module' => $module, 'file' => $file, 'line' => $line);
}
