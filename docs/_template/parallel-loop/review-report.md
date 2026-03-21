# Parallel Loop System — Review Report

**Date:** 2026-03-21
**Documents reviewed:** 8 template files + 2 real-world instances
**Real-world instances examined:**
- `docs/PRD-Clip-Integration/ui/prototype/` (5 code loops + shell + verify)
- `docs/PRD-Clip-Integration/ui/visualizer/_build/` (5 code loops + shell + verify)

---

## Executive Summary

The parallel loop system is a well-designed orchestration framework that successfully parallelizes independent code loops. The real-world prototype build completed all 18 code tasks across 5 loops with zero errors, proving the architecture works. However, the system has **three high-risk gaps**: (1) git race conditions between parallel loops committing simultaneously are unmitigated, (2) the `has_critical_issues` regex doesn't match the actual JSON format verify loops produce, and (3) there is no enforcement mechanism for file ownership — violations are silent. The template has also diverged from real-world usage: the manifest-based 4-phase pipeline has never been used in production; both real instances used the older per-loop `plan.md` approach.

---

## Assumptions Inventory

### Implicit Assumptions

| # | Assumption | Verified? | Risk |
|---|-----------|-----------|------|
| A1 | Each loop only writes to its own files | Social contract only, no enforcement | HIGH — silent corruption if violated |
| A2 | `plan.md` is valid and parseable after Claude edits it | Never validated | MEDIUM — malformed markers break `count_tasks` |
| A3 | Status JSON files are valid JSON when monitor reads them | No atomic writes | MEDIUM — partial write = broken dashboard |
| A4 | Claude will complete exactly one task per iteration | Prompt instruction only | LOW — Claude is generally compliant |
| A5 | Claude will stop after outputting `ALL_COMPLETE` | Prompt instruction only | LOW — `run-loop.sh` checks `count_tasks` independently |
| A6 | `git push` from parallel loops won't conflict | No locking, no retry | HIGH — rejected pushes = stale deploy |
| A7 | Plan file task markers use exact strings `— NOT STARTED` / `— COMPLETE` | Fragile string matching | MEDIUM — typo breaks detection |
| A8 | Manifest concurrent writes to "different sections" are safe | Git doesn't do section-level merging | HIGH — merge conflicts on concurrent edits |
| A9 | `npm run build` is never called during Phase 1 | Social contract in prompts | LOW — prompts say "no deploy, no build" |
| A10 | Playwright verify loops are truly read-only | Depends on test implementation | LOW — Playwright reads, doesn't write |

### Handoff Points

| # | From → To | Data Format | Failure Mode |
|---|-----------|-------------|-------------|
| H1 | Phase 0 output → Phase 1 input | File existence check (`$PHASE_0_ARTIFACT`) | Clean — hard fail if artifact missing |
| H2 | Code loop → status JSON → monitor | JSON file on disk | Partial write visible to monitor |
| H3 | Code loop → git commits → deploy build | Git history | Push failure = stale code deployed |
| H4 | Code loop → plan.md markers → run-loop.sh | Grep string matching | Typo in marker = infinite loop or false stall |
| H5 | Deploy output → verify loop URLs | Implicit (hardcoded URLs in prompts) | Stale/cached content = false PASS |
| H6 | Verify loop → issues JSON → fix cycle code loops | JSON file in `issues/` dir | Missing file = assumed no issues (correct default) |
| H7 | Individual verify logs → merged verify log | HTML with embedded JSON markers | Merge prompt could silently drop entries |

### Race Condition Windows

| # | Scenario | Likelihood | Impact |
|---|----------|-----------|--------|
| R1 | Two loops run `git add` + `git commit` simultaneously | HIGH (parallel by design) | Generally safe — git commits are local |
| R2 | Two loops run `git push` simultaneously | HIGH | One push rejected (non-fast-forward), deploy builds stale code |
| R3 | Two loops edit `manifest.md` simultaneously | HIGH (if using manifest) | Git merge conflict on push — second loop fails |
| R4 | Monitor reads status JSON mid-write | MEDIUM | `grep` on partial JSON — may show wrong status or crash silently |
| R5 | Two loops run `npm install` | LOW (prompts forbid) | Corrupted `node_modules`, broken builds for both |
| R6 | `rm -f issues/*.json` during active verify loop writes | LOW (phases are sequential) | Race between Phase 4 cleanup and late Phase 3 write |

---

## Failure Modes

### Category A: Silent Failures

