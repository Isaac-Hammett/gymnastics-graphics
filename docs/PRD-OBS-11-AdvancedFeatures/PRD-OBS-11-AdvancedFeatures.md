# PRD-OBS-11: Advanced Features

**Version:** 1.0
**Date:** 2026-01-20
**Status:** Ready for Implementation
**Depends On:** PRD-OBS-01 through PRD-OBS-10 (all complete)
**Blocks:** None

---

## Overview

This PRD consolidates all deferred features from the completed OBS PRDs (01-10). These are enhancement features that improve the production experience but were not required for core functionality.

> **Architecture Note:** All OBS operations flow through the **coordinator** (api.commentarygraphic.com). The frontend never connects directly to OBS or competition VMs. See [README-OBS-Architecture.md](../README-OBS-Architecture.md) for details.

---

## Feature Summary

| # | Feature | Priority | Source PRD | Complexity |
|---|---------|----------|------------|------------|
| 1 | Studio Mode | P0 | OBS-09 | Medium |
| 2 | Scene Thumbnails | P1 | OBS-09 | Medium |
| 3 | Real-time VU Meters | P2 | OBS-04 | High |
| 4 | Stinger Transitions | P2 | OBS-05 | Medium |
| 5 | Talent Connection Status | P3 | OBS-10 | Medium |
| 6 | Stream Key Encryption | P3 | OBS-06 | Low |
| 7 | Template Auto-Loading | P1 | OBS-08 | Medium |

---

## Feature 1: Studio Mode (P0)

### Description
OBS Studio Mode provides a dual-view layout showing both **Preview** (what you're about to switch to) and **Program** (what's currently live). This allows producers to prepare the next scene before transitioning.

### Current State
- Program output screenshot works (PRD-OBS-09 P0)
- OBSContext has `enableStudioMode()` and `disableStudioMode()` methods ready
- Server broadcasts `obs:studioModeChanged` and `obs:previewSceneChanged` events
- Backend `obsStateSync.js` has `setStudioMode()` and `setPreviewScene()` methods

### What's Missing
- Socket handlers for `obs:enableStudioMode`, `obs:disableStudioMode`, `obs:setPreviewScene`
- `StudioModePanel.jsx` component
- Integration in OBSManager.jsx

### Requirements

#### 1.1 Socket Event Handlers (server/index.js)
```javascript
// Enable studio mode
socket.on('obs:enableStudioMode', async () => {
  await obsConnection.call('SetStudioModeEnabled', { studioModeEnabled: true });
  broadcastOBSState(compId);
});

// Disable studio mode
socket.on('obs:disableStudioMode', async () => {
  await obsConnection.call('SetStudioModeEnabled', { studioModeEnabled: false });
  broadcastOBSState(compId);
});

// Set preview scene
socket.on('obs:setPreviewScene', async ({ sceneName }) => {
  await obsConnection.call('SetCurrentPreviewScene', { sceneName });
  broadcastOBSState(compId);
});

// Transition preview to program
socket.on('obs:transitionToProgram', async () => {
  await obsConnection.call('TriggerStudioModeTransition');
  broadcastOBSState(compId);
});
```

#### 1.2 UI Layout
```
┌─ STUDIO MODE ────────────────────────────────────────────────────┐
│                                                                   │
│  ┌─ PREVIEW ──────────────────┐  ┌─ PROGRAM ──────────────────┐ │
│  │                            │  │                            │ │
│  │   [Screenshot 640x360]     │  │   [Screenshot 640x360]     │ │
│  │                            │  │                            │ │
│  │   Scene: Full Screen - A   │  │   Scene: Dual View - AB    │ │
│  └────────────────────────────┘  └────────────────────────────┘ │
│                                                                   │
│  Preview Scene: [Dropdown ▼]              [ TAKE ]               │
│                                                                   │
│                                    [Exit Studio Mode]            │
└───────────────────────────────────────────────────────────────────┘
```

#### 1.3 Component: StudioModePanel.jsx
- Side-by-side preview (left) and program (right) screenshots
- Preview scene dropdown selector
- "TAKE" button to transition preview → program
- "Exit Studio Mode" button
- Auto-refresh both screenshots (configurable interval)
- **Resizable screenshot windows** (see 1.5)

#### 1.4 OBSManager Integration
- Toggle button to enable/disable studio mode
- When studio mode enabled, show StudioModePanel instead of regular OBSCurrentOutput
- Persist studio mode preference in local storage

#### 1.5 Scene List Integration with Studio Mode

The SceneList component must provide buttons to send scenes to Preview or Program based on whether Studio Mode is enabled.

