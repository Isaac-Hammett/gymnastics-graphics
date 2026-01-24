# Implementation Plan: Production Checklist System

**PRD:** [PRD-Production-Checklist-2026-01-24.md](./PRD-Production-Checklist-2026-01-24.md)
**Technical Plan:** [PLAN-Production-Checklist-2026-01-24.md](./PLAN-Production-Checklist-2026-01-24.md)
**Status:** NOT STARTED
**Created:** 2026-01-24
**Last Updated:** 2026-01-24

---

## Overview

This implementation plan covers all phases of the Production Checklist System. Phase 1 (MVP) implements the core checklist with auto-validation and team contacts. Phase 2 adds template customization. Phase 3 adds site evaluations with camera config integration.

---

## IMPORTANT: Task Execution Rules

**ONE TASK = ONE ITERATION**

Each row in the task tables below is ONE task. Complete exactly ONE task per iteration:

1. Pick the first NOT STARTED or IN PROGRESS task
2. Implement that ONE task
3. Commit, deploy, verify
4. STOP - the next iteration will handle the next task

**Do NOT:**
- Complete multiple tasks in one iteration
- Batch "related" tasks together
- Complete an entire phase in one iteration

---

## Phase Summary

| Phase | Name | Priority | Status | Tasks |
|-------|------|----------|--------|-------|
| 1A | Core Checklist UI | P0 | NOT STARTED | 1-8 |
| 1B | Auto-Validation | P0 | NOT STARTED | 9-16 |
| 1C | Team Contacts | P0 | NOT STARTED | 17-22 |
| 1D | Polish & Navigation | P0 | NOT STARTED | 23-29 |
| 2 | Checklist Templates | P1 | NOT STARTED | 30-37 |
| 3A | Site Evaluations | P2 | NOT STARTED | 38-45 |
| 3B | Camera Config Integration | P2 | NOT STARTED | 46-51 |

---

## Phase 1A: Core Checklist UI (P0)

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| Task 1 | Create `checklistItems.js` with hardcoded phases and categories | NOT STARTED | Define all 4 phases, ~72 curated items |
| Task 2 | Create `useProductionChecklist` hook (basic structure) | NOT STARTED | State management, Firebase subscription |
| Task 3 | Create `ChecklistPage.jsx` with basic layout | NOT STARTED | Header, progress bar placeholder, phase tabs |
| Task 4 | Add route `/{compId}/checklist` to App.jsx | NOT STARTED | Inside CompetitionLayout routes |
| Task 5 | Create `ChecklistProgress.jsx` component | NOT STARTED | Progress bar with stats |
| Task 6 | Create `ChecklistCategory.jsx` component | NOT STARTED | Collapsible category with items |
| Task 7 | Create `ChecklistItem.jsx` component | NOT STARTED | Individual item with checkbox, status, detail |
| Task 8 | Wire manual item toggle to Firebase with rollback | NOT STARTED | toggleItem with optimistic update, rollback on error, toast feedback |

---

## Phase 1B: Auto-Validation (P0)

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| Task 9 | Add competition config validators | NOT STARTED | eventName, meetDate, venue, teams |
| Task 10 | Add team data validators | NOT STARTED | rosters, headshots percentage |
| Task 11 | Add infrastructure validators | NOT STARTED | vmAssigned, vmOnline (ping), socket, OBS |
| Task 12 | Add rundown validators | NOT STARTED | segments exist, named, graphics assigned |
| Task 13 | Add VM status polling (30s interval) | NOT STARTED | Reuse checkVmStatus from useCompetitions |
| Task 14 | Add real-time status updates | NOT STARTED | Subscribe to Firebase changes, context changes |
| Task 15 | Add "Fix" links to auto-validated items | NOT STARTED | Navigate to relevant config pages |
| Task 16 | Add notes field per item | NOT STARTED | Expandable text input, Firebase persist |

---

