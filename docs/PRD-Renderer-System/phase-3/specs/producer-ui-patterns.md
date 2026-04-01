# Spec: Producer UI Patterns

## What

How existing Producer View sidebar panels work, including component patterns, Firebase listeners, and controls. This informs the design of the "Scoring Feed" panel (Task 6).

## Current State

### Sidebar Structure (ProducerView.jsx)

**Right column location:** Lines 1265-1500

**Panel order (top to bottom):**
1. OverrideLog (line 1267)
2. AlertPanel (line 1269-1275)
3. ThemeErrorLog (line 1277-1283)
4. ScoreBugPanel (line 1285-1286)
5. VMConnectionPanel (line 1289-1294)
6. AI Context Panel (line 1296-1438)
7. CameraRuntimePanel / ClipQueuePanel (line 1440-1465)
8. GraphicsControl (line 1467-1468)
9. Connected Clients & Show Stats (line 1470-1500)

### Collapsible Panel Pattern

**Common structure (ScoreBugPanel.jsx:204-224):**

```jsx
<div className="bg-zinc-800 rounded-xl overflow-hidden">
  {/* Header button */}
  <button
    onClick={() => setCollapsed(!collapsed)}
    className="w-full flex items-center justify-between px-4 py-3
               bg-zinc-800 hover:bg-zinc-700/50 transition-colors"
  >
    <div className="flex items-center gap-2">
      <ChartBarIcon className="w-5 h-5 text-zinc-400" />
      <span className="font-medium text-white">Score Bug</span>
      {/* Status badge */}
      {scoreBugState.enabled && (
        <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">
          ON
        </span>
      )}
    </div>
    {collapsed ? (
      <ChevronDownIcon className="w-5 h-5 text-zinc-400" />
    ) : (
      <ChevronUpIcon className="w-5 h-5 text-zinc-400" />
    )}
  </button>

  {/* Content area - conditional */}
  {!collapsed && (
    <div className="p-4 pt-0 space-y-3">
      {/* Panel content */}
    </div>
  )}
</div>
```

### Firebase Listener Pattern

**useThemeErrors.js (lines 14-55):**

```jsx
useEffect(() => {
  if (!compId) {
    setErrors([]);
    setLoading(false);
    return;
  }

  const errorsRef = ref(db, `competitions/${compId}/production/themeErrors`);

  const unsubscribe = onValue(
    errorsRef,
    (snapshot) => {
      const data = snapshot.val();
      if (!data) {
        setErrors([]);
        setLoading(false);
        return;
      }

      // Convert object to array with IDs
      const errorArray = Object.entries(data)
        .map(([id, error]) => ({ id, ...error }))
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

      setErrors(errorArray);
      setLoading(false);
    },
    (error) => {
      console.error('useThemeErrors subscription error:', error);
      setLoading(false);
    }
  );

  return () => unsubscribe();
}, [compId]);
```

**Key pattern:**
- Guard check for `compId`
- `onValue` for real-time updates
- Error callback for listener errors
- Return cleanup function
- Object-to-array conversion with sorting

### Firebase Write Pattern

**ScoreBugPanel.jsx (lines 107-155):**

```jsx
// Toggle control
const handleToggle = async (field, currentValue) => {
  const newValue = !currentValue;
  await set(ref(db, `competitions/${compId}/scoreBug/${field}`), newValue);
};

// Dropdown control
const handleIntervalChange = async (newInterval) => {
  await set(ref(db, `competitions/${compId}/scoreBug/config/pollInterval`), newInterval);
};

// Direct set for simple values
await set(ref(db, `competitions/${compId}/scoreBug/enabled`), newState);
```

### Control Types in Panels

#### Toggle Switch (ScoreBugPanel)

```jsx
<div className="flex items-center justify-between">
  <div className="flex items-center gap-2">
    <span className="text-sm text-zinc-300">Enabled</span>
    {scoreBugState.enabled && (
      <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-[10px] rounded">
        ACTIVE
      </span>
    )}
  </div>
  <button
    onClick={() => handleToggle('enabled', scoreBugState.enabled)}
    className={`w-11 h-6 rounded-full transition-colors ${
      scoreBugState.enabled ? 'bg-green-500' : 'bg-zinc-600'
    }`}
  >
    <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
      scoreBugState.enabled ? 'translate-x-5' : 'translate-x-0.5'
    }`} />
  </button>
</div>
```

#### Dropdown Selector (ScoreBugPanel)

```jsx
<div className="flex items-center justify-between">
  <span className="text-sm text-zinc-300">Poll Frequency</span>
  <select
    value={scoreBugState.config?.pollInterval || 5000}
    onChange={(e) => handleIntervalChange(parseInt(e.target.value))}
    className="bg-zinc-700 text-white text-sm px-2 py-1 rounded"
  >
    <option value={2000}>2s</option>
    <option value={5000}>5s</option>
    <option value={10000}>10s</option>
    <option value={30000}>30s</option>
  </select>
</div>
```

#### Status Display (HeartbeatIndicator in ScoreBugPanel:21-76)

```jsx
function HeartbeatIndicator({ lastPoll, polling }) {
  const [timeAgo, setTimeAgo] = useState('');

  useEffect(() => {
    const updateTimeAgo = () => {
      if (!lastPoll) {
        setTimeAgo('Never');
        return;
      }
      const seconds = Math.floor((Date.now() - lastPoll) / 1000);
      if (seconds < 60) setTimeAgo(`${seconds}s ago`);
      else if (seconds < 3600) setTimeAgo(`${Math.floor(seconds / 60)}m ago`);
      else setTimeAgo(`${Math.floor(seconds / 3600)}h ago`);
    };

    updateTimeAgo();
    const interval = setInterval(updateTimeAgo, 1000);
    return () => clearInterval(interval);
  }, [lastPoll]);

  return (
    <div className="flex items-center gap-2">
      <div className={`w-2 h-2 rounded-full ${
        polling ? 'bg-green-500 animate-pulse' : 'bg-zinc-500'
      }`} />
      <span className="text-xs text-zinc-400">
        {polling ? `Last poll: ${timeAgo}` : 'Stopped'}
      </span>
    </div>
  );
}
```

#### Manual Action Button

```jsx
<button
  onClick={handleManualRefresh}
  disabled={isRefreshing}
  className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white text-sm rounded
             disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