##### When Studio Mode is DISABLED (Normal Mode)
Each scene card shows a single button:
```
┌─────────────────────────────────────────────────────────┐
│ ┌──────────┐  Full Screen - Camera A           [LIVE]  │
│ │ [thumb]  │  Category: generated-single               │
│ │  80x45   │                         [▶ Go Live]       │
│ └──────────┘                                            │
└─────────────────────────────────────────────────────────┘
```
- **[▶ Go Live]** button: Switches scene directly to Program (calls `switchScene`)

##### When Studio Mode is ENABLED
Each scene card shows two buttons:
```
┌─────────────────────────────────────────────────────────┐
│ ┌──────────┐  Full Screen - Camera A           [LIVE]  │
│ │ [thumb]  │  Category: generated-single               │
│ │  80x45   │                   [👁 Preview] [▶ Live]   │
│ └──────────┘                                            │
└─────────────────────────────────────────────────────────┘
```
- **[👁 Preview]** button: Sets scene as Preview scene (calls `setPreviewScene`)
- **[▶ Live]** button: Switches scene directly to Program (calls `switchScene`)

##### Visual Indicators
- Scene currently on **Program**: Green border or "LIVE" badge
- Scene currently on **Preview**: Yellow/amber border or "PREVIEW" badge
- Both indicators can appear on different scenes simultaneously in Studio Mode

##### Implementation Notes
```javascript
// In SceneList.jsx
const { obsState, switchScene, setPreviewScene } = useOBS();
const isStudioMode = obsState?.studioModeEnabled;

// Button handlers
const handleGoLive = (sceneName) => switchScene(sceneName);
const handlePreview = (sceneName) => setPreviewScene(sceneName);

// Determine scene status
const isLive = scene.sceneName === obsState?.currentProgramSceneName;
const isPreview = scene.sceneName === obsState?.previewSceneName;
```

#### 1.6 Resizable Screenshot Windows

Allow users to adjust the size of the Preview and Program screenshot windows via a dropdown selector.

##### Size Presets

| Label | Dimensions | Aspect Ratio | Use Case |
|-------|------------|--------------|----------|
| Small | 320×180 | 16:9 | Compact view, limited screen space |
| Medium (Default) | 640×360 | 16:9 | Standard production view |
| Large | 960×540 | 16:9 | Detailed preview, large monitors |
| Extra Large | 1280×720 | 16:9 | Full attention mode, dedicated monitor |

##### UI Layout with Size Selector
```
┌─ STUDIO MODE ──────────────────────────────────────────────────────────────┐
│                                                                             │
│  Size: [Medium (640×360) ▼]                         [Exit Studio Mode]     │
│                                                                             │
│  ┌─ PREVIEW ──────────────────┐  ┌─ PROGRAM ──────────────────┐            │
│  │                            │  │                            │            │
│  │   [Screenshot]             │  │   [Screenshot]             │            │
│  │                            │  │                            │            │
│  │   Scene: Full Screen - A   │  │   Scene: Dual View - AB    │            │
│  └────────────────────────────┘  └────────────────────────────┘            │
│                                                                             │
│  Preview Scene: [Dropdown ▼]              [ TAKE ]                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

##### Implementation

**State:**
```javascript
const [screenshotSize, setScreenshotSize] = useState('medium'); // 'small' | 'medium' | 'large' | 'xlarge'

const SIZE_PRESETS = {
  small:  { width: 320,  height: 180, label: 'Small (320×180)' },
  medium: { width: 640,  height: 360, label: 'Medium (640×360)' },
  large:  { width: 960,  height: 540, label: 'Large (960×540)' },
  xlarge: { width: 1280, height: 720, label: 'Extra Large (1280×720)' }
};
```

**Size Selector Component:**
```jsx
<select
  value={screenshotSize}
  onChange={(e) => setScreenshotSize(e.target.value)}
  className="bg-gray-700 text-white rounded px-3 py-1.5 border border-gray-600"
>
  {Object.entries(SIZE_PRESETS).map(([key, preset]) => (
    <option key={key} value={key}>{preset.label}</option>
  ))}
