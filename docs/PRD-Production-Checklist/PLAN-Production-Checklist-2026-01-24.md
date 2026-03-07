# Technical Plan: Production Checklist System

**Version:** 1.2
**Date:** 2026-01-24
**Updated:** 2026-03-07
**Status:** Planning
**PRD:** [PRD-Production-Checklist-2026-01-24.md](./PRD-Production-Checklist-2026-01-24.md)

---

## Changelog (v1.2)

- **CRITICAL FIX:** Corrected rundown segments path from `competitions/{compId}/rundown/segments` to `competitions/{compId}/rundown/segments` (matches RundownEditorPage)
- Added `lastUpdated` write to `toggleItem()` and `updateNote()` actions
- Fixed optimistic update race condition — use functional state updates
- Added fix link for `socket-connected` (→ `/_admin/vm-pool`)
- Added fix link for `obs-connected` to items definition consistency
- Added error boundary requirement for ChecklistPage
- Added Firebase security rules note (Section 8.4)
- Clarified contact auto-validation is "auto-assist" — overrides manual items display, doesn't change type
- Added sidebar collapse behavior for Day Of phases
- Added `meetTheme` validator (new auto-validated item, total now 14)
- Added notes on headshot threshold rationale and timezone-awareness

### v1.1 (2026-03-06)

- Updated validators to support N teams dynamically based on competition type
- Removed `checkedBy` from data model
- Fixed "Fix" link paths
- Updated component hierarchy to handle N teams in contacts panel
- Added `react-hot-toast` as dependency for toast notifications
- Specified VM health check approach (use `checkVmStatus()` utility function)
- Updated item count from 72 to 74
- Updated phase tab labels
- Added ProducerView sidebar link to integration points
- Added `teamCount` helper from `competitionUtils.js`
- Specified that `buildTeamKey()` is used for contacts team key derivation

---

## Related Documents

| Document | Purpose |
|----------|---------|
| [PRD-Production-Checklist-2026-01-24.md](./PRD-Production-Checklist-2026-01-24.md) | Product requirements |
| [PLAN-Production-Checklist-Implementation.md](./PLAN-Production-Checklist-Implementation.md) | Task breakdown and progress tracking |
| [checklist-items-definition.md](./checklist-items-definition.md) | Complete list of all 74 checklist items |

---

## 1. Architecture Overview

### 1.1 System Components

