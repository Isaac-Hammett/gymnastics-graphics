# Agent team: Linear-driven autonomous runs

A dispatcher starts one headless Claude Code agent per ready Linear ticket, merges what they build into `main`, has a separate verifier judge the result, and files fix tickets for whatever fails. A planner proposes tickets from gaps and a reviewer screens proposals. You steer with labels and states in Linear.

Ported from the design that ran the partner-research project, adapted for a code repo with one shared Firebase: git worktrees per ticket, a serial verify lane with its own dev servers, and Linear states for the old PASS / REJECTED / NEEDS REVIEW flow.

## File map

| File | Purpose |
|---|---|
| `dispatch.py` | The loop. `--once`, `--dry-run`, `--offline`. State in `runs/dispatch_state.json`, log in `logs/dispatch.log`. |
| `agent_run.sh <KEY> <role> [model] [--prepare-only]` | Runs one agent in a worktree: `ISA2-12`, `ISA2-12.verify`, `PLANNER`, `REVIEWER`. |
| `sync.py` | After every close: board and gap snapshots, human rejections, the zero-commit check, `**Target:**` re-queues. |
| `loops.py` | Gaps computed by code plus the ticket template for each. |
| `devserver.sh start\|stop\|status\|logs` | Dev servers for the verify lane on :5199 / :3099 inside the `_verify` worktree. |
| `tools/linear.py` | Board CLI (GraphQL, stdlib only). `linear.py --help`. |
| `tools/store.py` | Commits per ticket (`Ticket: ISA2-N` trailer), evidence dirs, gaps. |
| `tools/usage.py` | Cost per run and per model from `runs/*.result.json`; `--transcripts` for an estimate from session logs. |
| `tools/common.py`, `tools/streamlog.py` | Env and model resolution; readable log + cost capture from stream-json. |
| `agents/<role>.md` | One file per role: graphics, frontend, server, data, docs, verify, planner, reviewer. |
| `subagents/*.md` | scout, searcher, tester. Passed to every run with `--agents`. |
| `models.conf`, `settings.conf`, `env.example` | Model table; committed project settings (test competition); copy `env.example` to `.env` for secrets. Load order: models.conf, settings.conf, .env. |
| `hooks/guard.sh` | Optional PreToolUse hook that blocks push, force, history rewrites, `git add -A`, AWS, ssh. |
| `runs/`, `logs/` | Gitignored run state. |
| `../gymnastics-graphics-worktrees/` | One worktree per ticket, plus `_verify` (and `_main` if `main` is checked out nowhere else). Outside the repo on purpose; override with `WORKTREES_DIR`. |

The root `CLAUDE.md` holds the contract every agent follows; `docs/OPS-MANUAL.md` holds the long reference it used to contain.

## Setup

1. `cp agent-team/env.example agent-team/.env` and fill in the secrets only: `LINEAR_API_KEY` (a personal API key from Linear settings), `VERIFY_LOGIN_EMAIL`, `VERIFY_LOGIN_PASSWORD`. Non-secret settings such as `TEST_COMP_ID` live in the committed `settings.conf`; a blank line in `.env` does not override them.
2. Make sure `show-controller/.env.local` and `server/.env` exist and work in your own checkout (`npm run dev` on :5173, `node index.js` on :3003, login works). The runner copies both into every worktree.
3. The coordinator needs Firebase Admin access, or server-side features stay broken for the agents too. Check it with `curl -s localhost:3003/api/admin/themes`: a JSON list of themes means it works. It did on 2026-09-27.
4. `agent-team/` must be committed on `main` (done 2026-09-27). Worktrees branch from `main`, so agents only ever see what is on `main`.
5. No MCP approval step is needed: the runner passes `--mcp-config .mcp.json --strict-mcp-config`. Checked on 2026-09-27: playwright and gymnastics both connect in a headless run, and `firebase_delete`, the AWS tools, and the SSH tools are absent from the agent's tool list.
6. Optional: `brew install coreutils` if `gtimeout` is missing; the runner accepts `timeout` too.
7. Keep your own checkout on `main`. The dispatcher merges into whichever checkout has `main`, so your dev server hot-reloads merged work. Git refuses a merge only if it would touch a file you changed; the dispatcher then waits and notifies you once.