>
  <ArrowPathIcon className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
  Refresh
</button>
```

#### Error Display (ScoreBugPanel)

```jsx
{scoreBugState?.status?.error && (
  <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
    <div className="flex items-center gap-2">
      <ExclamationTriangleIcon className="w-4 h-4 text-red-400 flex-shrink-0" />
      <span className="text-sm text-red-400 font-medium">API Error</span>
    </div>
    <p className="text-xs text-red-300/80 mt-1 ml-6">
      {scoreBugState.status.error.message || 'Unknown error'}
    </p>
  </div>
)}
```

### Empty/Loading States

**Loading (ScoreBugPanel):**
```jsx
if (scoreBugState === null) {
  return (
    <div className="bg-zinc-800 rounded-xl p-4">
      <div className="flex items-center gap-2 text-zinc-400">
        <ChartBarIcon className="w-5 h-5" />
        <span className="font-medium">Score Bug</span>
      </div>
      <div className="text-center py-4 text-zinc-500 text-sm">
        Loading...
      </div>
    </div>
  );
}
```

**Empty (AlertPanel):**
```jsx
if (alerts.length === 0) {
  return (
    <div className="bg-zinc-800 rounded-xl p-4">
      <div className="text-center py-4 text-zinc-500 text-sm">
        No active alerts
      </div>
    </div>
  );
}
```

**Hidden when empty (ThemeErrorLog):**
```jsx
if (errors.length === 0) {
  return null;  // Panel doesn't render at all
}
```

## Target State

### Scoring Feed Panel Design

Based on existing patterns, the Scoring Feed panel should follow this structure:

**Position:** After ThemeErrorLog, before ScoreBugPanel (line ~1284)

**Component:** `ScoringFeedPanel.jsx` or inline in ProducerView

**Hook:** `useScoringFeed.js` for Firebase listener

**Structure:**
```jsx
<div className="bg-zinc-800 rounded-xl overflow-hidden">
  <button onClick={() => setCollapsed(!collapsed)} className="...">
    <div className="flex items-center gap-2">
      <SignalIcon className="w-5 h-5 text-zinc-400" />
      <span className="font-medium text-white">Scoring Feed</span>
      {/* Status badge */}
      {feedState.enabled ? (
        <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">
          LIVE · {feedState.pollInterval}s
        </span>
      ) : (
        <span className="px-2 py-0.5 bg-zinc-600/50 text-zinc-400 text-xs rounded-full">
          OFF
        </span>
      )}
    </div>
    <ChevronIcon />
  </button>

  {!collapsed && (
    <div className="p-4 pt-0 space-y-3">
      {/* Enable/Disable toggle */}
      <ToggleControl />

      {/* Poll interval dropdown */}
      <IntervalDropdown />

      {/* Last updated indicator */}
      <HeartbeatIndicator lastPoll={feedState.lastPollAt} polling={feedState.enabled} />

      {/* Status display */}
      <StatusBadge status={feedState.status} />

      {/* Error display (conditional) */}
      {feedState.status === 'error' && <ErrorDisplay message={feedState.errorMessage} />}

      {/* Manual refresh button */}
      <RefreshButton onClick={handleForceRefresh} />
    </div>
  )}
</div>
```

### useScoringFeed Hook

```jsx
function useScoringFeed(compId) {
  const [feedState, setFeedState] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!compId) {
      setFeedState(null);
      setLoading(false);
      return;
    }

    const feedRef = ref(db, `competitions/${compId}/config/scoringFeed`);
    const unsubscribe = onValue(feedRef, (snapshot) => {
      setFeedState(snapshot.val() || {
        enabled: false,
        pollInterval: 15,
        lastPollAt: null,
        status: null,
        errorMessage: null
      });
      setLoading(false);
    });

    return () => unsubscribe();
  }, [compId]);

  const setEnabled = async (enabled) => {
    await set(ref(db, `competitions/${compId}/config/scoringFeed/enabled`), enabled);
  };

  const setPollInterval = async (seconds) => {
    await set(ref(db, `competitions/${compId}/config/scoringFeed/pollInterval`), seconds);
  };

  const forceRefresh = async () => {
    // Write timestamp to trigger immediate poll
    await set(ref(db, `competitions/${compId}/config/scoringFeed/forceRefresh`), Date.now());
  };

  return {
    feedState,
    loading,
    setEnabled,
    setPollInterval,
    forceRefresh
  };
}
```

## Risks

1. **Panel overflow:** Too many sidebar panels. Consider collapsing by default or grouping related panels.

2. **Duplicate status:** ScoreBugPanel already has polling controls. Ensure Scoring Feed panel controls different functionality.

3. **Confusion:** "Scoring Feed" vs "Score Bug" — need clear naming to distinguish.

## Open Questions

1. **Where exactly should the panel appear?** The PRD says "below Theme section, above Playout section." Need to map this to line numbers.

2. **Should the panel be hidden if no `virtiusSessionId` is configured?** Like how VMConnectionPanel is hidden when no VM is assigned.

3. **Should there be a socket event for force refresh?** Or is direct Firebase write (`forceRefresh: timestamp`) sufficient?
