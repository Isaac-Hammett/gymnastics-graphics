# Checklist Items Definition

**Version:** 1.1
**Date:** 2026-03-07
**Total Items:** 75
**Auto-Validated:** 14
**Manual:** 61

Items marked with `auto` have a validator key that checks system state automatically.
Items marked with `manual` require the producer to check them off.

**All 75 items appear for all competition types in MVP.** The dynamic behavior is in the validators (they check N teams based on comp type), not in item visibility. Hiding/showing items by competition type is deferred to Phase 2 (templates).

---

## Phase 1: Setup (5+ Days Out)

### Category: Competition Config (7 items)

| # | ID | Name | Type | Validator | Fix Link | Notes |
|---|-----|------|------|-----------|----------|-------|
| 1 | `event-name` | Event name configured | auto | `event-name` | `/` | Checks `config.eventName` |
| 2 | `meet-date` | Meet date configured | auto | `meet-date` | `/` | Checks `config.meetDate` |
| 3 | `venue-configured` | Venue configured | auto | `venue-configured` | `/` | Checks `config.venue` |
| 4 | `teams-configured` | Teams configured with names & logos | auto | `teams-configured` | `/` | Dynamic: checks all teams for comp type |
| 5 | `rosters-loaded` | Rosters loaded for all teams | auto | `rosters-loaded` | `/media-manager` | Dynamic: checks all teams for comp type |
| 6 | `headshots-uploaded` | Headshots uploaded & current (>80%) | auto | `headshots-uploaded` | `/media-manager` | Dynamic: checks all teams for comp type. Threshold rationale: 80% accounts for walk-ons/injured who won't compete. |
| 7 | `theme-configured` | Meet theme configured | auto | `theme-configured` | `/themes` | Warning (not error) if missing — defaults work fine |

### Category: Session Setup (3 items)

| # | ID | Name | Type | Notes |
|---|-----|------|------|-------|
| 8 | `session-created` | Session created in Virtius | manual | Link to Virtius session |
| 9 | `session-configured` | Session configured with teams, times, public, judges | manual | |
| 10 | `session-front-page` | Session placed on Virtius front page | manual | |

### Category: Communications (6 items)

| # | ID | Name | Type | Notes |
|---|-----|------|------|-------|
| 11 | `pre-meet-email` | Pre-meet email sent to coaches | manual | Request talent, timeline, graphics, sponsors, cameras, site eval |
| 12 | `camera-op-contact` | Camera op contact info received | manual | Phone number, game day camera assignments. Auto-assisted by contacts panel (see Tech Plan 7.2). |
| 13 | `talent-contacted` | Commentary talent contacted & confirmed | manual | |
| 14 | `streaming-plan-confirmed` | Streaming plan confirmed with school | manual | |
| 15 | `ops-group-chat` | Group chat created with ops team & camera crew | manual | |
| 16 | `talent-group-chat` | Talent text group chat created with producer | manual | |

### Category: Graphics & Deliverables (5 items)

| # | ID | Name | Type | Notes |
|---|-----|------|------|-------|
| 17 | `meet-graphics-received` | Meet graphics received from school | manual | |
| 18 | `show-timeline-received` | Show timeline received | manual | |
| 19 | `sponsorships-received` | Sponsorships & sponsor requirements received | manual | |
| 20 | `animated-background` | Custom animated background created | manual | |
| 21 | `graphics-approved` | Graphics approved by school/team | manual | |

### Category: Internal Scheduling (4 items)

| # | ID | Name | Type | Notes |
|---|-----|------|------|-------|
| 22 | `calendar-event` | Event added to team calendar | manual | |
| 23 | `venue-ops-scheduled` | Venue ops bring-up scheduled | manual | |
| 24 | `commentator-bringup` | Commentator bring-up scheduled | manual | |
| 25 | `dry-run-scheduled` | Internal dry run scheduled | manual | |

**Setup phase total: 25 items (7 auto, 18 manual)**

---

## Phase 2: Pre-Production (2-4 Days Out)

### Category: Camera Ops (6 items)

| # | ID | Name | Type | Notes |
|---|-----|------|------|-------|
| 26 | `camera-config-added` | Camera config added to system | manual | Camera names, ports, apparatus assignments |
| 27 | `larix-qr-created` | Larix QR codes / links created | manual | |
| 28 | `qr-codes-sent` | QR codes / camera links sent to camera ops | manual | |
| 29 | `larix-premium-confirmed` | Larix premium confirmed on all game day cameras | manual | |
| 30 | `larix-connection-tested` | Camera connection tested via Larix link/QR code | manual | |
| 31 | `camera-op-briefed` | Camera op briefed on procedures & reference angles | manual | Don't move camera after rotation, focus lock, etc. |

