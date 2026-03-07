# PRD-Team-Scores-Bug Implementation (v3 - Optimized)

## RULES

**ONE task per iteration. Commit, deploy, verify, STOP.**

---

## Phase 1: Load Quick Task Index

- [ ] **1.1** Read ONLY the Quick Task Index (first ~60 lines):
  ```
  Read: docs/PRD-Team-Scores-Bug/PLAN-Team-Scores-Bug-2026-01-31.md
  Lines: 1-60
  ```

  **Output:**
  ```
  1.1 Quick Task Index
  - Next task: [Task ID]
  - Description: [one line]
  - Target file: [file path]
  - Reference: [pattern source if listed]
  ```

---

## Phase 2: Load Task-Specific Context

Based on task type, read ONLY what's needed:

| Task Type | Read These Files/Lines |
|-----------|------------------------|
| **Overlay HTML/CSS** | `overlays/event-bar.html` (animation/style patterns) |
| **Virtius API** | `output.html:4450-4550` (fetch pattern) |
| **Firebase** | `output.html:200-300` (Firebase init) + PLAN Section 3.3 |
| **Score diff** | PLAN Section 1.3 (pseudocode) |
| **Now competing** | PLAN Section 1.4 + `GraphicsControl.jsx:216-269` |
| **Rotation detection** | PLAN Section 1.5 |
| **Producer panel** | `show-controller/src/components/` (existing panel patterns) |
| **Headshots** | `output.html:5048-5110` (getAthleteHeadshot) |

- [ ] **2.1** Read reference code for this task type (from table above)
- [ ] **2.2** If modifying existing file, read target file/lines

  **Output:**
  ```
  2.2 Context Loaded
  - Pattern source: [file:lines]
  - Target file: [file path]
  - Lines to modify: [line range or "new file"]
  ```

---

## Phase 3: Implement ONE Task

- [ ] **3.1** Implement the task
- [ ] **3.2** Update PLAN Quick Task Index:
  - Change `NOT STARTED` → `COMPLETE`
  - Add implementation notes

  **Output:**
  ```
  3.2 Task Complete
  - Task: [ID]
  - Changes: [brief summary]
  - New bugs: [none / list]
  ```

---

## Phase 4: Commit & Push

```bash
git add [files] && git commit -m "PRD-Team-Scores-Bug: [Task ID] - [brief]

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>" && git push origin main
```

---

## Phase 5: Deploy

| Changed | Action |
|---------|--------|
| `overlays/*` | `tar -czf /tmp/claude/overlays.tar.gz overlays/` → ssh_upload → ssh_exec extract + chmod 644 |
| `show-controller/*` | `npm run build` → tar dist → ssh_upload → ssh_exec extract |
| Docs only | Skip |

**Overlay deploy (copy-paste):**
```bash
tar -czf /tmp/claude/overlays.tar.gz overlays/
# ssh_upload_file: /tmp/claude/overlays.tar.gz → /tmp/overlays.tar.gz
# ssh_exec: cd /var/www/commentarygraphic && tar -xzf /tmp/overlays.tar.gz && chmod 644 overlays/*.html
```

**Frontend deploy (copy-paste):**
```bash
cd show-controller && npm run build
tar -czf /tmp/claude/dist.tar.gz -C dist .
# ssh_upload_file: /tmp/claude/dist.tar.gz → /tmp/dist.tar.gz
# ssh_exec: rm -rf /var/www/commentarygraphic/* && tar -xzf /tmp/dist.tar.gz -C /var/www/commentarygraphic/
```

---

## Phase 6: Verify

- [ ] **6.1** `browser_navigate` to https://commentarygraphic.com
- [ ] **6.2** `browser_take_screenshot`
- [ ] **6.3** `browser_console_messages` (check errors)
- [ ] **6.4** For overlays: navigate to `https://commentarygraphic.com/overlays/team-bug.html?compId=pac12-2025`

  **Output:**
  ```
  6.4 Verified
  - Errors: [none / list]
  - Status: [success / failed]
  ```

**If FAILED:** Record bug in PLAN, STOP. Fix in next iteration.

---

## Phase 7: Update Status

- [ ] **7.1** Commit PLAN updates if not already committed

---

## Code Patterns Quick Reference

### Firebase Listener Pattern
```javascript
firebase.database().ref(`competitions/${compId}/scoreBug/enabled`).on('value', snap => {
  state.enabled = snap.val();
  render();
});
```

### Animation Pattern (from event-bar.html)
```css
.entering { animation: slideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
@keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
```

### Virtius Fetch Pattern
```javascript
const response = await fetch(`https://api.virti.us/session/${sessionId}/json`);
const data = await response.json();
```

### Headshot Lookup Pattern
```javascript
const headshot = headshotsDB[normalizeName(athleteName)] || headshotsDB[`${teamKey}-${normalizeName(athleteName)}`];
```

---

## Context Budget

**Target: <300 lines per iteration**

| Phase | Lines |
|-------|-------|
| 1. Quick Index | ~60 |
| 2. Reference code | ~100-150 |
| 3-7. Actions | ~0 |
| **Total** | **~200 lines** |
