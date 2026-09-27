#!/usr/bin/env python3
"""Standing loops: gaps computed by code (never by an LLM) and the ticket template for each.

compute_gaps() -> {name: {"count": int, "sample": [..]}}
TEMPLATES[name] -> role, model, title, body; ticket_text(name, gap) builds the ticket.
Every loop ticket carries `**Target:** gap <name> <= 0` so sync.py re-queues it until the count is zero.

Loops are off by default (LOOPS_ENABLED=0). Turn them on once the Xavier pilot has proven the pipeline.
"""
from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent


def _orphaned_hooks() -> list:
    """show-controller/src/hooks/*.js that nothing imports."""
    hooks_dir = ROOT / "show-controller" / "src" / "hooks"
    src = ROOT / "show-controller" / "src"
    if not hooks_dir.exists():
        return []
    out = []
    for p in sorted(hooks_dir.glob("*.js")):
        name = p.stem
        pattern = rf"(hooks|\.)/{re.escape(name)}(\.js)?['\"]"
        r = subprocess.run(["grep", "-rlE", "--include=*.js", "--include=*.jsx", pattern, str(src)],
                           capture_output=True, text=True)
        importers = [f for f in r.stdout.splitlines() if not f.endswith(f"/hooks/{name}.js")]
        if not importers:
            out.append(f"show-controller/src/hooks/{name}.js")
    return out


def _graphics_without_renderer() -> list:
    """Registry entries whose renderer file or manifest does not exist."""
    reg = ROOT / "stage" / "graphics-registry.json"
    if not reg.exists():
        return []
    graphics = json.loads(reg.read_text()).get("graphics", {})
    out = []
    for gid, g in graphics.items():
        r = g.get("renderer")
        if r == "stage" and not (ROOT / "stage" / "graphics" / f"{gid}.json").exists():
            out.append(f"{gid} (renderer=stage, no stage/graphics/{gid}.json)")
        elif r == "overlay" and not (ROOT / "overlays" / f"{gid}.html").exists():
            out.append(f"{gid} (renderer=overlay, no overlays/{gid}.html)")
    return out


def _server_libs_untested() -> list:
    """server/lib/*.js with no test file in server/__tests__ or next to it."""
    libs = ROOT / "server" / "lib"
    tests = ROOT / "server" / "__tests__"
    if not libs.exists():
        return []
    tested = {p.name.replace(".test.js", "") for p in tests.glob("*.test.js")} if tests.exists() else set()
    tested |= {p.name.replace(".test.js", "") for p in libs.glob("*.test.js")}
    return [f"server/lib/{p.name}" for p in sorted(libs.glob("*.js"))
            if not p.name.endswith(".test.js") and p.stem not in tested]


GAP_FUNCS = {
    "orphaned-hooks": _orphaned_hooks,
    "graphics-without-renderer": _graphics_without_renderer,
    "server-libs-untested": _server_libs_untested,
}


def compute_gaps() -> dict:
    out = {}
    for name, fn in GAP_FUNCS.items():
        try:
            items = fn()
            out[name] = {"count": len(items), "sample": items[:10]}
        except Exception as e:  # a broken gap function must not take the dispatcher down
            out[name] = {"count": 0, "sample": [], "error": str(e)}
    return out


TEMPLATES = {
    "orphaned-hooks": {
        "role": "frontend", "model": "haiku",
        "title": "Loop: resolve orphaned hooks in show-controller/src/hooks",
        "body": (
            "**Question this answers:** which React hooks are dead code, and which are unfinished features?\n\n"
            "**Fills:** system map entries for the engines these hooks belong to (docs/system-map/*.md, Known gaps)\n\n"
            "**Inputs:** `python3 agent-team/tools/store.py gaps` lists the hooks nothing imports.\n\n"
            "**Do:** for each hook, decide with evidence (git log, the PRD folder, the system-map entry) whether it is superseded "
            "or unfinished. Superseded: delete it and note the removal in the system-map entry. Unfinished: leave it, and create "
            "a proposed ticket that names the feature it belongs to. One commit per decision.\n\n"
            "**Done when:**\n- [ ] every hook in the gap list is either deleted or has a proposed ticket\n- [ ] `npm run build` passes\n\n"
            "**Model:** haiku — mechanical, evidence is in git and docs\n\n"
            "**Target:** gap orphaned-hooks <= 0\n"
        ),
    },
    "graphics-without-renderer": {
        "role": "graphics", "model": "sonnet",
        "title": "Loop: registry graphics with no renderer file",
        "body": (
            "**Question this answers:** which registered graphics blank the screen because nothing renders them?\n\n"
            "**Fills:** Graphics rendering engine (docs/system-map/graphics-rendering.md, Known gaps)\n\n"
            "**Inputs:** `python3 agent-team/tools/store.py gaps` lists registry ids whose stage manifest or overlay file is missing.\n\n"
            "**Do:** for each id, either add the missing manifest/overlay following an existing one of the same category, or "
            "remove the registry entry from `scripts/buildGraphicsRegistry.js` sources if the graphic is dead. Preview each fixed "
            "graphic with `stage/stage.html?preview=full...` or the overlay URL and read the screenshot back.\n\n"
            "**Done when:**\n- [ ] the gap count is 0\n- [ ] each fixed graphic has a screenshot under docs/verification/<TICKET>/\n\n"
            "**Model:** sonnet — needs judgment about which renderer pattern to copy\n\n"
            "**Target:** gap graphics-without-renderer <= 0\n"
        ),
    },
    "server-libs-untested": {
        "role": "server", "model": "sonnet",
        "title": "Loop: unit tests for untested server/lib modules",
        "body": (
            "**Question this answers:** which server modules can change safely?\n\n"
            "**Fills:** Coordinator server engine (docs/system-map/coordinator-server.md) and each lib's own engine entry\n\n"
            "**Inputs:** `python3 agent-team/tools/store.py gaps` lists server/lib files with no test.\n\n"
            "**Do:** pick the three highest-risk untested modules (engines first: timesheetEngine, playoutEngine, then anything "
            "Producer View calls). Write `server/__tests__/<name>.test.js` with `node --test`, covering the public functions with "
            "the smallest fixtures that exercise real branches. Do not mock what you can call. When turns run low, create a "
            "follow-up ticket with the same Target line.\n\n"
            "**Done when:**\n- [ ] three new test files pass under `cd server && npm test`\n- [ ] a follow-up ticket exists if the gap is still above 0\n\n"
            "**Model:** sonnet\n\n"
            "**Target:** gap server-libs-untested <= 0\n"
        ),
    },
}


def ticket_text(name: str, gap: dict):
    tpl = TEMPLATES[name]
    sample = "\n".join(f"- {s}" for s in gap.get("sample", [])) or "- (see store.py gaps)"
    body = tpl["body"] + f"\n**Current count:** {gap.get('count', 0)}\n\n**Sample:**\n{sample}\n"
    return tpl["title"], body


if __name__ == "__main__":
    print(json.dumps(compute_gaps(), indent=1))
