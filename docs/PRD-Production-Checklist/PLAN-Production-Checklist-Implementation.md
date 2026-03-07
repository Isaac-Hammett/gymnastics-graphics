# Implementation Plan: Production Checklist System

**PRD:** [PRD-Production-Checklist-2026-01-24.md](./PRD-Production-Checklist-2026-01-24.md)
**Technical Plan:** [PLAN-Production-Checklist-2026-01-24.md](./PLAN-Production-Checklist-2026-01-24.md)
**Items Definition:** [checklist-items-definition.md](./checklist-items-definition.md)
**Status:** IN PROGRESS
**Created:** 2026-01-24
**Last Updated:** 2026-03-07 (Tasks 1-11 complete)

---

## Changelog (2026-03-07)

- **CRITICAL FIX:** Corrected rundown segments path in Task 2 and Task 12 (was `production/rundown/segments/`, actual is `competitions/{compId}/rundown/segments`)
- Updated item count from 74 to 75 (added `theme-configured` auto-validator)
- Updated auto-validated count from 13 to 14
- Task 3 now includes skeleton loading states (moved from Task 28)
- Task 4 now includes error boundary wrapper
- Task 8 now writes `lastUpdated` timestamp on toggle and note changes
- Task 9 now includes `theme-configured` validator
- Task 12 path corrected to `competitions/{compId}/rundown/segments`
- Task 15 fix links updated: added `socket-connected` → `/_admin/vm-pool`, `vm-online` → `/_admin/vm-pool`
- Task 21 clarified: contact auto-assist (visual hint on manual items), NOT auto-validation
- Relaxed Phase 1A→1B dependency: Tasks 1 and 9 can be built in parallel
- Task 28 changed from skeleton loading (moved to Task 3) to error boundary polish

### Previous (2026-03-06)

- Updated item count from ~72 to 74
- Task 1 now references `checklist-items-definition.md`
- Task 8 specifies `react-hot-toast` dependency
- Tasks 9-10 updated: validators must handle N teams dynamically
- Task 11 updated: `checkVmStatus()` is standalone async function
- Task 13 updated: clarified polling approach
- Task 15 updated: corrected fix link paths
- Task 17 updated: contacts panel must handle N teams
- Task 23 updated: changed from CompetitionSelector to HomePage cards
- Added Task 25: Add checklist link to ProducerView sidebar
- Removed `checkedBy` from Task 8 data writes

---

## Overview

This implementation plan covers all phases of the Production Checklist System. Phase 1 (MVP) implements the core checklist with auto-validation and team contacts. Phase 2 adds template customization. Phase 3 adds site evaluations with camera config integration.

---

## IMPORTANT: Task Execution Rules

**ONE TASK = ONE ITERATION** (with exceptions for trivial tasks)

Each row in the task tables below is ONE task. Complete exactly ONE task per iteration:

1. Pick the first NOT STARTED or IN PROGRESS task
2. Implement that ONE task
3. Commit, deploy, verify
4. STOP - the next iteration will handle the next task

**Exception — trivial tasks can be batched:** Single-line changes like "Add route to App.jsx" (Task 4), "Add icon to header" (Task 24), or "Add link to sidebar" (Task 25) can be combined with adjacent tasks when they share no logic complexity. Use judgment — if two tasks together take < 20 lines of code, batch them.

**Do NOT:**
- Complete an entire phase in one iteration
- Skip verification after implementing

---

## Phase Summary

| Phase | Name | Priority | Status | Tasks |
|-------|------|----------|--------|-------|
| 1A | Core Checklist UI | P0 | IN PROGRESS | 1-8 |
| 1B | Auto-Validation | P0 | NOT STARTED | 9-16 |
| 1C | Team Contacts | P0 | NOT STARTED | 17-22 |
| 1D | Polish & Navigation | P0 | NOT STARTED | 23-30 |
| 2 | Checklist Templates | P1 | NOT STARTED | 31-38 |
| 3A | Site Evaluations | P2 | NOT STARTED | 39-46 |
| 3B | Camera Config Integration | P2 | NOT STARTED | 47-52 |

