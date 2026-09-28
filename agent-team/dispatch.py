#!/usr/bin/env python3
"""dispatch.py — a launcher, not a parent.

Each pass: finalize finished runs (merge implementer branches into main, hand PASS/FAIL verdicts to Linear),
catch orphans and hung sessions, start verifiers for In Review tickets, start implementers for ready tickets,
then planner / rechecks / standing loops / reviewer. Killing the dispatcher leaves agents running in tmux;
a restart re-adopts them.

Usage: dispatch.py [--once] [--dry-run] [--offline]
State: runs/dispatch_state.json · Log: logs/dispatch.log · Sessions: tmux `gg-<KEY>`
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import time
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

TEAM_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(TEAM_DIR / "tools"))
sys.path.insert(0, str(TEAM_DIR))
import common  # noqa: E402
import linear  # noqa: E402
import loops  # noqa: E402
from common import LOGS, ROOT, RUNS, env, env_int, key_from_session, load_env, session_name, worktrees_dir  # noqa: E402

STATE_FILE = RUNS / "dispatch_state.json"
LOG_FILE = LOGS / "dispatch.log"
RECHECKS = RUNS / "rechecks.json"
GAPS = RUNS / "gaps.json"
VERIFY_HOLD = {"stuck", "hold", "needs-isaac"}
DRY = False
OFFLINE = False


# ---------------------------------------------------------------- basics

def log(msg: str):
    line = f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')} {msg}"
    print(line, flush=True)
    LOGS.mkdir(exist_ok=True)
    with LOG_FILE.open("a") as f:
        f.write(line + "\n")


def now():
    return datetime.now(timezone.utc)


def iso(dt=None):
    return (dt or now()).isoformat()


def parse_iso(s):
    if not s:
        return None
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except ValueError:
        return None


def minutes_since(s) -> float:
    dt = parse_iso(s)
    return (now() - dt).total_seconds() / 60 if dt else 1e9


def notify(msg: str):
    log("NOTIFY " + msg)
    if not DRY:
        subprocess.run(["bash", str(TEAM_DIR / "notify.sh"), msg], capture_output=True)


def load_state() -> dict:
    s = {}
    if STATE_FILE.exists():
        try:
            s = json.loads(STATE_FILE.read_text())
        except json.JSONDecodeError:
            s = {}
    for k, v in {"recently_done": {}, "planner_due": False, "last_planner_run": None, "last_reviewer_run": None,
                 "reviewed_sets": {}, "loop_created": {}, "merge_warned": {}}.items():
        s.setdefault(k, v)
    return s


def save_state(s: dict):
    if not DRY:
        RUNS.mkdir(exist_ok=True)
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
    log(f"  comment {t}: {body.splitlines()[0][:110]}")
    if not DRY:
        linear.comment(t, body)


# ---------------------------------------------------------------- tmux / processes

def sh(args, cwd=None):
    return subprocess.run(args, cwd=str(cwd) if cwd else None, capture_output=True, text=True)


def tmux_has(sess: str) -> bool:
    return sh(["tmux", "has-session", "-t", sess]).returncode == 0


def running_sessions() -> set:
    r = sh(["tmux", "list-sessions", "-F", "#{session_name}"])
    # Only agent-run sessions (gg-ISA2-12, gg-ISA2-12-verify, gg-PLANNER, gg-REVIEWER), never a loop session.
    pat = re.compile(r"^gg-(?:[A-Z][A-Z0-9]*-\d+(?:-verify)?|PLANNER|REVIEWER)$")
    return {s for s in r.stdout.split() if pat.match(s)} if r.returncode == 0 else set()


def tmux_start(sess: str, cmd: str):
    if DRY:
        log(f"  would start tmux {sess}: {cmd}")
        return
    r = sh(["tmux", "new-session", "-d", "-s", sess, "-c", str(TEAM_DIR), cmd])
    if r.returncode != 0:
        log(f"  tmux start failed for {sess}: {r.stderr.strip()}")


def tmux_kill(sess: str):
    if not DRY:
        sh(["tmux", "kill-session", "-t", sess])


def pane_pid(sess: str):
    r = sh(["tmux", "list-panes", "-t", sess, "-F", "#{pane_pid}"])
    parts = r.stdout.split()
    return int(parts[0]) if r.returncode == 0 and parts else None


def descendants(pid: int) -> list:
    r = sh(["ps", "-axo", "pid=,ppid=,comm="])
    kids, comm = {}, {}
    for line in r.stdout.splitlines():
        parts = line.split(None, 2)
        if len(parts) < 3:
            continue
        p, pp, c = int(parts[0]), int(parts[1]), parts[2]
        kids.setdefault(pp, []).append(p)
        comm[p] = c
    out, stack = [], [pid]
    while stack:
        x = stack.pop()
        for k in kids.get(x, []):
            out.append((k, comm.get(k, "")))
            stack.append(k)
    return out


def claude_alive(sess: str) -> bool:
    pid = pane_pid(sess)
    return bool(pid) and any("claude" in c for _, c in descendants(pid))


def run_cmd(key: str, role: str) -> str:
    return f"bash {TEAM_DIR}/agent_run.sh {key} {role}"


def exit_file(key):
    return RUNS / f"{key}.exit"


def answer_file(key):
    return RUNS / f"{key}.answer.md"


def read_rc(key):
    try:
        return int(exit_file(key).read_text().strip())
    except (ValueError, OSError):
        return None


def first_line(path: Path) -> str:
    try:
        text = path.read_text().strip()
    except OSError:
        return ""
    return text.splitlines()[0].strip() if text else ""


def log_tail(key: str, n: int = 40) -> str:
    p = LOGS / f"{key}.log"
    if not p.exists():
        return "(no log)"
    lines = p.read_text(errors="replace").splitlines()
    return "\n".join(lines[-n:])


# ---------------------------------------------------------------- git merge

def main_branch() -> str:
    return env("MAIN_BRANCH", "main")


def main_checkout() -> Path:
    """The worktree where MAIN is checked out (usually your own checkout); creates <worktrees>/_main when none has it."""
    r = sh(["git", "worktree", "list", "--porcelain"], cwd=ROOT)
    for block in r.stdout.strip().split("\n\n"):
        lines = block.splitlines()
        if lines and any(l.strip() == f"branch refs/heads/{main_branch()}" for l in lines):
            return Path(lines[0].split(" ", 1)[1])
    wt = worktrees_dir() / "_main"
    if not (wt / ".git").exists():
        wt.parent.mkdir(parents=True, exist_ok=True)
        r = sh(["git", "worktree", "add", str(wt), main_branch()], cwd=ROOT)
        if r.returncode != 0:
            raise RuntimeError(f"cannot create {wt}: " + r.stderr.strip())
    return wt


def ticket_branch(t: str, i) -> str:
    branch_file = RUNS / f"{t}.branch"
    return branch_file.read_text().strip() if branch_file.exists() else (i or {}).get("branch")


def branch_ahead(t: str, i) -> bool:
    """True when the ticket branch has at least one commit that main lacks. DRY runs assume yes."""
    if DRY:
        return True
    branch = ticket_branch(t, i)
    if not branch:
        return False
    r = sh(["git", "rev-list", "--count", f"{main_branch()}..{branch}"], cwd=ROOT)
    if r.returncode == 0 and r.stdout.strip().isdigit() and int(r.stdout.strip()) > 0:
        return True
    # The work can already be on main: another ticket merged this branch into its own (ISA2-314 carried
    # ISA2-311's commits, 2026-09-27). Commits stamped with this ticket on the branch and on main count.
    stamped = sh(["git", "log", "--format=%H", f"--grep=^Ticket: {t}$", branch], cwd=ROOT).stdout.split()
    if not stamped:
        return False
    return sh(["git", "merge-base", "--is-ancestor", stamped[0], main_branch()], cwd=ROOT).returncode == 0


def merge_ticket(t: str, branch: str):
    """Returns (True, msg) on success, (False, msg) on conflict/error, (None, msg) when git refused because of
    local changes in the main checkout (retry next pass).

    No clean-tree precheck: `npm run dev` rewrites tracked registry files on every start, so a precheck would
    block merges whenever your dev server is up. Git itself refuses only when the merge would touch a file you
    changed, or when you have staged changes; MERGE_HEAD tells a refusal apart from a real conflict."""
    if DRY:
        return True, f"dry-run: would merge {branch}"
    if not branch:
        return False, "no branch recorded for this ticket (runs/<T>.branch missing and Linear has no branch name)"
    try:
        wt = main_checkout()
    except RuntimeError as e:
        return False, str(e)
    r = sh(["git", "merge", "--no-ff", "--no-edit", "-m", f"Merge {branch} for {t}", branch], cwd=wt)
    if r.returncode != 0:
        out = (r.stdout + r.stderr)[-1500:]
        in_progress = sh(["git", "rev-parse", "-q", "--verify", "MERGE_HEAD"], cwd=wt).returncode == 0
        if in_progress:
            sh(["git", "merge", "--abort"], cwd=wt)
            return False, "merge conflict:\n" + out
        if "not something we can merge" in out or "unknown revision" in out:
            return False, f"branch `{branch}` does not exist:\n" + out
        return None, (f"git refused to merge {t} into `{main_branch()}` in {wt} because of local changes there; "
                      f"commit or stash them and the dispatcher retries every pass.\n{out.strip()[-400:]}")
    sha = sh(["git", "rev-parse", "--short", "HEAD"], cwd=wt).stdout.strip()
    msg = f"merged `{branch}` into `{main_branch()}` at {sha}"
    # Pushing main is a deploy: .github/workflows/deploy-coordinator.yml ships server/ changes to the production
    # coordinator on every push. Merges stay local (the verifier checks local main) unless AUTO_PUSH_MAIN=1.
    # PUSH_AFTER_MERGE, the old name, is deliberately ignored so an old .env cannot switch deploys on.
    if env("AUTO_PUSH_MAIN", "0") == "1":
        p = sh(["git", "push", "origin", main_branch()], cwd=wt)
        msg += " and pushed" if p.returncode == 0 else f"; push failed: {p.stderr.strip()[-300:]}"
    else:
        msg += " (not pushed; pushing main deploys, so that is Isaac's call)"
    wt_t = worktrees_dir() / t
    if wt_t.exists():
        # Never --force: a worktree with uncommitted changes is kept (git refuses), so unmerged work survives.
        rm = sh(["git", "worktree", "remove", str(wt_t)], cwd=ROOT)
        if rm.returncode != 0:
            msg += f"; worktree kept at {wt_t} (uncommitted changes)"
            return True, msg
    # -D from the main worktree: -d would judge "merged" against whatever branch ROOT has checked out.
    sh(["git", "branch", "-D", branch], cwd=wt)
    return True, msg


# One test VM and one test competition: two runs driving the same OBS would switch scenes under each other.
# Tickets labeled `vm` (and their verifiers) run one at a time; everything else runs in parallel.
VM_LABEL = "vm"
CONFLICT_LABEL = "merge-conflict"  # set when a merge into main conflicted and the ticket was requeued once


def vm_in_use(sessions, by_id) -> bool:
    for s in sessions:
        m = re.match(r"^gg-([A-Z][A-Z0-9]*-\d+)(?:-verify)?$", s)
        if m and VM_LABEL in (by_id.get(m.group(1)) or {}).get("labels", []):
            return True
    return False


def retry_verify(t: str, key: str, state: dict, why: str) -> bool:
    """Once per verification cycle, a verifier that ends without a verdict, or FAILs without filing a fix ticket,
    gets a fresh verifier instead of a `stuck` label: both happened on 2026-09-27 and both were verifier faults.
    Sets the verdict aside so verify_candidates picks the ticket up again. False when the retry is used up."""
    retries = state.setdefault("verify_retries", {})
    if retries.get(t, 0) >= env_int("VERIFY_RETRIES", 1):
        retries.pop(t, None)
        return False
    retries[t] = retries.get(t, 0) + 1
    af = answer_file(key)
    if af.exists():
        af.rename(RUNS / f"{key}.try{retries[t]}.md")
    log(f"{t}: verifier {why}; retrying with a fresh verifier ({retries[t]})")
    L_comment(t, f"Verifier ended with {why}. Starting one fresh verifier before marking this stuck. "
                 f"The first verdict is kept at `agent-team/runs/{key}.try{retries[t]}.md`.")
    return True


def open_fix_blockers(t: str) -> list:
    """Open blockers of T, read fresh from Linear (the pass's board is stale by the time a verifier finishes)."""
    try:
        i = linear.fetch_issue(t)
    except linear.LinearError as e:
        log(f"{t}: could not re-read blockers: {e}")
        return ["(unknown)"]
    return [b["id"] for b in i["blockers"] if b["state_type"] not in linear.CLOSED_TYPES]


# ---------------------------------------------------------------- finalize

def finalize(key: str, by_id: dict, state: dict):
    rc = read_rc(key)
    if rc is None:
        return
    has_answer = answer_file(key).exists()

    if key in ("PLANNER", "REVIEWER"):
        ans = answer_file(key).read_text() if has_answer else ""
        log(f"finalize {key} rc={rc}: {ans.splitlines()[0][:120] if ans else '(no answer)'}")
        if key == "PLANNER":
            m = re.search(r"Proposed:\s*(\d+)", ans)
            if m and int(m.group(1)) > 0:
                notify(f"Planner proposed {m.group(1)} ticket(s)")
            state["last_planner_run"] = iso()
            state["planner_due"] = False
            state["planner_new_ids"] = []
        else:
            m = re.search(r"Escalated:\s*(\d+)", ans)
            if m and int(m.group(1)) > 0:
                notify(f"Reviewer escalated {m.group(1)} ticket(s); look for needs-isaac")
            state["last_reviewer_run"] = iso()
        if not DRY:
            exit_file(key).unlink()
        return

    is_verify = key.endswith(".verify")
    t = key[:-len(".verify")] if is_verify else key
    i = by_id.get(t)

    if is_verify:
        verdict = first_line(answer_file(key)).upper() if has_answer else ""
        if rc == 2:
            log(f"{key}: Linear unreachable; will retry")
        elif "PASS" in verdict:
            if i and "rework" in i["labels"]:
                L_label(t, "rework", remove=True)
                L_comment(t, "Verifier: **PASS** on the rework after your rejection. Set **Done** to approve, or add `returned` with a comment to reject again.")
                notify(f"{t} re-verified after rejection; awaiting your approval")
            else:
                L_state(t, "Done")
                L_comment(t, "Verifier: **PASS**. Closed by the dispatcher.")
                state["last_close"] = iso()
                state["planner_due"] = True
            state["recently_done"][t] = iso()
            state.setdefault("verify_retries", {}).pop(t, None)
            run_sync()
        elif "FAIL" in verdict:
            blockers = [] if DRY else open_fix_blockers(t)
            if not blockers and not DRY:
                # The verifier's fix ticket may have been posted from the outbox a second ago; Linear can take a
                # moment to show its `blocks` relation (ISA2-310/312, 2026-09-27). Look once more before retrying.
                time.sleep(env_int("FIX_RELATION_WAIT_S", 6))
                blockers = open_fix_blockers(t)
            if not blockers and not DRY and retry_verify(t, key, state, "FAIL without a fix ticket"):
                pass
            elif blockers or DRY:
                state.setdefault("verify_retries", {}).pop(t, None)
                L_comment(t, f"Verifier: **FAIL**. Open blockers: {', '.join(blockers) or '(dry run)'}. This ticket stays In Review "
                             "until they close, then it is re-verified.")
            else:
                L_label(t, "stuck")
                L_comment(t, "Verifier: **FAIL**, but it filed no fix ticket, so nothing would ever re-verify this. Marked stuck: "
                             "read the verdict, file a fix ticket that blocks this one (or set Todo to redo it), then remove `stuck`.")
                notify(f"{t} verify FAIL without a fix ticket")
        elif not DRY and retry_verify(t, key, state, f"rc={rc}, verdict `{verdict or 'none'}`"):
            pass
        else:
            L_label(t, "stuck")
            L_comment(t, f"Verifier run ended rc={rc} with verdict `{verdict or 'none'}`.\n\nLog tail:\n```\n{log_tail(key)}\n```")
            notify(f"{t} verify stuck (rc={rc})")
        if not DRY:
            exit_file(key).unlink()
        return

    # implementer run. Every outcome marks the ticket recently finalized, so this pass's (stale) board does not
    # make the orphan check flag it a second time.
    state["recently_done"][t] = iso()
    if rc == 2:
        log(f"{key}: Linear unreachable at start; requeue quietly")
        L_state(t, "Todo")
    elif rc == 3:
        L_label(t, "stuck")
        L_comment(t, f"Could not prepare the worktree for {t} (branch conflict with `{main_branch()}`?). See agent-team/logs/dispatch.log.")
        notify(f"{t} worktree prep failed")
    elif rc == 1 or not has_answer or not branch_ahead(t, i):
        # rc 0 alone proves nothing: a headless run can exit 0 mid-task (ISA2-294 exited while waiting on a
        # background test run, uncommitted). No answer or no commits means stuck, and the worktree is kept.
        why = "no answer file" if not has_answer else ("no commits on the branch" if rc != 1 else "")
        L_label(t, "stuck")
        L_comment(t, f"Run exited rc={rc}{f' with {why}' if why else ''}. Worktree kept at `{worktrees_dir() / t}`."
                     f"\n\nLog tail:\n```\n{log_tail(key)}\n```")
        notify(f"{t} stuck (rc={rc}{f', {why}' if why else ''})")
    else:
        branch = ticket_branch(t, i)
        ok, msg = merge_ticket(t, branch)
        if ok is None:
            if not state["merge_warned"].get(t):
                notify(msg.splitlines()[0])
                state["merge_warned"][t] = iso()
            log(f"{t}: merge deferred: {msg}")
            return  # keep the exit file; retry next pass
        if not ok and msg.startswith("merge conflict") and CONFLICT_LABEL not in ((i or {}).get("labels") or []):
            # Parallel tickets touch the same docs (system map, inventory). Send it back once: the next run starts
            # with main merged in and the conflict in progress, and resolves it (agent_run.sh merge_main_into).
            L_label(t, CONFLICT_LABEL)
            L_state(t, "Todo")
            L_comment(t, f"Dispatcher: merging into `{main_branch()}` conflicted (another ticket changed the same files). "
                         f"Requeued once: the next run starts with the conflict in progress and resolves it.\n\n```\n{msg[-800:]}\n```")
            log(f"{t}: merge conflict; requeued to resolve")
        elif not ok:
            L_label(t, "stuck")
            L_comment(t, f"Merge into `{main_branch()}` failed; resolve by hand in `{worktrees_dir() / t}` "
                         f"(merge `{main_branch()}` into the branch and commit), then remove `stuck` and set Todo.\n\n```\n{msg}\n```")
            notify(f"{t} merge failed")
        else:
            if CONFLICT_LABEL in ((i or {}).get("labels") or []):
                L_label(t, CONFLICT_LABEL, remove=True)
            note = "" if rc == 0 else f" (the harness exited rc={rc} after the work was done; counted as done)"
            L_state(t, "In Review")
            L_comment(t, f"Dispatcher: {msg}{note}. Queued for verification.")
            if not DRY:
                answer_file(f"{t}.verify").unlink(missing_ok=True)
            state["recently_done"][t] = iso()
            state["merge_warned"].pop(t, None)
            run_sync()
    if not DRY:
        exit_file(key).unlink(missing_ok=True)


def run_sync():
    if DRY:
        return
    try:
        subprocess.run([sys.executable, str(TEAM_DIR / "sync.py")] + (["--offline"] if OFFLINE else []), timeout=600)
    except Exception as e:  # sync must never take the dispatcher down
        log(f"sync failed: {e}")


# ---------------------------------------------------------------- orphans / silence

def check_silence(key: str, sess: str, by_id: dict, state: dict):
    logp = LOGS / f"{key}.log"
    age_min = (time.time() - logp.stat().st_mtime) / 60 if logp.exists() else 0
    if age_min < env_int("STUCK_MINUTES", 20):
        return
    if claude_alive(sess):
        return  # slow but alive (a long build or test can keep the log quiet)
    log(f"{key}: session quiet for {age_min:.0f} min and no claude process; killing {sess}")
    tmux_kill(sess)
    if not exit_file(key).exists() and not DRY:
        exit_file(key).write_text("0" if answer_file(key).exists() else "1")
    finalize(key, by_id, state)


def check_running(by_id: dict, state: dict, sessions: set):
    for sess in sessions:
        check_silence(key_from_session(sess), sess, by_id, state)
    grace = timedelta(minutes=3)
    for t, i in by_id.items():
        # Only tickets the agent team works (role label). Humans' own In Progress tickets are not ours.
        if i["state"] != "In Progress" or not linear.role_of(i):
            continue
        if minutes_since(state["recently_done"].get(t)) < 15:
            continue
        started = RUNS / f"{t}.started"
        if started.exists() and datetime.fromtimestamp(started.stat().st_mtime, timezone.utc) > now() - grace:
            continue
        if session_name(t) in sessions or exit_file(t).exists():
            continue
        if answer_file(t).exists():
            log(f"{t}: orphan with an answer on disk; finalizing as done")
            if not DRY:
                exit_file(t).write_text("0")
            finalize(t, by_id, state)
        else:
            L_label(t, "stuck")
            L_comment(t, "Dispatcher: In Progress but no run session, exit file, or answer exists. Marked stuck.")
            notify(f"{t} orphaned")


# ---------------------------------------------------------------- starting runs

def start_ticket(i: dict):
    t = i["id"]
    role = linear.role_of(i)
    model = common.resolve_model(role, i["labels"])
    sess = session_name(t)
    log(f"start {t} role={role} model={model}")
    if not DRY:
        (RUNS / f"{t}.started").write_text(iso())
    L_state(t, "In Progress")
    L_comment(t, f"Dispatcher: started `{role}` on `{model}`.\n\n"
                 f"Watch: `tmux attach -t {sess}` · Stop: `tmux kill-session -t {sess}` · Log: `agent-team/logs/{t}.log`")
    tmux_start(sess, run_cmd(t, role))


def start_verify(t: str):
    key = f"{t}.verify"
    sess = session_name(key)
    model = common.resolve_model("verify")
    log(f"start {key} model={model}")
    if not DRY:
        (RUNS / f"{key}.started").write_text(iso())
    L_comment(t, f"Dispatcher: verifier started on `{model}`. Watch: `tmux attach -t {sess}` · Log: `agent-team/logs/{key}.log`")
    tmux_start(sess, run_cmd(key, "verify"))


def verify_candidates(board: list, by_id: dict) -> list:
    out = []
    for i in board:
        if i["state"] != "In Review" or not linear.role_of(i):
            continue
        if VERIFY_HOLD & set(i["labels"]) or not linear.blockers_closed(i):
            continue
        key = f"{i['id']}.verify"
        if exit_file(key).exists():
            continue
        vf = answer_file(key)
        if vf.exists():
            verdict = first_line(vf).upper()
            if "PASS" in verdict:
                continue  # awaiting Isaac after a rework cycle
            # FAIL: re-verify only once a blocker (fix ticket) closed after the verdict was written
            verdict_at = datetime.fromtimestamp(vf.stat().st_mtime, timezone.utc)
            closes = [parse_iso(b.get("completedAt") or by_id.get(b["id"], {}).get("completedAt")) for b in i["blockers"]]
            if not any(c and c > verdict_at for c in closes):
                continue
        out.append(i)
    return sorted(out, key=linear.sort_key)


# ---------------------------------------------------------------- planner / reviewer / loops / rechecks

def note_new_focus_tickets(board: list, state: dict):
    """A ticket new to the focus project (PLANNER_PROJECT) makes the planner due, so every new ticket gets an
    overview against the project's build order. The new ids go to runs/planner_new.json for the planner."""
    focus = env("PLANNER_PROJECT", "")
    if not focus:
        return
    ids = sorted(i["id"] for i in board if i.get("project") == focus)
    seen = state.get("planner_seen_ids")
    if seen is None:
        state["planner_seen_ids"] = ids
        return
    new = sorted(set(ids) - set(seen))
    if new:
        pending = sorted(set(state.get("planner_new_ids", [])) | set(new))
        state["planner_new_ids"] = pending
        state["planner_due"] = True
        log(f"planner due: new {focus} ticket(s) {', '.join(new)}")
    state["planner_seen_ids"] = ids


def maybe_planner(board: list, state: dict):
    if env("PLANNER_ENABLED", "0") != "1":
        return
    note_new_focus_tickets(board, state)
    if tmux_has(session_name("PLANNER")) or exit_file("PLANNER").exists():
        return
    last = state.get("last_planner_run")
    due_daily = minutes_since(last) > env_int("PLANNER_EVERY_MINUTES", 1440)
    due_close = state.get("planner_due") and minutes_since(last) > env_int("PLANNER_MIN_GAP_MIN", 60)
    if due_daily or due_close:
        log("start PLANNER")
        if not DRY:
            (RUNS / "planner_new.json").write_text(json.dumps(state.get("planner_new_ids", [])))
        tmux_start(session_name("PLANNER"), run_cmd("PLANNER", "planner"))


def maybe_reviewer(board: list, state: dict):
    mode = env("REVIEWER_MODE", "recommend")
    cands = [i for i in board
             if "proposed" in i["labels"] and i["state_type"] not in linear.CLOSED_TYPES
             and not ({"needs-isaac", "hold"} & set(i["labels"]))
             and (mode != "recommend" or "reviewed" not in i["labels"])]
    if not cands:
        return
    if tmux_has(session_name("REVIEWER")) or exit_file("REVIEWER").exists():
        return
    if minutes_since(state.get("last_reviewer_run")) < env_int("REVIEWER_MIN_GAP_MIN", 10):
        return
    digest = hashlib.sha1(",".join(sorted(i["id"] for i in cands)).encode()).hexdigest()[:12]
    if minutes_since(state["reviewed_sets"].get(digest)) < env_int("REVIEWER_COOLDOWN_MIN", 30):
        return
    if mode == "auto" and linear.approvals_today() >= env_int("REVIEWER_MAX_APPROVALS_PER_DAY", 80):
        log("reviewer: daily approval cap reached; skipping")
        return
    if not DRY:
        (RUNS / "proposed.json").write_text(json.dumps(cands, indent=1))
    state["reviewed_sets"][digest] = iso()
    log(f"start REVIEWER ({mode}) for {len(cands)} proposed ticket(s)")
    tmux_start(session_name("REVIEWER"), run_cmd("REVIEWER", "reviewer"))


def standing_loops(board: list, state: dict):
    if env("LOOPS_ENABLED", "0") != "1" or not GAPS.exists():
        return
    gaps = json.loads(GAPS.read_text())
    for name, g in gaps.items():
        if g.get("count", 0) <= 0 or name not in loops.TEMPLATES:
            continue
        if any(f"loop:{name}" in i["labels"] and i["state_type"] not in linear.CLOSED_TYPES for i in board):
            continue
        if minutes_since(state["loop_created"].get(name)) < env_int("LOOP_COOLDOWN_MIN", 60):
            continue
        tpl = loops.TEMPLATES[name]
        title, body = loops.ticket_text(name, g)
        log(f"loop ticket for {name} (count {g['count']})")
        if not DRY:
            linear.create(title, body, role=tpl["role"], model=tpl["model"], labels=[f"loop:{name}"], state="Todo")
        state["loop_created"][name] = iso()


def rechecks():
    if not RECHECKS.exists():
        return
    try:
        items = json.loads(RECHECKS.read_text())
    except json.JSONDecodeError:
        return
    keep = []
    for it in items:
        if date.fromisoformat(it["date"]) <= date.today():
            L_label(it["id"], "hold", remove=True)
            L_state(it["id"], "Todo")
            L_comment(it["id"], "Dispatcher: recheck date reached; back to Todo.")
        else:
            keep.append(it)
    if not DRY:
        RECHECKS.write_text(json.dumps(keep, indent=1))


# ---------------------------------------------------------------- one pass

def one_pass(state: dict):
    try:
        board = linear.board(refresh=not OFFLINE)
    except linear.LinearError as e:
        if "429" in str(e) or "ratelimit" in str(e).lower().replace(" ", ""):
            log("Linear rate limit; backing off 5 minutes")
            time.sleep(300)
        else:
            log(f"board fetch failed: {e}")
        return
    by_id = {i["id"]: i for i in board}
    if not DRY:
        # Comments and tickets queued by sandboxed agent runs (see linear.queue_outbox).
        linear.flush_outbox(log)
    sessions = running_sessions()

    # 1. finalize runs whose session is gone
    for ef in sorted(RUNS.glob("*.exit")):
        key = ef.name[:-len(".exit")]
        if session_name(key) in sessions:
            continue
        finalize(key, by_id, state)

    # 2 + 3. orphans and silence
    sessions = running_sessions()
    check_running(by_id, state, sessions)
    for t in [t for t, ts in state["recently_done"].items() if minutes_since(ts) > 15]:
        state["recently_done"].pop(t, None)

    # 4. verify lane (serial by default: one browser, one set of dev servers)
    sessions = running_sessions()
    running_verify = [s for s in sessions if s.endswith("-verify")]
    slots = env_int("MAX_VERIFIERS", 1) - len(running_verify)
    vm_busy = vm_in_use(sessions, by_id)
    for i in verify_candidates(board, by_id):
        if slots <= 0:
            break
        if session_name(f"{i['id']}.verify") in sessions:
            continue
        if VM_LABEL in i["labels"]:
            if vm_busy:
                continue
            vm_busy = True
        start_verify(i["id"])
        slots -= 1

    # 5. ready tickets
    running_work = [s for s in sessions if not s.endswith("-verify") and s not in ("gg-PLANNER", "gg-REVIEWER")]
    slots = env_int("MAX_AGENTS", 2) - len(running_work)
    for i in linear.ready(board):
        if slots <= 0:
            break
        t = i["id"]
        if session_name(t) in sessions or exit_file(t).exists() or t in state["recently_done"]:
            continue
        if VM_LABEL in i["labels"]:
            if vm_busy:
                continue
            vm_busy = True
        start_ticket(i)
        slots -= 1

    # 6-9
    maybe_planner(board, state)
    rechecks()
    standing_loops(board, state)
    maybe_reviewer(board, state)
    save_state(state)


def main(argv=None) -> int:
    global DRY, OFFLINE
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--once", action="store_true")
    ap.add_argument("--dry-run", action="store_true", help="log what would happen; change nothing")
    ap.add_argument("--offline", action="store_true", help="use runs/board.json instead of Linear (implies --dry-run for Linear writes)")
    a = ap.parse_args(argv)
    DRY = a.dry_run or a.offline
    OFFLINE = a.offline
    LOADED_KEYS[:] = [k for k in common.config() if k not in os.environ]
    load_env()
    if OFFLINE:
        os.environ["LINEAR_OFFLINE"] = "1"
    RUNS.mkdir(exist_ok=True)
    LOGS.mkdir(exist_ok=True)
    log(f"dispatch start once={a.once} dry_run={DRY} offline={OFFLINE} max_agents={env_int('MAX_AGENTS', 2)} "
        f"max_verifiers={env_int('MAX_VERIFIERS', 1)} poll={env_int('POLL_SECONDS', 240)}s")
    state = load_state()
    stamp = code_stamp()
    while True:
        try:
            one_pass(state)
        except KeyboardInterrupt:
            raise
        except Exception as e:  # one bad pass must not stop the loop
            log(f"pass failed: {type(e).__name__}: {e}")
        if a.once:
            break
        time.sleep(env_int("POLL_SECONDS", 240))
        if code_stamp() != stamp:
            reload_self(state)
            stamp = code_stamp()  # reload refused (the new code does not compile); keep running the old code
    return 0


LOADED_KEYS: list = []  # settings main() put into os.environ from the config files
RELOAD_FILES = ("dispatch.py", "sync.py", "loops.py", "settings.conf", "models.conf", ".env")


def code_stamp() -> tuple:
    """Modification times of the dispatcher's code and settings. A change makes the loop reload itself, so
    edits and .env changes take effect without a tmux restart."""
    paths = [TEAM_DIR / f for f in RELOAD_FILES] + sorted((TEAM_DIR / "tools").glob("*.py"))
    out = []
    for p in paths:
        try:
            out.append((p.name, p.stat().st_mtime))
        except OSError:
            out.append((p.name, None))
    return tuple(out)


def reload_self(state: dict):
    for p in [TEAM_DIR / "dispatch.py", TEAM_DIR / "sync.py", TEAM_DIR / "loops.py"] + sorted((TEAM_DIR / "tools").glob("*.py")):
        try:
            compile(p.read_text(), str(p), "exec")
        except (SyntaxError, OSError) as e:
            if p.exists():
                log(f"code changed but {p.name} does not compile ({e}); not reloading")
                notify(f"dispatcher not reloaded: {p.name} does not compile")
                return
    log("code or settings changed; reloading the dispatcher")
    save_state(state)
    # load_env never overrides a variable already set, and exec keeps this environment: drop every setting the
    # config files define (old and new keys), so the new process reads them fresh. Shell-exported values that
    # the files do not define stay.
    for k in set(LOADED_KEYS) | set(common.config()):
        os.environ.pop(k, None)
    os.execv(sys.executable, [sys.executable, str(TEAM_DIR / "dispatch.py")] + sys.argv[1:])


if __name__ == "__main__":
    sys.exit(main())
