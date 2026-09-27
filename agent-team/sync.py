#!/usr/bin/env python3
"""sync.py — runs after every close; safe to run any time.

- Refreshes runs/board.json and runs/gaps.json (and runs/proposed.json with --snapshot).
- Human rejections: a Done or In Review ticket carrying `returned` loses `returned`, gains `rework`, goes back to
  Todo, and its verify verdict is cleared. The dispatcher stops a PASS on a `rework` ticket at In Review for Isaac.
- Zero-commit check: a Done ticket with a role label, closed since the last sync, with zero commits on MAIN_BRANCH
  stamped `Ticket: T`, goes back to Todo once (never on the first sync).
- Targets: a Done ticket whose description carries `**Target:** gap <name> <= N` while the gap is still above N
  is re-queued (Todo), unless another open ticket carries the same Target line, or its answer says the sources
  are exhausted (then `hold` + Todo + a 14-day recheck).

Usage: sync.py [--snapshot] [--offline] [--dry-run]
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

TEAM_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(TEAM_DIR / "tools"))
sys.path.insert(0, str(TEAM_DIR))
import linear  # noqa: E402
import loops  # noqa: E402
import store  # noqa: E402
from common import LOGS, RUNS, env, load_env  # noqa: E402

# Separate from dispatch_state.json: the dispatcher holds its state in memory for a whole pass and saves it at
# the end, which would erase anything sync wrote to the same file in between.
STATE_FILE = RUNS / "sync_state.json"
RECHECKS = RUNS / "rechecks.json"
TARGET_RE = re.compile(r"\*\*Target:\*\*\s*gap\s+([\w-]+)\s*<=\s*(\d+)", re.I)
EXHAUSTED = ("not published", "sources exhausted", "no new rows", "nothing left to fix", "gap is structural")
DRY = False


def log(msg: str):
    line = f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} sync: {msg}"
    print(line, flush=True)
    LOGS.mkdir(exist_ok=True)
    with (LOGS / "dispatch.log").open("a") as f:
        f.write(line + "\n")


def now():
    return datetime.now(timezone.utc)


def parse_iso(s):
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        return None


def load_state() -> dict:
    if STATE_FILE.exists():
        try:
            return json.loads(STATE_FILE.read_text())
        except json.JSONDecodeError:
            pass
    return {}


def save_state(s: dict):
    if not DRY:
        STATE_FILE.write_text(json.dumps(s, indent=2))


def L_state(t, st):
    log(f"  state {t} -> {st}")
    if not DRY:
        linear.set_state(t, st)


def L_label(t, name, remove=False):
    log(f"  label {t} {'-' if remove else '+'}{name}")
    if not DRY:
        linear.label(t, name, remove)


def L_comment(t, body):
    log(f"  comment {t}: {body.splitlines()[0][:100]}")
    if not DRY:
        linear.comment(t, body)


def parse_target(desc: str):
    m = TARGET_RE.search(desc or "")
    return (m.group(1), int(m.group(2))) if m else None


def handle_target(i: dict, tgt, gaps: dict, board: list, state: dict):
    name, n = tgt
    count = gaps.get(name, {}).get("count", 0)
    if count <= n:
        return
    t = i["id"]
    line = TARGET_RE.search(i["description"]).group(0)
    others = [o for o in board if o["id"] != t and o["state_type"] not in linear.CLOSED_TYPES and line in (o.get("description") or "")]
    if others:
        log(f"{t}: target {name} still {count}, continued by {others[0]['id']}")
        return
    handled = state.setdefault("target_handled", {})
    if handled.get(t) == i.get("completedAt"):
        return
    answer = "" if DRY else linear.last_answer(t)
    if any(p in answer.lower() for p in EXHAUSTED):
        L_label(t, "hold")
        L_state(t, "Todo")
        due = (date.today() + timedelta(days=14)).isoformat()
        L_comment(t, f"Dispatcher: target `{name}` is still {count} but the answer says the sources are exhausted. On hold; recheck on {due}.")
        items = json.loads(RECHECKS.read_text()) if RECHECKS.exists() else []
        items.append({"id": t, "date": due})
        if not DRY:
            RECHECKS.write_text(json.dumps(items, indent=1))
    else:
        L_state(t, "Todo")
        L_comment(t, f"Dispatcher: target `{name}` is still {count} (needs <= {n}); back to Todo to continue.")
    handled[t] = i.get("completedAt")


def main(argv=None) -> int:
    global DRY
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--snapshot", action="store_true", help="only refresh board/gaps/proposed snapshots")
    ap.add_argument("--offline", action="store_true", help="use runs/board.json instead of Linear")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args(argv)
    DRY = a.dry_run
    load_env()
    if a.offline:
        import os
        os.environ["LINEAR_OFFLINE"] = "1"

    try:
        board = linear.board(refresh=not a.offline)
    except linear.LinearError as e:
        log(f"board fetch failed: {e}")
        return 2 if e.unreachable else 1
    gaps = loops.compute_gaps()
    RUNS.mkdir(exist_ok=True)
    (RUNS / "gaps.json").write_text(json.dumps(gaps, indent=1))
    proposed = [i for i in board if "proposed" in i["labels"] and i["state_type"] not in linear.CLOSED_TYPES]
    (RUNS / "proposed.json").write_text(json.dumps(proposed, indent=1))
    log(f"board {len(board)} issues, {len(proposed)} proposed, gaps " + ", ".join(f"{k}={v['count']}" for k, v in gaps.items()))
    if a.snapshot:
        return 0

    state = load_state()
    last_sync = parse_iso(state.get("last_sync"))
    commits = store.rows_for_all()
    main_branch = env("MAIN_BRANCH", "main")
    returned_handled = state.setdefault("returned_handled", {})

    for i in board:
        t = i["id"]
        labels = set(i["labels"])
        # Human rejection: `returned` on a Done or In Review ticket. Convert it to `rework` (so this rule does not
        # fire again while the rework is in flight) and send the ticket back. A PASS on a `rework` ticket stops
        # at In Review for Isaac; adding `returned` again rejects again.
        if "returned" in labels and i["state"] in ("Done", "In Review"):
            log(f"{t}: `returned` on a {i['state']} ticket (human rejection)")
            L_label(t, "returned", remove=True)
            L_label(t, "rework")
            L_state(t, "Todo")
            L_comment(t, "Dispatcher: rejection seen; back to Todo with `rework`. Read the rejection comment before starting. "
                         "When the verifier passes the rework, it stops at **In Review** for your approval instead of Done.")
            if not DRY:
                (RUNS / f"{t}.verify.answer.md").unlink(missing_ok=True)
                (RUNS / f"{t}.answer.md").unlink(missing_ok=True)
            continue
        if i["state"] != "Done":
            continue
        completed = parse_iso(i.get("completedAt"))
        # Zero-commit check. Skipped on the very first sync so pre-existing Done tickets are never swept up.
        if (last_sync and linear.role_of(i) and completed and completed > last_sync
                and commits.get(t, 0) == 0 and t not in returned_handled):
            log(f"{t}: Done with no commit stamped `Ticket: {t}`")
            L_state(t, "Todo")
            L_comment(t, f"Dispatcher: no commit on `{main_branch}` carries the trailer `Ticket: {t}`, so this is back in Todo. "
                         "If it needed no code change, set it Done again (or Canceled); this check will not repeat for it.")
            returned_handled[t] = i.get("completedAt")
            continue
        tgt = parse_target(i.get("description", ""))
        if tgt:
            handle_target(i, tgt, gaps, board, state)

    state["last_sync"] = now().isoformat()
    save_state(state)
    return 0


if __name__ == "__main__":
    sys.exit(main())
