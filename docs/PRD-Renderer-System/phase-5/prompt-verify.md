# Renderer System Phase 5: Graphics Reorganization — Verify

You verify ALL completed tasks on production. Take screenshots, compare against expected, report PASS/FAIL. **You do NOT fix anything.** Failures go to `fixes.md` for the code loop to handle.

> Reference: `docs/_template/standard-loop-v2/LOOP-SYSTEM.md`

## Context
- Tasks: `docs/PRD-Renderer-System/phase-5/plan.md`
- Fixes: `docs/PRD-Renderer-System/phase-5/fixes.md`

## Rules
- Screenshot every task. No screenshot = FAIL.
- **Describe before you judge.** Write what you see BEFORE marking PASS/FAIL.
- **Do NOT edit code or redeploy.** This phase is read-only verification.
- Failures are written to `fixes.md` — the code loop (Phase 1) will fix them on the next round.
- No code review fallback. If the page won't load, that's a FAIL.

## URLs
- URL Generator: `https://commentarygraphic.com/url-generator`
- Producer view (Graphics Panel): `https://commentarygraphic.com/producer/{compId}`
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
- [ ] Screenshot → `docs/PRD-Renderer-System/phase-5/screenshots/verify-task-{id}.png`
- [ ] `browser_console_messages`
- [ ] **Read screenshot back. Describe what you see.**
- [ ] Check task's **Verify** checklist from plan.md: `YES` or `NO` for each item

**If ALL confirmed → PASS.** Log it, next task.

**If ANY item is NO → FAIL.** Write to `fixes.md`:
```
- task:{id} | {what's wrong} | {what correct looks like}
```

### Special Verification Checks

**URL Generator Sidebar Structure:**
- [ ] Navigate to URL Generator
- [ ] Select a competition (men's or women's)
- [ ] Verify sidebar shows new category structure:
  - Full-Screen Cards (with Leaderboards, AA Leaders, Rosters, Sponsors Thank You subcategories)
  - Lower-Thirds (with Event Info, Team Stats, Coaches, Spotlight subcategories)
  - Full-Bleed (with Slates, Stream, Spotlight, Sponsors subcategories)
  - Video Frames (with Layouts, Apparatus subcategories)
  - Standalone (Team Logos, Sponsors Bug, Event Summary, Event Calendar)
  - Skeletons & Blocks (from Phase 4)
- [ ] Screenshot sidebar expanded
- [ ] Click subcategory headers — verify they collapse/expand
- [ ] Screenshot subcategory collapsed state

**Gender Filtering:**
- [ ] Select a women's competition
- [ ] Verify leaderboards show: VT, UB, BB, FX, AA, Combined AA (NO pommel horse, rings, parallel bars, high bar)
- [ ] Screenshot women's leaderboard list
- [ ] Select a men's competition
- [ ] Verify leaderboards show: VT, FX, PH, SR, PB, HB, AA, Combined AA (NO uneven bars, balance beam)
- [ ] Screenshot men's leaderboard list

**Web Graphics Panel (Producer View):**
- [ ] Navigate to producer view
- [ ] Find the Web Graphics Panel sidebar
- [ ] Verify it matches URL Generator structure (same categories, same subcategories, same gender filtering)
- [ ] Screenshot the graphics panel sidebar

**Backwards Compatibility:**
- [ ] Click several graphics in each category
- [ ] Verify clicking triggers the graphic (check Firebase or visual preview)
- [ ] Verify URL Generator produces correct URLs
- [ ] Verify no graphics are missing from the old sidebar that were present before

### 3. Verify PRD Is Up-to-Date

- [ ] Read the PRD file (`docs/PRD-Renderer-System/PRD-Renderer-System-2026-03-28.md`)
- [ ] For each COMPLETE task in plan.md, check that the corresponding PRD issue is marked FIXED (strikethrough pattern)
- [ ] If any completed issues are NOT marked FIXED in the PRD, add to `fixes.md`:
  ```
  - docs:prd | Issue #{N} is implemented but not marked FIXED in PRD | Mark as ~~strikethrough~~ FIXED with commit hash
  ```

### 4. Generate verification-log.html

Write `docs/PRD-Renderer-System/phase-5/verification-log.html` — static screenshot gallery.

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
git add docs/PRD-Renderer-System/phase-5/verification-log.html
git add docs/PRD-Renderer-System/phase-5/screenshots/verify-*.png
git add docs/PRD-Renderer-System/phase-5/fixes.md
git commit -m "PRD-Renderer-System: Phase 5 verification pass"
git pull --rebase origin main && git push origin main
```

### 6. Output Status

Last line must be exactly one of:
```
VERIFY_STATUS: ALL_PASS — {N} tasks verified, 0 issues
VERIFY_STATUS: NEEDS_FIXES — {N} tasks verified, {M} written to fixes.md
```
