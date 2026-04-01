# Spec: Competition Card Badges

## What

How badges work on competition cards in HomePage.jsx, including structure, state management, and click behaviors. This informs the design of the Scoring Feed badge (Task 5).

## Current State

### Competition Card Location

**File:** `show-controller/src/pages/HomePage.jsx`
**CompetitionCard component:** Lines 976-1166

### Existing Badge Types

| Badge | Location | Data Source | Click Behavior |
|-------|----------|-------------|----------------|
| Gender (MAG/WAG) | Header | `config.gender` | None (informational) |
| VM Status | Header | `vmStatuses` state | Hover shows IP tooltip |
| VM Indicator (dot) | Header | `vmStatuses` state | Hover shows status message |
| Stats Status | Dynamic area | Firebase `teamsDatabase/stats/{teamKey}/meta` | Refresh button emits socket event |
| Commentary | Dynamic area | Firebase `competitions/{compId}/commentary` | None (informational) |

### Badge Location in Card Structure

```
┌─────────────────────────────────────────┐
│ [VM Dot] [MAG/WAG] [VM Status]          │ ← Header badges (line 1008-1024)
│ Event Name                      compId   │
├─────────────────────────────────────────┤
│ Date - Venue                            │
│ Teams (teams.join(' vs '))              │
├─────────────────────────────────────────┤
│ [Stats Badge]        <- HERE            │ ← Dynamic badge area (line 1041-1046)
│ [Commentary Badge]   <- HERE            │
├─────────────────────────────────────────┤
│ VM: IP Address                          │
├─────────────────────────────────────────┤
│ [Producer] [Talent] [Graphics]...       │
└─────────────────────────────────────────┘
```

### Badge Styling Patterns

**Solid color (Gender, VM Status):**
```jsx
<span className={`px-2 py-0.5 rounded text-xs font-bold text-white ${colorClass}`}>
  {label}
</span>
```

Colors:
- Women's: `bg-pink-500`
- Men's: `bg-blue-500`
- VM Ready: `bg-green-500`
- VM Assigned: `bg-blue-500`
- VM In Use: `bg-purple-500`
- VM Starting: `bg-yellow-500`
- VM Error: `bg-red-500`

**Translucent with border (Stats, Commentary):**
```jsx
<span className={`px-2 py-0.5 rounded text-[10px] font-medium ${badgeColor}`}>
  {badgeText}
</span>
```

Colors:
- Success: `bg-green-500/20 text-green-400 border border-green-500/30`
- Warning: `bg-yellow-500/20 text-yellow-400 border border-yellow-500/30`
- Error: `bg-red-500/20 text-red-400 border border-red-500/30`
- Neutral: `bg-zinc-700 text-zinc-400`

### Stats Status Badge Implementation

**Component:** `StatsStatusBadge` from `components/StatsStatusBadge.jsx`

**Firebase listener (lines 40-44):**
```jsx
useEffect(() => {
  const teamKeys = [team1Key, team2Key, team3Key, team4Key].filter(Boolean);
  const listeners = [];

  teamKeys.forEach((key, i) => {
    const metaRef = ref(db, `teamsDatabase/stats/${key}/meta`);
    const unsubscribe = onValue(metaRef, (snapshot) => {
      setTeamMetas(prev => ({
        ...prev,
        [i + 1]: snapshot.val()
      }));
    });
    listeners.push(unsubscribe);
  });

  return () => listeners.forEach(fn => fn());
}, [team1Key, team2Key, team3Key, team4Key]);
```

**Status computation (lines 121-138):**
```jsx
const hasAnyStats = Object.values(teamMetas).some(m => m?.fetchedAt);
const anyError = Object.values(teamMetas).some(m => m?.status === 'error');
const anyPartial = Object.values(teamMetas).some(m => m?.status === 'partial');
const allComplete = hasAnyStats && Object.values(teamMetas).every(m => m?.status === 'complete');

if (anyError) {
  badgeColor = 'bg-red-500/20 text-red-400 border border-red-500/30';
  badgeText = 'Stats error';
} else if (anyPartial) {
  badgeColor = 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30';
  badgeText = 'Partial';
} else if (allComplete) {
  badgeColor = 'bg-green-500/20 text-green-400 border border-green-500/30';
  badgeText = 'Stats loaded';
} else {
  badgeColor = 'bg-zinc-700 text-zinc-400';
  badgeText = 'No stats';
}
```

**Refresh button (lines 153-160):**
```jsx
<button
  onClick={() => socket.emit('refreshRtnStats', { compId })}
  disabled={isRefreshing}
  className="p-1 hover:bg-zinc-700 rounded"
>
  <ArrowPathIcon className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} />
</button>
```

### Commentary Badge Implementation

**Inline component (HomePage.jsx:1696-1724):**

