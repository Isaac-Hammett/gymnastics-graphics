# PRD: Sponsor Management & Display System

**Version:** 1.0
**Date:** 2026-02-13
**Status:** Not Started
**Last Updated:** 2026-02-13

---

## 1. Problem Statement

The production system has no centralized way to manage or display sponsors during broadcasts:

1. **No sponsor database** — Sponsors are not tracked per-team in Firebase
2. **No management UI** — The Media Manager has no interface for adding/editing sponsor logos
3. **No broadcast graphics** — There are no overlay graphics to display sponsors to viewers (thank-you grid, cycling full-screen, or persistent corner bug)

A separate per-segment sponsor system exists in the Rundown Editor (sponsor name/logo/tier per segment + SponsorFulfillmentModal), but this is for segment-level tracking — not for broadcast-facing sponsor graphics.

---

## 2. Goals

| Goal | Description |
|------|-------------|
| **Per-Team Sponsor Database** | Store sponsor logos/names/tiers per team in Firebase, managed via Media Manager |
| **Media Manager UI** | Inline sponsor management under each team's expandable card (add, edit, reorder, delete) |
| **Three Overlay Graphics** | Thank-you grid, cycling full-screen, and persistent corner bug for OBS |
| **URL Generator Integration** | Sponsor graphics appear in URL Generator sidebar with correct preview URLs |

---

## 3. User Stories

### Validation Summary

| Story | Description | Status | Blocker |
|-------|-------------|--------|---------|
| 1 | Producer Manages Team Sponsors | Not Started | — |
| 2 | Producer Generates Sponsor Thank-You Graphic | Not Started | — |
| 3 | Producer Generates Cycling Sponsor Graphic | Not Started | — |
| 4 | Producer Uses Persistent Sponsor Bug | Not Started | — |
| 5 | Producer Previews Sponsor Graphics | Not Started | — |

---

### Story 1: Producer Manages Team Sponsors in Media Manager

**As a** Producer setting up a broadcast for UCLA vs Oregon
**I want to** add sponsor logos and names for each team
**So that** I can display them during the broadcast

**Flow:**
1. Navigate to Media Manager
2. Expand a team card (e.g., "UCLA Women's")
3. See roster section (existing) and new Sponsors section below it
4. Click "Add Sponsor" — enter name, paste logo URL, select tier (presenting/official/supporting)
5. Sponsor appears in list with thumbnail, name, tier badge, and reorder/delete controls
6. Reorder sponsors with up/down arrows
7. Sponsor count badge appears on team card header ("3 Spons" or "No Spons")

