import { Router, Request, Response } from 'express';
import { db } from '../database/connection.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { logger } from '../utils/logger.js';
import { v4 as uuid } from 'uuid';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ─────────────────────────── Utilities ───────────────────────────

function extractModule(filePath: string): string {
  if (!filePath) return '';
  const norm = filePath.replace(/\\\\/g, '/').replace(/\\/g, '/');
  const m1 = norm.match(/Samples\/([^/]+)/);
  if (m1) return m1[1];
  const m2 = norm.match(/^\.{0,2}\/?([A-Za-z][A-Za-z0-9_]*)\//);
  if (m2) return m2[1];
  return '';
}

function extractPathPrefix(p: string): string {
  if (!p) return '';
  const norm = p.replace(/\\/g, '/');
  const i = norm.lastIndexOf('/');
  return i >= 0 ? norm.substring(0, i) : '';
}

function parseSLNR(slnr: string): { filePath: string; fileName: string; lineNumber: number; module: string } {
  if (!slnr) return { filePath: '', fileName: '', lineNumber: 0, module: '' };
  const norm = slnr.replace(/\\/g, '/');
  const [filePath, lineRaw] = norm.split(':#');
  const fileName = (filePath || '').split('/').pop() || '';
  return {
    filePath: filePath || '',
    fileName,
    lineNumber: parseInt(lineRaw || '0', 10) || 0,
    module: extractModule(filePath || ''),
  };
}

function diagnoseDefine(args: {
  varName: string;
  hitSrc?: string;
  varScope?: string;
  varType?: string;
  hitSrcScope?: string;
  condOrd?: { OrdDepth?: number; CondDir?: string; CondSLNR?: string };
  parList?: string[];
  chList?: string[];
  refList?: string[];
  envParList?: string[];
}): { level: string; message: string } {
  const messages: string[] = [];
  let level = 'info';

  if (args.condOrd) {
    level = 'warning';
    const p = parseSLNR(args.condOrd.CondSLNR || '');
    messages.push(
      `Conditionally defined under #${args.condOrd.CondDir} at ${p.fileName}:${p.lineNumber} (depth ${args.condOrd.OrdDepth}). If this condition is not met, ${args.varName} will NOT be available.`
    );
  }
  if (args.varScope && /RHS/.test(args.varScope) && args.hitSrc && /COND/.test(args.hitSrc)) {
    level = 'warning';
    messages.push(`Conditional reference (${args.hitSrc}) — value depends on build path.`);
  }
  if (args.parList && args.parList.length) messages.push(`Depends on: ${args.parList.join(', ')}.`);
  if (args.chList && args.chList.length) messages.push(`Required by: ${args.chList.join(', ')}.`);
  if (args.refList && args.refList.length) messages.push(`References: ${args.refList.join(', ')}.`);
  if (args.envParList && args.envParList.length) messages.push(`Env parents: ${args.envParList.join(', ')}.`);
  if (!messages.length) messages.push(`Direct ${args.varType || 'define'} at ${args.hitSrcScope || args.varScope || 'scope'}.`);

  return { level, message: messages.join(' | ') };
}

// ─────────────────────────── Seed ───────────────────────────

router.post('/seed', authenticate, async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const { jsonData, sessionName, projectId, buildId, moduleId } = req.body || {};

  let parserData: any = jsonData;
  if (!parserData) {
    const samplePath = path.resolve(__dirname, '../data/MakeOptCCPPFileParser.json');
    if (!fs.existsSync(samplePath)) {
      return res.status(404).json({ error: 'Sample JSON file not found' });
    }
    parserData = JSON.parse(fs.readFileSync(samplePath, 'utf-8'));
  }

  try {
    const result = await db.transaction(async (trx) => {
      const sessionId = uuid();
      let processedCount = 0;
      let includedCount = 0;
      let defineCount = 0;
      let envVarCount = 0;
      let toolsetCount = 0;

      await trx('parser_sessions').insert({
        id: sessionId,
        session_name: sessionName || `Parser Import ${new Date().toISOString()}`,
        source_file_name: 'parser_upload.json',
        total_processed_files: 0,
        total_included_files: 0,
        total_define_vars: 0,
        total_env_vars: 0,
        total_toolset_vars: 0,
        project_id: projectId || null,
        build_id: buildId || null,
        module_id: moduleId || null,
        created_by: userId,
      });

      // ═══ ProcessedFiles ═══
      // Supports two shapes:
      //  - new: { ProcessedFiles: { "2": [ {...} ], "4": [ {...} ] } }
      //  - old: { ProcessedFiles: [ {...}, {...} ] }
      const pfRoot = parserData.ProcessedFiles;
      if (pfRoot) {
        const groups: Array<{ key: string; files: any[] }> = [];
        if (Array.isArray(pfRoot)) {
          groups.push({ key: '', files: pfRoot });
        } else {
          for (const k of Object.keys(pfRoot)) {
            const v = pfRoot[k];
            groups.push({ key: k, files: Array.isArray(v) ? v : [v] });
          }
        }
        for (const g of groups) {
          for (const f of g.files) {
            const full = f.FNameFull || '';
            await trx('parser_processed_files').insert({
              id: uuid(),
              session_id: sessionId,
              file_type: f.FileType || parseInt(g.key || '0', 10) || 0,
              file_type_key: g.key,
              file_name: f.FName || (full ? full.split(/[\\/]/).pop() : ''),
              file_name_full: full,
              source_module: extractModule(full),
              source_path_prefix: extractPathPrefix(full),
              start_ts: f.StartTS || 0,
              end_ts: f.EndTS || 0,
              time_delta: f.TimeDelta || 0,
              input_line_count: f.InpLC || 0,
              used_line_count: f.UsedLC || 0,
              empty_comment_line_count: f.EmpCmtLC ?? f.EmpLC ?? 0,
              multi_line_count: f.MultLC || 0,
              max_line_length: f.MaxLL || 0,
              min_line_length: f.MinLL || 0,
              max_line_ref: f.MaxLNR || '',
              min_line_ref: f.MinLNR || '',
              cond_if: f.CondIf || 0,
              cond_else: f.CondElse || 0,
              cond_elif: f.CondElif || 0,
              cond_endif: f.CondEndif || 0,
              cond_nest_block: f.CondNestBlk || 0,
              assign_direct: f.AssignDir || 0,
              assign_rhs: f.AssignRHS || 0,
              def_var_count: f.DefVarCnt || 0,
              def_hit_count: f.DefHitCnt || 0,
              undef_hit_count: f.UndefHitCnt || 0,
              ctl_def_hit_count: f.CtlDefHitCnt || 0,
              macro_hit_count: f.MacroHitCnt || 0,
              comp_opt_def: f.CompOptDef || 0,
              comp_opt_inc: f.CompOptInc || 0,
            });
            processedCount++;
          }
        }
      }

      // ═══ Included files: MOFP + CSHFP ═══
      const seedIncludes = async (list: any[], type: 'MOFP' | 'CSHFP') => {
        if (!Array.isArray(list)) return 0;
        let n = 0;
        for (const inc of list) {
          const slnr = inc.SrcLineRef || '';
          const p = parseSLNR(slnr);
          await trx('parser_included_files').insert({
            id: uuid(),
            session_id: sessionId,
            include_type: type,
            include_file_name: (inc.IncFName || '').replace(/"/g, ''),
            source_line_ref: slnr,
            source_module: p.module,
            source_file_name: p.fileName,
            source_line_number: p.lineNumber,
          });
          n++;
        }
        return n;
      };
      includedCount += await seedIncludes(parserData['MOFP.IncFiles'] || [], 'MOFP');
      includedCount += await seedIncludes(parserData['CSHFP.IncFiles'] || [], 'CSHFP');
      includedCount += await seedIncludes(parserData['IncludedFiles'] || [], 'MOFP');

      // ═══ EnvVars ═══
      if (parserData.EnvVars) {
        for (const [varName, vd] of Object.entries<any>(parserData.EnvVars)) {
          const fh = vd['1stHitInfo'] || {};
          const slnr = fh.HitSLNR || '';
          const p = parseSLNR(slnr);
          const envId = uuid();
          await trx('parser_env_vars').insert({
            id: envId,
            session_id: sessionId,
            var_name: varName,
            first_hit_src: fh.HitSrc || null,
            first_hit_var_type: fh.VarType || null,
            first_hit_var_scope: fh.VarScope || null,
            first_hit_val_prop: fh.ValProp || null,
            first_hit_slnr: slnr,
            last_hit_slnr: vd.LastHitSLNR || '',
            cond_ord_depth: fh.CondOrd?.OrdDepth ?? null,
            cond_ord_dir: fh.CondOrd?.CondDir || null,
            cond_ord_slnr: fh.CondOrd?.CondSLNR || null,
            source_module: p.module,
            source_file_name: p.fileName,
            source_line_number: p.lineNumber,
          });

          // Relations
          for (const [k, rel] of [
            ['ParList', 'parent'],
            ['SibList', 'sibling'],
            ['ChList', 'child'],
            ['RefList', 'ref'],
          ] as const) {
            if (Array.isArray(vd[k])) {
              for (const r of vd[k]) {
                await trx('parser_env_var_relations').insert({
                  id: uuid(), env_var_id: envId, relation_type: rel, related_var_name: r,
                });
              }
            }
          }

          // Hits
          if (Array.isArray(vd.AllHitInfo)) {
            for (const h of vd.AllHitInfo) {
              const hp = parseSLNR(h.HitSLNR || '');
              await trx('parser_env_var_hits').insert({
                id: uuid(),
                env_var_id: envId,
                hit_src: h.HitSrc || null,
                var_type: h.VarType || null,
                var_scope: h.VarScope || null,
                val_prop: h.ValProp || null,
                hit_slnr: h.HitSLNR || '',
                cond_ord_depth: h.CondOrd?.OrdDepth ?? null,
                cond_ord_dir: h.CondOrd?.CondDir || null,
                cond_ord_slnr: h.CondOrd?.CondSLNR || null,
                source_file_name: hp.fileName,
                source_line_number: hp.lineNumber,
                source_module: hp.module,
              });
            }
          }

          // ValEntries
          if (vd.ValEntries && typeof vd.ValEntries === 'object') {
            for (const [vk, vi] of Object.entries(vd.ValEntries)) {
              await trx('parser_env_var_values').insert({
                id: uuid(), env_var_id: envId, value_key: vk, value_items: JSON.stringify(vi),
              });
            }
          }
          envVarCount++;
        }
      }

      // ═══ DefineVars ═══
      if (parserData.DefineVars) {
        for (const [varName, vd] of Object.entries<any>(parserData.DefineVars)) {
          const fh = vd['1stHitInfo'] || {};
          const slnr = fh.HitSLNR || '';
          const p = parseSLNR(slnr);
          const dvId = uuid();
          const diag = diagnoseDefine({
            varName,
            hitSrc: fh.HitSrc,
            varScope: fh.VarScope,
            varType: fh.VarType,
            hitSrcScope: fh.HitSrcScope || fh.VarScope,
            condOrd: fh.CondOrd,
            parList: vd.ParList,
            chList: vd.ChList,
            refList: vd.RefList,
            envParList: vd.EnvParList,
          });

          await trx('parser_define_vars').insert({
            id: dvId,
            session_id: sessionId,
            var_name: varName,
            first_hit_src: fh.HitSrc || null,
            first_hit_var_type: fh.VarType || null,
            first_hit_var_scope: fh.VarScope || null,
            first_hit_val_prop: fh.ValProp || null,
            first_hit_src_scope: fh.HitSrcScope || fh.VarScope || null,
            first_hit_slnr: slnr,
            first_hit_flags: fh.HitFlags || 0,
            last_hit_slnr: vd.LastHitSLNR || '',
            cond_ord_depth: fh.CondOrd?.OrdDepth ?? null,
            cond_ord_dir: fh.CondOrd?.CondDir || null,
            cond_ord_slnr: fh.CondOrd?.CondSLNR || null,
            source_module: p.module,
            source_file_name: p.fileName,
            source_line_number: p.lineNumber,
            diagnostic_level: diag.level,
            diagnostic_message: diag.message,
          });

          // Relations: parent/sibling/child/ref/env_parent/env_sibling
          for (const [k, rel] of [
            ['ParList', 'parent'],
            ['SibList', 'sibling'],
            ['ChList', 'child'],
            ['RefList', 'ref'],
            ['EnvParList', 'env_parent'],
            ['EnvSibList', 'env_sibling'],
          ] as const) {
            if (Array.isArray(vd[k])) {
              for (const r of vd[k]) {
                await trx('parser_define_var_relations').insert({
                  id: uuid(), define_var_id: dvId, relation_type: rel, related_var_name: r,
                });
              }
            }
          }

          // Hits
          if (Array.isArray(vd.AllHitInfo)) {
            for (const h of vd.AllHitInfo) {
              const hp = parseSLNR(h.HitSLNR || '');
              await trx('parser_define_var_hits').insert({
                id: uuid(),
                define_var_id: dvId,
                hit_mode: h.HitMode || null,
                hit_src: h.HitSrc || null,
                var_type: h.VarType || null,
                var_scope: h.VarScope || null,
                val_prop: h.ValProp || null,
                hit_flags: h.HitFlags || 0,
                depth: h.Depth || 0,
                hit_slnr: h.HitSLNR || '',
                hit_src_scope: h.HitSrcScope || h.VarScope || null,
                cond_ord_depth: h.CondOrd?.OrdDepth ?? null,
                cond_ord_dir: h.CondOrd?.CondDir || null,
                cond_ord_slnr: h.CondOrd?.CondSLNR || null,
                source_file_name: hp.fileName,
                source_line_number: hp.lineNumber,
                source_module: hp.module,
              });
            }
          }

          // ValEntries
          if (vd.ValEntries && typeof vd.ValEntries === 'object') {
            for (const [vk, vi] of Object.entries(vd.ValEntries)) {
              await trx('parser_define_var_values').insert({
                id: uuid(), define_var_id: dvId, value_key: vk, value_items: JSON.stringify(vi),
              });
            }
          }
          defineCount++;
        }
      }

      // ═══ ToolsetVars (CFLAGS etc.) ═══
      if (parserData.ToolsetVars) {
        for (const [tname, td] of Object.entries<any>(parserData.ToolsetVars)) {
          const tvId = uuid();
          const srcRef = td.SrcLineNoRef || '';
          await trx('parser_toolset_vars').insert({
            id: tvId,
            session_id: sessionId,
            toolset_name: tname,
            src_line_ref: srcRef,
            source_module: extractModule(srcRef),
          });
          if (td.SWOpt && typeof td.SWOpt === 'object') {
            for (const [swKey, optEntries] of Object.entries<any>(td.SWOpt)) {
              for (const [optName, hits] of Object.entries<any>(optEntries)) {
                if (!Array.isArray(hits)) continue;
                for (const hit of hits) {
                  await trx('parser_toolset_switch_opts').insert({
                    id: uuid(),
                    toolset_var_id: tvId,
                    switch_key: swKey,
                    opt_name: optName,
                    opt_source: hit?.[0] || '',
                    opt_value: hit?.[1] || '',
                    opt_line_ref: hit?.[2] || '',
                  });
                }
              }
            }
          }
          toolsetCount++;
        }
      }

      // Update totals
      await trx('parser_sessions').where({ id: sessionId }).update({
        total_processed_files: processedCount,
        total_included_files: includedCount,
        total_define_vars: defineCount,
        total_env_vars: envVarCount,
        total_toolset_vars: toolsetCount,
      });

      return {
        sessionId,
        stats: {
          processedFiles: processedCount,
          includedFiles: includedCount,
          defineVars: defineCount,
          envVars: envVarCount,
          toolsetVars: toolsetCount,
        },
      };
    });

    try {
      await db('audit_logs').insert({
        user_id: userId,
        event: 'PARSER_DATA_SEEDED',
        resource: 'parser_sessions',
        resource_id: result.sessionId,
        details: JSON.stringify(result.stats),
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
      });
    } catch { /* best-effort */ }

    res.status(201).json({ success: true, ...result });
  } catch (error) {
    logger.error('Parser seed failed', { error });
    res.status(500).json({ error: 'Failed to seed parser data' });
  }
});

// ─────────────────────────── List sessions ───────────────────────────
router.get('/sessions', authenticate, async (_req: Request, res: Response) => {
  try {
    const sessions = await db('parser_sessions').orderBy('created_at', 'desc');
    res.json(sessions);
  } catch (error) {
    res.status(500).json({ error: 'Failed to list sessions' });
  }
});

// ─────────────────────────── Get session detail ───────────────────────────

async function enrichRelations(table: string, fk: string, ids: string[]) {
  if (!ids.length) return new Map<string, any[]>();
  const rows = await db(table).whereIn(fk, ids);
  const grouped = new Map<string, any[]>();
  for (const r of rows) {
    const k = r[fk];
    if (!grouped.has(k)) grouped.set(k, []);
    grouped.get(k)!.push(r);
  }
  return grouped;
}

router.get('/sessions/:id', authenticate, async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const session = await db('parser_sessions').where({ id }).first();
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const processedFiles = await db('parser_processed_files').where({ session_id: id }).orderBy(['file_type', 'file_name']);
    const includedFiles = await db('parser_included_files').where({ session_id: id }).orderBy(['include_type', 'include_file_name']);

    // ── Define vars ──
    const defineVars = await db('parser_define_vars').where({ session_id: id }).orderBy('var_name');
    const dvIds = defineVars.map((v: any) => v.id);
    const dvRel = await enrichRelations('parser_define_var_relations', 'define_var_id', dvIds);
    const dvHits = await enrichRelations('parser_define_var_hits', 'define_var_id', dvIds);
    const dvVals = await enrichRelations('parser_define_var_values', 'define_var_id', dvIds);

    const enrichVar = (v: any, rel: Map<string, any[]>, hits: Map<string, any[]>, vals: Map<string, any[]>, fk: string) => {
      const rs = rel.get(v.id) || [];
      v.parents = rs.filter((r: any) => r.relation_type === 'parent').map((r: any) => r.related_var_name);
      v.siblings = rs.filter((r: any) => r.relation_type === 'sibling').map((r: any) => r.related_var_name);
      v.children = rs.filter((r: any) => r.relation_type === 'child').map((r: any) => r.related_var_name);
      v.refs = rs.filter((r: any) => r.relation_type === 'ref').map((r: any) => r.related_var_name);
      v.envParents = rs.filter((r: any) => r.relation_type === 'env_parent').map((r: any) => r.related_var_name);
      v.envSiblings = rs.filter((r: any) => r.relation_type === 'env_sibling').map((r: any) => r.related_var_name);
      v.allHits = hits.get(v.id) || [];
      v.valEntries = vals.get(v.id) || [];
      return v;
    };

    const enrichedDefineVars = defineVars.map((v: any) => enrichVar(v, dvRel, dvHits, dvVals, 'define_var_id'));

    // ── Env vars ──
    const envVars = await db('parser_env_vars').where({ session_id: id }).orderBy('var_name');
    const evIds = envVars.map((v: any) => v.id);
    const evRel = await enrichRelations('parser_env_var_relations', 'env_var_id', evIds);
    const evHits = await enrichRelations('parser_env_var_hits', 'env_var_id', evIds);
    const evVals = await enrichRelations('parser_env_var_values', 'env_var_id', evIds);
    const enrichedEnvVars = envVars.map((v: any) => enrichVar(v, evRel, evHits, evVals, 'env_var_id'));

    // ── Toolset vars ──
    const toolsetVars = await db('parser_toolset_vars').where({ session_id: id });
    const tvIds = toolsetVars.map((t: any) => t.id);
    const tvOpts = tvIds.length
      ? await db('parser_toolset_switch_opts').whereIn('toolset_var_id', tvIds).orderBy(['switch_key', 'opt_name'])
      : [];
    const enrichedToolset = toolsetVars.map((tv: any) => {
      const opts = tvOpts.filter((o: any) => o.toolset_var_id === tv.id);
      const grouped: Record<string, any[]> = {};
      for (const o of opts) {
        if (!grouped[o.switch_key]) grouped[o.switch_key] = [];
        grouped[o.switch_key].push(o);
      }
      return { ...tv, switchOpts: opts, switchOptsByKey: grouped };
    });

    // Module list & diagnostic summary
    const modules = new Set<string>();
    [...processedFiles, ...enrichedDefineVars, ...enrichedEnvVars].forEach((r: any) => {
      if (r.source_module) modules.add(r.source_module);
    });

    const diagnosticsSummary = {
      errors: enrichedDefineVars.filter((d: any) => d.diagnostic_level === 'error').length,
      warnings: enrichedDefineVars.filter((d: any) => d.diagnostic_level === 'warning').length,
      info: enrichedDefineVars.filter((d: any) => d.diagnostic_level === 'info').length,
    };

    res.json({
      ...session,
      session,
      processedFiles,
      includedFiles,
      defineVars: enrichedDefineVars,
      envVars: enrichedEnvVars,
      toolsetVars: enrichedToolset,
      modules: Array.from(modules),
      diagnosticsSummary,
    });
  } catch (error) {
    logger.error('Failed to load session', { error });
    res.status(500).json({ error: 'Failed to load session' });
  }
});

