# URL Generator Sidebar Structure

## What

Analysis of `UrlGeneratorPage.jsx` — how the sidebar is built and where to add renderer badges and preview indicators.

## Current State

**File:** `show-controller/src/pages/UrlGeneratorPage.jsx`

### Sidebar Layout (lines 554-803)

The sidebar is divided into **8 hardcoded sections**:

| Line Range | Section | Data Source |
|-----------|---------|-------------|
| 573-582 | Pre-Meet | `preMeetButtons` (computed) |
| 584-656 | In-Meet | `graphicButtons.inMeet` |
| 658-669 | Event Frames | `apparatusButtons` (computed) |
| 671-682 | Frame Overlays | `frameOverlayButtons` |
| 684-726 | Leaderboards | `leaderboardButtons` (computed) |
| 728-772 | Event Summary | Inline rotation/apparatus buttons |
| 774-789 | Stream | Hardcoded 2 buttons |
| 791-802 | Sponsors | `graphicButtons.sponsors` |

### baseGraphicTitles Object (lines 54-118)

A **static lookup table** mapping graphic IDs to display titles:

```javascript
const baseGraphicTitles = {
  logos: 'Team Logos',
  'event-bar': 'Event Info Bar',
  'warm-up': 'Warm Up',
  hosts: 'Hosts',
  // ... 40+ entries ...
};
```

Extended by `getGraphicTitles(teamCount)` (lines 121-128) which adds team-specific entries dynamically.

### How Graphics Are Grouped

**Two-layer system:**

1. **Primary:** `graphicButtons.js` — functions that call the registry
2. **Secondary:** `graphicsRegistry.js` — source of truth

Each category has a dedicated function in `graphicButtons.js`:
- `getPreMeetButtons(teamCount, teamNames)`
- `graphicButtons.inMeet` (static)
- `graphicButtons.frameOverlays` (static)
- `getLeaderboardButtons(compType)` (gender-filtered)
- `getEventSummaryRotationButtons()` / `getEventSummaryApparatusButtons()`
- `graphicButtons.stream` (static)
- `graphicButtons.sponsors` (static)

### GraphicSidebarButton Component (lines 1426-1440)

```javascript
function GraphicSidebarButton({ id, label, number, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`w-full px-3 py-2.5 rounded-lg text-left text-sm ...`}
    >
      <span className={`text-xs w-5 ...`}>{number}</span>
      {label}
    </button>
  );
}
```

### GraphicSection Component (lines 1417-1423)

```javascript
function GraphicSection({ title, children }) {
  return (
    <div className="mb-5">
      <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-2">
        {title}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}
```

### Hardcoded vs Data-Driven

**Hardcoded:**
- Section wrapper structure (8 sections in specific order)
- Rotation/apparatus buttons (inline, not via `GraphicSidebarButton`)
- Combined AA Leaderboard special handling

**Data-driven:**
- Button arrays from `graphicButtons.js`
- Graphic titles from registry
- Transparent graphic detection

## Target State

After Phase 4:

### Auto-Generated Sections

```javascript
// Instead of hardcoded sections, derive from registry categories
const categories = getGraphicsByCategory(); // grouped by category + subcategory
// Sidebar renders each category as a collapsible section in categories.json order
```

### Renderer Badges

Add to `GraphicSidebarButton`:

```jsx
function GraphicSidebarButton({ id, label, number, active, onClick, renderer }) {
  return (
    <button ...>
      <span className="text-xs w-5">{number}</span>
      <span className="flex-1">{label}</span>
      {renderer && (
        <span className={`text-[9px] px-1.5 py-0.5 rounded ${
          renderer === 'stage' ? 'bg-teal-500/20 text-teal-400' : 'bg-zinc-700 text-zinc-400'
        }`}>
          {renderer}
        </span>
      )}
    </button>
  );
}
```

### Preview Indicator

Above the preview iframe:

```jsx
<div className="text-xs text-zinc-400 mb-2">
  <span className={renderer === 'stage' ? 'text-teal-400' : 'text-zinc-400'}>
    Rendering via {renderer === 'stage' ? 'stage.html' : renderer === 'overlay' ? `overlays/${file}` : 'output.html'}
  </span>
  <div className="text-zinc-500 truncate" title={fullUrl}>
    {truncatedUrl}
  </div>
</div>
```

## Risks

1. **Section order** is implicit in JSX — must be explicit in `categories.json`
2. **Inline buttons** (rotation/apparatus) don't use `GraphicSidebarButton` — need migration
3. **Combined AA special handling** — unique UX that may not fit the auto-generated pattern

## Open Questions

1. Should the "Skeletons & Blocks" preview section be its own category or a separate panel?
2. How to handle the Combined AA Leaderboard's special session ID inputs in an auto-generated sidebar?
3. Should inactive/unavailable graphics (wrong gender, wrong team count) be hidden or grayed out?