## Phase 1C: Team Contacts (P0)

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| Task 17 | Create `TeamContactsPanel.jsx` component | NOT STARTED | List contacts for competition teams |
| Task 18 | Add contact display (name, role, phone, email) | NOT STARTED | Click-to-call, click-to-email links |
| Task 19 | Add contact edit modal | NOT STARTED | Add/edit contact form |
| Task 20 | Wire contacts to Firebase `teamsDatabase/contacts/{team-key}` | NOT STARTED | CRUD operations |
| Task 21 | Auto-validate checklist items based on contacts | NOT STARTED | Camera op contact → item complete |
| Task 22 | Add contact roles dropdown | NOT STARTED | Standard roles: head-coach, sid, camera-op, etc. |

---

## Phase 1D: Polish & Navigation (P0)

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| Task 23 | Add checklist link to CompetitionSelector cards | NOT STARTED | "Checklist" button on each card |
| Task 24 | Add checklist icon to CompetitionHeader | NOT STARTED | ClipboardDocumentCheckIcon link |
| Task 25 | Add phase completion indicators to tabs | NOT STARTED | ✓ complete, ◐ partial, ○ empty |
| Task 26 | Add "Last updated" timestamp display | NOT STARTED | Show when checklist was last modified |
| Task 27 | Add skeleton loading states | NOT STARTED | Skeleton UI for initial load, subtle refresh indicator |
| Task 28 | Add keyboard accessibility | NOT STARTED | Tab navigation, Space to toggle, focus indicators |
| Task 29 | Ensure responsive design | NOT STARTED | Tablet-friendly layout, collapsible sidebar on mobile |

---

## Phase 2: Checklist Templates (P1)

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| Task 30 | Create template data model in Firebase | NOT STARTED | `checklistTemplates/{template-id}` |
| Task 31 | Create default templates (dual, tri, quad, championship) | NOT STARTED | Seed Firebase with standard templates |
| Task 32 | Add template selector to competition creation | NOT STARTED | Suggest based on compType |
| Task 33 | Create `TemplateEditorPage.jsx` | NOT STARTED | Admin page for template editing |
| Task 34 | Add/remove items in template editor | NOT STARTED | CRUD for template items |
| Task 35 | Add/remove categories in template editor | NOT STARTED | CRUD for template categories |
| Task 36 | Clone template functionality | NOT STARTED | Duplicate template for customization |
| Task 37 | Apply template to existing competition | NOT STARTED | Merge template items with existing |

---

## Phase 3A: Site Evaluations (P2)

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| Task 38 | Create venue data model in Firebase | NOT STARTED | `teamsDatabase/venues/{venue-key}` |
| Task 39 | Create `SiteEvaluationPage.jsx` | NOT STARTED | View/edit venue info |
| Task 40 | Add basic venue info form | NOT STARTED | Name, address, capacity |
| Task 41 | Add internet specs section | NOT STARTED | Type, SSID, speed, notes |
| Task 42 | Add camera positions CRUD | NOT STARTED | Position name, apparatus, location, angle |
| Task 43 | Add image upload for camera positions | NOT STARTED | Upload to storage, link to position |
| Task 44 | Add venue images gallery | NOT STARTED | Overview, 360, equipment photos |
| Task 45 | Add known issues list | NOT STARTED | Lessons learned, warnings |

---

## Phase 3B: Camera Config Integration (P2)

| Task | Description | Status | Notes |
|------|-------------|--------|-------|
| Task 46 | Link competition to venue | NOT STARTED | Venue selector in competition config |
| Task 47 | Pre-populate camera config from venue | NOT STARTED | On competition create, suggest cameras |
| Task 48 | Show venue info in checklist | NOT STARTED | Site eval summary panel |
| Task 49 | Auto-validate site eval checklist items | NOT STARTED | Site eval exists → items complete |
| Task 50 | Add "View Site Eval" link from checklist | NOT STARTED | Navigate to venue page |
| Task 51 | Export camera config from site eval | NOT STARTED | Generate JSON for camera-setup page |