---

## Phase 1A: Core Checklist UI (P0)

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| Task 1 | Create `checklistItems.js` from items definition | COMPLETE | 75 items, 4 phases, 14 categories. Includes `getAllItems()`, `getItemById()`, `getItemCounts()` helpers. Auto-assist fields on camera-op-contact and talent-contacted items. |
| Task 2 | Create `useProductionChecklist` hook (basic structure) | COMPLETE | State management, Firebase subscription to `competitions/{compId}/checklist`. Subscribe to `competitions/{compId}/rundown/segments` (NOT `production/rundown/segments/`). Returns: phases, summary, contacts, teamKeys, toggleItem, updateNote, updateContact, deleteContact, refresh, loading, lastUpdated. Validators return 'pending' placeholder until Task 9. |
| Task 3 | Create `ChecklistPage.jsx` with basic layout + skeleton loading | COMPLETE | Header, progress bar, phase tabs, categories, items all in one page component. Skeleton loading states included (animate-pulse). Progress bar shows complete/warnings/errors/pending. Categories are collapsible. |
| Task 4 | Add route `/{compId}/checklist` to App.jsx with error boundary | COMPLETE | Added ErrorBoundary.jsx component, route inside CompetitionLayout with error boundary wrapper. |
| Task 5 | Create `ChecklistProgress.jsx` component | COMPLETE (merged into Task 3) | Built inline in ChecklistPage.jsx. |
| Task 6 | Create `ChecklistCategory.jsx` component | COMPLETE (merged into Task 3) | Built inline in ChecklistPage.jsx. |
| Task 7 | Create `ChecklistItem.jsx` component | COMPLETE (merged into Task 3) | Built inline in ChecklistPage.jsx. |
| Task 8 | Wire manual item toggle to Firebase with rollback | COMPLETE | Installed `react-hot-toast`, added `<Toaster />` to App.jsx with dark theme styling. Optimistic update with rollback on error. Toast shows on failure. lastUpdated timestamp written on each toggle. |

---

## Phase 1B: Auto-Validation (P0)

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| Task 9 | Create `checklistValidators.js` with config validators | COMPLETE | `event-name`, `meet-date`, `venue-configured`, `teams-configured`, `theme-configured`. Teams validator uses `getTeamCount(compType)` to check N teams dynamically. Theme uses warning (not error) when missing. Includes `runValidator()` and `runAllValidators()` helpers. |
| Task 10 | Add team data validators | COMPLETE | `rosters-loaded`, `headshots-uploaded`. Checks N teams dynamically using `getTeamCount()`. Uses 80% threshold for headshots, warning status for missing rosters. |
| Task 11 | Add infrastructure validators | COMPLETE | `vm-assigned`, `vm-online`, `socket-connected`, `obs-connected`. VM status uses polling from useProductionChecklist hook. Socket/OBS use context values. Custom VMs show offline. |
| Task 12 | Add rundown validators | NOT STARTED | `rundown-created`, `segments-named`, `graphics-assigned`. Read from `competitions/{compId}/rundown/segments` (**NOT** `production/rundown/segments/` — that path is analytics only). |
| Task 13 | Add VM status polling (30s interval) | NOT STARTED | Call `await checkVmStatus(vmAddress)` in a `useEffect` with `setInterval(30000)`. Clean up on unmount. |
| Task 14 | Add real-time status updates | NOT STARTED | Firebase `onValue` subscriptions update validators automatically. Context values (connected, obsConnected) trigger recompute via `useMemo` deps. |
| Task 15 | Add "Fix" links to auto-validated items | NOT STARTED | Links: config items → `/`, theme → `/themes`, rosters/headshots → `/media-manager`, VM/socket → `/_admin/vm-pool`, rundown → `/{compId}/rundown`, OBS → `/{compId}/obs-manager`. See Tech Plan Section 7.3 for full table. |
| Task 16 | Add notes field per item | NOT STARTED | Expandable text input below item. Firebase persist to `competitions/{compId}/checklist/notes/{itemId}`. |

