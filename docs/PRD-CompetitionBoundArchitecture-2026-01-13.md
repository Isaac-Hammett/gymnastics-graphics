# PRD Amendment: Competition-Bound Architecture Refactor

**Version:** 2.1 (Amendment to PRD v2.0)
**Date:** January 13, 2026
**Project:** Gymnastics Graphics - Show Controller
**Scope:** Bind cameras, timesheets, and show configs to specific competitions with VM-based routing
**Status:** Implementation Ready

---

## Executive Summary

This PRD amendment extends the Camera Management & Timesheet-Driven Show Control System (PRD v2.0) to support competition-specific configuration with dynamic VM routing. The changes enable:

1. **URL-based competition routing** - `/{compId}/producer` instead of `/producer`
2. **Dynamic VM connection** - VM address from Firebase, not hardcoded `.env`
3. **Gender-aware apparatus** - WAG shows 4 apparatus, MAG shows 6
4. **Production configs per-competition** - Cameras, rundown stored in Firebase

### What Already Exists (Leverage This)

| Component | Location | Status |
|-----------|----------|--------|
| Event definitions | `show-controller/src/lib/eventConfig.js` | ✅ Has `EVENTS` object with gender field, `EVENT_ORDER` by gender |
| Competition CRUD | `show-controller/src/hooks/useCompetitions.js` | ✅ Full Firebase integration |
| Gender field | `competitions/{id}/config/gender` | ✅ "mens" or "womens" |
| Apparatus constants | `server/lib/showConfigSchema.js` | ✅ Has `MENS_APPARATUS`, `WOMENS_APPARATUS` |
| ShowContext | `show-controller/src/context/ShowContext.jsx` | ✅ Socket connection, all show state |
| Camera systems | `server/lib/camera*.js` | ✅ Health, runtime, fallback modules |
| Timesheet engine | `server/lib/timesheetEngine.js` | ✅ Segment timing, overrides |

### What Needs to Change

| Current | Target |
|---------|--------|
| `/producer` URL | `/{compId}/producer` |
| `VITE_SOCKET_SERVER` env var | `competitions/{id}/config/vmAddress` |
| Hardcoded apparatus in CameraSetupPage | Dynamic from `eventConfig.js` + gender |
| `show-config.json` on server | `competitions/{id}/production/*` in Firebase |
| ShowProvider only on producer/talent | CompetitionProvider → ShowProvider hierarchy |

---

## URL Structure

### Current Structure (No Competition Context)

```
https://show.virtius.tv/producer
https://show.virtius.tv/talent
https://show.virtius.tv/camera-setup
```

### New Structure (Competition-Scoped)

```
https://show.virtius.tv/{compId}/producer
https://show.virtius.tv/{compId}/talent
https://show.virtius.tv/{compId}/camera-setup
https://show.virtius.tv/{compId}/graphics
```

### Special Routes

| Route | Purpose |
|-------|---------|
| `/select` | Competition selector (landing page) |
| `/local/producer` | Local development mode (uses `VITE_LOCAL_SERVER`) |
| `/` | Redirects to `/select` |
| `/hub`, `/dashboard`, `/import` | Standalone pages (no competition context needed) |

### Legacy Route Handling

Routes without `compId` redirect to competition selector:
```
/producer → /select?redirect=/producer
/talent → /select?redirect=/talent
```

---

## Architecture Overview

### Firebase Structure (Extended)

```
/competitions
├── {compId}
│   ├── config/                   # EXISTING
│   │   ├── eventName
│   │   ├── gender               # "mens" or "womens" - DRIVES APPARATUS
│   │   ├── compType             # "mens-dual", "womens-quad", etc.
│   │   ├── vmAddress            # NEW: "3.81.127.185:3003" (used by COORDINATOR, not frontend)
│   │   └── team1Name - team6Name, venue, meetDate, etc.
│   │
│   ├── teamData/                 # EXISTING (from RTN enrichment)
│   ├── currentGraphic/           # EXISTING (graphics trigger)
│   │
│   └── production/               # NEW - Replaces show-config.json
│       ├── cameras/
│       │   ├── {cameraId}/
│       │   │   ├── name
│       │   │   ├── srtPort
│       │   │   ├── srtUrl
│       │   │   ├── expectedApparatus[]
│       │   │   ├── fallbackCameraId
│       │   │   └── audioEnabled
│       │   └── ...
│       ├── rundown/
│       │   ├── segments[]
│       │   ├── createdAt
│       │   └── lastModified
│       ├── settings/
│       │   ├── nimbleServer
│       │   ├── audioConfig
│       │   ├── graphicsOverlay
│       │   └── transitions
│       └── history/
│           ├── overrides[]
│           └── cameraEvents[]
```

### Connection Flow

**IMPORTANT:** In production, the frontend NEVER connects directly to competition VMs. All traffic flows through the **coordinator** at `api.commentarygraphic.com`.

