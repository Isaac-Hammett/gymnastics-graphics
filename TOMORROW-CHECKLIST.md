# Tomorrow's Broadcast - Quick Checklist ✅

## Night Before (Tonight)

### Deploy to Netlify
- [ ] Push code to GitHub (or drag-drop to Netlify)
- [ ] Wait for deployment to complete
- [ ] Copy your Netlify URL
- [ ] Test: Open `https://your-site.netlify.app/dashboard.html`

### Create Competitions
- [ ] Open dashboard
- [ ] Create competition 1 (ID: `court1` or similar)
  - [ ] Fill in event name, date, venue
  - [ ] Enter both team names
- [ ] Create competition 2 (ID: `court2`)
  - [ ] Fill in all details
- [ ] Create competition 3 (ID: `court3`)
  - [ ] Fill in all details

### Set Up OBS
- [ ] Open OBS
- [ ] Create scenes for each competition
- [ ] Add Browser Sources (1920x1080):
  - [ ] Court 1: `https://your-site.netlify.app/output.html?comp=court1`
  - [ ] Court 2: `https://your-site.netlify.app/output.html?comp=court2`
  - [ ] Court 3: `https://your-site.netlify.app/output.html?comp=court3`
- [ ] Enable "Shutdown source when not visible"
- [ ] Test each source loads

### Open and Bookmark Controllers
- [ ] From dashboard, click "Open Controller" for Court 1
  - [ ] Bookmark this URL
  - [ ] Test: Click a few buttons, verify output updates
  - [ ] Test: Press Space to clear
- [ ] Repeat for Court 2
- [ ] Repeat for Court 3

### Quick Test
- [ ] Run the 5-minute isolation test (see TEST.md)
- [ ] Verify all 3 competitions work independently
- [ ] Check graphics appear in OBS
- [ ] Test keyboard shortcuts (1-20, Space)

### Prepare Operators
- [ ] Send controller URLs to your operators
- [ ] Brief them on:
  - Keyboard shortcuts (1-20, Space)
  - Which competition they're controlling
  - How to read the status bar
- [ ] Consider: Print quick reference cards

## Day Of Broadcast

### 1 Hour Before
- [ ] Open dashboard: `https://your-site.netlify.app/dashboard.html`
- [ ] Verify all 3 competitions still exist
- [ ] Update any last-minute details (team names, logos)
- [ ] Open all 3 controllers in separate browser windows/tabs
- [ ] Verify OBS sources are active

### 30 Minutes Before
- [ ] Check Firebase status: https://status.firebase.google.com
- [ ] Check Netlify status: https://www.netlifystatus.com
- [ ] Test each controller:
  - [ ] Court 1: Show logos, clear
  - [ ] Court 2: Show logos, clear
  - [ ] Court 3: Show logos, clear
- [ ] Verify graphics appear in OBS preview
- [ ] Check network connection is stable

### 15 Minutes Before
- [ ] Position controllers on appropriate monitors/devices
- [ ] Verify keyboard shortcuts work
- [ ] Set all graphics to "clear" (blank slate)
- [ ] Double-check team logos are loading
- [ ] Brief operators one more time

### Going Live
- [ ] Start with "Stream Starting Soon" graphic
- [ ] Switch to logos when ready
- [ ] Proceed with pre-meet graphics:
  1. Team Logos
  2. Event Info Bar
  3. Hosts
  4. Team Stats (both teams)
  5. Coaches (both teams)

## During Broadcast

### Graphics Order (Typical Flow)
```
Pre-Meet:
→ Stream Starting Soon
→ Team Logos
→ Event Info Bar
→ Hosts
→ Team 1 Stats
→ Team 1 Coaches
→ Team 2 Stats
→ Team 2 Coaches

During Competition:
→ Event Frames (Floor, Vault, etc.)
→ Lineups
→ Competition Order
→ Event Summary

End:
→ Final Scores
→ Thanks for Watching
```

### Operator Workflow
1. Click button or press number key
2. Graphic appears instantly
3. Press Space to clear when done
4. Repeat

### If Something Breaks
1. **Controller won't load:**
   - Refresh the page
   - Check URL has `?comp=` parameter
   - Worst case: Access via dashboard

2. **Graphics not showing in OBS:**
   - Right-click source → Interact
   - Check console for errors
   - Refresh browser source

3. **Wrong competition responding:**
   - Check which controller window is active
   - Verify competition ID in status bar

4. **Firebase connection lost:**
   - Check internet connection
   - Refresh controller page
   - Green dot should reappear

5. **Complete failure:**
   - Use index.html to generate static URLs
   - Add as separate OBS sources
   - Control manually (less ideal but works)

## Post-Broadcast

### Immediate
- [ ] Show "Thanks for Watching" graphic
- [ ] Hold for 10-15 seconds
- [ ] Clear all graphics
- [ ] Close controllers

### Later
- [ ] Export competition data from Firebase (backup)
- [ ] Note any issues that occurred
- [ ] Delete test competitions from dashboard
- [ ] Keep production competitions for records/replay

## Emergency Contacts

**Have These Ready:**
- Firebase Console: https://console.firebase.google.com
- Netlify Dashboard: https://app.netlify.com
- Your Netlify site URL: `___________________________`
- Dashboard URL: `___________________________`

**URLs to Bookmark:**
- Dashboard: `___________________________`
- Controller Court 1: `___________________________`
- Controller Court 2: `___________________________`
- Controller Court 3: `___________________________`

## Quick Reference Card (Print/Share)

```
┌──────────────────────────────────────────┐
│   GYMNASTICS GRAPHICS - QUICK REF        │
├──────────────────────────────────────────┤
│ KEYBOARD SHORTCUTS:                      │
│   1-7   : Pre-Meet Graphics              │
│   8-18  : Event Frames                   │
│   19-20 : Stream Graphics                │
│   SPACE : Clear Graphic                  │
│   ESC   : Clear Graphic                  │
├──────────────────────────────────────────┤
│ STATUS BAR:                              │
│   Green Dot     : Connected              │
│   Competition   : Which court            │
│   Current       : What's live            │
├──────────────────────────────────────────┤
│ TROUBLESHOOTING:                         │
│   • Refresh page if stuck                │
│   • Check competition ID in status       │
│   • Press Space to clear                 │
│   • Green dot = Firebase connected       │
└──────────────────────────────────────────┘
```

## Success Metrics

✅ **Broadcast is successful if:**
- All 3 competitions ran independently
- Graphics switched smoothly
- No technical issues
- Operators found it easy to use

🎉 **You're ready! Break a leg tomorrow!**

## Final Notes

- System is designed to be simple and reliable
- Each competition is completely isolated
- Multiple operators can work simultaneously
- Firebase provides instant synchronization
- No special training needed - just click buttons!

**Remember:** Test everything tonight, then relax. The system is solid! 💪
