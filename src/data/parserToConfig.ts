/**
 * Converts MakeOptCCPPFileParser JSON data into RawConfig format.
 *
 * Supports updated JSON with:
 *   ProcessedFiles (keyed by FileType), MOFP.IncFiles, CSHFP.IncFiles,
 *   EnvVars, DefineVars (with HitSrc/VarScope/ValProp/RefList/EnvParList/EnvSibList),
 *   ToolsetVars (CFLAGS with SWOpt)
 *
 * Mapping:
 *   Container = Parser Session Root
 *   Module    = Source Module (eDBE, epress, Simple, etc.)
 *   Group     = VarType category per source file
 *   Option    = Individual DefineVar / EnvVar
 */
import type { RawConfig, RawModule, RawGroup, RawOption, RawRule } from './sampleConfig';

// ── Type Interfaces ──

interface ParserProcessedFile {
  FileType: number;
  FName: string;
  FNameFull: string;
  StartTS?: number;
  EndTS?: number;
  TimeDelta?: number;
  InpLC: number;
  UsedLC?: number;
  EmpLC?: number;
  EmpCmtLC?: number;
  MultLC?: number;
  MaxLL?: number;
  MinLL?: number;
  MaxLNR?: string;
  MinLNR?: string;
  CondIf: number;
  CondElif?: number;
  CondElse: number;
  CondEndif: number;
  CondNestBlk: number;
  AssignDir?: number;
  AssignRHS?: number;
  DefVarCnt?: number;
  DefHitCnt: number;
  UndefHitCnt?: number;
  CtlDefHitCnt?: number;
  MacroHitCnt: number;
  CompOptDef?: number;
  CompOptInc?: number;
  [key: string]: unknown;
}

interface VarHitInfo {
  HitSrc?: string;
  VarType?: string;
  VarScope?: string;
  ValProp?: string;
  HitSrcScope?: string;
  HitMode?: string;
  HitFlags?: number;
  Depth?: number;
  HitSLNR?: string;
  CondOrd?: {
    OrdDepth: number;
    CondDir: string;
    CondSLNR: string;
  };
}

interface ParserVar {
  '1stHitInfo': VarHitInfo;
  AllHitInfo: VarHitInfo[];
  ParList: string[];
  SibList: string[];
  ChList: string[];
  RefList?: string[];
  EnvParList?: string[];
  EnvSibList?: string[];
  ValEntries: Record<string, any[]>;
  LastHitSLNR?: string;
}

interface ToolsetSWOpt {
  [switchKey: string]: Record<string, Array<[string, string, string]>>;
}

interface ToolsetVar {
  SrcLineNoRef?: string;
  SWOpt?: ToolsetSWOpt;
}

interface ParserJSON {
  ProcessedFiles: Record<string, ParserProcessedFile[]> | ParserProcessedFile[];
  'MOFP.IncFiles'?: Array<{ IncFName: string; SrcLineRef: string }>;
  'CSHFP.IncFiles'?: Array<{ IncFName: string; SrcLineRef: string }>;
  IncludedFiles?: Array<{ IncFName: string; SrcLineRef: string }>;
  EnvVars?: Record<string, ParserVar>;
  DefineVars: Record<string, ParserVar>;
  ToolsetVars?: Record<string, ToolsetVar>;
}

// ── Utilities ──

