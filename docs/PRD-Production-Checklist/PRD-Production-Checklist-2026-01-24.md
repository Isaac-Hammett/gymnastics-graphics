# PRD: Production Checklist System

**Version:** 1.0
**Date:** 2026-01-24
**Status:** Planning

---

## 1. Problem Statement

Producers managing gymnastics broadcasts must track dozens of tasks across multiple days and systems:

1. **No centralized checklist** - Tasks scattered across spreadsheets, emails, and memory
2. **Repeated manual work** - Same setup steps for recurring teams/venues
3. **No validation** - Producers can't verify system readiness before going live
4. **Lost institutional knowledge** - Contact info, site evaluations, lessons learned not captured

Currently, producers use a 130+ item Google Sheets checklist that requires manual checking. There's no integration with the system to auto-validate technical items (VM online, OBS connected, rosters loaded) or to persist team/venue data across competitions.

---

## 2. Goals

| Goal | Description |
|------|-------------|
| **Centralized Checklist** | Single page showing all pre-flight items with progress tracking |
| **Auto-Validation** | System automatically checks technical requirements (VM, OBS, Firebase data) |
| **Team Data Persistence** | Contacts, preferences carry over when working with same team again |
| **Venue Knowledge Base** | Site evaluations, camera positions, known issues stored per venue |
| **Template System** | Different checklists for dual meets vs championships |

---

## 3. User Stories

### Story 1: Producer Reviews Pre-Flight Checklist

**As a** Producer preparing for a WCU vs William & Mary dual meet
**I want to** see a comprehensive checklist of all required tasks
**So that** I don't miss any critical setup steps

**Flow:**
1. Navigate to `/{compId}/checklist`
2. See overall progress: "45/72 items complete (62%)"
3. View items grouped by phase: Setup → Pre-Production → Day Of
4. See auto-validated items (green checkmarks) for system-verifiable items
5. Manually check off completed tasks (communications, deliverables)
6. Add notes to specific items (e.g., camera op phone number)

**Acceptance Criteria:**
- [ ] Checklist page accessible at `/{compId}/checklist`
- [ ] Progress bar shows overall completion percentage
- [ ] Phase tabs allow filtering by timeline
- [ ] Auto-validated items update in real-time
- [ ] Manual items persist to Firebase when checked
- [ ] Notes field available for each item

---

### Story 2: Producer Sees Auto-Validated Technical Items

**As a** Producer checking system readiness
**I want** technical items to auto-validate based on system state
**So that** I don't have to manually verify things the system can check

**Auto-validated items:**
- Event name configured → Check `competitionConfig.eventName`
- Teams configured with logos → Check `config.team1Name` and `config.team1Logo`
- Rosters loaded → Check `teamData.team1.roster.length > 0`
- Headshots uploaded (>80%) → Count roster members with `headshotUrl`
- VM assigned → Check `config.vmAddress` exists
- VM online → Ping VM status endpoint
- Socket connected → Check `ShowContext.connected`
- OBS connected → Check `OBSContext.obsConnected`
- Rundown created → Check `rundown/segments` has items
- Graphics assigned → Calculate percentage with `graphic.graphicId`

**Acceptance Criteria:**
- [ ] Technical items show auto-validation status
- [ ] Green checkmark when condition met
- [ ] Red X when condition not met
- [ ] "Fix" link navigates to relevant configuration page
- [ ] Status updates in real-time without page refresh

---

### Story 3: Producer Manages Team Contacts

**As a** Producer setting up communications
**I want to** store contact info for each team's key personnel
**So that** I don't have to re-collect this info for every competition

**Flow:**
1. On checklist page, see "Contacts" panel for competition teams
2. View existing contacts: Head Coach, Assistant Coach, SID, Camera Op
3. Add new contact with name, role, phone, email
4. Contact auto-populates "Camera op contact received" checklist item
5. Next competition with same team shows saved contacts

**Contact Roles:**
- Head Coach
- Assistant Coach
- Sports Information Director (SID)
- Camera Operator (Primary)
- Camera Operator (Backup)
- Venue Operations (facility manager, A/V tech)
- Scoring Operations (meet director, scoring table contact)

**Acceptance Criteria:**
- [ ] Contacts panel shows on checklist page
- [ ] Contacts stored at `teamsDatabase/contacts/{team-key}`
- [ ] Contacts persist across competitions for same team
- [ ] Click-to-call and click-to-email links work
- [ ] Contact existence auto-validates related checklist items

---

### Story 4: Producer Tracks Progress Across Multiple Days

**As a** Producer managing setup over several days
**I want** my checklist progress to persist
**So that** I can pick up where I left off

**Timeline Phases:**
1. **Setup (5+ Days Out)** - Session creation, team config, initial communications
2. **Pre-Production (2-4 Days Out)** - Graphics, talent, camera ops, rundown
3. **Day Of (2 Hours Before)** - VM, OBS, camera connections
4. **Day Of (1 Hour Before)** - Discord, talent dry run, final checks

**Flow:**
1. Day 1: Complete Setup phase items, check them off
2. Day 2: Return to checklist, Setup items still checked
3. Day 3: Work on Pre-Production items
4. Day of show: Focus on Day-Of items, all previous work preserved

**Acceptance Criteria:**
- [ ] Checklist state persists to Firebase
- [ ] Phase tabs show completion status (✓, ◐, ○)
- [ ] Timestamps stored for when items were checked
- [ ] "Last updated" shown on page

---

### Story 5: Producer Reviews Site Evaluation (Future Phase)