</select>
```

**Screenshot Request:**
```javascript
// Request screenshot at selected size
socket.emit('obs:requestScreenshot', {
  width: SIZE_PRESETS[screenshotSize].width,
  height: SIZE_PRESETS[screenshotSize].height,
  source: 'program' // or 'preview'
});
```

##### Persistence
- Save selected size to `localStorage` key: `obs-studio-mode-screenshot-size`
- Restore on component mount
- Default to `'medium'` if no saved preference

##### Responsive Behavior
- On smaller screens (< 1400px width), automatically limit max size to "Large"
- On mobile/tablet (< 900px width), automatically limit to "Small" or "Medium"
- Stack preview/program vertically on very narrow screens

### Acceptance Criteria
- [x] Enable/disable studio mode works
- [x] Preview and program screenshots display correctly
- [x] Preview scene can be changed via dropdown
- [x] "TAKE" button transitions preview to program
- [x] Multi-client sync works (all clients see mode changes)
- [x] Size dropdown allows selecting Small/Medium/Large/Extra Large
- [x] Screenshot size changes immediately when selection changes
- [x] Size preference persists across page reloads
- [ ] Layout adapts responsively on smaller screens
- [x] Scene List shows single "Go Live" button when Studio Mode disabled
- [x] Scene List shows "Preview" and "Live" buttons when Studio Mode enabled
- [x] Preview button sets scene as preview (yellow/amber indicator)
- [x] Live button switches scene to program (green indicator)
- [x] Current program scene shows "LIVE" badge
- [x] Current preview scene shows "PREVIEW" badge (Studio Mode only)

---

## Feature 2: Scene Thumbnails (P1)

### Description
Display small thumbnail previews for each scene in the scene list, allowing producers to visually identify scenes without relying on names alone.

### Current State
- Screenshot functionality exists (`obs:requestScreenshot` supports `sceneName` parameter)
- SceneList.jsx displays scenes as text cards

### What's Missing
- Thumbnail display in SceneList.jsx
- Thumbnail caching/refresh logic
- Hover preview functionality

### Requirements

#### 2.1 Scene Card with Thumbnail
```
┌─────────────────────────────────────────────────────┐
│ ┌──────────┐  Full Screen - Camera A     [LIVE]    │
│ │ [thumb]  │  Category: generated-single           │
│ │  80x45   │                    [Edit] [⋮]         │
│ └──────────┘                                        │
└─────────────────────────────────────────────────────┘
```

#### 2.2 Thumbnail Specifications
- Size: 80x45 pixels (16:9 aspect ratio)
- Format: JPEG for fast transfer
- Refresh: On scene list load, not auto-refresh (bandwidth)
- Fallback: Gray placeholder if screenshot fails

#### 2.3 Hover Preview (Optional)
- On hover, show larger preview (320x180)
- Tooltip-style popup near cursor
- Debounce hover to avoid rapid requests

### Acceptance Criteria
- [ ] Scene cards show thumbnail previews
- [ ] Thumbnails load on scene list refresh
- [ ] Failed thumbnails show placeholder
- [ ] Hover preview shows larger image (optional)

---

## Feature 3: Real-time VU Meters (P2)

### Description
Display real-time audio level meters for each audio source, showing volume levels as they change.

### Current State
- AudioMixer.jsx shows volume sliders and mute toggles
- No real-time level visualization

### What's Missing
- OBS WebSocket subscription for audio levels
- VU meter visualization component
- Real-time update mechanism

### Requirements

#### 3.1 OBS WebSocket Subscription
OBS WebSocket can emit `InputVolumeMeters` events when subscribed. Need to:
1. Subscribe to `InputVolumeMeters` event on connection
2. Forward level data to clients via Socket.io
3. Handle high-frequency updates efficiently

#### 3.2 VU Meter Component
```
┌─ MIC 1 ────────────────────────────────────────────┐
│ [====████████████░░░░░░░░░░░░░░░░░░░░░░░░] -12 dB │
│ ────────────────────────────────────────── Mute    │
│           Volume: [──────●──────────────]          │
└────────────────────────────────────────────────────┘
```

#### 3.3 Technical Considerations
- OBS sends level data at ~10Hz
- Use requestAnimationFrame for smooth rendering
- Throttle Socket.io emissions to avoid overwhelming clients
- Peak hold indicator (optional)

### Acceptance Criteria
- [ ] VU meters display for each audio source
- [ ] Levels update in real-time
- [ ] Performance remains smooth with multiple sources
- [ ] Peak indicator shows recent maximum (optional)

---

## Feature 4: Stinger Transitions (P2)

### Description
Configure stinger transitions - video files that play during scene transitions with a configurable transition point.

### Current State
- TransitionPicker.jsx shows available transitions
- Can select transition and set duration
- No stinger-specific configuration

### What's Missing
- Stinger file path configuration
- Transition point (cut frame) configuration
- Stinger preview

### Requirements

#### 4.1 Stinger Configuration UI
```
┌─ STINGER SETTINGS ─────────────────────────────────┐
│                                                     │
│  Stinger File: [/path/to/stinger.webm    ] [Browse]│
│                                                     │
│  Transition Point: [1500] ms                        │
│  (Time when the stinger fully covers the screen)   │
│                                                     │
│  Audio Fade Style: [Crossfade ▼]                   │
│                                                     │
│  [Preview Stinger]              [Save Settings]    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

