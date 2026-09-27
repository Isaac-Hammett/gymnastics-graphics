# Claude Code Memory - Gymnastics Graphics

Short by design: every agent run loads this file, so it holds only what changes behavior. Runbooks, per-system reference, and deploy procedures live in **[docs/OPS-MANUAL.md](docs/OPS-MANUAL.md)**.

## System Map - START HERE

**[SYSTEM-OVERVIEW.md](SYSTEM-OVERVIEW.md)** is the map of the whole codebase: 19 systems in 5 layers, each with a status (Proven / Built / Partial / Orphaned) and a sport-coupling rating (Generic / Sport-parameterized / Gymnastics-bound), four diagrams, and how the systems connect over Firebase, sockets, and HTTP. **[docs/system-map/](docs/system-map/README.md)** holds the full entry per system (every Firebase path, socket event, route, dependency, known gap, and the evidence behind its status).

Read the overview before making architectural claims or starting a new feature. Two rules that came out of building it:
- **PRD `Status:` lines are not a status source.** They are wrong in both directions. The `plan.md` / `implementation-plan.md` inside each PRD folder is usually accurate; the code and the live Firebase contents are authoritative.
- **Producer View is the product.** The systems are its features. Surfaces (Home, Competition workspace, Producer View, Talent View, Settings) compose systems; they are not systems.

For planning work rather than understanding the system, **[docs/TOOL-INVENTORY.md](docs/TOOL-INVENTORY.md)** and **[docs/tool-inventory.csv](docs/tool-inventory.csv)** list every capability as one row with its control surface, reliability, evidence, and gymnastics coupling.

Last surveyed: 2026-09-10. When a system changes materially, update its entry in `docs/system-map/`, the summary table in the overview, and the matching rows in the inventory.

## Git Workflow - IMPORTANT

- `main` is the only long-lived branch. Humans commit to `main` directly.
- Agent-team runs work in a git worktree on a ticket branch (`../gymnastics-graphics-worktrees/<TICKET>`, outside this repo), commit with the trailer line `Ticket: ISA2-N`, and never push. The dispatcher merges the branch into local `main` after the run exits; it does not push.
- Never force-push. Never rewrite `main` history.
- **Pushing `main` is a deploy.** `.github/workflows/deploy-coordinator.yml` ships `server/` changes to the production coordinator on every push to `main`. Only Isaac pushes.
- Production (commentarygraphic.com, api.commentarygraphic.com) is live again as of 2026-09-27. Agents never deploy; for them "deploy" means "build, test, and verify on local dev". Deploy runbooks are in the ops manual.

## Agent Team (Linear-driven runs)

The board is Linear team **Isaac_Production** (prefix `ISA2`). Projects are the 19 engines from the system map plus feature projects (for example Xavier). `Page: X` labels say which surface a ticket touches. `role:<name>` labels say which kind of work it is. Tooling, README, and the human interface live in **[agent-team/](agent-team/README.md)**.

**Goal:** the next meet runs from Producer View with every page it uses at Built or better, verified on local dev by screenshot. Built is the ceiling an agent can reach; Proven means it ran in a real broadcast, and only Isaac grants it.

**Where things live**

| What | Where |
|---|---|
| Board CLI | `agent-team/tools/linear.py` (board, ready, issue, answer, state, label, comment, create, approve/reject/escalate/recommend) |
| Store CLI | `agent-team/tools/store.py` (commits per ticket, evidence dirs, gaps) |
| Run artifacts | `agent-team/runs/<KEY>.answer.md`, `.exit`, `.result.json`; logs in `agent-team/logs/` |
| Committed evidence | `docs/verification/<TICKET>/` (screenshots the implementer commits) |
| Role files | `agent-team/agents/<role>.md` |
| Subagents | `agent-team/subagents/*.md`, passed to every run with `--agents` |

**The contract every ticket agent follows, in order**

