# Auth Login — Implementation Plan

**PRD:** PRD-Auth-Login-2026-03-11.md
**Date:** 2026-03-11
**Last Updated:** 2026-03-11

---

## Phases Overview

| Phase | Description | Tasks | Status |
|-------|-------------|-------|--------|
| Phase 1 | Firebase Auth + Context + Login Page | 3 | COMPLETE |
| Phase 1-Deploy | Deploy Phase 1 changes | 2 | COMPLETE |
| Phase 2 | Route Protection | 2 | COMPLETE |
| Phase 2-Deploy | Deploy Phase 2 changes | 2 | NOT STARTED |
| Phase 3 | Sign-Out UI | 1 | NOT STARTED |
| Phase 3-Deploy | Deploy Phase 3 changes | 1 | NOT STARTED |
| Final-Deploy | Full verification + mark complete | 2 | NOT STARTED |
| **Total** | | **13** | |

---

## Prerequisites (Manual — done before running deploy tasks)

**Enable Firebase Email/Password Auth in Firebase Console:**
1. Go to Firebase Console → Authentication → Sign-in method
2. Enable "Email/Password" provider
3. Go to Authentication → Users
4. Add coordinator accounts (name + email + password) for each person who needs access

This must be done before deploying — the app will redirect to `/login` for everyone once auth is live.

---

## Phase 1: Firebase Auth + Context + Login Page

> **Deploy rule:** Commit each task. Do NOT deploy until Phase 1-Deploy.

### Task 1.1: Add Firebase Auth to firebase.js — COMPLETE

**File:** `show-controller/src/lib/firebase.js`

**Change:** Import and export Firebase Auth utilities alongside the existing database exports:

```javascript
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from 'firebase/auth';

const auth = getAuth(app);

export { auth, signInWithEmailAndPassword, signOut, onAuthStateChanged };
// Keep all existing db exports unchanged
```

**Note:** `firebase/auth` is already in the `firebase` npm package — no new dependency needed.

**Implements:** Auth primitives available app-wide

---

### Task 1.2: Create AuthContext — COMPLETE

**File:** `show-controller/src/context/AuthContext.jsx` (new file)

**Pattern to follow:** `show-controller/src/context/CompetitionContext.jsx`

**Change:** Create a React context that tracks auth state and exposes sign-in/sign-out:

```jsx
// AuthContext provides: { user, loading, signIn, signOut }
// - user: Firebase User object or null
// - loading: true while onAuthStateChanged hasn't fired yet
// - signIn(email, password): calls signInWithEmailAndPassword, throws on failure
// - signOut(): calls Firebase signOut

// Use onAuthStateChanged in a useEffect to set user state.
// Firebase Auth persistence is LOCAL by default — sessions survive page refresh automatically.
// onAuthStateChanged returns an unsubscribe function — call it in useEffect cleanup.

// Wrap the app: export AuthProvider (wraps children in AuthContext.Provider)
// Export useAuth hook: const useAuth = () => useContext(AuthContext)
```

**File:** `show-controller/src/main.jsx`
- Wrap `<App />` with `<AuthProvider>`

**Implements:** Auth state available to all components

---

### Task 1.3: Create LoginPage — COMPLETE

**File:** `show-controller/src/pages/LoginPage.jsx` (new file)

**Pattern to follow:** `show-controller/src/pages/BookingPage.jsx` (standalone, no navbar, centered card)

**Change:** Create a simple, standalone login page:

```jsx
// Layout: centered card on a dark background (min-h-screen bg-gray-900), consistent with app aesthetic
// Fields: email (text input), password (password input), "Sign In" button
// On submit: calls signIn(email, password) from useAuth
// On success: navigate to the `from` location (the page the user originally requested),
//             defaulting to `/` if no redirect was stored
//             Use: const location = useLocation(); location.state?.from || '/'
// On error: show inline error message (e.g. "Incorrect email or password")
// Loading state: disable button + show spinner while sign-in is in progress
// If user is already signed in: redirect to `/` immediately (don't show the login form)
// No "Forgot password" link — admin resets passwords directly in Firebase Console
```

**File:** `show-controller/src/App.jsx`
- Add route: `<Route path="/login" element={<LoginPage />} />`
- Place before all protected routes

**Implements:** Login UI + route

---

## Phase 1-Deploy: Deploy Phase 1 Changes

> **This is a deploy task.** Build, upload, and verify all Phase 1 changes together.

