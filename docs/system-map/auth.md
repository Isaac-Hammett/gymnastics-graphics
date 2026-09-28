# Auth

> Detailed entry from the 2026-09-10 system survey. The map that ties these together is [SYSTEM-OVERVIEW.md](../../SYSTEM-OVERVIEW.md). Status, evidence, and line numbers reflect the code and the live Firebase contents on that date; PRD `Status:` fields were deliberately not used as evidence.

**Layer:** Platform and infrastructure
**Purpose:** Gates the coordinator SPA behind Firebase email/password login so only the small production team can reach talent contacts, show controls, and VM management, while talent-facing links stay open.
**Status:** **Partial** — the browser tier is complete and was deployed: `show-controller/src/main.jsx` wraps `<App/>` in `AuthProvider`, `show-controller/src/App.jsx` wraps 16 coordinator routes in `<RequireAuth>`, and `show-controller/src/components/CompetitionLayout.jsx:96` guards every `/:compId/*` route (only `/:compId/talent` is exempted, at line 92). But enforcement is client-side only: `server/index.js` (8730 lines, 82 HTTP routes, `io` at line 84 with `cors: { origin: "*" }`) contains **zero** matches for `verifyIdToken`, `authorization`, `Bearer`, `requireAuth`, `jsonwebtoken`, `express-session`, or `io.use(` — the sole middleware stack is `app.use(cors())` / `express.json()` / `express.static()` at `server/index.js:1859-1873`. No `database.rules.json`, `firebase.json`, or `.firebaserc` exists anywhere in the repo, so RTDB rules are not version-controlled; the only rules documented (`DEPLOYMENT.md:141-155`) are `"competitions": { ".read": true, ".write": true }` with the comment "For production, consider authentication." Sub-part at a different level: the SPA route guard itself is effectively **Built/verified** — 10 Playwright screenshots in `docs/PRD-Auth-Login/screenshots/` were captured against the live domain on 2026-03-11.
**Sport coupling:** **Generic** — no apparatus, rotation, scoring, or Virtius/RTN concept appears in any auth file; it is plain Firebase email/password.
**Key files:**
- `show-controller/src/lib/firebase.js` (20 lines) — **client config hard-coded in source**, no `import.meta.env` / `VITE_` indirection; exports `auth` + `db`
- `show-controller/src/context/AuthContext.jsx` (39 lines) — `onAuthStateChanged` provider, `signIn`/`signOut`, `{user, loading}`
- `show-controller/src/pages/LoginPage.jsx` (130 lines) — email/password form, error mapping, redirect to `location.state.from`
- `show-controller/src/components/RequireAuth.jsx` (92 lines) — redirect guard + fixed sign-out chip showing `user.email`
- `show-controller/src/components/CompetitionLayout.jsx` (104 lines) — second, independent guard for `/:compId/*`; exempts `/talent`
- `show-controller/src/App.jsx` (149 lines) — route table; public vs. protected split
- `show-controller/src/main.jsx` (13 lines) — mounts `AuthProvider`
- `show-controller/src/pages/BookingPage.jsx` (344 lines) — public route that reads/writes RTDB while signed out
- `show-controller/src/pages/SurveyPage.jsx` (353 lines) — public route that pushes RTDB while signed out
- `server/index.js` (8730 lines) — coordinator; no auth of any kind

**Firebase paths written:** none — the auth system itself persists nothing to RTDB (identity lives in Firebase Auth). For contrast, the *unauthenticated* public routes write `bookingTokens/{token}`, `competitions/{compId}/commentary/{talentId}`, `talentRoster/{talentId}/interested`, `surveyResponses/{year}` (`BookingPage.jsx:84,90,152,155`; `SurveyPage.jsx:111`).
**Firebase paths read:** none by auth itself. Public unauthenticated reads: `bookingTokens/{token}`, `competitions` (full list), `competitions/{compId}/config`, `talentRoster/{talentId}` (`BookingPage.jsx:35,60,66,110`; `SurveyPage.jsx:41`).
**Socket events:** `emits:` `identity` `{role}` to each socket once its role resolves; `shakespeare:*` only through `emitShakespeare()` to room `competition:{compId}:verified` / `listens:` none. Socket identity (ISA2-331, `server/lib/socketIdentity.js`): the SPA sends a Firebase ID token in `handshake.auth.token` (`ShowContext.jsx`); the coordinator verifies it with `admin.auth().verifyIdToken` and sets `socket.data.role` to `talent` (confirmed assignment in `competitions/{compId}/commentary` whose `talentRoster/{id}/email` matches), `producer` (any other valid account), `renderer` (no token, `clientType: 'renderer'`), or `anonymous`. Resolution is not awaited, so handlers register first; no existing handler checks the role.
**HTTP routes:** none — the coordinator exposes no login, token-exchange, or session endpoint; all 82 routes are open.
**External services:**
- Firebase Authentication (email/password provider) — the only identity store; accounts created by hand in the Firebase Console (`docs/PRD-Auth-Login/PRD-Auth-Login-2026-03-11.md:23-27`, no self-serve signup or invite flow in code)