1. Read the ticket. Launch the `scout` subagent for a brief: what already exists, which files the ticket names and whether they exist, what the blockers' ANSWER comments said, what not to redo.
2. Do the work in your worktree only. One ticket, one branch. Prefer the smallest change that satisfies every **Done when** line.
3. Build and test before you claim anything: `cd server && npm test` for server changes, `cd show-controller && npm run build` for frontend changes. If the ticket has a `Page:` label, take a Playwright screenshot of the affected page on local dev, save it under `docs/verification/<TICKET>/`, read it back with the Read tool, and describe what it shows. A blank page, a login redirect, an empty state, or a console error is a FAIL even when the code is right.
4. Commit with specific paths (never `git add -A`) and the trailer line `Ticket: <TICKET>`. Never push.
5. Write `agent-team/runs/<TICKET>.answer.md`. Line 1 is `ANSWER:`. Then one line per Done-when item, `- [x]` or `- [ ]`, with what proves it (test name, commit hash, screenshot path). Then 3 to 10 lines a person can act on. Post it: `python3 agent-team/tools/linear.py comment <TICKET> --file agent-team/runs/<TICKET>.answer.md`.
6. Exit 0 when every Done-when line is met. Exit 1 when stuck, with the answer saying what is missing. If turns run low, commit what works, create a follow-up carrying the unmet Done-when lines (`linear.py create --fix --for <TICKET> ...`), and exit 0.
7. If you find a need the board does not cover, run `linear.py create` with **Fills:**, **Done when:**, and **Model:** lines. It lands in Backlog labeled `proposed`. Never work on it yourself.
8. Never change a ticket's state or labels yourself. The dispatcher does that.

**Verifier runs** (`role: verify`) judge and never trust. They re-run build and tests on merged `main`, take their own screenshots, grade each Done-when line, and either pass the ticket or file a `fix` ticket that blocks it.

**Hard rules**
- Firebase: read freely; write only under `competitions/$TEST_COMP_ID/`. Never call `firebase_delete`. Never touch a real competition's data, `teamsDatabase/`, or `themes/` in a run.
- Never start, stop, or terminate AWS instances; never SSH to a VM; never deploy.
- Never commit secrets (`.env`, service-account JSON). Never `git push`, never `--force`, never rewrite history.
- Never send email, messages, or outreach from the talent CRM.
- Only Isaac decides: spending money, relaunching production, deleting data, contacting people, on-air design changes, marking a system Proven. Escalate by creating a ticket that names the decision; the reviewer adds `needs-isaac`.

**Model rule for created tickets**
- haiku: pure read or mechanical edit (rename, table update, one-file fix with a test that already exists).
- sonnet: most implementation tickets with a clear spec; the default for every role.
- opus: cross-cutting design (touches `timesheetEngine`, `playoutEngine`, `server/index.js` routing, or three or more systems), or work four or more tickets build on.
- When unsure, pick the cheaper model and say so in the **Model:** line.

**Token rules**
- Fewer, bigger steps. Read a file once. Do not re-dump what scout summarized.
- Use `searcher` for "where is X" questions; give it 5 to 10 questions per launch.
- Use `tester` to run builds and tests; it returns only the failing output.
- Write the answer file once, at the end.

**Roles:** graphics, frontend, server, data, docs (ticket roles); verify, planner, reviewer (system roles). **Subagents:** scout (haiku, brief), searcher (haiku, code facts with file:line), tester (sonnet, runs builds and tests). Subagents return facts; only the ticket agent writes.

## Engineering Rules That Bite

