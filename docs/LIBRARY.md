# Documentation Library

**Last Updated:** 2026-01-22

This is a searchable index of all project documentation. Search for keywords to find the right document, then read that document directly.

---

## Architecture & Infrastructure

### [INFRASTRUCTURE.md](INFRASTRUCTURE.md)
**Keywords:** VM, coordinator, networking, ports, Firebase paths, routing, connection flow, API, SSL, mixed content, 44.193.31.120, 3.87.107.201, vmPool, AMI
**Summary:** Quick reference for VMs, networking, ports, and Firebase paths. Start here for infrastructure questions.

### [README-OBS-Architecture.md](README-OBS-Architecture.md)
**Keywords:** OBS, WebSocket, coordinator, VM, proxy, SSL, mixed content, obsConnectionManager, obsStateSync, Socket.io, production routing, competition VM, port 4455, port 3003, api.commentarygraphic.com
**Summary:** How OBS connections are proxied through the coordinator. Critical for any OBS-related work.

### [SPEC-competition-vm-routing.md](SPEC-competition-vm-routing.md)
**Keywords:** routing, compId, vmAddress, Firebase lookup, competition isolation, socket connection, frontend routing
**Summary:** How the frontend determines which VM to connect to for a competition.

### [vm-architecture-diagram.md](vm-architecture-diagram.md)
**Keywords:** VM diagram, infrastructure diagram, system architecture, visual diagram
**Summary:** Visual diagram of the VM architecture.

### [vm-setup-guide.md](vm-setup-guide.md)
**Keywords:** VM setup, OBS installation, headless OBS, XVFB, systemd, PM2, new VM, AMI
**Summary:** How to set up a new competition VM from scratch.

### [SYSTEM-OVERVIEW.md](../SYSTEM-OVERVIEW.md)
**Keywords:** system overview, Firebase structure, controller, output, dashboard, graphics flow, data flow
**Summary:** High-level system flow for graphics (controller → Firebase → output).

---

## OBS Integration

### [PRD-OBS-00-Index.md](PRD-OBS-00-Index.md)
**Keywords:** OBS PRD index, OBS features, OBS status, OBS tests, implementation status
**Summary:** Index of all OBS PRDs with status and test results.

### [PRD-OBS-01-StateSync/](PRD-OBS-01-StateSync/PRD-OBS-01-StateSync.md)
**Keywords:** OBS state, state sync, obs:stateUpdated, refreshState, obsState, OBS connection
**Summary:** Foundation for OBS state synchronization between server and frontend.

### [PRD-OBS-02-SceneManagement/](PRD-OBS-02-SceneManagement/PRD-OBS-02-SceneManagement.md)
**Keywords:** OBS scenes, create scene, delete scene, reorder scenes, scene list, switchScene
**Summary:** Scene CRUD operations and scene switching.

### [PRD-OBS-03-SourceManagement/](PRD-OBS-03-SourceManagement/PRD-OBS-03-SourceManagement.md)
**Keywords:** OBS sources, browser source, SRT source, media source, source visibility, input settings
**Summary:** Managing sources within scenes (browser, SRT, media inputs).

### [PRD-OBS-04-AudioManagement/](PRD-OBS-04-AudioManagement/PRD-OBS-04-AudioManagement.md)
**Keywords:** OBS audio, volume, mute, audio mixer, audio presets, audio sources
**Summary:** Audio controls, volume, muting, and audio presets.

### [PRD-OBS-05-Transitions/](PRD-OBS-05-Transitions/PRD-OBS-05-Transitions.md)
**Keywords:** OBS transitions, fade, cut, transition duration, stinger
**Summary:** Scene transitions configuration.

### [PRD-OBS-06-StreamRecording/](PRD-OBS-06-StreamRecording/PRD-OBS-06-StreamRecording.md)
**Keywords:** OBS streaming, OBS recording, stream key, RTMP, start stream, stop stream
**Summary:** Stream and recording controls.

### [PRD-OBS-07-AssetManagement/](PRD-OBS-07-AssetManagement/PRD-OBS-07-AssetManagement.md)
**Keywords:** OBS assets, upload asset, delete asset, asset categories, media files
**Summary:** Uploading and managing media assets for OBS.

### [PRD-OBS-08-Templates/](PRD-OBS-08-Templates/PRD-OBS-08-Templates.md)
**Keywords:** OBS templates, scene templates, save template, load template, template system
**Summary:** Saving and loading OBS scene collection templates.

### [PRD-OBS-08.1-TemplateApply/](PRD-OBS-08.1-TemplateApply/PRD-OBS-08.1-TemplateApply.md)
**Keywords:** template apply, template broken, scene generation, obsSceneGenerator
**Summary:** Bug fix PRD for template application (BROKEN status).

