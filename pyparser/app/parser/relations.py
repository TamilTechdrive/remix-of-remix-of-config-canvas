"""
Resolve ToolsetVars (-D switches) ↔ DefineVars ↔ EnvVars relationships.

The three concepts are linked:

* `ToolsetVars[*].SWOpt["D"][NAME]`  → the same NAME may appear in `DefineVars`
* `DefineVars[NAME].EnvParList` / `EnvSibList`  → reference `EnvVars`
* `EnvVars[NAME].RefList`                       → references back into DefineVars
"""
from typing import Iterable
import uuid


def _id() -> str:
    return uuid.uuid4().hex


def toolset_define_links(
    session_id: str,
    toolset_switch_rows: list[dict],
    define_name_to_id: dict[str, str],
) -> Iterable[dict]:
    """For every `-D NAME` in toolset switches, link to its DefineVars row if present."""
    for sw in toolset_switch_rows:
        if sw.get("switch") != "D":
            continue
        define_id = define_name_to_id.get(sw["value"])
        if define_id:
            yield {
                "id": _id(),
                "session_id": session_id,
                "toolset_switch_id": sw["id"],
                "define_var_id": define_id,
                "relation": "toolset_defines",
            }


def envvar_define_links(
    session_id: str,
    define_name_to_id: dict[str, str],
    env_name_to_id: dict[str, str],
    define_raw: dict[str, dict],
) -> Iterable[dict]:
    """Walk DefineVars[*].EnvParList / EnvSibList → produce link rows."""
    for dname, draw in define_raw.items():
        define_id = define_name_to_id.get(dname)
        if not define_id:
            continue
        for kind in ("EnvParList", "EnvSibList"):
            for env_name in (draw.get(kind) or []):
                env_id = env_name_to_id.get(env_name)
                if env_id:
                    yield {
                        "id": _id(),
                        "session_id": session_id,
                        "env_var_id": env_id,
                        "define_var_id": define_id,
                        "relation": "parent" if kind == "EnvParList" else "sibling",
                    }


def envvar_ref_links(
    session_id: str,
    env_raw: dict[str, dict],
    define_name_to_id: dict[str, str],
    env_name_to_id: dict[str, str],
) -> Iterable[dict]:
    """EnvVars[*].RefList → link back to DefineVars when name overlaps."""
    for ename, eraw in env_raw.items():
        env_id = env_name_to_id.get(ename)
        if not env_id:
            continue
        for ref in (eraw.get("RefList") or []):
            define_id = define_name_to_id.get(ref)
            if define_id:
                yield {
                    "id": _id(),
                    "session_id": session_id,
                    "env_var_id": env_id,
                    "define_var_id": define_id,
                    "relation": "ref",
                }