```
┌─────────────────────────────────────────────────────────────────┐
│                    Application Startup                          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ Extract compId  │
                    │ from URL path   │
                    └─────────────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
              ▼               ▼               ▼
        compId=null     compId="local"   compId="xyz"
              │               │               │
              ▼               ▼               ▼
        Redirect to     Use VITE_       Production:
        /select         LOCAL_SERVER    api.commentarygraphic.com
                              │               │
                              └───────┬───────┘
                                      ▼
                            ┌─────────────────┐
                            │ Connect socket  │
                            │ (with compId)   │
                            └─────────────────┘
                                      │
                                      ▼ (In production only)
                            ┌─────────────────┐
                            │ Coordinator     │
                            │ routes to VM    │
                            └─────────────────┘
                                      │
                                      ▼
                            ┌─────────────────┐
                            │ OBS commands    │
                            │ proxied to VM   │
                            └─────────────────┘
                                      │
                                      ▼
                            ┌─────────────────┐
                            │ Ready! Render   │
                            │ ProducerView    │
                            └─────────────────┘
```

See [README-OBS-Architecture.md](README-OBS-Architecture.md) for the full connection architecture diagram.

### Context Provider Hierarchy

```jsx
// New provider hierarchy
<BrowserRouter>
  <Routes>
    <Route path="/:compId" element={
      <CompetitionProvider>      {/* Resolves compId → vmAddress, gender */}
        <ShowProvider>           {/* Connects socket to vmAddress */}
          <Outlet />
        </ShowProvider>
      </CompetitionProvider>
    }>
      <Route path="producer" element={<ProducerView />} />
      <Route path="talent" element={<TalentView />} />
      {/* ... */}
    </Route>
  </Routes>
</BrowserRouter>
```

---

## Phase 1: Apparatus Configuration Module

**Goal:** Create reusable apparatus utilities that leverage existing `eventConfig.js`

### 1.1 Server-Side Apparatus Config

**File:** `server/lib/apparatusConfig.js` (NEW)

```javascript
// Leverages existing constants from showConfigSchema.js
import { MENS_APPARATUS, WOMENS_APPARATUS } from './showConfigSchema.js';

const APPARATUS_DETAILS = {
  FX: { name: 'Floor Exercise', order: { mens: 1, womens: 4 } },
  PH: { name: 'Pommel Horse', order: { mens: 2 } },
  SR: { name: 'Still Rings', order: { mens: 3 } },
  VT: { name: 'Vault', order: { mens: 4, womens: 1 } },
  PB: { name: 'Parallel Bars', order: { mens: 5 } },
  HB: { name: 'High Bar', order: { mens: 6 } },
  UB: { name: 'Uneven Bars', order: { womens: 2 } },
  BB: { name: 'Balance Beam', order: { womens: 3 } },
};

export function getApparatusForGender(gender) {
  const codes = gender === 'mens' ? MENS_APPARATUS : WOMENS_APPARATUS;
  return codes.map(code => ({
    code,
    name: APPARATUS_DETAILS[code].name,
    order: APPARATUS_DETAILS[code].order[gender],
  })).sort((a, b) => a.order - b.order);
}

export function getApparatusCodes(gender) {
  return gender === 'mens' ? [...MENS_APPARATUS] : [...WOMENS_APPARATUS];
}

export function getApparatusName(code) {
  return APPARATUS_DETAILS[code]?.name || code;
}

export function isValidApparatus(gender, code) {
  const codes = gender === 'mens' ? MENS_APPARATUS : WOMENS_APPARATUS;
  return codes.includes(code);
}

export function validateApparatusCodes(gender, codes) {
  const valid = gender === 'mens' ? MENS_APPARATUS : WOMENS_APPARATUS;
  const invalid = codes.filter(c => !valid.includes(c));
  return { valid: invalid.length === 0, invalidCodes: invalid };
}

export { MENS_APPARATUS, WOMENS_APPARATUS };
```

**Acceptance Criteria:**
- [ ] `getApparatusForGender('mens')` returns 6 apparatus in Olympic order
- [ ] `getApparatusForGender('womens')` returns 4 apparatus in Olympic order
- [ ] `isValidApparatus('womens', 'PH')` returns `false`
- [ ] `validateApparatusCodes('mens', ['FX', 'UB'])` returns `{ valid: false, invalidCodes: ['UB'] }`

### 1.2 Client-Side Apparatus Hook

**File:** `show-controller/src/hooks/useApparatus.js` (NEW)

```javascript
import { useMemo } from 'react';
import { EVENTS, EVENT_ORDER } from '../lib/eventConfig';

/**
 * Returns apparatus data for a given gender
 * Leverages existing eventConfig.js EVENT_ORDER
 * @param {string} gender - 'mens' or 'womens'
 */
export function useApparatus(gender) {
  return useMemo(() => {
    const normalizedGender = gender || 'womens';
    const eventIds = EVENT_ORDER[normalizedGender] || EVENT_ORDER.womens;

    const apparatus = eventIds.map((eventId, index) => {
      const event = EVENTS[eventId];
      return {
        code: event.shortName,
        name: event.name,
        eventId: event.id,
        order: index + 1,
      };
    });

    const apparatusCodes = apparatus.map(a => a.code);

    const getApparatusName = (code) => {
      const found = apparatus.find(a => a.code === code);
      return found?.name || code;
    };

    const isValid = (code) => apparatusCodes.includes(code);

    return {
      apparatus,
      apparatusCodes,
      getApparatusName,
      isValid,
      gender: normalizedGender,
    };
  }, [gender]);
}
```

