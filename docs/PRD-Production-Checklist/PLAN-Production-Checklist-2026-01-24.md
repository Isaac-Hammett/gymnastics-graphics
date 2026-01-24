# Technical Plan: Production Checklist System

**Version:** 1.0
**Date:** 2026-01-24
**Status:** Planning
**PRD:** [PRD-Production-Checklist-2026-01-24.md](./PRD-Production-Checklist-2026-01-24.md)

---

## Related Documents

| Document | Purpose |
|----------|---------|
| [PRD-Production-Checklist-2026-01-24.md](./PRD-Production-Checklist-2026-01-24.md) | Product requirements |
| [PLAN-Production-Checklist-Implementation.md](./PLAN-Production-Checklist-Implementation.md) | Task breakdown and progress tracking |

---

## 1. Architecture Overview

### 1.1 System Components

```
CHECKLIST SYSTEM
════════════════════════════════════════════════════════════════

┌─────────────────────────────────────────────────────────────┐
│  ChecklistPage.jsx                                          │
│  ├── Phase tabs (Setup, Pre-Production, Day Of)            │
│  ├── Progress bar                                           │
│  ├── Category sections (collapsible)                        │
│  ├── Auto-validated items (read system state)               │
│  ├── Manual items (checkboxes)                              │
│  └── TeamContactsPanel                                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  useProductionChecklist.js (Hook)                           │
│  ├── Subscribe to Firebase checklist state                  │
│  ├── Compute auto-validated items                           │
│  ├── toggleItem(itemId) → Firebase write                   │
│  ├── addNote(itemId, note) → Firebase write                │
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

### 1.2 Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  SOURCES (Read-Only)                                                         │
│                                                                              │
│  CompetitionContext          Firebase                    Contexts            │
│  └── competitionConfig       └── teamData               └── ShowContext     │
│      └── eventName               └── roster                 └── connected   │
│      └── team1Name               └── headshots          └── OBSContext      │
│      └── vmAddress           └── rundown/segments           └── obsConnected│
│                              └── teamsDatabase/contacts                     │
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
│        name: "Setup (5+ Days Out)",                                          │
│        categories: [                                                         │
│          {                                                                   │
│            id: "session-setup",                                              │
│            name: "Session Setup",                                            │
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
│    summary: { total: 72, complete: 45, warnings: 5, errors: 3 }             │
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
│      "session-created": { checked: true, checkedAt: "...", checkedBy: "..." }│
│      "pre-meet-email-sent": { checked: true, checkedAt: "..." }             │
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
      checkedAt: "2026-01-24T10:00:00Z",
      checkedBy: "producer"  // optional
    },
    "pre-meet-email-sent": {
      checked: true,
      checkedAt: "2026-01-24T11:00:00Z"
    },
    "camera-op-contact-received": {
      checked: false  // or absent = false
    }
  },

  // Notes per item (optional)
  notes: {
    "camera-op-contact": "John Smith - 610-555-1234",
    "internet-speed": "50 Mbps confirmed via speedtest"
  },

  lastUpdated: "2026-01-24T12:00:00Z"
}
```

### 2.2 Team Contacts Database

**Path:** `teamsDatabase/contacts/{team-key}`

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

```javascript
// Example: teamsDatabase/venues/hollinger-fieldhouse
{
  name: "Hollinger Field House",
  school: "West Chester",
  teamKey: "west-chester-womens",

  // Basic info
  address: "700 S High St, West Chester, PA 19383",
  capacity: 2500,

  // Technical specs
  internet: {
    type: "wifi",  // "wifi" | "ethernet" | "cellular"
    ssid: "WCU-Athletics",
    password: "stored-securely",
    speedMbps: 50,
    testedAt: "2026-01-15T10:00:00Z",
    notes: "Drops during halftime - use cellular backup"
  },

  // Camera positions (drives camera config in Phase 3)
  cameraPositions: [
    {
      id: "cam-1",
      name: "Floor Wide",
      apparatus: "FX",
      location: "Northwest corner, elevated on riser",
      angle: "wide",
      srtPort: 9001,  // suggested SRT port
      imageUrl: "https://storage.../hollinger-cam1.jpg",
      notes: "Watch for speaker vibration - tripod on riser helps"
    },
    {
      id: "cam-2",
      name: "Vault",
      apparatus: "VT",
      location: "Behind vault table, center",
      angle: "tight",
      srtPort: 9002,
      imageUrl: "https://storage.../hollinger-cam2.jpg"
    },
    {
      id: "cam-3",
      name: "Bars Wide",
      apparatus: "UB",
      location: "Southeast corner, floor level",
      angle: "wide",
      srtPort: 9003,
      imageUrl: "https://storage.../hollinger-cam3.jpg"
    },
    {
      id: "cam-4",
      name: "Beam",
      apparatus: "BB",
      location: "West side, elevated",
      angle: "medium",
      srtPort: 9004,
      imageUrl: "https://storage.../hollinger-cam4.jpg"
    }
  ],

  // Venue images
  images: [
    {
      id: "img-1",
      type: "overview",  // "overview" | "camera-position" | "equipment" | "other"
      url: "https://storage.../hollinger-360.jpg",
      caption: "360 view from center court",
      uploadedAt: "2026-01-15T10:00:00Z"
    },
    {
      id: "img-2",
      type: "camera-position",
      cameraPositionId: "cam-1",
      url: "https://storage.../hollinger-cam1-view.jpg",
      caption: "View from Floor camera position"
    }
  ],

  // Layout diagram
  layoutDiagram: {
    url: "https://storage.../hollinger-layout.png",
    notes: "Updated Jan 2026 after equipment rearrangement"
  },

  // Known issues and lessons learned
  issues: [
    "Subwoofer causes camera shake - avoid tripod near speaker stack (NW corner)",
    "WiFi drops during halftime announcements - have cellular backup ready",
    "Power outlet near bars position is unreliable - bring extension cord"
  ],

  updatedAt: "2026-01-15T10:00:00Z",
  updatedBy: "isaac"
}
```