---

## Detailed Task Specifications

### Task 1: Create `checklistItems.js`

**File:** `show-controller/src/lib/checklistItems.js`

**Description:**
Define the complete checklist structure with all phases, categories, and items.

**Checklist Items Structure:**
```javascript
export const CHECKLIST_PHASES = [
  {
    id: 'setup',
    name: 'Setup (5+ Days Out)',
    categories: [
      {
        id: 'session-setup',
        name: 'Session Setup',
        items: [
          { id: 'session-created', name: 'Session created in Virtius', autoValidate: false },
          { id: 'headshots-uploaded', name: 'Headshots uploaded & current', autoValidate: true, validator: 'headshots-uploaded', fixLink: '/media-manager' },
          // ... more items
        ]
      },
      // ... more categories
    ]
  },
  // ... more phases
];
```

**Categories to include:**
- Setup: Session Setup, Competition Config, Communications, Site Evaluation
- Pre-Production: Graphics, Talent, Camera Ops, Rundown, YouTube/Streaming
- Day Of (2hr): VM/Infrastructure, OBS Configuration, Camera Ops, Session
- Day Of (1hr): Discord/Talent, Final Checks

---

### Task 2: Create `useProductionChecklist` hook

**File:** `show-controller/src/hooks/useProductionChecklist.js`

**Description:**
Create the main hook for checklist state management.

**Interface:**
```javascript
export function useProductionChecklist() {
  // Returns:
  return {
    phases,           // Computed phases with status
    summary,          // { total, complete, warnings, errors, percentage }
    contacts,         // Team contacts from Firebase
    toggleItem,       // (itemId) => Promise<void>
    updateNote,       // (itemId, note) => Promise<void>
    updateContact,    // (teamKey, contactId, data) => Promise<void>
    refresh,          // () => void - trigger refresh
    loading,          // boolean
    error             // Error | null
  };
}
```

---

### Task 3: Create `ChecklistPage.jsx`

**File:** `show-controller/src/pages/ChecklistPage.jsx`

**Description:**
Main checklist page component with layout.

**Layout:**
- CompetitionHeader (reuse existing)
- Progress section (ChecklistProgress)
- Phase tabs
- Two-column layout:
  - Left: Checklist categories
  - Right: Team contacts panel

---

### Task 8: Wire manual item toggle with rollback

**Description:**
Implement optimistic updates with error rollback for checklist item toggles.

**Behavior:**
1. User clicks checkbox → immediately update local state (optimistic)
2. Write to Firebase in background
3. On success: state already reflects change, no action needed
4. On failure: revert local state to previous value, show error toast

**Implementation:**
```javascript
const toggleItem = useCallback(async (itemId) => {
  const previousState = checklistState?.items?.[itemId]?.checked ?? false;

  // Optimistic update
  setLocalChecklistState(prev => ({
    ...prev,
    items: { ...prev.items, [itemId]: { checked: !previousState } }
  }));

  try {
    await set(ref(db, `competitions/${compId}/checklist/items/${itemId}`), {
      checked: !previousState,
      checkedAt: new Date().toISOString()
    });
  } catch (error) {
    // Rollback on failure
    setLocalChecklistState(prev => ({
      ...prev,
      items: { ...prev.items, [itemId]: { checked: previousState } }
    }));
    toast.error('Failed to update checklist item');
  }
}, [compId, checklistState]);
```

---

### Task 17: Create `TeamContactsPanel.jsx`

**File:** `show-controller/src/components/TeamContactsPanel.jsx`

**Description:**
Panel showing contacts for competition teams with CRUD.

**Features:**
- Team tabs (Team 1, Team 2)
- Contact list with role icons
- Click-to-call (tel:) and click-to-email (mailto:)
- Add/Edit contact button
- Modal for contact form

**Contact Roles:**
- head-coach
- assistant-coach
- sid (Sports Information Director)
- camera-op-primary
- camera-op-backup
- venue-operations
- scoring-operations

