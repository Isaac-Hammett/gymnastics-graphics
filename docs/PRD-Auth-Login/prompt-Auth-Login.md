# PRD-Auth-Login — Implementation Workflow

## RULES
- **FIRST**: Run `browser_install` before any verification steps
- Complete each phase FULLY before moving to the next
- Mark checkboxes [x] as you complete each step
- **ONE TASK PER ITERATION** — implement exactly one task, then stop
- **Deploy batching** — code tasks (1.x, 2.x, 3.x) commit only; deploy tasks (x-D.x, F.x) build + upload + verify
- Screenshots save to `docs/PRD-Auth-Login/screenshots/`

## TEST URLS
- **Login Page:** `https://commentarygraphic.com/login`
- **Protected (should redirect to login if unauthenticated):** `https://commentarygraphic.com/`
- **Public — must NOT require login:** `https://commentarygraphic.com/book/test-invalid`
- **Public — must NOT require login:** `https://commentarygraphic.com/survey/2027`

## COORDINATOR SERVER
- **IP:** `44.193.31.120`
- **Dir:** `/opt/gymnastics-graphics`
- **Restart:** `GOOGLE_APPLICATION_CREDENTIALS=/opt/gymnastics-graphics/firebase-service-account.json pm2 start index.js --name coordinator` (see CLAUDE.md)

---

## Phase 1: Load Context

Read these files ONE AT A TIME. After EACH file, output the answers before reading the next.

- [ ] **1.1** Read PRD: `docs/PRD-Auth-Login/PRD-Auth-Login-2026-03-11.md`

  **Output before continuing:**
  ```
  ✓ 1.1 PRD Read
  - Feature name: [fill in]
  - Current PRD status: [fill in]
  - Auth strategy: [fill in]
  - Acceptance criteria count: [fill in]
  ```

- [ ] **1.2** Read Implementation Plan: `docs/PRD-Auth-Login/implementation-plan.md`

  **Output before continuing:**
  ```
  ✓ 1.2 Implementation Plan Read
  - Total tasks: [fill in]
  - Tasks NOT STARTED: [fill in]
  - Tasks IN PROGRESS: [fill in]
  - Tasks COMPLETE: [fill in]
  ```

---

## Phase 2: Select Next Task

- [ ] **2.1** From the Implementation Plan, identify the FIRST task that is:
  - Status = "IN PROGRESS", OR
  - Status = "NOT STARTED" (if none are IN PROGRESS)

- [ ] **2.2** Determine task type:
  - **Code task** (Task 1.x, 2.x, 3.x) → implement + commit only, no deploy
  - **Deploy task** (Task x-D.x or Task F.x) → build + deploy + verify

- [ ] **2.3** Output your selection:
  ```
  ✓ 2.3 Task Selected
  - Task ID: [fill in]
  - Task name: [fill in]
  - Task type: [CODE / DEPLOY]
  - Files to modify: [fill in]
  ```

---

## Phase 2.5: Read Required Files

- [ ] **2.5.1** For each file you plan to modify, read it fully before making any changes
- [ ] **2.5.2** For new files, read the most similar existing file for patterns:
  - New context (`AuthContext.jsx`) → read `show-controller/src/context/CompetitionContext.jsx` for provider pattern
  - New page (`LoginPage.jsx`) → read `show-controller/src/pages/BookingPage.jsx` (standalone, no-nav page)
  - New component (`RequireAuth.jsx`) → read `show-controller/src/components/CoordinatorGate.jsx` (guard pattern)
  - Modifying `App.jsx` → read it fully — understand ALL existing routes before touching anything
  - Modifying `firebase.js` → read it fully first
  - Modifying `CompetitionLayout.jsx` → read it fully first
  - Modifying `main.jsx` → read it fully first

  **Output:**
  ```
  ✓ 2.5 Files Read
  - Files read: [list]
  - Key patterns to follow: [brief notes]
  ```

---

## Phase 3: Implement

