# PRD: {Feature Name}

**Status:** NOT STARTED
**Date:** {YYYY-MM-DD}
**Last Updated:** {YYYY-MM-DD}

---

## Overview
{1-2 sentences describing the problem this feature solves and the approach.}

## Test Competition / URL

| Field | Value |
|-------|-------|
| Competition ID | `{comp-id}` |
| Producer URL | `https://commentarygraphic.com/{comp-id}/producer` |
| Output URL | `https://commentarygraphic.com/output.html?comp={comp-id}` |
| Format | {e.g., Women's 4-Team} |

## User Stories
- As a **{role}**, I want **{action}** so that **{benefit}**.
- As a **{role}**, I want **{action}** so that **{benefit}**.

## Acceptance Criteria
- [ ] {Criterion 1 — specific and testable}
- [ ] {Criterion 2}
- [ ] {Criterion 3}

---

## Bug Catalog

{Delete this section if this is a new feature, not a bug audit.}
{If bug audit: list bugs found during discovery. If new feature: bugs discovered during implementation go here.}

### Critical (Breaks Core Functionality)

#### BUG-001: {Title}
- **File:** `{path/to/file.js}` (line {N})
- **Description:** {What's wrong}
- **Impact:** {Effect on users}
- **Status:** NOT STARTED

### Major (Incorrect Behavior)

#### BUG-002: {Title}
- **File:** `{path/to/file.js}` (line {N})
- **Description:** {What's wrong}
- **Impact:** {Effect on users}
- **Status:** NOT STARTED

### Minor (Polish)

#### BUG-003: {Title}
- **File:** `{path/to/file.js}` (line {N})
- **Description:** {What's wrong}
- **Status:** NOT STARTED

---

## Playwright Audit Results
{Delete this section if not a bug audit. Fill in after discovery run.}

```
═══════════════════════════════════════
  {FEATURE NAME} AUDIT
  Competition: {comp-id}
═══════════════════════════════════════

{test results go here}

TOTAL: [X] PASS / [Y] FAIL
BUGS: [Z] total ([a] critical, [b] major, [c] minor)
═══════════════════════════════════════
```
