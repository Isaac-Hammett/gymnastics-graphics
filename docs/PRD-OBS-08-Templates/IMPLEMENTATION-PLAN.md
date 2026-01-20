# PRD-OBS-08: Templates - Implementation Plan

**Last Updated:** 2026-01-20
**Status:** Fix Required (TEST-47 Failing)

---

## Priority Order

### P0 - Fix Template Delete (BROKEN)

| # | Task | Status | Notes |
|---|------|--------|-------|
| 1 | Debug TEST-47: Template delete not working | NOT STARTED | Check delete endpoint and Firebase path |
| 2 | Verify `obsTemplateManager.deleteTemplate()` method | NOT STARTED | May have wrong Firebase path |
| 3 | Verify DELETE `/api/obs/templates/:templateId` endpoint | NOT STARTED | Check server/routes/obs.js |
| 4 | Verify TemplateManager.jsx calls delete correctly | NOT STARTED | Check frontend implementation |

### P1 - Verify Working Functionality

| # | Task | Status | Notes |
|---|------|--------|-------|
| 5 | Verify template apply works | COMPLETE | TEST-46 passed |
| 6 | Verify template list works | NOT STARTED | Should show available templates |
| 7 | Verify create template works | NOT STARTED | Save current OBS state |

### P2 - Variable Substitution

| # | Task | Status | Notes |
|---|------|--------|-------|
| 8 | Verify asset variable substitution | NOT STARTED | `{{assets.music.intro}}` |
| 9 | Verify camera variable substitution | NOT STARTED | `{{cameras.cam1.srtUrl}}` |
| 10 | Verify competition variable substitution | NOT STARTED | `{{competition.name}}` |

### P3 - Validation

| # | Task | Status | Notes |
|---|------|--------|-------|
| 11 | Verify missing assets reported as errors | NOT STARTED | Validation before apply |

---

## Debugging Steps for Template Delete

1. Check `server/lib/obsTemplateManager.js` `deleteTemplate()` method
2. Verify Firebase path is correct (`templates/obs/{templateId}` vs `competitions/{compId}/obs/templates/`)
3. Check if template ID is URL encoded correctly
4. Check coordinator logs for errors
5. Test API directly: `curl -X DELETE https://api.commentarygraphic.com/api/obs/templates/{id}`

---

## Source Files to Review

### Frontend
- `show-controller/src/components/obs/TemplateManager.jsx` - Template UI

### Backend (Coordinator)
- `server/lib/obsTemplateManager.js` - **FIX deleteTemplate()**
- `server/routes/obs.js` - **FIX DELETE endpoint**

---

## Verification URLs

- **OBS Manager UI:** `https://commentarygraphic.com/{compId}/obs-manager`
- **Coordinator Status:** `https://api.commentarygraphic.com/api/coordinator/status`

---

## Progress Log

### 2026-01-20
- Created implementation plan
- TEST-47 (template delete) is failing

---

## Related Files Changed

| File | Change Description | Commit |
|------|-------------------|--------|
| - | - | - |
