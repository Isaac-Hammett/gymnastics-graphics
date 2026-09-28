#!/usr/bin/env python3
"""Linear GraphQL client and CLI for the agent team (Python 3.9, stdlib only).

Commands
  board [--json]                       fetch the team board -> runs/board.json (prints JSON)
  ready [--cached]                     print ready ticket ids, one per line, in dispatch order
  issue T [--json]                     print one ticket (markdown by default)
  render FILE                          render a ticket JSON file as markdown
  answer T                             print the last comment that starts with ANSWER: (or VERDICT:)
  state T <name>                       set workflow state (Backlog, Todo, In Progress, In Review, Done, Canceled)
  label T <name> [--remove]            add or remove a label (team labels are created on demand)
  comment T "text" | comment T --file F
  create --title .. --desc-file .. [--role r] [--model alias] [--blocked-by A,B] [--blocks T]
         [--project P] [--milestone M] [--state S] [--label L]... [--priority N]
         Defaults: Backlog + `proposed`.
  create --fix --for T --title .. --desc-file ..
         A fix ticket: Todo, labels `fix` + T's role/model, same project, blocks T. Skips review.
  approve|reject|escalate T --why ".."          reviewer decisions (REVIEWER_MODE=auto)
  recommend T --as approve|reject|escalate --why ".."   reviewer decision in recommend mode
  whoami | labels | states             diagnostics

Exit codes: 0 ok, 1 error, 2 Linear unreachable (network / 5xx after retries).
Set LINEAR_OFFLINE=1 to serve board/ready/issue from runs/board.json without network.
"""
from __future__ import annotations

import argparse
import http.client
import json
import socket
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import date, datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import RUNS, TEAM_DIR, env, env_int, load_env  # noqa: E402

API = "https://api.linear.app/graphql"
CACHE_FILE = RUNS / "linear_cache.json"
CACHE_TTL = 6 * 3600
BOARD_FILE = RUNS / "board.json"
REVIEWER_LOG = RUNS / "reviewer_log.jsonl"

HOLD_LABELS = {"hold", "proposed", "stuck", "size:L", "needs-isaac"}
CLOSED_TYPES = {"completed", "canceled", "duplicate"}
LABEL_COLORS = {
    "role:": "#2F6FED", "model:": "#9AA6B2", "loop:": "#1F8A70",
    "fix": "#C9463D", "stuck": "#C9463D", "proposed": "#E0A800", "reviewed": "#7A4DB5",
}

# Nested page sizes are explicit: Linear multiplies query complexity by `first` (default 50) and rejects
# queries over its limit. 50 issues x (20 labels + 15 relations + 15 inverse relations) stays well under it.
ISSUE_FIELDS = """
fragment IssueFields on Issue {
  id identifier title description url updatedAt completedAt priority branchName
  state { name type }
  labels(first: 20) { nodes { id name } }
  project { id name }
  projectMilestone { id name }
  relations(first: 15) { nodes { type relatedIssue { identifier state { name type } } } }
  inverseRelations(first: 15) { nodes { type issue { identifier completedAt state { name type } } } }
}
"""


class LinearError(Exception):
    def __init__(self, msg, unreachable=False):
        super().__init__(msg)
        self.unreachable = unreachable


# ---------------------------------------------------------------- transport

