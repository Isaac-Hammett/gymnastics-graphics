# PRD-Sponsor-System Implementation Workflow (v3)

## RULES

**MOST IMPORTANT RULE: Implement EXACTLY ONE TASK per iteration.**

- ONE task = one iteration. After completing ONE task, commit, deploy (if applicable), verify, then STOP.
- Read ONLY the Quick Task Index + the relevant task detail section — not the full plan.
- If verification fails, record bug in BUGS.md and STOP (handle in next context window).
- Respect task dependencies — do NOT start a task if its dependencies are NOT STARTED.

---

## Phase 1: Load Context (MINIMAL)

**Read ONLY the Quick Task Index** — it has everything needed to pick the next task.

- [ ] **1.1** Read Quick Task Index ONLY:
  ```
  Read: docs/PRD-Sponsors/PLAN-Sponsor-System-Implementation.md
  Lines: 1-50 (Quick Task Index + Phase Summary)
  ```

  **Output:**
  ```
  1.1 Quick Task Index Read
  - Next NOT STARTED task: T[X]
  - Phase: [X]
  - File: [filename]
  - Change: [one-line summary from index]
  - Dependencies: [list or "None"]
  - Dependencies met: [yes/no]
  ```

**DO NOT READ:**
- PRD (not needed for implementation)
- Full technical plan (redundant — task details have everything)
- BUGS.md (only read if resuming a failed task)

---

## Phase 2: Read Task Details + Target Code

- [ ] **2.1** Read the specific task detail section from the Implementation Plan:
  ```
  Read: docs/PRD-Sponsors/PLAN-Sponsor-System-Implementation.md
  Section: "### T[X]: ..."
  ```

- [ ] **2.2** Read the detailed spec from the technical plan:
  ```
  Read: docs/PRD-Sponsors/PLAN-Sponsor-System-2026-02-13.md
  Section: Referenced section (e.g., "## 2. Hook Changes")
  ```

- [ ] **2.3** Read the target file (if modifying an existing file):
  ```
  Read: [file from task]
  Lines: [relevant lines ± 20 for context]
  ```

- [ ] **2.4** Confirm understanding:
  ```
  2.4 Target Code Read
  - Current code does: [what it does now]
  - Change needed: [what to add/modify]
  - Lines affected: [line numbers]
  ```

---

## Phase 3: Implement ONE Task

- [ ] **3.1** Make the changes (Edit existing files or Write new files)
- [ ] **3.2** Update Implementation Plan status:
  - Quick Task Index: Change `NOT STARTED` → `COMPLETE`
  - Phase Summary: Update phase status (if all tasks in phase are done)
  - Header counter: Increment (e.g., `1/12 tasks complete`)

  **Output:**
  ```
  3.2 Task Complete
  - Task: T[X]
  - Change: [one-line summary]
  - Files modified: [list]
  ```

---

## Phase 4: Commit & Push

```bash
git add [specific files] && git commit -m "Sponsor System T[X]: [brief description]

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>" && git push origin main
```

---

## Phase 5: Deploy (if applicable)

| Change Type | Action |
|-------------|--------|
| `show-controller/*` (React) | Build + deploy SPA (skip until T11) |
| `overlays/*` (HTML) | Deploy overlay files separately (skip until T12) |
| Hook/lib only (T1-T6) | Skip deploy — build will happen at T11 |
| Docs only | Skip |

**T11 Deploy (React SPA):**
```bash
cd show-controller && npm run build
mkdir -p /tmp/claude && tar -czf /tmp/claude/dist.tar.gz -C dist .
# ssh_upload_file + ssh_exec to extract
```

**T12 Deploy (Overlays — MUST do separately):**
```bash
tar -czf /tmp/claude/overlays.tar.gz overlays/
# ssh_upload_file + ssh_exec to extract
# Verify: browser_navigate to each overlay URL
```

---

## Phase 6: Verify

### For code tasks (T1-T10):
- [ ] **6.1** Verify the change compiles: no import errors, no TypeScript errors
- [ ] **6.2** Quick smoke check: does the change make sense in context?

### For build task (T11):
- [ ] **6.1** `npm run build` succeeds with no errors
- [ ] **6.2** Check `dist/` output exists

### For deploy task (T12):
- [ ] **6.1** `browser_navigate` to `https://commentarygraphic.com`
- [ ] **6.2** `browser_take_screenshot`
- [ ] **6.3** `browser_console_messages` (check for new errors)
- [ ] **6.4** `browser_navigate` to each overlay URL — verify overlay content (not React SPA)

  **Output:**
  ```
  6.X Verified
  - Errors: [none / list]
  - Status: [success / failed]
  ```

---

## Phase 7: Update Status

- [ ] **7.1** Update PLAN-Sponsor-System-Implementation.md:
  - Quick Task Index: task status → `COMPLETE`
  - Phase Summary: phase status (if all tasks done)
  - Header: increment counter

- [ ] **7.2** If a bug was found during verification:
  - Add entry to BUGS.md
  - Do NOT attempt to fix in this iteration
  - STOP — fix will happen in next iteration

---

## Quick Task Index Reference

**Note:** This is a snapshot. Check `PLAN-Sponsor-System-Implementation.md` for current status.

| Task | Phase | File | Change | Deps | Status |
|------|-------|------|--------|------|--------|
| T1 | A | useTeamsDatabase.js | Per-team sponsor CRUD + helpers | — | NOT STARTED |
| T2 | B | graphicsRegistry.js | 3 sponsor entries in `sponsors` category | — | NOT STARTED |
| T3 | B | GraphicsManagerPage.jsx | CATEGORY_LABELS + preview data | T2 | NOT STARTED |
| T4 | B | graphicButtons.js | `sponsors` button section (30+) | T2 | NOT STARTED |
| T5 | B | urlBuilder.js | 3 builder functions + switch cases | T2 | NOT STARTED |
| T6 | C | UrlGeneratorPage.jsx | Sidebar + sponsor JSON plumbing | T1,T4,T5 | NOT STARTED |
| T7 | D | MediaManagerPage.jsx | SponsorsView + badge | T1 | NOT STARTED |
| T8 | E | sponsors-thanks.html | Full-screen grid overlay | — | NOT STARTED |
| T9 | F | sponsors-cycle.html | Full-screen cycling overlay | — | NOT STARTED |
| T10 | G | sponsors-bug.html | Transparent corner bug overlay | — | NOT STARTED |
| T11 | H | — | npm run build | T1-T10 | NOT STARTED |
| T12 | H | — | Deploy SPA + overlays | T11 | NOT STARTED |

---

## Context Budget

**Target: <500 lines read per iteration**

| Phase | Lines |
|-------|-------|
| 1. Quick Index | ~50 |
| 2. Task detail + target code | ~150 |
| 3-7. Actions | ~0 (tool calls only) |
| **Total** | **~200 lines** |
