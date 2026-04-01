# Renderer System Phase 3: Scoring Ingestion — Verify

You verify ALL completed tasks on production. Take screenshots, compare against expected, report PASS/FAIL. **You do NOT fix anything.** Failures go to `fixes.md` for the code loop to handle.

> Reference: `docs/_template/standard-loop-v2/LOOP-SYSTEM.md`

## Context
- Tasks: `docs/PRD-Renderer-System/phase-3/plan.md`
- Fixes: `docs/PRD-Renderer-System/phase-3/fixes.md`

## Rules
- Screenshot every task. No screenshot = FAIL.
- **Describe before you judge.** Write what you see BEFORE marking PASS/FAIL.
- **Do NOT edit code or redeploy.** This phase is read-only verification.
- Failures are written to `fixes.md` — the code loop (Phase 1) will fix them on the next round.
- No code review fallback. If the page won't load, that's a FAIL.

## URLs
- Home page (competition cards): `https://commentarygraphic.com/`
- Producer view: `https://commentarygraphic.com/producer/{compId}`
- Auth: `test@test.com` / `ClaudeTest`

---

## Execute

### 1. Setup

- [ ] `browser_install`
- [ ] `browser_resize` to 1920x1080
- [ ] Navigate to `https://commentarygraphic.com/`
- [ ] Authenticate with `test@test.com` / `ClaudeTest`
- [ ] Read `plan.md` — collect every `— COMPLETE` task
- [ ] Clear `fixes.md` (remove old entries — this is a fresh verification pass)

### 2. Verify Each Task

For EACH completed task:

- [ ] Navigate to relevant URL
- [ ] Screenshot → `docs/PRD-Renderer-System/phase-3/screenshots/verify-task-{id}.png`
- [ ] `browser_console_messages`
- [ ] **Read screenshot back. Describe what you see.**
- [ ] Check task's **Verify** checklist from plan.md: `YES` or `NO` for each item

**If ALL confirmed → PASS.** Log it, next task.

**If ANY item is NO → FAIL.** Write to `fixes.md`:
```
- task:{id} | {what's wrong} | {what correct looks like}
```

### Special Verification Checks

**Competition Card Badge (Home Page):**
- [ ] Navigate to home page
- [ ] Find a competition card that has `virtiusSessionId` configured
- [ ] Verify scoring feed badge is visible (LIVE with green dot, FEED OFF gray, or FEED ERROR red)
- [ ] Click the badge — verify it toggles the feed on/off
- [ ] Screenshot badge in both states

**Producer View — Scoring Feed Panel:**
- [ ] Navigate to producer view for a competition with scoring configured
- [ ] Scroll to find the "Scoring Feed" panel in the sidebar
- [ ] Verify panel contains: enable/disable toggle, poll interval dropdown, last updated timestamp, status badge, manual refresh button
- [ ] Toggle the enable switch — verify it changes state
- [ ] Change poll interval — verify dropdown updates
- [ ] Click manual refresh — verify "Last Updated" timestamp changes
- [ ] Screenshot the panel in enabled and disabled states

**Badge States:**
- [ ] LIVE state: green pulsing dot, shows interval (e.g., "LIVE · 15s")
- [ ] OFF state: gray "FEED OFF" text
- [ ] ERROR state: red "FEED ERROR" text (may need to trigger by setting invalid session ID)

### 3. Verify PRD Is Up-to-Date

- [ ] Read the PRD file (`docs/PRD-Renderer-System/PRD-Renderer-System-2026-03-28.md`)
- [ ] For each COMPLETE task in plan.md, check that the corresponding PRD issue is marked FIXED (strikethrough pattern)
- [ ] If any completed issues are NOT marked FIXED in the PRD, add to `fixes.md`:
  ```
  - docs:prd | Issue #{N} is implemented but not marked FIXED in PRD | Mark as ~~strikethrough~~ FIXED with commit hash
  ```

### 4. Generate verification-log.html

Write `docs/PRD-Renderer-System/phase-3/verification-log.html` — static screenshot gallery.

For each task show:
- Task name + description
- PASS / FAIL badge
- Screenshot
- Console errors (if any)
- What failed and why (for FAIL tasks)

Summary at top: N tasks, N pass, N fail.

Dark theme, self-contained HTML, works from file://. No interactive buttons. No JSON export.

### 5. Commit + Push

```bash
git add docs/PRD-Renderer-System/phase-3/verification-log.html
git add docs/PRD-Renderer-System/phase-3/screenshots/verify-*.png
git add docs/PRD-Renderer-System/phase-3/fixes.md
git commit -m "PRD-Renderer-System: Phase 3 verification pass"
git pull --rebase origin main && git push origin main
```

### 6. Output Status

Last line must be exactly one of:
```
VERIFY_STATUS: ALL_PASS — {N} tasks verified, 0 issues
VERIFY_STATUS: NEEDS_FIXES — {N} tasks verified, {M} written to fixes.md
```