- **Socket handlers first.** Inside `io.on('connection')`, register every `socket.on(...)` before any `await`. An awaited OBS or external call before registration silently drops client events (BUG-021).
- **Per-team registry lookups.** The registry stores `team-roster`, not `team1-roster`. Strip the number: `graphicId.replace(/^team\d+-/, 'team-')`, then look up both.
- **Headshot and media keys use spaces.** `teamsDatabase/headshots/alexis schulman`, never underscores. `getSafeFirebaseKey()` only replaces `.#$[]/`.
- **Theme colors use the full 3-layer cascade:** `var(--{graphicId}-x, var(--meet-x, fallback))`. Missing `--meet-header-bg-image` fallbacks were a real bug class; new graphics get every layer.
- **Sponsors live on the theme** (`themes/{id}/sponsors`) when a theme is active; team-level sponsors are for regular-season meets only.
- **Five or more teams: never hardcode rotation schedules.** Read the `rotation` field on each Virtius event (`detectEventFromApiData()` in output.html).
- **Server code is ESM** (`export`, not `module.exports`). The coordinator needs Firebase Admin credentials (`GOOGLE_APPLICATION_CREDENTIALS`) for rundown loading, VM pool, and other server-side Firebase features.
- **Build, test, and deploy one at a time.** Fan out reads and searches freely; never run two builds in one checkout concurrently.
- **When a system changes materially,** update `docs/system-map/<system>.md`, the SYSTEM-OVERVIEW summary table, and the rows in `docs/tool-inventory.csv`.

## Domain Quick Facts

- Men's olympic order: FX PH SR VT PB HB. Virtius event names: FLOOR HORSE RINGS VAULT PBARS BAR.
- Women's: VT UB BB FX.
- Competition types: `mens-dual`, `womens-dual` (head-to-head by default), `mens-tri`, `womens-tri`, `mens-quad`, `womens-quad`, `mens-5`, `mens-6`, `womens-5`, `womens-6`, `womens-7`.
- Local dev: SPA `show-controller` on :5173 (`npm run dev`), coordinator `server` on :3003 (`npm start`); `show-controller/.env.local` points the SPA at the local coordinator. The verify lane uses :5199 / :3099 inside the `_verify` worktree (`agent-team/devserver.sh`).
- Test login for Playwright comes from `agent-team/.env` (`VERIFY_LOGIN_EMAIL` / `VERIFY_LOGIN_PASSWORD`). Never paste credentials into prompts, tickets, or commits.

## Full Reference

**[docs/OPS-MANUAL.md](docs/OPS-MANUAL.md)**: MCP tools, deploy runbooks (for the relaunch), stage engine, unified theme system and per-graphic overrides, theme error reporting, coordinator ops, VM pool and custom VMs, theme editor, clip integration, Who to Watch, competition formats, adding a team, composite teams.

---

<!-- BEGIN AWS Agent Toolkit rules -->
# AWS Guidance

- Where these AWS rules conflict with the project's own instructions, the
  project's instructions take precedence.
- Prefer the AWS MCP Server for AWS interactions — it provides sandboxed
  execution, observability, and audit logging. If unavailable, use the
  AWS CLI directly.
- Before starting a task, check whether a relevant AWS skill is available.
  Load the skill with `retrieve_skill` and prefer its guidance over
  general knowledge.
- When uncertain about specific AWS details (API parameters, permissions,
  limits, error codes), verify against documentation rather than guessing.
  State uncertainty explicitly if you cannot confirm.
- When creating infrastructure, prefer infrastructure-as-code (AWS CDK or
  CloudFormation) over direct CLI commands.
- When working with infrastructure, follow AWS Well-Architected Framework
  principles.
- Do not use em dashes in AWS resource names or descriptions. Use
  hyphens instead.

## Secret Safety

- MUST load the `aws-secrets-manager` skill first for any secret,
  credential, API key, token, or password task. MUST NOT call
  `secretsmanager get-secret-value` or `batch-get-secret-value`, and MUST
  NOT hit the Secrets Manager Agent daemon directly. MUST use
  `{{resolve:secretsmanager:secret-id:SecretString:json-key}}` with
  `asm-exec` so the secret resolves at runtime without entering context.
<!-- END AWS Agent Toolkit rules -->