**Acceptance Criteria:**
- [ ] `useApparatus('womens').apparatusCodes` returns `['VT', 'UB', 'BB', 'FX']`
- [ ] `useApparatus('mens').apparatusCodes` returns `['FX', 'PH', 'SR', 'VT', 'PB', 'HB']`
- [ ] Memoized to prevent unnecessary re-renders
- [ ] Defaults to 'womens' if gender is null/undefined

---

## Phase 2: Production Config in Firebase

**Goal:** Move camera/rundown configs from `show-config.json` to Firebase per-competition

### 2.1 Production Config Service

**File:** `server/lib/productionConfigService.js` (NEW)

```javascript
import { initializeApp } from 'firebase-admin/app';
import { getDatabase } from 'firebase-admin/database';

class ProductionConfigService {
  constructor() {
    this.db = getDatabase();
  }

  async getProductionConfig(competitionId) {
    const snapshot = await this.db.ref(`competitions/${competitionId}/production`).once('value');
    return snapshot.val();
  }

  async getCameras(competitionId) {
    const snapshot = await this.db.ref(`competitions/${competitionId}/production/cameras`).once('value');
    const data = snapshot.val();
    return data ? Object.values(data) : [];
  }

  async saveCameras(competitionId, cameras) {
    const camerasObj = {};
    cameras.forEach(cam => { camerasObj[cam.id] = cam; });
    await this.db.ref(`competitions/${competitionId}/production/cameras`).set(camerasObj);
  }

  async getRundown(competitionId) {
    const snapshot = await this.db.ref(`competitions/${competitionId}/production/rundown`).once('value');
    return snapshot.val();
  }

  async saveRundown(competitionId, rundown) {
    await this.db.ref(`competitions/${competitionId}/production/rundown`).set({
      ...rundown,
      lastModified: Date.now(),
    });
  }

  async getSettings(competitionId) {
    const snapshot = await this.db.ref(`competitions/${competitionId}/production/settings`).once('value');
    return snapshot.val();
  }

  async saveSettings(competitionId, settings) {
    await this.db.ref(`competitions/${competitionId}/production/settings`).set(settings);
  }

  async appendOverride(competitionId, override) {
    await this.db.ref(`competitions/${competitionId}/production/history/overrides`).push({
      ...override,
      timestamp: Date.now(),
    });
  }

  async getHistory(competitionId) {
    const snapshot = await this.db.ref(`competitions/${competitionId}/production/history`).once('value');
    return snapshot.val() || { overrides: [], cameraEvents: [] };
  }
}

export const productionConfigService = new ProductionConfigService();
```

**Acceptance Criteria:**
- [ ] `getProductionConfig(compId)` returns full production config
- [ ] `getCameras(compId)` returns cameras array (converted from object)
- [ ] `saveCameras(compId, cameras)` persists to Firebase
- [ ] `appendOverride(compId, override)` adds to history
- [ ] Returns null gracefully if no production config exists

### 2.2 Server API Endpoints

**File:** `server/index.js` (MODIFY)

Add new REST endpoints:

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/apparatus/:gender` | Get apparatus for gender |
| GET | `/api/competitions/:id/production` | Get production config |
| PUT | `/api/competitions/:id/production/cameras` | Save cameras |
| PUT | `/api/competitions/:id/production/rundown` | Save rundown |
| PUT | `/api/competitions/:id/production/settings` | Save settings |
| GET | `/api/competitions/:id/production/history` | Get override history |

**Acceptance Criteria:**
- [ ] All endpoints return proper JSON responses
- [ ] Error handling returns 500 with message
- [ ] Validates competition exists before operations

---

## Phase 3: URL Routing & Competition Context

**Goal:** Competition ID in URL drives VM connection and context

### 3.1 Competition Context Provider

**File:** `show-controller/src/context/CompetitionContext.jsx` (NEW)

```typescript
interface CompetitionContextValue {
  // State
  compId: string | null;
  competitionConfig: CompetitionConfig | null;
  vmAddress: string | null;
  gender: 'mens' | 'womens' | null;
  isLoading: boolean;
  error: CompetitionError | null;

  // Derived URLs - IMPORTANT: See connection architecture below
  socketUrl: string | null;      // Production: always api.commentarygraphic.com
  websocketUrl: string | null;   // Production: always wss://api.commentarygraphic.com

  // Flags
  isLocalMode: boolean;

  // Actions
  refreshConfig: () => Promise<void>;
  retryConnection: () => void;
}
```

**CRITICAL: Connection Architecture**

In **production** (HTTPS), the frontend ALWAYS connects to the **coordinator** (`api.commentarygraphic.com`), NOT directly to VMs. The coordinator then proxies OBS commands to the appropriate competition VM.

```
Frontend → wss://api.commentarygraphic.com (with compId in query)
                        ↓
              Coordinator routes to VM
                        ↓
                ws://VM-IP:4455 (OBS WebSocket)