```
CHECKLIST SYSTEM
════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────┐
│  ChecklistPage.jsx                                          │
│  ├── Phase tabs (Setup, Pre-Prod, 2hr Before, 1hr Before)  │
│  ├── Progress bar                                           │
│  ├── Category sections (collapsible)                        │
│  ├── Auto-validated items (read system state)               │
│  ├── Manual items (checkboxes)                              │
│  └── TeamContactsPanel (N teams)                            │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  useProductionChecklist.js (Hook)                           │
│  ├── Subscribe to Firebase checklist state                  │
│  ├── Subscribe to competitions/{compId}/rundown/segments              │
│  ├── Compute auto-validated items (13 validators)           │
│  ├── toggleItem(itemId) → optimistic update + rollback     │
│  ├── addNote(itemId, note) → Firebase write                │
│  ├── VM status polling via checkVmStatus() utility         │
│  └── Calculate progress stats                               │
└─────────────────────────────────────────────────────────────┘
                              │
               ┌──────────────┼──────────────┐
               ▼              ▼              ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ CompetitionCtx  │ │ ShowContext     │ │ OBSContext      │
│ (config, teams) │ │ (connected)     │ │ (obsConnected)  │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

**Note:** ShowContext and OBSContext are only available inside CompetitionLayout routes. The checklist page MUST be inside the `/:compId` route group (which it is).

### 1.2 Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  SOURCES (Read-Only)                                                         │
│                                                                              │
│  CompetitionContext          Firebase                    Contexts            │
│  └── competitionConfig       └── teamData               └── ShowContext     │
│      └── eventName               └── roster                 └── connected   │
│      └── meetDate                └── headshots          └── OBSContext      │
│      └── venue               └── production/rundown/        └── obsConnected│
│      └── team{1-7}Name              segments/ (editor fmt)                  │
│      └── team{1-7}Logo      └── teamsDatabase/contacts                     │
│      └── vmAddress                                                          │
│      └── compType                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       │ Compute at runtime
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  CHECKLIST STATE                                                             │
│                                                                              │
│  {                                                                           │
│    phases: [                                                                 │
│      {                                                                       │
│        id: "setup",                                                          │
│        name: "Setup",                                                        │
│        shortName: "Setup",                                                   │
│        categories: [                                                         │
│          {                                                                   │
│            id: "competition-config",                                         │
│            name: "Competition Config",                                       │
│            items: [                                                          │
│              { id: "event-name", name: "Event name configured",              │
│                autoValidate: true, status: "complete", detail: "WCU vs W&M" }│
│              { id: "session-created", name: "Session created in Virtius",   │
│                autoValidate: false, status: "pending", checked: false }      │
│            ]                                                                 │
│          }                                                                   │
│        ]                                                                     │
│      }                                                                       │
│    ],                                                                        │
│    summary: { total: 74, complete: 45, warnings: 5, errors: 3 }             │
│  }                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                       │
                                       │ Write (manual items only)
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  FIREBASE: competitions/{compId}/checklist                                   │
│                                                                              │
│  {                                                                           │
│    items: {                                                                  │
│      "session-created": { checked: true, checkedAt: "..." }                 │
│      "pre-meet-email": { checked: true, checkedAt: "..." }                  │
│    },                                                                        │
│    notes: {                                                                  │
│      "camera-op-contact": "John Smith - 610-555-1234"                       │
│    },                                                                        │
│    lastUpdated: "2026-01-24T12:00:00Z"                                      │
│  }                                                                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Firebase Data Models

### 2.1 Checklist State (Per Competition)

**Path:** `competitions/{compId}/checklist`

```javascript
{
  // Manual item states (auto items computed at runtime)
  items: {
    "session-created": {
      checked: true,
      checkedAt: "2026-01-24T10:00:00Z"
    },
    "pre-meet-email": {
      checked: true,
      checkedAt: "2026-01-24T11:00:00Z"
    }
    // absent = unchecked
  },

  // Notes per item (optional)
  notes: {
    "camera-op-contact": "John Smith - 610-555-1234",
    "equipment-check": "Backup battery in camera bag"
  },

  lastUpdated: "2026-01-24T12:00:00Z"
}
```

### 2.2 Team Contacts Database

**Path:** `teamsDatabase/contacts/{team-key}`

Team keys are derived via `buildTeamKey(school, gender)` from `show-controller/src/lib/competitionUtils.js`. Example: `buildTeamKey("West Chester", "womens")` → `"west-chester-womens"`.

```javascript
// Example: teamsDatabase/contacts/west-chester-womens
{
  "head-coach": {
    name: "Jane Smith",
    role: "Head Coach",
    email: "jsmith@wcupa.edu",
    phone: "610-555-1234",
    preferredContact: "email",  // "email" | "phone" | "text"
    notes: "Best reached before 3pm",
    updatedAt: "2026-01-24T10:00:00Z"
  },

  "assistant-coach": {
    name: "Bob Johnson",
    role: "Assistant Coach",
    email: "bjohnson@wcupa.edu",
    phone: "610-555-5678",
    updatedAt: "2026-01-24T10:00:00Z"
  },

  "sid": {
    name: "Media Person",
    role: "Sports Information Director",
    email: "media@wcupa.edu",
    phone: "610-555-9012",
    updatedAt: "2026-01-24T10:00:00Z"
  },

  "camera-op-primary": {
    name: "Camera Person",
    role: "Camera Operator",
    phone: "610-555-3456",
    notes: "Student worker, available weekends",
    updatedAt: "2026-01-24T10:00:00Z"
  },

  "camera-op-backup": {
    name: "Backup Person",
    role: "Camera Operator (Backup)",
    phone: "610-555-7890",
    updatedAt: "2026-01-24T10:00:00Z"
  },

  "venue-operations": {
    name: "Facility Manager",
    role: "Venue Operations",
    email: "facilities@wcupa.edu",
    phone: "610-555-2222",
    notes: "Contact for A/V access, power, wifi credentials",
    updatedAt: "2026-01-24T10:00:00Z"
  },

  "scoring-operations": {
    name: "Meet Director",
    role: "Scoring Operations",
    email: "meetdirector@wcupa.edu",
    phone: "610-555-3333",
    notes: "Scoring table contact, lineup changes",
    updatedAt: "2026-01-24T10:00:00Z"
  }
}
```

### 2.3 Site Evaluations Database (Future - Phase 3)

**Path:** `teamsDatabase/venues/{venue-key}`

*(Unchanged from v1.0 — see original plan for full schema)*

### 2.4 Checklist Templates (Future - Phase 2)

**Path:** `checklistTemplates/{template-id}`

*(Unchanged from v1.0 — see original plan for full schema)*

---

## 3. Component Architecture

### 3.1 File Structure

```
show-controller/src/
├── pages/
│   └── ChecklistPage.jsx           # Main checklist page
├── components/
│   ├── checklist/
│   │   ├── ChecklistPhaseTab.jsx   # Phase tab navigation
│   │   ├── ChecklistCategory.jsx   # Collapsible category section
│   │   ├── ChecklistItem.jsx       # Individual checklist item
│   │   └── ChecklistProgress.jsx   # Progress bar component
│   └── TeamContactsPanel.jsx       # Contacts management panel
├── hooks/
│   └── useProductionChecklist.js   # Main checklist hook
└── lib/
    ├── checklistItems.js           # Hardcoded checklist definition (74 items)
    └── checklistValidators.js      # Auto-validation functions (13 validators)
