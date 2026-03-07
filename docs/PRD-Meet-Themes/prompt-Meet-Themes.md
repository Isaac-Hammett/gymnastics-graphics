# PRD-Meet-Themes Implementation Workflow

## RULES
- **FIRST**: Run `browser_install` (Playwright MCP tool) to ensure the browser is available before any verification steps
- Complete each phase FULLY before moving to the next
- Mark checkboxes [x] as you complete each step
- DO NOT parallelize file reads - read sequentially, one at a time
- After each phase, output the checkpoint summary before continuing
- If verification fails, record bug and STOP (handle in next context window)
- **ONE TASK PER ITERATION** — implement one task from the implementation plan, then deploy and verify

## TEST COMPETITION FOR VERIFICATION
- **Competition ID:** `fr0ts7fj`
- **Producer URL:** `https://commentarygraphic.com/fr0ts7fj/producer`
- **Output URL:** `https://commentarygraphic.com/output.html?comp=fr0ts7fj`
- **Name:** Pink Invitational 2026 (WAG, 4 teams: West Chester, Rutgers, Penn, Yale)
- **Theme:** `pink-meet-2026` (already assigned in competition config)
- Use this competition for all theme verification — it auto-loads the theme from Firebase config
- **Note:** No Virtius session, so leaderboard will show "No results found" — but header/chrome theming is still verifiable

---

## Phase 1: Load Context

Read these files ONE AT A TIME. After EACH file, output the answers before reading the next file.

- [ ] **1.1** Read PRD: `docs/PRD-Meet-Themes/PRD-Meet-Themes-2026-03-06.md`

  **Output before continuing:**
  ```
  ✓ 1.1 PRD Read
  - Feature name: [fill in]
  - Current PRD status: [fill in]
  - Number of user stories: [fill in]
  ```

- [ ] **1.2** Read Implementation Plan: `docs/PRD-Meet-Themes/implementation-plan.md`

  **Output before continuing:**
  ```
  ✓ 1.2 Implementation Plan Read
  - Total phases: [fill in]
  - Total tasks: [fill in]
  - Tasks NOT STARTED: [fill in]
  - Tasks IN PROGRESS: [fill in]
  - Tasks COMPLETE: [fill in]
  ```

- [ ] **1.3** Read theme-overrides.css: `overlays/theme-overrides.css`

  **Output before continuing:**
  ```
  ✓ 1.3 theme-overrides.css Read
  - Number of CSS rule sections: [fill in]
  - Selectors defined: [list]
  ```

- [ ] **1.4** Read theme-loader.js: `overlays/theme-loader.js`

  **Output before continuing:**
  ```
  ✓ 1.4 theme-loader.js Read
  - CSS vars set: [list]
  - Data attributes set: [list]
  - Logo handling: [description]
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
  - Phase: [fill in]
  - Reason: First incomplete task in priority order
  - Files to create/modify: [fill in]
  ```

---

## Phase 2.5: Read Required Files

**Before implementing, read ALL files you will modify.**

- [ ] **2.5.1** For each file you plan to modify, read it fully
- [ ] **2.5.2** For new files, read a similar existing file for patterns

  **Output:**
  ```
  ✓ 2.5 Files Read
  - Files read: [list]
  - Patterns to follow: [brief notes]
  ```

---

## Phase 3: Implement

- [ ] **3.1** Implement the selected task
- [ ] **3.2** Update Implementation Plan:
  - Mark task status (NOT STARTED → IN PROGRESS → COMPLETE)
  - Add any notes about changes made
  - Add any bugs discovered

  **Output:**
  ```
  ✓ 3.2 Implementation Complete
  - Changes made: [brief summary]
  - Files created: [list]
  - Files modified: [list]
  - Bugs found: [none / list]
  ```

---

## Phase 4: Commit & Push

- [ ] **4.1** Stage and commit:
  ```bash
  git add -A && git commit -m "PRD-Meet-Themes: [brief description]" && git push origin main
  ```

  **Output:**
  ```
  ✓ 4.1 Committed and pushed
  - Commit message: [fill in]
  ```

---

## Phase 5: Deploy (if needed)

Determine what changed and deploy accordingly:

- [ ] **5.1** Frontend changes (show-controller)? → Build and deploy per CLAUDE.md
- [ ] **5.2** Graphics files changed (output.html, overlays/)? → Deploy per CLAUDE.md Step 2
- [ ] **5.3** No deployment needed? → Mark as skipped

  **Output:**
  ```
  ✓ 5.x Deploy
  - Deploy type: [frontend / graphics / both / none]
  - Status: [success / skipped]
  ```

