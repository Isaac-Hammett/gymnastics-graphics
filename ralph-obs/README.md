# Ralph OBS - Visual Guide

## The Core Concept: Fresh Context Each Iteration

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│   THE KEY INSIGHT: Each iteration is a FRESH Claude with NO MEMORY          │
│                                                                              │
│   Continuity comes from FILES, not from Claude's context window             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## The Loop Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BASH LOOP (ralph.sh)                               │
│                                                                              │
│  for i in 1..N:                                                             │
│                                                                              │
│    ┌────────────────────────────────────────────────────────────────────┐   │
│    │                     ITERATION 1                                     │   │
│    │                     ══════════                                      │   │
│    │  ┌──────────────┐                                                  │   │
│    │  │ Fresh Claude │ ──► Reads plan.md ──► Does ONE thing ──► EXIT    │   │
│    │  │  (no memory) │     activity.md       Updates files              │   │
│    │  └──────────────┘     AGENT.md          Commits                    │   │
│    │                                                                     │   │
│    │  Context window created ─────────────────────► Context DESTROYED   │   │
│    └────────────────────────────────────────────────────────────────────┘   │
│                                         │                                    │
│                                         ▼                                    │
│    ┌────────────────────────────────────────────────────────────────────┐   │
│    │                     ITERATION 2                                     │   │
│    │                     ══════════                                      │   │
│    │  ┌──────────────┐                                                  │   │
│    │  │ Fresh Claude │ ──► Reads plan.md ──► Does ONE thing ──► EXIT    │   │
│    │  │  (no memory) │     (NOW UPDATED!)    Updates files              │   │
│    │  └──────────────┘                       Commits                    │   │
│    │                                                                     │   │
│    │  Context window created ─────────────────────► Context DESTROYED   │   │
│    └────────────────────────────────────────────────────────────────────┘   │
│                                         │                                    │
│                                         ▼                                    │
│    ┌────────────────────────────────────────────────────────────────────┐   │
│    │                     ITERATION 3                                     │   │
│    │                     ══════════                                      │   │
│    │  ┌──────────────┐                                                  │   │
│    │  │ Fresh Claude │ ──► Reads plan.md ──► Does ONE thing ──► EXIT    │   │
│    │  │  (no memory) │     (NOW UPDATED!)    Updates files              │   │
│    │  └──────────────┘                       Commits                    │   │
│    │                                                                     │   │
│    └────────────────────────────────────────────────────────────────────┘   │
│                                         │                                    │
│                                         ▼                                    │
│                                       ...                                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## What Claude Does In ONE Iteration

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SINGLE ITERATION FLOW                                │
│                                                                              │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  STEP 1: READ STATE                                                  │   │
│   │  ════════════════════                                                │   │
│   │                                                                      │   │
│   │  Claude reads:  plan.md ──────► "What tasks exist? What's pending?"  │   │
│   │                 activity.md ──► "What was done before?"              │   │
│   │                 AGENT.md ─────► "What gotchas should I know?"        │   │
│   │                                                                      │   │
│   │  Claude has NO memory of previous iterations.                        │   │
│   │  These files ARE the memory.                                         │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│                                    ▼                                         │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  STEP 2: PICK ONE THING                                              │   │
│   │  ══════════════════════                                              │   │
│   │                                                                      │   │
│   │  Find FIRST task with status: "pending"                              │   │
│   │                                                                      │   │
│   │  • Diagnostic phase? → Run all DIAG-* in parallel (read-only)       │   │
│   │  • Test phase? → Run ONE TEST-* task                                 │   │
│   │  • Fix phase? → Run ONE FIX-* task                                   │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│                                    ▼                                         │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  STEP 3: DO THE WORK                                                 │   │
│   │  ══════════════════                                                  │   │
│   │                                                                      │   │
│   │  • Navigate to page (Playwright)                                     │   │
│   │  • Take screenshot                                                   │   │
│   │  • Check console errors                                              │   │
│   │  • Interact if needed (click, type, etc.)                           │   │
│   │  • Verify expected behavior                                          │   │
│   │                                                                      │   │
│   │  If FAILED → Create a FIX-XX task                                    │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│                                    ▼                                         │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  STEP 4: UPDATE FILES                                                │   │
│   │  ═══════════════════                                                 │   │
│   │                                                                      │   │
│   │  plan.md ────────► Mark task completed/failed, add FIX if needed    │   │
│   │  activity.md ────► Log what was done                                 │   │
│   │  AGENT.md ───────► Add any new learnings/gotchas                     │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│                                    ▼                                         │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  STEP 5: COMMIT & EXIT                                               │   │
│   │  ═════════════════════                                               │   │
│   │                                                                      │   │
│   │  git add -A                                                          │   │
│   │  git commit -m "TASK-ID: description"                                │   │
│   │                                                                      │   │
│   │  Output summary, then ██████████ STOP ██████████                     │   │
│   │                                                                      │   │
│   │  DO NOT continue to next task.                                       │   │
│   │  The bash loop will start a fresh iteration.                         │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Why Fresh Context Each Iteration?

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│   PROBLEM: Context windows degrade with use                                  │
│   ════════════════════════════════════════                                   │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                                                                      │   │
│   │   Iteration 1:  [████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░]  │   │
│   │                  Fresh, clean, high quality                         │   │
│   │                                                                      │   │
│   │   After 5 tasks: [████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░]  │   │
│   │                   Accumulated garbage, quality drops                 │   │
│   │                                                                      │   │
│   │   After 10 tasks:[████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░]  │   │
│   │                   Context full, mistakes happen                      │   │
│   │                                                                      │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   SOLUTION: Fresh context each iteration                                     │
│   ══════════════════════════════════════                                     │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                                                                      │   │
│   │   Iteration 1:  [████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░]  │   │
│   │                  Fresh ──► Do ONE thing ──► EXIT (destroyed)        │   │
│   │                                                                      │   │
│   │   Iteration 2:  [████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░]  │   │
│   │                  Fresh ──► Do ONE thing ──► EXIT (destroyed)        │   │
│   │                                                                      │   │
│   │   Iteration 3:  [████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░]  │   │
│   │                  Fresh ──► Do ONE thing ──► EXIT (destroyed)        │   │
│   │                                                                      │   │
│   │   Every iteration gets MAXIMUM QUALITY context                       │   │
│   │                                                                      │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Subagent Strategy: Fan Out for Research, Single for Execution

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│   RESEARCH/EXPLORATION: Fan out up to 50 parallel subagents                 │
│   ══════════════════════════════════════════════════════════                 │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                                                                      │   │
│   │   Main Context                                                       │   │
│   │       │                                                              │   │
│   │       ├──► Subagent 1: "Search for OBS routes"                      │   │
│   │       ├──► Subagent 2: "Read server/lib/obsStateSync.js"            │   │
│   │       ├──► Subagent 3: "Check Firebase for competition config"      │   │
│   │       ├──► Subagent 4: "Take screenshot of homepage"                │   │
│   │       ├──► Subagent 5: "List AWS instances"                         │   │
│   │       ├──► Subagent 6: "Search for useOBS hook"                     │   │
│   │       ├──► ...                                                       │   │
│   │       └──► Subagent 50: "Read PRD for expected behavior"            │   │
│   │                                                                      │   │
│   │   All return summaries ──► Main context stays CLEAN                  │   │
│   │                                                                      │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   WHY: Subagents burn their own context, get garbage collected.             │
│         Main context only sees the summary. Stays fresh.                    │
│                                                                              │
│   SAFE FOR PARALLEL:                                                        │
│   • File reads (Read, Glob, Grep)                                           │
│   • Screenshots (browser_navigate, browser_take_screenshot)                 │
│   • API GET requests                                                        │
│   • Firebase reads (firebase_get, firebase_list_paths)                      │
│   • AWS list operations                                                     │
│   • SSH read-only commands                                                  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│   EXECUTION: Single subagent (or main context directly)                     │
│   ═════════════════════════════════════════════════════                      │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                                                                      │   │
│   │   Main Context                                                       │   │
│   │       │                                                              │   │
│   │       └──► ONE Subagent: "Build, test, deploy, verify"              │   │
│   │                │                                                     │   │
│   │                ├── npm run build                                     │   │
│   │                ├── tar + upload                                      │   │
│   │                ├── ssh deploy                                        │   │
│   │                ├── pm2 restart                                       │   │
│   │                └── verify with screenshot                            │   │
│   │                                                                      │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   WHY: Build/deploy/test operations have:                                   │
│   • File locks (node_modules, dist/)                                        │
│   • Port conflicts (dev servers, test runners)                              │
│   • Server state dependencies (PM2 must restart before verify)              │
│   • Race conditions if parallelized                                         │
│                                                                              │
│   MUST BE SEQUENTIAL:                                                       │
│   • npm run build                                                           │
│   • npm test                                                                │
│   • Deploy operations (SSH upload, extract, restart)                        │
│   • PM2 restart/reload                                                      │
│   • Any operation that modifies shared state                                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## State Lives In Files, Not In Claude's Head

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│                          THE FILES ARE THE MEMORY                            │
│                                                                              │
│   ┌───────────────────┐                                                     │
│   │     plan.md       │ ◄──── Source of truth for tasks                     │
│   │                   │       • What needs to be done                        │
│   │  - DIAG-01: ✓     │       • What's completed                            │
│   │  - DIAG-02: ✓     │       • What failed                                 │
│   │  - TEST-01: ✓     │       • What's pending                              │
│   │  - TEST-02: ⏳    │                                                     │
│   │  - FIX-01: ⏳     │                                                     │
│   └───────────────────┘                                                     │
│                                                                              │
│   ┌───────────────────┐                                                     │
│   │   activity.md     │ ◄──── History log                                   │
│   │                   │       • What was done each iteration                 │
│   │  Iteration 1:     │       • Results and findings                        │
│   │    DIAG-* done    │       • Evidence trail                              │
│   │  Iteration 2:     │                                                     │
│   │    TEST-01 pass   │                                                     │
│   └───────────────────┘                                                     │
│                                                                              │
│   ┌───────────────────┐                                                     │
│   │    AGENT.md       │ ◄──── Learned knowledge                             │
│   │                   │       • Deployment steps                             │
│   │  - Port is 3003   │       • Gotchas discovered                          │
│   │  - Use coordinator│       • Useful commands                             │
│   │  - OBS on VM not  │                                                     │
│   │    coordinator    │                                                     │
│   └───────────────────┘                                                     │
│                                                                              │
│   ┌───────────────────┐                                                     │
│   │   screenshots/    │ ◄──── Visual evidence                               │
│   │                   │       • Proof of pass/fail                           │
│   │  - DIAG-05.png    │       • What the page looked like                   │
│   │  - TEST-01.png    │       • Console errors captured                     │
│   │  - TEST-02.png    │                                                     │
│   └───────────────────┘                                                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## File Structure

