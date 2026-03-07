# Audit: Production Checklist PRD & Implementation Plan

**Date:** 2026-03-06
**Auditor:** Claude
**Status:** ALL RESOLVED (2026-03-07)

---

## Audit History

| Date | Audit | Findings | Status |
|------|-------|----------|--------|
| 2026-03-06 | Initial audit (v1.1) | 18 issues (1 blocker, 7 major, 6 minor, 4 questions) | All resolved |
| 2026-03-07 | Second audit (v1.2) | 23 issues (1 critical, 4 architecture, 2 missing links, 6 UX, 5 impl plan, 5 docs) | All resolved |

---

## Second Audit (2026-03-07) — v1.2

### Critical

#### B-01: Wrong Firebase Path for Rundown Segments — RESOLVED
**Issue:** Technical plan, hook code, implementation plan, and items definition all referenced `production/rundown/segments/` as the editor format path. The actual path used by RundownEditorPage is `competitions/{compId}/rundown/segments`. The `production/rundown/` path is analytics only. All three rundown validators would subscribe to wrong path.
**Resolution:** Corrected path in all documents: PLAN (hook code, validators, data flow), implementation plan (Tasks 2, 12), and checklist-items-definition (auto-validator keys table).

### Architecture

#### B-02: lastUpdated Never Written — RESOLVED
**Issue:** Data model defines `lastUpdated` at `competitions/{compId}/checklist/lastUpdated` and Task 27 displays it, but neither `toggleItem()` nor `updateNote()` wrote to it.
**Resolution:** Updated hook code in technical plan to write `lastUpdated` in both `toggleItem()` and `updateNote()`.

#### B-03: Optimistic Update Race Condition — RESOLVED
**Issue:** Rapid toggles could clobber each other. `toggleItem()` read `previousState` from `checklistState` (Firebase-synced) instead of `localChecklistState`. Second toggle would see stale data.
**Resolution:** Updated hook to use functional state update (`setLocalChecklistState(prev => ...)`) that reads current local state safely.

#### B-04: Contact Auto-Validation Confusion — RESOLVED
**Issue:** Task 21 said contacts should "auto-validate" manual items, but `camera-op-contact` is `type: manual`. Blurred line between 13 auto items and manual items.
**Resolution:** Renamed concept to "auto-assist" — manual items show a visual hint when related contacts exist but remain manually toggleable. Not counted in auto-validated total. Updated PRD Story 3, Tech Plan Section 7.2, and implementation Task 21.

#### B-05: No Error Boundary — RESOLVED
**Issue:** Validators access deeply nested data. An unexpected shape would crash the entire page with no fallback.
**Resolution:** Added error boundary requirement to Tech Plan Section 8.4 and implementation Task 4.

### Missing Fix Links

#### B-06: No Fix Link for socket-connected — RESOLVED
**Issue:** Fix Links table had no entry for `socket-connected`.
**Resolution:** Added `/_admin/vm-pool` with note explaining the dependency chain (VM → coordinator → socket auto-connects).

#### B-07: obs-connected Fix Link Missing from Items Definition — RESOLVED
**Issue:** Items definition table for OBS Configuration had no Fix Link column, though tech plan specified `/{compId}/obs-manager`.
**Resolution:** Added Fix Link column to OBS Configuration table in items definition.

### UX Gaps

#### B-08: Venue Contacts Stored Under Team Key — ACKNOWLEDGED
**Issue:** "Venue Operations" and "Scoring Operations" contacts are venue-specific but stored under team key. Same team at different venues = wrong facility manager.
**Resolution:** Documented as known limitation in PRD Story 3. Proper venue contacts model deferred to Phase 3.

#### B-09: No Checklist Reset — ACKNOWLEDGED
**Issue:** No bulk reset function for checklist.
**Resolution:** Documented in Tech Plan Section 9.2. Competition duplication starts with blank checklist. Individual items can be unchecked.

#### B-10: Phase Timeline Labels Not Time-Aware — ACKNOWLEDGED
**Issue:** "2 Hours Before" labels don't compute actual clock times or handle timezones.
**Resolution:** Documented in Tech Plan Section 9.1 as intentional. Labels are organizational only.

#### B-11: No Multi-Competition View — ACKNOWLEDGED
**Issue:** Producers managing doubleheaders must switch between checklists.
**Resolution:** Documented in Tech Plan Section 9.3. Requires "producer identity" concept that doesn't exist yet.