### 2.4 Checklist Templates (Future - Phase 2)

**Path:** `checklistTemplates/{template-id}`

```javascript
// Example: checklistTemplates/dual-meet-standard
{
  id: "dual-meet-standard",
  name: "Dual Meet - Standard",
  description: "Standard checklist for 2-team dual meets",
  competitionTypes: ["mens-dual", "womens-dual"],
  createdBy: "isaac",
  createdAt: "2026-01-24T10:00:00Z",
  updatedAt: "2026-01-24T10:00:00Z",

  phases: [
    {
      id: "setup",
      name: "Setup (5+ Days Out)",
      categories: [
        {
          id: "session-setup",
          name: "Session Setup",
          items: [
            {
              id: "session-created",
              name: "Session created in Virtius",
              autoValidate: false,
              required: true
            },
            {
              id: "headshots-uploaded",
              name: "Headshots uploaded & current",
              autoValidate: "teamData.headshotPercent > 80",
              required: true,
              fixLink: "/media-manager"
            },
            {
              id: "rosters-updated",
              name: "Rosters updated for both teams",
              autoValidate: "teamData.roster.length > 0",
              required: true,
              fixLink: "/media-manager"
            }
          ]
        },
        {
          id: "competition-config",
          name: "Competition Config",
          items: [
            {
              id: "event-name",
              name: "Event name configured",
              autoValidate: "config.eventName",
              required: true,
              fixLink: "/"
            }
            // ... more items
          ]
        }
      ]
    }
    // ... more phases
  ]
}
```

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
    └── checklistItems.js           # Hardcoded checklist definition
```

### 3.2 Component Hierarchy

```jsx
<ChecklistPage>
  <CompetitionHeader />  // Existing component

  <div className="checklist-container">
    {/* Progress Section */}
    <ChecklistProgress
      total={72}
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
          teams={[config.team1Key, config.team2Key]}
          contacts={contacts}
          onContactUpdate={updateContact}
        />
      </div>
    </div>
  </div>
</ChecklistPage>
```

### 3.3 Hook Interface

```javascript
// useProductionChecklist.js