```

### 3.2 Component Hierarchy

```jsx
<ChecklistPage>
  <CompetitionHeader />  // Existing component

  <div className="checklist-container">
    {/* Progress Section */}
    <ChecklistProgress
      total={74}
      complete={45}
      warnings={5}
      errors={3}
    />

    {/* Phase Tabs */}
    <ChecklistPhaseTab
      phases={phases}
      activePhase={activePhase}
      onPhaseChange={setActivePhase}
    />

    <div className="checklist-content">
      {/* Main Checklist */}
      <div className="checklist-main">
        {activePhase.categories.map(category => (
          <ChecklistCategory
            key={category.id}
            category={category}
            expanded={expandedCategories.has(category.id)}
            onToggle={() => toggleCategory(category.id)}
            onItemToggle={toggleItem}
            onNoteChange={updateNote}
          />
        ))}
      </div>

      {/* Sidebar: Team Contacts */}
      <div className="checklist-sidebar">
        <TeamContactsPanel
          teams={teamKeys}  // Dynamic: derived from comp type (1-7 teams)
          contacts={contacts}
          onContactUpdate={updateContact}
        />
      </div>
    </div>
  </div>
</ChecklistPage>
```

**Team keys derivation:**
```javascript
// In ChecklistPage or useProductionChecklist
import { getTeamCount } from '../lib/competitionUtils';
import { buildTeamKey } from '../lib/competitionUtils';

const teamCount = getTeamCount(competitionConfig.compType);
const teamKeys = [];
for (let i = 1; i <= teamCount; i++) {
  const name = competitionConfig[`team${i}Name`];
  if (name) {
    teamKeys.push(buildTeamKey(name, gender));
  }
}
```

### 3.3 Hook Interface

```javascript
// useProductionChecklist.js

import { checkVmStatus } from './useCompetitions'; // standalone async function
import { db, ref, onValue, set } from '../lib/firebase';
import toast from 'react-hot-toast';

