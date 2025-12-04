# Gymnastics Graphics System - Multi-Competition Setup

## Quick Start for Tomorrow's Broadcast

### 1. Open the Dashboard
Navigate to: `dashboard.html`

This is your control center for managing multiple competitions.

### 2. Create Your Competitions
Click **"+ Create New Competition"** and fill in:
- **Competition ID**: Use simple names like `court1`, `court2`, `court3` (lowercase, no spaces)
- **Event Name**: e.g., "NCAA Regional Championship"
- **Meet Date**: e.g., "December 5, 2025"
- **Venue**: e.g., "Main Arena"
- **Location**: e.g., "Columbus, OH"
- **Team Names**: Both competing teams

Create all 3 competitions before going live.

### 3. Set Up OBS
For each competition, add a **Browser Source** in OBS:

**Settings:**
- Width: `1920`
- Height: `1080`
- URL: `https://your-netlify-site.netlify.app/output.html?comp=court1`
  - Change `court1` to `court2`, `court3` for other competitions
- Check: "Shutdown source when not visible" (saves resources)
- Check: "Refresh browser when scene becomes active" (optional)

### 4. Open Controllers
From the dashboard, click **"Open Controller"** for each competition.

Each controller:
- Shows competition ID in the status bar
- Loads pre-configured meet details
- Works independently - changes only affect its competition
- Can be operated by different people simultaneously

**Keyboard Shortcuts:**
- `1-20`: Trigger graphics 1-20
- `Space` or `Esc`: Clear graphic

### 5. During Broadcast
- Switch graphics by clicking buttons or using keyboard shortcuts
- Current graphic shows in status bar
- All controllers sync (multiple people can see what's live)
- Each competition is completely isolated

## System Architecture

### Competition Isolation
Each competition has its own Firebase path:
```
/competitions
  /court1
    /config          ← Meet details, team info
    /currentGraphic  ← Live graphic state
  /court2
    /config
    /currentGraphic
  /court3
    /config
    /currentGraphic
```

### Files Overview

- **dashboard.html** - Competition management dashboard
- **controller.html** - Live control panel (requires `?comp=` parameter)
- **output.html** - Display output for OBS (requires `?comp=` parameter)
- **index.html** - URL generator for static overlays (optional `?comp=` parameter)
- **/overlays/** - Individual overlay files for URL-based graphics

## Workflow Options

### Option A: Live Control (Recommended)
1. Dashboard → Create competitions
2. OBS → Add output.html with competition ID
3. Open controller for each competition
4. Switch graphics in real-time

### Option B: Pre-Generated URLs
1. Dashboard → Create competition
2. Click "URL Generator" from dashboard
3. Generate all 20+ graphic URLs
4. Add each URL as separate OBS Browser Source
5. Manually show/hide in OBS

## Troubleshooting

### Controller shows "No competition ID"
- Access controllers through the dashboard, not directly
- URL must include `?comp=yourcompid`

### Graphics not appearing
- Check browser console in OBS (right-click source → Interact)
- Verify competition ID matches between controller and output
- Check Firebase connection (status dot should be green)

### Multiple competitions interfering
- Verify each output has different `?comp=` parameter
- Check competition IDs are unique

## Firebase Database Structure

```javascript
/competitions/{competitionId}/currentGraphic
{
  graphic: "logos" | "event-bar" | "event-frame" | etc.,
  data: {
    eventName: "...",
    team1Name: "...",
    team1Logo: "...",
    // ... all config data
  },
  timestamp: 1234567890
}
```

## Tips for Live Broadcast

1. **Pre-configure everything** in the dashboard before going live
2. **Test each competition** - switch a few graphics to verify isolation
3. **Keep dashboard open** to quickly access any controller
4. **Use keyboard shortcuts** for faster switching (1-20, Space to clear)
5. **Multiple operators** can control same competition (syncs automatically)
6. **Monitor OBS preview** - output updates instantly when controller changes

## Adding a New Competition Mid-Broadcast

1. Open dashboard
2. Click "+ Create New Competition"
3. Fill in details
4. Click "Open Output" and copy the URL
5. Add new Browser Source in OBS with that URL
6. Click "Open Controller" to start operating

## Deployment to Netlify

1. Push this repository to GitHub
2. Connect to Netlify
3. Build settings: None needed (static HTML)
4. Deploy
5. Update OBS Browser Source URLs to your Netlify domain

## Support

- Check browser console for errors
- Firebase dashboard: https://console.firebase.google.com/
- All graphics are 1920x1080 resolution
