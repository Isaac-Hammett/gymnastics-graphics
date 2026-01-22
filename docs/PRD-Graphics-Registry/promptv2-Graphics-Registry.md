# PRD-Graphics-Registry Implementation Workflow

## RULES
- Complete each phase FULLY before moving to the next
- Mark checkboxes [x] as you complete each step
- DO NOT parallelize file reads - read sequentially, one at a time
- After each phase, output the checkpoint summary before continuing
- If verification fails, record bug and STOP (handle in next context window)

---

## Phase 1: Load Context

Read these files ONE AT A TIME. After EACH file, output the answers before reading the next file.

- [ ] **1.1** Read PRD: `docs/PRD-Graphics-Registry/PRD-Graphics-Registry.md`

  **Output before continuing:**
  ```
  ✓ 1.1 PRD Read
  - Feature name: [fill in]
  - Current PRD status: [fill in]
  - Number of phases: [fill in]
  ```

- [ ] **1.2** Read Implementation Plan: `docs/PRD-Graphics-Registry/PLAN-Graphics-Registry-Implementation.md`

  **Output before continuing:**
  ```
  ✓ 1.2 Implementation Plan Read
  - Total tasks: [fill in]
  - Tasks NOT STARTED: [fill in]
  - Tasks IN PROGRESS: [fill in]
  - Tasks COMPLETE: [fill in]
  ```

- [ ] **1.3** Read Current graphicButtons.js: `show-controller/src/lib/graphicButtons.js`

  **Output before continuing:**
  ```
  ✓ 1.3 graphicButtons.js Read
  - Number of graphic categories: [fill in]
  - Total graphics defined: [fill in]
  ```

- [ ] **1.4** Read Current urlBuilder.js: `show-controller/src/lib/urlBuilder.js`

  **Output before continuing:**
  ```
  ✓ 1.4 urlBuilder.js Read
  - Number of build*URL functions: [fill in]
  - Graphics handled in generateGraphicURL: [fill in]
  ```

---

## Phase 2: Select Next Task

- [ ] **2.1** From the Implementation Plan, identify the FIRST task that is:
  - Status = "IN PROGRESS", OR
  - Status = "NOT STARTED" (if none are IN PROGRESS)

- [ ] **2.2** Output your selection:
  ```
  ✓ 2.2 Task Selected
  - Task ID: [fill in]
  - Task name: [fill in]
  - Reason: First incomplete task in priority order
  - Files to modify: [fill in]
  ```

---

## Phase 2.5: Consult Documentation Library (If Needed)

**Before implementing, check if you need additional context.**

The project has a searchable documentation library at `docs/LIBRARY.md`. Use it when:
- You need to understand how something works (OBS, Firebase, routing, etc.)
- You're unsure about existing patterns or conventions
- The task involves integrating with other systems
- You encounter unfamiliar code or architecture

- [ ] **2.5.1** Determine if you need additional context for this task:
  - If YES → Read `docs/LIBRARY.md`, search for relevant keywords, then read the specific documents you need
  - If NO → Skip to Phase 3

  **Output (if library consulted):**
  ```
  ✓ 2.5 Library Consulted
  - Documents read: [list documents]
  - Key insights: [brief summary of what you learned]
  ```

  **Output (if skipped):**
  ```
  ✓ 2.5 Library Skipped
  - Reason: Task is straightforward / already have sufficient context
  ```

---

## Phase 3: Implement

- [ ] **3.1** Implement the selected task
- [ ] **3.2** Update Implementation Plan:
  - Mark task status (IN PROGRESS → COMPLETE)
  - Add any notes about changes made
  - Add any new bugs discovered

  **Output:**
  ```
  ✓ 3.2 Implementation Complete
  - Changes made: [brief summary]
  - Bugs found: [none / list]
  ```

---

## Phase 4: Commit & Push

- [ ] **4.1** Stage and commit:
  ```bash
  git add -A && git commit -m "PRD-Graphics-Registry: [brief description]" && git push origin main
  ```

  **Output:**
  ```
  ✓ 4.1 Committed and pushed
  - Commit message: [fill in]
  ```

---

## Phase 5: Deploy (if needed)

Determine what changed and deploy accordingly:

- [ ] **5.1** Backend changes? → `ssh_exec` to coordinator, restart PM2
- [ ] **5.2** Frontend changes? → Build and deploy per CLAUDE.md
- [ ] **5.3** No deployment needed? → Mark as skipped

  **Output:**
  ```
  ✓ 5.x Deploy
  - Deploy type: [backend / frontend / both / none]
  - Status: [success / skipped]
  ```

---

## Phase 6: Verify on Production

- [ ] **6.1** Navigate to https://commentarygraphic.com using Playwright
- [ ] **6.2** Take screenshot
- [ ] **6.3** Check console for errors
- [ ] **6.4** Test the specific feature changed

  **Output:**
  ```
  ✓ 6.4 Verification
  - Screenshot taken: [yes/no]
  - Console errors: [none / list]
  - Feature works: [yes / no]
  ```

**If verification FAILS:**
- Record bug in Implementation Plan with details
- STOP here - handle fix in next context window

---

## Phase 7: Update PRD Status

- [ ] **7.1** If ALL tasks complete → Update PRD status to COMPLETE
- [ ] **7.2** If tasks remain → Update PRD status to IN PROGRESS
- [ ] **7.3** Verify Implementation Plan matches PRD (fix any discrepancies)

  **Output:**
  ```
  ✓ 7.3 Status Updated
  - PRD status: [IN PROGRESS / COMPLETE]
  - Tasks remaining: [count]
  ```

---

## Quick Reference

| Change Type | Deploy Command |
|-------------|----------------|
| Backend only | `ssh_exec` to coordinator |
| Frontend only | `npm run build` + upload per CLAUDE.md |
| Both | Deploy backend first, then frontend |
| Docs only | No deploy needed |

---

## Graphics Registry Schema Reference

When creating registry entries, use this schema:

```javascript
{
  id: 'graphic-id',           // Unique identifier (must match button id)
  label: 'Display Name',      // Display name in UI
  labelTemplate: '{teamName} Display',  // Optional: dynamic substitution
  category: 'pre-meet',       // Category for grouping
  keywords: ['search', 'terms'],  // For smart recommendations
  gender: 'both',             // 'mens' | 'womens' | 'both'
  minTeams: 1,                // Optional: minimum teams required
  maxTeams: 6,                // Optional: maximum teams supported
  renderer: 'overlay',        // 'overlay' (overlays/*.html) | 'output' (output.html)
  file: 'filename.html',      // File path or graphic name
  transparent: true,          // For OBS background handling
  perTeam: false,             // If true, generates team1-, team2-, etc.
  params: {                   // Parameter schema
    paramName: {
      type: 'string',         // string | number | enum | boolean
      source: 'competition',  // Auto-fill from competition config
      required: true,
      options: ['a', 'b'],    // For enum type
      default: 'a',           // Default value
      dependsOn: { otherParam: 'value' },  // Conditional visibility
    },
  },
}
```

### Categories
- `pre-meet` - Shown before competition starts
- `in-meet` - Used during competition
- `event-frames` - Event title frames
- `frame-overlays` - Camera layout frames
- `leaderboards` - Score leaderboards
- `event-summary` - Rotation/apparatus summaries
- `stream` - Stream start/end screens

### Parameter Sources
- `competition` - Auto-filled from competition config (team logos, names, etc.)
- `user` - Requires user input (default if no source specified)
