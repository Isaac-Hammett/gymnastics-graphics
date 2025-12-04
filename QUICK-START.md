# 🚀 Quick Start - Multi-Competition Graphics

## What Changed?

**OLD SYSTEM:** Single competition → All outputs share the same graphics

**NEW SYSTEM:** Multiple competitions → Each has independent graphics

## 3-Minute Setup

### Step 1: Deploy (2 minutes)
```bash
# Option A: Drag & Drop
1. Go to https://app.netlify.com/drop
2. Drag this folder onto the page
3. Copy your URL

# Option B: Git Deploy
git add .
git commit -m "Multi-competition graphics"
git push origin main
# Then connect repository in Netlify dashboard
```

### Step 2: Create Competitions (1 minute each)
```
1. Open: https://your-site.netlify.app/dashboard.html
2. Click: "+ Create New Competition"
3. Enter:
   - Competition ID: court1
   - Event Name: Your event
   - Teams: Team names
   - Date/Venue: Details
4. Click: "Save Competition"
5. Repeat for court2 and court3
```

### Step 3: Set Up OBS (30 seconds per source)
```
For each competition:
1. Add new "Browser" source
2. Name it: "Court 1 Graphics" (etc.)
3. URL: https://your-site.netlify.app/output.html?comp=court1
4. Width: 1920
5. Height: 1080
6. Check: "Shutdown source when not visible"
7. Click OK
```

### Step 4: Open Controllers (10 seconds)
```
From dashboard, click "Open Controller" for each competition
→ Bookmark these pages for quick access
```

## That's It! ✅

You now have 3 independent graphics systems running simultaneously.

---

## Visual Guide

### Dashboard View
```
╔════════════════════════════════════════════╗
║  🤸 Gymnastics Graphics Dashboard          ║
╠════════════════════════════════════════════╣
║  [+ Create New Competition]                ║
║                                            ║
║  ┌──────────────────────────────────────┐ ║
║  │ COURT1                 [Configured]  │ ║
║  │ NCAA Regional Championship           │ ║
║  │ December 5, 2025                     │ ║
║  │                                      │ ║
║  │ Michigan vs Ohio State               │ ║
║  │ Crisler Center • Ann Arbor, MI       │ ║
║  │                                      │ ║
║  │ [Open Controller] [Open Output]      │ ║
║  │ [URL Generator]   [Edit Config]      │ ║
║  └──────────────────────────────────────┘ ║
║                                            ║
║  ┌──────────────────────────────────────┐ ║
║  │ COURT2                 [Configured]  │ ║
║  │ ... (similar card)                   │ ║
║  └──────────────────────────────────────┘ ║
╚════════════════════════════════════════════╝
```

### Controller View
```
╔════════════════════════════════════════════╗
║ ⚙️ Meet Setup     │  Graphics Control      ║
╠═══════════════════╪════════════════════════╣
║ Event Info        │ ● Connected            ║
║ Event Name:       │ Competition: COURT1    ║
║ [NCAA Regional]   │ Current: Team Logos    ║
║                   │                        ║
║ Team 1            │ PRE-MEET GRAPHICS      ║
║ Name: [Michigan]  │ [1. Logos] [2. Event]  ║
║ Logo: [URL...]    │ [3. Hosts] [4. Stats]  ║
║                   │                        ║
║ Team 2            │ EVENT FRAMES           ║
║ Name: [OSU]       │ [8. Floor] [9. Pommel] ║
║ Logo: [URL...]    │ [10. Rings] [11. Vault]║
║                   │                        ║
║                   │ [⛔ CLEAR GRAPHIC]      ║
╚═══════════════════╧════════════════════════╝
```

### OBS Setup
```
OBS Scenes:

📁 Court 1 Graphics
  ├─ 🖥️ Browser Source: output.html?comp=court1
  └─ 📹 Camera, etc.

📁 Court 2 Graphics
  ├─ 🖥️ Browser Source: output.html?comp=court2
  └─ 📹 Camera, etc.

📁 Court 3 Graphics
  ├─ 🖥️ Browser Source: output.html?comp=court3
  └─ 📹 Camera, etc.
```

---

## Common Workflows

### Workflow 1: Simple Operator
```
1. Open controller (from dashboard)
2. Click buttons as needed during broadcast
3. Press Space to clear graphics
4. Done!
```

### Workflow 2: Multi-Operator
```
Operator A → Controls Court 1 (one browser window)
Operator B → Controls Court 2 (another window)
Operator C → Controls Court 3 (third window)

Each works independently, no coordination needed!
```

