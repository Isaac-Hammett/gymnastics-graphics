# PRD-{FeatureName} — Discovery Prompt
# This is Variant B: Bug Audit — Playwright System Test
# Use this when auditing an existing broken system before implementing fixes.
# For new features (plan integrity check), use docs/_template/prompt-TEMPLATE-Discovery.md instead.

## RULES
- Complete ALL phases in a single iteration
- Mark checkboxes [x] as you complete each step
- After each phase, output the checkpoint summary before continuing
- This prompt is READ-ONLY for code — do NOT modify any code files
- Run `browser_install` before any browser steps
- Take a screenshot for EVERY test — save to `docs/PRD-{FeatureName}/screenshots/audit-*.png`
- Check `browser_console_messages` after every page load
- Document each bug immediately when found

## TEST COMPETITION
- **Competition ID:** `{comp-id}`
- **Producer URL:** `https://commentarygraphic.com/{comp-id}/producer`
- **Output URL:** `https://commentarygraphic.com/output.html?comp={comp-id}`
- **Format:** {e.g., Women's 4-Team}

---

## Phase 1: Load Context

- [ ] **1.1** Read the PRD: `docs/PRD-{FeatureName}/PRD-{FeatureName}-{date}.md`
- [ ] **1.2** Read the implementation plan: `docs/PRD-{FeatureName}/implementation-plan.md`
- [ ] **1.3** Run `browser_install`

  **Output:**
  ```
  ✓ Phase 1 Complete
  - Bugs already cataloged: [count]
  - Tasks already complete: [count]
  ```

---

## Phase 2: {Test Suite Name — e.g., Producer View Audit}

- [ ] **2.1** Navigate to producer URL
- [ ] **2.2** Take screenshot → `docs/PRD-{FeatureName}/screenshots/audit-producer-page.png`
- [ ] **2.3** Check console: `browser_console_messages`

### Test A1: {Test Name}
- [ ] {What to check}
- [ ] {What to check}

  **Output:**
  ```
  Test A1: {Test Name}
  - Result: [PASS / FAIL]
  - Details: [describe]
  - Bug: [none / BUG-XXX description]
  ```

### Test A2: {Test Name}
{repeat pattern}

---

## Phase 3: {Test Suite Name — e.g., Graphics Overlay Audit}

{repeat pattern for each test suite}

---

## Phase 4: Console Error Sweep

- [ ] **4.1** Collect ALL console errors from every page visited
- [ ] **4.2** Categorize: Error (JS exceptions) / Warning (non-critical) / Info (ignore)

  **Output:**
  ```
  ✓ Console Error Summary
  - Total errors: [count]
  - Total warnings: [count]
  - Unique messages: [list]
  ```

---

## Phase 5: Document Findings

- [ ] **5.1** For each new bug discovered, add to the Bug Catalog in the PRD:
  - Bug ID (continue from existing: BUG-{N+1}, etc.)
  - Description, severity (Critical / Major / Minor)
  - Steps to reproduce, expected vs actual
  - Screenshot filename
  - Affected file(s) if identifiable

- [ ] **5.2** Add tasks for newly discovered bugs to the implementation plan

- [ ] **5.3** Commit updated docs:
  ```bash
  git add docs/PRD-{FeatureName}/ && git commit -m "PRD-{FeatureName}: Playwright audit results" && git push origin main
  ```

---

## Audit Summary

```
═══════════════════════════════════════
  {FeatureName} AUDIT
  Competition: {comp-id}
═══════════════════════════════════════

{test result table}

TOTAL: [X] PASS / [Y] FAIL / [Z] BLOCKED
BUGS: [N] total ([a] critical, [b] major, [c] minor)
═══════════════════════════════════════
```