**Acceptance Criteria:**
- [ ] SponsorsView component renders below RosterView in expanded team cards
- [ ] Can add a sponsor with name, logo URL, and tier
- [ ] Duplicate name detection prevents silent overwrites
- [ ] Logo URL preview shows 48x48 thumbnail (broken image shows warning but doesn't block save)
- [ ] Can reorder sponsors with up/down arrows
- [ ] Can delete sponsors (no confirmation, consistent with existing patterns)
- [ ] Sponsor count badge appears on team card header
- [ ] Data persists in Firebase at `teamsDatabase/sponsors/{team-key}/{sponsor-key}`

**Status:** Not Started

---

### Story 2: Producer Generates Sponsor Thank-You Graphic

**As a** Producer ending a broadcast
**I want to** display a "Thank You to Our Sponsors" grid graphic
**So that** sponsors are acknowledged on-screen

**Flow:**
1. Navigate to URL Generator
2. Select a competition with a home team that has sponsors
3. Click "Sponsor Thank You" in the new Sponsors sidebar section
4. Preview shows grid of sponsor logos with team logo in header bar
5. Copy URL for OBS browser source

**Acceptance Criteria:**
- [ ] `sponsors-thanks.html` overlay renders sponsor logos in auto-sizing CSS grid
- [ ] 1-2 sponsors = single row; 3-4 = 2x2; 5-8 = 2 rows
- [ ] Gray header bar with "THANK YOU TO OUR SPONSORS" title and team logo
- [ ] Missing/invalid sponsors param shows "No sponsors configured"
- [ ] Broken sponsor logo shows fallback with sponsor name
- [ ] URL capped at 8 sponsors to stay under 2KB URL limit

**Status:** Not Started

---

### Story 3: Producer Generates Cycling Sponsor Graphic

**As a** Producer during a broadcast
**I want to** display sponsors one at a time with crossfade transitions
**So that** each sponsor gets individual prominence

**Flow:**
1. Navigate to URL Generator
2. Select "Sponsor Cycle" in the Sponsors sidebar section
3. Preview shows single large sponsor logo cycling every 3 seconds
4. Copy URL for OBS browser source

**Acceptance Criteria:**
- [ ] `sponsors-cycle.html` overlay shows one sponsor at a time, centered, large
- [ ] 3-second hold per sponsor with 0.5s crossfade transition
- [ ] Continuous loop via `setInterval`
- [ ] 1 sponsor = static display (no cycling)
- [ ] Broken logo skips to next; all broken = text-only mode
- [ ] Gray header bar with "OUR SPONSORS" title and team logo

**Status:** Not Started

---

### Story 4: Producer Uses Persistent Sponsor Bug

**As a** Producer running a live broadcast
**I want to** show a small sponsor logo cycling in the bottom-right corner
**So that** sponsors are persistently visible without taking over the screen

**Flow:**
1. Navigate to URL Generator
2. Select "Sponsor Bug" in the Sponsors sidebar section
3. Preview shows transparent overlay with small logo in bottom-right
4. Copy URL, add as OBS browser source layered on top of live feed

**Acceptance Criteria:**
- [ ] `sponsors-bug.html` overlay is fully transparent (for OBS compositing)
- [ ] Small container bottom-right (200x80px) with semi-transparent dark pill background
- [ ] 10-second hold per sponsor with 0.8s fade transition
- [ ] Continuous loop
- [ ] 1 sponsor = static display
- [ ] Missing/empty sponsors = fully transparent page (renders nothing)
- [ ] Broken logos skip; all broken = hide container entirely

**Status:** Not Started

---

### Story 5: Producer Previews Sponsor Graphics in Graphics Manager

**As a** Producer testing graphics before a broadcast
**I want to** preview sponsor graphics in the Graphics Manager
**So that** I can verify they look correct before going live

**Flow:**
1. Navigate to Graphics Manager
2. See "Sponsors" category in the sidebar
3. Click any sponsor graphic
4. Preview renders with dummy sponsor data

**Acceptance Criteria:**
- [ ] "Sponsors" category appears in Graphics Manager sidebar
- [ ] All 3 sponsor graphics are listed
- [ ] Preview renders with test sponsor data (not empty/broken)

**Status:** Not Started

---

## 4. Phase Overview

| Phase | Name | Priority | Tasks | Goal |
|-------|------|----------|-------|------|
| **A** | Data & Hook | P0 | T1 | Per-team sponsor CRUD in Firebase |
| **B** | Registry & Routing | P0 | T2, T3, T4, T5 | Graphics registry, buttons, URL builders |
| **C** | URL Generator Plumbing | P0 | T6 | Thread sponsors into URL generation |
| **D** | Media Manager UI | P1 | T7 | SponsorsView component |
| **E** | Overlay: Thank You | P1 | T8 | sponsors-thanks.html |
| **F** | Overlay: Cycle | P1 | T9 | sponsors-cycle.html |
| **G** | Overlay: Bug | P1 | T10 | sponsors-bug.html |
| **H** | Build & Deploy | P0 | T11, T12 | Production verification |

---

## 5. Success Criteria

### Phase A Complete When:
- [ ] `saveSponsor(teamKey, sponsorKey, data)` writes to `teamsDatabase/sponsors/{teamKey}/{sponsorKey}`
- [ ] `deleteSponsor(teamKey, sponsorKey)` removes the correct path
- [ ] `reorderSponsors(teamKey, orderedKeys)` updates order values
- [ ] `getTeamSponsors(teamKey)` returns sorted array
- [ ] `getTeamSponsorCount(teamKey)` returns count

### Phase B Complete When:
- [ ] Three entries in graphicsRegistry.js under `sponsors` category
- [ ] `sponsors` key in graphicButtons.js (numbers 30+)
- [ ] Three builder functions in urlBuilder.js
- [ ] `sponsors` in CATEGORY_LABELS in GraphicsManagerPage.jsx

### Phase C Complete When:
- [ ] Sponsors sidebar section in URL Generator
- [ ] `useTeamsDatabase` imported and connected
- [ ] Home team sponsors resolved via `resolveSchoolKey`
- [ ] Sponsors JSON threaded through `options.sponsors`

### Phase D Complete When:
- [ ] SponsorsView renders below RosterView in expanded team cards
- [ ] Add/reorder/delete sponsors works
- [ ] Sponsor count badge on team card headers

### Phases E-G Complete When:
- [ ] All three overlay HTML files render correctly with test params
- [ ] Error handling covers all edge cases (missing data, broken images, empty arrays)
- [ ] Overlays follow existing conventions (1920x1080, Inter font, URL params)

### Phase H Complete When:
- [ ] `npm run build` succeeds with no errors
- [ ] SPA deployed to commentarygraphic.com
- [ ] Three overlay files deployed to `/overlays/sponsors-*.html`
- [ ] Overlay URLs serve overlay content (not React SPA)
- [ ] OBS browser source test passes for sponsors-bug.html (transparency works)

---

## 6. Terminology

| Term | Definition |
|------|------------|
| **Sponsor** | A brand/company associated with a team, with logo and tier |
| **Tier** | `presenting`, `official`, or `supporting` — metadata only, does not affect display sizing |
| **Sponsor Key** | Auto-slugified from sponsor name (e.g., "State Farm Insurance!" → "state-farm-insurance") |
| **Team Key** | Firebase key for a team (e.g., "cal-womens", "army-mens") |
| **Bug Overlay** | Small persistent graphic composited in OBS corner (transparent background) |
| **Sponsor Cycle** | Full-screen graphic showing one sponsor at a time with crossfade transitions |
| **Sponsor Thank You** | Full-screen grid showing all sponsors simultaneously |

---

## 7. Out of Scope (Deferred)

| Item | Reason |
|------|--------|
| Rundown Editor integration | Separate per-segment sponsor system exists; unification deferred |
| Sponsor logo upload to Firebase Storage | Paste-a-URL is sufficient for now |
| Sponsor analytics/reporting | Not needed for initial launch |
| Per-event sponsors (vs per-team) | Teams have consistent sponsors across events |

---

## 8. Related Documents

| Document | Purpose |
|----------|---------|
| [PLAN-Sponsor-System-2026-02-13.md](./PLAN-Sponsor-System-2026-02-13.md) | Technical architecture, data model, implementation specs |
| [PLAN-Sponsor-System-Implementation.md](./PLAN-Sponsor-System-Implementation.md) | Task tracking, progress status |
| [promptv3-Sponsor-System.md](./promptv3-Sponsor-System.md) | Optimized workflow for autonomous iteration loop |
