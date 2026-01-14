# Graphics Inventory

Complete list of all graphics available in the gymnastics-graphics system.

---

## Pre-Meet Graphics
| Graphic Type | Trigger | Duration | Data Source |
|--------------|---------|----------|-------------|
| Team Logos | Manual | Static | Firebase config (team logos) |
| Event Info Bar | Manual | Static | Firebase config (event name, venue, location) |
| Warm Up | Manual | Static | Firebase config |
| Hosts | Manual | Static | Firebase config (hosts list) |
| Team 1-6 Stats | Manual | 5-10s | Firebase config (ave, high, conference) |
| Team 1-6 Coaches | Manual | 5-10s | Firebase config (coaches list) |

## Stream Graphics
| Graphic Type | Trigger | Duration | Data Source |
|--------------|---------|----------|-------------|
| Starting Soon | Segment/Manual | Fixed timer | Static |
| Thanks for Watching | Segment/Manual | Fixed timer | Static |

## Event Frame Graphics (Apparatus-Specific)
| Graphic Type | Trigger | Duration | Data Source |
|--------------|---------|----------|-------------|
| Floor Exercise | Manual/Segment | Persistent | Firebase + Virtius API |
| Pommel Horse (M) | Manual/Segment | Persistent | Firebase + Virtius API |
| Still Rings (M) | Manual/Segment | Persistent | Firebase + Virtius API |
| Vault | Manual/Segment | Persistent | Firebase + Virtius API |
| Parallel Bars (M) | Manual/Segment | Persistent | Firebase + Virtius API |
| High Bar (M) | Manual/Segment | Persistent | Firebase + Virtius API |
| Uneven Bars (W) | Manual/Segment | Persistent | Firebase + Virtius API |
| Balance Beam (W) | Manual/Segment | Persistent | Firebase + Virtius API |
| All Around | Manual | Persistent | Virtius API |
| Final Scores | Manual | Persistent | Virtius API |

## Leaderboard Graphics
| Graphic Type | Trigger | Duration | Data Source |
|--------------|---------|----------|-------------|
| FX Leaders | Manual | 5-10s | Virtius API |
| PH Leaders (M) | Manual | 5-10s | Virtius API |
| SR Leaders (M) | Manual | 5-10s | Virtius API |
| VT Leaders | Manual | 5-10s | Virtius API |
| PB Leaders (M) | Manual | 5-10s | Virtius API |
| HB Leaders (M) | Manual | 5-10s | Virtius API |
| UB Leaders (W) | Manual | 5-10s | Virtius API |
| BB Leaders (W) | Manual | 5-10s | Virtius API |
| AA Leaders | Manual | 5-10s | Virtius API |

## Event Summary Graphics
| Graphic Type | Trigger | Duration | Data Source |
|--------------|---------|----------|-------------|
| Summary R1-R6 (By Rotation) | Manual | Persistent | Virtius API (alternating format for dual meets) |
| Summary by Apparatus | Manual | Persistent | Virtius API (head-to-head format) |

## Frame Overlays (OBS Scene Frames)
| Graphic Type | Trigger | Duration | Data Source |
|--------------|---------|----------|-------------|
| Quad View Frame | Manual | Persistent | Static (team logos) |
| Tri Center Frame | Manual | Persistent | Static (team logos) |
| Tri Wide Frame | Manual | Persistent | Static (team logos) |
| Team Header Frame | Manual | Persistent | Static (team logos) |
| Single Frame | Manual | Persistent | Static (team logos) |

## Live/Dynamic Graphics
| Graphic Type | Trigger | Duration | Data Source |
|--------------|---------|----------|-------------|
| Now Competing | Manual (poll-based) | 5-10s | Virtius API (live athlete detection) |

---

## Summary by Category

| Category | Count | Notes |
|----------|-------|-------|
| Pre-Meet | 4 + (2×teams) | Team stats/coaches scale with team count (2-6) |
| Stream | 2 | Starting Soon, Thanks |
| Event Frames | 10 | Gender-specific (6 men's, 4 women's + AA/Final) |
| Leaderboards | 9 | Gender-specific + AA |
| Event Summary | 10-12 | R1-R4/R6 + apparatus buttons |
| Frame Overlays | 5 | OBS scene decorations |
| Live Graphics | 1 | Now Competing (auto-detected from Virtius) |

**Total: ~35-45 unique graphics** (varies by gender and team count)

---

## Event Summary Themes

The Event Summary graphic supports multiple layout and color themes:

### Layout Themes
- Hero Cards
- Classic Broadcast
- Default V2-V20 (various styles)

### Color Themes
- Default (Original)
- ESPN Colors
- NBC Olympics
- Big Ten
- Pac-12
- Virtius
- Neon
- Classic
- Light
- Team Colors
- Gradient

---

## Gender-Specific Events

### Men's Gymnastics (6 events)
1. Floor Exercise (FX)
2. Pommel Horse (PH)
3. Still Rings (SR)
4. Vault (VT)
5. Parallel Bars (PB)
6. High Bar (HB)

### Women's Gymnastics (4 events)
1. Vault (VT)
2. Uneven Bars (UB)
3. Balance Beam (BB)
4. Floor Exercise (FX)

---

*Generated with Claude Code*