```

The `vmAddress` stored in Firebase is used by the **coordinator** to know which VM to route to, not by the frontend to connect directly.

In **local development** (`compId="local"`), the frontend can connect directly to `VITE_LOCAL_SERVER`.

See [README-OBS-Architecture.md](README-OBS-Architecture.md) for complete architecture details.

**Acceptance Criteria:**
- [ ] Extract `compId` from URL using React Router's `useParams()`
- [ ] Handle special `compId="local"` → use `VITE_LOCAL_SERVER`
- [ ] Subscribe to `competitions/{compId}/config` in Firebase (real-time)
- [ ] Extract `vmAddress` and `gender` from config
- [ ] **Production:** Always return `api.commentarygraphic.com` as socketUrl (with compId query param)
- [ ] **Local:** Return `VITE_LOCAL_SERVER` as socketUrl
- [ ] Handle errors: invalid compId, missing vmAddress, VM unreachable
- [ ] Reconnect when vmAddress changes in Firebase (coordinator handles routing)

### 3.2 Update App Router

**File:** `show-controller/src/App.jsx` (MODIFY)

```jsx
<Routes>
  {/* Competition selector (landing page) */}
  <Route path="/select" element={<CompetitionSelector />} />
  <Route path="/" element={<Navigate to="/select" replace />} />

  {/* Competition-scoped routes */}
  <Route path="/:compId" element={<CompetitionLayout />}>
    <Route path="producer" element={<ProducerView />} />
    <Route path="talent" element={<TalentView />} />
    <Route path="camera-setup" element={<CameraSetupPage />} />
    <Route path="graphics" element={<GraphicsControl />} />
    <Route index element={<Navigate to="producer" replace />} />
  </Route>

  {/* Legacy routes - redirect to selector with redirect param */}
  <Route path="/producer" element={<Navigate to="/select?redirect=/producer" replace />} />
  <Route path="/talent" element={<Navigate to="/select?redirect=/talent" replace />} />
  <Route path="/camera-setup" element={<Navigate to="/select?redirect=/camera-setup" replace />} />

  {/* Standalone pages (no competition context needed) */}
  <Route path="/hub" element={<HubPage />} />
  <Route path="/dashboard" element={<DashboardPage />} />
  <Route path="/url-generator" element={<UrlGeneratorPage />} />
  <Route path="/media-manager" element={<MediaManagerPage />} />
  <Route path="/import" element={<ImportView />} />
</Routes>
```

### 3.3 Competition Layout Component

**File:** `show-controller/src/components/CompetitionLayout.jsx` (NEW)

**Purpose:** Wraps competition-scoped routes with context providers and error handling

**Acceptance Criteria:**
- [ ] Wraps children with `CompetitionProvider`
- [ ] Shows loading spinner while fetching config
- [ ] Shows `CompetitionError` component on errors
- [ ] Wraps content with `ShowProvider` when ready
- [ ] Renders `<Outlet />` for nested routes

### 3.4 Competition Selector Page

**File:** `show-controller/src/pages/CompetitionSelector.jsx` (NEW)

**Purpose:** Landing page showing all competitions with quick-connect buttons

**Features:**
- [ ] Fetch all competitions from Firebase `competitions/` collection
- [ ] Group by: Today, Tomorrow, Upcoming, Past
- [ ] Show: event name, gender badge (MAG/WAG), date, venue, teams
- [ ] Show VM status indicator (🟢 Online / 🔴 Offline / ⚪ No VM)
- [ ] Quick-connect buttons: [Producer] [Talent] [Graphics]
- [ ] Search/filter competitions by name
- [ ] Local Development option at top
- [ ] Handle `?redirect=` query param to auto-navigate after selection

**Wireframe:**
```
┌─────────────────────────────────────────────────────────────┐
│  Select Competition                              [+ Create] │
├─────────────────────────────────────────────────────────────┤
│  🔍 Search competitions...                                  │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Local Development                                   │   │
│  │  Connect to localhost:3003                          │   │
│  │  [Producer]  [Camera Setup]                         │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  TODAY                                                      │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  UCLA vs Stanford               WAG     🟢 Online   │   │
│  │  7:00 PM • Pauley Pavilion                          │   │
│  │  [Producer]  [Talent]  [Graphics]                   │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  THIS WEEK                                                  │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  PAC-12 Championships           WAG     🔴 Offline  │   │
│  │  Sat, Jan 18 • Salt Lake City                       │   │
│  │  [Producer]  [Talent]  [Graphics]                   │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 3.5 Competition Header Component

**File:** `show-controller/src/components/CompetitionHeader.jsx` (NEW)

**Purpose:** Sticky header showing active competition info

**Acceptance Criteria:**
- [ ] Display: event name, gender badge (MAG/WAG)
- [ ] Display: venue, team names
- [ ] "← Change" link to competition selector
- [ ] Connection status indicator (green/red dot)
- [ ] OBS connection status
- [ ] VM address display (for debugging)

### 3.6 Competition Error Component

**File:** `show-controller/src/components/CompetitionError.jsx` (NEW)

**Error States:**

| Error Type | Message | Action |
|------------|---------|--------|
| `NOT_FOUND` | "Competition not found" | Link to `/select` |
| `NO_VM_ADDRESS` | "This competition is not configured for show control" | Link to configure |
| `VM_UNREACHABLE` | "Cannot connect to show server" | Retry button, show VM address |
| `FIREBASE_ERROR` | "Error loading competition" | Retry button |

### 3.7 Update ShowContext for Dynamic Connection

**File:** `show-controller/src/context/ShowContext.jsx` (MODIFY)