#### 4.2 OBS WebSocket Calls
```javascript
// Set stinger settings
obs.call('SetCurrentSceneTransitionSettings', {
  transitionSettings: {
    path: '/var/www/assets/stingers/main.webm',
    transition_point: 1500,
    tp_type: 'time',
    audio_fade_style: 'crossfade'
  }
});
```

### Acceptance Criteria
- [ ] Can set stinger file path
- [ ] Can set transition point
- [ ] Stinger plays during scene transitions
- [ ] Settings persist

---

## Feature 5: Talent Connection Status (P3)

### Description
Show connection status indicators for VDO.Ninja talent feeds - whether talent is connected and audio is active.

### Current State
- TalentCommsPanel.jsx shows URLs and copy buttons
- No connection status indicators

### What's Missing
- VDO.Ninja API integration for connection status
- Status indicator UI
- Polling mechanism

### Requirements

#### 5.1 Status Indicators
```
┌─ TALENT FEEDS ─────────────────────────────────────┐
│                                                     │
│  Talent 1: [●] Connected    Audio: [■■■░░]         │
│  URL: https://vdo.ninja/?view=...    [Copy]        │
│                                                     │
│  Talent 2: [○] Disconnected Audio: [░░░░░]         │
│  URL: https://vdo.ninja/?view=...    [Copy]        │
│                                                     │
└─────────────────────────────────────────────────────┘
```

#### 5.2 Technical Approach
- VDO.Ninja director page may expose room status via JavaScript
- Alternative: Embed director view in hidden iframe and query state
- Poll every 5-10 seconds

### Acceptance Criteria
- [ ] Connection status shown for each talent
- [ ] Audio activity indicator
- [ ] Status updates automatically

---

## Feature 6: Stream Key Encryption (P3)

### Description
Encrypt stream keys stored in Firebase to prevent exposure if database is compromised.

### Current State
- Stream keys stored in plaintext in Firebase
- Keys masked in UI but visible in database

### What's Missing
- Server-side encryption/decryption
- Secure key storage

### Requirements

#### 6.1 Encryption Approach
- Use Node.js `crypto` module with AES-256-GCM
- Store encryption key in environment variable (not in code)
- Encrypt before storing to Firebase
- Decrypt when sending to OBS

#### 6.2 Implementation
```javascript
// Encrypt stream key before storing
const encrypted = encrypt(streamKey, process.env.STREAM_KEY_SECRET);
await firebase.set(`competitions/${compId}/config/stream/key`, encrypted);

// Decrypt when configuring OBS
const encrypted = await firebase.get(`competitions/${compId}/config/stream/key`);
const streamKey = decrypt(encrypted, process.env.STREAM_KEY_SECRET);
await obs.call('SetStreamServiceSettings', { ... });
```

### Acceptance Criteria
- [ ] Stream keys encrypted in Firebase
- [ ] Decryption works when starting stream
- [ ] UI functionality unchanged

---

## Feature 7: Template Auto-Loading (P1)

### Description
Automatically apply the appropriate OBS template when entering a competition based on meet type. Currently, templates must be manually applied via the Template Manager UI - this feature would auto-load the correct template when OBS connects to a competition.

### Current State
- Templates exist with `meetTypes` field (e.g., `["mens-dual", "womens-dual"]`)
- TemplateCard shows `isDefault` badge but no actual default logic exists
- Templates are only applied via manual "Apply" button click
- TemplateManager.jsx fetches templates on mount but doesn't auto-apply

### What's Missing
- "Set as Default" toggle per template per meet type
- Auto-apply logic when OBS connects to a competition
- Conflict resolution when multiple defaults exist
- User preference to disable auto-loading

### Requirements

#### 7.1 Default Template Schema
Add `isDefaultFor` field to template schema:
```json
{
  "id": "gymnastics-standard-v2",
  "name": "Gymnastics Standard",
  "meetTypes": ["mens-dual", "womens-dual"],
  "isDefaultFor": ["mens-dual", "womens-dual"],  // NEW: which types auto-load this
  "createdAt": "2026-01-10T10:00:00Z",
  ...
}
```

**Firebase Path:** `templates/obs/{templateId}/isDefaultFor`

#### 7.2 Template Manager UI Changes
Add "Set as Default" toggle to TemplateCard:
```
┌─────────────────────────────────────────────────────────┐
│ Gymnastics Standard v2.0              [Apply] [🗑️]     │
│ Standard 4-camera setup                                 │
│ Meet types: mens-dual, womens-dual                      │
│                                                         │
│ ☑ Auto-load for: [✓] mens-dual [✓] womens-dual         │
│                  [ ] mens-tri   [ ] womens-tri          │
└─────────────────────────────────────────────────────────┘
```