**Depends on:** none — no canonical system is a dependency; it is a leaf.
**Used by:**
- Home page — direct import (`RequireAuth` in `App.jsx:80`) — gates `/`
- Competition workspace — direct import (`CompetitionLayout.jsx:96`) — gates `/:compId/producer|graphics|obs-manager|commentary|rundown|checklist|camera-setup`
- Producer View — via Competition workspace guard
- Talent View — **explicitly NOT gated** (`CompetitionLayout.jsx:92`)
- Settings — direct import (`App.jsx:113`)
- Commentary talent CRM — direct import (`App.jsx:108-110`) — gates `/talent`, `/talent/discover`, `/talent/:talentId`
- VM pool — direct import (`App.jsx:97-104`) — gates `/_admin/vm-pool` (also wrapped in `CoordinatorGate`)
- Themes / Graphics rendering / Clip playout tooling — direct import (`App.jsx:88-94`) — gates `/controller`, `/theme-editor`, `/graphics-manager`, `/media-manager`, `/url-generator`, `/background-generator`, `/import`

**UI surfaces:**
- Login form — `show-controller/src/pages/LoginPage.jsx`
- Floating sign-out chip on every protected page — `show-controller/src/components/RequireAuth.jsx:52-88`

**Known gaps:**
- The coordinator server is unauthenticated apart from socket identity (ISA2-331), which only gates `shakespeare:*` emits. All 82 HTTP routes and ~176 socket events (including VM start/stop, OBS control, stream-key handling, Anthropic-backed AI routes) accept any caller; `io` is created with `cors.origin: "*"` (`server/index.js:84-87`).
- No RTDB security rules in the repo. Nothing to review, diff, or deploy — the only boundary that could exist is unversioned console state.
- The PRD's own acceptance criterion "Firebase rules for `talentRoster` and `surveyResponses` rely on `auth != null` (already set)" (`PRD-Auth-Login-2026-03-11.md:49`) **contradicts the code**: `SurveyPage.jsx:111` pushes to `surveyResponses/{year}` and `BookingPage.jsx:152` updates `talentRoster/{talentId}/interested`, both while signed out (no `signInAnonymously` anywhere in the repo). Either those rules are not auth-gated or the two public pages are broken.
- Firebase web config is hard-coded in `firebase.js:5-13` rather than injected — the shipped bundle hands any visitor the `databaseURL`, so RTDB rules are the only real perimeter.
- Public routes leak the competition catalog: `BookingPage.jsx:110` and `SurveyPage.jsx:41` each read the entire `competitions` node unauthenticated.
- No roles, no allowlist enforcement in code, no per-user audit trail. `useAuth()` is consumed in exactly 3 places (`CompetitionLayout`, `RequireAuth`, `LoginPage`); `user.uid`/`user.email` is never recorded on any write.
- `/:compId/talent` exemption is a string check (`location.pathname.endsWith('/talent')`), which also matches the protected top-level CRM path shape if routing ever changes.

**Evidence of live use:**
- `docs/PRD-Auth-Login/screenshots/` — 10 Playwright captures incl. `final-verify-unauthenticated-redirect.png`, `final-verify-sign-out.png`, `final-verify-booking-public.png`, `final-verify-talent-public.png`, taken against `commentarygraphic.com` (production domain named in `PRD-Auth-Login-2026-03-11.md:91`)
- Commits `f71fa792`, `0db390c4`, `d5c13784`, `6664bbf7` (PRD-Auth-Login Tasks 1.2 → 3.1), and `docs/PRD-Auth-Login/logs/summary.log` showing 9 build iterations on 2026-03-11
- `docs/PRD-Auth-Login/implementation-plan.md:13-18` records both Phase-Deploy tasks as executed against production
- No evidence any producer authenticated during a broadcast; nothing in `docs/WCGNIC-2026/` or `docs/PRD-Graphics-Audit-ECAC/` mentions login

**PRDs / docs:**
- `docs/PRD-Auth-Login/PRD-Auth-Login-2026-03-11.md`
- `docs/PRD-Auth-Login/implementation-plan.md`
- `docs/PRD-Auth-Login/prompt-Auth-Login-Playwright-Fix.md` (documents that every future Playwright verification must log in first)
- `DEPLOYMENT.md:141-155` (open RTDB rules)
- `SYSTEM-OVERVIEW.md:198-202` ("Consider adding: Firebase Authentication / Database security rules")