### Workflow 3: Solo Operator (All 3 Courts)
```
1. Open 3 browser windows side-by-side
2. Label them clearly (Court 1, 2, 3)
3. Check status bar to know which is which
4. Switch between windows as needed
5. Use keyboard shortcuts for speed (1-20)
```

---

## Key Features

### ✅ Complete Isolation
- Each competition has its own data
- Changing graphics in Court 1 NEVER affects Court 2 or 3
- No possibility of cross-contamination

### ✅ Real-Time Sync
- Multiple controllers can control same competition
- All controllers see the same "Current" graphic
- Useful for backup operators or training

### ✅ Pre-Configuration
- Set up all competitions before going live
- Config stored in Firebase (persists across page reloads)
- Edit anytime from dashboard

### ✅ Instant Updates
- Controller → Firebase → Output in <100ms
- No manual refresh needed
- Graphics appear immediately

### ✅ Easy Recovery
- If controller crashes: Just reload the page
- If output glitches: Refresh OBS source
- Config is safely stored in Firebase

---

## URLs Explained

### Dashboard
```
https://your-site.netlify.app/dashboard.html
```
- Main hub for everything
- Create/edit/delete competitions
- Access all other pages
- No competition ID needed

### Controller
```
https://your-site.netlify.app/controller.html?comp=court1
                                                    ^^^^^^
                                              Competition ID
```
- Requires `?comp=` parameter
- Loads config for that competition
- Only controls specified competition
- Status bar shows which competition

### Output
```
https://your-site.netlify.app/output.html?comp=court1
                                                ^^^^^^
                                          Competition ID
```
- Requires `?comp=` parameter
- Listens to that competition's Firebase path
- Add to OBS as Browser Source
- Silent error if no competition ID

### URL Generator (Optional)
```
https://your-site.netlify.app/index.html?comp=court1
                                              ^^^^^^
                                        Optional (loads config)
```
- Can work without competition ID (manual entry)
- If provided, loads config from Firebase
- Generates URLs for static overlays

---

## Troubleshooting

### ❌ "No competition ID specified"
**Solution:** Access via dashboard, not directly

### ❌ Graphics showing on wrong output
**Solution:** Check `?comp=` parameter in OBS source URL

### ❌ Config not loading
**Solution:**
1. Check competition exists in dashboard
2. Refresh controller page
3. Verify Firebase connection (green dot)

### ❌ Multiple competitions interfering
**This shouldn't happen!**
- Each uses separate Firebase path
- Double-check URLs have different `?comp=` values
- Check browser console for errors

---

## Pro Tips

### 🎯 Use Descriptive IDs
```
Good: court1, court2, court3
Good: prelims, semis, finals
Good: session-a, session-b, session-c

Bad: comp1, c1, x
Why: Easy to confuse during broadcast
```

### 🎯 Bookmark Everything
```
Before broadcast, bookmark:
- Dashboard
- Controller for each competition
- (Optional) URL generator for each

Organize in folder: "Broadcast - Dec 5"
```

### 🎯 Test Keyboard Shortcuts
```
Practice these BEFORE going live:
- 1-7: Pre-meet graphics
- 8-18: Event frames
- Space: Clear (use often!)

Much faster than clicking!
```

### 🎯 Name OBS Sources Clearly
```
Good: "Court 1 Graphics - Floor"
Bad: "Browser Source 1"

You'll thank yourself during broadcast!
```

### 🎯 Keep Dashboard Open
```
Always have dashboard tab open
→ Quick access to any controller
→ Can create new competition on-the-fly
→ Edit configs if needed
```

---

## What's Next?

### Tonight:
1. ✅ Deploy to Netlify
2. ✅ Create 3 competitions
3. ✅ Set up OBS
4. ✅ Test everything

### Tomorrow:
1. ✅ Open controllers 30 min early
2. ✅ Test each competition once
3. ✅ Start broadcast
4. ✅ Use graphics as needed
5. ✅ Celebrate success! 🎉

---

## Support

Need help? Check these files:
- **README.md** - Full system documentation
- **DEPLOYMENT.md** - Netlify deployment guide
- **SYSTEM-OVERVIEW.md** - Architecture details
- **TEST.md** - Testing procedures
- **TOMORROW-CHECKLIST.md** - Pre-broadcast checklist

---

**You're all set! The system is ready for tomorrow's broadcast.** 🚀

**Questions? Issues? Check browser console (F12) - it tells you everything!**