## Smoke test (run in this order)

```bash
cd agent-team
python3 tools/linear.py whoami            # key, team, states, label count
python3 tools/linear.py board             # writes runs/board.json
python3 tools/linear.py ready             # should print nothing until the gate ticket closes
python3 tools/store.py dump               # commits per ticket + gaps
python3 sync.py --dry-run                 # what sync would change
python3 dispatch.py --once --dry-run      # one pass, no changes
bash agent_run.sh ISA2-271 server --prepare-only   # makes the worktree + prompt without launching claude
bash agent_run.sh ISA2-271.verify verify --prepare-only && bash devserver.sh start && bash devserver.sh stop
```

Then one ticket by hand before the loop, the same discipline as the old route loops:

```bash
bash agent_run.sh ISA2-271 server          # watch logs/ISA2-271.log in another pane
python3 dispatch.py --once                 # merges, sets In Review, queues verify
python3 dispatch.py --once                 # starts the verifier (next pass, after Linear shows In Review)
```

Read the verdict in `runs/ISA2-271.verify.answer.md` and on the ticket before you trust the loop.

## Run

```bash
tmux new -s dispatch 'cd agent-team && python3 dispatch.py'
```

Per-run sessions are `gg-<KEY>` (`tmux attach -t gg-ISA2-275`). Killing the dispatcher leaves them running; restarting re-adopts them.

## How a ticket flows

1. **Ready** = Todo, or Backlog with every blocker closed; has a `role:` label; no hold label (`hold`, `proposed`, `stuck`, `size:L`, `needs-isaac`). Fix tickets first, then loop tickets, then by milestone, then by id.
2. **In Progress**: the runner makes `../gymnastics-graphics-worktrees/<T>` on the Linear branch, symlinks `node_modules` and `agent-team/runs|logs` back to the main checkout, copies the env files, and launches `claude -p` with the role file + ticket + closing instructions. Heartbeat comment every 10 minutes.
3. **Exit 0** (or a harness failure with an answer on disk): the dispatcher merges the branch into `main` (in whichever checkout has `main`, else `_main` in the worktrees dir), pushes, sets **In Review**, removes the ticket worktree.
4. **Verify lane** (one at a time): a fresh agent on a detached checkout of `main` re-runs build and tests, screenshots, grades each Done-when line, and writes `VERDICT: PASS|FAIL|BLOCKED`.
5. **PASS** → Done. **FAIL** → fix ticket(s) created with `linear.py create --fix --for T`, labeled `fix`, blocking T, dispatched first; when they close, T is re-verified. **BLOCKED** → `stuck`.
6. **Exit 1** → `stuck` + log tail in a comment + notification. **Exit 2** → Linear was unreachable; quiet requeue. **Exit 3** → worktree could not be prepared (usually a merge conflict with `main`).

## Your interface (labels and states)

| You want to | Do this |
|---|---|
| Reject a Done ticket | Add a comment saying what is wrong, then add `returned`. Sync swaps it for `rework` and sets Todo; when the verifier passes the rework it stops at **In Review** for you, never Done. |
| Reject again | Add `returned` again on the In Review ticket. |
| Approve rework | Set Done. |
| Pause a ticket | Add `hold`. |
| Keep a decision for yourself | Add `needs-isaac`. |
| Approve a proposal (recommend mode) | Remove `proposed`. Reject: set Canceled. |
| Split a big ticket | Add `size:L`; the planner splits it (or split by hand). |
| Stop a run | `tmux kill-session -t gg-<KEY>`; the dispatcher marks it stuck on the next pass. |
| Unstick | Fix the cause, remove `stuck`, set Todo. |

A Done ticket with a `role:` label and no commit stamped `Ticket: <id>` is sent back to Todo once, with a comment. Use Canceled for tickets that need no work. A verifier FAIL that filed no fix ticket gets `stuck`, since nothing would ever re-verify it.

## Reviewer ladder