**3.A.1 — Code loop crashes mid-task, status JSON stuck on "running"**
- Trigger: Claude process crashes (OOM, network timeout, context overflow)
- Symptom: Monitor shows loop as "running" forever. After 5 min, monitor marks it "stalled" (cosmetic only — no recovery action)
- Blast radius: Pipeline hangs. Monitor never auto-exits. User must Ctrl+C and investigate.
- Current mitigation: 5-minute stall threshold in monitor.sh detects it visually. `run-loop.sh` exits with error on stall, which *does* update status to "stalled" — but only if `run-loop.sh` itself is still running.
- Likelihood: **MEDIUM** — Claude crashes are uncommon but happen on large tasks

**3.A.2 — Code loop finishes but git push fails**
- Trigger: Two loops push simultaneously; second gets "non-fast-forward" rejection. Or network error.
- Symptom: Nothing visible. `run-loop.sh` doesn't check `git push` exit code. Loop reports success, moves to next task.
- Blast radius: **Significant** — deploy builds from `main` which is missing that loop's code. Deployed site is broken for that section. Verify loop may catch it, but fix cycle rebuilds code that was already built.
- Current mitigation: **None.** Real-world prompts (e.g., producer prompt) don't even include `git push` — they only `git commit`. The push failure is silent.
- Likelihood: **HIGH** — this is the #1 risk in the system

**3.A.3 — Deploy serves cached/stale assets**
- Trigger: Browser cache, nginx proxy cache, CDN edge cache
- Symptom: Verify loop sees old version, reports PASS (if old version worked) or FAIL (for wrong reasons)
- Blast radius: Wasted fix cycle or false confidence
- Current mitigation: None. No cache-busting headers, no versioned URLs.
- Likelihood: **MEDIUM** — nginx config matters; not checked

**3.A.4 — Verify loop tests wrong URL or element**
- Trigger: Verify prompt has hardcoded URLs that don't match what was deployed, or Playwright selects wrong element
- Symptom: PASS verdict on untested functionality
- Blast radius: False confidence — bug ships
- Current mitigation: Verify prompts are manually written with correct URLs. No automated URL validation.
- Likelihood: **LOW** — prompts are customized per feature

**3.A.5 — Code loop writes to a file it doesn't own**
- Trigger: Claude interprets task broadly, or task description references shared file
- Symptom: Silent at first. May cause merge conflict when other loop's owner also edits the file. Or worse: both edits succeed but are logically incompatible.
- Blast radius: Potentially large — inconsistent state across sections, hard to diagnose
- Current mitigation: **None enforced.** Prompt says "do NOT modify any other files" but there's no pre-commit hook or file-level locking.
- Likelihood: **MEDIUM** — Claude generally follows instructions but may touch shared config/CSS

**3.A.6 — Merge step silently drops verification entries**
- Trigger: `merge_verification_logs` delegates to a Claude invocation that parses HTML. If one log has different formatting, Claude may skip entries.
- Symptom: Combined verification-log.html is missing entries from one loop. User sees fewer items than expected but may not notice.
- Blast radius: Missing verification data — false confidence
- Current mitigation: None. No entry count validation after merge.
- Likelihood: **LOW** — Claude is generally good at parsing, but this is the kind of thing that fails once and you don't notice

### Category B: State Corruption

**3.B.1 — Two loops run git add + commit at the same time**
- Trigger: Normal parallel operation
- Symptom: Git handles concurrent *local* commits fine — each loop is in its own process, same working directory. `git add` + `git commit` from different processes is safe because git uses lock files internally. Commits are sequential under git's internal lock.
- Blast radius: None for local commits. Push is the problem (see 3.A.2).
- Current mitigation: Git's internal lock file handles this correctly.
- Likelihood: HIGH (happens every run), but **impact is NONE** for local operations.

**3.B.2 — Manifest gets conflicting edits from parallel loops**
- Trigger: Two loops both edit `manifest.md` to mark different tasks COMPLETE, then both push
- Symptom: Second push fails with merge conflict. Or if using auto-merge, git may produce garbled markdown.
- Blast radius: Manifest becomes unreliable. Subsequent loops read wrong task state.
- Current mitigation: Real-world instances avoided this by using per-loop `plan.md` files instead of a shared manifest. **The manifest approach has never been tested in parallel.**
- Likelihood: **HIGH if using manifest** (template default), **NONE with per-loop plans** (real-world approach)

**3.B.3 — Status JSON partially written**
- Trigger: `cat > "$STATUS_FILE" <<EOF` is not atomic. Process killed mid-heredoc.
- Symptom: Monitor reads partial JSON, `grep` fails silently, loop shown as status "—" or missing
- Blast radius: Monitor shows wrong info. No downstream corruption.
- Current mitigation: Monitor handles missing/unreadable files gracefully (shows "—"). Non-critical.
- Likelihood: **LOW** — kill mid-write is rare, and impact is cosmetic only