**STOP — check before deploying:**
- Confirm Firebase Console → Authentication → Sign-in method → Email/Password is ENABLED
- Confirm Firebase Console → Authentication → Users has at least ONE account for testing
- If either is missing: **do not deploy** — the app will lock out all users once route protection is added in Phase 2

### Task 1-D.1: Build and deploy to production — COMPLETE

**Frontend changed?** Yes
```bash
cd show-controller && npm run build
# then upload dist per CLAUDE.md Step 1
```

**Graphics files changed?** No — skip Step 2.

**Server changed?** No — auth is entirely client-side (Firebase Auth SDK).

### Task 1-D.2: Verify Phase 1 on production — COMPLETE

Navigate to test URLs with Playwright. Take screenshots to `docs/PRD-Auth-Login/screenshots/`.

**Checks:**
- [x] Navigate to `https://commentarygraphic.com/login` — login page renders (centered card, email + password fields)
- [x] Take screenshot → `docs/PRD-Auth-Login/screenshots/verify-login-page.png`
- [x] No console errors (`browser_console_messages`)
- [x] Note: route protection is NOT active yet — `/` and other pages still load without login

---

## Phase 2: Route Protection

> **Deploy rule:** Commit each task. Do NOT deploy until Phase 2-Deploy.

### Task 2.1: Create RequireAuth component — COMPLETE

**File:** `show-controller/src/components/RequireAuth.jsx` (new file)

**Pattern to follow:** `show-controller/src/components/CoordinatorGate.jsx`

**Change:** Create a wrapper component that guards protected routes:

```jsx
// import { useAuth } from '../context/AuthContext'
// import { Navigate, useLocation } from 'react-router-dom'
//
// function RequireAuth({ children }) {
//   const { user, loading } = useAuth()
//   const location = useLocation()
//
//   if (loading) return <div className="min-h-screen bg-gray-900 flex items-center justify-center">
//     <div className="text-gray-400">Loading...</div>
//   </div>
//   if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />
//   return children
// }
```

**Implements:** Auth guard for protected routes

---

### Task 2.2: Wrap coordinator routes + CompetitionLayout auth check — COMPLETE

**File:** `show-controller/src/App.jsx`

**Change:** Wrap all coordinator-facing routes with `<RequireAuth>`. Public routes (`/login`, `/book/:token`, `/survey/:year`) are NOT wrapped.

```jsx
// Pattern — wrap each protected route:
<Route path="/" element={<RequireAuth><HomePage /></RequireAuth>} />
<Route path="/talent" element={<RequireAuth><TalentPage /></RequireAuth>} />
// ... repeat for all protected routes (see PRD routes table)

// Leave unwrapped:
<Route path="/login" element={<LoginPage />} />
<Route path="/book/:token" element={<BookingPage />} />
<Route path="/survey/:year" element={<SurveyPage />} />
```

**File:** `show-controller/src/components/CompetitionLayout.jsx`

**Change:** Add auth check inside CompetitionLayout that skips auth for the `/talent` child path:

```jsx
// import { useAuth } from '../context/AuthContext'
// import { Navigate, useLocation } from 'react-router-dom'
//
// Inside CompetitionLayout:
// const { user, loading } = useAuth()
// const location = useLocation()
// const isTalentPath = location.pathname.endsWith('/talent')
//
// if (!isTalentPath && !loading && !user) {
//   return <Navigate to="/login" state={{ from: location.pathname }} replace />
// }
```

This keeps `/:compId/talent` public while protecting all other competition routes (producer, graphics, obs-manager, commentary, rundown, checklist, camera-setup).

**Implements:** All coordinator routes protected, public routes unchanged

---

## Phase 2-Deploy: Deploy Phase 2 Changes

### Task 2-D.1: Build and deploy to production — NOT STARTED

**Frontend changed?** Yes
```bash
cd show-controller && npm run build
# then upload dist per CLAUDE.md Step 1
```

### Task 2-D.2: Verify Phase 2 on production — NOT STARTED

**Credentials:** Read test account email/password from `~/.claude/projects/-Users-juliacosmiano-code-gymnastics-graphics/memory/playwright-credentials.md`

