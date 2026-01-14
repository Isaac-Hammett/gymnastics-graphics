# Specification: Competition-Based VM Routing

## Overview

This specification defines how the show-controller application dynamically connects to the correct VM server based on the competition being controlled. Each competition has its own dedicated VM running OBS and the Node.js server, and the show-controller must route to the correct VM based on the competition ID in the URL.

## Problem Statement

Currently, the show-controller connects to a hardcoded server URL defined in `.env`:

```
VITE_SOCKET_SERVER=http://3.81.127.185:3003
```

This creates operational problems:
1. Operators must manually edit `.env` and restart the dev server when switching competitions
2. Production builds are locked to a single VM address
3. Multiple concurrent competitions cannot be controlled from the same deployed app
4. VM IP addresses change when instances are stopped/started, requiring code changes

## Solution

Store the VM address in the existing Firebase competition config and resolve it at runtime based on the URL path.

---

## Data Model Changes

### Firebase Schema Update

**Path:** `competitions/{compId}/config`

**New Field:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `vmAddress` | string | Yes (for show control) | Full address of the VM server including port (e.g., `3.81.127.185:3003`) |

**Example:**

```javascript
// Firebase: competitions/ucla-stanford-2026/config
{
  // Existing fields
  eventName: "UCLA vs Stanford",
  compType: "womens-dual",
  gender: "womens",
  virtiusSessionId: "abc123",
  meetDate: "2026-01-15",
  venue: "Pauley Pavilion",
  location: "Los Angeles, CA",
  team1Name: "UCLA",
  team1Logo: "https://...",
  // ... other team fields ...

  // NEW FIELD
  vmAddress: "3.81.127.185:3003"
}
```

**Validation Rules:**
- Must be a valid `host:port` format
- Must not include protocol (`http://` or `ws://`) - protocol is determined by usage context
- Port is required (typically `3003`)
- Can be an IP address or hostname

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

**Examples:**
```
https://show.virtius.tv/ucla-stanford-2026/producer
https://show.virtius.tv/pac12-champs-2026/talent
https://show.virtius.tv/big10-finals/camera-setup
```

### Backwards Compatibility

Routes without `compId` should redirect to a competition selector page:

```
https://show.virtius.tv/producer → https://show.virtius.tv/select?redirect=/producer
```

---

## Component Architecture

### New Components

#### 1. CompetitionProvider

**Location:** `show-controller/src/context/CompetitionContext.jsx`

**Purpose:** Resolves `compId` from URL, fetches competition config from Firebase, and provides VM address to child components.

**Interface:**

```typescript
interface CompetitionContextValue {
  // State
  compId: string | null;
  competitionConfig: CompetitionConfig | null;
  vmAddress: string | null;
  isLoading: boolean;
  error: string | null;

  // Derived
  socketUrl: string | null;      // `http://${vmAddress}`
  websocketUrl: string | null;   // `ws://${vmAddress}`

  // Actions
  refreshConfig: () => Promise<void>;
}
```

**Behavior:**
1. Extract `compId` from URL path using React Router's `useParams()`
2. Subscribe to `competitions/{compId}/config` in Firebase
3. Extract `vmAddress` from config
4. Provide socket URLs to ShowContext
5. Handle errors (invalid compId, missing vmAddress, etc.)

#### 2. CompetitionSelector

**Location:** `show-controller/src/pages/CompetitionSelector.jsx`

**Purpose:** Landing page showing all active competitions with quick-connect buttons.

**Features:**
- List all competitions from Firebase `competitions/` collection
- Show competition name, date, teams, and VM status (online/offline)
- Click to navigate to `/{compId}/producer` or `/{compId}/talent`
- Search/filter competitions
- Show "Create New Competition" button (links to existing competition setup)

**Wireframe:**

```
┌─────────────────────────────────────────────────────────────┐
│  Select Competition                              [+ Create] │
├─────────────────────────────────────────────────────────────┤
│  🔍 Search competitions...                                  │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │  UCLA vs Stanford                        🟢 Online  │   │
│  │  Jan 15, 2026 • Pauley Pavilion                     │   │
│  │  [Producer]  [Talent]  [Graphics]                   │   │
│  └─────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  PAC-12 Championships                    🔴 Offline │   │
│  │  Mar 20, 2026 • Salt Lake City                      │   │
│  │  [Producer]  [Talent]  [Graphics]                   │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Modified Components