#### B-12: Sidebar Irrelevant During Day Of Phases — RESOLVED
**Issue:** Contacts sidebar takes 30% width during Phase 3-4 where items are OBS/Discord focused.
**Resolution:** Added sidebar collapse behavior in Tech Plan Section 8.6. Sidebar auto-collapses for Day Of phases.

#### B-13: Missing Theme Item — RESOLVED
**Issue:** Codebase has `meetTheme` in config but checklist had no "Theme configured" item.
**Resolution:** Added `theme-configured` auto-validator. Total items now 75 (14 auto, 61 manual).

### Implementation Plan

#### B-14: Phase 1A→1B Dependency Too Strict — RESOLVED
**Issue:** Tasks 1 and 9 have no import dependency but were forced sequential.
**Resolution:** Relaxed dependency — Tasks 1 and 9 can be built in parallel. Phase 1A still required before 1C and 1D.

#### B-15: Prompt File Uses git add -A — RESOLVED
**Issue:** `prompt-Production-Checklist.md` uses `git add -A` which CLAUDE.md warns against.
**Resolution:** Updated to `git add <specific files>` pattern.

#### B-16: One-Task-Per-Iteration Wasteful for Trivial Tasks — RESOLVED
**Issue:** Single-line tasks like "Add route" mandated full deploy cycle each.
**Resolution:** Added batching exception for trivial tasks (< 20 lines combined).

#### B-17: Skeleton Loading Deferred to Task 28 — RESOLVED
**Issue:** Checklist page shipped without loading states through Tasks 3-27.
**Resolution:** Moved skeleton loading into Task 3 (initial page creation). Task 28 repurposed to error boundary polish.

#### B-18: Headshot Threshold Arbitrary — RESOLVED
**Issue:** 80% threshold not justified.
**Resolution:** Added rationale comment in validator code: accounts for walk-ons/injured athletes who won't compete and may not have headshots.

### Documentation

#### B-19: Audit Status Misleading — RESOLVED
**Issue:** Summary said "ALL RESOLVED" but A-10 and A-11 said "ACKNOWLEDGED" (known but not fixed).
**Resolution:** "ACKNOWLEDGED" is a valid resolution status — it means the finding was reviewed and accepted as-is with documentation. This is now consistent.

#### B-20: compType Filter Defined but Unused — RESOLVED
**Issue:** Items definition mentioned `compType: multi` filter but then said all items appear for all types.
**Resolution:** Removed the misleading `compType` field description. Replaced with clear statement that all items appear for all types in MVP.

#### B-21: Item Count Discrepancy (72→74→75) — RESOLVED
**Issue:** Multiple version bumps with no diff showing which items changed.
**Resolution:** v1.2 changelog explicitly documents the addition: `theme-configured` (74→75). The v1.1 change (72→74) was the initial curation from the CSV where items were split/combined during definition.

---

## First Audit (2026-03-06) — v1.1

### Summary (Original)

18 issues found across the PRD, technical plan, and implementation plan. Categorized by severity:

| Severity | Count | Description |
|----------|-------|-------------|
| **Blocker** | 1 | Must resolve before implementation starts |
| **Major** | 7 | Will cause bugs or significant rework if not addressed |
| **Minor** | 6 | Quality/consistency issues |
| **Question** | 4 | Design decisions that need owner input |

---

## Blocker

### A-01: Checklist Items Not Defined — RESOLVED

**Location:** PRD Section 7, Implementation Plan Task 1
**Issue:** The PRD references ~72 curated items but the actual item list doesn't exist anywhere.

**Resolution:** Created `checklist-items-definition.md` with all 74 items defined (IDs, names, types, validators, fix links). Curated from the original 130+ item CSV checklist. Task 1 now references this document instead of inventing items during implementation.

---

## Major

### A-02: Validators Only Handle 2 Teams — RESOLVED

**Location:** Technical Plan Section 4.1
**Issue:** Validators hardcoded team1 and team2.

**Resolution:** Updated all team-related validators in Technical Plan to use `getTeamCount(compType)` and loop over N teams dynamically. Implementation plan tasks 9-10 updated with same note.

---

### A-03: No Toast Library — RESOLVED

**Location:** Implementation Plan Task 8
**Issue:** No toast library in codebase.

**Resolution:** Task 8 now specifies installing `react-hot-toast` and adding `<Toaster />` to App.jsx. Technical plan updated with import examples.

