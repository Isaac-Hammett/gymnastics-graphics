# URL Generator — Tasks

## Tasks

### Task 1: Screenshot all 86 graphics in URL Generator (unthemed + themed) — COMPLETE
**Verify:**
- [x] All 86 PNGs in `docs/PRD-Graphics-Audit-ECAC/audit/urlgen-unthemed/`
- [x] All 86 PNGs in `docs/PRD-Graphics-Audit-ECAC/audit/urlgen-themed/`
- [x] Files named `{graphic-id}.png`
- [x] Screenshots show full URL Generator page (sidebar + preview + URL bar)
- [x] No files are 0 bytes

**Notes:**
- Competition ID: `ecac-2026-audit` (Men's 6-team competition)
- Theme applied via Firebase: `competitions/ecac-2026-audit/config/meetTheme = "behind-the-chalk"`
- Actual count is 86 graphics (not 80 as originally estimated) due to 6-team format

## Discovered Bugs
- Stage engine graphics (leaderboards, rosters) render as blank/black in preview — this is expected behavior when no live data is present

## Learnings
- URL Generator does not have a theme dropdown — must set `meetTheme` in Firebase competition config
- Use `?comp={compId}` URL param to load competition data in URL Generator
- Playwright `run_code` can batch multiple screenshot operations efficiently (2s wait per graphic)