#### 1. App.jsx (Router)

**Changes:**
- Add `CompetitionProvider` wrapper inside router
- Update all routes to include optional `/:compId` prefix
- Add `/select` route for CompetitionSelector
- Add redirect logic for routes without compId

**New Route Structure:**

```jsx
<Routes>
  {/* Competition selector */}
  <Route path="/select" element={<CompetitionSelector />} />
  <Route path="/" element={<Navigate to="/select" />} />

  {/* Competition-scoped routes */}
  <Route path="/:compId" element={<CompetitionProvider />}>
    <Route path="producer" element={<ProducerView />} />
    <Route path="talent" element={<TalentView />} />
    <Route path="camera-setup" element={<CameraSetupPage />} />
    <Route path="graphics" element={<GraphicsControl />} />
    <Route index element={<Navigate to="producer" />} />
  </Route>

  {/* Legacy routes - redirect to selector */}
  <Route path="/producer" element={<Navigate to="/select?redirect=/producer" />} />
  <Route path="/talent" element={<Navigate to="/select?redirect=/talent" />} />
</Routes>
```

#### 2. ShowContext.jsx

**Changes:**
- Remove hardcoded `VITE_SOCKET_SERVER` usage
- Accept `socketUrl` from CompetitionContext
- Only attempt socket connection when `socketUrl` is available
- Handle reconnection when competition changes

**Before:**

```javascript
const SOCKET_URL = import.meta.env.VITE_SOCKET_SERVER || 'http://localhost:3003';
// ... later ...
const socket = io(SOCKET_URL);
```

**After:**

```javascript
const { socketUrl } = useCompetition();

useEffect(() => {
  if (!socketUrl) return;

  const socket = io(socketUrl);
  // ... connection logic ...

  return () => socket.disconnect();
}, [socketUrl]);
```

#### 3. GraphicsControl.jsx

**Changes:**
- Use `compId` from CompetitionContext instead of local state/dropdown
- Remove competition selector dropdown (competition is now in URL)
- Simplify component since competition is pre-selected

#### 4. useCompetitions.js Hook

**Changes:**
- Add `vmAddress` to competition creation flow
- Add validation for `vmAddress` format
- Add helper to check VM connectivity

**New Functions:**

```javascript
// Update VM address for a competition
async function updateVmAddress(compId, vmAddress) {
  if (!isValidVmAddress(vmAddress)) {
    throw new Error('Invalid VM address format. Use host:port (e.g., 3.81.127.185:3003)');
  }
  await update(ref(db, `competitions/${compId}/config`), { vmAddress });
}

// Check if VM is reachable
async function checkVmStatus(vmAddress) {
  try {
    const response = await fetch(`http://${vmAddress}/api/status`, {
      timeout: 5000
    });
    const data = await response.json();
    return { online: true, obsConnected: data.obsConnected };
  } catch (error) {
    return { online: false, obsConnected: false };
  }
}