export function useProductionChecklist() {
  const { compId, competitionConfig } = useCompetition();
  const { connected: socketConnected } = useShow();
  const { obsConnected } = useOBS();

  // State
  const [checklistState, setChecklistState] = useState(null);
  const [teamData, setTeamData] = useState(null);
  const [rundownSegments, setRundownSegments] = useState([]);
  const [contacts, setContacts] = useState({});
  const [vmStatus, setVmStatus] = useState({ online: false, checking: true });

  // Computed checklist items
  const checklistItems = useMemo(() => {
    return computeChecklistItems({
      competitionConfig,
      teamData,
      rundownSegments,
      checklistState,
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

  // Actions
  const toggleItem = useCallback(async (itemId) => {
    const currentState = checklistState?.items?.[itemId]?.checked ?? false;
    await set(ref(db, `competitions/${compId}/checklist/items/${itemId}`), {
      checked: !currentState,
      checkedAt: new Date().toISOString()
    });
  }, [compId, checklistState]);

  const updateNote = useCallback(async (itemId, note) => {
    await set(ref(db, `competitions/${compId}/checklist/notes/${itemId}`), note);
  }, [compId]);

  const updateContact = useCallback(async (teamKey, contactId, contactData) => {
    await set(ref(db, `teamsDatabase/contacts/${teamKey}/${contactId}`), {
      ...contactData,
      updatedAt: new Date().toISOString()
    });
  }, []);

  return {
    checklistItems,
    summary,
    contacts,
    toggleItem,
    updateNote,
    updateContact,
    refresh: () => { /* trigger re-fetch */ }
  };
}
```

---

## 4. Auto-Validation Logic

### 4.1 Validation Functions

```javascript
// lib/checklistValidators.js

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

  'teams-configured': (ctx) => {
    const team1Ok = ctx.config?.team1Name && ctx.config?.team1Logo;
    const team2Ok = ctx.config?.team2Name && ctx.config?.team2Logo;
    return {
      status: team1Ok && team2Ok ? 'complete' : 'error',
      detail: `Team 1: ${team1Ok ? '✓' : '✗'}, Team 2: ${team2Ok ? '✓' : '✗'}`
    };
  },

  // Team Data
  'rosters-loaded': (ctx) => {
    const team1Roster = ctx.teamData?.team1?.roster?.length || 0;
    const team2Roster = ctx.teamData?.team2?.roster?.length || 0;
    return {
      status: team1Roster > 0 && team2Roster > 0 ? 'complete' : 'warning',
      detail: `Team 1: ${team1Roster}, Team 2: ${team2Roster} athletes`
    };
  },

  'headshots-uploaded': (ctx) => {
    const getHeadshotPercent = (roster) => {
      if (!roster?.length) return 0;
      const withPhotos = roster.filter(a => a.headshotUrl).length;
      return Math.round((withPhotos / roster.length) * 100);
    };
    const team1Pct = getHeadshotPercent(ctx.teamData?.team1?.roster);
    const team2Pct = getHeadshotPercent(ctx.teamData?.team2?.roster);
    const avgPct = (team1Pct + team2Pct) / 2;
    return {
      status: avgPct >= 80 ? 'complete' : avgPct >= 50 ? 'warning' : 'error',
      detail: `Team 1: ${team1Pct}%, Team 2: ${team2Pct}%`
    };
  },

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
    status: ctx.socketConnected ? 'complete' : 'warning',
    detail: ctx.socketConnected ? 'Connected' : 'Disconnected'
  }),

  'obs-connected': (ctx) => ({
    status: ctx.obsConnected ? 'complete' : 'warning',
    detail: ctx.obsConnected ? 'Connected' : 'Not connected'
  }),

  // Rundown
  'rundown-created': (ctx) => ({
    status: ctx.rundownSegments?.length > 0 ? 'complete' : 'error',
    detail: ctx.rundownSegments?.length
      ? `${ctx.rundownSegments.length} segments`
      : 'No segments'
  }),

  'segments-named': (ctx) => {
    const unnamed = ctx.rundownSegments?.filter(
      s => !s.name || s.name === 'New Segment'
    ).length || 0;
    return {
      status: unnamed === 0 ? 'complete' : 'warning',
      detail: unnamed === 0 ? 'All named' : `${unnamed} unnamed`
    };
  },

  'graphics-assigned': (ctx) => {
    const total = ctx.rundownSegments?.length || 0;
    const withGraphics = ctx.rundownSegments?.filter(
      s => s.graphic?.graphicId
    ).length || 0;
    const pct = total > 0 ? Math.round((withGraphics / total) * 100) : 0;
    return {
      status: pct >= 80 ? 'complete' : pct >= 50 ? 'warning' : 'error',
      detail: `${withGraphics}/${total} (${pct}%)`
    };
  },

  // Contacts (auto-validate based on existence)
  'camera-op-contact-received': (ctx) => {
    const hasContact = ctx.contacts?.['camera-op-primary']?.phone;
    return {
      status: hasContact ? 'complete' : 'pending',
      detail: hasContact ? ctx.contacts['camera-op-primary'].name : 'Not set'
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
████████████░░░░░░░░  62% Complete (45/72)

[■ 45 complete] [▲ 5 warnings] [● 3 errors] [○ 19 pending]
```

---

## 6. Route Configuration

```jsx
// App.jsx - Add inside competition-bound routes

<Route element={<CompetitionLayout />}>
  {/* Existing routes */}
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
- CompetitionSelector cards (new "Checklist" button)
- CompetitionHeader (icon link)
- ProducerView sidebar (if exists)

### 7.2 Auto-Population

When certain contacts exist, auto-mark related items:
- `camera-op-primary` exists → "Camera op contact received" = complete
- `head-coach` with email → "Confirm talent with coaches" partially complete

### 7.3 Fix Links

Each auto-validated item can have a `fixLink` pointing to the page where it can be resolved:

| Item | Fix Link |
|------|----------|
| Event name | `/` (Dashboard) |
| Teams configured | `/` (Dashboard) |
| Rosters/Headshots | `/media-manager` |
| VM assigned | `/_admin/vm-pool` |
| Rundown | `/{compId}/rundown` |
| OBS connected | `/{compId}/obs-manager` |

---

## 8. Error Handling

### 8.1 Firebase Errors

- Show toast on write failure
- Retry with exponential backoff
- Queue offline writes for sync

### 8.2 Validation Errors

- VM ping timeout → Show "Offline" with retry button
- Invalid config → Show specific field errors
- Missing data → Show "Not configured" with fix link

### 8.3 Loading States

- Initial load: Skeleton UI
- Refresh: Subtle loading indicator
- Item toggle: Optimistic update with rollback on failure
