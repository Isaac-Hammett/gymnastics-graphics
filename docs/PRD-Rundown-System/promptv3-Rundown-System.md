# PRD-Rundown-System Implementation Workflow (v3 - Optimized)

## RULES

**MOST IMPORTANT RULE: Implement EXACTLY ONE TASK per iteration.**

- ONE task = one iteration. After completing ONE task, commit, deploy, verify, then STOP.
- Do NOT read full documentation files - use Quick Task Index only.
- If verification fails, record bug and STOP (handle in next context window)

---

## Phase 1: Load Context (MINIMAL)

**Read ONLY the Quick Task Index** - it has everything needed for bug fixes.

- [ ] **1.1** Read Quick Task Index ONLY (lines 25-43):
  ```
  Read: docs/PRD-Rundown-System/PLAN-Rundown-System-Implementation.md
  Lines: 25-105 (Quick Task Index + Phase X status)
  ```

  **Output:**
  ```
  1.1 Quick Task Index Read
  - Next NOT STARTED task: Task [XX]
  - Bug: BUG-[XXX]
  - File: [filename]
  - Lines: [line numbers]
  - Fix: [one-line summary from index]
  ```

**DO NOT READ:**
- PRD (not needed for bug fixes)
- BUGS.md (redundant - info is in index)
- Detailed Plan (not needed)
- INFRASTRUCTURE.md (only if deploying backend)

---

## Phase 2: Read Target Code

- [ ] **2.1** Read ONLY the target lines specified in Quick Task Index:
  ```
  Read: [file from index]
  Lines: [lines from index] ± 10 lines for context
  ```

- [ ] **2.2** Confirm understanding:
  ```
  2.2 Target Code Read
  - Current code does: [what it does now]
  - Bug cause: [why it's broken]
  - Fix needed: [what to change]
  ```

---

## Phase 3: Implement ONE Fix

- [ ] **3.1** Make the fix (single Edit)
- [ ] **3.2** Update PLAN status:
  - Quick Task Index: Add `✅ COMPLETE —` prefix
  - Phase X table: Change `NOT STARTED` → `COMPLETE`
  - Phase X counter: Increment (e.g., `2/10` → `3/10`)

  **Output:**
  ```
  3.2 Fix Complete
  - Task: [Task XX]
  - Change: [one-line summary]
  ```

---

## Phase 4: Commit & Push

```bash
git add -A && git commit -m "Fix BUG-XXX: [brief]

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>" && git push origin main
```

---

## Phase 5: Deploy

| Change Type | Action |
|-------------|--------|
| `show-controller/*` | `npm run build` → tarball → upload → extract |
| `server/*` | `ssh_exec` coordinator: `cd /opt/gymnastics-graphics && git pull && pm2 restart all` |
| Docs only | Skip |
| Firebase | Use MCP `firebase_set` |

**Frontend Deploy (copy-paste ready):**
```bash
cd show-controller && npm run build
mkdir -p /tmp/claude && tar -czf /tmp/claude/dist.tar.gz -C dist .
# Then: ssh_upload_file + ssh_exec to extract
```

---

## Phase 6: Verify

- [ ] **6.1** `browser_navigate` to https://commentarygraphic.com
- [ ] **6.2** `browser_take_screenshot`
- [ ] **6.3** `browser_console_messages` (check for new errors)

  **Output:**
  ```
  6.3 Verified
  - New errors: [none / list]
  - Status: [success / failed]
  ```

---

## Phase 7: Update Bug Status (if bug fully fixed)

Only update BUGS.md if ALL sub-tasks for a bug are complete:
- BUG-013 needs Tasks 91+92+93 all complete
- BUG-015 needs Tasks 94+95+96 all complete

Otherwise, just update the partial status in BUGS.md summary table.

---

## Quick Task Index Reference

| Task | Bug | File | Lines | Fix |
|------|-----|------|-------|-----|
| 90 | BUG-012 | TalentView.jsx | 91 | ✅ DONE |
| 91 | BUG-013a | RundownEditorPage.jsx | 2057-2079 | ✅ DONE |
| 92 | BUG-013b | RundownEditorPage.jsx | 2067 | Change filter to `run.segmentTimings \|\| run.segments` |
| 93 | BUG-013c | server/index.js | ~558 | Add `status: 'completed'` in showStopped |
| 94 | BUG-015a | Firebase | — | Create schema |
| 95 | BUG-015b | RundownEditorPage.jsx | 83 | Replace DUMMY_TALENT |
| 96 | BUG-015c | TalentView.jsx | 15 | Replace TALENT_ROSTER + localStorage |
| 97 | BUG-014 | RundownEditorPage.jsx | ~6500 | Add sponsor UI |
| 98 | BUG-017 | RundownEditorPage.jsx | 91 | Replace DUMMY_EQUIPMENT |
| 99 | BUG-016 | RundownEditorPage.jsx | ~6200 | Remove in/out points |

---

## Context Budget

**Target: <500 lines read per iteration**

| Phase | Lines |
|-------|-------|
| 1. Quick Index | ~80 |
| 2. Target code | ~50 |
| 3-7. Actions | ~0 (tool calls only) |
| **Total** | **~130 lines** |

vs. Old prompt: ~3,700 lines (96% reduction)