Stage 1 (now): `REVIEWER_MODE=recommend`. The reviewer comments a recommendation and adds `reviewed`; you approve or reject in Linear. Every recommendation and your decision are in `runs/reviewer_log.jsonl` and the ticket history. Stage 2: once its recommendation has matched your decision for about twenty proposals in a row, switch to `auto` for haiku/sonnet tickets without a Page label by editing `agents/reviewer.md` step 5 to escalate the rest. Stage 3: `auto` for everything. The daily cap (`REVIEWER_MAX_APPROVALS_PER_DAY`) applies in auto mode.

## Day one: Xavier

The chain from ISA2-270 (inputs, yours) → 271 (local dev setup) → 272 → … → 279 is strictly serial, so day one runs one agent at a time and exercises the contract, the verifier, the fix loop, merge-to-main, and the human gate, without stressing parallel merges. Before the first run: close the environment gate ticket and ISA2-270, confirm `linear.py ready` prints `ISA2-271`, and run it by hand as above. Step 7 (ISA2-278) carries `size:L`; split it before it becomes ready.

## Cost

`python3 tools/usage.py --since 24h` reads the exact cost claude reports per run. Roughly: a sonnet implementer run is a few dollars, an opus run several times that, a verifier run less than an implementer. `--transcripts` estimates from session logs when a run died before printing its result.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `linear.py: LINEAR_API_KEY is not set` | `.env` missing | Step 1 of Setup. |
| `ready` prints nothing | every candidate is blocked, has no `role:` label, or carries a hold label | `python3 tools/linear.py issue <id>` shows blockers and labels. |
| Merge deferred notification | the merge would overwrite a file you changed (or you have staged changes) in the checkout that has `main` | Commit or stash that file; the dispatcher retries every pass. Unrelated local changes, like the registry timestamp `npm run dev` rewrites, do not block merges. |
| Verifier BLOCKED | dev servers did not start | `bash devserver.sh start`, then `bash devserver.sh logs`. Usually a missing `server/.env` or a port in use. |
| Run silent for 20 minutes, then stuck | claude exited without writing a result | `logs/<KEY>.err` has the reason (often an MCP server that needs approval or a bad flag). |
| Exit 3 | branch cannot take `main` cleanly | Resolve in `../gymnastics-graphics-worktrees/<T>` by hand, commit, remove `stuck`, set Todo. |
| Hooks | `claude -p` may not run PreToolUse hooks | `hooks/guard.sh` is belt-and-braces; the hard rules in CLAUDE.md and the tool allowlist are the real guard. Try `--settings agent-team/hooks/settings.json` in `agent_run.sh` if you want it active. |

## Design notes (where this differs from the original)

- **CLAUDE.md is not pasted into the prompt.** `claude -p` loads it from the worktree, so the prompt is role file + ticket + closing instructions.
- **Subagents are passed with `--agents`** from `subagents/*.md` instead of living in `.claude/agents/`, so they travel with the tooling and need no per-worktree setup.
- **Exit 0 means In Review, not Done.** Only a verifier PASS closes a ticket. The verifier files tickets rather than fixing, so every failure is visible on the board.
- **The store is git.** Proof of work is a commit with the trailer `Ticket: ISA2-N` plus a screenshot under `docs/verification/<T>/`; `store.py` counts both.
- **Standing loops start disabled.** Three gaps are computed by code (orphaned hooks, registry graphics without a renderer, untested server libs); more can be added to `loops.py` when they are worth a ticket.
- **stream-json logs.** Each turn appears in `logs/<KEY>.log` as it happens, so a quiet log is a real signal, and the final `result` line gives exact cost. The first lines show each MCP server's status.
- **Worktrees live outside the repo.** Nested inside it, every agent loaded the root `CLAUDE.md` twice, and repo-wide searches picked up agent copies. The runner exports `GG_TEAM_DIR` / `GG_ROOT` so tools called from a worktree still read and write the main checkout's `runs/`.
- **Human rejections become `rework`.** Converting `returned` on sight keeps sync from bouncing a ticket back to Todo while its rework is in review.
- **Sync keeps its own state file** (`runs/sync_state.json`); the dispatcher holds `dispatch_state.json` in memory for a whole pass.