---

## Phase 1C: Team Contacts (P0)

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| Task 17 | Create `TeamContactsPanel.jsx` component | NOT STARTED | Panel with tabs for ALL teams in competition (N teams, not just 2). Use `buildTeamKey()` from `competitionUtils.js` to derive team keys. |
| Task 18 | Add contact display (name, role, phone, email) | NOT STARTED | Click-to-call (`tel:`), click-to-email (`mailto:`) links |
| Task 19 | Add contact edit modal | NOT STARTED | Add/edit contact form with name, role, phone, email, notes fields |
| Task 20 | Wire contacts to Firebase `teamsDatabase/contacts/{team-key}` | NOT STARTED | CRUD operations. Team key format: `buildTeamKey(school, gender)` e.g. "west-chester-womens" |
| Task 21 | Add contact auto-assist hints to manual items | NOT STARTED | Camera op contact exists → show "auto-checked" hint on `camera-op-contact` item. **This is NOT auto-validation** — item stays `type: manual`, checkbox stays interactive. See Tech Plan Section 7.2 for details. |
| Task 22 | Add contact roles dropdown | NOT STARTED | Standard roles: head-coach, assistant-coach, sid, camera-op-primary, camera-op-backup, venue-operations, scoring-operations |

---

## Phase 1D: Polish & Navigation (P0)

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| Task 23 | Add checklist link to HomePage competition cards | NOT STARTED | "Checklist" button alongside existing Producer/Talent/etc. links |
| Task 24 | Add checklist icon to CompetitionHeader | NOT STARTED | ClipboardDocumentCheckIcon link to `/{compId}/checklist` |
| Task 25 | Add checklist link to ProducerView sidebar | NOT STARTED | Prominent link — producers spend most time here |
| Task 26 | Add phase completion indicators to tabs | NOT STARTED | ✓ complete, ◐ partial, ○ empty |
| Task 27 | Add "Last updated" timestamp display | NOT STARTED | Show when checklist was last modified |
| Task 28 | Polish error boundary + empty states | NOT STARTED | Error boundary fallback UI (moved from App.jsx wrapper). Empty state for each phase when no items match. Skeleton loading already built into Task 3. |
| Task 29 | Add keyboard accessibility | NOT STARTED | Tab navigation, Space to toggle, Enter for buttons, visible focus indicators |
| Task 30 | Ensure responsive design | NOT STARTED | Desktop: 2-col. Tablet: contacts drawer. Mobile: single col. Min 44x44px touch targets. |

---

## Phase 2: Checklist Templates (P1)

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| Task 31 | Create template data model in Firebase | NOT STARTED | `checklistTemplates/{template-id}` |
| Task 32 | Create default templates (dual, tri, quad, championship) | NOT STARTED | Seed Firebase with standard templates |
| Task 33 | Add template selector to competition creation | NOT STARTED | Suggest based on compType |
| Task 34 | Create `TemplateEditorPage.jsx` | NOT STARTED | Admin page for template editing |
| Task 35 | Add/remove items in template editor | NOT STARTED | CRUD for template items |
| Task 36 | Add/remove categories in template editor | NOT STARTED | CRUD for template categories |
| Task 37 | Clone template functionality | NOT STARTED | Duplicate template for customization |
| Task 38 | Apply template to existing competition | NOT STARTED | Merge template items with existing |

---

## Phase 3A: Site Evaluations (P2)

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| Task 39 | Create venue data model in Firebase | NOT STARTED | `teamsDatabase/venues/{venue-key}` |
| Task 40 | Create `SiteEvaluationPage.jsx` | NOT STARTED | View/edit venue info |
| Task 41 | Add basic venue info form | NOT STARTED | Name, address, capacity |
| Task 42 | Add internet specs section | NOT STARTED | Type, SSID, speed, notes |
| Task 43 | Add camera positions CRUD | NOT STARTED | Position name, apparatus, location, angle |
| Task 44 | Add image upload for camera positions | NOT STARTED | Upload to storage, link to position |
| Task 45 | Add venue images gallery | NOT STARTED | Overview, 360, equipment photos |
| Task 46 | Add known issues list | NOT STARTED | Lessons learned, warnings |

