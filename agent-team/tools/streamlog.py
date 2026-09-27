#!/usr/bin/env python3
"""Reads `claude -p --output-format stream-json --verbose` from stdin, appends a readable log,
and saves the final `result` event (cost, turns, usage) as JSON.

Usage: claude ... | python3 streamlog.py <log path> <result json path>
The log grows with every turn, so its mtime is a liveness signal for the dispatcher.
"""
import json
import sys
import time


def short(v, n):
    s = v if isinstance(v, str) else json.dumps(v)
    s = s.replace("\n", " ⏎ ")
    return s if len(s) <= n else s[:n] + "…"


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        return 2
    log_path, result_path = sys.argv[1], sys.argv[2]
    with open(log_path, "a") as log:
        for raw in sys.stdin:
            line = raw.strip()
            if not line:
                continue
            ts = time.strftime("%H:%M:%S")
            try:
                ev = json.loads(line)
            except json.JSONDecodeError:
                log.write(f"[{ts}] {short(line, 2000)}\n")
                log.flush()
                continue
            t = ev.get("type")
            if t == "system":
                log.write(f"[{ts}] system {ev.get('subtype', '')} model={ev.get('model', '')} cwd={ev.get('cwd', '')}\n")
                servers = ev.get("mcp_servers") or []
                if servers:  # a server that failed to start shows here, long before a tool call is denied
                    log.write(f"[{ts}]   mcp: " + ", ".join(f"{s.get('name')}={s.get('status')}" for s in servers) + "\n")
            elif t == "assistant":
                for b in (ev.get("message") or {}).get("content", []) or []:
                    if b.get("type") == "text" and b.get("text", "").strip():
                        log.write(f"[{ts}] > {short(b['text'], 3000)}\n")
                    elif b.get("type") == "tool_use":
                        inp = b.get("input") or {}
                        hint = inp.get("command") or inp.get("file_path") or inp.get("pattern") or inp.get("description") or inp.get("prompt") or inp.get("url") or ""
                        log.write(f"[{ts}] tool {b.get('name')}: {short(hint, 400)}\n")
            elif t == "user":
                content = (ev.get("message") or {}).get("content", [])
                if isinstance(content, list):
                    for b in content:
                        if isinstance(b, dict) and b.get("type") == "tool_result":
                            c = b.get("content")
                            text = c if isinstance(c, str) else " ".join(x.get("text", "") for x in (c or []) if isinstance(x, dict))
                            flag = " (error)" if b.get("is_error") else ""
                            log.write(f"[{ts}]   result{flag}: {short(text, 400)}\n")
            elif t == "result":
                with open(result_path, "w") as f:
                    json.dump(ev, f, indent=2)
                denials = ev.get("permission_denials") or []
                log.write(f"[{ts}] RESULT subtype={ev.get('subtype')} turns={ev.get('num_turns')} "
                          f"cost=${ev.get('total_cost_usd')} duration_ms={ev.get('duration_ms')} denials={len(denials)}\n"
                          f"{short(ev.get('result', ''), 4000)}\n")
                for d in denials[:10]:
                    log.write(f"[{ts}]   denied: {short(d, 300)}\n")
            log.flush()
    return 0


if __name__ == "__main__":
    sys.exit(main())