- [ ] **3.1** Implement the selected task exactly as described in the implementation plan
- [ ] **3.2** Update the task status in the implementation plan: NOT STARTED → IN PROGRESS

  **Task-specific notes:**

  **Task 1.1 (firebase.js):**
  - Only add auth imports/exports — do NOT touch any existing db exports
  - `firebase/auth` is part of the existing `firebase` package — no `npm install` needed

  **Task 1.2 (AuthContext):**
  - Follow `CompetitionContext.jsx` pattern for context + provider + hook
  - Firebase Auth's default persistence is `LOCAL` — session survives page refresh automatically, no extra config needed
  - The `loading` state is critical: without it, there's a flash where `user` is null (not yet resolved) and the app incorrectly redirects to `/login` on every page load
  - `onAuthStateChanged` returns an unsubscribe function — call it in the useEffect cleanup
  - Wrap `<App />` in `main.jsx` with `<AuthProvider>`

  **Task 1.3 (LoginPage):**
  - Follow `BookingPage.jsx` pattern: standalone page, dark bg, centered card, no navbar
  - Use `useLocation` to read `state.from` so after login the user lands on the page they originally requested
  - Only show the error message after a failed attempt — not on initial render
  - If user is already signed in, redirect to `/` immediately
  - Keep the UI minimal: email input, password input, sign-in button, error text
  - Add the `/login` route to App.jsx (place before protected routes)

  **Task 2.1 (RequireAuth):**
  - Follow `CoordinatorGate.jsx` pattern for the guard structure
  - Loading state: full-screen dark bg with "Loading..." text (matches app aesthetic)
  - Pass `state={{ from: location.pathname }}` to the Navigate component so LoginPage knows where to redirect after login
  - **Do NOT add the sign-out button yet** — that's Task 3.1

  **Task 2.2 (App.jsx + CompetitionLayout):**
  - Read App.jsx fully before making any changes
  - Wrap each protected route with `<RequireAuth>` individually
  - Leave unwrapped: `/login`, `/book/:token`, `/survey/:year`
  - Inside CompetitionLayout: add auth check that skips for the `/talent` child path
    - `const isTalentPath = location.pathname.endsWith('/talent')`
    - If not talent path and not authenticated → redirect to `/login`
  - Double-check: public routes must NOT be wrapped

  **Task 3.1 (Sign-out in RequireAuth):**
  - Add a floating sign-out button inside RequireAuth (top-right corner, fixed position, high z-index)
  - Show signed-in user's email alongside the button
  - After `signOut()`, navigate to `/login`
  - Style: subtle, small, doesn't interfere with page content
  - This makes sign-out available on EVERY protected page without modifying individual pages

  **Output:**
  ```
  ✓ 3.1 Implementation Complete
  - Changes made: [brief summary]
  - Files modified: [list]
  ```

---

## Phase 4: Commit

- [ ] **4.1** Update the task status in the implementation plan: IN PROGRESS → COMPLETE
- [ ] **4.2** Stage and commit — use specific file paths, not `git add -A`:
  ```bash
  # Stage only the files you modified (from Phase 3.1) + the implementation plan
  git add docs/PRD-Auth-Login/implementation-plan.md
  git add [each file modified in Phase 3.1]
  git commit -m "PRD-Auth-Login: [brief task description]"
  git push origin main
  ```

  **Output:**
  ```
  ✓ 4.2 Committed
  - Commit message: [fill in]
  ```

---

## Phase 5: Deploy (Deploy tasks only — skip for code tasks)

**If this is a CODE task:** Skip to Phase 7 (there is no verification needed until the deploy task).

**If this is a DEPLOY task:**

**STOP — check this before first deploy (Phase 1-Deploy):**
- Confirm Firebase Console → Authentication → Sign-in method → Email/Password is ENABLED
- Confirm Firebase Console → Authentication → Users has at least ONE account for testing
- If either is missing: **do not deploy** — the app will lock out all users

- [ ] **5.1** Frontend changed? Yes — all deploys in this PRD are frontend-only:
  ```bash
  cd show-controller && npm run build
  # then upload dist per CLAUDE.md Step 1
  ```