**3.B.4 — Issues JSON from previous iteration not cleared before new verify pass**
- Trigger: Race condition between `rm -f "$ISSUES_DIR"/*.json` (line 243 of run-all.sh) and a late-finishing verify loop writing its file
- Symptom: Old issues carried into new fix cycle, or new issues cleared by the rm
- Blast radius: Wrong fix tasks, wasted iteration
- Current mitigation: Issues are cleared right before launching verify loops (correct sequencing). The rm happens AFTER Phase 1 completes and BEFORE Phase 3 starts. Timing is correct.
- Likelihood: **LOW** — sequential phase transitions prevent this

**3.B.5 — Fix cycle modifies code but manifest still shows task as COMPLETE**
- Trigger: Fix cycle edits code for a task but prompt doesn't re-mark the task status
- Symptom: Manifest history doesn't reflect the fix. Next person looking at manifest thinks original implementation was final.
- Blast radius: Lost institutional knowledge. The fix exists in git but the "why" isn't captured.
- Current mitigation: Template prompt instructs loops to add fix entries to manifest's "Issues & Fixes" section. Depends on Claude compliance.
- Likelihood: **MEDIUM** — Claude may skip this step under pressure

**3.B.6 — run-all.sh clears issues while previous verify loop is still writing**
- Trigger: Would require verify loops to outlive Phase 3's completion signal
- Symptom: See 3.B.4
- Blast radius: Unlikely to occur in practice
- Current mitigation: Phase 3 waits for all verify loops to finish before proceeding to Phase 4
- Likelihood: **LOW**

### Category C: Stuck States & Infinite Loops

**3.C.1 — Fix cycle oscillates between two broken states**
- Trigger: Fix for bug A introduces bug B. Fix for bug B reintroduces bug A.
- Symptom: Pipeline runs 3 fix cycles, each with CRITICAL issues, then exits with "manual review needed"
- Blast radius: 3 wasted iterations (time + tokens), but pipeline does eventually stop
- Current mitigation: `MAX_ITERATIONS=3` hard limit. CRITICAL-STRUCTURAL escape hatch for architectural issues.
- Likelihood: **MEDIUM** — common in CSS/layout fixes where changes cascade

**3.C.2 — Monitor says "all complete" but loop process is still running**
- Trigger: `run-loop.sh` writes status "complete" (line 84) then does a `say` command (line 86). Process is still alive for a moment. Monitor sees "complete" and exits.
- Symptom: No visible symptom — the loop is genuinely done, the process just hasn't exited yet
- Blast radius: None — status file is authoritative, not PID
- Current mitigation: Not needed — this is benign
- Likelihood: HIGH but **impact is NONE**

**3.C.3 — Code loop can't complete its task, run-loop.sh retries same failure**
- Trigger: Task is too large, dependency missing, or Claude consistently fails on a specific task
- Symptom: `run-loop.sh` detects no progress (COMPLETE count unchanged), marks as "stalled", exits with code 1
- Blast radius: That loop stops. Pipeline eventually detects it via monitor ALL_DONE check.
- Current mitigation: **Good.** Stall detection (lines 109-115 of run-loop.sh) catches this after one failed iteration. MAX_ITERATIONS=10 is a backup.
- Likelihood: **MEDIUM** — well handled

**3.C.4 — Phase 2 deploy fails, code is committed but not deployed**
- Trigger: Build error, SCP failure, server unreachable
- Symptom: Pipeline exits with "Deploy failed. Pipeline stopped." Code is committed and pushed but not deployed.
- Blast radius: Inconsistent state — code in git but not live. Next run starts Phase 1, finds tasks COMPLETE, skips to Phase 2 deploy.
- Current mitigation: **Partial.** Pipeline stops cleanly. But re-running `run-all.sh` re-launches Phase 1 code loops unnecessarily when only deploy is needed.
- Likelihood: **MEDIUM** — deploy failures are common (network issues, server state)

**3.C.5 — Verify loop's issues JSON is missing (not empty [], just absent)**
- Trigger: Verify loop crashes before writing its issues file
- Symptom: `has_critical_issues` iterates over `"$ISSUES_DIR"/*.json`. If no files match the glob, the loop body runs once with `f` set to the literal string `"$ISSUES_DIR"/*.json`. The `[ -f "$f" ] || continue` guard (line 125) correctly skips it.
- Blast radius: **None** — missing file is treated as "no issues." This is the correct behavior.
- Current mitigation: The `[ -f "$f" ] || continue` guard handles this correctly.
- Likelihood: LOW, and **correctly handled**

