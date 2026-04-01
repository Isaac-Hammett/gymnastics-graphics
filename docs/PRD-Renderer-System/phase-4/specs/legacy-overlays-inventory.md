# Legacy Overlays Inventory

## What

Complete list of overlay HTML files that need manifest files in `stage/graphics/legacy/`.

## Current State

**Directory:** `/Users/juliacosmiano/code/gymnastics-graphics/overlays/`

### HTML Overlay Files (30 total)

| Graphic ID | Filename | Category (expected) |
|-----------|----------|---------------------|
| animated-background | animated-background.html | standalone |
| athlete-spotlight | athlete-spotlight.html | lower-thirds |
| clip-player | clip-player.html | standalone |
| coaches | coaches.html | lower-thirds |
| event-bar | event-bar.html | lower-thirds |
| event-calendar | event-calendar.html | standalone |
| event-frame | event-frame.html | video-frames |
| frame-dual | frame-dual.html | video-frames |
| frame-quad | frame-quad.html | video-frames |
| frame-single | frame-single.html | video-frames |
| frame-team-header | frame-team-header.html | video-frames |
| frame-tri-center | frame-tri-center.html | video-frames |
| frame-tri-wide | frame-tri-wide.html | video-frames |
| frame-tri-wide-top | frame-tri-wide-top.html | video-frames |
| hosts | hosts.html | lower-thirds |
| interview-card | interview-card.html | full-bleed |
| logos | logos.html | standalone |
| replay | replay.html | lower-thirds |
| rotation-slate | rotation-slate.html | full-bleed |
| rotation-slate-auto | rotation-slate-auto.html | full-bleed |
| sponsors-bug | sponsors-bug.html | sponsors |
| sponsors-cycle | sponsors-cycle.html | sponsors |
| sponsors-thanks | sponsors-thanks.html | sponsors |
| stream | stream.html | full-bleed |
| team-bug | team-bug.html | standalone |
| team-roster | team-roster.html | full-screen-cards |
| team-stats | team-stats.html | lower-thirds |
| warm-up | warm-up.html | lower-thirds |
| who-to-watch | who-to-watch.html | lower-thirds |
| who-to-watch-title | who-to-watch-title.html | full-bleed |

### Supporting Files (not manifests)

| File | Purpose |
|------|---------|
| theme-loader.js | Theme loading and CSS variable application |
| theme-overrides.css | Per-graphic CSS variable cascades |

## Manifest Count by Category

| Category | Count | Graphics |
|----------|-------|----------|
| lower-thirds | 9 | event-bar, warm-up, replay, hosts, coaches, team-stats, athlete-spotlight, who-to-watch |
| video-frames | 8 | event-frame, frame-quad, frame-tri-center, frame-tri-wide, frame-tri-wide-top, frame-team-header, frame-single, frame-dual |
| full-bleed | 5 | rotation-slate, rotation-slate-auto, stream, interview-card, who-to-watch-title |
| sponsors | 3 | sponsors-thanks, sponsors-cycle, sponsors-bug |
| standalone | 4 | logos, event-calendar, team-bug, clip-player, animated-background |
| full-screen-cards | 1 | team-roster |

**Total overlay manifests needed: 30**

## Output.html Graphics (not overlays)

These graphics are rendered by output.html, not standalone HTML files:

| Graphic ID | Category | Notes |
|-----------|----------|-------|
| virtuis-leaderboard | leaderboards | Per-apparatus (VT, FX, PH, SR, PB, HB, UB, BB) |
| leaderboard-aa | leaderboards | All-around |
| combined-aa-leaderboard | leaderboards | Multi-session |
| event-summary | event-summary | R1-R6 + per-apparatus variants |
| now-competing | in-meet | Live athlete tracking |

**Total output.html manifests needed: ~25** (including variants)

## Target State

### Manifest File Example (event-bar)

```json
{
  "id": "event-bar",
  "label": "Event Info",
  "category": "lower-thirds",
  "subcategory": "event-info",
  "renderer": "overlay",
  "file": "event-bar.html",
  "transparent": true,
  "gender": "both",
  "keywords": ["event", "info", "bar", "venue", "location", "lower-third"],
  "params": {
    "team1Logo": { "type": "string", "source": "competition", "required": true },
    "venue": { "type": "string", "source": "competition" },
    "eventName": { "type": "string", "source": "competition" },
    "location": { "type": "string", "source": "competition" },
    "meetTheme": { "type": "string", "source": "theme" }
  }
}
```

### Manifest File Example (sponsors-cycle)

```json
{
  "id": "sponsors-cycle",
  "label": "Cycling Sponsors",
  "category": "sponsors",
  "renderer": "overlay",
  "file": "sponsors-cycle.html",
  "transparent": true,
  "gender": "both",
  "keywords": ["sponsors", "cycle", "rotating", "ads"],
  "params": {
    "sponsors": { "type": "json", "source": "computed", "description": "JSON array of sponsor objects" },
    "cycleSpeed": { "type": "number", "default": 5000 },
    "lockedIndex": { "type": "number", "default": -1 },
    "meetTheme": { "type": "string", "source": "theme" }
  }
}
```

## Risks

1. **Param extraction** — must extract params from urlBuilder.js for each graphic
2. **Inconsistent param naming** — some graphics use different conventions
3. **Special handling** — sponsors, event-summary have complex param logic

## Open Questions

1. Should `animated-background` and `clip-player` be in manifests (internal use only)?
2. Should `team-bug` be included (it's a control overlay, not a broadcast graphic)?
3. How to represent computed/derived params in manifest schema?
