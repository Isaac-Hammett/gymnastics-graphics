# Manifest Format

## What

Complete manifest JSON schema with all fields required by Phase 4.

## Manifest Schema

### Stage Engine Graphics

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["id", "label", "category", "renderer", "skeleton", "blocks"],
  "properties": {
    "id": {
      "type": "string",
      "description": "Unique graphic identifier (e.g., 'leaderboard-vt')"
    },
    "label": {
      "type": "string",
      "description": "Display name in UI (e.g., 'Vault')"
    },
    "labelTemplate": {
      "type": "string",
      "description": "Dynamic label with {teamName} substitution"
    },
    "category": {
      "type": "string",
      "enum": ["full-screen-cards", "lower-thirds", "full-bleed", "video-frames", "standalone"],
      "description": "Primary category (must match categories.json)"
    },
    "subcategory": {
      "type": "string",
      "description": "Sub-group within category (must match categories.json)"
    },
    "renderer": {
      "type": "string",
      "enum": ["stage"],
      "description": "Always 'stage' for stage engine graphics"
    },
    "skeleton": {
      "type": "string",
      "description": "Skeleton name (must exist in stage/skeletons/)"
    },
    "blocks": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Block types used (must exist in stage/blocks/)"
    },
    "gender": {
      "type": "string",
      "enum": ["mens", "womens", "both"],
      "default": "both"
    },
    "transparent": {
      "type": "boolean",
      "default": false,
      "description": "OBS background handling"
    },
    "perTeam": {
      "type": "boolean",
      "default": false,
      "description": "Expands to team1-*, team2-*, etc."
    },
    "minTeams": {
      "type": "integer",
      "minimum": 1
    },
    "maxTeams": {
      "type": "integer",
      "maximum": 10
    },
    "keywords": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Search/recommendation keywords"
    },
    "params": {
      "type": "object",
      "additionalProperties": {
        "type": "object",
        "properties": {
          "type": { "type": "string" },
          "default": {},
          "required": { "type": "boolean" },
          "source": {
            "type": "string",
            "enum": ["competition", "user", "computed", "theme"]
          }
        }
      }
    },
    "defaultData": {
      "type": "object",
      "properties": {
        "blocks": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "type": { "type": "string" },
              "data": { "type": "object" }
            }
          }
        }
      }
    }
  }
}
```

### Legacy Overlay Graphics

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["id", "label", "category", "renderer", "file"],
  "properties": {
    "id": { "type": "string" },
    "label": { "type": "string" },
    "labelTemplate": { "type": "string" },
    "category": { "type": "string" },
    "subcategory": { "type": "string" },
    "renderer": {
      "type": "string",
      "enum": ["overlay"],
      "description": "Always 'overlay' for overlay HTML files"
    },
    "file": {
      "type": "string",
      "description": "HTML filename (e.g., 'event-bar.html')"
    },
    "gender": { "type": "string" },
    "transparent": { "type": "boolean" },
    "perTeam": { "type": "boolean" },
    "minTeams": { "type": "integer" },
    "maxTeams": { "type": "integer" },
    "keywords": { "type": "array" },
    "params": { "type": "object" }
  }
}
```