**CRITICAL:** The frontend uses Socket.io events for OBS commands, NOT REST API calls. REST API routes in `server/routes/obs.js` use `obsStateSync` which only works for LOCAL development. In production, OBS connections are managed per-competition by `obsConnectionManager`.

**Changes Required:**
- [ ] Import `useCompetition` from CompetitionContext
- [ ] Remove hardcoded `VITE_SOCKET_SERVER` usage
- [ ] Get `socketUrl` from CompetitionContext
- [ ] **Pass `compId` in Socket.io query** - Coordinator uses this to route to correct VM
- [ ] Only attempt socket connection when `socketUrl` is available
- [ ] Disconnect and reconnect when `socketUrl` changes
- [ ] Clear all state when competition changes
- [ ] Use Socket.io events (not REST) for all OBS operations

**Before:**
```javascript
const SOCKET_URL = import.meta.env.VITE_SOCKET_SERVER || 'http://localhost:3003';
const socket = io(SOCKET_URL);
```

**After:**
```javascript
const { socketUrl, compId, isLocalMode } = useCompetition();

useEffect(() => {
  if (!socketUrl) return;

  // CRITICAL: Pass compId so coordinator can route to correct VM
  const socket = io(socketUrl, {
    query: { compId },  // Coordinator uses this for routing
    transports: ['websocket', 'polling'],
    reconnection: true,
  });
  socketRef.current = socket;

  // ... connection logic ...

  return () => {
    socket.disconnect();
    // Clear all state
    setCameraHealth([]);
    setCameraRuntimeState([]);
    // etc.
  };
}, [socketUrl, compId]);
```

**OBS Operations - Use Socket Events, NOT REST:**

```javascript
// WRONG - REST API fails in production
const response = await fetch(`${socketUrl}/api/obs/inputs/${sourceName}`);

// RIGHT - Socket event routes through obsConnectionManager
socket.emit('obs:getInputSettings', { inputName: sourceName }, (data) => {
  // Handle response
});
```

See [README-OBS-Architecture.md](README-OBS-Architecture.md#socket-event-flow) for the complete list of socket events.

### 3.8 Update useCompetitions Hook

**File:** `show-controller/src/hooks/useCompetitions.js` (MODIFY)

**New Functions:**

```javascript
// Validate VM address format (host:port, no protocol)
function isValidVmAddress(address) {
  if (!address) return false;
  const pattern = /^[\w.-]+:\d+$/;
  return pattern.test(address);
}

// Update VM address for a competition
// NOTE: This address is used by the COORDINATOR to route traffic,
// not by the frontend to connect directly.
async function updateVmAddress(compId, vmAddress) {
  if (!isValidVmAddress(vmAddress)) {
    throw new Error('Invalid VM address format. Use host:port');
  }
  await update(ref(db, `competitions/${compId}/config`), { vmAddress });
}

// Check VM status via coordinator API (not direct connection)
async function checkVmStatus(compId) {
  try {
    const response = await fetch(`https://api.commentarygraphic.com/api/coordinator/status`, {
      signal: AbortSignal.timeout(5000),
    });
    const data = await response.json();
    // Check if this competition's VM is connected
    const vmStatus = data.connections?.find(c => c.compId === compId);
    return {
      online: vmStatus?.connected ?? false,
      obsConnected: vmStatus?.obsConnected ?? false
    };
  } catch {
    return { online: false, obsConnected: false };
  }
}
```

**IMPORTANT:** The `checkVmStatus` function queries the **coordinator**, not the VM directly. The frontend cannot reach VMs directly due to HTTPS/mixed content restrictions.

**Acceptance Criteria:**
- [ ] `isValidVmAddress('3.81.127.185:3003')` returns `true`
- [ ] `isValidVmAddress('http://3.81.127.185:3003')` returns `false` (no protocol)
- [ ] `isValidVmAddress('localhost')` returns `false` (needs port)
- [ ] `updateVmAddress` validates before saving
- [ ] `checkVmStatus` queries coordinator API, not VM directly

---

## Phase 4: Dynamic Apparatus UI

**Goal:** Camera setup and runtime panels use gender-appropriate apparatus

### 4.1 Update CameraSetupPage

**File:** `show-controller/src/pages/CameraSetupPage.jsx` (MODIFY)

**Before:**
```jsx
// Hardcoded - WRONG for WAG
const APPARATUS_OPTIONS = [
  { value: 'FX', label: 'Floor Exercise' },
  { value: 'PH', label: 'Pommel Horse' },
  { value: 'SR', label: 'Still Rings' },
  { value: 'VT', label: 'Vault' },
  { value: 'PB', label: 'Parallel Bars' },
  { value: 'HB', label: 'High Bar' }
];
```

**After:**
```jsx
import { useCompetition } from '../context/CompetitionContext';
import { useApparatus } from '../hooks/useApparatus';