---

## Phase 6: Verify on Production

- [ ] **6.1** Navigate to https://commentarygraphic.com using Playwright
- [ ] **6.2** Take screenshot
- [ ] **6.3** Check console for errors
- [ ] **6.4** Test the specific feature changed:

  **For Phase 7 tasks (color coverage):**
  - Load the modified overlay with `?meetTheme=pink-meet-2026` and any required params
  - Verify accent colors are pink (#E91E8C) not default gray (#d4d4d8 or #BFBFBF)
  - Verify text is readable on themed backgrounds
  - Load the SAME overlay WITHOUT `?meetTheme` and verify it looks identical to before (zero regression)

  **For Phase 8 tasks (logo substitution):**
  - Load an event-level overlay (event-bar, warm-up, replay, stream) with `?meetTheme=pink-meet-2026`
  - Verify the logo shown is the meet logo, NOT team1's logo
  - Load a team-specific overlay (team-stats, coaches) and verify it still shows the team logo
  - Load without theme and verify team logo shows as before

  **For Phase 9 tasks (event sponsors):**
  - Open Theme Editor, select a theme, add event sponsors
  - Open producer view for a themed competition
  - Click "Sponsor Thank You" and verify event sponsors appear (not team sponsors)
  - Remove theme from competition and verify team sponsors appear again

  **For Phase 10 tasks (Event Summary V24):**
  - Open producer view for themed competition
  - Select "V24 Meet Theme" from Event Summary layout dropdown
  - Trigger an event summary (e.g., R1)
  - Verify header/badges/borders use theme colors
  - Verify team columns still use team colors

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
- [ ] **7.3** Commit status update:
  ```bash
  git add -A && git commit -m "PRD-Meet-Themes: update status" && git push origin main
  ```

  **Output:**
  ```
  ✓ 7.3 Status Updated
  - PRD status: [IN PROGRESS / COMPLETE]
  - Tasks remaining: [count]
  - Next task: [task name]
  ```

---

## Quick Reference

| Change Type | Deploy Command |
|-------------|----------------|
| Frontend only | `npm run build` + upload per CLAUDE.md |
| Graphics files | Upload output.html + overlays/ per CLAUDE.md Step 2 |
| Both | Deploy frontend first, then graphics files |
| Docs only | No deploy needed |

---

## Theme Data Structure Reference

### Firebase `themes/{themeId}`
```json
{
  "id": "pink-meet-2026",
  "name": "Pink Meet 2026",
  "description": "Breast cancer awareness fundraiser",
  "colors": {
    "accentPrimary": "#E91E8C",
    "accentSecondary": "#FFB6D9",
    "headerBg": "#E91E8C",
    "headerText": "#FFFFFF",
    "footerBg": "#E91E8C",
    "borderColor": "#E91E8C",
    "badgeBg": "#E91E8C",
    "badgeText": "#FFFFFF",
    "overlayBg": "#1a0a12",
    "overlayText": "#FFFFFF"
  },
  "logos": {
    "meetLogo": "https://...",
    "causeLogo": "https://..."
  },
  "branding": {
    "meetTitle": "PINK MEET 2026",
    "subtitle": "Supporting Breast Cancer Research"
  },
  "sponsors": [
    { "name": "Sponsor Name", "url": "https://logo-url..." }
  ]
}
```

### CSS Variables
All meet-theme CSS variables use the `--meet-` prefix:
- `--meet-accent-primary`, `--meet-accent-secondary`
- `--meet-header-bg`, `--meet-header-text`
- `--meet-footer-bg`, `--meet-border-color`
- `--meet-badge-bg`, `--meet-badge-text`
- `--meet-overlay-bg`, `--meet-overlay-text`
- `--meet-logo-url`, `--meet-cause-logo-url`

### Data Attributes (set by theme-loader.js)
- `data-meet-theme` on `<body>` — theme ID (enables CSS selector targeting)
- `data-meet-logo` on `<body>` — plain meet logo URL (for JS img src substitution)
- `data-meet-cause-logo` on `<body>` — plain cause logo URL

### Logo Substitution Rule
- **Event-level graphics** (event-bar, warm-up, replay, stream, leaderboards): show meet logo when theme active
- **Team-specific graphics** (stats, coaches, roster, spotlight): always show team logo
- **No theme active**: all graphics show team logo as before

### Blending Rule
Theme colors override CHROME elements (headers, footers, borders, badges, dividers).
Team colors are PRESERVED in team-specific areas (team columns, team name backgrounds).