### Category: YouTube / Streaming (7 items)

| # | ID | Name | Type | Notes |
|---|-----|------|------|-------|
| 32 | `youtube-stream-created` | YouTube stream page created with countdown | manual | |
| 33 | `youtube-title-description` | YouTube title & description updated | manual | |
| 34 | `youtube-streaming-software` | YouTube stream set to "Streaming software" mode | manual | Not mobile |
| 35 | `youtube-registered-24hr` | YouTube account registered 24hr in advance for streaming | manual | |
| 36 | `youtube-thumbnail` | Meet graphic thumbnail added to YouTube stream | manual | |
| 37 | `youtube-public` | YouTube stream made public | manual | |
| 38 | `stream-embedded-virtius` | Production stream embedded in Virtius session | manual | |

### Category: Talent (7 items)

| # | ID | Name | Type | Notes |
|---|-----|------|------|-------|
| 39 | `talent-locked-in` | Talent locked in & recorded | manual | |
| 40 | `talent-usb-mic` | Talent has USB microphone confirmed | manual | |
| 41 | `talent-bandwidth` | Talent bandwidth measurements recorded | manual | |
| 42 | `discord-channel-created` | Discord channel created & invites sent to talent | manual | |
| 43 | `show-plan-reviewed` | Show plan reviewed internally | manual | |
| 44 | `show-plan-sent` | Show plan sent to talent | manual | |
| 45 | `talent-checkins-scheduled` | Game day & pre-game check-ins scheduled with talent | manual | |

### Category: Rundown (3 items)

| # | ID | Name | Type | Validator | Fix Link | Notes |
|---|-----|------|------|-----------|----------|-------|
| 46 | `rundown-created` | Rundown created with segments | auto | `rundown-created` | `/{compId}/rundown` | Path: `competitions/{compId}/rundown/segments` |
| 47 | `segments-named` | Rundown segments named | auto | `segments-named` | `/{compId}/rundown` | |
| 48 | `graphics-assigned` | Graphics assigned to segments | auto | `graphics-assigned` | `/{compId}/rundown` | |

**Pre-Production phase total: 23 items (3 auto, 20 manual)**

---

## Phase 3: Day Of (2 Hours Before)

### Category: VM / Infrastructure (4 items)

| # | ID | Name | Type | Validator | Fix Link | Notes |
|---|-----|------|------|-----------|----------|-------|
| 49 | `vm-assigned` | VM assigned to competition | auto | `vm-assigned` | `/_admin/vm-pool` | |
| 50 | `vm-online` | VM online & accessible | auto | `vm-online` | `/_admin/vm-pool` | Will show red for custom VMs |
| 51 | `haivision-enabled` | Haivision gateway enabled | manual | | | |
| 52 | `socket-connected` | Show controller connected to coordinator | auto | `socket-connected` | `/_admin/vm-pool` | No direct fix — depends on VM + coordinator. Fix link for VM status check. |

### Category: OBS Configuration (8 items)

| # | ID | Name | Type | Validator | Fix Link | Notes |
|---|-----|------|------|-----------|----------|-------|
| 53 | `obs-connected` | OBS connected to coordinator | auto | `obs-connected` | `/{compId}/obs-manager` | |
| 54 | `stream-key-confirmed` | Stream key confirmed in OBS | manual | | | |
| 55 | `obs-stream-settings` | OBS stream settings confirmed (1080p60, 7k kbps) | manual | | | |
| 56 | `stinger-transition` | Stinger transition point set to 14 frames | manual | | | |
| 57 | `scenes-sources-confirmed` | All scenes & sources visually confirmed on VM | manual | | | |
| 58 | `animated-bg-confirmed` | Animated background confirmed in OBS | manual | | | |
| 59 | `background-music` | Background music audible in Stream Starting Soon scene | manual | | | |
| 60 | `audio-sources-configured` | Audio sources configured (camera audio, muting) | manual | | | Camera A unmuted, others muted |

### Category: Camera Ops — Day Of (6 items)