---

### Task 27: Add skeleton loading states

**Description:**
Add loading UI for initial page load and refresh operations.

**Components:**
1. **Initial load skeleton:**
   - Progress bar placeholder (gray animated bar)
   - Phase tabs skeleton
   - 3-4 category skeletons with 4-5 item lines each

2. **Refresh indicator:**
   - Subtle spinner in header during background refresh
   - Don't replace content during refresh (already showing data)

**Pattern:** Use Tailwind's `animate-pulse` on gray backgrounds.

---

### Task 28: Add keyboard accessibility

**Description:**
Ensure checklist is fully keyboard navigable per WCAG guidelines.

**Requirements:**
- Tab key navigates between interactive elements (checkboxes, buttons, links)
- Space bar toggles checkbox when focused
- Enter key activates buttons/links
- Visible focus indicators (ring-2 ring-blue-500)
- Category collapse/expand via Enter or Space
- Skip to main content link (optional)

**Implementation:**
- Checkboxes: native `<input type="checkbox">` or proper ARIA roles
- Focus visible: `focus-visible:ring-2 focus-visible:ring-blue-500`
- Category headers: `role="button"` with `tabIndex={0}` and keyboard handler

---

### Task 29: Ensure responsive design

**Description:**
Make checklist usable on tablets and mobile devices for on-site producers.

**Breakpoints:**
- **Desktop (≥1024px):** Two-column layout (checklist + contacts sidebar)
- **Tablet (768-1023px):** Contacts panel collapses to expandable drawer
- **Mobile (<768px):** Single column, contacts accessible via button/modal

**Key considerations:**
- Touch targets minimum 44x44px
- Phase tabs scrollable horizontally on small screens
- Category sections full-width on mobile
- Progress bar simplified on mobile (percentage only, no detailed stats)

---

## Verification Checklist

### Phase 1 Complete When:
- [ ] Checklist page loads at `/{compId}/checklist`
- [ ] All 4 phases visible with ~72 curated items
- [ ] Auto-validated items show real-time status
- [ ] Manual items can be toggled with optimistic updates
- [ ] State persists to Firebase with error rollback
- [ ] Notes can be added/edited
- [ ] Team contacts panel shows/edits all 7 contact roles
- [ ] Contacts persist at `teamsDatabase/contacts/{team-key}`
- [ ] Navigation links work from CompetitionSelector and Header
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
The MVP includes 72 curated checklist items (not the full 130+ from the Google Sheets master). Items were selected for criticality and auto-validation potential. The full list remains available in the original spreadsheet for reference.

### Dependencies
- Phase 1A must complete before 1B, 1C, 1D
- Phase 1 must complete before Phase 2 or 3
- Phase 3A must complete before 3B

### Design Considerations
- **Responsive:** Must work on tablets for on-site producers
- **Accessible:** Full keyboard navigation, proper focus indicators
- **Performance:** Optimistic updates with rollback, skeleton loading

### Key Files Reference

**Existing files to reference:**
- `show-controller/src/hooks/useCompetitions.js` - checkVmStatus function
- `show-controller/src/context/CompetitionContext.jsx` - competition config pattern
- `show-controller/src/context/ShowContext.jsx` - socket connection state
- `show-controller/src/context/OBSContext.jsx` - OBS connection state
- `show-controller/src/pages/DashboardPage.jsx` - form patterns, UI components

**New files to create:**
- `show-controller/src/lib/checklistItems.js`
- `show-controller/src/hooks/useProductionChecklist.js`
- `show-controller/src/pages/ChecklistPage.jsx`
- `show-controller/src/components/checklist/ChecklistProgress.jsx`
- `show-controller/src/components/checklist/ChecklistCategory.jsx`
- `show-controller/src/components/checklist/ChecklistItem.jsx`
- `show-controller/src/components/TeamContactsPanel.jsx`
