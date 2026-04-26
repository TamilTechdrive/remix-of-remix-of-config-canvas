"""
Row builders that normalize the raw JSON shapes coming from the C/C++
preprocessor parser (MOFP/CSHFP) into flat rows that fit the existing
parser_* schema (see backend migration 006_parser_full_json.ts and
phpbackend2/sql/mysql_schema.sql).
"""
from typing import Any, Iterable
import uuid


def _id() -> str:
    return uuid.uuid4().hex


def processed_file_row(session_id: str, file_type: str, raw: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": _id(),
        "session_id": session_id,
        "file_type": int(file_type) if str(file_type).isdigit() else None,
        "fname": raw.get("FName"),
        "fname_full": raw.get("FNameFull"),
        "start_ts": raw.get("StartTS"),
        "end_ts": raw.get("EndTS"),
        "time_delta": raw.get("TimeDelta"),
        "inp_lc": raw.get("InpLC"),
        "used_lc": raw.get("UsedLC"),
        "emp_lc": raw.get("EmpLC") or raw.get("EmpCmtLC"),
        "mult_lc": raw.get("MultLC"),
        "max_ll": raw.get("MaxLL"),
        "min_ll": raw.get("MinLL"),
        "max_lnr": raw.get("MaxLNR"),
        "min_lnr": raw.get("MinLNR"),
        "cond_if": raw.get("CondIf"),
        "cond_elif": raw.get("CondElif"),
        "cond_else": raw.get("CondElse"),
        "cond_endif": raw.get("CondEndif"),
        "cond_nest_blk": raw.get("CondNestBlk"),
        "def_var_cnt": raw.get("DefVarCnt"),
        "def_hit_cnt": raw.get("DefHitCnt"),
        "undef_hit_cnt": raw.get("UndefHitCnt"),
        "ctl_def_hit_cnt": raw.get("CtlDefHitCnt"),
        "macro_hit_cnt": raw.get("MacroHitCnt"),
        "raw_json": None,
    }


def included_file_row(session_id: str, parser_kind: str, raw: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": _id(),
        "session_id": session_id,
        "parser_kind": parser_kind,  # MOFP | CSHFP
        "fname": raw.get("FName"),
        "fname_full": raw.get("FNameFull"),
        "include_kind": raw.get("IncKind"),
        "ref_count": raw.get("RefCnt"),
        "first_hit_src": raw.get("FirstHitSrc"),
        "raw_json": None,
    }


def define_var_row(session_id: str, name: str, raw: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": _id(),
        "session_id": session_id,
        "name": name,
        "first_hit_src": raw.get("FirstHitSrc") or raw.get("SrcLineNoRef"),
        "hit_count": raw.get("HitCnt") or len(raw.get("HitList") or []),
        "value": (raw.get("Value") if isinstance(raw.get("Value"), (str, int, float)) else None),
        "is_macro": bool(raw.get("IsMacro", False)),
        "raw_json": None,
    }


def env_var_row(session_id: str, name: str, raw: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": _id(),
        "session_id": session_id,
        "name": name,
        "first_hit_src": raw.get("FirstHitSrc") or raw.get("SrcLineNoRef"),
        "hit_count": raw.get("HitCnt") or len(raw.get("HitList") or []),
        "raw_json": None,
    }


def toolset_var_row(session_id: str, name: str, raw: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": _id(),
        "session_id": session_id,
        "name": name,
        "src_line_no_ref": raw.get("SrcLineNoRef"),
        "raw_json": None,
    }


def toolset_switch_rows(toolset_id: str, sw_opt: dict[str, Any]) -> Iterable[dict[str, Any]]:
    """
    SWOpt shape:
        { "I": {"/path": [["INTERNAL","","src:#1"], ...] },
          "D": {"BROWSER_RTE": [["INTERNAL","","src:#5"]]},
          ... }
    """
    if not isinstance(sw_opt, dict):
        return
    for switch, values in sw_opt.items():
        if not isinstance(values, dict):
            continue
        for value, occurrences in values.items():
            if not isinstance(occurrences, list):
                continue
            for occ in occurrences:
                if not isinstance(occ, list):
                    continue
                yield {
                    "id": _id(),
                    "toolset_id": toolset_id,
                    "switch": switch,            # I | D | U | L | l | ...
                    "value": value,              # macro name or path
                    "scope": occ[0] if len(occ) > 0 else None,
                    "extra": occ[1] if len(occ) > 1 else None,
                    "src_line_no_ref": occ[2] if len(occ) > 2 else None,
                }