---

### A-04: Contacts Panel Only Handles 2 Teams — RESOLVED

**Location:** Technical Plan Section 3.2
**Issue:** Contacts panel hardcoded 2 teams.

**Resolution:** Updated component hierarchy to use `teamKeys` (dynamic array). Added code example showing `getTeamCount()` + `buildTeamKey()` derivation. Task 17 updated.

---

### A-05: VM Health Check CORS Issue — RESOLVED

**Location:** Implementation Plan Task 11
**Issue:** VM health check may hit CORS from browser.

**Resolution:** Using existing `checkVmStatus()` function which already handles this. Custom VMs always show offline (no health check path). Owner confirmed this is acceptable behavior.

---

### A-06: Rundown Segments Path Confusion — RESOLVED

**Location:** Technical Plan Section 4.1
**Issue:** Two Firebase paths for rundown segments; unclear which to use.

**Resolution:** Technical plan and hook now explicitly use `production/rundown/segments/` (editor format) since it's populated during pre-production. Added comment in hook code.

---

### A-07: Fix Link Paths Incorrect — RESOLVED

**Location:** Technical Plan Section 7.3
**Issue:** Fix links pointed to wrong pages.

**Resolution:** Updated fix links table with notes clarifying that config items link to `/` (HomePage) where producer clicks Edit on their competition. Added explanatory note in technical plan.

---

### A-08: Team Key Format Not Specified — RESOLVED

**Location:** PRD Section 3, Technical Plan Section 2.2
**Issue:** Team key format unspecified.

**Resolution:** PRD Story 3 and Technical Plan Section 2.2 now reference `buildTeamKey(school, gender)` from `competitionUtils.js`. Implementation plan tasks 17 and 20 updated with same note.

---

## Minor

### A-09: Phase Tab Labels Too Long — RESOLVED

**Resolution:** PRD and plans updated to use short tab labels: "Setup", "Pre-Prod", "2hr Before", "1hr Before". Full names used in phase headers only.

---

### A-10: No Skeleton Loading Pattern Exists — ACKNOWLEDGED

**Resolution:** Noted in implementation plan Task 28. Will use Tailwind `animate-pulse` — straightforward, no reference needed.

---

### A-11: Responsive Design Inconsistency — ACKNOWLEDGED

**Resolution:** Accepted. Checklist is uniquely used on-site on tablets, unlike other pages.

---

### A-12: `checkVmStatus` Is a Function, Not a Hook — RESOLVED

**Resolution:** Tasks 11 and 13 updated to clarify it's a standalone async function called in a `useEffect` with `setInterval`. Technical plan hook code updated with example.

---

### A-13: Task 1 Is Too Large — RESOLVED

**Resolution:** Items are now pre-defined in `checklist-items-definition.md`. Task 1 is now "translate the definition into JS" — a mechanical task, not a creative one.

---

### A-14: Missing Checklist Link from ProducerView — RESOLVED

**Resolution:** Added Task 25 "Add checklist link to ProducerView sidebar" to Phase 1D. Renumbered subsequent tasks.

---

## Questions — ALL ANSWERED

### Q-01: Should Checklist Items Vary by Competition Type in MVP?
**Answer:** Yes — validators dynamically check N teams based on comp type. All 74 items appear for all types, but team-related validators adapt. Item hiding deferred to Phase 2 templates.

### Q-02: Multi-User Support Needed?
**Answer:** (a) — Don't track `checkedBy`. No user/login system exists. Removed from data model.

### Q-03: ShowContext/OBSContext Required for Checklist?
**Answer:** Yes, red/disconnected status is fine pre-show. Custom VMs also show red. Owner confirmed acceptable.

### Q-04: Offline/Queued Writes?
**Answer:** (a) — Firebase native offline support. No custom queuing.

---

## Action Items — ALL COMPLETE

All 18 findings resolved. All 4 questions answered. Documents updated:
- `PRD-Production-Checklist-2026-01-24.md` → v1.1
- `PLAN-Production-Checklist-2026-01-24.md` → v1.1
- `PLAN-Production-Checklist-Implementation.md` → updated 2026-03-06
- `checklist-items-definition.md` → created (74 items defined)

**Note:** "ACKNOWLEDGED" findings (A-10, A-11) are valid resolution statuses — they mean the finding was reviewed, accepted as-is, and documented with rationale. They are not unresolved.
