# {Feature Name} — Implementation Plan

**PRD:** PRD-{FeatureName}-{date}
**Date:** {YYYY-MM-DD}
**Last Updated:** {YYYY-MM-DD}

---

## Phases Overview

| Phase | Description | Tasks | Status |
|-------|-------------|-------|--------|
| Phase 1 | {e.g., Critical Fixes} | {N} | NOT STARTED |
| Phase 1-Deploy | Deploy Phase 1 changes | 2 | NOT STARTED |
| Phase 2 | {e.g., Major Fixes} | {N} | NOT STARTED |
| Phase 2-Deploy | Deploy Phase 2 changes | 2 | NOT STARTED |
| Phase 3 | {e.g., Polish} | {N} | NOT STARTED |
| Final-Deploy | Final deploy + full verification | 2 | NOT STARTED |

---

## Phase 1: {Phase Name — e.g., Critical Fixes}

> **Deploy rule:** Commit each task. Do NOT deploy until Phase 1-Deploy.

### Task 1.1: {Task Name} — NOT STARTED

**File:** `{path/to/file.js}` (line {N})

**Change:**
```javascript
// Before:
{old code}

// After:
{new code}
```

**Fixes / Implements:** {BUG-001 or feature requirement}

---

### Task 1.2: {Task Name} — NOT STARTED

**File:** `{path/to/file.js}` (line {N})

**Change:** {Describe the exact change. Include a before/after if helpful.}

**Fixes / Implements:** {BUG-XXX or feature requirement}

---

## Phase 1-Deploy: Deploy Phase 1 Changes

> **This is a deploy task.** Build, upload, and verify all Phase 1 changes together.

### Task 1-D.1: Build and deploy to production — NOT STARTED

**Frontend changed?**
```bash
cd show-controller && npm run build
# then upload per CLAUDE.md Step 1
```

**Graphics files changed? (output.html, overlays/)**
```bash
# upload per CLAUDE.md Step 2
```

**Firebase only?** → No deploy needed, mark skipped.

### Task 1-D.2: Verify Phase 1 on production — NOT STARTED

Navigate to test URL with Playwright. Take screenshots to `docs/PRD-{FeatureName}/screenshots/`.

**Checks:**
- [ ] {Specific thing to verify from Task 1.1}
- [ ] {Specific thing to verify from Task 1.2}
- [ ] No console errors

---

## Phase 2: {Phase Name — e.g., Major Fixes}

> **Deploy rule:** Commit each task. Do NOT deploy until Phase 2-Deploy.

### Task 2.1: {Task Name} — NOT STARTED

**File:** `{path/to/file.js}` (line {N})

**Change:** {description}

**Fixes / Implements:** {BUG-XXX}

---

## Phase 2-Deploy: Deploy Phase 2 Changes

### Task 2-D.1: Build and deploy to production — NOT STARTED

{Same pattern as Task 1-D.1}

### Task 2-D.2: Verify Phase 2 on production — NOT STARTED

**Checks:**
- [ ] {Specific thing to verify from Phase 2 tasks}
- [ ] No console errors

---

## Final-Deploy: Full Verification

### Task F.1: Full acceptance criteria check — NOT STARTED

Run through every acceptance criterion in the PRD using Playwright.
Screenshots: `docs/PRD-{FeatureName}/screenshots/final-verify-*.png`

**Checklist:**
- [ ] {PRD acceptance criterion 1}
- [ ] {PRD acceptance criterion 2}
- [ ] {PRD acceptance criterion 3}

### Task F.2: Mark PRD complete — NOT STARTED

Update `PRD-{FeatureName}-{date}.md` status to COMPLETE. Commit.

---

## Estimated Scope

| Phase | Tasks | Complexity | Status |
|-------|-------|------------|--------|
| Phase 1 | {N} | {Low/Med/High} | NOT STARTED |
| Phase 1-Deploy | 2 | Low | NOT STARTED |
| Phase 2 | {N} | {Low/Med/High} | NOT STARTED |
| Phase 2-Deploy | 2 | Low | NOT STARTED |
| Final-Deploy | 2 | Low | NOT STARTED |
| **Total** | **{N}** | | |
