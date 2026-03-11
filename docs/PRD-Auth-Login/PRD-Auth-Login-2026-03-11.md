# PRD: Coordinator Login / Authentication

**Status:** NOT STARTED
**Date:** 2026-03-11
**Last Updated:** 2026-03-11

---

## Overview

The coordinator app (`commentarygraphic.com`) is currently wide open — any URL is accessible without a
password. Sensitive data (428 talent contacts, phone numbers, commentary assignments, booking tokens) is
readable by anyone who knows the URL. This PRD adds email/password login via Firebase Auth so that only
authorized coordinators can access the app.

Public-facing pages (`/book/:token`, `/survey/:year`, `/:compId/talent`) remain accessible without login —
they are used by talent and do not expose coordinator data.

---

## Auth Strategy

**Firebase Email/Password Auth.** Coordinators are a small, known team (< 10 people). The admin creates
accounts directly in the Firebase Console. No self-serve signup, no invite flow — just allowlisted accounts.

**Why not Google sign-in?** Google OAuth would allow any Google account to attempt sign-in unless we add an
email allowlist. Email/password keeps access control simple and fully in the admin's hands via Firebase Console.

---

## Phase 1 — Firebase Auth Setup

### User Stories
- As a coordinator, when I navigate to `commentarygraphic.com`, I see a login page if I'm not signed in.
- As a coordinator, I enter my email and password and click "Sign In" — I'm taken to the home page.
- As a coordinator, my session persists across browser tabs and page refreshes until I explicitly sign out.
- As a coordinator, I can sign out from a button in the app header.
- As a talent invitee, I open my booking link (`/book/:token`) without any login prompt.
- As a survey respondent, I fill out `/survey/2027` without any login prompt.

### Acceptance Criteria
- [ ] Navigating to any coordinator URL while unauthenticated redirects to `/login`
- [ ] After login, the user is redirected to the page they originally requested (not always `/`)
- [ ] Session persists on page refresh (Firebase Auth persistence is enabled)
- [ ] Sign-out button appears in the app and clears the session, redirecting to `/login`
- [ ] `/book/:token` loads without login
- [ ] `/survey/:year` loads without login
- [ ] `/:compId/talent` loads without login (talent-facing view)
- [ ] Firebase rules for `talentRoster` and `surveyResponses` rely on `auth != null` (already set)

---

## Routes: Protected vs. Public

| Route | Protected? | Reason |
|-------|------------|--------|
| `/` | Yes | Homepage with alerts + competitions |
| `/talent` | Yes | 428 contact records |
| `/talent/discover` | Yes | AI discovery tool |
| `/talent/:talentId` | Yes | Individual contact details |
| `/settings` | Yes | Batch import tool |
| `/controller` | Yes | Graphics controller |
| `/url-generator` | Yes | Internal tool |
| `/media-manager` | Yes | Internal tool |
| `/graphics-manager` | Yes | Internal tool |
| `/theme-editor` | Yes | Internal tool |
| `/background-generator` | Yes | Internal tool |
| `/import` | Yes | Internal tool |
| `/_admin/vm-pool` | Yes | VM management |
| `/_admin/setup-guide` | Yes | Internal tool |
| `/:compId/*` (all competition routes) | Yes | Show production tools |
| `/book/:token` | **No** | Talent booking response (public link) |
| `/survey/:year` | **No** | Annual talent survey (public link) |
| `/:compId/talent` | **No** | Talent-facing competition view |
| `/login` | **No** | Login page itself |

---

## Bug Catalog

No bugs cataloged yet.

---

## Playwright Audit Results

Not applicable — new feature PRD.
