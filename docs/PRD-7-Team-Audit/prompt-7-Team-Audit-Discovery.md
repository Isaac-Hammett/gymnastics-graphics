# PRD-7-Team-Audit — Discovery Audit Prompt

## RULES
- **FIRST**: Run `browser_install` (Playwright MCP tool) to ensure the browser is available
- This prompt is READ-ONLY — do NOT modify any code files
- Only modify documentation files (PRD, implementation plan) to record bugs
- Take a screenshot for EVERY test — save with descriptive filenames
- Check `browser_console_messages` after every page load
- If a test reveals a bug, document it immediately in the PRD before moving on
- Complete ALL tests in a single iteration

## TEST COMPETITION
- **Competition ID:** `sewj4d2b`
- **Producer URL:** `https://commentarygraphic.com/sewj4d2b/producer`
- **Output URL:** `https://commentarygraphic.com/output.html?comp=sewj4d2b`
- **Format:** Women's 7-Team (7 teams, 4 apparatus, 7 rotations, 4 compete per rotation, 3 on bye)

---

## Phase 1: Load Context

- [ ] **1.1** Read the PRD: `docs/PRD-7-Team-Audit/PRD-7-Team-Audit-2026-03-06.md`
- [ ] **1.2** Read the implementation plan: `docs/PRD-7-Team-Audit/implementation-plan.md`

  **Output:**
  ```
  ✓ Phase 1 Complete
  - Bugs already cataloged: [count]
  - Tasks already complete: [count]
  ```

---

## Phase 2: Producer View Audit

Navigate to the producer URL and systematically test the UI.

- [ ] **2.1** Run `browser_install`
- [ ] **2.2** Navigate to `https://commentarygraphic.com/sewj4d2b/producer`
- [ ] **2.3** Take screenshot of the full producer page
- [ ] **2.4** Check console for errors: `browser_console_messages`

### Test A1: Page Load
- [ ] Does the page load without JS errors?
- [ ] Is the competition name displayed correctly?
- [ ] Is the competition type shown as womens-7 or "Women's 7-Team"?

  **Output:**
  ```
  Test A1: Page Load
  - Result: [PASS / FAIL]
  - Console errors: [none / list]
  - Screenshot: [filename]
  ```

### Test A2: Team Buttons
- [ ] Take a snapshot (`browser_snapshot`) of the producer sidebar
- [ ] Count the team-specific buttons (stats, coaches, roster)
- [ ] Are buttons visible for ALL 7 teams (team1 through team7)?
- [ ] Or only a subset (e.g., team1-team2)?

  **Output:**
  ```
  Test A2: Team Buttons
  - Result: [PASS / FAIL]
  - Teams with buttons visible: [list team numbers]
  - Expected: team1 through team7
  - Bug: [none / BUG-XXX description]
  ```

### Test A3: Rotation Buttons
- [ ] Scroll to the Event Summary section
- [ ] Take a snapshot of the rotation buttons area
- [ ] Count the rotation buttons (R1, R2, ... R7)
- [ ] Are all 7 rotation buttons visible?

  **Output:**
  ```
  Test A3: Rotation Buttons
  - Result: [PASS / FAIL]
  - Rotation buttons visible: [list, e.g., R1-R4 or R1-R7]
  - Expected: R1 through R7
  - Bug: [none / BUG-XXX description]
  ```

### Test A4: Rotation Button Layout
- [ ] Do the rotation buttons fit in a clean grid?
- [ ] Is there any wrapping, overflow, or misalignment?

  **Output:**
  ```
  Test A4: Rotation Button Layout
  - Result: [PASS / FAIL]
  - Layout: [clean grid / wrapping / overflow]
  - Bug: [none / BUG-XXX description]
  ```

### Test A5: Apparatus Buttons
- [ ] Are apparatus-specific event summary buttons visible? (Vault, Bars, Beam, Floor)
- [ ] Take screenshot

  **Output:**
  ```
  Test A5: Apparatus Buttons
  - Result: [PASS / FAIL]
  - Buttons visible: [list]
  ```

---

## Phase 3: Team Bug Overlay Audit

