#!/usr/bin/env python3
"""Tokens and cost per run and per model.

Primary source: runs/*.result.json, the exact `result` event claude prints at the end of each run
(saved by streamlog.py). Fallback: --transcripts scans ~/.claude/projects/<escaped repo path>*/**/*.jsonl,
labels each session by the "# Your ticket\\n# KEY" header in its first user message, and estimates cost
from a price table.

Usage: usage.py [--since 6h|2d|30m] [--by-run N] [--transcripts]
"""
from __future__ import annotations

import argparse
import json
import re
import sys
import time
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import ROOT, RUNS  # noqa: E402

# $ per million tokens: (input, output). Cache reads bill at 10% of input, cache writes at 125%.
PRICES = {
    "claude-haiku-4-5": (1.0, 5.0),
    "claude-sonnet-5": (2.0, 10.0),
    "claude-opus-5-5": (4.0, 20.0),
    "claude-opus-5": (5.0, 25.0),
    "claude-fable-5-1": (10.0, 50.0),
}


def price_for(model: str):
    for k, v in PRICES.items():
        if model.startswith(k):
            return v
    return (5.0, 25.0)


def parse_since(s: str) -> float:
    if not s:
        return 0.0
    m = re.match(r"^(\d+)([mhd])$", s)
    if not m:
        raise SystemExit("--since wants e.g. 30m, 6h, 2d")
    n, u = int(m.group(1)), m.group(2)
    return time.time() - n * {"m": 60, "h": 3600, "d": 86400}[u]


def from_results(since: float):
    runs = []
    per_model = defaultdict(lambda: {"in": 0, "out": 0, "cache_read": 0, "cache_write": 0, "cost": 0.0})
    for p in sorted(RUNS.glob("*.result.json")):
        if p.stat().st_mtime < since:
            continue
        try:
            ev = json.loads(p.read_text())
        except json.JSONDecodeError:
            continue
        key = p.name[:-len(".result.json")]
        cost = float(ev.get("total_cost_usd") or 0)
        runs.append({"key": key, "cost": cost, "turns": ev.get("num_turns"), "ms": ev.get("duration_ms"),
                     "when": time.strftime("%m-%d %H:%M", time.localtime(p.stat().st_mtime))})
        mu = ev.get("modelUsage") or {}
        if mu:
            for model, u in mu.items():
                pm = per_model[model]
                pm["in"] += u.get("inputTokens", 0); pm["out"] += u.get("outputTokens", 0)
                pm["cache_read"] += u.get("cacheReadInputTokens", 0); pm["cache_write"] += u.get("cacheCreationInputTokens", 0)
                pm["cost"] += float(u.get("costUSD", 0) or 0)
        else:
            u = ev.get("usage") or {}
            pm = per_model["(unattributed)"]
            pm["in"] += u.get("input_tokens", 0); pm["out"] += u.get("output_tokens", 0)
            pm["cache_read"] += u.get("cache_read_input_tokens", 0); pm["cache_write"] += u.get("cache_creation_input_tokens", 0)
            pm["cost"] += cost
    return runs, per_model


def from_transcripts(since: float):
    escaped = str(ROOT).replace("/", "-")
    base = Path.home() / ".claude" / "projects"
    runs = defaultdict(lambda: {"cost": 0.0, "turns": 0, "models": set(), "when": ""})
    per_model = defaultdict(lambda: {"in": 0, "out": 0, "cache_read": 0, "cache_write": 0, "cost": 0.0})
    for proj in base.glob(f"{escaped}*"):
        for p in proj.rglob("*.jsonl"):
            if p.stat().st_mtime < since:
                continue
            label = None
            if "subagents" in p.parts:
                label = f"{p.parents[1].name[:8]}/sub"
            try:
                lines = p.read_text(errors="replace").splitlines()
            except OSError:
                continue
            for line in lines:
                try:
                    ev = json.loads(line)
                except json.JSONDecodeError:
                    continue
                msg = ev.get("message") or {}
                if ev.get("type") == "user" and label is None:
                    content = msg.get("content")
                    text = content if isinstance(content, str) else " ".join(
                        c.get("text", "") for c in (content or []) if isinstance(c, dict))
                    m = re.search(r"# Your ticket\s*\n# (\S+)", text or "")
                    label = m.group(1) if m else p.stem[:8]
                if ev.get("type") == "assistant" and msg.get("usage"):
                    u = msg["usage"]; model = msg.get("model", "?")
                    pi, po = price_for(model)
                    cost = (u.get("input_tokens", 0) * pi + u.get("output_tokens", 0) * po
                            + u.get("cache_read_input_tokens", 0) * pi * 0.1
                            + u.get("cache_creation_input_tokens", 0) * pi * 1.25) / 1e6
                    pm = per_model[model]
                    pm["in"] += u.get("input_tokens", 0); pm["out"] += u.get("output_tokens", 0)
                    pm["cache_read"] += u.get("cache_read_input_tokens", 0); pm["cache_write"] += u.get("cache_creation_input_tokens", 0)
                    pm["cost"] += cost
                    r = runs[label or p.stem[:8]]
                    r["cost"] += cost; r["turns"] += 1; r["models"].add(model)
                    r["when"] = time.strftime("%m-%d %H:%M", time.localtime(p.stat().st_mtime))
    out = [{"key": k, "cost": v["cost"], "turns": v["turns"], "ms": None, "when": v["when"]} for k, v in runs.items()]
    return out, per_model


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--since", default="")
    ap.add_argument("--by-run", type=int, default=20)
    ap.add_argument("--transcripts", action="store_true")
    a = ap.parse_args(argv)
    since = parse_since(a.since)
    runs, per_model = from_transcripts(since) if a.transcripts else from_results(since)
    total = sum(r["cost"] for r in runs)
    print(f"source: {'transcripts (estimated)' if a.transcripts else 'runs/*.result.json (exact)'}   runs: {len(runs)}   total: ${total:.2f}")
    print("\nper model")
    print(f"  {'model':28} {'input':>10} {'output':>9} {'cache rd':>10} {'cache wr':>9} {'cost':>8}")
    for model, u in sorted(per_model.items(), key=lambda kv: -kv[1]["cost"]):
        print(f"  {model:28} {u['in']:>10,} {u['out']:>9,} {u['cache_read']:>10,} {u['cache_write']:>9,} {u['cost']:>8.2f}")
    print(f"\nby run (top {a.by_run} by cost)")
    for r in sorted(runs, key=lambda r: -r["cost"])[: a.by_run]:
        extra = f"  {r['ms'] // 60000}m" if r.get("ms") else ""
        print(f"  {r['when']:12} {r['key']:24} ${r['cost']:7.2f}  turns={r['turns']}{extra}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