- [ ] **5.2** Graphics files changed? No — skip Step 2 for all tasks.

- [ ] **5.3** Server changed? No — skip coordinator restart for all tasks.

  **Output:**
  ```
  ✓ 5 Deploy Complete
  - Frontend deployed: [YES / NO / SKIPPED]
  - Graphics deployed: SKIPPED
  ```

---

## Phase 6: Verify (Deploy tasks only — skip for code tasks)

**If this is a CODE task:** Skip to Phase 7. Verification happens at the deploy task.

**If this is a DEPLOY task:**

- [ ] **6.1** Run `browser_install`
- [ ] **6.2** Run the specific verification steps from the deploy task in the implementation plan
- [ ] **6.3** Take screenshots → `docs/PRD-Auth-Login/screenshots/`
- [ ] **6.4** Check console: `browser_console_messages`

**Credentials (for Tasks 2-D.2, 3-D.1, F.1):** Read test account email/password from `~/.claude/projects/-Users-juliacosmiano-code-gymnastics-graphics/memory/playwright-credentials.md`

**Deploy-specific verification:**

**Task 1-D.2:**
- Navigate to `https://commentarygraphic.com/login` — login page renders
- Screenshot → `verify-login-page.png`
- Note: route protection NOT active yet — no login needed for verification

**Task 2-D.2:**
- Navigate to `https://commentarygraphic.com/` (unauthenticated) — should redirect to `/login`
- Screenshot → `verify-protected-redirect.png`
- Log in with test credentials from memory file (fill email, fill password, click "Sign In") — should redirect to `/`
- Screenshot → `verify-login-success.png`
- Refresh page — stays logged in
- Navigate to `https://commentarygraphic.com/book/test-invalid` — loads without login
- Screenshot → `verify-public-booking.png`
- Navigate to `https://commentarygraphic.com/survey/2027` — loads without login

**Task 3-D.1:**
- Navigate to `https://commentarygraphic.com/login`
- Log in with test credentials from memory file (fill email, fill password, click "Sign In")
- Confirm sign-out button visible in top-right with user email
- Click "Sign Out" — redirects to `/login`
- Screenshot → `verify-sign-out.png`
- Log in again, navigate to another protected page — confirm sign-out button appears there too

**Task F.1:**
- Navigate to `https://commentarygraphic.com/talent` (unauthenticated) — redirects to `/login`
- Log in with test credentials from memory file — redirects to `/talent` (the originally requested page, not `/`)
- Run remaining acceptance criteria checklist from PRD
- Screenshots → `final-verify-*.png`

**If verification FAILS:**
- Record what failed and why in the implementation plan
- STOP — fix in the next context window, do not continue

  **Output:**
  ```
  ✓ 6 Verification
  - Result: [PASS / FAIL]
  - Screenshots: [list filenames]
  - Console errors: [none / list]
  - Issues: [none / describe]
  ```

---

## Phase 7: Update Status

- [ ] **7.1** If ALL tasks in the implementation plan are COMPLETE:
  - Update PRD status to COMPLETE in `PRD-Auth-Login-2026-03-11.md`
  - Commit: `git add docs/PRD-Auth-Login/ && git commit -m "PRD-Auth-Login: Mark complete" && git push origin main`

- [ ] **7.2** If tasks remain: leave PRD status as IN PROGRESS (the loop will continue)

  **Output:**
  ```
  ✓ 7 Status Update
  - PRD status: [IN PROGRESS / COMPLETE]
  - Remaining tasks: [count]
  ```

---

## Deploy Reference

| Change Type | Deploy Step |
|-------------|-------------|
| Frontend only (show-controller) | `npm run build` + upload dist per CLAUDE.md Step 1 |
| Graphics files (output.html, overlays/) | Upload per CLAUDE.md Step 2 + `chmod 644 overlays/*` |
| Both | Deploy frontend first, then graphics files |
| Firebase data only | No deploy needed |
| Server (coordinator) | `ssh_exec` → `pm2 restart coordinator` with credentials per CLAUDE.md |