**As a** Producer preparing for a competition at a known venue
**I want to** review the site evaluation and camera positions
**So that** I can plan camera setup efficiently

**Flow:**
1. Navigate to `/{compId}/checklist` or dedicated site eval page
2. See venue info: name, address, capacity
3. View camera position photos and notes
4. Review known issues (e.g., "subwoofer causes camera shake")
5. See recommended internet settings

**Acceptance Criteria (Phase 3):**
- [ ] Site evaluations stored at `teamsDatabase/venues/{venue-key}`
- [ ] Camera positions with photos, apparatus assignment, notes
- [ ] 360° venue photos accessible
- [ ] Known issues documented
- [ ] Internet speed and network info stored

---

### Story 6: Producer Uses Competition-Type Template (Future Phase)

**As a** Producer setting up a championship event
**I want to** use a checklist template designed for multi-team events
**So that** I have the right items for this competition type

**Template Types:**
- **Dual Meet Standard** - 2 teams, standard items
- **Tri/Quad Meet** - 3-4 teams, additional camera/graphics items
- **Championship Event** - 5-6 teams, extended communications, more camera ops

**Flow:**
1. Create new competition as "womens-quad"
2. System suggests "Quad Meet" template
3. Producer accepts or chooses different template
4. Checklist pre-populated with template items
5. Producer can add/remove items for this specific competition

**Acceptance Criteria (Phase 2):**
- [ ] Templates stored at `checklistTemplates/{template-id}`
- [ ] System suggests template based on `compType`
- [ ] Producer can override template selection
- [ ] Template items copied to competition-specific checklist
- [ ] Producer can customize after template applied

---

## 4. Phase Overview

| Phase | Name | Priority | Goal |
|-------|------|----------|------|
| **1** | MVP Checklist | P0 | Hardcoded checklist, auto-validation, manual checkboxes |
| **1** | Team Contacts | P0 | Contacts database under teamsDatabase |
| **2** | Checklist Templates | P1 | Editable templates per competition type |
| **3** | Site Evaluations | P2 | Venue database with camera positions, photos |
| **3** | Camera Config Integration | P2 | Auto-generate camera config from site eval |

---

## 5. Success Criteria

### Phase 1 (MVP) Complete When:
- [ ] Checklist page accessible at `/{compId}/checklist`
- [ ] 4 phases with ~72 items displayed
- [ ] Auto-validated items show real-time status
- [ ] Manual items can be checked/unchecked
- [ ] Checklist state persists to Firebase
- [ ] Notes can be added to items
- [ ] Team contacts panel shows and edits contacts
- [ ] Contacts persist at `teamsDatabase/contacts/{team-key}`
- [ ] "Fix" links navigate to relevant pages

### Phase 2 Complete When:
- [ ] Template editor UI available
- [ ] Templates stored in Firebase
- [ ] Competition uses template on creation
- [ ] Producer can customize template items

### Phase 3 Complete When:
- [ ] Site evaluation editor UI available
- [ ] Venue data stored at `teamsDatabase/venues/{venue-key}`
- [ ] Camera positions with photos stored
- [ ] Camera config auto-populated from site eval

---

## 6. Terminology

| Term | Definition |
|------|------------|
| **Checklist** | Collection of items a producer must complete before/during a show |
| **Phase** | Timeline grouping of checklist items (Setup, Pre-Production, Day Of) |
| **Category** | Logical grouping within a phase (Session Setup, Communications, etc.) |
| **Auto-validated Item** | Item whose completion is determined by system state |
| **Manual Item** | Item checked off by producer manually |
| **Team Key** | Unique identifier for a team (e.g., "west-chester-womens") |
| **Venue Key** | Unique identifier for a venue (e.g., "hollinger-fieldhouse") |
| **Site Evaluation** | Documentation of venue layout, camera positions, technical specs |
| **Template** | Predefined checklist that can be applied to new competitions |

---

## 7. Data Sources (Real Checklist Reference)

Based on "2026 Master: Streaming Check List - Women - WCU - 12/5 - 7pm EST":

**Original spreadsheet (130+ items):**
- Communications (15 items) - Emails, talent coordination, group chats
- Deliverable (5 items) - Graphics, timeline, sponsorships received
- Graphics (10 items) - Custom backgrounds, meet graphics, canva work
- Site Evaluation (10 items) - Venue assessment, camera placement, internet
- Internal Scheduling (5 items) - Calendar events for team
- Session (10 items) - Virtius session config, headshots, rosters, lineups
- Camera Ops (15 items) - Larix QR codes, SRT config, camera testing
- Commentary/Talent (15 items) - Talent coordination, mics, bandwidth, Discord
- YouTube (10 items) - Stream setup, thumbnail, description
- OBS (20 items) - Stream key, settings, scenes, audio config
- VM (5 items) - VM login, Haivision gateway
- Discord (5 items) - Streamer mode, audio capture, screen share

**MVP Scope (72 items):**
The MVP includes a curated subset of ~72 items selected for their criticality and ability to be auto-validated. The full 130+ item list is available in the original spreadsheet for reference, but the in-app checklist focuses on the most essential items to avoid overwhelming producers while still ensuring nothing critical is missed.

---

## 8. Related Documents

| Document | Purpose |
|----------|---------|
| [PLAN-Production-Checklist-2026-01-24.md](./PLAN-Production-Checklist-2026-01-24.md) | Technical architecture, data models, component design |
| [PLAN-Production-Checklist-Implementation.md](./PLAN-Production-Checklist-Implementation.md) | Task breakdown and progress tracking |