```jsx
function CommentaryStatusBadge({ compId }) {
  const [staff, setStaff] = useState(null);

  useEffect(() => {
    const staffRef = ref(db, `competitions/${compId}/commentary`);
    const unsubscribe = onValue(staffRef, (snapshot) => {
      setStaff(snapshot.val());
    });
    return () => unsubscribe();
  }, [compId]);

  if (!staff) return null;

  const staffList = Object.values(staff);
  const total = staffList.length;
  const confirmed = staffList.filter(s =>
    s.status === 'confirmed' || s.status === 'briefed'
  ).length;
  const allConfirmed = confirmed === total;

  return (
    <div className={`inline-flex items-center gap-1.5 mt-1 px-2 py-0.5 rounded text-xs font-medium ${
      allConfirmed
        ? 'bg-green-900/40 text-green-300 border border-green-800'
        : 'bg-yellow-900/40 text-yellow-300 border border-yellow-800'
    }`}>
      <span>{allConfirmed ? '✓' : '⋯'}</span>
      Commentary: {confirmed}/{total} confirmed
    </div>
  );
}
```

## Target State

### Scoring Feed Badge Design

**Location:** Dynamic badge area (line 1041-1046), alongside StatsStatusBadge

**States:**

| State | Badge Text | Color | Click |
|-------|------------|-------|-------|
| Polling active | "LIVE · 15s" | Green + pulsing dot | Toggle off (confirm dialog) |
| Polling stopped | "FEED OFF" | Gray | Toggle on |
| Error | "FEED ERROR" | Red | Show error details |
| No session | (hidden) | — | — |

**Implementation:**

```jsx
function ScoringFeedBadge({ compId }) {
  const [feedConfig, setFeedConfig] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    // Only show badge if virtiusSessionId is configured
    const configRef = ref(db, `competitions/${compId}/config`);
    const unsubscribe = onValue(configRef, (snapshot) => {
      const config = snapshot.val() || {};
      if (!config.virtiusSessionId) {
        setFeedConfig(null);
        return;
      }
      setFeedConfig({
        ...config.scoringFeed,
        hasSession: true
      });
    });
    return () => unsubscribe();
  }, [compId]);

  // Don't render if no session configured
  if (!feedConfig?.hasSession) return null;

  const handleToggle = async () => {
    if (feedConfig.enabled) {
      // Confirm before disabling during live show
      setShowConfirm(true);
    } else {
      await set(ref(db, `competitions/${compId}/config/scoringFeed/enabled`), true);
    }
  };

  const confirmDisable = async () => {
    await set(ref(db, `competitions/${compId}/config/scoringFeed/enabled`), false);
    setShowConfirm(false);
  };

  if (feedConfig.status === 'error') {
    return (
      <button
        onClick={() => {/* Show error modal or tooltip */}}
        className="inline-flex items-center gap-1.5 mt-1 px-2 py-0.5 rounded text-xs font-medium
                   bg-red-900/40 text-red-300 border border-red-800 hover:bg-red-900/60"
        title={feedConfig.errorMessage}
      >
        <ExclamationTriangleIcon className="w-3 h-3" />
        FEED ERROR
      </button>
    );
  }

  if (feedConfig.enabled) {
    return (
      <>
        <button
          onClick={handleToggle}
          className="inline-flex items-center gap-1.5 mt-1 px-2 py-0.5 rounded text-xs font-medium
                     bg-green-900/40 text-green-300 border border-green-800 hover:bg-green-900/60"
        >
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          LIVE · {feedConfig.pollInterval || 15}s
        </button>
        {showConfirm && <ConfirmDialog onConfirm={confirmDisable} onCancel={() => setShowConfirm(false)} />}
      </>
    );
  }

  return (
    <button
      onClick={handleToggle}
      className="inline-flex items-center gap-1.5 mt-1 px-2 py-0.5 rounded text-xs font-medium
                 bg-zinc-700 text-zinc-400 hover:bg-zinc-600"
    >
      FEED OFF
    </button>
  );
}
```

### Integration Point

**Add to CompetitionCard at line ~1041:**

```jsx
{/* Dynamic badge area */}
<div className="flex flex-wrap items-center gap-2">
  <StatsStatusBadge
    compId={compId}
    team1Key={config?.team1Key}
    team2Key={config?.team2Key}
    team3Key={config?.team3Key}
    team4Key={config?.team4Key}
  />
  <ScoringFeedBadge compId={compId} />  {/* NEW */}
  <CommentaryStatusBadge compId={compId} />
</div>
```

## Risks

1. **Badge clutter:** Adding more badges may overflow on smaller screens. Test responsiveness.

2. **Pulsing animation performance:** Multiple pulsing badges may cause rendering overhead. Consider single animation.

3. **Click target size:** Badges are small. Ensure tap targets meet accessibility guidelines (44x44px minimum).

## Open Questions

1. **Should the pulsing dot animation match existing patterns?** The VM indicator uses `animate-pulse`. Reuse that or create new animation?

2. **Should clicking the badge open a modal or just toggle?** Stats badge has a refresh button; feed badge has on/off toggle. Different interactions may confuse users.

3. **What happens if user toggles feed on but no `virtiusSessionId` exists?** Should the badge be hidden entirely, or show a "Configure Session" prompt?