### Category D: Orchestration Logic

**3.D.1 — `launch_parallel_loops` returns but loops are still running**
- Trigger: Monitor is killed (Ctrl+C) while loops still in "running" state
- Symptom: `launch_parallel_loops` checks status JSON via grep. If any loop is "running" or "waiting", sets ALL_DONE=false, prompts user to kill.
- Blast radius: Clean. User gets choice.
- Current mitigation: **Good.** The grep-on-status-JSON approach works because `run-loop.sh` reliably writes terminal status ("complete", "stalled", "failed") before exiting. The only gap is if `run-loop.sh` itself is killed (SIGKILL) — status stays "running" forever.
- Likelihood: LOW for the SIGKILL case

**3.D.2 — monitor.sh killed (Ctrl+C) — do loops keep running?**
- Trigger: User presses Ctrl+C while watching monitor
- Symptom: Monitor exits (trap on INT, line 36). Loops are background processes started by `run-all.sh`, NOT children of monitor.sh. They continue running.
- Blast radius: User loses visibility but loops finish. This IS the right behavior — losing your terminal shouldn't kill work in progress.
- Current mitigation: Correct by design. `run-all.sh` then prompts "Kill all running loops?" with the saved PIDs.
- Likelihood: MEDIUM (users often Ctrl+C), and **correctly handled**

**3.D.3 — Claude makes a mistake during deploy**
- Trigger: Deploy phase uses `claude -p` to run MCP tools. Claude could upload wrong file, extract to wrong path, skip a step.
- Symptom: Site is broken or partially deployed
- Blast radius: Production down or partially broken. Verify loops may catch it but can't fix deploy issues.
- Current mitigation: Deploy prompt is detailed (follows CLAUDE.md). Verify loops test the deployed site. But there's no programmatic validation between deploy and verify (e.g., checking HTTP 200, comparing file hashes).
- Likelihood: **MEDIUM** — Claude deploy is generally reliable but has no automated validation

**3.D.4 — `has_critical_issues` regex doesn't match actual JSON format**
- Trigger: The regex `'"severity":\s*"CRITICAL"'` uses `\s*` for optional whitespace. But `grep` (not `grep -P` or `grep -E`) interprets `\s` literally in basic regex mode.
- Symptom: `has_critical_issues` **never matches CRITICAL issues.** Pipeline always reports "no critical issues" even when they exist. Fix cycles never trigger.
- Blast radius: **SEVERE** — the entire fix cycle mechanism is silently broken
- Current mitigation: **None.** This is a bug.
- Likelihood: **HIGH** — this regex is wrong on macOS `grep` (which uses BSD grep, where `\s` is not supported in basic mode). Would need `grep -E` or `grep -P`, or use `[ ]*` instead of `\s*`.
- **Fix:** Change line 126 of `run-all.sh` from:
  ```bash
  if grep -q '"severity":\s*"CRITICAL"' "$f" 2>/dev/null; then
  ```
  to:
  ```bash
  if grep -q '"severity": *"CRITICAL"' "$f" 2>/dev/null; then
  ```
  And line 252:
  ```bash
  CRITICAL_COUNT=$(grep -rl '"severity":\s*"CRITICAL"' "$ISSUES_DIR"/*.json 2>/dev/null | wc -l | tr -d ' ')
  ```
  to:
  ```bash
  CRITICAL_COUNT=$(grep -rl '"severity": *"CRITICAL"' "$ISSUES_DIR"/*.json 2>/dev/null | wc -l | tr -d ' ')
  ```

**3.D.5 — MONITOR_LOOPS with spaces or empty**
- Trigger: Loop name contains spaces, or MONITOR_LOOPS env var is empty
- Symptom: If empty, `IFS=' ' read -r -a LOOPS <<< "$MONITOR_LOOPS"` produces an empty array; monitor falls back to DEFAULT_LOOPS. If name has spaces, it's split into multiple entries.
- Blast radius: Wrong loops monitored, or monitoring falls back to defaults
- Current mitigation: **Partial.** Empty case falls through to DEFAULT_LOOPS (correct). Space-in-name case is broken but loop names are always simple identifiers in practice.
- Likelihood: **LOW** — loop names are always single words

**3.D.6 — run-loop.sh termination condition**
- Trigger: Claude exits with code 0 but didn't complete a task
- Symptom: `run-loop.sh` checks `COMPLETE` count after each Claude invocation (line 107-109). If count didn't increase, marks as "stalled" and exits.
- Blast radius: Loop stops correctly. No infinite loop.
- Current mitigation: **Good.** The stall detection is the real termination condition, not Claude's exit code. `ALL done` check (lines 83-88) handles the happy path.
- Likelihood: MEDIUM, and **correctly handled**