### [PRD-OBS-09-PreviewSystem/](PRD-OBS-09-PreviewSystem/PRD-OBS-09-PreviewSystem.md)
**Keywords:** OBS preview, live preview, current output, preview display
**Summary:** Previewing OBS output in the frontend.

### [PRD-OBS-10-TalentComms/](PRD-OBS-10-TalentComms/PRD-OBS-10-TalentComms.md)
**Keywords:** talent comms, VDO.Ninja, talent URL, obsViewUrls, talentUrls, commentator video
**Summary:** VDO.Ninja integration for talent video feeds.

### [PRD-OBS-11-AdvancedFeatures/](PRD-OBS-11-AdvancedFeatures/PRD-OBS-11-AdvancedFeatures.md)
**Keywords:** studio mode, scene thumbnails, VU meters, advanced OBS, OBS future features
**Summary:** Future OBS features (studio mode, thumbnails, meters).

### [SPEC-OBS-Templates.md](SPEC-OBS-Templates.md)
**Keywords:** template spec, scene template format, JSON template, template variables
**Summary:** Technical specification for OBS scene templates.

---

## Rundown / Show Flow

### [PRD-Rundown-00-Index.md](PRD-Rundown-00-Index.md)
**Keywords:** rundown index, rundown PRDs, show flow, rundown status
**Summary:** Index of all Rundown PRDs.

### [PRD-Rundown-00-Timesheet/](PRD-Rundown-00-Timesheet/PRD-ConsolidateTimesheetShowProgress.md)
**Keywords:** timesheet, show progress, useTimesheet, rotation timing, show stats
**Summary:** Consolidated timesheet and show progress tracking.

### [PRD-Rundown-01-EditorPrototype/](PRD-Rundown-01-EditorPrototype/PRD-Rundown-01-EditorPrototype.md)
**Keywords:** rundown editor, editor prototype, rundown UI, segment editor
**Summary:** Advanced rundown editor prototype.

### [PRD-Rundown-02-SegmentList/](PRD-Rundown-02-SegmentList/PRD-Rundown-02-SegmentList.md)
**Keywords:** segment list, rundown segments, segment display
**Summary:** Segment list component for rundown editor.

### [PRD-Rundown-03-SegmentDetail/](PRD-Rundown-03-SegmentDetail/PRD-Rundown-03-SegmentDetail.md)
**Keywords:** segment detail, segment editing, segment form
**Summary:** Segment detail/editing panel.

### [PRD-Rundown-04-Pickers/](PRD-Rundown-04-Pickers/PRD-Rundown-04-Pickers.md)
**Keywords:** pickers, graphic picker, scene picker, athlete picker, selection UI
**Summary:** Picker components for selecting graphics, scenes, athletes.

### [PRD-Rundown-05-ProducerPreview/](PRD-Rundown-05-ProducerPreview/PRD-Rundown-05-ProducerPreview.md)
**Keywords:** producer preview, producer view, rundown preview
**Summary:** Producer preview panel for rundown.

### [PRD-AdvancedRundownEditor-2026-01-22.md](PRD-AdvancedRundownEditor-2026-01-22.md)
**Keywords:** advanced rundown, rundown master PRD, full rundown spec
**Summary:** Master PRD for the advanced rundown editor feature.

---

## Graphics

### [PRD-Graphics-Registry/PRD-Graphics-Registry.md](PRD-Graphics-Registry/PRD-Graphics-Registry.md)
**Keywords:** graphics registry, schema-driven graphics, graphicsRegistry.js, add graphic, new graphic, graphic picker, graphic URL, graphic params
**Summary:** PRD for the schema-driven graphics registry system. Single source of truth for all graphics.

### [PRD-Graphics-Registry/GUIDE-Adding-New-Graphics.md](PRD-Graphics-Registry/GUIDE-Adding-New-Graphics.md)
**Keywords:** add graphic, new graphic, create graphic, overlay HTML, graphic template, graphic checklist, graphic keywords, searchable graphic, graphic schema
**Summary:** Step-by-step guide for adding new graphics to the system. Includes HTML templates, registry schema reference, and checklist.

### [GRAPHICS-INVENTORY.md](GRAPHICS-INVENTORY.md)
**Keywords:** graphics list, graphic types, available graphics, graphic inventory, overlay list
**Summary:** List of all available graphics and overlays.

### [OBS-SCENE-CONTROLLER.md](OBS-SCENE-CONTROLLER.md)
**Keywords:** scene controller, OBS controller, legacy controller
**Summary:** Legacy OBS scene controller documentation.

---

## Deployment & Operations