export default function CameraSetupPage() {
  const { gender, competitionConfig } = useCompetition();
  const { apparatus } = useApparatus(gender);

  // Convert to options format
  const APPARATUS_OPTIONS = apparatus.map(a => ({
    value: a.code,
    label: a.name,
  }));

  // ... rest of component uses APPARATUS_OPTIONS as before ...
}
```

**Acceptance Criteria:**
- [ ] WAG competitions show VT, UB, BB, FX options
- [ ] MAG competitions show FX, PH, SR, VT, PB, HB options
- [ ] Competition name and gender badge in page header
- [ ] Load/save cameras via socket (not direct Firebase)

### 4.2 Update CameraRuntimePanel

**File:** `show-controller/src/components/CameraRuntimePanel.jsx` (MODIFY)

**Changes Required:**
- [ ] Get gender from CompetitionContext
- [ ] Use `useApparatus(gender)` for apparatus display
- [ ] Update reassign dropdown to show correct apparatus
- [ ] Validate apparatus codes against gender

### 4.3 Update QuickActions

**File:** `show-controller/src/components/QuickActions.jsx` (MODIFY)

**Changes Required:**
- [ ] Get gender from CompetitionContext
- [ ] Use `useApparatus(gender)` for quick-switch buttons
- [ ] Render 4 buttons for WAG, 6 buttons for MAG
- [ ] Adjust grid layout: `grid-cols-4` for WAG, `grid-cols-6` for MAG

---

## Phase 5: Hook & Context Updates

### 5.1 Update ShowContext Integration

**File:** `show-controller/src/context/ShowContext.jsx` (MODIFY)

**Changes Required:**
- [ ] Import `useCompetition` from CompetitionContext
- [ ] Remove hardcoded socket URL
- [ ] Scope camera state to current connection
- [ ] Clear all state when connection changes
- [ ] Pass `compId` with socket events for server-side logging

### 5.2 Existing Hooks (Minimal Changes)

**`useCameraHealth.js`, `useCameraRuntime.js`, `useTimesheet.js`:**
- These hooks get data from ShowContext
- No changes needed to their interfaces
- They will automatically get competition-scoped data

---

## Phase 6: Migration & Compatibility

### 6.1 Migration Script

**File:** `server/scripts/migrateToFirebase.js` (NEW)

**Purpose:** Migrate existing `show-config.json` to a competition's production config

**Usage:**
```bash
node server/scripts/migrateToFirebase.js ucla-stanford-2026 womens
```

**Acceptance Criteria:**
- [ ] Prompts for competition ID and gender
- [ ] Reads `show-config.json`
- [ ] Validates cameras against competition's gender
- [ ] Warns if apparatus codes don't match gender
- [ ] Writes to `competitions/{id}/production/`
- [ ] Prints migration summary

### 6.2 Config Loader with Fallback

**File:** `server/lib/configLoader.js` (NEW)

**Purpose:** Load config from Firebase or fallback to file

```javascript
let activeCompetitionId = null;

export async function loadShowConfig() {
  // If active competition is set, load from Firebase
  if (activeCompetitionId) {
    const production = await productionConfigService.getProductionConfig(activeCompetitionId);
    if (production) {
      return {
        cameras: Object.values(production.cameras || {}),
        segments: production.rundown?.segments || [],
        nimbleServer: production.settings?.nimbleServer,
        audioConfig: production.settings?.audioConfig,
        graphicsOverlay: production.settings?.graphicsOverlay,
        transitions: production.settings?.transitions,
      };
    }
  }

  // Fall back to local file
  return JSON.parse(readFileSync('./config/show-config.json', 'utf-8'));
}

export function setActiveCompetition(competitionId) {
  activeCompetitionId = competitionId;
}
```

### 6.3 Local Development Mode

For local development without Firebase/VM:
```
http://localhost:5173/local/producer
```

The special `compId="local"` triggers fallback to `VITE_LOCAL_SERVER` environment variable.

---

## Environment Variables

### Show-Controller (.env)

```bash
# REMOVE (no longer needed):
# VITE_SOCKET_SERVER=http://3.81.127.185:3003

# KEEP for local development:
VITE_LOCAL_SERVER=http://localhost:3003

