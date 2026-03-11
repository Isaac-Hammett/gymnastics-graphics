# Auth Login — Implementation Plan

**PRD:** PRD-Auth-Login-2026-03-11.md

---

## Phases Overview

| Phase | Description | Tasks | Status |
|-------|-------------|-------|--------|
| Phase 1 | Firebase Auth + Context + Login Page | 3 | NOT STARTED |
| Phase 2 | Route Protection | 2 | NOT STARTED |
| Phase 3 | Sign-Out UI | 1 | NOT STARTED |
| Phase 3-Deploy | Build, deploy, verify | 1 | NOT STARTED |
| **Total** | | **7** | |

---

## Prerequisites (Manual — done before running tasks)

**Enable Firebase Email/Password Auth in Firebase Console:**
1. Go to Firebase Console → Authentication → Sign-in method
2. Enable "Email/Password" provider
3. Go to Authentication → Users
4. Add coordinator accounts (name + email + password) for each person who needs access

This must be done before deploying — the app will redirect to `/login` for everyone once auth is live.

---

## Phase 1: Firebase Auth + Context + Login Page

### Task 1.1: Add Firebase Auth to firebase.js — NOT STARTED

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

### Task 1.2: Create AuthContext — NOT STARTED

**File:** `show-controller/src/context/AuthContext.jsx` (new file)

**Change:** Create a React context that tracks auth state and exposes sign-in/sign-out:

```jsx
// AuthContext provides: { user, loading, signIn, signOut }
// - user: Firebase User object or null
// - loading: true while onAuthStateChanged hasn't fired yet
// - signIn(email, password): calls signInWithEmailAndPassword, throws on failure
// - signOut(): calls Firebase signOut

// Use onAuthStateChanged in a useEffect to set user state.
// Firebase Auth persistence is LOCAL by default — sessions survive page refresh automatically.

// Wrap the app: export AuthProvider (wraps children in AuthContext.Provider)
// Export useAuth hook: const useAuth = () => useContext(AuthContext)
```

**File:** `show-controller/src/main.jsx` (or wherever `<App />` is rendered)
- Wrap `<App />` with `<AuthProvider>`

**Implements:** Auth state available to all components

---

### Task 1.3: Create LoginPage — NOT STARTED

**File:** `show-controller/src/pages/LoginPage.jsx` (new file)

**Change:** Create a simple, standalone login page (no navbar, no auth required):

```jsx
// Layout: centered card on a dark background, consistent with app aesthetic
// Fields: email (text input), password (password input), "Sign In" button
// On submit: calls signIn(email, password) from useAuth
// On success: navigate to the `from` location (the page the user originally requested),
//             defaulting to `/` if no redirect was stored
//             Use: const location = useLocation(); location.state?.from || '/'
// On error: show inline error message (e.g. "Incorrect email or password")
// Loading state: disable button + show spinner while sign-in is in progress
// No "Forgot password" link — admin resets passwords directly in Firebase Console
```

**Add route in App.jsx:**
```jsx
<Route path="/login" element={<LoginPage />} />
```
Place before all protected routes.

**Implements:** Login UI

---

## Phase 2: Route Protection

### Task 2.1: Create RequireAuth component — NOT STARTED

**File:** `show-controller/src/components/RequireAuth.jsx` (new file)

**Change:** Create a wrapper component that guards protected routes:

```jsx
// import { useAuth } from '../context/AuthContext'
// import { Navigate, useLocation } from 'react-router-dom'
//
// function RequireAuth({ children }) {
//   const { user, loading } = useAuth()
//   const location = useLocation()
//
//   if (loading) return <div>Loading...</div>   // brief flash while Firebase resolves session
//   if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />
//   return children
// }
```

**Implements:** Auth guard for protected routes

---

### Task 2.2: Wrap coordinator routes in App.jsx — NOT STARTED

**File:** `show-controller/src/App.jsx`

**Change:** Wrap all coordinator-facing routes with `<RequireAuth>`. Public routes (`/login`, `/book/:token`,
`/survey/:year`, `/:compId/talent`) are NOT wrapped.

```jsx
// Pattern — wrap each protected route or group:
<Route path="/" element={<RequireAuth><HomePage /></RequireAuth>} />
<Route path="/talent" element={<RequireAuth><TalentPage /></RequireAuth>} />
// ... repeat for all protected routes (see PRD routes table)

// Leave unwrapped:
<Route path="/login" element={<LoginPage />} />
<Route path="/book/:token" element={<BookingPage />} />
<Route path="/survey/:year" element={<SurveyPage />} />
```

**IMPORTANT:** The `/:compId/talent` route (TalentView) is public — talent open this URL without a login.
All other `/:compId/*` routes (producer, graphics, obs-manager, commentary, rundown, checklist) ARE protected.
Since these are nested under `/:compId`, wrap the parent `CompetitionLayout` but carve out the `talent` child:

```jsx
// Wrap CompetitionLayout at the parent level,
// but the /talent child route must remain public.
// Simplest approach: wrap individual child routes rather than the parent,
// OR keep CompetitionLayout unwrapped and add RequireAuth inside it
// (checking useAuth and redirecting if needed), skipping the check for the talent path.
// Read CompetitionLayout.jsx before deciding which approach fits better.
```

**Implements:** All coordinator routes protected, public routes unchanged

---

## Phase 3: Sign-Out UI

### Task 3.1: Add sign-out button to HomePage — NOT STARTED

**File:** `show-controller/src/pages/HomePage.jsx`

**Change:** Add a "Sign Out" button to the page header (top-right corner or alongside existing header controls):

```jsx
// import { useAuth } from '../context/AuthContext'
// const { user, signOut } = useAuth()
//
// Show: small "Sign Out" button and user's email (or just the button)
// On click: call signOut(), then navigate to '/login'
// Read HomePage.jsx first to find the right place to insert without disrupting existing layout
```

**Implements:** Sign-out capability

---

## Phase 3-Deploy: Build, Deploy, Verify

### Task 3-D.1: Build, deploy, and verify auth — NOT STARTED

**IMPORTANT: Before deploying, confirm Firebase Auth is enabled and at least one user account exists.**
If no accounts exist in Firebase Console → Authentication → Users, the app will lock everyone out.

**Frontend changed?** Yes (new files + App.jsx changes)
```bash
cd show-controller && npm run build
# upload dist per CLAUDE.md Step 1
```

**Server changed?** No — auth is entirely client-side (Firebase Auth SDK)

**Verify:**
- [ ] Navigate to `https://commentarygraphic.com/` — redirects to `/login`
- [ ] Log in with a valid coordinator account — redirects to `/`
- [ ] Page refresh — stays logged in (session persists)
- [ ] Click "Sign Out" — redirects to `/login`
- [ ] Navigate to `https://commentarygraphic.com/book/test-invalid` — loads without login prompt
- [ ] Navigate to `https://commentarygraphic.com/survey/2027` — loads without login prompt
- [ ] Take screenshot → `docs/PRD-Auth-Login/screenshots/verify-login-page.png`
- [ ] Take screenshot → `docs/PRD-Auth-Login/screenshots/verify-protected-redirect.png`
- [ ] Take screenshot → `docs/PRD-Auth-Login/screenshots/verify-public-booking.png`