// ─────────────────────────── Delete session ───────────────────────────
router.delete('/sessions/:id', authenticate, async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await db('parser_sessions').where({ id }).del();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

// ─────────────────────────── CSV export ───────────────────────────

function generateCSV(rows: any[], cols: string[]): string {
  const header = cols.join(',');
  const lines = rows.map((r) =>
    cols.map((c) => {
      const v = r[c];
      if (v === null || v === undefined) return '';
      const s = String(v).replace(/"/g, '""');
      return /[,"\n]/.test(s) ? `"${s}"` : s;
    }).join(',')
  );
  return header + '\n' + lines.join('\n');
}

router.get('/sessions/:id/export', authenticate, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { sheet } = req.query;
  try {
    const session = await db('parser_sessions').where({ id }).first();
    if (!session) return res.status(404).json({ error: 'Session not found' });

    let csv = '';
    let fileName = 'export';
    if (sheet === 'processedFiles' || !sheet) {
      const rows = await db('parser_processed_files').where({ session_id: id });
      csv = generateCSV(rows, ['file_name', 'file_name_full', 'source_module', 'file_type', 'input_line_count', 'used_line_count', 'cond_if', 'cond_else', 'cond_elif', 'cond_endif', 'def_hit_count', 'macro_hit_count']);
      fileName = 'processed_files';
    } else if (sheet === 'includedFiles') {
      const rows = await db('parser_included_files').where({ session_id: id });
      csv = generateCSV(rows, ['include_type', 'include_file_name', 'source_module', 'source_file_name', 'source_line_number', 'source_line_ref']);
      fileName = 'included_files';
    } else if (sheet === 'defineVars') {
      const rows = await db('parser_define_vars').where({ session_id: id });
      csv = generateCSV(rows, ['var_name', 'first_hit_src', 'first_hit_var_type', 'first_hit_var_scope', 'first_hit_val_prop', 'source_module', 'source_file_name', 'source_line_number', 'diagnostic_level', 'diagnostic_message']);
      fileName = 'define_vars';
    } else if (sheet === 'envVars') {
      const rows = await db('parser_env_vars').where({ session_id: id });
      csv = generateCSV(rows, ['var_name', 'first_hit_src', 'first_hit_var_type', 'first_hit_var_scope', 'first_hit_val_prop', 'source_module', 'source_file_name', 'source_line_number']);
      fileName = 'env_vars';
    } else if (sheet === 'toolsetVars') {
      const rows = await db('parser_toolset_vars as tv')
        .join('parser_toolset_switch_opts as so', 'so.toolset_var_id', 'tv.id')
        .where('tv.session_id', id)
        .select('tv.toolset_name', 'so.switch_key', 'so.opt_name', 'so.opt_source', 'so.opt_value', 'so.opt_line_ref');
      csv = generateCSV(rows, ['toolset_name', 'switch_key', 'opt_name', 'opt_source', 'opt_value', 'opt_line_ref']);
      fileName = 'toolset_vars';
    } else {
      csv = '';
      fileName = 'empty';
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}.csv"`);
    res.send(csv);
  } catch (error) {
    logger.error('Export failed', { error });
    res.status(500).json({ error: 'Failed to export' });
  }
});

export default router;