// Validate VM address format
function isValidVmAddress(address) {
  const pattern = /^[\w.-]+:\d+$/;
  return pattern.test(address);
}
```

---

## User Flows

### Flow 1: Operator Opens Show Controller

```
1. Operator navigates to https://show.virtius.tv/
2. App redirects to /select (CompetitionSelector)
3. Operator sees list of competitions with status indicators
4. Operator clicks "Producer" on "UCLA vs Stanford"
5. App navigates to /ucla-stanford-2026/producer
6. CompetitionProvider loads config from Firebase
7. ShowContext connects to VM at config.vmAddress
8. ProducerView renders with live data from VM
```

### Flow 2: Operator Uses Direct Link

```
1. Operator receives link: https://show.virtius.tv/ucla-stanford-2026/producer
2. App loads CompetitionProvider with compId="ucla-stanford-2026"
3. CompetitionProvider fetches config from Firebase
4. ShowContext connects to VM
5. ProducerView renders
```

### Flow 3: VM Address Changes (IP Changed)

```
1. Admin notices VM has new IP address
2. Admin goes to competition setup/edit page
3. Admin updates vmAddress field to new IP
4. Firebase updates in real-time
5. All connected clients automatically reconnect to new address
   (CompetitionProvider subscription triggers ShowContext reconnect)
```

### Flow 4: Creating New Competition

```
1. Operator clicks "Create Competition"
2. Competition setup form includes new "VM Address" field
3. Operator enters VM details along with other config
4. On save, competition is created with vmAddress
5. Operator can immediately navigate to producer view
```

---

## Error Handling

### Error States

| Error | User Message | Recovery Action |
|-------|--------------|-----------------|
| Invalid compId | "Competition not found" | Link to competition selector |
| Missing vmAddress | "This competition is not configured for show control" | Link to edit competition |
| VM unreachable | "Cannot connect to show server" | Show retry button, display VM address for debugging |
| VM address invalid format | "Invalid server address in competition config" | Link to edit competition |

### Error UI Component

**Location:** `show-controller/src/components/CompetitionError.jsx`

```jsx
function CompetitionError({ error, compId }) {
  return (
    <div className="error-container">
      <h2>Connection Error</h2>
      <p>{error.message}</p>

      {error.type === 'NOT_FOUND' && (
        <Link to="/select">Select a different competition</Link>
      )}

      {error.type === 'NO_VM_ADDRESS' && (
        <Link to={`/${compId}/settings`}>Configure VM address</Link>
      )}

      {error.type === 'VM_UNREACHABLE' && (
        <>
          <p>Server: {error.vmAddress}</p>
          <button onClick={retry}>Retry Connection</button>
        </>
      )}
    </div>
  );
}
```

---

## Environment Variables

### Removed

```
# No longer needed - remove from .env files
VITE_SOCKET_SERVER=http://3.81.127.185:3003
```

### Retained

```
# Keep for local development fallback
VITE_LOCAL_SERVER=http://localhost:3003