#### 7.3 Auto-Apply Logic
In `OBSContext.jsx` or a new hook, when OBS connects:

```javascript
// Pseudocode for auto-apply logic
useEffect(() => {
  if (obsConnected && !hasAppliedTemplate) {
    const competitionType = competition?.type; // e.g., "mens-dual"

    // Fetch templates and find default for this meet type
    const templates = await fetchTemplates();
    const defaultTemplate = templates.find(t =>
      t.isDefaultFor?.includes(competitionType)
    );

    if (defaultTemplate) {
      // Check if OBS already has scenes (don't overwrite existing setup)
      if (obsState.scenes.length === 0 || userConfirms) {
        await applyTemplate(defaultTemplate.id);
        setHasAppliedTemplate(true);
      }
    }
  }
}, [obsConnected, competition?.type]);
```

#### 7.4 User Preferences
Add setting to disable auto-loading:
```
Firebase Path: competitions/{compId}/config/obs/autoLoadTemplate
Values: true (default) | false
```

UI in OBS Settings:
```
┌─ OBS Settings ──────────────────────────────────────────┐
│                                                          │
│  ☑ Auto-load default template when OBS connects          │
│    (Only applies if OBS has no existing scenes)          │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

#### 7.5 Conflict Resolution
If multiple templates are marked as default for the same meet type:
1. Use the most recently updated template (`updatedAt`)
2. Show warning in Template Manager: "Multiple defaults for mens-dual"
3. Only one template can be default per meet type (setting a new default clears others)

### Socket Events

| Event | Direction | Payload | Purpose |
|-------|-----------|---------|---------|
| `obs:setTemplateDefault` | Frontend → Server | `{templateId, meetTypes: ['mens-dual']}` | Mark template as default |
| `obs:clearTemplateDefault` | Frontend → Server | `{templateId, meetTypes: ['mens-dual']}` | Remove default status |
| `obs:templateAutoApplied` | Server → Frontend | `{templateId, competitionId}` | Notify clients of auto-apply |

### Acceptance Criteria
- [x] Can mark a template as "default" for specific meet types
- [x] Only one template can be default per meet type
- [x] Template auto-applies when OBS connects to matching competition
- [x] Auto-apply only occurs if OBS has no scenes (fresh state)
- [x] User can disable auto-loading in settings
- [x] Multi-client sync: all clients see default status changes
- [ ] Warning shown when multiple defaults conflict (not needed - automatic clearing)

### Test Cases
1. Create template, set as default for `mens-dual`
2. Enter a mens-dual competition with fresh OBS
3. Verify template auto-applies
4. Enter same competition with existing scenes
5. Verify template does NOT overwrite existing setup
6. Disable auto-load setting
7. Verify template does NOT auto-apply even with fresh OBS

---

## Implementation Order

1. **P0: Studio Mode** - Highest user value, most requested
2. **P1: Scene Thumbnails** - Visual improvement to scene list
3. **P1: Template Auto-Loading** - Streamline production setup
4. **P2: VU Meters** - Audio production quality
5. **P2: Stinger Transitions** - Professional transitions
6. **P3: Talent Status** - Nice-to-have monitoring
7. **P3: Stream Key Encryption** - Security hardening

---

## Files to Create/Modify

| File | Changes |
|------|---------|
| `server/index.js` | Add studio mode socket handlers, template default handlers |
| `show-controller/src/components/obs/StudioModePanel.jsx` | **CREATE** - Studio mode UI |
| `show-controller/src/components/obs/SceneList.jsx` | Add thumbnails |
| `show-controller/src/components/obs/AudioMixer.jsx` | Add VU meters |
| `show-controller/src/components/obs/TransitionPicker.jsx` | Add stinger config |
| `show-controller/src/components/obs/TalentCommsPanel.jsx` | Add status indicators |
| `show-controller/src/components/obs/TemplateManager.jsx` | Add "Set as Default" toggle, auto-apply logic |
| `show-controller/src/context/OBSContext.jsx` | Add auto-apply hook on OBS connect |
| `server/lib/streamKeyEncryption.js` | **CREATE** - Encryption utilities |
| `server/lib/obsTemplateManager.js` | Add setDefaultTemplate, getDefaultForMeetType methods |

---

## Definition of Done

1. Feature works in production
2. Multi-client sync works
3. No console errors
4. Playwright verification passes
5. Code reviewed and merged to main
