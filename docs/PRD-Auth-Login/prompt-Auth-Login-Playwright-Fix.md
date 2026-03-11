# PRD-Auth-Login — Playwright Auth Fix

## Problem

Once Auth-Login is deployed, every autonomous Playwright verification step will hit `/login` instead of the actual page. This prompt updates all affected touchpoints so autonomous workflows keep working.

## Prerequisites

**Before running this prompt:**
1. Firebase Console → Authentication → Sign-in method → Email/Password must be ENABLED
2. Firebase Console → Authentication → Users must have at least ONE test account
3. This prompt must run BEFORE Auth-Login Phase 2-Deploy (route protection). If Phase 2 is already deployed, the template and CLAUDE.md updates still apply but Auth-Login plan edits are retroactive.

## RULES
- Complete ALL phases in a single iteration
- Mark checkboxes [x] as you complete each step
- After each phase, output the checkpoint summary before continuing
- Do NOT modify any application code — this is infrastructure/docs only

---

## Phase 1: Load Context

- [ ] **1.1** Read the PRD: `docs/PRD-Auth-Login/PRD-Auth-Login-2026-03-11.md`
- [ ] **1.2** Read the implementation plan: `docs/PRD-Auth-Login/implementation-plan.md`
- [ ] **1.3** Read the current execution prompt template: `docs/_template/prompt-TEMPLATE.md`
- [ ] **1.4** Read CLAUDE.md (deploy verification section)

  **Output:**
  ```
  ✓ Phase 1 Complete
  - Auth PRD status: [status]
  - Public routes (no login needed): [list]
  - Protected routes (login needed): [list summary]
  ```

---

## Phase 2: Identify All Affected Touchpoints

Scan for every file that contains Playwright verification steps (`browser_navigate` to `commentarygraphic.com`).