```
ralph-obs/
├── ralph.sh          # The loop script - run this
├── PROMPT.md         # Instructions Claude reads each iteration
├── plan.md           # Task list with statuses (the source of truth)
├── activity.md       # Log of completed work
├── AGENT.md          # Deployment knowledge & gotchas
├── PRD.md            # What we're testing (requirements)
└── screenshots/      # Playwright captures for verification
    ├── DIAG-01.png
    ├── TEST-01.png
    └── ...
```

---

## Task Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              TASK LIFECYCLE                                  │
│                                                                              │
│                                                                              │
│    ┌──────────┐      ┌──────────┐      ┌──────────┐      ┌──────────┐      │
│    │ PENDING  │ ───► │ RUNNING  │ ───► │  PASS    │ ───► │ COMPLETED│      │
│    └──────────┘      └──────────┘      └──────────┘      └──────────┘      │
│                            │                                                 │
│                            │                                                 │
│                            ▼                                                 │
│                      ┌──────────┐      ┌──────────┐                         │
│                      │  FAIL    │ ───► │ FIX-XX   │ ◄── New task created    │
│                      └──────────┘      │ (pending)│                         │
│                                        └──────────┘                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase Progression

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                              │
│  PHASE 1: DIAGNOSTIC                    PHASE 2: TEST                        │
│  ═══════════════════                    ══════════════                        │
│                                                                              │
│  ┌─────────────────────┐               ┌─────────────────────┐              │
│  │ DIAG-01 ─────────┐  │               │ PREREQ-01           │              │
│  │ DIAG-02 ─────────┤  │               │      │              │              │
│  │ DIAG-03 ─────────┤  │  ──────►      │      ▼              │              │
│  │ DIAG-04 ─────────┤  │  (when all    │ PREREQ-02           │              │
│  │ DIAG-05 ─────────┘  │   complete)   │      │              │              │
│  │                     │               │      ▼              │              │
│  │  Run in PARALLEL    │               │ TEST-01             │              │
│  │  (up to 20 at once) │               │      │              │              │
│  └─────────────────────┘               │      ▼              │              │
│                                        │ TEST-02             │              │
│                                        │      │              │              │
│                                        │     ...             │              │
│                                        │                     │              │
│                                        │  Run SEQUENTIALLY   │              │
│                                        │  (one per iteration)│              │
│                                        └─────────────────────┘              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Verification Flow (Every Test)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           VERIFICATION STEPS                                 │
│                                                                              │
│                                                                              │
│   1. NAVIGATE                                                                │
│      ┌─────────────────────────────────────────────┐                        │
│      │  browser_navigate(url)                      │                        │
│      │  → https://commentarygraphic.com/{compId}/obs-manager                │
│      └─────────────────────────────────────────────┘                        │
│                            │                                                 │
│                            ▼                                                 │
│   2. CAPTURE                                                                 │
│      ┌─────────────────────────────────────────────┐                        │
│      │  browser_take_screenshot(filename)          │                        │
│      │  → screenshots/TEST-XX.png                  │                        │
│      └─────────────────────────────────────────────┘                        │
│                            │                                                 │
│                            ▼                                                 │
│   3. CHECK ERRORS                                                            │
│      ┌─────────────────────────────────────────────┐                        │
│      │  browser_console_messages(level='error')    │                        │
│      │  → Any JS errors? API failures?             │                        │
│      └─────────────────────────────────────────────┘                        │
│                            │                                                 │
│                            ▼                                                 │
│   4. INTERACT (if needed)                                                    │
│      ┌─────────────────────────────────────────────┐                        │
│      │  browser_snapshot() → get element refs      │                        │
│      │  browser_click(element, ref)                │                        │
│      │  browser_type(element, ref, text)           │                        │
│      │  browser_drag(startRef, endRef)             │                        │
│      └─────────────────────────────────────────────┘                        │
│                            │                                                 │
│                            ▼                                                 │
│   5. VERIFY STATE                                                            │
│      ┌─────────────────────────────────────────────┐                        │
│      │  Did the expected change happen?            │                        │
│      │  • UI updated?                              │                        │
│      │  • Firebase state changed?                  │                        │
│      │  • No new errors?                           │                        │
│      └─────────────────────────────────────────────┘                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Test Competition Setup

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         OBS TESTING REQUIRES                                 │
│                                                                              │
│                                                                              │
│   ┌──────────────┐      ┌──────────────┐      ┌──────────────┐             │
│   │  COMPETITION │ ───► │   RUNNING    │ ───► │     OBS      │             │
│   │   with VM    │      │     VM       │      │  CONNECTED   │             │
│   │   assigned   │      │              │      │              │             │
│   └──────────────┘      └──────────────┘      └──────────────┘             │
│                                                                              │
│   Currently configured:                                                      │
│   ┌─────────────────────────────────────────────────────────────┐           │
│   │  compId: 8kyf0rnl                                           │           │
│   │  vmIp:   3.89.92.162                                        │           │
│   │  name:   Simpson vs UW-Whitewater                           │           │
│   └─────────────────────────────────────────────────────────────┘           │
│                                                                              │
│   Test URL: https://commentarygraphic.com/8kyf0rnl/obs-manager              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## What Gets Tested

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            OBS MANAGER TABS                                  │
│                                                                              │
│  ┌─────────┬─────────┬─────────┬─────────┬───────────┬─────────────┐        │
│  │ SCENES  │  AUDIO  │ STREAM  │ ASSETS  │ TEMPLATES │ TALENT COMMS│        │
│  └────┬────┴────┬────┴────┬────┴────┬────┴─────┬─────┴──────┬──────┘        │
│       │         │         │         │          │            │               │
│       ▼         ▼         ▼         ▼          ▼            ▼               │
│  ┌─────────┐┌─────────┐┌─────────┐┌─────────┐┌─────────┐┌─────────┐         │
│  │ • List  ││ • Mixer ││ • RTMP  ││ • Music ││ • List  ││ • VDO   │         │
│  │ • Switch││ • Volume││ • Key   ││ • Stinger││ • Create││   Ninja │         │
│  │ • Create││ • Mute  ││ • Start ││ • BG    ││ • Apply ││ • Discord│         │
│  │ • Delete││ • Preset││ • Stop  ││ • Logos ││ • Delete││ • URLs  │         │
│  └─────────┘└─────────┘└─────────┘└─────────┘└─────────┘└─────────┘         │
│                                                                              │
│  Tests: TEST-01 to TEST-13 cover all these features                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Running Ralph

