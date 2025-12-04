# System Overview - Multi-Competition Graphics

## System Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     DASHBOARD.HTML                          │
│              (Competition Management)                        │
│                                                             │
│  • Create/Edit/Delete Competitions                          │
│  • Configure Meet Details                                   │
│  • Access Controllers & Outputs                             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ├─────────────────────────────────────┐
                            │                                     │
                            ▼                                     ▼
        ┌──────────────────────────────┐      ┌──────────────────────────────┐
        │   CONTROLLER.HTML            │      │   OUTPUT.HTML                │
        │   (Operator Interface)       │      │   (OBS Browser Source)       │
        │                              │      │                              │
        │  ?comp=court1                │◄────►│  ?comp=court1                │
        │                              │      │                              │
        │  • Load config from Firebase │      │  • Listen to Firebase        │
        │  • Button grid (20 graphics) │      │  • Render graphics           │
        │  • Keyboard shortcuts        │      │  • Auto-update on change     │
        │  • Send to Firebase          │      │  • 1920x1080 display         │
        └──────────────────────────────┘      └──────────────────────────────┘
                            │                                     ▲
                            │                                     │
                            └─────────►  FIREBASE  ◄─────────────┘
                                       Realtime DB
                                            │
                    ┌──────────────────────┼──────────────────────┐
                    ▼                      ▼                      ▼
          /competitions/court1   /competitions/court2   /competitions/court3
               /config                /config                /config
               /currentGraphic        /currentGraphic        /currentGraphic
```

## Competition Isolation

Each competition operates in its own Firebase namespace:

```
Firebase Structure:
/competitions
  ├── court1
  │   ├── config
  │   │   ├── eventName: "NCAA Regional"
  │   │   ├── team1Name: "Michigan"
  │   │   ├── team2Name: "Ohio State"
  │   │   └── ... (all meet details)
  │   └── currentGraphic
  │       ├── graphic: "logos"
  │       ├── data: {...}
  │       └── timestamp: 1234567890
  │
  ├── court2
  │   ├── config
  │   └── currentGraphic
  │
  └── court3
      ├── config
      └── currentGraphic
```

**Key Point:** Changing graphics in court1 controller ONLY affects court1 output.

## User Workflow

### Setup Phase (Before Broadcast)

1. **Open Dashboard**
   ```
   https://your-site.netlify.app/dashboard.html
   ```

2. **Create Competitions**
   - Click "+ Create New Competition"
   - Enter competition ID (e.g., `court1`)
   - Fill in event name, teams, venue, date
   - Repeat for all 3 competitions

3. **Configure OBS**
   - Add Browser Source for each competition
   - URL: `output.html?comp=court1` (change ID for each)
   - Size: 1920x1080
   - Name scenes appropriately (e.g., "Court 1 Graphics")

### Broadcast Phase (Live)

4. **Open Controllers**
   - From dashboard, click "Open Controller" for each competition
   - Each controller opens in a new tab/window
   - Can be on different computers/devices

5. **Operate Graphics**
   - Click buttons or use keyboard shortcuts (1-20)
   - Graphics appear instantly in OBS
   - Press Space to clear
   - Multiple operators can control same competition (syncs)

## Data Flow Example

**Operator clicks "Team Logos" button on Court 1 controller:**

```
1. Controller reads form inputs
   ├── eventName: "NCAA Regional"
   ├── team1Name: "Michigan"
   ├── team1Logo: "https://..."
   └── team2Name: "Ohio State"

2. Controller sends to Firebase:
   /competitions/court1/currentGraphic
   {
     graphic: "logos",
     data: { all config values },
     timestamp: Date.now()
   }

3. Output listens to Firebase change:
   - Detects new graphic type: "logos"
   - Runs logos renderer with data
   - Updates DOM with HTML

4. OBS displays:
   - Two team logos side-by-side
   - White background
   - Smooth fade-in animation
```

**Meanwhile, Court 2 and Court 3 continue showing their own graphics independently.**

## File Purposes

| File | Purpose | Competition ID Required? |
|------|---------|-------------------------|
| **dashboard.html** | Competition management hub | No |
| **controller.html** | Live control interface | Yes (?comp=) |
| **output.html** | Display for OBS | Yes (?comp=) |
| **index.html** | URL generator (optional) | Optional (?comp=) |
| **/overlays/*** | Static overlay files | No (uses URL params) |

## Graphic Types

### Full Screen (White/Black Background)
- **logos** - Team logos side-by-side
- **stream-starting** - "Stream Starting Soon" card
- **stream-thanks** - "Thanks for Watching" card

### Overlays (Transparent Background)
- **event-bar** - Lower-third venue info
- **hosts** - Host names card
- **team1-stats** / **team2-stats** - Team statistics
- **team1-coaches** / **team2-coaches** - Coaching staff
- **event-frame** - Frame for apparatus (floor, vault, etc.)
  - Used for: floor, pommel, rings, vault, pbars, hbar, allaround, final, order, lineups, summary

### Total: 20+ Graphics
Organized in 3 categories:
1. Pre-Meet (7 graphics)
2. Event Frames (11 graphics)
3. Stream (2 graphics)

## Controller Features

### Status Bar
- **Green dot**: Connected to Firebase
- **Competition ID**: Shows which competition you're controlling
- **Current graphic**: Shows what's live

### Config Panel
- Pre-populated from Firebase
- Can be edited on-the-fly
- Changes apply immediately to next graphic switch

### Button Grid
- Color-coded sections
- Number labels (1-20)
- Active button highlighted in blue
- Keyboard shortcuts match numbers

### Clear Button
- Large red button at bottom
- Clears all graphics
- Keyboard: Space or Esc

## Security Considerations

⚠️ **Current Setup:**
- Firebase rules are open (anyone can read/write)
- No authentication required
- Competition IDs are visible in URLs

**For Production:**
Consider adding:
- Firebase Authentication
- Database security rules
- Password-protected dashboard
- Private competition IDs

**For Tomorrow:**
Current setup is fine for controlled environment. Just don't share URLs publicly.

## Troubleshooting Quick Reference

| Issue | Solution |
|-------|----------|
| Graphics not switching | Check competition ID matches in controller and output |
| Controller won't load | Must access via dashboard or include ?comp= in URL |
| Wrong graphic showing | Multiple controllers open? Check which one is active |
| Can't see graphic in OBS | Check browser console (right-click source → Interact) |
| Graphics overlapping | Each competition needs separate OBS browser source |

## Performance Notes

- **Firebase**: Real-time updates, negligible latency (<100ms)
- **Browser**: Graphics render instantly (CSS animations)
- **OBS**: Hardware accelerated, no performance impact
- **Multiple competitions**: Fully independent, no interference

## Extension Ideas (Post-Launch)

If you want to enhance later:
- [ ] Authentication system
- [ ] Live preview in controller
- [ ] Custom graphic editor
- [ ] Scoreboard integration
- [ ] Automated rotation of graphics
- [ ] Mobile controller app
- [ ] Multi-view dashboard (see all competitions)
- [ ] Analytics (which graphics used most)
- [ ] Template library
- [ ] CSV import for teams/athletes

## Support During Broadcast

**If something breaks:**
1. Check browser console (F12)
2. Verify Firebase connection (green dot)
3. Refresh controller/output page
4. Worst case: Delete and recreate competition in dashboard

**Emergency fallback:**
Use index.html to generate static overlay URLs, add directly to OBS, control manually.

---

**Ready for tomorrow! Good luck with the broadcast! 🤸‍♂️🎥**
