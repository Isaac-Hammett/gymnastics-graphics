# Plan: Sponsor Management & Display System

## Context

The producer needs to manage sponsor logos and display them during broadcasts. Currently there is no centralized sponsor database, no way to manage sponsors in the Media Manager, and no on-screen graphic to display sponsors to viewers.

**Goal**: Per-team sponsor management in Media Manager + three overlay graphics (thank-you grid, cycling full-screen, persistent corner bug).

> **Note**: A separate per-segment sponsor system already exists in the Rundown Editor (sponsor name/logo/tier per segment + SponsorFulfillmentModal). This plan creates a *per-team* sponsor database for broadcast graphics. Integration between the two systems is deferred — see [Open Questions](#open-questions).

---

## Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Scope | Per-team (like headshots), keyed by home team | Different teams have different sponsors; home team determines which sponsors display |
| Bug overlay | Yes — bottom-right corner, cycling ~10s, transparent | Most common sponsor display in live sports; producers need it alongside full-screen variants |
| URL length | Cap at 8 sponsors in URL params (~1600 bytes) | Stays under 2KB safe URL limit; 200 bytes/sponsor after encoding |
| Tier field | `presenting`/`official`/`supporting`, metadata only | Stored for tracking/reporting but all sponsors render at equal size in overlays |
| Media Manager UI | Inline under each team's expandable card (below roster) | Matches how headshots are managed — expand a team, see its data |
| Sponsor key | Auto-slugified from name | `"State Farm Insurance!"` → `"state-farm-insurance"` |

---

## Files to Modify

| File | Change |
|------|--------|
| `show-controller/src/hooks/useTeamsDatabase.js` | Rescope `saveSponsor`/`deleteSponsor`/`reorderSponsors` to per-team paths; add `tier` field; add `getTeamSponsors`/`getTeamSponsorCount` helpers |
| `show-controller/src/pages/MediaManagerPage.jsx` | Add `SponsorsView` component inline under expanded team cards; add sponsor count badge to team card headers |
| `show-controller/src/lib/graphicsRegistry.js` | Add `sponsors-thanks`, `sponsors-cycle`, `sponsors-bug` entries in new `sponsors` category |
| `show-controller/src/lib/urlBuilder.js` | Add 3 builder functions + switch cases; destructure `sponsors` from `options` |
| `show-controller/src/lib/graphicButtons.js` | Add `sponsors` button section |
| `show-controller/src/pages/UrlGeneratorPage.jsx` | Import `useTeamsDatabase`; add sponsors sidebar section; thread sponsors JSON through `options.sponsors` |
| `show-controller/src/pages/GraphicsManagerPage.jsx` | Add `'sponsors'` to `CATEGORY_LABELS`; add dummy sponsors to preview for sponsor graphics |

## Files to Create

| File | Purpose |
|------|---------|
| `overlays/sponsors-thanks.html` | Full-screen "Thank You to Our Sponsors" grid graphic |
| `overlays/sponsors-cycle.html` | Full-screen cycling graphic — one sponsor at a time, 3s each, loops |
| `overlays/sponsors-bug.html` | Transparent corner bug — small logo bottom-right, 10s cycling, for OBS compositing |

---

## 1. Firebase Data Model

**Path**: `teamsDatabase/sponsors/{team-key}/{sponsor-key}` (per-team, alongside teams/headshots/aliases)

```
teamsDatabase/sponsors/
  cal-womens/
    nike/
      name: "Nike"
      url: "https://example.com/nike-logo.png"
      tier: "presenting"
      order: 0
      updatedAt: "2026-02-13T..."
    state-farm/
      name: "State Farm"
      url: "https://example.com/state-farm.png"
      tier: "official"
      order: 1
      updatedAt: "2026-02-13T..."
  army-mens/
    usaa/
      name: "USAA"
      url: "https://example.com/usaa.png"
      tier: "supporting"
      order: 0
      updatedAt: "2026-02-13T..."
```

**Sponsor key generation**: Slugify the name — lowercase, spaces→hyphens, strip non-`[a-z0-9-]`, collapse consecutive hyphens.

**Tier values**: `"presenting"` | `"official"` | `"supporting"` (default: `"official"`). Metadata only — does not affect overlay display sizing.

**Listener impact**: The existing Firebase listener on `teamsDatabase/sponsors` captures the nested structure automatically. The `sponsors` state shape becomes `{ "cal-womens": { "nike": {...} }, ... }` instead of the previous flat structure. No listener code changes needed.

---

## 2. Hook Changes — `useTeamsDatabase.js`

**File**: `show-controller/src/hooks/useTeamsDatabase.js`

Three existing functions need team-key scoping. Two new query helpers are needed.

### Modified functions

**`saveSponsor`** (line 259) — add `teamKey` as first parameter, add `tier` field:
- Old: `saveSponsor(sponsorKey, sponsorData)`
- New: `saveSponsor(teamKey, sponsorKey, sponsorData)`
- Path changes from `teamsDatabase/sponsors/${sponsorKey}` to `teamsDatabase/sponsors/${teamKey}/${sponsorKey}`
- Writes: `{ name, url, tier: data.tier || 'official', order: data.order ?? 0, updatedAt }`

**`deleteSponsor`** (line 277) — add `teamKey` as first parameter:
- Old: `deleteSponsor(sponsorKey)`
- New: `deleteSponsor(teamKey, sponsorKey)`
- Path changes from `teamsDatabase/sponsors/${sponsorKey}` to `teamsDatabase/sponsors/${teamKey}/${sponsorKey}`

**`reorderSponsors`** (line 290) — add `teamKey` as first parameter:
- Old: `reorderSponsors(orderedKeys)`
- New: `reorderSponsors(teamKey, orderedKeys)`
- Update paths change from `teamsDatabase/sponsors/${key}/order` to `teamsDatabase/sponsors/${teamKey}/${key}/order`

### New helpers (add in QUERY HELPERS section after line 496)

**`getTeamSponsors(teamKey)`** — returns sorted array of `{ key, name, url, tier, order }` for a given team. Returns `[]` if team has no sponsors.

**`getTeamSponsorCount(teamKey)`** — returns number of sponsors for a team. Returns `0` if none.

### No changes needed to
- `sponsors` state declaration (line 40) — `useState({})` handles the new nested shape
- Firebase listener (lines 81-87) — same parent path `teamsDatabase/sponsors`
- `checkLoaded` threshold (line 54) — already at 4

### Breaking change safety
These functions are only called from `MediaManagerPage.jsx` (updated simultaneously). The Rundown Editor's per-segment `sponsor` field (`segment.sponsor.name/logo/tier`) is completely independent — it does not call these hook functions.

### Updated exports (lines 783-786)
Add `getTeamSponsors` and `getTeamSponsorCount` to the return object.

---

## 3. Media Manager UI — Inline `SponsorsView`

**File**: `show-controller/src/pages/MediaManagerPage.jsx`

### Destructure from hook (lines 22-32)
Add: `sponsors`, `saveSponsor`, `deleteSponsor`, `reorderSponsors`, `getTeamSponsors`, `getTeamSponsorCount`

### Team card header (lines 344-394)
Add sponsor count badge alongside existing status indicators: `"3 Spons"` (amber) or `"No Spons"` (zinc).

### Expanded card (lines 398-404)
Wrap `RosterView` + new `SponsorsView` in a fragment:

```jsx
{expandedTeam === team.key && (
  <>
    <RosterView ... />
    <SponsorsView teamKey={team.key} ... />
  </>
)}
```

### SponsorsView component (new, after RosterView definition at line 648)

**Props**: `{ teamKey, getTeamSponsors, saveSponsor, deleteSponsor, reorderSponsors }`

**Layout**:
```
[Section header: "Sponsors (N)" with amber SparklesIcon]
[Sponsor list - if any:]
  Row: [48x48 logo thumbnail] [Name] [Tier badge] [Truncated URL] [Up] [Down] [Delete]
  Row: ...
[Add sponsor form - always visible:]
  [Name input] [Logo URL input + 48x48 preview] [Tier dropdown] [Add button]
[Empty state: "No sponsors for this team"]
```

**Behavior**:
- **Add**: Enter name + logo URL + tier (dropdown: presenting/official/supporting, default "official"). On submit: auto-slugify name → `sponsorKey`, auto-set `order` to current count, call `saveSponsor(teamKey, sponsorKey, {...})`. Clear form on success.
- **Duplicate key guard**: Before saving, check if `sponsorKey` already exists in `getTeamSponsors(teamKey)`. If it does, show an inline error: `"A sponsor named '{name}' already exists for this team"` and do NOT call `saveSponsor`. This prevents silent overwrites.
- **Logo URL preview**: When URL is pasted, show a 48x48 inline thumbnail. Use `<img onError>` to show red broken-image warning. Do NOT block save on broken image.
- **Reorder**: Up/Down arrow buttons call `reorderSponsors(teamKey, newOrderedKeys)` with the full recomputed key array (swap the two adjacent items in the sorted list, extract all keys in new order).
- **Delete**: Trash icon, no confirmation (consistent with existing patterns). Calls `deleteSponsor(teamKey, sponsorKey)`.

---

## 4. Overlay: sponsors-thanks.html

**File**: `overlays/sponsors-thanks.html`

**Design**: Card-style layout matching the leaderboard graphics (not full screen).

**Layout**:
- Card container with margins: `top: 50px; left: 70px; right: 70px; bottom: 50px`
- Grey header bar (`#d4d4d8`) with "THANK YOU TO OUR SPONSORS" title
- Dark content area (`#18181b`) with sponsor cards (`#27272a`)
- Logos fill their card boxes (width/height 100%, object-fit: contain)
- No sponsor name labels - logo only
- Rounded corners (12px) and box shadow for polish

**URL params**:
- `?logo={teamLogoUrl}` — team logo for the header bar (optional)
- `?sponsors={encodedJSON}` — JSON array of `[{name, url}]` objects

**Grid layout** (based on sponsor count):
- 1-2 sponsors: 1-2 columns
- 3-4 sponsors: 2x2 grid
- 5-6 sponsors: 3x2 grid
- 7-8 sponsors: 4x2 grid

**Error handling**:

| Condition | Behavior |
|-----------|----------|
| Missing/empty `?logo=` | Hide header logo element (`display:none`) |
| Missing/empty `?sponsors=` | Show centered "No sponsors configured" |
| Invalid JSON in `?sponsors=` | `try/catch` around `JSON.parse`; show "No sponsors configured" |
| Empty array `[]` | Show "No sponsors configured" |
| Broken sponsor logo URL | `img.onerror`: show fallback div with sponsor name |

> **Why URL params instead of Firebase**: All overlay files use URL params exclusively — none use Firebase. This keeps overlays stateless, cacheable, and resilient to Firebase outages.

---

## 5. Overlay: sponsors-cycle.html

**File**: `overlays/sponsors-cycle.html`

**Design**: Full-screen logo on grey background - clean, simple, maximum impact.

**Layout**:
- Full 1920x1080 viewport
- Grey background (`#E5E5E5`)
- No header bar
- No sponsor name text
- Logo centered and as large as possible (max 1800x960px with 60px padding)
- `object-fit: contain` to preserve aspect ratio

**Cycling**:
- 3-second hold per sponsor
- 0.5s crossfade transition (CSS opacity)
- Continuous loop via `setInterval`
- 1 sponsor = static display (no cycling)

**URL params**:
- `?sponsors={encodedJSON}` — JSON array of `[{name, url}]` objects
- No `?logo=` param needed (no header bar)

**Error handling**:

| Condition | Behavior |
|-----------|----------|
| Missing/empty/invalid `?sponsors=` | Show centered "No sponsors configured" message |
| Empty array `[]` | Same as missing |
| 1 sponsor | Static display — no `setInterval`, no transitions |
| Broken logo during cycle | `img.onerror` → skip to next sponsor |
| ALL logos broken | Show "No sponsors configured" |

**Note on live updates**: URL-param-based overlays are static once loaded. If sponsors change mid-broadcast, the producer must regenerate and reload the URL in OBS.

---

## 6. Overlay: sponsors-bug.html (NEW)

**File**: `overlays/sponsors-bug.html`

This is a **transparent overlay** designed to be composited in OBS on top of the live feed. It shows a small sponsor logo cycling in the bottom-right corner.

**Viewport**: 1920x1080, transparent body (`background: transparent`).

**No header bar** — this is a persistent bug, not a full-screen graphic.

**Layout**:
- Single container: `position: fixed; bottom: 40px; right: 40px; width: 200px; height: 80px;`
- Semi-transparent dark pill background: `background: rgba(0,0,0,0.4); border-radius: 12px; padding: 10px;`
- Single `<img>` inside, `object-fit: contain`, cycling through sponsors
- Fade transition: opacity 0→1, 0.8s duration
- Hold: 10 seconds per sponsor
- Continuous loop

**URL params**:
- `?sponsors={encodedJSON}` — JSON array of `[{name, url}]` objects
- No `?logo=` param (no header bar)

**Error handling**:

| Condition | Behavior |
|-----------|----------|
| Missing/empty/invalid `?sponsors=` | Render nothing (fully transparent page) |
| Empty array `[]` | Same as missing |
| 1 sponsor | Static display, no cycling |
| Broken logo URL | `img.onerror` → skip to next; if ALL broken → hide container (`display:none`) |

---

## 7. Graphics Registry

**File**: `show-controller/src/lib/graphicsRegistry.js` — add new `sponsors` category section before closing `};` at line 945.

**IMPORTANT**: Use a new `'sponsors'` category, NOT `'stream'`, to avoid keyword collision with existing `stream-thanks` (which has keywords `['stream', 'thanks', 'watching', 'end', 'goodbye']`).

```js
// ============================================================
// SPONSOR GRAPHICS
// ============================================================

'sponsors-thanks': {
  id: 'sponsors-thanks',
  label: 'Sponsor Thank You',
  category: 'sponsors',
  keywords: ['sponsor', 'sponsors', 'partner', 'partners', 'thank you'],
  gender: 'both',
  renderer: 'overlay',
  file: 'sponsors-thanks.html',
  transparent: false,
  params: {
    logo: { type: 'string', source: 'competition' },
    sponsors: { type: 'string', source: 'computed' },
  },
},
'sponsors-cycle': {
  id: 'sponsors-cycle',
  label: 'Sponsor Cycle',
  category: 'sponsors',
  keywords: ['sponsor', 'sponsors', 'cycle', 'rotate', 'cycling'],
  gender: 'both',
  renderer: 'overlay',
  file: 'sponsors-cycle.html',
  transparent: false,
  params: {
    logo: { type: 'string', source: 'competition' },
    sponsors: { type: 'string', source: 'computed' },
  },
},
'sponsors-bug': {
  id: 'sponsors-bug',
  label: 'Sponsor Bug',
  category: 'sponsors',
  keywords: ['sponsor', 'bug', 'persistent', 'corner', 'watermark'],
  gender: 'both',
  renderer: 'overlay',
  file: 'sponsors-bug.html',
  transparent: true,
  params: {
    sponsors: { type: 'string', source: 'computed' },
  },
},
```

### Supporting file updates

**`graphicButtons.js`** (show-controller/src/lib/graphicButtons.js): Add a `sponsors` key to the exported `graphicButtons` object. Follow the existing `.map()` pattern. Use number sequence starting at 30 (stream uses 19+, inMeet uses 27+, so 30+ avoids collisions):
```js
sponsors: getGraphicsByCategory('sponsors').map((g, i) => ({
  id: g.id,
  label: g.label,
  number: 30 + i,
})),
```

**`GraphicsManagerPage.jsx`**: Add `'sponsors': 'Sponsors'` to `CATEGORY_LABELS` (line 18). Add dummy sponsors data to `testOptions` when previewing sponsor graphics (so the preview isn't empty/broken).

**`UrlGeneratorPage.jsx`**: Three changes:

1. Add to `baseGraphicTitles` (lines 47-101):
```js
'sponsors-thanks': 'Sponsor Thank You',
'sponsors-cycle': 'Sponsor Cycle',
'sponsors-bug': 'Sponsor Bug',
```

2. Add "Sponsors" sidebar section after the "Stream" section (after line 457). Follow the existing `GraphicSection` + `GraphicSidebarButton` pattern:
```jsx
<GraphicSection title="Sponsors">
  {graphicButtons.sponsors?.map((btn) => (
    <GraphicSidebarButton
      key={btn.id}
      graphic={btn}
      isActive={currentGraphic === btn.id}
      onClick={() => setCurrentGraphic(btn.id)}
    />
  ))}
</GraphicSection>
```

3. Import `graphicButtons.sponsors` — already available since `graphicButtons` is imported at line 4.

---

## 8. URL Builder — Data Plumbing

**File**: `show-controller/src/lib/urlBuilder.js`

### The problem
`generateGraphicURL` receives `formData` + `options`, but sponsors live in `useTeamsDatabase` hook state. The URL builder is a pure utility with no React hooks.

### The solution
Thread sponsors as a pre-serialized JSON string through `options.sponsors`.

### urlBuilder.js changes

**1. Destructure sponsors from options** (line 333):
```js
const { compType, virtiusSessionId, compId, summaryTheme, sponsors } = options;
```

**2. Add three builder functions** (after `buildStreamURL` at line 209):

- `buildSponsorsThanksURL({ logo, sponsorsJson, baseUrl })` → `{base}/overlays/sponsors-thanks.html?logo={logo}&sponsors={sponsorsJson}`
- `buildSponsorsCycleURL({ logo, sponsorsJson, baseUrl })` → `{base}/overlays/sponsors-cycle.html?logo={logo}&sponsors={sponsorsJson}`
- `buildSponsorsBugURL({ sponsorsJson, baseUrl })` → `{base}/overlays/sponsors-bug.html?sponsors={sponsorsJson}`

All use `URLSearchParams` to properly encode the params.

**3. Add three switch cases** before `default:` (line 524):
```js
case 'sponsors-thanks':
  return buildSponsorsThanksURL({ logo: getTeamLogo(1), sponsorsJson: sponsors || '[]', baseUrl: base });
case 'sponsors-cycle':
  return buildSponsorsCycleURL({ logo: getTeamLogo(1), sponsorsJson: sponsors || '[]', baseUrl: base });
case 'sponsors-bug':
  return buildSponsorsBugURL({ sponsorsJson: sponsors || '[]', baseUrl: base });
```

### UrlGeneratorPage.jsx changes (the critical plumbing)

**1. Import hook**: `import { useTeamsDatabase } from '../hooks/useTeamsDatabase';`
**2. Destructure**: `const { getTeamSponsors, resolveSchoolKey } = useTeamsDatabase();`

**3. Resolve home team sponsors** in `generateURLWithOptions` (line 297):
```js
const generateURLWithOptions = (graphic) => {
  let sponsorsJson = null;
  if (graphic.startsWith('sponsors-')) {
    const homeTeamKey = resolveHomeTeamKey(formData, config);
    if (homeTeamKey) {
      const teamSponsors = getTeamSponsors(homeTeamKey);
      const capped = teamSponsors.slice(0, 8).map(s => ({ name: s.name, url: s.url }));
      sponsorsJson = JSON.stringify(capped);
    }
  }
  return generateGraphicURL(graphic, formData, teamCount, undefined, {
    compType: config?.compType,
    virtiusSessionId: config?.virtiusSessionId,
    compId: compId,
    summaryTheme: summaryTheme,
    sponsors: sponsorsJson,
  });
};
```

**4. `resolveHomeTeamKey` helper** — uses the hook's existing `resolveSchoolKey` (line 455 in useTeamsDatabase.js) which checks aliases, normalized names, and dashed variants. This avoids the fragile raw-slugification approach:
```js
function resolveHomeTeamKey(formData, config) {
  if (!formData.team1Name) return null;
  const gender = config?.compType?.startsWith('mens') ? 'mens' : 'womens';
  const schoolKey = resolveSchoolKey(formData.team1Name);
  if (!schoolKey) return null;
  return `${schoolKey}-${gender}`;
}
```

This correctly handles aliases (e.g., "California" → `cal` via `teamsDatabase/aliases/california`), display names, and other naming variants.

### URL length cap enforcement
At N=8 sponsors with ~200 bytes each after URL encoding, the sponsors param stays ~1600 bytes. Combined with other params, total URL stays under the 2KB safe browser limit. The cap is enforced in the caller (UrlGeneratorPage.jsx) with `.slice(0, 8)`.

---

## 9. Task Order

| ID | Task | Files | Dependencies |
|----|------|-------|-------------|
| T1 | Modify hook: rescope sponsor CRUD to per-team, add tier, add `getTeamSponsors`/`getTeamSponsorCount` helpers, update exports | `useTeamsDatabase.js` | — |
| T2 | Add 3 registry entries in new `sponsors` category | `graphicsRegistry.js` | — |
| T3 | Add `sponsors` to `CATEGORY_LABELS` + fix preview for sponsor graphics | `GraphicsManagerPage.jsx` | T2 |
| T4 | Add sponsors button section to graphicButtons | `graphicButtons.js` | T2 |
| T5 | Add 3 builder functions + switch cases + `sponsors` in options | `urlBuilder.js` | T2 |
| T6 | Import hook, add sidebar section, thread sponsors JSON through URL gen | `UrlGeneratorPage.jsx` | T1, T4, T5 |
| T7 | Create `SponsorsView` component, inline in team card, sponsor count badge | `MediaManagerPage.jsx` | T1 |
| T8 | Create `sponsors-thanks.html` overlay | `overlays/sponsors-thanks.html` | — |
| T9 | Create `sponsors-cycle.html` overlay | `overlays/sponsors-cycle.html` | — |
| T10 | Create `sponsors-bug.html` overlay | `overlays/sponsors-bug.html` | — |
| T11 | Build & verify locally (`npm run build`) | — | T1-T10 |
| T12 | Deploy SPA + 3 overlay files, verify production URLs | — | T11 |

**Parallelizable**: T1+T2+T8+T9+T10 can all run in parallel. T3+T4+T5 after T2. T6+T7 after T1.

---

## Deployment

Per CLAUDE.md, overlay files are **not** part of the React build and must be deployed separately.

After `npm run build` and deploying the React SPA:

```bash
# Rebuild overlays tarball (includes 3 new sponsor overlay files)
tar -czf /tmp/claude/overlays.tar.gz overlays/

# Upload and extract to production
# ssh_upload_file: localPath=/tmp/claude/overlays.tar.gz, remotePath=/tmp/overlays.tar.gz, target=3.87.107.201
# ssh_exec: cd /var/www/commentarygraphic && tar -xzf /tmp/overlays.tar.gz && find /var/www/commentarygraphic -name '._*' -delete
```

Verify all three overlay files are accessible (should serve the overlay, NOT the React SPA):
- `https://commentarygraphic.com/overlays/sponsors-thanks.html`
- `https://commentarygraphic.com/overlays/sponsors-cycle.html`
- `https://commentarygraphic.com/overlays/sponsors-bug.html`

---

## Verification

1. **Hook** (after T1): Call `saveSponsor('test-mens', 'test-sponsor', {name:'Test', url:'https://example.com/logo.png', tier:'official'})` → verify Firebase path `teamsDatabase/sponsors/test-mens/test-sponsor` exists with all fields
2. **Media Manager** (after T7): Expand a team card → SponsorsView appears below roster → add/reorder/delete sponsors → verify badge count updates
3. **Overlays** (after T8-T10): Open each HTML file locally with test `?sponsors=` param → verify rendering, error states, cycling timing
4. **URL Generator** (after T6): Select competition with home team that has sponsors → sponsor graphics show correct preview URLs under new "Sponsors" sidebar section
5. **Build** (T11): `cd show-controller && npm run build` → no errors
6. **Deploy** (T12): SPA + overlays → verify production URLs serve overlays (not React SPA)
7. **OBS test**: Add `sponsors-bug.html` URL as Browser Source in OBS → verify transparency works

---

## Rollback Plan

- **React SPA**: Redeploy previous `dist/` build
- **Firebase data**: New `sponsors/{team-key}/...` paths are additive; no existing data is moved or deleted
- **Overlay files**: `rm /var/www/commentarygraphic/overlays/sponsors-*.html` — no existing overlays are modified
- **Git**: `git revert <sha>` + redeploy

---

## Open Questions

1. **Rundown Editor integration**: The Rundown Editor has a separate per-segment sponsor system (`sponsor.name`, `sponsor.logo`, `sponsor.tier` per segment) plus a SponsorFulfillmentModal. Should the segment sponsor picker pull from the per-team `teamsDatabase/sponsors` database? This would unify sponsor management but adds a dependency. Deferred to a future iteration.

2. **Sponsor logo hosting**: The plan assumes sponsor logos are hosted externally (e.g., direct URLs pasted into the form). Should there be an upload-to-Firebase-Storage flow in the Media Manager, or is paste-a-URL sufficient for now?

3. ~~**Team key resolution edge cases**~~: Resolved — `resolveHomeTeamKey` now uses the hook's existing `resolveSchoolKey` function (line 455 in useTeamsDatabase.js), which checks aliases, normalized names, and dashed variants. This handles cases like "California" → `cal` via the aliases database.
