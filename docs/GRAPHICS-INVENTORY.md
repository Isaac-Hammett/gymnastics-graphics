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
- Default V2-V19 (various styles)
- **V20 Combined Best** - Enhanced layout with:
  - Start values (SV) displayed with 2 decimal places
  - Top 3 apparatus ranking badges (meet-wide, not just current rotation)
  - Team ranking badges in header
  - Larger fonts than V19
- **V21 Extra Large** - Same features as V20 with even larger fonts for big displays
- **V22 Integrated Rank** - Same as V21 but rankings are integrated into the order bubble:
  - Order bubble changes color based on apparatus ranking (gold/silver/bronze gradient)
  - Small medal icon (🥇🥈🥉) appears in the bubble for top 3 athletes
  - No separate ranking badge - cleaner visual design
- **V23 No Rankings** - Same as V22 but WITHOUT ranking integration in order bubbles:
  - Order bubbles always stay grey (no gold/silver/bronze colors)
  - No medal icons in the bubbles
  - Clean appearance without athlete apparatus rankings
  - Still shows team rank badge in header (1st/2nd/3rd place)

### V20/V21/V22/V23 Font Size Comparison

| Element | V20 | V21 | V22 | V23 |
|---------|-----|-----|-----|-----|
| Team name | 24px | 30px | 30px | 30px |
| Event name | 16px | 20px | 20px | 20px |
| Header total | 28px | 36px | 36px | 36px |
| Athlete name | 22px | 28px | 28px | 28px |
| Athlete score | 26px | 34px | 34px | 34px |
| Footer total | 32px | 40px | 40px | 40px |

### V22 vs V23 Ranking Feature Comparison

| Feature | V22 | V23 |
|---------|-----|-----|
| Order bubble ranking colors | Yes (gold/silver/bronze) | No (always grey) |
| Medal icons in bubble | Yes (🥇🥈🥉) | No |
| Team rank badge in header | Yes | Yes |
| Start values (SV) | Yes | Yes |
| Font sizes | Extra Large | Extra Large |

### V22 Integrated Ranking Feature

V22 uses the same font sizes as V21 but integrates the apparatus ranking directly into the order bubble:

| Ranking | Bubble Style | Icon |
|---------|-------------|------|
| 1st Place | Gold gradient with shadow | 🥇 |
| 2nd Place | Silver gradient with shadow | 🥈 |
| 3rd Place | Bronze gradient with shadow | 🥉 |
| No Ranking | Standard grey | None |

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