- [ ] **2.1** Search all files in `docs/` for `browser_navigate.*commentarygraphic`
- [ ] **2.2** Search `CLAUDE.md` for verification steps that navigate to protected URLs
- [ ] **2.3** Categorize each hit into one of three categories:
  - **STATIC** — navigates to a file served directly by nginx, not handled by React router at all (`/output.html`, `/overlays/*`). These will never be affected by auth changes.
  - **PUBLIC ROUTE** — navigates to a React route explicitly excluded from auth (`/login`, `/book/:token`, `/survey/:year`). Also `/:compId/talent` — match any URL ending in `/talent` where the first segment looks like a competition ID (e.g., `/ncaa-2026/talent`).
  - **BROKEN** — navigates to a protected route (anything else on `commentarygraphic.com` that isn't STATIC or PUBLIC ROUTE)

  **Output for each file:**
  ```
  {file} → line {N}: {URL}
  - Status: STATIC (nginx-served) / PUBLIC ROUTE (React, no auth) / BROKEN (protected)
  ```

  **Summary:**
  ```
  ✓ Phase 2 Complete
  - Total Playwright navigation steps found: [count]
  - STATIC (nginx-served, never affected): [count]
  - PUBLIC ROUTE (React, explicitly no auth): [count]
  - BROKEN (needs login): [count]
  - Files affected: [list]
  ```

---

## Phase 3: Design the Login Helper Pattern

Define a reusable Playwright login sequence that can be inserted before any protected-page verification.

- [ ] **3.1** Determine where test credentials should be stored:
  - Option A: Memory file at `~/.claude/projects/-Users-juliacosmiano-code-gymnastics-graphics/memory/playwright-credentials.md`
  - Option B: A non-committed file in the project
  - **Recommendation:** Option A (memory file — persists across sessions, not committed to git)

- [ ] **3.2** Write the credential storage file with this structure:
  ```
  # Playwright Test Credentials
  email: [ASK USER]
  password: [ASK USER]
  ```
  **STOP and ask the user for the test account email and password before continuing.**

- [ ] **3.3** Define the login sequence (Playwright MCP steps):
  ```
  ## Playwright Login Sequence (copy into verification steps)
  1. browser_navigate → https://commentarygraphic.com/login
  2. browser_snapshot → confirm login form is visible
  3. browser_fill_form → email field with test email
  4. browser_fill_form → password field with test password
  5. browser_click → "Sign In" button
  6. browser_snapshot → confirm redirect away from /login
  ```

  **Output:**
  ```
  ✓ Phase 3 Complete
  - Credentials stored: [location]
  - Login sequence: [step count] Playwright steps
  ```

---

## Phase 4: Update CLAUDE.md Deploy Verification

- [ ] **4.1** Read CLAUDE.md fully
- [ ] **4.2** Update the "Step 3: Verify Deployment" section to include a login step before navigating to protected pages:

  The updated section should:
  - Add a "Step 0: Authenticate" before the existing verification
  - Reference the credential memory file
  - Note that `/output.html` and `/overlays/*` are static files served by nginx — they bypass React entirely and never need login
  - Note that login session persists within a single Playwright browser session (but NOT across separate Claude conversations)

- [ ] **4.3** Verify the edit doesn't break any existing content in CLAUDE.md

  **Output:**
  ```
  ✓ Phase 4 Complete
  - CLAUDE.md updated: [YES]
  - Section modified: [section name]
  ```

---

## Phase 5: Update the Execution Prompt Template

- [ ] **5.1** Read `docs/_template/prompt-TEMPLATE.md`
- [ ] **5.2** Update Phase 6 (Verify) — find the step that says "Navigate to the test URL" and insert a login step BEFORE it:

  ```
  - [ ] **6.1.5** If navigating to a protected URL (not `/output.html`, `/overlays/*`, `/book/*`, `/survey/*`), log in first:
    - Read credentials from `~/.claude/projects/-Users-juliacosmiano-code-gymnastics-graphics/memory/playwright-credentials.md`
    - browser_navigate → https://commentarygraphic.com/login
    - browser_fill_form → email + password
    - browser_click → Sign In
    - browser_snapshot → confirm authenticated
    - Note: session persists for remaining navigations in this Playwright session
  ```

  **Output:**
  ```
  ✓ Phase 5 Complete
  - Template updated: [YES]
  - New step added: before "Navigate to the test URL" step
  ```

---

## Phase 5.5: Update Other Affected PRDs

For any non-Auth-Login file flagged as BROKEN in Phase 2:

- [ ] **5.5.1** Check if the PRD is still IN PROGRESS (if COMPLETE, its deploy tasks won't run again — skip)
- [ ] **5.5.2** For each in-progress PRD with BROKEN verification steps, add the login sequence before the first protected-page navigation in its deploy tasks
- [ ] **5.5.3** Add those files to the commit list in Phase 7

  **Output:**
  ```
  ✓ Phase 5.5 Complete
  - In-progress PRDs with broken steps: [count / none]
  - PRDs updated: [list / none]
  - Completed PRDs skipped: [list / none]
  ```

---

## Phase 6: Update the Auth-Login Implementation Plan Verification Steps

The Auth-Login implementation plan has deploy tasks (1-D.2, 2-D.2, 3-D.1, F.1) that use Playwright.

**IMPORTANT:** Auth-Login deploy tasks are different from normal deploy verification — they are testing the auth flow itself. Do NOT prepend a generic login helper that would mask auth failures.

- [ ] **6.1** Read `docs/PRD-Auth-Login/implementation-plan.md`
- [ ] **6.2** Check each deploy task:
  - Task 1-D.2: Route protection NOT active yet → login NOT needed → **NO CHANGE**
  - Task 2-D.2: This task IS the login test — it tests redirect-to-login, login, session persistence, and public routes. The login steps are the test assertions themselves → **NO CHANGE** (already correct)
  - Task 3-D.1: Says "log in if needed" — make this explicit with Playwright steps (navigate to `/login`, fill credentials, click Sign In) but keep it as part of the test flow, not a separate helper → **UPDATE** to reference credential memory file
  - Task F.1: Tests the full acceptance criteria including login redirect → login is part of the test assertions → **NO CHANGE** (but add a note to read credentials from memory file)

- [ ] **6.3** Update Task 3-D.1 to reference the credential memory file and use explicit Playwright login steps
- [ ] **6.4** Add a note to Task F.1 to read credentials from the memory file

  **Output:**
  ```
  ✓ Phase 6 Complete
  - Deploy tasks updated: [3-D.1, F.1 (note only)]
  - Deploy tasks unchanged: [1-D.2, 2-D.2]
  ```

---

## Phase 7: Commit

- [ ] **7.1** Stage and commit all changes:
  ```bash
  git add CLAUDE.md
  git add docs/_template/prompt-TEMPLATE.md
  git add docs/PRD-Auth-Login/implementation-plan.md
  git add docs/PRD-Auth-Login/prompt-Auth-Login-Playwright-Fix.md
  # Also add any other PRD files updated in Phase 5.5
  git commit -m "PRD-Auth-Login: Add Playwright login sequence to all verification workflows"
  git push origin main
  ```

  **Output:**
  ```
  ✓ Phase 7 Complete
  - Files committed: [count]
  - Commit hash: [hash]
  ```

---

## Summary

```
═══════════════════════════════════════════════
  Auth-Login — PLAYWRIGHT AUTH FIX
═══════════════════════════════════════════════
Touchpoints scanned:        [count]
  STATIC (nginx-served):    [count]
  PUBLIC ROUTE (no auth):   [count]
  BROKEN (needs login):     [count]
Files updated:
  - Credential store:       [location]
  - CLAUDE.md:              [YES/NO]
  - Prompt template:        [YES/NO]
  - Auth impl plan:         [YES/NO]
  - Other PRDs:             [list / none]
Status: COMPLETE
═══════════════════════════════════════════════
```