export function useProductionChecklist() {
  const { compId, competitionConfig } = useCompetition();
  const { connected: socketConnected } = useShow();
  const { obsConnected } = useOBS();

  // State
  const [checklistState, setChecklistState] = useState(null);
  const [localChecklistState, setLocalChecklistState] = useState(null); // for optimistic updates
  const [teamData, setTeamData] = useState(null);
  const [rundownSegments, setRundownSegments] = useState([]);
  const [contacts, setContacts] = useState({});
  const [vmStatus, setVmStatus] = useState({ online: false, checking: true });
  const [loading, setLoading] = useState(true);

  // Subscribe to rundown segments
  // IMPORTANT: Path is competitions/{compId}/rundown/segments (NOT production/rundown/segments)
  // The production/rundown/ path is only used for analytics
  useEffect(() => {
    const segmentsRef = ref(db, `competitions/${compId}/rundown/segments`);
    const unsub = onValue(segmentsRef, (snap) => {
      const data = snap.val();
      setRundownSegments(data ? Object.values(data) : []);
    });
    return () => unsub();
  }, [compId]);

  // VM status polling (30s interval) using standalone utility
  useEffect(() => {
    if (!competitionConfig?.vmAddress) {
      setVmStatus({ online: false, checking: false });
      return;
    }
    const poll = async () => {
      setVmStatus(prev => ({ ...prev, checking: true }));
      const result = await checkVmStatus(competitionConfig.vmAddress);
      setVmStatus({ online: result.online, checking: false, error: result.error });
    };
    poll();
    const interval = setInterval(poll, 30000);
    return () => clearInterval(interval);
  }, [competitionConfig?.vmAddress]);

  // Computed checklist items
  const checklistItems = useMemo(() => {
    return computeChecklistItems({
      competitionConfig,
      teamData,
      rundownSegments,
      checklistState: localChecklistState || checklistState,
      socketConnected,
      obsConnected,
      vmStatus,
      contacts
    });
  }, [/* deps */]);

  // Summary stats
  const summary = useMemo(() => ({
    total: countAllItems(checklistItems),
    complete: countComplete(checklistItems),
    warnings: countWarnings(checklistItems),
    errors: countErrors(checklistItems),
    percentage: calculatePercentage(checklistItems)
  }), [checklistItems]);

  // Actions - optimistic toggle with rollback
  // NOTE: Uses functional state update to avoid race condition when toggling
  // multiple items quickly. Reads previousState from localChecklistState (not
  // Firebase state) so rapid toggles don't clobber each other.
  const toggleItem = useCallback(async (itemId) => {
    let previousState;
    const now = new Date().toISOString();

    // Optimistic update — use functional form to safely read current local state
    setLocalChecklistState(prev => {
      previousState = prev?.items?.[itemId]?.checked
        ?? checklistState?.items?.[itemId]?.checked
        ?? false;
      return {
        ...prev,
        items: { ...(prev?.items || {}), [itemId]: { checked: !previousState, checkedAt: now } }
      };
    });

    try {
      await set(ref(db, `competitions/${compId}/checklist/items/${itemId}`), {
        checked: !previousState,
        checkedAt: now
      });
      // Update lastUpdated timestamp
      await set(ref(db, `competitions/${compId}/checklist/lastUpdated`), now);
    } catch (error) {
      // Rollback on failure — only revert this specific item
      setLocalChecklistState(prev => ({
        ...prev,
        items: { ...(prev?.items || {}), [itemId]: { checked: previousState } }
      }));
      toast.error('Failed to update checklist item');
    }
  }, [compId, checklistState]);

  const updateNote = useCallback(async (itemId, note) => {
    try {
      const now = new Date().toISOString();
      await set(ref(db, `competitions/${compId}/checklist/notes/${itemId}`), note);
      await set(ref(db, `competitions/${compId}/checklist/lastUpdated`), now);
    } catch (error) {
      toast.error('Failed to save note');
    }
  }, [compId]);

  const updateContact = useCallback(async (teamKey, contactId, contactData) => {
    try {
      await set(ref(db, `teamsDatabase/contacts/${teamKey}/${contactId}`), {
        ...contactData,
        updatedAt: new Date().toISOString()
      });
      toast.success('Contact saved');
    } catch (error) {
      toast.error('Failed to save contact');
    }
  }, []);

  return {
    checklistItems,
    summary,
    contacts,
    toggleItem,
    updateNote,
    updateContact,
    loading,
    refresh: () => { /* trigger re-fetch */ }
  };
}
```

---

## 4. Auto-Validation Logic

### 4.1 Validation Functions

```javascript
// lib/checklistValidators.js

import { getTeamCount } from './competitionUtils';

/**
 * Helper: get team count from competition config
 */
function getTeamCountFromConfig(config) {
  if (!config?.compType) return 2;
  return getTeamCount(config.compType);
}

