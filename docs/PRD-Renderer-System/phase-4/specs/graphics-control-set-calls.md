# GraphicsControl.jsx Set Calls

## What

All locations where `currentGraphic` is written to Firebase in GraphicsControl.jsx. Critical for Phase 4 Task 2: renderer routing.

## Current State

**File:** `show-controller/src/components/GraphicsControl.jsx`

### Summary

**7 total `.set()` calls** to `currentGraphic`. **6 already have the renderer field**, 1 needs addition.

| Line | Function | Renderer Status |
|------|----------|-----------------|
| 311 | `sendCustomGraphic()` | ✓ `'output'` (hardcoded) |
| 496 | `sendGraphic()` | ✓ Registry lookup |
| 517 | `sendRotationSlate()` | ✓ `'output'` (hardcoded) |
| 530 | `sendAutoSlate()` | ✓ `'output'` (hardcoded) |
| 590 | `sendEventSummary()` | ✓ `'output'` (hardcoded) |
| 603 | `clearGraphic()` | ✗ **MISSING** |
| 625 | `sendNowCompeting()` | ✓ `'output'` (hardcoded) |

### Detailed Analysis

#### 1. sendCustomGraphic() — Line 311

```javascript
set(ref(db, `competitions/${compId}/currentGraphic`), {
  graphic: 'custom',
  graphicId: `custom-${customId}`,
  renderer: 'output',  // ✓ Present
  data: {
    customUrl: customGraphic.url,
    customLabel: customGraphic.label,
  },
  timestamp: Date.now(),
});
```

#### 2. sendGraphic() — Line 496

```javascript
// Renderer resolution (lines 492-494)
const registryEntry = getGraphicById(graphicId);
const firebaseRenderer = registryEntry && registryEntry.renderer === 'stage' ? 'stage' : 'output';

set(ref(db, `competitions/${compId}/currentGraphic`), {
  graphic: graphicType,
  graphicId: graphicId,
  renderer: firebaseRenderer,  // ✓ From registry
  data: data,  // HUGE config object (lines 326-405)
  timestamp: Date.now()
});
```

**Data object includes:**
- Competition metadata (compType, eventName, meetDate, venue, location, hosts, virtiusSessionId, meetTheme)
- Teams 1-10 data (name, logo, ave/high/con scores, coaches)
- frameTitle, leaderboardEvent, leaderboardGender (optional)
- Special handling for event-calendar and sponsor graphics

#### 3. sendRotationSlate() — Line 517

```javascript
set(ref(db, `competitions/${compId}/currentGraphic`), {
  graphic: 'rotation-slate',
  graphicId: `rotation-slate-r${rotation}`,
  renderer: 'output',  // ✓ Present
  data: {
    eventName, team1Logo, rotation: String(rotation),
    meetTheme: config.meetTheme || '',
    layout: slateLayout
  },
  timestamp: Date.now()
});
```

#### 4. sendAutoSlate() — Line 530

```javascript
set(ref(db, `competitions/${compId}/currentGraphic`), {
  graphic: 'rotation-slate-auto',
  graphicId: 'rotation-slate-auto',
  renderer: 'output',  // ✓ Present
  data: {
    compId: compId,
    layout: slateLayout || 'classic',
    meetTheme: config.meetTheme || '',
  },
  timestamp: Date.now()
});
```

#### 5. sendEventSummary() — Line 590

```javascript
set(ref(db, `competitions/${compId}/currentGraphic`), {
  graphic: 'event-summary',
  graphicId: graphicId,  // 'summary-r{N}' or 'summary-{apparatus}'
  renderer: 'output',  // ✓ Present
  data: {
    virtiusSessionId, summaryMode, summaryRotation/summaryApparatus,
    summaryNumTeams, summaryFormat, summaryTheme, summaryGender,
    team1Logo, team1Name, team2Name
  },
  timestamp: Date.now()
});
```

#### 6. clearGraphic() — Line 603 ⚠️

```javascript
set(ref(db, `competitions/${compId}/currentGraphic`), {
  graphic: 'clear',
  data: {},
  timestamp: Date.now()
});
// ⚠️ NO renderer field
// ⚠️ NO graphicId field
```

**Note:** Comment in code says "both engines clear on `graphic: 'clear'`" — but this should be verified.

#### 7. sendNowCompeting() — Line 625

```javascript
set(ref(db, `competitions/${compId}/currentGraphic`), {
  graphic: 'now-competing',
  graphicId: `now-competing-${athlete.id}`,
  renderer: 'output',  // ✓ Present
  data: {
    athleteName, athleteTeam, athleteEvent, athleteLogo, team1Logo
  },
  timestamp: Date.now()
});
```

### Theme Handling in sendGraphic()

Current theme handling (line 334):
```javascript
meetTheme: config.meetTheme || ''
```

For stage engine graphics, Phase 4 requires **full theme resolution**:

```javascript
// Step 1: Resolve theme from Firebase
const themeId = config.meetTheme;
const themeSnap = themeId ? await get(ref(db, `themes/${themeId}`)) : null;
const themeData = themeSnap?.val();

// Step 2: Resolve per-graphic overrides
const resolvedTheme = resolveTheme(themeData, graphicId);

// Step 3: Write spec with baked-in theme
data.theme = resolvedTheme;
```

## Target State

After Phase 4:

### clearGraphic() Fix

```javascript
set(ref(db, `competitions/${compId}/currentGraphic`), {
  graphic: 'clear',
  graphicId: 'clear',
  renderer: 'output',  // Or omit — both engines should clear on graphic: 'clear'
  data: {},
  timestamp: Date.now()
});
```

### Stage Engine Graphics in sendGraphic()

```javascript
if (firebaseRenderer === 'stage') {
  // Resolve theme
  const resolvedTheme = await resolveTheme(db, config.meetTheme, graphicId);

  // Build render spec
  const spec = {
    skeleton: registryEntry.skeleton,
    blocks: registryEntry.defaultData.blocks.map(block => ({
      ...block,
      data: { ...block.data, ...resolveBlockData(block, config, graphicParams) }
    })),
    theme: resolvedTheme,
    comp: compId
  };

  data = spec;
}
```

## Risks

1. **clearGraphic() missing renderer** — both output.html and stage.html must handle `graphic: 'clear'` without a renderer field (backward compat)
2. **Theme resolution async** — `sendGraphic()` may need to become async
3. **Sponsor special handling** (lines 428-477) — complex logic that may need extraction

## Open Questions

1. Should `clearGraphic()` include `renderer: 'both'` or just omit it for backward compatibility?
2. Where should the `resolveTheme()` helper live? (GraphicsControl, separate lib, or shared utils)
3. Should the massive data object in `sendGraphic()` be refactored into smaller, type-specific builders?