### [CLAUDE.md](../CLAUDE.md)
**Keywords:** deployment, MCP tools, firebase tools, SSH tools, production deploy, commentarygraphic.com, coordinator deploy
**Summary:** Main project instructions including deployment procedures and MCP tool reference.

### [DEPLOYMENT.md](../DEPLOYMENT.md)
**Keywords:** deploy steps, production deployment, build and deploy
**Summary:** Step-by-step deployment instructions.

### [QUICK-START.md](../QUICK-START.md)
**Keywords:** quick start, getting started, setup, local development
**Summary:** Quick start guide for local development.

---

## VM Pool & AWS

### [PRD-VMArchitecture-2026-01-14.md](PRD-VMArchitecture-2026-01-14.md)
**Keywords:** VM pool, VM architecture, vmPoolManager, AWS EC2, instance lifecycle
**Summary:** VM pool management architecture.

### [PRD-CoordinatorDeployment-2026-01-15.md](PRD-CoordinatorDeployment-2026-01-15.md)
**Keywords:** coordinator deployment, coordinator setup, PM2, nginx, SSL
**Summary:** Coordinator server deployment and setup.

---

## Testing & Automation

### [ralph-runner/README.md](ralph-runner/README.md)
**Keywords:** RALPH, automated testing, PRD runner, loop testing, iteration runner
**Summary:** RALPH automated PRD implementation runner.

### [ralph-wiggum-technique.md](ralph-wiggum-technique.md)
**Keywords:** Ralph Wiggum, testing technique, iteration approach
**Summary:** The Ralph Wiggum testing technique explanation.

### [PRD-MCPServerTesting-2026-01-16.md](PRD-MCPServerTesting-2026-01-16.md)
**Keywords:** MCP testing, server testing, test infrastructure
**Summary:** MCP server testing PRD.

### [prd-mcp-server-testing.md](prd-mcp-server-testing.md)
**Keywords:** MCP server test, test MCP
**Summary:** Additional MCP server testing documentation.

### [prd-test-vm-separation.md](prd-test-vm-separation.md)
**Keywords:** test VM, VM separation, test isolation
**Summary:** Test VM separation requirements.

---

## Firebase

### [firebase-mcp-spec.md](firebase-mcp-spec.md)
**Keywords:** Firebase MCP, Firebase tools spec, firebase_get, firebase_set, firebase_update
**Summary:** Firebase MCP tools specification.

---

## Historical / Session Notes

### [session-summary-2026-01-16.md](session-summary-2026-01-16.md)
**Keywords:** session summary, January 16, historical context
**Summary:** Session summary from 2026-01-16.

### [PRD-CompetitionBoundArchitecture-2026-01-13.md](PRD-CompetitionBoundArchitecture-2026-01-13.md)
**Keywords:** competition bound, early architecture, historical PRD
**Summary:** Early competition-bound architecture PRD (historical).

### [Implementation-OBSIntegrationTool-2026-01-16.md](Implementation-OBSIntegrationTool-2026-01-16.md)
**Keywords:** OBS implementation notes, implementation details
**Summary:** Implementation notes for OBS integration tool.

### [PRD-OBSIntegrationTool-2026-01-16.md](PRD-OBSIntegrationTool-2026-01-16.md)
**Keywords:** original OBS PRD, full OBS spec, monolithic OBS PRD
**Summary:** Original monolithic OBS PRD (now split into PRD-OBS-01 through 11).

---

## Quick Reference by Topic

| If you need to... | Read this document |
|-------------------|-------------------|
| Understand OBS connection flow | [README-OBS-Architecture.md](README-OBS-Architecture.md) |
| Deploy to production | [CLAUDE.md](../CLAUDE.md) |
| Add a new team | [CLAUDE.md](../CLAUDE.md) (Adding a New Team section) |
| **Add a new graphic** | [GUIDE-Adding-New-Graphics.md](PRD-Graphics-Registry/GUIDE-Adding-New-Graphics.md) |
| Fix an OBS feature | [PRD-OBS-00-Index.md](PRD-OBS-00-Index.md) → specific PRD |
| Work on rundown editor | [PRD-Rundown-00-Index.md](PRD-Rundown-00-Index.md) |
| Set up a new VM | [vm-setup-guide.md](vm-setup-guide.md) |
| Understand graphics | [GRAPHICS-INVENTORY.md](GRAPHICS-INVENTORY.md) |
| Use MCP tools | [CLAUDE.md](../CLAUDE.md) |
| Debug talent video not showing | [PRD-OBS-10-TalentComms](PRD-OBS-10-TalentComms/PRD-OBS-10-TalentComms.md) + [README-OBS-Architecture.md](README-OBS-Architecture.md) (VDO.Ninja section) |