def gql(query: str, variables=None, retries: int = 5):
    load_env()
    key = env("LINEAR_API_KEY")
    if not key:
        raise LinearError("LINEAR_API_KEY is not set (agent-team/.env)")
    body = json.dumps({"query": query, "variables": variables or {}}).encode()
    delay = 2.0
    last = None
    for attempt in range(retries):
        req = urllib.request.Request(
            API, data=body,
            headers={"Content-Type": "application/json", "Authorization": key, "User-Agent": "gg-agent-team/1.0"},
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                data = json.loads(r.read().decode())
            if "errors" in data and data["errors"]:
                msg = "; ".join(e.get("message", "?") for e in data["errors"])
                if _rate_limited(json.dumps(data["errors"])) and attempt < retries - 1:
                    time.sleep(delay)
                    delay *= 2
                    continue
                raise LinearError(msg)
            return data["data"]
        except urllib.error.HTTPError as e:
            last = f"HTTP {e.code}"
            body_text = ""
            try:
                body_text = e.read().decode(errors="replace")
            except Exception:
                pass
            # Linear reports rate limits as HTTP 400 with extensions.code RATELIMITED, not only as 429.
            if e.code == 429 or e.code >= 500 or _rate_limited(body_text):
                if attempt < retries - 1:
                    ra = e.headers.get("Retry-After")
                    time.sleep(float(ra) if ra else delay)
                    delay *= 2
                    continue
                raise LinearError(f"{last} RATELIMITED after {retries} attempts" if _rate_limited(body_text)
                                  else f"{last} after {retries} attempts", unreachable=True)
            raise LinearError(f"{last}: {body_text[:300]}")
        except urllib.error.URLError as e:
            last = f"network: {e.reason}"
            if attempt < retries - 1:
                time.sleep(delay)
                delay *= 2
                continue
            raise LinearError(last, unreachable=True)
        except (http.client.IncompleteRead, http.client.RemoteDisconnected, ConnectionError, socket.timeout,
                TimeoutError, json.JSONDecodeError) as e:
            # A response cut off mid-transfer (seen through proxies) is transient: retry like a timeout.
            last = f"network: {type(e).__name__}"
            if attempt < retries - 1:
                time.sleep(delay)
                delay *= 2
                continue
            raise LinearError(last, unreachable=True)
    raise LinearError(last or "unknown", unreachable=True)


def _rate_limited(text: str) -> bool:
    t = (text or "").lower().replace(" ", "")
    return "ratelimited" in t or "ratelimit" in t


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def team_key():
    load_env()
    return env("LINEAR_TEAM_KEY", "ISA2")


def offline():
    return env("LINEAR_OFFLINE", "0") == "1"


# ---------------------------------------------------------------- cached ids

def meta(force=False) -> dict:
    if not force and CACHE_FILE.exists():
        try:
            c = json.loads(CACHE_FILE.read_text())
            if time.time() - c.get("ts", 0) < CACHE_TTL and c.get("team_key") == team_key():
                return c
        except json.JSONDecodeError:
            pass
    q = """query($key:String!){
      teams(filter:{key:{eq:$key}}){ nodes{ id key name states{ nodes{ id name type } } } }
      issueLabels(first:250){ nodes{ id name team{ id } } } }"""
    d = gql(q, {"key": team_key()})
    teams = d["teams"]["nodes"]
    if not teams:
        raise LinearError(f"team with key {team_key()} not found")
    t = teams[0]
    labels = {}
    for l in d["issueLabels"]["nodes"]:          # workspace labels first ...
        if not l.get("team"):
            labels[l["name"]] = l["id"]
    for l in d["issueLabels"]["nodes"]:          # ... team labels override same-name workspace labels
        if l.get("team") and l["team"]["id"] == t["id"]:
            labels[l["name"]] = l["id"]
    c = {
        "ts": time.time(), "team_key": t["key"], "team_id": t["id"], "team_name": t["name"],
        "states": {s["name"]: {"id": s["id"], "type": s["type"]} for s in t["states"]["nodes"]},
        "labels": labels,
    }
    RUNS.mkdir(exist_ok=True)
    CACHE_FILE.write_text(json.dumps(c, indent=2))
    return c


# ---------------------------------------------------------------- issues

def norm(n: dict) -> dict:
    blockers = [
        {"id": r["issue"]["identifier"], "state": r["issue"]["state"]["name"], "state_type": r["issue"]["state"]["type"],
         "completedAt": r["issue"].get("completedAt")}
        for r in (n.get("inverseRelations") or {}).get("nodes", []) if r["type"] == "blocks"
    ]
    blocks = [r["relatedIssue"]["identifier"] for r in (n.get("relations") or {}).get("nodes", []) if r["type"] == "blocks"]
    return {
        "id": n["identifier"], "uuid": n["id"], "title": n["title"],
        "state": n["state"]["name"], "state_type": n["state"]["type"],
        "labels": [l["name"] for l in n["labels"]["nodes"]],
        "label_ids": [l["id"] for l in n["labels"]["nodes"]],
        "blockers": blockers, "blocks": blocks,
        "milestone": (n.get("projectMilestone") or {}).get("name"),
        "project": (n.get("project") or {}).get("name"),
        "project_id": (n.get("project") or {}).get("id"),
        "description": n.get("description") or "",
        "updatedAt": n.get("updatedAt"), "completedAt": n.get("completedAt"),
        "branch": n.get("branchName"), "priority": n.get("priority"), "url": n.get("url"),
    }


def fetch_board(project=None) -> list:
    load_env()
    project = project or env("LINEAR_PROJECT")
    flt = {"team": {"key": {"eq": team_key()}}}
    if project:
        flt["project"] = {"name": {"eq": project}}
    q = ISSUE_FIELDS + """
    query($filter:IssueFilter, $after:String){
      issues(first:50, after:$after, filter:$filter){
        pageInfo{ hasNextPage endCursor } nodes{ ...IssueFields } } }"""
    issues, after = [], None
    while True:
        d = gql(q, {"filter": flt, "after": after})
        issues += [norm(n) for n in d["issues"]["nodes"]]
        pi = d["issues"]["pageInfo"]
        if not pi["hasNextPage"]:
            break
        after = pi["endCursor"]
    RUNS.mkdir(exist_ok=True)
    BOARD_FILE.write_text(json.dumps(issues, indent=1))
    return issues


def cached_board() -> list:
    if not BOARD_FILE.exists():
        raise LinearError("runs/board.json is missing; run `linear.py board` first")
    return json.loads(BOARD_FILE.read_text())


def board(refresh=True) -> list:
    if offline() or not refresh:
        return cached_board()
    return fetch_board()


def fetch_issue(ident: str, with_comments=False) -> dict:
    if offline():
        for i in cached_board():
            if i["id"] == ident:
                i.setdefault("comments", [])
                return i
        raise LinearError(f"{ident} is not in the cached board")
    q = ISSUE_FIELDS + """
    query($id:String!){ issue(id:$id){ ...IssueFields
      comments(first:50){ nodes{ body createdAt user{ name } } } } }"""
    d = gql(q, {"id": ident})
    if not d.get("issue"):
        raise LinearError(f"issue {ident} not found")
    i = norm(d["issue"])
    i["comments"] = sorted(
        [{"body": c["body"], "createdAt": c["createdAt"], "user": (c.get("user") or {}).get("name")}
         for c in d["issue"]["comments"]["nodes"]],
        key=lambda c: c["createdAt"],
    )
    return i


def uuid_of(ident: str) -> str:
    d = gql("query($id:String!){ issue(id:$id){ id } }", {"id": ident})
    if not d.get("issue"):
        raise LinearError(f"issue {ident} not found")
    return d["issue"]["id"]


# ---------------------------------------------------------------- readiness

def role_of(i: dict):
    return next((l[len("role:"):] for l in i["labels"] if l.startswith("role:")), None)


def model_alias_of(i: dict):
    return next((l[len("model:"):] for l in i["labels"] if l.startswith("model:")), None)


def blockers_closed(i: dict) -> bool:
    return all(b["state_type"] in CLOSED_TYPES for b in i["blockers"])


def is_ready(i: dict) -> bool:
    """Todo, or Backlog with every blocker closed; has a role label; no hold label."""
    if i["state_type"] in CLOSED_TYPES:
        return False
    if i["state"] not in ("Todo", "Backlog"):
        return False
    if not role_of(i):
        return False
    if HOLD_LABELS & set(i["labels"]):
        return False
    return blockers_closed(i)


def sort_key(i: dict):
    num = int(i["id"].rsplit("-", 1)[1]) if "-" in i["id"] else 0
    return (
        0 if "fix" in i["labels"] else 1,
        0 if any(l.startswith("loop:") for l in i["labels"]) else 1,
        i.get("milestone") or "~",
        num,
    )


def ready(issues: list) -> list:
    return sorted([i for i in issues if is_ready(i)], key=sort_key)


# ---------------------------------------------------------------- mutations

def set_state(ident: str, name: str):
    m = meta()
    st = m["states"].get(name)
    if not st:
        raise LinearError(f"unknown state {name!r}; known: {sorted(m['states'])}")
    gql("mutation($id:String!,$input:IssueUpdateInput!){ issueUpdate(id:$id,input:$input){ success } }",
        {"id": uuid_of(ident), "input": {"stateId": st["id"]}})


def ensure_label(name: str) -> str:
    m = meta()
    if name in m["labels"]:
        return m["labels"][name]
    color = next((c for p, c in LABEL_COLORS.items() if name.startswith(p)), "#6B7280")
    d = gql("mutation($input:IssueLabelCreateInput!){ issueLabelCreate(input:$input){ success issueLabel{ id name } } }",
            {"input": {"name": name, "teamId": m["team_id"], "color": color}})
    lid = d["issueLabelCreate"]["issueLabel"]["id"]
    m["labels"][name] = lid
    CACHE_FILE.write_text(json.dumps(m, indent=2))
    return lid


def label(ident: str, name: str, remove=False):
    m = meta()
    if remove:
        lid = m["labels"].get(name)
        if not lid:
            return
        inp = {"removedLabelIds": [lid]}
    else:
        inp = {"addedLabelIds": [ensure_label(name)]}
    try:
        gql("mutation($id:String!,$input:IssueUpdateInput!){ issueUpdate(id:$id,input:$input){ success } }",
            {"id": uuid_of(ident), "input": inp})
    except LinearError as e:
        if remove and "not on issue" in str(e).lower():
            return  # already absent: removal is idempotent (approve always removes `reviewed`, often not there)
        if "LabelIds" not in str(e):
            raise
        # older API shape: send the full label set
        cur = fetch_issue(ident)
        ids = set(cur["label_ids"])
        ids = ids - set(inp.get("removedLabelIds", [])) | set(inp.get("addedLabelIds", []))
        gql("mutation($id:String!,$input:IssueUpdateInput!){ issueUpdate(id:$id,input:$input){ success } }",
            {"id": cur["uuid"], "input": {"labelIds": sorted(ids)}})


def comment(ident: str, body: str):
    gql("mutation($input:CommentCreateInput!){ commentCreate(input:$input){ success } }",
        {"input": {"issueId": uuid_of(ident), "body": body}})


def last_answer(ident: str) -> str:
    i = fetch_issue(ident, with_comments=True)
    for c in reversed(i.get("comments", [])):
        b = c["body"].lstrip()
        if b.startswith("ANSWER:") or b.startswith("VERDICT:"):
            return c["body"]
    return ""


def project_by_name(name: str) -> dict:
    d = gql("query($name:String!){ projects(filter:{name:{eq:$name}}){ nodes{ id name projectMilestones{ nodes{ id name } } } } }",
            {"name": name})
    nodes = d["projects"]["nodes"]
    if not nodes:
        raise LinearError(f"project {name!r} not found")
    return nodes[0]


def relate(blocker: str, blocked: str):
    """blocker blocks blocked."""
    gql("mutation($input:IssueRelationCreateInput!){ issueRelationCreate(input:$input){ success } }",
        {"input": {"issueId": uuid_of(blocker), "relatedIssueId": uuid_of(blocked), "type": "blocks"}})


def create(title: str, description: str, role=None, model=None, labels=(), state="Backlog",
           project=None, project_id=None, milestone=None, blocked_by=(), blocks=(), priority=None) -> dict:
    m = meta()
    label_ids = [ensure_label(l) for l in labels]
    if role:
        label_ids.append(ensure_label(f"role:{role}"))
    if model:
        label_ids.append(ensure_label(f"model:{model}"))
    st = m["states"].get(state)
    if not st:
        raise LinearError(f"unknown state {state!r}")
    inp = {"teamId": m["team_id"], "title": title, "description": description,
           "stateId": st["id"], "labelIds": sorted(set(label_ids))}
    if project or project_id:
        if project_id and not milestone:
            inp["projectId"] = project_id
        else:
            p = project_by_name(project)
            inp["projectId"] = p["id"]
            if milestone:
                ms = next((x for x in p["projectMilestones"]["nodes"] if x["name"] == milestone), None)
                if ms:
                    inp["projectMilestoneId"] = ms["id"]
    if priority is not None:
        inp["priority"] = int(priority)
    d = gql("mutation($input:IssueCreateInput!){ issueCreate(input:$input){ success issue{ id identifier url } } }",
            {"input": inp})
    new = d["issueCreate"]["issue"]
    for b in blocked_by:
        relate(b, new["identifier"])
    for b in blocks:
        relate(new["identifier"], b)
    return new


# ---------------------------------------------------------------- reviewer

def _log_decision(ident, decision, why, mode):
    RUNS.mkdir(exist_ok=True)
    with REVIEWER_LOG.open("a") as f:
        f.write(json.dumps({"ts": now_iso(), "ticket": ident, "decision": decision, "why": why, "mode": mode}) + "\n")


def approvals_today() -> int:
    if not REVIEWER_LOG.exists():
        return 0
    today = date.today().isoformat()
    n = 0
    for line in REVIEWER_LOG.read_text().splitlines():
        try:
            r = json.loads(line)
        except json.JSONDecodeError:
            continue
        if r.get("decision") == "approve" and r.get("mode") == "auto" and r.get("ts", "").startswith(today):
            n += 1
    return n


def decide(ident: str, decision: str, why: str, mode="auto"):
    if decision not in ("approve", "reject", "escalate"):
        raise LinearError(f"unknown decision {decision!r}")
    if mode == "recommend":
        comment(ident, f"Reviewer (recommendation): **{decision}** — {why}\n\n"
                       "Isaac: remove the `proposed` label to approve, set Canceled to reject, or add `needs-isaac` to park it.")
        label(ident, "reviewed")
        _log_decision(ident, decision, why, mode)
        return
    if decision == "approve":
        cap = env_int("REVIEWER_MAX_APPROVALS_PER_DAY", 80)
        if approvals_today() >= cap:
            comment(ident, f"Reviewer: deferred — the daily approval cap ({cap}) is reached; will re-review tomorrow.")
            _log_decision(ident, "deferred", why, mode)
            return
        label(ident, "proposed", remove=True)
        label(ident, "reviewed", remove=True)
        comment(ident, f"Reviewer: approved — {why}")
    elif decision == "reject":
        label(ident, "proposed", remove=True)
        set_state(ident, "Canceled")
        comment(ident, f"Reviewer: rejected — {why}")
    else:
        label(ident, "needs-isaac")
        comment(ident, f"Reviewer: escalated — {why}")
    _log_decision(ident, decision, why, mode)


# ---------------------------------------------------------------- rendering

def render(i: dict) -> str:
    lines = [
        f"# {i['id']} — {i['title']}",
        f"State: {i['state']} | Project: {i.get('project') or '-'} | Milestone: {i.get('milestone') or '-'} | Priority: {i.get('priority')}",
        "Labels: " + (", ".join(i["labels"]) or "-"),
        "Blocked by: " + (", ".join(f"{b['id']} ({b['state']})" for b in i["blockers"]) or "-"),
        "Blocks: " + (", ".join(i["blocks"]) or "-"),
        f"Branch: {i.get('branch') or '-'}",
        f"URL: {i.get('url') or '-'}",
        "",
        i.get("description") or "(no description)",
    ]
    # Comments carry decisions made after the ticket was written (Isaac's approvals, spend caps, reviewer notes).
    # Runs cannot reach Linear, so they only see what is rendered here. Skip the dispatcher's own status lines.
    notes = [c for c in i.get("comments", [])
             if not (c.get("body") or "").lstrip().startswith(("Dispatcher:", "Heartbeat:"))]
    if notes:
        lines += ["", "## Comments (oldest first; later ones override the description)"]
        for c in notes[-12:]:
            body = (c.get("body") or "").strip()
            if len(body) > 2500:
                body = body[:2500] + " …(truncated)"
            lines += ["", f"**{c.get('user') or '?'}, {(c.get('createdAt') or '')[:16]}:**", body]
    return "\n".join(lines)


# ---------------------------------------------------------------- CLI

def main(argv=None) -> int:
    load_env()
    ap = argparse.ArgumentParser(prog="linear.py", description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd")

    p = sub.add_parser("board"); p.add_argument("--json", action="store_true")
    p = sub.add_parser("ready"); p.add_argument("--cached", action="store_true")
    p = sub.add_parser("issue"); p.add_argument("id"); p.add_argument("--json", action="store_true")
    p = sub.add_parser("render"); p.add_argument("file")
    p = sub.add_parser("answer"); p.add_argument("id")
    p = sub.add_parser("state"); p.add_argument("id"); p.add_argument("name")
    p = sub.add_parser("label"); p.add_argument("id"); p.add_argument("name"); p.add_argument("--remove", action="store_true")
    p = sub.add_parser("comment"); p.add_argument("id"); p.add_argument("text", nargs="?"); p.add_argument("--file")
    p = sub.add_parser("create")
    p.add_argument("--title", required=True); p.add_argument("--desc-file"); p.add_argument("--desc")
    p.add_argument("--role"); p.add_argument("--model"); p.add_argument("--blocked-by", default="")
    p.add_argument("--blocks", default=""); p.add_argument("--project"); p.add_argument("--milestone")
    p.add_argument("--state"); p.add_argument("--label", action="append", default=[]); p.add_argument("--priority")
    p.add_argument("--fix", action="store_true"); p.add_argument("--for", dest="for_ticket")
    for name in ("approve", "reject", "escalate"):
        p = sub.add_parser(name); p.add_argument("id"); p.add_argument("--why", required=True)
    p = sub.add_parser("recommend"); p.add_argument("id"); p.add_argument("--as", dest="decision", required=True,
                                                                          choices=["approve", "reject", "escalate"]); p.add_argument("--why", required=True)
    sub.add_parser("whoami"); sub.add_parser("labels"); sub.add_parser("states")
    a = ap.parse_args(argv)

    try:
        if a.cmd == "board":
            issues = board(refresh=True)
            print(json.dumps(issues, indent=1) if a.json else f"{len(issues)} issues -> {BOARD_FILE}")
        elif a.cmd == "ready":
            for i in ready(board(refresh=not a.cached)):
                print(i["id"])
        elif a.cmd == "issue":
            i = fetch_issue(a.id, with_comments=True)
            print(json.dumps(i, indent=1) if a.json else render(i))
        elif a.cmd == "render":
            print(render(json.loads(Path(a.file).read_text())))
        elif a.cmd == "answer":
            print(last_answer(a.id))
        elif a.cmd == "state":
            set_state(a.id, a.name); print(f"{a.id} -> {a.name}")
        elif a.cmd == "label":
            label(a.id, a.name, remove=a.remove); print(f"{a.id} {'-' if a.remove else '+'}{a.name}")
        elif a.cmd == "comment":
            body = Path(a.file).read_text() if a.file else (a.text or "")
            if not body.strip():
                raise LinearError("empty comment")
            comment(a.id, body); print(f"commented on {a.id}")
        elif a.cmd == "create":
            desc = Path(a.desc_file).read_text() if a.desc_file else (a.desc or "")
            blocked_by = [x.strip() for x in a.blocked_by.split(",") if x.strip()]
            blocks = [x.strip() for x in a.blocks.split(",") if x.strip()]
            labels = list(a.label)
            role, model, state, project_id, project = a.role, a.model, a.state, None, a.project
            if a.fix:
                if not a.for_ticket:
                    raise LinearError("--fix requires --for <TICKET>")
                parent = fetch_issue(a.for_ticket)
                role = role or role_of(parent)
                model = model or model_alias_of(parent)
                project_id = parent.get("project_id")
                state = state or "Todo"
                labels.append("fix")
                blocks = blocks + [a.for_ticket]
                desc = f"**Fix for {a.for_ticket}** — {parent['title']}\n\n" + desc
            else:
                state = state or "Backlog"
                if "proposed" not in labels and state == "Backlog":
                    labels.append("proposed")
            new = create(a.title, desc, role=role, model=model, labels=labels, state=state, project=project,
                         project_id=project_id, milestone=a.milestone, blocked_by=blocked_by, blocks=blocks, priority=a.priority)
            print(new["identifier"]); print(new["url"])
        elif a.cmd in ("approve", "reject", "escalate"):
            decide(a.id, a.cmd, a.why, mode="auto"); print(f"{a.cmd}: {a.id}")
        elif a.cmd == "recommend":
            decide(a.id, a.decision, a.why, mode="recommend"); print(f"recommended {a.decision}: {a.id}")
        elif a.cmd == "whoami":
            d = gql("query{ viewer{ id name email } }"); m = meta(force=True)
            print(json.dumps({"viewer": d["viewer"], "team": m["team_name"], "team_id": m["team_id"],
                              "states": sorted(m["states"]), "labels": len(m["labels"])}, indent=1))
        elif a.cmd == "labels":
            print("\n".join(sorted(meta()["labels"])))
        elif a.cmd == "states":
            print("\n".join(f"{k} ({v['type']})" for k, v in meta()["states"].items()))
        else:
            ap.print_help(); return 2
    except LinearError as e:
        # Agent runs may be sandboxed away from api.linear.app. Queue writes on disk; the dispatcher (outside
        # the sandbox) replays them on its next pass. Reviewer decisions and labels are queueable too, or the
        # auto reviewer could never approve anything. `state` is not: only the dispatcher changes states.
        if (e.unreachable and a.cmd in OUTBOX_CMDS and env("GG_KEY") and env("LINEAR_NO_OUTBOX") != "1"):
            path = queue_outbox(a, argv if argv is not None else sys.argv[1:])
            print(f"QUEUED: Linear is unreachable from this run; the dispatcher will post this ({path.name}).")
            return 0
        print(f"linear.py: {e}", file=sys.stderr)
        return 2 if e.unreachable else 1
    return 0


OUTBOX = RUNS / "outbox"
OUTBOX_CMDS = ("comment", "create", "label", "approve", "reject", "escalate", "recommend")


def queue_outbox(a, raw_argv) -> Path:
    """Save a comment/create as argv with file contents inlined, so it can be replayed from any directory."""
    argv = list(raw_argv)
    for flag, repl in (("--file", None), ("--desc-file", "--desc")):
        if flag in argv:
            i = argv.index(flag)
            text = Path(argv[i + 1]).read_text()
            if repl:
                argv[i:i + 2] = [repl, text]
            else:  # comment --file F -> comment T "text"
                argv[i:i + 2] = [text]
    OUTBOX.mkdir(parents=True, exist_ok=True)
    path = OUTBOX / f"{time.strftime('%Y%m%dT%H%M%S')}-{os.getpid()}-{a.cmd}.json"
    path.write_text(json.dumps({"argv": argv, "key": env("GG_KEY"), "queuedAt": now_iso()}, indent=1))
    return path


def flush_outbox(log=print) -> int:
    """Replay queued comments/creates. Returns how many were posted."""
    if not OUTBOX.exists():
        return 0
    posted = 0
    os.environ["LINEAR_NO_OUTBOX"] = "1"
    try:
        for p in sorted(OUTBOX.glob("*.json")):
            item = json.loads(p.read_text())
            rc = main(item["argv"])
            if rc == 0:
                p.unlink()
                posted += 1
                log(f"outbox: posted {p.name} ({item.get('key')})")
            elif rc == 2:  # network: keep it and stop this flush
                log(f"outbox: {p.name} failed rc={rc}; will retry")
                break
            else:  # Linear rejected it (bad id, missing entity): retrying will never work
                failed = OUTBOX / "failed"
                failed.mkdir(exist_ok=True)
                p.rename(failed / p.name)
                log(f"outbox: {p.name} rejected by Linear (rc={rc}); moved to outbox/failed/ ({item.get('key')})")
    finally:
        os.environ.pop("LINEAR_NO_OUTBOX", None)
    return posted


if __name__ == "__main__":
    sys.exit(main())