- [ ] **3.1** Navigate to: `https://commentarygraphic.com/output.html?comp=sewj4d2b&graphic=team-bug`
- [ ] **3.2** Take screenshot
- [ ] **3.3** Check console for errors

### Test D1: Team Rows
- [ ] Are all 7 team rows rendered?
- [ ] Take snapshot to count rows

  **Output:**
  ```
  Test D1: Team Rows
  - Result: [PASS / FAIL]
  - Team rows visible: [count]
  - Expected: 7
  ```

### Test D2: Team Logos
- [ ] Are all 7 team logos visible (not broken images)?

  **Output:**
  ```
  Test D2: Team Logos
  - Result: [PASS / FAIL]
  - Broken logos: [none / list which teams]
  ```

### Test D3: Score Display
- [ ] Do score totals appear for all teams?
- [ ] Are scores numeric (not "undefined" or "NaN")?

  **Output:**
  ```
  Test D3: Score Display
  - Result: [PASS / FAIL]
  - Issues: [none / describe]
  ```

### Test D4: Bye Indicator
- [ ] Are teams currently on bye visually distinguishable from competing teams?
- [ ] Is there any "BYE" label, dimming, or other indicator?

  **Output:**
  ```
  Test D4: Bye Indicator
  - Result: [PASS / FAIL]
  - Visual distinction: [yes - describe / no]
  ```

---

## Phase 4: Event Summary Audit

Test event summaries for EACH rotation (R1-R7). For each, trigger from the producer or load directly.

### Test B1-B7: Event Summary by Rotation

For each rotation R1 through R7:
- [ ] Navigate to producer, click the rotation button (or load output URL with rotation param)
- [ ] Take screenshot of the event summary output
- [ ] Check console for errors
- [ ] Verify: How many team columns are shown?
- [ ] Verify: Which teams are shown vs. on bye?
- [ ] Verify: Is the apparatus label correct for each team?
- [ ] Verify: Does the grid layout fit properly?

  **Output for EACH rotation:**
  ```
  Test B[N]: Event Summary R[N]
  - Result: [PASS / FAIL]
  - Teams shown: [count and names]
  - Teams on bye: [count and names]
  - Expected: 4 competing, 3 on bye
  - Grid layout: [proper / broken / overflow]
  - Console errors: [none / list]
  - Bug: [none / BUG-XXX description]
  ```

### Test C1-C4: Event Summary by Apparatus

For each apparatus (Vault, Bars, Beam, Floor):
- [ ] Trigger apparatus-specific event summary
- [ ] Take screenshot
- [ ] Verify all 7 teams are shown
- [ ] Verify scores display correctly

  **Output for EACH apparatus:**
  ```
  Test C[N]: Event Summary [Apparatus]
  - Result: [PASS / FAIL]
  - Teams shown: [count]
  - Expected: 7
  - Console errors: [none / list]
  ```

---

## Phase 5: Other Graphics Audit

### Test E1: Leaderboard
- [ ] Navigate to: `https://commentarygraphic.com/output.html?comp=sewj4d2b&graphic=leaderboard`
- [ ] Take screenshot
- [ ] Are all 7 teams listed?
- [ ] Any layout overflow?

  **Output:**
  ```
  Test E1: Leaderboard
  - Result: [PASS / FAIL]
  - Teams listed: [count]
  - Layout: [proper / overflow]
  ```

### Test E2: Logos Graphic
- [ ] Navigate to: `https://commentarygraphic.com/output.html?comp=sewj4d2b&graphic=logos`
- [ ] Take screenshot
- [ ] Are all 7 team logos displayed?

  **Output:**
  ```
  Test E2: Logos
  - Result: [PASS / FAIL]
  - Logos shown: [count]
  ```

### Test E3: Now Competing
- [ ] From producer, trigger a Now Competing graphic for an athlete on team 7
- [ ] Take screenshot of the output
- [ ] Is the correct team logo shown (team 7's logo, not team 1's)?

  **Output:**
  ```
  Test E3: Now Competing (Team 7)
  - Result: [PASS / FAIL]
  - Logo shown: [correct team / wrong team]
  - Bug: [none / BUG-XXX]
  ```