export const validators = {
  // Competition Config
  'event-name': (ctx) => ({
    status: ctx.config?.eventName ? 'complete' : 'error',
    detail: ctx.config?.eventName || 'Not set'
  }),

  'meet-date': (ctx) => ({
    status: ctx.config?.meetDate ? 'complete' : 'error',
    detail: ctx.config?.meetDate || 'Not set'
  }),

  'venue-configured': (ctx) => ({
    status: ctx.config?.venue ? 'complete' : 'error',
    detail: ctx.config?.venue || 'Not set'
  }),

  'teams-configured': (ctx) => {
    const teamCount = getTeamCountFromConfig(ctx.config);
    const results = [];
    let allOk = true;
    for (let i = 1; i <= teamCount; i++) {
      const nameOk = !!ctx.config?.[`team${i}Name`];
      const logoOk = !!ctx.config?.[`team${i}Logo`];
      const ok = nameOk && logoOk;
      if (!ok) allOk = false;
      results.push(`Team ${i}: ${ok ? '✓' : '✗'}`);
    }
    return {
      status: allOk ? 'complete' : 'error',
      detail: results.join(', ')
    };
  },

  // Team Data (dynamic N teams)
  'rosters-loaded': (ctx) => {
    const teamCount = getTeamCountFromConfig(ctx.config);
    const results = [];
    let allOk = true;
    for (let i = 1; i <= teamCount; i++) {
      const count = ctx.teamData?.[`team${i}`]?.roster?.length || 0;
      if (count === 0) allOk = false;
      results.push(`Team ${i}: ${count}`);
    }
    return {
      status: allOk ? 'complete' : 'warning',
      detail: results.join(', ')
    };
  },

  'headshots-uploaded': (ctx) => {
    // Threshold rationale: 80% accounts for walk-ons and injured athletes who
    // won't compete and may not have headshots. Only ~6 of ~20 roster members
    // typically compete, so 80% of the full roster is a reasonable floor.
    // A per-lineup check would be more accurate but lineups aren't available
    // until day-of (Phase 3), so we use roster-wide percentage in Setup phase.
    const teamCount = getTeamCountFromConfig(ctx.config);
    const getHeadshotPercent = (roster) => {
      if (!roster?.length) return 0;
      const withPhotos = roster.filter(a => a.headshotUrl).length;
      return Math.round((withPhotos / roster.length) * 100);
    };
    let totalPct = 0;
    const results = [];
    for (let i = 1; i <= teamCount; i++) {
      const pct = getHeadshotPercent(ctx.teamData?.[`team${i}`]?.roster);
      totalPct += pct;
      results.push(`T${i}: ${pct}%`);
    }
    const avgPct = Math.round(totalPct / teamCount);
    return {
      status: avgPct >= 80 ? 'complete' : avgPct >= 50 ? 'warning' : 'error',
      detail: results.join(', ')
    };
  },

  // Meet Theme
  'theme-configured': (ctx) => ({
    status: ctx.config?.meetTheme ? 'complete' : 'warning',
    detail: ctx.config?.meetTheme || 'No theme set (using defaults)'
  }),

  // Infrastructure
  'vm-assigned': (ctx) => ({
    status: ctx.config?.vmAddress ? 'complete' : 'error',
    detail: ctx.config?.vmAddress || 'No VM assigned'
  }),

  'vm-online': (ctx) => ({
    status: ctx.vmStatus?.checking ? 'checking'
      : ctx.vmStatus?.online ? 'complete'
      : 'error',
    detail: ctx.vmStatus?.checking ? 'Checking...'
      : ctx.vmStatus?.online ? 'Online'
      : ctx.vmStatus?.error || 'Offline'
  }),

  'socket-connected': (ctx) => ({
    status: ctx.socketConnected ? 'complete' : 'error',
    detail: ctx.socketConnected ? 'Connected' : 'Disconnected'
  }),

  'obs-connected': (ctx) => ({
    status: ctx.obsConnected ? 'complete' : 'error',
    detail: ctx.obsConnected ? 'Connected' : 'Not connected'
  }),

  // Rundown (uses EDITOR format at competitions/{compId}/rundown/segments)
  'rundown-created': (ctx) => ({
    status: ctx.rundownSegments?.length > 0 ? 'complete' : 'error',
    detail: ctx.rundownSegments?.length
      ? `${ctx.rundownSegments.length} segments`
      : 'No segments'
  }),

  'segments-named': (ctx) => {
    if (!ctx.rundownSegments?.length) return { status: 'error', detail: 'No segments' };
    const unnamed = ctx.rundownSegments.filter(
      s => !s.name || s.name === 'New Segment'
    ).length;
    return {
      status: unnamed === 0 ? 'complete' : 'warning',
      detail: unnamed === 0 ? 'All named' : `${unnamed} unnamed`
    };
  },

  'graphics-assigned': (ctx) => {
    const total = ctx.rundownSegments?.length || 0;
    if (total === 0) return { status: 'error', detail: 'No segments' };
    const withGraphics = ctx.rundownSegments.filter(
      s => s.graphic?.graphicId
    ).length;
    const pct = Math.round((withGraphics / total) * 100);
    return {
      status: pct >= 80 ? 'complete' : pct >= 50 ? 'warning' : 'error',
      detail: `${withGraphics}/${total} (${pct}%)`
    };
  }
};
```

---

## 5. UI Patterns

### 5.1 Color Scheme (Matches Existing)

```css
/* Status Colors */
--complete: #22c55e;    /* green-500 */
--warning: #f59e0b;     /* amber-500 */
--error: #ef4444;       /* red-500 */
--pending: #71717a;     /* zinc-500 */
--checking: #71717a;    /* zinc-500 with animation */