**Checks:**
- [ ] Navigate to `https://commentarygraphic.com/` (unauthenticated) — redirects to `/login`
- [ ] Take screenshot → `docs/PRD-Auth-Login/screenshots/verify-protected-redirect.png`
- [ ] Log in with test credentials (fill email, fill password, click "Sign In") — redirects to `/`
- [ ] Take screenshot → `docs/PRD-Auth-Login/screenshots/verify-login-success.png`
- [ ] Refresh the page — stays on `/`, does NOT redirect to `/login` (session persists)
- [ ] Navigate to `https://commentarygraphic.com/book/test-invalid` — loads without login prompt
- [ ] Take screenshot → `docs/PRD-Auth-Login/screenshots/verify-public-booking.png`
- [ ] Navigate to `https://commentarygraphic.com/survey/2027` — loads without login prompt
- [ ] No console errors (`browser_console_messages`)

---

## Phase 3: Sign-Out UI

> **Deploy rule:** Commit, then deploy in Phase 3-Deploy.

### Task 3.1: Add sign-out button to RequireAuth wrapper — NOT STARTED

**File:** `show-controller/src/components/RequireAuth.jsx`

**Change:** Add a floating sign-out button (top-right corner) that appears on every protected page:

```jsx
// Inside RequireAuth, after the loading/redirect checks, wrap children with a container:
//
// return (
//   <>
//     <div style={{ position: 'fixed', top: 12, right: 16, zIndex: 9999, display: 'flex', alignItems: 'center', gap: 8 }}>
//       <span style={{ color: '#9CA3AF', fontSize: 13 }}>{user.email}</span>
//       <button onClick={handleSignOut} style={signOutButtonStyles}>Sign Out</button>
//     </div>
//     {children}
//   </>
// )
//
// handleSignOut: calls signOut from useAuth, then navigate('/login')
// Style: subtle, small button that doesn't interfere with page content
// Use inline styles or Tailwind classes matching the dark theme
```

**Implements:** Sign-out accessible from every protected page without modifying individual page components

---

## Phase 3-Deploy: Deploy Phase 3 Changes

### Task 3-D.1: Build, deploy, and verify sign-out — NOT STARTED

**Frontend changed?** Yes
```bash
cd show-controller && npm run build
# then upload dist per CLAUDE.md Step 1
```

**Credentials:** Read test account email/password from `~/.claude/projects/-Users-juliacosmiano-code-gymnastics-graphics/memory/playwright-credentials.md`

**Verify:**
- [ ] Navigate to `https://commentarygraphic.com/login`
- [ ] Log in with test credentials (fill email, fill password, click "Sign In")
- [ ] Confirm redirected to `/` and sign-out button visible in top-right corner with user email
- [ ] Click "Sign Out" — redirects to `/login`
- [ ] Take screenshot → `docs/PRD-Auth-Login/screenshots/verify-sign-out.png`
- [ ] Log in again, navigate to a different protected page (e.g. `/talent`) — confirm sign-out button appears there too
- [ ] No console errors

---

## Final-Deploy: Full Verification

### Task F.1: Full acceptance criteria check — NOT STARTED

Run through every acceptance criterion in the PRD using Playwright.
Screenshots: `docs/PRD-Auth-Login/screenshots/final-verify-*.png`

**Credentials:** Read test account email/password from `~/.claude/projects/-Users-juliacosmiano-code-gymnastics-graphics/memory/playwright-credentials.md`

**Checklist:**
- [ ] Navigate to `https://commentarygraphic.com/talent` (unauthenticated) — redirects to `/login`
- [ ] Log in with test credentials (fill email, fill password, click "Sign In") — redirects to `/talent` (the originally requested page, not `/`)
- [ ] Session persists on page refresh (Firebase Auth persistence is enabled)
- [ ] Sign-out button appears on every protected page and clears the session, redirecting to `/login`
- [ ] `/book/:token` loads without login (open in new unauthenticated context or verify URL is not redirected)
- [ ] `/survey/:year` loads without login
- [ ] `/:compId/talent` loads without login (talent-facing view)
- [ ] No console errors on any page

### Task F.2: Mark PRD complete — NOT STARTED

Update `PRD-Auth-Login-2026-03-11.md` status to COMPLETE. Commit.

---

## Estimated Scope

| Phase | Tasks | Complexity | Status |
|-------|-------|------------|--------|
| Phase 1 | 3 | Low | COMPLETE |
| Phase 1-Deploy | 2 | Low | COMPLETE |
| Phase 2 | 2 | Medium | COMPLETE |
| Phase 2-Deploy | 2 | Low | NOT STARTED |
| Phase 3 | 1 | Low | NOT STARTED |
| Phase 3-Deploy | 1 | Low | NOT STARTED |
| Final-Deploy | 2 | Low | NOT STARTED |
| **Total** | **13** | | |
