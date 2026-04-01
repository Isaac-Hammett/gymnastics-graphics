# Timesheet Graphics Triggering

## What

How the timesheet engine triggers graphics from rundown segments. Critical for Phase 4 Task 6: rundown renderer routing.

## Current State

**File:** `server/lib/timesheetEngine.js`

### Triggering Flow

1. **Segment Activation** (`_activateSegment`, line 599)
   - Calls `_handleSegmentTypeActions()` (line 642)

2. **Type Handler** (`_handleSegmentTypeActions`, lines 784-856)
   - Checks segment type and triggers graphics for:
     - `LIVE` / `MULTI` segments (if `segment.graphic` exists)
     - `BREAK` segments (if `segment.graphic` exists)
     - `GRAPHIC` segments (always)
     - `PLAYOUT` segments (emits `playoutStarted`)
     - `WHO_TO_WATCH` segments (emits `whoToWatchStarted`)

3. **Graphic Trigger** (`_triggerGraphic`, lines 863-1068)
   - Builds data object
   - Writes to Firebase

### _triggerGraphic() Data Flow

**Step 1: Extract Graphic ID & Params (lines 872-880)**
```javascript
// Legacy format: segment.graphic = 'team-coaches'
// New format: segment.graphic = { graphicId: 'team-coaches', params: { teamSlot: 1 } }
let graphicId, graphicParams;
if (typeof segment.graphic === 'object' && segment.graphic.graphicId) {
  graphicId = segment.graphic.graphicId;
  graphicParams = segment.graphic.params || {};
} else {
  graphicId = segment.graphic;
  graphicParams = segment.graphicData || {};
}
```

**Step 2: Load Competition Config (lines 900-930)**
```javascript
data = {
  eventName: config.eventName,
  meetDate: config.meetDate,
  venue: config.venue,
  location: config.location,
  hosts: config.hosts,
  virtiusSessionId: config.virtiusSessionId,
  meetTheme: config.meetTheme || '',  // Theme ID passed through
  team1Name, team1Logo, team1Ave, team1High, team1Con, team1Coaches,
  team2Name, team2Logo, ...
  // Teams 3-6
  ...graphicParams  // Segment params override config
}
```

**Step 3: Sponsor Data (lines 932-994)**
For `sponsors-*` graphics:
- Reads from `teamsDatabase/sponsors/{teamKey}`
- Converts to array, sorted by order, limited to 8
- Adds as `data.sponsors = JSON.stringify(sponsorsArray)`

**Step 4: Custom Graphics (lines 1001-1015)**
For `custom-*` graphics:
- Fetches URL from `competitions/{compId}/customGraphics/{customKey}`

**Step 5: Write to Firebase (lines 1036-1041)**
```javascript
const graphicData = {
  graphic: graphicId.startsWith('custom-') ? 'custom' : graphicId,
  graphicId: graphicId,
  data: data,
  segmentId: segment.id,
  timestamp: Date.now()
};
// ⚠️ NO renderer field currently
await db.ref(firebasePath).set(graphicData);
```

### Rundown Segment Configuration

**Editor Format** (stored in Firebase):
```javascript
{
  id: 'seg-123',
  name: 'Team Coaches',
  type: 'graphic',
  duration: 10,
  scene: 'Team Stats Scene',
  graphic: {
    graphicId: 'team-coaches',
    params: { teamSlot: 1 }
  },
  timingMode: 'fixed'
}
```

**Engine Format** (after `segmentMapper.js` conversion):
```javascript
{
  id: 'seg-123',
  name: 'Team Coaches',
  type: 'graphic',
  duration: 10,
  obsScene: 'Team Stats Scene',
  graphic: 'team-coaches',
  graphicData: { teamSlot: 1 },
  autoAdvance: true
}
```

## Target State

After Phase 4:

### Add Renderer Field (lines 1017-1023)

```javascript
// Look up renderer from registry
const registryEntry = getGraphicById(graphicId);
const firebaseRenderer = registryEntry?.renderer === 'stage' ? 'stage' : 'output';

const graphicData = {
  graphic: graphicId.startsWith('custom-') ? 'custom' : graphicId,
  graphicId: graphicId,
  renderer: firebaseRenderer,  // NEW
  data: data,
  segmentId: segment.id,
  timestamp: Date.now()
};
```

### Theme Resolution for Stage Engine Graphics

```javascript
if (firebaseRenderer === 'stage') {
  // Resolve theme
  const resolvedTheme = await resolveTheme(db, config.meetTheme, graphicId);

  // Build render spec
  const spec = buildRenderSpec(registryEntry, config, resolvedTheme, graphicParams);

  graphicData.data = spec;
}
```

### Shared resolveTheme() Helper

Location: `server/lib/themeResolver.js` (new file)

```javascript
async function resolveTheme(db, themeId, graphicId) {
  if (!themeId) return null;

  const themeSnap = await db.ref(`themes/${themeId}`).once('value');
  const theme = themeSnap.val();
  if (!theme) return null;

  // Base colors
  const resolved = {
    id: themeId,
    headerBg: theme.colors?.headerBar || theme.colors?.headerBg,
    headerText: theme.colors?.textOnHeader || theme.colors?.headerText,
    contentBg: theme.colors?.contentArea || theme.colors?.accentPrimary,
    overlayBg: theme.colors?.bodyBackground || theme.colors?.overlayBg,
    overlayText: theme.colors?.textOnContent || theme.colors?.overlayText,
    borderColor: theme.colors?.borderDivider || theme.colors?.borderColor,
    badgeBg: theme.colors?.badge || theme.colors?.badgeBg,
    badgeText: theme.colors?.badgeText,
  };

  // Per-graphic overrides
  const overrides = theme.overrides?.[graphicId];
  if (overrides) {
    // Merge overrides into resolved
  }

  return resolved;
}
```

## Risks

1. **GraphicsRegistry on server** — need to import registry into server code or duplicate data
2. **Async theme resolution** — adds latency to graphic triggering
3. **Segment format migration** — existing rundowns may have old format segments

## Open Questions

1. Should the graphics registry be shared between show-controller and server, or duplicated?
2. How to handle theme resolution failures (theme not found, Firebase error)?
3. Should the timesheet engine cache theme data for the duration of the show?