/* Backgrounds */
--bg-primary: #18181b;  /* zinc-900 */
--bg-secondary: #27272a; /* zinc-800 */
--bg-tertiary: #3f3f46; /* zinc-700 */

/* Text */
--text-primary: #ffffff;
--text-secondary: #a1a1aa; /* zinc-400 */
--text-muted: #71717a;    /* zinc-500 */
```

### 5.2 Item States

| State | Icon | Color | Description |
|-------|------|-------|-------------|
| Complete | ✓ CheckCircle | green | Requirement met |
| Warning | ⚠ ExclamationTriangle | amber | Partial/suboptimal |
| Error | ✗ XCircle | red | Requirement not met |
| Pending | ○ Circle | zinc | Manual item, not checked |
| Checking | ↻ ArrowPath (spin) | zinc | Async validation in progress |

### 5.3 Progress Bar

```
████████████░░░░░░░░  61% Complete (45/74)

[■ 45 complete] [▲ 5 warnings] [● 3 errors] [○ 21 pending]
```

### 5.4 Toast Notifications

**Dependency:** `react-hot-toast`

```javascript
import toast from 'react-hot-toast';

// Usage
toast.success('Contact saved');
toast.error('Failed to update checklist item');
```

Add `<Toaster />` component to App.jsx (one-time setup).

---

## 6. Route Configuration

```jsx
// App.jsx - Add inside competition-bound routes

<Route path="/:compId" element={<CompetitionLayout />}>
  {/* Existing routes */}
  <Route index element={<Navigate to="producer" replace />} />
  <Route path="producer" element={<ProducerView />} />
  <Route path="talent" element={<TalentView />} />
  <Route path="rundown" element={<RundownEditorPage />} />

  {/* New checklist route */}
  <Route path="checklist" element={<ChecklistPage />} />
