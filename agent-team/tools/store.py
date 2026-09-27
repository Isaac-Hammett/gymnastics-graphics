#!/usr/bin/env python3
"""Source-of-truth CLI. The store for a code project is git plus committed evidence:
  - commits on MAIN_BRANCH whose message carries the trailer `Ticket: ISA2-N`
  - screenshots under docs/verification/<TICKET>/
  - gaps computed by code (agent-team/loops.py)

Commands
  commits T          list commits stamped with T (hash + subject)
  rows_for_all       JSON {ticket: commit count}
  evidence T         list committed evidence files for T
  gaps               JSON from loops.compute_gaps()
  dump               everything above, for a human
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import ROOT, TEAM_DIR, env, load_env  # noqa: E402

TRAILER = re.compile(r"^Ticket:\s*([A-Z][A-Z0-9]*-\d+)\s*$", re.M)


def _git(*args, cwd=None) -> str:
    r = subprocess.run(["git", *args], cwd=str(cwd or ROOT), capture_output=True, text=True)
    return r.stdout


def main_branch() -> str:
    load_env()
    return env("MAIN_BRANCH", "main")


def rows_for_all(branch=None) -> dict:
    out = _git("log", branch or main_branch(), "--format=%H%x1f%s%x1f%b%x1e")
    counts: dict = {}
    for rec in out.split("\x1e"):
        if not rec.strip():
            continue
        parts = rec.strip("\n").split("\x1f")
        body = parts[2] if len(parts) > 2 else ""
        for t in set(TRAILER.findall(body + "\n")):
            counts[t] = counts.get(t, 0) + 1
    return counts


def commits(ticket: str, branch=None) -> list:
    out = _git("log", branch or main_branch(), f"--grep=^Ticket: {ticket}$", "--format=%h %s")
    return [l for l in out.splitlines() if l.strip()]


def evidence(ticket: str, branch=None) -> list:
    """Evidence files committed on MAIN_BRANCH (not the working tree, which may lag main)."""
    out = _git("ls-tree", "-r", "--name-only", branch or main_branch(), "--", f"docs/verification/{ticket}")
    return sorted(l for l in out.splitlines() if l.strip())


def gaps() -> dict:
    sys.path.insert(0, str(TEAM_DIR))
    import loops  # noqa: E402
    return loops.compute_gaps()


def main(argv) -> int:
    cmd = argv[1] if len(argv) > 1 else ""
    if cmd == "commits" and len(argv) > 2:
        print("\n".join(commits(argv[2])))
    elif cmd == "rows_for_all":
        print(json.dumps(rows_for_all(), indent=1, sort_keys=True))
    elif cmd == "evidence" and len(argv) > 2:
        print("\n".join(evidence(argv[2])))
    elif cmd == "gaps":
        print(json.dumps(gaps(), indent=1))
    elif cmd == "dump":
        rows = rows_for_all()
        print(f"branch: {main_branch()}  tickets with commits: {len(rows)}")
        for t in sorted(rows, key=lambda x: int(x.rsplit('-', 1)[1])):
            ev = evidence(t)
            print(f"  {t}: {rows[t]} commit(s), {len(ev)} evidence file(s)")
        print("gaps:")
        for name, g in gaps().items():
            print(f"  {name}: {g['count']}  sample={g['sample'][:3]}")
    else:
        print(__doc__)
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