### Legacy Output Graphics

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "required": ["id", "label", "category", "renderer", "file"],
  "properties": {
    "id": { "type": "string" },
    "label": { "type": "string" },
    "category": { "type": "string" },
    "subcategory": { "type": "string" },
    "renderer": {
      "type": "string",
      "enum": ["output"],
      "description": "Always 'output' for output.html graphics"
    },
    "file": {
      "type": "string",
      "description": "Graphic name (no extension)"
    },
    "gender": { "type": "string" },
    "transparent": { "type": "boolean" },
    "perTeam": { "type": "boolean" },
    "keywords": { "type": "array" },
    "params": { "type": "object" }
  }
}
```

## Example Manifests

### Stage Engine: Leaderboard

```json
{
  "id": "leaderboard-vt",
  "label": "Vault",
  "category": "full-screen-cards",
  "subcategory": "leaderboards",
  "renderer": "stage",
  "skeleton": "full-screen-card",
  "blocks": ["header-bar", "leaderboard-table"],
  "gender": "both",
  "transparent": false,
  "keywords": ["vault", "vt", "leaderboard", "scores", "ranking"],
  "params": {
    "apparatus": { "type": "string", "default": "VT" }
  },
  "defaultData": {
    "blocks": [
      { "type": "header-bar", "data": { "title": "VAULT" } },
      { "type": "leaderboard-table", "data": { "source": "scoring/leaderboard/VT", "gender": null } }
    ]
  }
}
```

### Stage Engine: Team Roster (perTeam)

```json
{
  "id": "team-roster",
  "label": "Team Roster",
  "labelTemplate": "{teamName} Roster",
  "category": "full-screen-cards",
  "subcategory": "team-info",
  "renderer": "stage",
  "skeleton": "full-screen-card",
  "blocks": ["header-bar", "athlete-grid"],
  "gender": "both",
  "transparent": false,
  "perTeam": true,
  "keywords": ["roster", "team", "athletes", "headshots"],
  "defaultData": {
    "blocks": [
      { "type": "header-bar", "data": { "title": null } },
      { "type": "athlete-grid", "data": { "teamKey": null } }
    ]
  }
}
```

### Legacy Overlay: Event Bar

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

### Legacy Output: Event Summary

```json
{
  "id": "summary-r1",
  "label": "Rotation 1",
  "category": "event-summary",
  "subcategory": "rotations",
  "renderer": "output",
  "file": "event-summary",
  "gender": "both",
  "keywords": ["summary", "rotation", "r1", "scores"],
  "params": {
    "virtiusSessionId": { "type": "string", "source": "competition", "required": true },
    "summaryMode": { "type": "string", "default": "rotation" },
    "summaryRotation": { "type": "number", "default": 1 },
    "summaryNumTeams": { "type": "number", "source": "computed" },
    "summaryFormat": { "type": "string", "default": "alternating" },
    "summaryTheme": { "type": "string", "default": "default" },
    "summaryGender": { "type": "string", "source": "competition" }
  }
}
```

## categories.json

```json
{
  "full-screen-cards": {
    "label": "Full-Screen Cards",
    "order": 1,
    "subcategories": {
      "leaderboards": "Leaderboards",
      "team-info": "Team Info",
      "sponsors": "Sponsors"
    }
  },
  "lower-thirds": {
    "label": "Lower-Thirds",
    "order": 2,
    "subcategories": {
      "event-info": "Event Info",
      "team-stats": "Team Stats",
      "spotlight": "Spotlight"
    }
  },
  "full-bleed": {
    "label": "Full-Bleed",
    "order": 3,
    "subcategories": {
      "slates": "Slates",
      "stream": "Stream",
      "sponsors": "Sponsors"
    }
  },
  "video-frames": {
    "label": "Video Frames",
    "order": 4,
    "subcategories": {
      "camera-layouts": "Camera Layouts",
      "apparatus": "Apparatus"
    }
  },
  "standalone": {
    "label": "Standalone",
    "order": 5,
    "subcategories": {}
  },
  "event-summary": {
    "label": "Event Summary",
    "order": 6,
    "subcategories": {
      "rotations": "By Rotation",
      "apparatus": "By Apparatus"
    }
  }
}
```

## Build Script Validation

The build script validates:

1. **Required fields** — `id`, `label`, `category` (all), `renderer` (all), `skeleton`/`blocks` (stage), `file` (legacy)
2. **Category/subcategory** — must exist in `categories.json`
3. **Skeleton existence** — `stage/skeletons/{skeleton}.html` must exist
4. **Block existence** — `stage/blocks/{block}.js` must exist for each block
5. **No duplicate IDs** — across all manifests
6. **themeVars compliance** — block CSS uses declared variables (warning only)

## Open Questions

1. Should manifests support JSON Schema `$ref` for shared param definitions?
2. Should `params.transform` be added for special processing (newline→pipe)?
3. Should there be a manifest editor UI in the Theme Editor?