# Firebase (unchanged):
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_DATABASE_URL=...
VITE_FIREBASE_PROJECT_ID=...
```

### Server (.env)

```bash
# Firebase Admin (for production config service):
FIREBASE_DATABASE_URL=https://your-project.firebaseio.com
GOOGLE_APPLICATION_CREDENTIALS=./firebase-service-account.json
```

---

## File Manifest

### New Files

| File | Phase | Est. Lines | Purpose |
|------|-------|------------|---------|
| `server/lib/apparatusConfig.js` | 1 | 60 | Apparatus utilities |
| `server/lib/productionConfigService.js` | 2 | 120 | Firebase production config |
| `server/lib/configLoader.js` | 6 | 50 | Config loading with fallback |
| `server/scripts/migrateToFirebase.js` | 6 | 80 | Migration script |
| `show-controller/src/hooks/useApparatus.js` | 1 | 40 | Apparatus hook |
| `show-controller/src/context/CompetitionContext.jsx` | 3 | 120 | Competition context |
| `show-controller/src/components/CompetitionLayout.jsx` | 3 | 50 | Layout wrapper |
| `show-controller/src/components/CompetitionHeader.jsx` | 3 | 60 | Header component |
| `show-controller/src/components/CompetitionError.jsx` | 3 | 60 | Error component |
| `show-controller/src/pages/CompetitionSelector.jsx` | 3 | 180 | Landing page |

### Modified Files

| File | Phase | Changes |
|------|-------|---------|
| `server/index.js` | 2 | Add production config endpoints |
| `show-controller/src/App.jsx` | 3 | New route structure with /:compId |
| `show-controller/src/context/ShowContext.jsx` | 3, 5 | Dynamic socket URL |
| `show-controller/src/hooks/useCompetitions.js` | 3 | vmAddress validation |
| `show-controller/src/pages/CameraSetupPage.jsx` | 4 | Dynamic apparatus |
| `show-controller/src/components/CameraRuntimePanel.jsx` | 4 | Dynamic apparatus |
| `show-controller/src/components/QuickActions.jsx` | 4 | Dynamic apparatus buttons |

---

## Testing Checklist

### Unit Tests

- [ ] `apparatusConfig.js` - returns correct apparatus for each gender
- [ ] `useApparatus` hook - memoization, default gender handling
- [ ] `isValidVmAddress` - validates host:port format correctly
- [ ] `CompetitionContext` - extracts compId, handles "local" mode

### Integration Tests

- [ ] Navigation from `/select` to `/{compId}/producer` connects to VM
- [ ] Direct link loads competition from Firebase
- [ ] VM address change in Firebase triggers socket reconnection
- [ ] Multiple browser tabs can connect to different VMs
- [ ] `/local/producer` uses `VITE_LOCAL_SERVER`
- [ ] Legacy `/producer` redirects to `/select?redirect=/producer`

### E2E Tests

- [ ] Full flow: Select competition → Producer view → Start show → Control
- [ ] Create competition with vmAddress → Connect → Verify OBS status
- [ ] WAG competition shows 4 apparatus in CameraSetupPage
- [ ] MAG competition shows 6 apparatus in CameraSetupPage
- [ ] Error handling: Invalid compId shows "Competition not found"
- [ ] Error handling: Missing vmAddress shows configuration prompt
- [ ] Error handling: VM offline shows retry button

---

## Success Criteria

1. ✅ URL `/{compId}/producer` connects to competition's VM
2. ✅ WAG competitions show VT/UB/BB/FX apparatus
3. ✅ MAG competitions show FX/PH/SR/VT/PB/HB apparatus
4. ✅ `/select` page lists all competitions with VM status
5. ✅ vmAddress changes in Firebase trigger reconnection
6. ✅ `/local/producer` works for development
7. ✅ Multiple browser tabs can control different competitions
8. ✅ Production configs stored per-competition in Firebase

---

## Development Phases Summary

| Phase | Focus | Deliverables |
|-------|-------|--------------|
| 1 | Apparatus Config | `apparatusConfig.js`, `useApparatus.js` |
| 2 | Firebase Production | `productionConfigService.js`, API endpoints |
| 3 | URL Routing | Router changes, CompetitionContext, CompetitionSelector |
| 4 | Dynamic UI | CameraSetupPage, CameraRuntimePanel, QuickActions updates |
| 5 | Hook Updates | ShowContext modifications |
| 6 | Migration | Migration script, config loader, fallback mode |

---

## Appendix A: Competition Config Full Schema

```typescript
interface CompetitionConfig {
  // Identity
  eventName: string;
  compType: 'womens-dual' | 'womens-tri' | 'womens-quad' | 'mens-dual' | 'mens-tri' | 'mens-quad' | 'mens-5' | 'mens-6';
  gender: 'womens' | 'mens';

  // External IDs
  virtiusSessionId?: string;

  // Event Details
  meetDate: string;        // ISO date string
  venue: string;
  location: string;

  // VM Configuration (NEW)
  vmAddress: string;       // host:port format, e.g., "3.81.127.185:3003"

  // Teams
  team1Name: string;
  team1Logo: string;
  team2Name: string;
  team2Logo: string;
  // ... team3-6 for multi-team meets
}
```

## Appendix B: Example URLs & Connection Flow

| URL | Competition | Frontend Connects To | Coordinator Routes To |
|-----|-------------|---------------------|----------------------|
| `/ucla-stanford-2026/producer` | ucla-stanford-2026 | `wss://api.commentarygraphic.com` | 3.81.127.185:3003 |
| `/ucla-stanford-2026/talent` | ucla-stanford-2026 | `wss://api.commentarygraphic.com` | 3.81.127.185:3003 |
| `/pac12-champs/producer` | pac12-champs | `wss://api.commentarygraphic.com` | 54.209.98.89:3003 |
| `/local/producer` | (local dev) | `ws://localhost:3003` | N/A (direct) |
| `/select` | - | - | - |

**Key Point:** The "VM Address" in Firebase is used by the **coordinator** to know where to forward requests. The frontend always connects to `api.commentarygraphic.com` in production.

---

---

## Appendix C: Related Documents & Architecture References

### OBS Architecture

This PRD's connection architecture MUST align with the OBS integration system. Key points:

| Aspect | This PRD Says | OBS Architecture Confirms |
|--------|---------------|---------------------------|
| Frontend connects to | Coordinator (production) | ✅ Frontend → api.commentarygraphic.com |
| vmAddress used by | Coordinator to route | ✅ Coordinator looks up VM for compId |
| OBS commands sent via | Socket.io events | ✅ Never REST API in production |
| OBS runs on | Competition VMs | ✅ Not coordinator |

**Required Reading:** [README-OBS-Architecture.md](README-OBS-Architecture.md)

