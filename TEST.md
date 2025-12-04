# Testing Multi-Competition Isolation

## Quick Test (5 minutes)

### 1. Open Dashboard
Open `dashboard.html` in your browser.

### 2. Create 2 Test Competitions
Create two competitions:
- **ID:** `test1`
  - Event: "Test Meet A"
  - Teams: "Team Red" vs "Team Blue"

- **ID:** `test2`
  - Event: "Test Meet B"
  - Teams: "Team Green" vs "Team Yellow"

### 3. Open 4 Browser Windows

Arrange them in a 2x2 grid:

```
┌─────────────────────┬─────────────────────┐
│   Controller Test1  │   Output Test1      │
│                     │                     │
│  ?comp=test1        │  ?comp=test1        │
│                     │                     │
└─────────────────────┴─────────────────────┘
┌─────────────────────┬─────────────────────┐
│   Controller Test2  │   Output Test2      │
│                     │                     │
│  ?comp=test2        │  ?comp=test2        │
│                     │                     │
└─────────────────────┴─────────────────────┘
```

### 4. Test Isolation

**In Controller Test1:**
- Click "Team Logos"
- Verify: Output Test1 shows logos for Team Red vs Team Blue
- Verify: Output Test2 shows NOTHING (or previous graphic)

**In Controller Test2:**
- Click "Event Info Bar"
- Verify: Output Test2 shows event bar for "Test Meet B"
- Verify: Output Test1 STILL shows Team Logos (unchanged)

**Switch multiple times:**
- Test1: Hosts → Stats → Coaches
- Test2: Logos → Event Bar → Stream Starting
- Verify: Each output only responds to its own controller

### 5. Test Synchronization

**Open a SECOND controller for Test1 in another window:**
- Click different graphic
- Verify: Both Test1 controllers update to show active graphic
- Verify: Both Test1 controllers highlight the same button
- This proves multiple operators can control same competition

### 6. Test Keyboard Shortcuts

**In Controller Test1:**
- Press `1` (should show Logos)
- Press `2` (should show Event Bar)
- Press `Space` (should clear)
- Verify: Output Test1 updates
- Verify: Output Test2 is unaffected

### 7. Clean Up
- Go back to dashboard
- Delete both test competitions
- Ready for real setup!

## Expected Results ✅

- [x] Each competition operates independently
- [x] Changing graphics in one doesn't affect others
- [x] Multiple controllers can control same competition
- [x] Keyboard shortcuts work
- [x] Clear button works
- [x] Competition ID visible in status bar
- [x] Config loads from Firebase

## If Something Fails ❌

### Problem: Graphics not showing
**Check:**
- Browser console for errors (F12)
- Competition ID in URL is correct
- Firebase connection (green dot)

### Problem: Wrong competition responding
**Check:**
- URL parameter `?comp=` matches
- Not accidentally controlling wrong window

### Problem: Config not loading
**Check:**
- Competition was created in dashboard
- Refresh the controller page
- Check Firebase console for data

### Problem: Multiple competitions interfering
**This shouldn't happen!** Each uses separate Firebase path.
- Double-check the `?comp=` parameter in each URL
- Check browser console for errors

## Real-World Test Scenario

Once basic test passes, simulate broadcast:

1. **Create 3 competitions:**
   - court1: "Session 1 - Prelims"
   - court2: "Session 2 - Semis"
   - court3: "Session 3 - Finals"

2. **Open 3 outputs in OBS:**
   - Add as browser sources
   - Verify each shows independently

3. **Open 3 controllers:**
   - Put on different monitors/devices
   - Have someone help test simultaneous control

4. **Run through a mock broadcast:**
   ```
   Court 1: Logos → Event Bar → Floor Frame → Clear
   Court 2: Logos → Event Bar → Vault Frame → Clear
   Court 3: Logos → Event Bar → Hosts → Team Stats
   ```

5. **Verify timing:**
   - Graphics should appear instantly (<100ms)
   - No lag between controller click and output
   - No interference between courts

## Stress Test (Optional)

**Rapid Switching:**
- Click through all 20 graphics quickly
- Verify no lag or errors
- Check memory usage in OBS

**Simultaneous Updates:**
- Change graphics on all 3 competitions at same time
- Verify all update correctly

**Long Running:**
- Leave outputs running for 30+ minutes
- Verify no memory leaks
- Check performance remains smooth

## Success Criteria

✅ **Ready for broadcast if:**
- All 3 competitions operate independently
- Graphics switch instantly
- No console errors
- OBS performance is smooth
- Keyboard shortcuts work
- Multiple controllers sync properly

🎉 **System is production-ready!**

## Quick Reference During Testing

**Common URLs:**
```
Dashboard:     /dashboard.html
Controller 1:  /controller.html?comp=court1
Controller 2:  /controller.html?comp=court2
Controller 3:  /controller.html?comp=court3
Output 1:      /output.html?comp=court1
Output 2:      /output.html?comp=court2
Output 3:      /output.html?comp=court3
```

**Keyboard Shortcuts:**
- 1-7: Pre-Meet graphics
- 8-18: Event frames
- 19-20: Stream graphics
- Space/Esc: Clear graphic

**Firebase Paths:**
```
/competitions/court1/config
/competitions/court1/currentGraphic
/competitions/court2/config
/competitions/court2/currentGraphic
/competitions/court3/config
/competitions/court3/currentGraphic
```