</Route>
```

**URL Pattern:** `/{compId}/checklist`

---

## 7. Integration Points

### 7.1 Navigation Links

Add checklist link to:
- **HomePage** competition cards (new "Checklist" button alongside "Producer", "Talent", etc.)
- **CompetitionHeader** (ClipboardDocumentCheckIcon link)
- **ProducerView** sidebar (prominent link — this is where producers spend most time)

### 7.2 Contact Auto-Assist (Not Auto-Validation)

Certain manual checklist items can be **auto-assisted** by contact data. These items remain `type: manual` but display a visual indicator when the system detects the related contact exists. The producer can still uncheck them (e.g., if the contact info is stale).

**This is NOT auto-validation** — the item type stays `manual`, the checkbox stays interactive, and it doesn't count toward the 14 auto-validated items. It's a convenience hint.

| Contact Exists | Checklist Item Affected | Behavior |
|----------------|------------------------|----------|
| `camera-op-primary` | `camera-op-contact` (#11) | Show "auto-checked" hint; producer can uncheck |
| `head-coach` with email | `talent-contacted` (#12) | Show info icon with contact details |

### 7.3 Fix Links

Each auto-validated item can have a `fixLink` pointing to the page where it can be resolved:

| Item | Fix Link | Notes |
|------|----------|-------|
| Event name | `/` | HomePage — click Edit on competition |
| Meet date | `/` | HomePage — click Edit on competition |
| Venue | `/` | HomePage — click Edit on competition |
| Teams configured | `/` | HomePage — click Edit on competition |
| Theme configured | `/themes` | Theme editor page |
| Rosters/Headshots | `/media-manager` | |
| VM assigned | `/_admin/vm-pool` | |
| VM online | `/_admin/vm-pool` | Start VM from pool page |
| Socket connected | `/_admin/vm-pool` | Depends on VM being online + coordinator running. No direct fix — tooltip explains dependency chain. |
| OBS connected | `/{compId}/obs-manager` | |
| Rundown items | `/{compId}/rundown` | rundown-created, segments-named, graphics-assigned |

**Notes:**
- Event name, date, venue, and teams are edited via the competition edit modal on the HomePage. The fix link goes to `/` where the producer can find their competition and click Edit.
- Socket connection is not directly fixable by the producer — it auto-connects when the VM is online and coordinator is running. The fix link goes to the VM pool so they can verify the VM is started.

---

## 8. Error Handling

### 8.1 Firebase Errors

- Show toast via `react-hot-toast` on write failure
- Optimistic update with rollback on error (see hook interface)
- Firebase Realtime Database provides native offline persistence — no custom queuing needed

### 8.2 Validation Errors

- VM ping timeout → Show "Offline" (red status)
- Custom VMs → Always show "Offline" (no health check path available)
- Invalid config → Show specific field errors via detail string
- Missing data → Show "Not configured" with fix link

### 8.3 Loading States

- Initial load: Skeleton UI (new pattern — use Tailwind `animate-pulse`). **Build skeleton into initial ChecklistPage creation (Task 3)**, not as a separate late task.
- Refresh: Subtle loading indicator (don't replace content)
- Item toggle: Optimistic update with rollback on failure

### 8.4 Error Boundary

Wrap `ChecklistPage` in a React error boundary. Validators access deeply nested data (`ctx.teamData?.[`team${i}`]?.roster?.length`) — a single unexpected shape (e.g., roster is an object instead of array) would crash the entire page.

```jsx
// In App.jsx route definition
<Route path="checklist" element={
  <ErrorBoundary fallback={<ChecklistErrorFallback />}>
    <ChecklistPage />
  </ErrorBoundary>
} />
```

The fallback should show a "Something went wrong" message with a "Reload" button, not a blank screen.

### 8.5 Firebase Security Considerations

The checklist writes to two paths:
- `competitions/{compId}/checklist/` — scoped to a competition
- `teamsDatabase/contacts/{team-key}/` — global, persists across competitions

**Current state:** Firebase rules are not covered in this PRD. The app uses Firebase Realtime Database without authentication (no user login system exists). This means anyone with a `compId` could write arbitrary checklist data.

**Acceptable for MVP** because:
- The app is not public-facing — only producers with the URL can access it
- CompIds are random and not guessable
- Contacts data is low-sensitivity (names, phone numbers already shared with the production team)

**Phase 2+ consideration:** If the app gets wider use, add Firebase auth and rules to restrict writes.

### 8.6 Sidebar Responsiveness

The TeamContactsPanel sidebar is relevant during Setup and Pre-Production phases but less useful during Day Of phases (which focus on OBS, Discord, audio).

**Behavior:**
- Phases 1-2 (Setup, Pre-Prod): Sidebar visible by default (two-column layout)
- Phases 3-4 (Day Of): Sidebar collapsed by default with a toggle button to expand
- Mobile/tablet: Sidebar always collapsed into a drawer

---

## 9. Design Notes

### 9.1 Phase Timeline Labels

Phase names ("2 Hours Before", "1 Hour Before") are **organizational labels only** — they do not calculate actual clock times. The system does not use `meetDate` to compute countdown timers.

**Rationale:** Meets often shift start times, warm-up schedules vary, and producers already know their timeline. Adding countdown logic would create false urgency or incorrect deadlines. The phases just help group related tasks.

### 9.2 Checklist Reset

No bulk "reset checklist" function in MVP. Individual items can be unchecked. If a competition is duplicated (via existing `duplicateCompetition()`), the new competition starts with a blank checklist — the checklist state is not copied.

### 9.3 Multi-Competition View

Producers managing same-day doubleheaders (e.g., men's 2pm + women's 6pm) must switch between separate checklists. A combined "all my shows today" view is deferred — this would require a concept of "producer identity" which doesn't exist yet.
