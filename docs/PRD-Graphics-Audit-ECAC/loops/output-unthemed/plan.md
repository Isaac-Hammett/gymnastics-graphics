# Output Unthemed — Tasks

## Tasks

### Task 1: Screenshot all 80 graphics at 1920x1080 (no theme) — COMPLETE
**Verify:**
- [x] All 80 PNG files saved to `docs/PRD-Graphics-Audit-ECAC/audit/output-unthemed/`
- [x] Files named `{graphic-id}.png` (e.g., `leaderboard-fx.png`, `event-bar.png`)
- [x] Screenshots are 1920x1080 (not cropped, not scrolled)
- [x] No files are 0 bytes

## Discovered Bugs
(none found during this iteration)

## Learnings
- Stage engine graphics require `preview=full` to show sample data; without it they show blank/waiting for live data
- Preview buttons (Play/Dismiss) appear with `preview=full` mode but can be hidden via JS before screenshot
- Competition ID used: `ecac-2026-audit` (6-team men's competition)
- Men's apparatus codes: FX, PH, SR, VT, PB, HB (not women's BB/UB)
- Sponsor graphics need 10s wait time for images to load
- Leaderboards show sample data (Stanford, Michigan, etc.) not ECAC teams in preview mode - this is expected