### Category E: File Ownership & Parallel Safety

**3.E.1 — File ownership violation (no enforcement)**
- Trigger: Claude edits a file owned by another loop (e.g., modifying `index.html` from a section loop)
- Symptom: If the other loop also edits that file, git commit conflict. If not, silent inconsistency.
- Blast radius: Depends on file. Could range from cosmetic to broken functionality.
- Current mitigation: Prompt instruction only. No pre-commit hook, no file-level ACL.
- Likelihood: **MEDIUM** — real-world instances avoided this by having well-separated HTML fragments

**3.E.2 — Manifest concurrent edits**
- Trigger: Two loops append to different sections of `manifest.md`, both push
- Symptom: Second push gets merge conflict. `git push` fails silently (exit code not checked in prompts).
- Blast radius: Lost work — second loop's manifest update is lost
- Current mitigation: Real-world instances used per-loop `plan.md` files, avoiding this entirely. The template's manifest approach has this vulnerability.
- Likelihood: **HIGH if using manifest**, **NONE with per-loop plans**

**3.E.3 — Shared node_modules**
- Trigger: One loop runs `npm install` while another is building
- Symptom: Corrupted `node_modules`, failed builds
- Blast radius: Build breaks for both loops
- Current mitigation: Phase 1 prompts say "no deploy, no build." `npm install` shouldn't happen. Phase 2 build is single-threaded.
- Likelihood: **LOW** — well-guarded by prompt rules

**3.E.4 — Shared working directory**
- Trigger: Loop A does `cd show-controller`, Loop B expects to be in project root
- Symptom: Each `claude -p` invocation runs in its own subprocess. Working directory is set by `run-loop.sh` line 39: `cd "$PROJECT_ROOT"`. Each invocation starts fresh.
- Blast radius: **None** — each Claude process has its own working directory
- Current mitigation: Correct by design — each `claude -p` is an independent process
- Likelihood: NOT APPLICABLE

**3.E.5 — Shared external resources (Firebase, production server, OBS)**
- Trigger: Two loops write to the same Firebase path, or both try to restart PM2
- Symptom: Data corruption in Firebase. PM2 restart conflicts.
- Blast radius: Production data corruption
- Current mitigation: Phase 1 prompts say "no deploy" — loops shouldn't touch external resources. Phase 2 is serial.
- Likelihood: **LOW** for code loops, but important to maintain this rule

### Category F: Recovery & Resumability

**3.F.1 — Pipeline crashes at Phase 2, user restarts run-all.sh**
- Trigger: Deploy fails, user re-runs `./run-all.sh`
- Symptom: Phase 1 re-launches all code loops. Each loop reads its plan, finds all tasks COMPLETE, outputs `ALL_COMPLETE`, exits immediately. Then Phase 2 runs again.
- Blast radius: Wasted Claude invocations (5 loops x 1 iteration each), but functionally correct
- Current mitigation: **Partial.** Works but wasteful. No "skip to Phase 2" option.
- Likelihood: **MEDIUM** — deploy failures happen

**3.F.2 — User manually fixes code between iterations**
- Trigger: User edits a file that a code loop also owns
- Symptom: Next Claude invocation overwrites the manual fix (Claude reads the plan, implements the next task, may re-read the file and overwrite changes)
- Blast radius: Lost manual work
- Current mitigation: **None.** No mechanism to detect or preserve manual changes.
- Likelihood: **LOW** — user would need to edit during an active loop run

**3.F.3 — False positive CRITICAL from verify loop**
- Trigger: Playwright screenshot looks wrong to Claude but is actually fine (e.g., font rendering difference, animation mid-frame)
- Symptom: Fix cycle triggered for a non-issue. Fix loop may introduce actual bugs trying to fix a non-problem.
- Blast radius: Wasted iteration + risk of new bugs
- Current mitigation: **None.** No way to whitelist/skip specific issues. User must wait for max iterations or kill the pipeline.
- Likelihood: **MEDIUM** — screenshot-based verification has inherent subjectivity

**3.F.4 — Adding a new loop mid-pipeline**
- Trigger: User realizes a 4th section is needed after Phase 1 starts
- Symptom: Cannot add loop without restarting pipeline. New loop's tasks aren't in any plan file.
- Blast radius: Must restart from scratch or manually add and run the new loop
- Current mitigation: **None.** Pipeline doesn't support hot-adding loops.
- Likelihood: **LOW** — planning usually happens before execution

