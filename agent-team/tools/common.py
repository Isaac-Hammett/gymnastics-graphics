#!/usr/bin/env python3
"""Shared helpers for the agent team: paths, env loading, model resolution, subagent JSON.

Paths resolve to the canonical checkout even when a tool runs from a ticket worktree: agent_run.sh exports
GG_TEAM_DIR / GG_ROOT, and every copy of these tools honors them.

CLI:
  common.py model <role> [labels,comma,separated] [override]   -> prints model, then fallback (or empty line)
  common.py agents-json                                         -> the --agents JSON built from subagents/*.md
  common.py export-env                                          -> `export K='v'` lines for models.conf + .env + GG_* paths
  common.py env NAME [default]
"""
from __future__ import annotations

import json
import os
import re
import shlex
import sys
from pathlib import Path

_HERE = Path(__file__).resolve().parent.parent
TEAM_DIR = Path(os.environ["GG_TEAM_DIR"]) if os.environ.get("GG_TEAM_DIR") and Path(os.environ["GG_TEAM_DIR"]).is_dir() else _HERE
ROOT = Path(os.environ["GG_ROOT"]) if os.environ.get("GG_ROOT") and Path(os.environ["GG_ROOT"]).is_dir() else TEAM_DIR.parent
RUNS = TEAM_DIR / "runs"
LOGS = TEAM_DIR / "logs"
AGENTS = TEAM_DIR / "agents"
SUBAGENTS = TEAM_DIR / "subagents"


def _parse_kv(path: Path) -> dict:
    out = {}
    if not path.exists():
        return out
    for line in path.read_text().splitlines():
        s = line.strip()
        if not s or s.startswith("#") or "=" not in s:
            continue
        k, v = s.split("=", 1)
        v = v.strip()
        # allow trailing "  # comment" but keep '#' inside quoted values
        if v.startswith('"') and v.count('"') >= 2:
            v = v[1:v.index('"', 1)]
        elif v.startswith("'") and v.count("'") >= 2:
            v = v[1:v.index("'", 1)]
        else:
            v = re.split(r"\s+#", v, 1)[0].strip()
        out[k.strip()] = v
    return out


def config() -> dict:
    """models.conf first, then .env (which overrides)."""
    conf = _parse_kv(TEAM_DIR / "models.conf")
    conf.update(_parse_kv(TEAM_DIR / ".env"))
    return conf


def load_env() -> dict:
    """Put models.conf + .env into os.environ without overriding what is already set."""
    conf = config()
    for k, v in conf.items():
        os.environ.setdefault(k, v)
    return conf


def env(name: str, default=None):
    v = os.environ.get(name)
    return default if v in (None, "") else v


def env_int(name: str, default) -> int:
    try:
        return int(env(name, default))
    except (TypeError, ValueError):
        return int(default)


def worktrees_dir() -> Path:
    """Outside the repo, so agents do not load the root CLAUDE.md twice and repo-wide searches skip agent copies."""
    load_env()
    w = env("WORKTREES_DIR")
    if w:
        return Path(w).expanduser()
    return ROOT.parent / f"{ROOT.name}-worktrees"


def aliases() -> dict:
    load_env()
    return {k[len("MODEL_alias_"):]: v for k, v in os.environ.items() if k.startswith("MODEL_alias_")}


def resolve_model(role: str, labels=(), override=None) -> str:
    """Precedence: override > model:<alias> label > MODEL_<role> > MODEL_DEFAULT."""
    load_env()
    al = aliases()

    def expand(m):
        return al.get(m, m)

    if override:
        return expand(override)
    for l in labels:
        if l.startswith("model:"):
            return expand(l[len("model:"):])
    return expand(env(f"MODEL_{role}") or env("MODEL_DEFAULT", "claude-sonnet-5"))


def fallback_model(primary: str):
    load_env()
    fb = env("FALLBACK_MODEL")
    return fb if fb and fb != primary else None


def parse_frontmatter(text: str):
    m = re.match(r"^---\n(.*?)\n---\n(.*)$", text, re.S)
    if not m:
        return {}, text
    meta = {}
    for line in m.group(1).splitlines():
        if ":" in line:
            k, v = line.split(":", 1)
            meta[k.strip()] = v.strip()
    return meta, m.group(2)


def subagents_json() -> dict:
    """Build the --agents JSON from subagents/*.md (frontmatter: name, description, tools, model, maxTurns)."""
    out = {}
    for p in sorted(SUBAGENTS.glob("*.md")):
        meta, body = parse_frontmatter(p.read_text())
        name = meta.get("name", p.stem)
        entry = {"description": meta.get("description", name), "prompt": body.strip()}
        if meta.get("tools"):
            entry["tools"] = [t.strip() for t in meta["tools"].split(",") if t.strip()]
        if meta.get("model"):
            entry["model"] = meta["model"]
        if meta.get("maxTurns"):
            try:
                entry["maxTurns"] = int(meta["maxTurns"])
            except ValueError:
                pass
        out[name] = entry
    return out


def session_name(key: str) -> str:
    """tmux session for a run key (ISA2-12, ISA2-12.verify, PLANNER, REVIEWER). tmux forbids '.' in names."""
    return "gg-" + key.replace(".", "-")


def key_from_session(sess: str) -> str:
    k = sess[len("gg-"):]
    return k[:-len("-verify")] + ".verify" if k.endswith("-verify") else k


def main(argv):
    load_env()
    cmd = argv[1] if len(argv) > 1 else ""
    if cmd == "model":
        role = argv[2]
        labels = argv[3].split(",") if len(argv) > 3 and argv[3] else []
        override = argv[4] if len(argv) > 4 and argv[4] else None
        m = resolve_model(role, labels, override)
        print(m)
        print(fallback_model(m) or "")
    elif cmd == "agents-json":
        print(json.dumps(subagents_json()))
    elif cmd == "export-env":
        for k, v in config().items():
            if k not in os.environ or os.environ.get(k) == v:
                print(f"export {k}={shlex.quote(v)}")
        print(f"export GG_TEAM_DIR={shlex.quote(str(TEAM_DIR))}")
        print(f"export GG_ROOT={shlex.quote(str(ROOT))}")
        print(f"export GG_WORKTREES={shlex.quote(str(worktrees_dir()))}")
    elif cmd == "env":
        print(env(argv[2], argv[3] if len(argv) > 3 else ""))
    else:
        print(__doc__)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