---

## Phase 3B: Camera Config Integration (P2)

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| Task 47 | Link competition to venue | NOT STARTED | Venue selector in competition config |
| Task 48 | Pre-populate camera config from venue | NOT STARTED | On competition create, suggest cameras |
| Task 49 | Show venue info in checklist | NOT STARTED | Site eval summary panel |
| Task 50 | Auto-validate site eval checklist items | NOT STARTED | Site eval exists → items complete |
| Task 51 | Add "View Site Eval" link from checklist | NOT STARTED | Navigate to venue page |
| Task 52 | Export camera config from site eval | NOT STARTED | Generate JSON for camera-setup page |

---

## Detailed Task Specifications

### Task 1: Create `checklistItems.js`

**File:** `show-controller/src/lib/checklistItems.js`

**Description:**
Implement the checklist data structure from `checklist-items-definition.md`. All 75 items are pre-defined — this task is translating the definition into a JS module.

**Structure:**
```javascript
export const CHECKLIST_PHASES = [
  {
    id: 'setup',
    name: 'Setup (5+ Days Out)',
    shortName: 'Setup',
    categories: [
      {
        id: 'competition-config',
        name: 'Competition Config',
        items: [
          { id: 'event-name', name: 'Event name configured', autoValidate: true, validator: 'event-name', fixLink: '/' },
          { id: 'meet-date', name: 'Meet date configured', autoValidate: true, validator: 'meet-date', fixLink: '/' },
          // ... all items from checklist-items-definition.md
        ]
      },
      // ... more categories
    ]
  },
  // ... more phases
];
```

**Reference:** [checklist-items-definition.md](./checklist-items-definition.md) — 75 items, 4 phases, 14 categories.

---

### Task 2: Create `useProductionChecklist` hook

**File:** `show-controller/src/hooks/useProductionChecklist.js`

**Description:**
Create the main hook for checklist state management. See Technical Plan Section 3.3 for full interface.