**3.F.5 — Power failure / SSH disconnect during run-all.sh**
- Trigger: Terminal dies while pipeline is running
- Symptom: `run-all.sh` dies. Background loop processes continue (they're backgrounded with `&`). Status JSON files are the only record of state. PIDs in `.pids` file may be stale.
- Blast radius: Orphaned loop processes may continue and commit code. Monitor is gone. No way to resume `run-all.sh` from where it stopped.
- Current mitigation: **Partial.** Loops have their own safety limits (MAX_ITERATIONS, stall detection). They'll eventually stop. But there's no clean resume path — user must manually check status and either let loops finish or kill them.
- Likelihood: **MEDIUM** — SSH disconnects are common for long-running pipelines

---

## Cross-Cutting Concerns

### 4.1 State Consistency Model

| Source of Truth | Authoritative For | Can Contradict |
|----------------|-------------------|----------------|
| `plan.md` (per-loop) | Task completion status | Manifest (if both track same tasks) |
| `manifest.md` | Files, architecture decisions, history | Plan files (parallel tracking) |
| `status/*.json` | Loop runtime state (running/complete/stalled) | Plan file (status says complete, plan says IN PROGRESS — timing gap) |
| `issues/*.json` | What needs fixing | Verification log HTML (different severity thresholds) |
| `verification-log.html` | Visual proof of testing | Issues JSON (entries may not be 1:1) |
| Git history | What code was actually changed | Manifest (manifest may not reflect all changes) |

**Key contradiction risk:** The template introduces `manifest.md` as "single source of truth" but real-world instances use `plan.md` per loop. If someone follows the template literally, they have a shared manifest AND per-loop plan files, creating two sources of truth for task status. The template should clarify: manifest replaces per-loop plans, or per-loop plans feed into the manifest.

### 4.2 Observability

If `run-all.sh` fails at 3 AM, the user has:
- `logs/*.log` — full Claude output per loop (verbose, useful but large)
- `status/*.json` — last known state per loop (compact, useful for quick triage)
- `verification-report.md` — if verify phase completed
- `issues/*.json` — if verify phase completed
- Git log — what was actually committed

**Gaps:**
- No aggregated error log (must check each loop's log individually)
- No timing information (when did each phase start/end, how long did each loop take?)
- No notification on failure — `say` command is macOS-only and doesn't work over SSH
- If pipeline dies between phases, there's no record of which phase it was in
- Deploy log is mixed into `logs/deploy.log` but only captures stdout, not MCP tool responses

### 4.3 Idempotency

| Phase | Idempotent? | Notes |
|-------|-------------|-------|
| Phase 0 | Yes | Re-running creates same artifact (or skips if exists) |
| Phase 1 | **Mostly** | Loops skip COMPLETE tasks, redo IN PROGRESS tasks. But already-committed code is committed again (duplicate commits if plan was marked COMPLETE but code was already pushed) |
| Phase 2 | Yes | Build + deploy is idempotent |
| Phase 3 | Yes | Verify loops re-test from scratch |
| Phase 4 | Yes | Merge is repeatable |

**Key risk:** Phase 1 re-run after crash wastes Claude invocations but is functionally correct.

### 4.4 Cost Model

Minimum invocations per pipeline run (3 code loops):
- Phase 0: 1-3 invocations (1 per task)
- Phase 1: 3-15 invocations (1 per task per loop, ~1-5 tasks each)
- Phase 2: 1 invocation (deploy)
- Phase 3: 3-9 invocations (1 per task per verify loop)
- Phase 4: 1 invocation (merge)

**Total: 9-29+ invocations minimum.** With 3 fix cycles: 27-87+ invocations.

**Where tokens are wasted:**
1. Each `claude -p` invocation re-reads CLAUDE.md, PRD, style guide, etc. No context caching between iterations.
2. Re-running after deploy failure re-launches ALL Phase 1 loops even when tasks are done (each does one invocation to discover ALL_COMPLETE).
3. Verify loops each independently `browser_install` — could be shared.
4. The merge step uses a full Claude invocation for what could be a simple bash script (concatenate JSON arrays).

### 4.5 File Ownership Limitations

**What percentage of features can be cleanly split?**
Based on the real-world prototype: 100% — the HTML fragment architecture (each loop produces its own `.html` file, shell produces `index.html` that loads them) is perfectly suited for parallel loops.

**Where it breaks down:**
- React JSX components that import shared modules
- CSS files that affect multiple views
- Server-side changes (single `index.js`, single `output.html`)
- Firebase schema changes that affect multiple readers
- Configuration files (package.json, .mcp.json)

**Is Phase 0 sufficient for shared dependencies?**
For the prototype use case (HTML fragments + style guide), yes. For React SPA features or server changes, Phase 0 would need to handle more — shared component stubs, API contracts, database schema setup.

---

## Real-World Observations

### 5.1 Template Deviations

| Deviation | Why |
|-----------|-----|
| Used per-loop `plan.md` instead of shared `manifest.md` | Avoids merge conflicts entirely — each loop writes only to its own plan file |
| No `issues/` directory or fix cycle | Prototype was local-only HTML; fix cycles overkill for static prototypes |
| Verify loop is a single loop (not parallel verify-per-code-loop) | Prototype build checked integration, not per-section correctness |
| No `git push` in code loop prompts | Prototype was local-only; pushes happened manually or by run-loop.sh? Actually — no push at all in local mode |
| Real `run-all.sh` has 3-phase structure (not 4-phase) | Simpler — no fix cycles, no issues JSON, no merge step |
| `run-all.sh` monitors ONLY code loops (correct) | Template warning about verify-in-monitor was followed |

**The template has evolved past what was actually tested.** The 4-phase pipeline with manifests, fix cycles, parallel verify loops, and issues JSON is purely theoretical — it has never run end-to-end.

### 5.2 File Ownership Violations

**Zero violations observed.** The HTML fragment architecture (each loop owns one `.html` file) made ownership crystal clear. No ambiguity about file boundaries.

### 5.3 Fix Cycle Effectiveness

**Not tested.** Neither real-world instance used fix cycles. The prototype verify loop found zero CRITICAL issues, so no fix cycle was triggered.

The verify loop itself stalled (status JSON shows `stalled` with 1 error), suggesting it ran once, made no progress on the plan file's first task, and exited. Yet `verification-report.md` exists with a full PASS report — indicating the verify loop was likely run a second time (or manually), successfully produced the report, but `run-loop.sh` couldn't detect progress because the plan file task format didn't match `count_tasks` expectations (the verify plan used `- [ ]` checkboxes, not `— NOT STARTED` markers).

### 5.4 Undocumented Failure Modes

1. **Verify loop plan format mismatch:** `run-loop.sh` counts tasks by grepping for `— NOT STARTED`. If the verify loop's plan uses `- [ ]` checkboxes (common markdown convention), `count_tasks` finds 0 tasks, calculates TOTAL=0, and the "all done" check succeeds immediately before Claude even runs. Or it finds tasks but can't detect completion, stalls after one iteration.
2. **macOS `say` command over SSH:** `say` is used for audio notifications but doesn't work over SSH sessions (no audio device). Silently fails (redirected to /dev/null), which is fine.
3. **`tee` and exit code:** `"$SCRIPT_DIR/run-loop.sh" "$PHASE_0_LOOP" 2>&1 | tee "$LOG_DIR/$PHASE_0_LOOP.log"` — the `$?` on line 48 captures `tee`'s exit code, not `run-loop.sh`'s. Phase 0 failure may not be detected. Fix: `set -o pipefail` at top of script, or use `PIPESTATUS[0]`.

### 5.5 Ceremony Compliance

**MEDIUM.** The real-world instances used the core mechanics (Phase 0 → parallel Phase 1 → Phase 2 verify) but skipped:
- Manifest (used per-loop plans instead)
- Fix cycles (not needed)
- Issues JSON (not needed)
- Parallel verify loops (single verify loop instead)
- Phase 4 merge (no per-verify logs to merge)

The template's ceremony has grown beyond what the two real-world instances needed. This isn't necessarily wrong — the template may be designed for production features (not prototypes) — but it means the advanced features are untested.

---

## Suggestions

### Tier 1: Fix Now

| # | Solves | Change | File | Effort |
|---|--------|--------|------|--------|
| 1 | 3.D.4 | Fix `\s*` regex to `[ ]*` in `has_critical_issues` and `CRITICAL_COUNT`. BSD grep doesn't support `\s`. | `run-all.sh` lines 126, 252 | Trivial |
| 2 | 3.A.2, R2 | Add `git pull --rebase` before `git push` in code loop prompts, and check push exit code. Add retry (1 attempt) on push failure. | `prompt-TEMPLATE.md` Phase 5 | Small |
| 3 | 5.4.3 | Add `set -o pipefail` at top of `run-all.sh` so Phase 0 failure is correctly detected through `tee` pipe. | `run-all.sh` line 1 | Trivial |
| 4 | 3.B.2, 5.1 | Add per-loop `plan.md` as the RECOMMENDED approach in LOOP-SYSTEM.md (matching real-world usage). Manifest is optional for history/architecture, not required for task tracking during parallel execution. | `LOOP-SYSTEM.md` | Small |

### Tier 2: Fix Soon

| # | Solves | Change | File | Effort |
|---|--------|--------|------|--------|
| 5 | 3.A.3 | Add a simple deploy validation step: `curl -s -o /dev/null -w "%{http_code}" https://commentarygraphic.com/` check for 200 after deploy, before launching verify loops. | `run-all.sh` after `run_deploy()` | Small |
| 6 | 3.C.4, 3.F.1 | Add `--skip-to-phase N` flag to `run-all.sh` so user can restart from Phase 2 after a deploy failure without re-running code loops. | `run-all.sh` | Medium |
| 7 | 3.A.6, 4.4 | Replace Claude-based merge with a bash script: extract JSON between markers, concatenate arrays, write combined HTML. Saves 1 Claude invocation per pipeline run and eliminates silent entry dropping. | `run-all.sh` `merge_verification_logs()` | Medium |
| 8 | 4.2 | Add timing: log `date` at start/end of each phase in `run-all.sh`. Write a `pipeline-summary.json` at the end with phase durations, loop counts, and outcome. | `run-all.sh` | Small |
| 9 | 5.4.1 | Standardize plan file task format: document that ALL plan files (including verify) MUST use `— NOT STARTED` / `— COMPLETE` markers. Add a validation check in `run-loop.sh` that exits early if no tasks with recognized markers are found. | `run-loop.sh`, `LOOP-SYSTEM.md` | Small |

### Tier 3: Nice to Have

| # | Solves | Change | File | Effort |
|---|--------|--------|------|--------|
| 10 | 3.B.3 | Atomic status writes: write to `$STATUS_FILE.tmp`, then `mv` to `$STATUS_FILE`. `mv` is atomic on POSIX. | `run-loop.sh` `write_status()` | Trivial |
| 11 | 3.F.3 | Add `SKIP_ISSUES` env var or file: if `issues/{name}.skip` exists, `has_critical_issues` ignores that file. Allows whitelisting false positives. | `run-all.sh` | Small |
| 12 | 3.F.5 | Add `tmux` or `screen` recommendation to LOOP-SYSTEM.md setup checklist for long-running pipelines over SSH. | `LOOP-SYSTEM.md` | Trivial |
| 13 | 4.4 | Cache context: the merge step and deploy step don't need full CLAUDE.md context. Consider using `--no-user-config` or minimal prompts to reduce token usage. | `run-all.sh` | Small |
| 14 | 3.E.1 | Add optional pre-commit hook that checks if modified files are in the loop's declared file list. Won't work with `--dangerously-skip-permissions` but could catch violations in manual runs. | New file: `.githooks/check-ownership.sh` | Medium |

### Anti-Suggestions: Things That Look Broken But Aren't

1. **"Loops share a working directory"** — Looks dangerous, but each `claude -p` invocation is an independent process. `cd` in one process doesn't affect others. Git's internal lock file handles concurrent commits safely. Local operations are fine; only `push` is risky.

2. **"Status JSON parsing with grep instead of jq"** — Looks fragile, but the JSON is machine-written by `write_status()` in a predictable single-line format. `grep -o` with fixed patterns is reliable here. Adding a `jq` dependency would be heavier than the problem warrants.

3. **"Monitor stall detection shows 'stalled' but doesn't take action"** — The monitor is a passive dashboard, not an orchestrator. `run-loop.sh` handles stall detection independently and exits. The monitor just reflects the status. Giving the monitor kill authority would add complexity without benefit.

4. **"`say` command for notifications"** — It's wrapped in `2>/dev/null &` so it silently no-ops on Linux/SSH. Harmless, and useful on local macOS. No need to replace with a cross-platform solution.

5. **"No jq dependency, parsing JSON with grep"** — The status JSON is generated by a known heredoc template with a fixed structure. The grep patterns match this exact structure reliably. Adding jq would introduce a dependency that may not be installed on all systems, for minimal gain.

---

## Summary

```
===================================================
  PARALLEL LOOP SYSTEM REVIEW COMPLETE
===================================================
Documents analyzed: 8 templates + 2 real-world instances
Real-world instances: 2 (Clip UI prototype, PRD Visualizer)

Failure scenarios identified:
  - Silent failures: 6
  - State corruption: 6
  - Stuck states: 5
  - Orchestration logic: 6
  - File ownership: 5
  - Recovery gaps: 5

Cross-cutting concerns: 5

Suggestions:
  - Tier 1 (fix now): 4
  - Tier 2 (fix soon): 5
  - Tier 3 (nice to have): 5
  - Anti-suggestions: 5

Report: docs/_template/parallel-loop/review-report.md
===================================================
```