# Firebase config (unchanged)
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_DATABASE_URL=...
VITE_FIREBASE_PROJECT_ID=...
```

### Local Development Mode

For local development without a competition context:

```
https://localhost:5173/local/producer
```

The special `compId="local"` triggers fallback to `VITE_LOCAL_SERVER` environment variable, allowing developers to work without Firebase/VM setup.

---

## Migration Plan

### Phase 1: Add vmAddress to Firebase (Non-Breaking)

1. Add `vmAddress` field to existing competitions in Firebase
2. Update competition creation form to include vmAddress field
3. No changes to show-controller yet - existing flow continues to work

**Rollback:** Simply don't use the new field

### Phase 2: Add CompetitionProvider (Non-Breaking)

1. Create CompetitionContext and CompetitionProvider
2. Create CompetitionSelector page
3. Add new routes with `/:compId` prefix
4. Keep old routes working (they use env var)

**Rollback:** Remove new routes, revert to old routes

### Phase 3: Migrate ShowContext (Breaking)

1. Update ShowContext to use CompetitionContext for socket URL
2. Remove `VITE_SOCKET_SERVER` usage
3. Update all internal links to include compId
4. Redirect old routes to competition selector

**Rollback:** Revert ShowContext changes, restore env var usage

### Phase 4: Cleanup

1. Remove `VITE_SOCKET_SERVER` from all .env files
2. Update documentation
3. Update VM-SETUP.md to include vmAddress configuration step

---

## Testing Requirements

### Unit Tests

- [ ] CompetitionContext correctly extracts compId from URL
- [ ] CompetitionContext fetches config from Firebase
- [ ] CompetitionContext handles missing vmAddress
- [ ] CompetitionContext handles invalid compId
- [ ] isValidVmAddress validates correctly
- [ ] checkVmStatus returns correct status

### Integration Tests

- [ ] Navigation from selector to producer view connects to correct VM
- [ ] Direct link to competition loads correct VM
- [ ] VM address change triggers reconnection
- [ ] Multiple browser tabs can connect to different competitions
- [ ] Local development mode works with VITE_LOCAL_SERVER

### E2E Tests

- [ ] Full flow: Select competition → Producer view → Control show
- [ ] Full flow: Create competition with VM → Connect → Verify OBS status
- [ ] Error handling: Invalid competition ID shows error
- [ ] Error handling: VM offline shows retry option

---

## Security Considerations

1. **VM addresses are visible in Firebase** - This is acceptable as VMs are protected by security groups
2. **No authentication on show-controller** - Consider adding Firebase Auth in future
3. **CORS on VM servers** - Ensure VM servers allow requests from show.virtius.tv domain

---

## Future Enhancements

1. **Auto-provisioning**: Automatically spin up VM when creating competition
2. **VM health dashboard**: Central view of all VMs and their status
3. **Load balancing**: Multiple VMs per competition for redundancy
4. **Audit logging**: Track which operators accessed which competitions

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

  // Team 1
  team1Name: string;
  team1Logo: string;       // URL
  team1Ave?: number;       // Average score
  team1High?: number;      // Season high
  team1Con?: string;       // Conference
  team1Coaches?: string;   // Coach names

  // Team 2
  team2Name: string;
  team2Logo: string;
  team2Ave?: number;
  team2High?: number;
  team2Con?: string;
  team2Coaches?: string;

  // Teams 3-6 (for tri, quad, 5, 6-team competitions)
  team3Name?: string;
  // ... etc
}
```

## Appendix B: Socket Connection Lifecycle

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
                              ▼
                    ┌─────────────────┐
                    │ Subscribe to    │
                    │ Firebase config │
                    └─────────────────┘
                              │
                              ▼
                    ┌─────────────────┐
                    │ Config loaded?  │
                    └─────────────────┘
                         │       │
                    No   │       │ Yes
                         ▼       ▼
              ┌──────────────┐  ┌─────────────────┐
              │ Show loading │  │ Has vmAddress?  │
              │ state        │  └─────────────────┘
              └──────────────┘       │       │
                                No   │       │ Yes
                                     ▼       ▼
                          ┌──────────────┐  ┌─────────────────┐
                          │ Show error:  │  │ Connect socket  │
                          │ "No VM       │  │ to vmAddress    │
                          │ configured"  │  └─────────────────┘
                          └──────────────┘           │
                                                     ▼
                                          ┌─────────────────┐
                                          │ Connection      │
                                          │ successful?     │
                                          └─────────────────┘
                                               │       │
                                          No   │       │ Yes
                                               ▼       ▼
                                    ┌──────────────┐  ┌─────────────────┐
                                    │ Show error:  │  │ Ready!          │
                                    │ "Cannot      │  │ Render app      │
                                    │ connect"     │  └─────────────────┘
                                    │ + retry btn  │
                                    └──────────────┘
```

## Appendix C: Example URLs

| URL | Competition | View | VM Address (from Firebase) |
|-----|-------------|------|---------------------------|
| `/ucla-stanford-2026/producer` | ucla-stanford-2026 | Producer | 3.81.127.185:3003 |
| `/ucla-stanford-2026/talent` | ucla-stanford-2026 | Talent | 3.81.127.185:3003 |
| `/pac12-champs/producer` | pac12-champs | Producer | 54.209.98.89:3003 |
| `/pac12-champs/graphics` | pac12-champs | Graphics | 54.209.98.89:3003 |
| `/local/producer` | (local dev) | Producer | localhost:3003 |
| `/select` | - | Selector | - |