| # | ID | Name | Type | Notes |
|---|-----|------|------|-------|
| 61 | `larix-ports-confirmed` | Larix ports confirmed on game day cameras | manual | |
| 62 | `camera-locations-marked` | Camera locations reviewed & marked on-site | manual | |
| 63 | `equipment-check` | Equipment check complete (battery, backup, tripod) | manual | |
| 64 | `camera-bandwidth` | Bandwidth measured for primary camera & WiFi confirmed | manual | |
| 65 | `larix-hardening` | Larix hardening & settings lockdown complete | manual | Audio/visual settings locked |
| 66 | `camera-stream-tested` | Camera stream started & configuration verified | manual | |

### Category: Session — Day Of (2 items)

| # | ID | Name | Type | Notes |
|---|-----|------|------|-------|
| 67 | `session-live-mode` | Virtius session set to LIVE mode | manual | |
| 68 | `lineups-added` | Lineups added for all teams | manual | |

**Day Of (2hr) phase total: 20 items (4 auto, 16 manual)**

---

## Phase 4: Day Of (1 Hour Before)

### Category: Discord / Talent Audio (7 items)

| # | ID | Name | Type | Notes |
|---|-----|------|------|-------|
| 69 | `discord-streamer-mode` | Discord streamer mode enabled | manual | |
| 70 | `discord-call-started` | Discord call started with talent | manual | |
| 71 | `talent-audio-confirmed` | Talent audio inputs/outputs confirmed in Discord | manual | |
| 72 | `obs-projector-shared` | OBS windowed projector shared to talent via Discord | manual | 720p 60fps |
| 73 | `discord-audio-captured` | Discord audio source captured in OBS | manual | |
| 74 | `talent-audio-levels` | Talent audio level balanced over camera audio | manual | |
| 75 | `talent-dry-run` | Dry run completed with talent (intro, rules, protocols) | manual | Covers: 3 rules, mute protocol, show plan, intro timing |

**Day Of (1hr) phase total: 7 items (0 auto, 7 manual)**

---

## Summary

| Phase | Auto | Manual | Total |
|-------|------|--------|-------|
| Setup (5+ Days Out) | 7 | 18 | 25 |
| Pre-Production (2-4 Days Out) | 3 | 20 | 23 |
| Day Of (2 Hours Before) | 4 | 16 | 20 |
| Day Of (1 Hour Before) | 0 | 7 | 7 |
| **Total** | **14** | **61** | **75** |

---

## Auto-Validator Keys

| Key | Source | Logic | Fix Link |
|-----|--------|-------|----------|
| `event-name` | `competitionConfig.eventName` | Non-empty string | `/` |
| `meet-date` | `competitionConfig.meetDate` | Non-empty string | `/` |
| `venue-configured` | `competitionConfig.venue` | Non-empty string | `/` |
| `teams-configured` | `competitionConfig.team{N}Name` + `team{N}Logo` | All teams for comp type have name + logo | `/` |
| `rosters-loaded` | `teamData.team{N}.roster` | All teams have roster length > 0 | `/media-manager` |
| `headshots-uploaded` | `teamData.team{N}.roster` headshot % | Average across all teams >= 80% | `/media-manager` |
| `theme-configured` | `competitionConfig.meetTheme` | Non-empty string (warning, not error) | `/themes` |
| `rundown-created` | `competitions/{compId}/rundown/segments` | At least 1 segment exists | `/{compId}/rundown` |
| `segments-named` | `competitions/{compId}/rundown/segments` | No segments named "New Segment" | `/{compId}/rundown` |
| `graphics-assigned` | `competitions/{compId}/rundown/segments` | >= 80% of segments have `graphic.graphicId` | `/{compId}/rundown` |
| `vm-assigned` | `competitionConfig.vmAddress` | Non-empty string | `/_admin/vm-pool` |
| `vm-online` | `checkVmStatus(vmAddress)` | HTTP health check returns OK (red for custom VMs) | `/_admin/vm-pool` |
| `socket-connected` | `ShowContext.connected` | Boolean true | `/_admin/vm-pool` |
| `obs-connected` | `OBSContext.obsConnected` | Boolean true | `/{compId}/obs-manager` |

## Competition Type Filtering

All 75 items appear for all competition types in MVP. The dynamic behavior is in the **validators**:
- `teams-configured` checks N teams based on comp type (2 for dual, 3 for tri, up to 7)
- `rosters-loaded` checks N teams
- `headshots-uploaded` checks N teams

Item visibility by competition type is deferred to Phase 2 (templates).