```bash
# From the ralph-obs directory:
cd ralph-obs

# Run up to 30 iterations
./ralph.sh 30

# What you'll see:
# ════════════════════════════════════════
# Iteration 1 of 30
# Phase: test
# Started: 2026-01-17 14:32:15
# ════════════════════════════════════════
#
# [TEST MODE] Claude will run tests sequentially
#
# [14:32:16] Tool: browser:browser_navigate
# [14:32:18] Tool: browser:browser_take_screenshot
# [14:32:19] Tool: browser:browser_console_messages
# ...
#
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# RESULT:
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# TEST-01 PASSED: OBS Manager page loads...
```

---

## When Things Fail

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FAILURE HANDLING                                   │
│                                                                              │
│                                                                              │
│   TEST-03 fails: "Scene switching doesn't work"                             │
│                                                                              │
│                            │                                                 │
│                            ▼                                                 │
│   ┌─────────────────────────────────────────────────────────────┐           │
│   │  1. Screenshot saved: screenshots/TEST-03.png               │           │
│   │  2. Console errors logged                                   │           │
│   │  3. plan.md updated:                                        │           │
│   │     - TEST-03: status = "failed"                            │           │
│   │     - TEST-03: failureReason = "WebSocket error..."         │           │
│   │  4. NEW TASK created:                                       │           │
│   │     - FIX-01: "Fix scene switching WebSocket"               │           │
│   │  5. activity.md logged                                      │           │
│   │  6. Git commit                                              │           │
│   └─────────────────────────────────────────────────────────────┘           │
│                                                                              │
│                            │                                                 │
│                            ▼                                                 │
│                                                                              │
│   Next iteration picks up FIX-01:                                           │
│   ┌─────────────────────────────────────────────────────────────┐           │
│   │  • Investigate root cause                                   │           │
│   │  • Implement fix                                            │           │
│   │  • Build & deploy                                           │           │
│   │  • Verify fix works                                         │           │
│   │  • Mark FIX-01 completed                                    │           │
│   └─────────────────────────────────────────────────────────────┘           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Completion Detection - How The Loop Knows When To Stop

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        COMPLETION SIGNAL FLOW                                │
│                                                                              │
│   The loop uses a unique signal: <RALPH_COMPLETE>ALL_DONE</RALPH_COMPLETE>   │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                                                                      │   │
│   │   WRONG WAY (causes premature exit):                                │   │
│   │   ══════════════════════════════════                                 │   │
│   │                                                                      │   │
│   │   Claude output (stream-json) includes EVERYTHING:                   │   │
│   │   ┌────────────────────────────────────────────────────────────┐    │   │
│   │   │ {"type":"system","content":"...RALPH_COMPLETE..."}  ◄── PROMPT │    │   │
│   │   │ {"type":"assistant","content":"Working on task..."}         │    │   │
│   │   │ {"type":"result","result":"Done with iteration"}            │    │   │
│   │   └────────────────────────────────────────────────────────────┘    │   │
│   │                                                                      │   │
│   │   If we grep the raw output → finds signal in PROMPT → exits early! │   │
│   │                                                                      │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │                                                                      │   │
│   │   RIGHT WAY (what we do):                                           │   │
│   │   ═══════════════════════                                           │   │
│   │                                                                      │   │
│   │   1. Parse JSON stream                                              │   │
│   │   2. Extract ONLY "assistant" and "result" text                     │   │
│   │   3. Check for signal in Claude's ACTUAL output only                │   │
│   │                                                                      │   │
│   │   ┌────────────────────────────────────────────────────────────┐    │   │
│   │   │ Raw JSON stream ──► Filter ──► Claude's text only          │    │   │
│   │   │                         │                                   │    │   │
│   │   │                         ▼                                   │    │   │
│   │   │              ┌─────────────────────┐                       │    │   │
│   │   │              │ "Working on task..."│  ◄── No signal here   │    │   │
│   │   │              │ "Done, 5 pending"   │      = keep looping   │    │   │
│   │   │              └─────────────────────┘                       │    │   │
│   │   │                                                             │    │   │
│   │   │              ┌─────────────────────┐                       │    │   │
│   │   │              │ "All tasks done!"   │                       │    │   │
│   │   │              │ <RALPH_COMPLETE>    │  ◄── Signal here      │    │   │
│   │   │              │ ALL_DONE            │      = exit loop!     │    │   │
│   │   │              │ </RALPH_COMPLETE>   │                       │    │   │
│   │   │              └─────────────────────┘                       │    │   │
│   │   └────────────────────────────────────────────────────────────┘    │   │
│   │                                                                      │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   Claude ONLY outputs the signal when ALL conditions are met:               │
│   • All diagnostic tasks: completed                                         │
│   • All test tasks: completed, failed, or skipped                          │
│   • All fix tasks: completed or skipped                                    │
│   • Zero tasks with status: pending                                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Quick Reference

| Command | What it does |
|---------|--------------|
| `./ralph.sh 1` | Run 1 iteration (test single task) |
| `./ralph.sh 30` | Run up to 30 iterations |
| `cat plan.md` | See task statuses |
| `cat activity.md` | See what was done |
| `ls screenshots/` | See captured evidence |

| File | Purpose |
|------|---------|
| `plan.md` | **Source of truth** - task list & statuses |
| `activity.md` | History log |
| `AGENT.md` | Deployment knowledge |
| `PROMPT.md` | Claude's instructions |
| `PRD.md` | Test requirements |