### Test E4: Team Stats Graphics (team1 through team7)
For each team 1-7:
- [ ] Trigger team-stats graphic from producer
- [ ] Does it render with data (not empty/undefined)?

  **Output:**
  ```
  Test E4: Team Stats
  - Teams that render correctly: [list]
  - Teams with issues: [list + description]
  ```

### Test E5: Event Bar
- [ ] Trigger event-bar graphic
- [ ] Take screenshot
- [ ] Any rendering issues?

  **Output:**
  ```
  Test E5: Event Bar
  - Result: [PASS / FAIL]
  ```

---

## Phase 6: Console Error Sweep

- [ ] **6.1** Collect ALL console errors from every page visited during the audit
- [ ] **6.2** Categorize by severity:
  - **Error**: JS exceptions, failed fetches
  - **Warning**: Deprecation notices, non-critical issues
  - **Info**: Informational (ignore)

  **Output:**
  ```
  ✓ Phase 6: Console Error Summary
  - Total errors: [count]
  - Total warnings: [count]
  - Unique error messages: [list]
  ```

---

## Phase 7: Document Findings

- [ ] **7.1** For each new bug discovered (not already in the PRD), add it to the Bug Catalog in `docs/PRD-7-Team-Audit/PRD-7-Team-Audit-2026-03-06.md` under the "Discovered During Playwright Audit" section
- [ ] **7.2** For each new bug, include:
  - Bug ID (continue numbering from existing: BUG-010, BUG-011, etc.)
  - Description
  - Severity (Critical / Major / Minor)
  - Steps to reproduce
  - Expected vs actual behavior
  - Screenshot filename
  - Affected file(s) if identifiable
- [ ] **7.3** Update the implementation plan with new tasks for any newly discovered bugs
- [ ] **7.4** Commit and push the updated docs:
  ```bash
  git add docs/PRD-7-Team-Audit/ && git commit -m "PRD-7-Team-Audit: Playwright audit results" && git push origin main
  ```

  **Output:**
  ```
  ✓ Phase 7: Audit Complete
  - New bugs discovered: [count]
  - Total bugs (code analysis + audit): [count]
  - PRD updated: [yes/no]
  - Implementation plan updated: [yes/no]
  ```

---

## Audit Summary Template

At the very end, output a full summary:

```
═══════════════════════════════════════
  7-TEAM WOMEN'S COMPETITION AUDIT
  Competition: sewj4d2b
═══════════════════════════════════════

PRODUCER VIEW
  A1 Page Load:           [PASS/FAIL]
  A2 Team Buttons:        [PASS/FAIL]
  A3 Rotation Buttons:    [PASS/FAIL]
  A4 Rotation Layout:     [PASS/FAIL]
  A5 Apparatus Buttons:   [PASS/FAIL]

TEAM BUG OVERLAY
  D1 Team Rows:           [PASS/FAIL]
  D2 Team Logos:          [PASS/FAIL]
  D3 Score Display:       [PASS/FAIL]
  D4 Bye Indicator:       [PASS/FAIL]

EVENT SUMMARY (by rotation)
  B1 R1:                  [PASS/FAIL]
  B2 R2:                  [PASS/FAIL]
  B3 R3:                  [PASS/FAIL]
  B4 R4:                  [PASS/FAIL]
  B5 R5:                  [PASS/FAIL]
  B6 R6:                  [PASS/FAIL]
  B7 R7:                  [PASS/FAIL]

EVENT SUMMARY (by apparatus)
  C1 Vault:               [PASS/FAIL]
  C2 Bars:                [PASS/FAIL]
  C3 Beam:                [PASS/FAIL]
  C4 Floor:               [PASS/FAIL]

OTHER GRAPHICS
  E1 Leaderboard:         [PASS/FAIL]
  E2 Logos:               [PASS/FAIL]
  E3 Now Competing:       [PASS/FAIL]
  E4 Team Stats (1-7):    [PASS/FAIL]
  E5 Event Bar:           [PASS/FAIL]

TOTAL: [X] PASS / [Y] FAIL
BUGS: [Z] total ([a] critical, [b] major, [c] minor)
═══════════════════════════════════════
```