#### VM Inventory Reference

| VM Type | Purpose | Address |
|---------|---------|---------|
| Coordinator | Central hub, proxy OBS connections | 44.193.31.120 (api.commentarygraphic.com) |
| Competition VMs | Run OBS Studio, Show Server | Dynamic IPs from VM pool |
| Frontend Server | Static React SPA hosting | 3.87.107.201 (commentarygraphic.com) |

#### Key Network Ports

| Port | VM | Service | Access |
|------|-----|---------|--------|
| 443 | Coordinator | nginx (HTTPS) | Public |
| 3001 | Coordinator | Node.js server | Internal (proxied via nginx) |
| 3003 | Competition VM | Show Server | Public |
| 4455 | Competition VM | OBS WebSocket | localhost only |
| 9001-9010 | Competition VM | SRT camera inputs | Public |

#### Socket Event Flow

When the frontend connects with `compId`, the following sequence occurs:

1. Frontend connects to `wss://api.commentarygraphic.com` with `{ query: { compId } }`
2. Coordinator receives connection, joins socket to `competition:{compId}` room
3. Coordinator looks up VM address from `competitions/{compId}/config/vmAddress`
4. Coordinator establishes OBS WebSocket connection to VM if not already connected
5. OBS commands from frontend are forwarded to the correct VM
6. OBS events are broadcast back to all clients in the competition room

**Key Socket Events (Frontend → Coordinator):**

| Event | Purpose |
|-------|---------|
| `obs:refreshState` | Request full OBS state |
| `switchScene` | Switch OBS scene |
| `obs:createScene` | Create new scene |
| `obs:toggleItemVisibility` | Show/hide source |
| `obs:setVolume` | Set audio volume |
| `obs:getInputSettings` | Get input settings |

**Key Socket Events (Coordinator → Frontend):**

| Event | Purpose |
|-------|---------|
| `obs:stateUpdated` | Full state update |
| `obs:connected` | OBS connection established |
| `obs:disconnected` | OBS connection lost |
| `obs:currentSceneChanged` | Scene switched in OBS |

### Advanced Rundown Editor Integration

The `production/rundown/` path defined in this PRD's Firebase structure is consumed by the Advanced Rundown Editor. The editor also depends on:

- **Graphics Registry:** `system/graphics/registry` - System-wide graphics definitions with categories (pre-meet, stream, event-frame, leaderboard, summary, live)
- **OBS State Sync:** Scene/transition/audio data from OBS
- **Camera Config:** `competitions/{compId}/production/cameras` - Camera assignments and SRT URLs

**Related PRD:** [PRD-AdvancedRundownEditor-2026-01-16.md](PRD-AdvancedRundownEditor-2026-01-16.md)

#### Rundown Segment Data Model

Segments in `production/rundown/segments` follow this structure:

```typescript
interface Segment {
  id: string;
  name: string;
  type: 'video' | 'live' | 'static' | 'break' | 'hold' | 'graphic';
  timing: { duration: number; autoAdvance: boolean; };
  obs: { sceneId: string; transition: { type: string; duration: number; }; };
  camera?: { cameraId: string; intendedApparatus: string[]; };
  audio: { preset: string; levels?: Record<string, number>; };
  graphics: { primary?: GraphicConfig; secondary?: GraphicConfig[]; };
  milestone?: { type: string; label: string; };
  order: number;
}
```

The rundown editor uses **milestones** to track key points in the show (show-start, first-routine, rotation-start, halftime-start, meet-end) for time calculations and selection summaries.

### VDO.Ninja Talent Integration

For talent communication via VDO.Ninja, note the distinction between URL types:

| URL Type | Firebase Path | Purpose |
|----------|---------------|---------|
| `talentUrls` (push) | `config/talentComms/vdoNinja/talentUrls` | For talent to JOIN and broadcast |
| `obsViewUrls` (view) | `config/talentComms/vdoNinja/obsViewUrls` | For OBS browser sources to VIEW |

OBS templates must use `obsViewUrls`, not `talentUrls`, to display talent video feeds.

### Key Architecture Constraints

1. **No direct VM connections from frontend** - Always route through coordinator in production
2. **Two OBS subsystems exist:**
   - `obsConnectionManager` (production, per-competition) - Manages WebSocket connections to each competition's VM
   - `obsStateSync` (local development only) - Single local OBS connection
3. **Socket events for OBS operations** - REST API routes only work in local mode
4. **compId in Socket.io query** - Required for coordinator to route correctly
5. **MCP tools are main-conversation only** - Task subagents cannot access Playwright or gymnastics MCP tools

### Deploying Changes

#### Frontend Changes
```bash
./scripts/deploy-frontend.sh
```
Deploys React SPA, overlays directory, and output.html to commentarygraphic.com.

#### Coordinator Changes
```bash
ssh_exec target="coordinator" command="cd /opt/gymnastics-graphics && sudo git pull --rebase origin main && pm2 restart coordinator"
```

Changes to `server/index.js`, `obsConnectionManager.js`, `vmPoolManager.js`, or `awsService.js` require coordinator deployment.

---

*Generated with Claude Code - January 13, 2026*
*Updated January 21, 2026 - Added OBS architecture alignment notes, socket events, VDO.Ninja, deployment instructions*