**Key details:**
- Subscribe to `competitions/{compId}/checklist` for manual item state
- Subscribe to `competitions/{compId}/rundown/segments` for rundown validators (**NOT** `production/rundown/segments/` — that's analytics only)
- Import `checkVmStatus` from `useCompetitions.js` (standalone async function)
- Use `useCompetition()`, `useShow()`, `useOBS()` for context values

**Returns:**
```javascript
{
  phases,           // Computed phases with status
  summary,          // { total, complete, warnings, errors, percentage }
  contacts,         // Team contacts from Firebase
  toggleItem,       // (itemId) => Promise<void>
  updateNote,       // (itemId, note) => Promise<void>
  updateContact,    // (teamKey, contactId, data) => Promise<void>
  refresh,          // () => void
  loading           // boolean
}
```

---

### Task 3: Create `ChecklistPage.jsx`

**File:** `show-controller/src/pages/ChecklistPage.jsx`

**Layout:**
- CompetitionHeader (reuse existing)
- Progress section (ChecklistProgress)
- Phase tabs: "Setup", "Pre-Prod", "2hr Before", "1hr Before"
- Two-column layout:
  - Left: Checklist categories (scrollable)
  - Right: Team contacts panel

---

### Task 8: Wire manual item toggle with rollback

**Prerequisites:** Install `react-hot-toast` (`npm install react-hot-toast`), add `<Toaster />` to App.jsx.

**Behavior:**
1. User clicks checkbox → immediately update local state (optimistic)
2. Write to Firebase: `{ checked: boolean, checkedAt: ISO string }` (no `checkedBy`)
3. On success: state already reflects change
4. On failure: revert local state, show `toast.error()`

---

### Task 17: Create `TeamContactsPanel.jsx`

**File:** `show-controller/src/components/TeamContactsPanel.jsx`

**Key change from v1.0:** Must handle **N teams** (1-7), not just 2. Build team tabs dynamically using `getTeamCount(compType)` and `buildTeamKey(school, gender)` from `competitionUtils.js`.

**Features:**
- Team tabs (dynamic count based on competition type)
- Contact list with role icons
- Click-to-call (tel:) and click-to-email (mailto:)
- Add/Edit contact button → modal form

**Contact Roles:**
- head-coach, assistant-coach, sid, camera-op-primary, camera-op-backup, venue-operations, scoring-operations

---

## Verification Checklist

### Phase 1 Complete When:
- [ ] Checklist page loads at `/{compId}/checklist`
- [ ] All 4 phases visible with 75 items
- [ ] 14 auto-validated items show real-time status
- [ ] 61 manual items can be toggled with optimistic updates
- [ ] State persists to Firebase with error rollback
- [ ] Notes can be added/edited per item
- [ ] Team contacts panel handles N teams (tested with dual + 4-team comp)
- [ ] Contacts persist at `teamsDatabase/contacts/{team-key}`
- [ ] Checklist link on HomePage cards, CompetitionHeader, and ProducerView sidebar
- [ ] Skeleton loading states display during initial load
- [ ] Fully keyboard accessible (tab, space, enter)
- [ ] Responsive design works on tablet (768px+) and mobile

### Phase 2 Complete When:
- [ ] Templates stored in Firebase
- [ ] Template editor UI works
- [ ] Templates suggested on competition creation
- [ ] Custom templates can be created/edited

### Phase 3 Complete When:
- [ ] Site evaluations stored in Firebase
- [ ] Venue editor UI works
- [ ] Camera positions with photos stored
- [ ] Camera config pre-populated from site eval

---

## Notes

### MVP Scope
The MVP includes 75 curated checklist items (14 auto-validated, 61 manual). Items are defined in `checklist-items-definition.md`. The full 130+ item original spreadsheet is available in the PRD folder for reference.

### Dependencies
- Phase 1A must complete before 1C and 1D
- **Exception:** Tasks 1 (checklistItems.js) and 9 (checklistValidators.js) have no import dependency and can be built in parallel
- Phase 1 must complete before Phase 2 or 3
- Phase 3A must complete before 3B
- `react-hot-toast` must be installed in Task 8 (used by all subsequent tasks)

### Design Considerations
- **Responsive:** Must work on tablets for on-site producers
- **Accessible:** Full keyboard navigation, proper focus indicators
- **Performance:** Optimistic updates with rollback, skeleton loading
- **N-team support:** All team-related features must handle 1-7 teams dynamically

### Key Files Reference

**Existing files to reference:**
- `show-controller/src/hooks/useCompetitions.js` — `checkVmStatus()` standalone function
- `show-controller/src/lib/competitionUtils.js` — `buildTeamKey()`, `getTeamCount()`, `getGenderFromCompType()`
- `show-controller/src/lib/graphicButtons.js` — `teamCounts` mapping
- `show-controller/src/context/CompetitionContext.jsx` — competition config pattern
- `show-controller/src/context/ShowContext.jsx` — `connected` state
- `show-controller/src/context/OBSContext.jsx` — `obsConnected` state
- `show-controller/src/lib/firebase.js` — `db, ref, set, onValue` imports
- `show-controller/src/pages/HomePage.jsx` — competition card patterns, UI components

**New files to create:**
- `show-controller/src/lib/checklistItems.js`
- `show-controller/src/lib/checklistValidators.js`
- `show-controller/src/hooks/useProductionChecklist.js`
- `show-controller/src/pages/ChecklistPage.jsx`
- `show-controller/src/components/checklist/ChecklistProgress.jsx`
- `show-controller/src/components/checklist/ChecklistCategory.jsx`
- `show-controller/src/components/checklist/ChecklistItem.jsx`
- `show-controller/src/components/TeamContactsPanel.jsx`

**New dependency:**
- `react-hot-toast` — toast notifications for optimistic update feedback