function extractSourceFile(slnr: string): string {
  if (!slnr) return 'unknown';
  const parts = slnr.split(':#');
  const filePath = parts[0] || 'unknown';
  const segments = filePath.replace(/\\\\/g, '\\').replace(/\//g, '\\').split('\\');
  return segments[segments.length - 1] || filePath;
}

function extractLineNumber(slnr: string): number {
  if (!slnr) return 0;
  const parts = slnr.split(':#');
  return parseInt(parts[1] || '0', 10) || 0;
}

function extractModule(filePath: string): string {
  if (!filePath) return 'unknown';
  const normalized = filePath.replace(/\\\\/g, '\\').replace(/\//g, '\\');
  const parts = normalized.split('\\');
  const samplesIdx = parts.findIndex(p => p.toLowerCase() === 'samples');
  if (samplesIdx >= 0 && parts.length > samplesIdx + 1) {
    return parts[samplesIdx + 1];
  }
  if (parts.length >= 2) return parts[parts.length >= 3 ? parts.length - 3 : 0];
  return 'unknown';
}

// Flatten ProcessedFiles (may be keyed by FileType or flat array)
function flattenProcessedFiles(pf: Record<string, ParserProcessedFile[]> | ParserProcessedFile[]): ParserProcessedFile[] {
  if (Array.isArray(pf)) return pf;
  const result: ParserProcessedFile[] = [];
  for (const [, files] of Object.entries(pf)) {
    if (Array.isArray(files)) result.push(...files);
    else result.push(files as unknown as ParserProcessedFile);
  }
  return result;
}

const VAR_TYPE_GROUPS: Record<string, string> = {
  'TYP-MOFP_DEF': 'MOFP Definitions',
  'TYP-CSHFP_DEF': 'CSHFP Definitions',
  'TYP-CSHFP_CTL': 'CSHFP Control Flags',
  DEFINITION: 'Definitions (#define)',
  MACRO: 'Macros (#define func)',
  CONDITIONAL: 'Conditional (#if/#ifdef)',
  CONTROL: 'Control Flags',
  ABS_VAL_CONST: 'Absolute Value Constants',
  REF_DERIVED_VAL: 'Derived/Referenced Values',
  MACRO_FUNC: 'Macro Functions',
};

// ── Main Converter ──

export function parserJsonToRawConfig(data: ParserJSON, sessionName?: string): RawConfig {
  const defineVars = data.DefineVars || {};
  const envVars = data.EnvVars || {};
  const processedFiles = flattenProcessedFiles(data.ProcessedFiles || []);
  const toolsetVars = data.ToolsetVars || {};

  // Combine all includes
  const allIncludes = [
    ...(data['MOFP.IncFiles'] || []).map(i => ({ ...i, type: 'MOFP' })),
    ...(data['CSHFP.IncFiles'] || []).map(i => ({ ...i, type: 'CSHFP' })),
    ...(data.IncludedFiles || []).map(i => ({ ...i, type: 'MOFP' })),
  ];

  const includesBySource: Record<string, { name: string; lineRef: string; lineNumber: number; type: string }[]> = {};
  for (const inc of allIncludes) {
    const srcFile = extractSourceFile(inc.SrcLineRef);
    if (!includesBySource[srcFile]) includesBySource[srcFile] = [];
    includesBySource[srcFile].push({
      name: inc.IncFName.replace(/"/g, ''),
      lineRef: inc.SrcLineRef,
      lineNumber: extractLineNumber(inc.SrcLineRef),
      type: inc.type,
    });
  }

  // Group processed files by module
  const filesByModule: Record<string, ParserProcessedFile[]> = {};
  for (const pf of processedFiles) {
    const mod = extractModule(pf.FNameFull);
    if (!filesByModule[mod]) filesByModule[mod] = [];
    filesByModule[mod].push(pf);
  }

  // Group vars by module and source file
  function groupVarsByModuleFile(vars: Record<string, ParserVar>) {
    const result: Record<string, Record<string, { varName: string; varData: ParserVar }[]>> = {};
    for (const [varName, varData] of Object.entries(vars)) {
      const slnr = varData['1stHitInfo']?.HitSLNR || '';
      const mod = extractModule(slnr.split(':#')[0] || '');
      const sourceFile = extractSourceFile(slnr);
      if (!result[mod]) result[mod] = {};
      if (!result[mod][sourceFile]) result[mod][sourceFile] = [];
      result[mod][sourceFile].push({ varName, varData });
    }
    return result;
  }

  const defineVarsByModFile = groupVarsByModuleFile(defineVars);
  const envVarsByModFile = groupVarsByModuleFile(envVars);

  let groupIdCounter = 10;
  let optionIdCounter = 100;

  const allModuleNames = new Set<string>();
  Object.keys(filesByModule).forEach(m => allModuleNames.add(m));
  Object.keys(defineVarsByModFile).forEach(m => allModuleNames.add(m));
  Object.keys(envVarsByModFile).forEach(m => allModuleNames.add(m));

  const modules: RawModule[] = Array.from(allModuleNames).map((moduleName) => {
    const moduleFiles = filesByModule[moduleName] || [];
    const moduleDefineVars = defineVarsByModFile[moduleName] || {};
    const moduleEnvVars = envVarsByModFile[moduleName] || {};

    const groups: RawGroup[] = [];
    const rules: RawRule[] = [];

    // Groups from DefineVars
    for (const pf of moduleFiles) {
      const fileName = pf.FName;
      const fileVars = moduleDefineVars[fileName] || [];
      const fileEnvVars = moduleEnvVars[fileName] || [];

      // Group DefineVars by VarType
      const varsByType: Record<string, { varName: string; varData: ParserVar }[]> = {};
      for (const v of fileVars) {
        const varType = v.varData['1stHitInfo']?.VarType || 'UNKNOWN';
        if (!varsByType[varType]) varsByType[varType] = [];
        varsByType[varType].push(v);
      }

      for (const [varType, vars] of Object.entries(varsByType)) {
        const groupId = groupIdCounter++;
        const options: RawOption[] = vars.map((v) => {
          const optId = optionIdCounter++;
          const hitScope = v.varData['1stHitInfo']?.VarScope || '';
          const hasCondOrd = !!v.varData['1stHitInfo']?.CondOrd;
          return {
            id: optId,
            key: v.varName.toLowerCase(),
            name: v.varName,
            editable: true,
            included: hitScope.includes('LHS') && !hasCondOrd,
          };
        });
        groups.push({ id: groupId, name: `${fileName} → ${VAR_TYPE_GROUPS[varType] || varType}`, options });
      }

      // Group EnvVars by VarType
      if (fileEnvVars.length > 0) {
        const envByType: Record<string, { varName: string; varData: ParserVar }[]> = {};
        for (const v of fileEnvVars) {
          const varType = v.varData['1stHitInfo']?.VarType || 'ENV';
          if (!envByType[varType]) envByType[varType] = [];
          envByType[varType].push(v);
        }
        for (const [varType, vars] of Object.entries(envByType)) {
          groups.push({
            id: groupIdCounter++,
            name: `${fileName} → EnvVars (${VAR_TYPE_GROUPS[varType] || varType})`,
            options: vars.map(v => ({
              id: optionIdCounter++,
              key: `env_${v.varName.toLowerCase()}`,
              name: `[ENV] ${v.varName}`,
              editable: true,
              included: true,
            })),
          });
        }
      }

      // File properties for files with no vars
      if (Object.keys(varsByType).length === 0 && fileEnvVars.length === 0 &&
          (pf.CondNestBlk > 0 || pf.DefHitCnt > 0 || pf.MacroHitCnt > 0)) {
        groups.push({
          id: groupIdCounter++,
          name: `${fileName} → File Properties`,
          options: [
            { id: optionIdCounter++, key: `${fileName}_cond_blocks`, name: `Conditional Blocks (${pf.CondNestBlk})`, editable: false, included: pf.CondNestBlk > 0 },
            { id: optionIdCounter++, key: `${fileName}_def_hits`, name: `Define Hits (${pf.DefHitCnt})`, editable: false, included: pf.DefHitCnt > 0 },
            { id: optionIdCounter++, key: `${fileName}_macros`, name: `Macros (${pf.MacroHitCnt})`, editable: false, included: pf.MacroHitCnt > 0 },
          ],
        });
      }

      // Rules from relationships (DefineVars)
      for (const v of fileVars) {
        const optionKey = v.varName.toLowerCase();
        if (v.varData.ParList?.length > 0) {
          rules.push({
            option_key: optionKey,
            requires: v.varData.ParList.map(p => p.toLowerCase()),
            suggestion: `${v.varName} depends on: ${v.varData.ParList.join(', ')}`,
            impact_level: 'high',
            tags: ['dependency', v.varData['1stHitInfo']?.VarType?.toLowerCase() || 'unknown'],
          });
        }
        if (v.varData.EnvParList?.length) {
          rules.push({
            option_key: optionKey,
            requires: v.varData.EnvParList.map(p => `env_${p.toLowerCase()}`),
            suggestion: `${v.varName} depends on EnvVar(s): ${v.varData.EnvParList.join(', ')}`,
            impact_level: 'high',
            tags: ['env-dependency'],
          });
        }
        if (v.varData.SibList?.length > 0) {
          rules.push({
            option_key: optionKey,
            requires: v.varData.SibList.map(s => s.toLowerCase()),
            suggestion: `${v.varName} sibling(s): ${v.varData.SibList.join(', ')}`,
            impact_level: 'low',
            tags: ['sibling'],
          });
        }
        if (v.varData['1stHitInfo']?.CondOrd) {
          const condDir = v.varData['1stHitInfo'].CondOrd.CondDir;
          if (condDir?.includes('else')) {
            rules.push({
              option_key: optionKey,
              must_disable: true,
              suggestion: `${v.varName} is in #${condDir} branch — conditionally excluded`,
              impact_level: 'medium',
              tags: ['conditional', condDir],
            });
          }
        }
      }
    }

    const states: Record<string, Record<string, string>> = {
      idle: { PARSE: 'processing' },
      processing: { COMPLETE: 'resolved', ERROR: 'error' },
      resolved: { REPARSE: 'processing' },
      error: { RETRY: 'processing', RESET: 'idle' },
    };

    return {
      id: `module_${moduleName.replace(/[^a-zA-Z0-9]/g, '_')}`,
      name: moduleName,
      initial: 'idle',
      groups,
      rules,
      states,
    };
  });

  // Add a Toolset module if toolset vars exist
  if (Object.keys(toolsetVars).length > 0) {
    const toolsetGroups: RawGroup[] = [];
    for (const [tsName, tsData] of Object.entries(toolsetVars)) {
      if (tsData.SWOpt) {
        for (const [swKey, entries] of Object.entries(tsData.SWOpt)) {
          const options: RawOption[] = Object.entries(entries).map(([optName]) => ({
            id: optionIdCounter++,
            key: `ts_${tsName}_${swKey}_${optName}`.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
            name: `-${swKey}${optName}`,
            editable: swKey === 'D',
            included: true,
          }));
          if (options.length > 0) {
            toolsetGroups.push({
              id: groupIdCounter++,
              name: `${tsName} → -${swKey} options`,
              options,
            });
          }
        }
      }
    }
    if (toolsetGroups.length > 0) {
      modules.push({
        id: 'module_toolset',
        name: 'Toolset (Compiler Options)',
        initial: 'idle',
        groups: toolsetGroups,
        rules: [],
        states: { idle: { PARSE: 'processing' }, processing: { COMPLETE: 'resolved' }, resolved: { REPARSE: 'processing' } },
      });
    }
  }

  return { modules };
}

/**
 * Converts backend session detail into RawConfig format.
 */
export function sessionDetailToRawConfig(detail: any): RawConfig {
  const parserJson: ParserJSON = {
    ProcessedFiles: (detail.processedFiles || []).map((f: any) => ({
      FileType: f.file_type,
      FName: f.file_name,
      FNameFull: f.file_name_full,
      CondIf: f.cond_if,
      CondElif: f.cond_elif || 0,
      CondElse: f.cond_else,
      CondEndif: f.cond_endif,
      CondNestBlk: f.cond_nest_block,
      DefHitCnt: f.def_hit_count,
      MacroHitCnt: f.macro_hit_count,
      InpLC: f.input_line_count,
      UsedLC: f.used_line_count,
      TimeDelta: f.time_delta,
    })),
    'MOFP.IncFiles': (detail.includedFiles || []).filter((i: any) => i.include_type === 'MOFP').map((inc: any) => ({
      IncFName: inc.include_file_name,
      SrcLineRef: inc.source_line_ref,
    })),
    'CSHFP.IncFiles': (detail.includedFiles || []).filter((i: any) => i.include_type === 'CSHFP').map((inc: any) => ({
      IncFName: inc.include_file_name,
      SrcLineRef: inc.source_line_ref,
    })),
    EnvVars: {},
    DefineVars: {},
    ToolsetVars: {},
  };

  // Map EnvVars
  for (const ev of (detail.envVars || [])) {
    parserJson.EnvVars![ev.var_name] = _mapVarToParserFormat(ev);
  }

  // Map DefineVars
  for (const dv of (detail.defineVars || [])) {
    parserJson.DefineVars[dv.var_name] = _mapVarToParserFormat(dv);
  }

  // Map ToolsetVars
  for (const tv of (detail.toolsetVars || [])) {
    const swOpt: ToolsetSWOpt = {};
    if (tv.switchOptsByKey) {
      for (const [swKey, opts] of Object.entries(tv.switchOptsByKey as Record<string, any[]>)) {
        swOpt[swKey] = {};
        for (const opt of opts) {
          if (!swOpt[swKey][opt.opt_name]) swOpt[swKey][opt.opt_name] = [];
          swOpt[swKey][opt.opt_name].push([opt.opt_source, opt.opt_value, opt.opt_line_ref]);
        }
      }
    }
    parserJson.ToolsetVars![tv.toolset_name] = {
      SrcLineNoRef: tv.src_line_ref,
      SWOpt: swOpt,
    };
  }

  return parserJsonToRawConfig(parserJson, detail.session?.session_name);
}

function _mapVarToParserFormat(v: any): ParserVar {
  return {
    '1stHitInfo': {
      HitSrc: v.first_hit_src || '',
      VarType: v.first_hit_var_type || '',
      VarScope: v.first_hit_var_scope || v.first_hit_src_scope || '',
      ValProp: v.first_hit_val_prop || '',
      HitSLNR: v.first_hit_slnr || '',
      HitFlags: v.first_hit_flags || 0,
      ...(v.cond_ord_depth != null ? {
        CondOrd: {
          OrdDepth: v.cond_ord_depth,
          CondDir: v.cond_ord_dir || '',
          CondSLNR: v.cond_ord_slnr || '',
        },
      } : {}),
    },
    AllHitInfo: (v.allHits || []).map((h: any) => ({
      HitSrc: h.hit_src,
      VarType: h.var_type,
      VarScope: h.var_scope,
      ValProp: h.val_prop,
      HitMode: h.hit_mode,
      HitFlags: h.hit_flags,
      Depth: h.depth,
      HitSLNR: h.hit_slnr,
      ...(h.cond_ord_depth != null ? {
        CondOrd: { OrdDepth: h.cond_ord_depth, CondDir: h.cond_ord_dir, CondSLNR: h.cond_ord_slnr },
      } : {}),
    })),
    ParList: v.parents || [],
    SibList: v.siblings || [],
    ChList: v.children || [],
    RefList: v.refs || [],
    EnvParList: v.envParents || [],
    EnvSibList: v.envSiblings || [],
    ValEntries: (v.valEntries || []).reduce((acc: Record<string, any[]>, ve: any) => {
      acc[ve.value_key] = typeof ve.value_items === 'string' ? JSON.parse(ve.value_items) : (ve.value_items || []);
      return acc;
    }, {}),
    LastHitSLNR: v.last_hit_slnr || '',
  };
}
