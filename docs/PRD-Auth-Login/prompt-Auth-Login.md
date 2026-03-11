# PRD-Auth-Login — Implementation Workflow

## RULES
- **FIRST**: Run `browser_install` before any verification steps
- Complete each phase FULLY before moving to the next
- Mark checkboxes [x] as you complete each step
- **ONE TASK PER ITERATION** — implement exactly one task, then stop
- **Deploy batching** — code tasks (1.x, 2.x, 3.x) commit only; deploy tasks (3-D.x) build + deploy + verify
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
  - **Deploy task** (Task 3-D.x) → build + deploy + verify

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

- [ ] **2.5.1** For each file you plan to modify, read it fully before making any changes.
- [ ] **2.5.2** For new files, read the most similar existing file for patterns:
  - New context (`AuthContext.jsx`) → read `show-controller/src/hooks/useTalentRoster.js` for Firebase patterns
  - New page (`LoginPage.jsx`) → read `show-controller/src/pages/BookingPage.jsx` (also a standalone, no-nav page)
  - New component (`RequireAuth.jsx`) → read `show-controller/src/components/CoordinatorGate.jsx` (similar guard pattern)
  - Modifying `App.jsx` → read it fully — understand ALL existing routes before touching anything
  - Modifying `firebase.js` → read it fully first
  - Modifying `HomePage.jsx` for sign-out → read it fully first

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
  - Firebase Auth's default persistence is `LOCAL` — session survives page refresh automatically, no extra config needed
  - The `loading` state is critical: without it, there's a flash where `user` is null (not yet resolved) and the app incorrectly redirects to `/login` on every page load
  - `onAuthStateChanged` returns an unsubscribe function — call it in the useEffect cleanup

  **Task 1.3 (LoginPage):**
  - Read `BookingPage.jsx` for the standalone page pattern (no navbar, centered card)
  - Use `useLocation` to read `state.from` so after login the user lands on the page they originally requested
  - Only show the error message after a failed attempt — not on initial render
  - Keep the UI minimal: email input, password input, sign-in button, error text. No extra features.
  - Add the `/login` route to App.jsx as part of this task (it's a single-line change)

  **Task 2.1 (RequireAuth):**
  - Read `CoordinatorGate.jsx` first — follow the same structural pattern
  - The loading spinner can be a simple `<div>Loading...</div>` — style isn't critical
  - Pass `state={{ from: location.pathname }}` to the Navigate component so LoginPage knows where to redirect after login

  **Task 2.2 (App.jsx route wrapping):**
  - Read App.jsx fully before making any changes
  - The `/:compId/talent` route (TalentView) must remain public — talent open this URL during a live meet
  - For the nested competition routes: the simplest approach is to add RequireAuth inside CompetitionLayout.jsx
    (read CompetitionLayout.jsx to confirm) rather than trying to wrap individual nested routes in App.jsx
  - Double-check: `/login`, `/book/:token`, `/survey/:year` must NOT be wrapped

  **Task 3.1 (Sign-out on HomePage):**
  - Read `HomePage.jsx` fully first
  - Place the sign-out button in the top-right of the existing header — do not redesign the layout
  - Show the signed-in user's email alongside the button so coordinators can confirm who they're logged in as
  - After `signOut()`, navigate to `/login`

  **Output:**
  ```
  ✓ 3.1 Implementation Complete
  - Changes made: [brief summary]
  - Files modified: [list]
  ```

---

## Phase 4: Commit

- [ ] **4.1** Update the task status in the implementation plan: IN PROGRESS → COMPLETE
- [ ] **4.2** Stage and commit:
  ```bash
  git add -A && git commit -m "PRD-Auth-Login: [brief task description]" && git push origin main
  ```

  **Output:**
  ```
  ✓ 4.2 Committed
  - Commit message: [fill in]
  ```

---

## Phase 5: Deploy (Deploy tasks only — skip for code tasks)

**If this is a CODE task:** Skip to Phase 6.

**If this is Task 3-D.1 (Deploy):**

**STOP — check this before deploying:**
- [ ] Confirm Firebase Console → Authentication → Sign-in method → Email/Password is ENABLED
- [ ] Confirm Firebase Console → Authentication → Users has at least ONE account for testing
- If either is missing: **do not deploy** — the app will lock out all users including you

- [ ] **5.1** Build frontend:
  ```bash
  cd show-controller && npm run build
  # upload dist per CLAUDE.md Step 1
  ```

- [ ] **5.2** Server changed? No — skip coordinator restart

  **Output:**
  ```
  ✓ 5 Deploy Complete
  - Frontend deployed: [YES / NO / SKIPPED]
  - Server deployed: [YES / NO / SKIPPED]
  ```

---

## Phase 6: Verify (Deploy tasks only — skip for code tasks)

**If this is a CODE task:** Skip to Phase 7.

- [ ] **6.1** Run `browser_install`
- [ ] **6.2** Navigate to `https://commentarygraphic.com/` (unauthenticated)
  - Expected: redirects to `/login`
  - Take screenshot → `docs/PRD-Auth-Login/screenshots/verify-protected-redirect.png`
- [ ] **6.3** Log in with a valid coordinator account
  - Expected: redirects to `/` (or the originally requested page)
  - Take screenshot → `docs/PRD-Auth-Login/screenshots/verify-login-success.png`
- [ ] **6.4** Refresh the page
  - Expected: stays on `/`, does NOT redirect to `/login`
- [ ] **6.5** Navigate to `https://commentarygraphic.com/book/test-invalid`
  - Expected: loads BookingPage with graceful error, NO login redirect
  - Take screenshot → `docs/PRD-Auth-Login/screenshots/verify-public-booking.png`
- [ ] **6.6** Navigate to `https://commentarygraphic.com/survey/2027`
  - Expected: loads survey form, NO login redirect
- [ ] **6.7** Click "Sign Out"
  - Expected: redirects to `/login`
- [ ] **6.8** Check console: `browser_console_messages` — no auth errors

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
  - Commit: `git add -A && git commit -m "PRD-Auth-Login: Mark complete" && git push origin main`

- [ ] **7.2** If tasks remain: leave PRD status as IN PROGRESS

  **Output:**
  ```
  ✓ 7 Status Update
  - PRD status: [NOT STARTED / IN PROGRESS / COMPLETE]
  - Remaining tasks: [count]
  ```
