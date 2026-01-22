# Rundown-01: Data Model & Backend

## Task
Implement the data model and backend services for the Rundown Editor as specified in PRD-Rundown-01-DataModel.md.

## Context
- This is the foundation PRD - all other Rundown PRDs depend on this
- Must integrate with existing Firebase structure
- Must work with existing Socket.io infrastructure in server/index.js

## Requirements
1. Create `server/lib/rundownService.js` with all CRUD operations
2. Create `server/routes/rundown.js` with REST API endpoints
3. Add Socket.io handlers in `server/index.js` for real-time sync
4. Implement editing locks for multi-user collaboration

## Architecture Notes
- All API routes need compId (from request header or query param)
- Socket events should broadcast to room `competition:{compId}`
- Firebase path: `competitions/{compId}/production/rundown/`
- Follow existing patterns in server/lib/obsStateSync.js for Firebase operations

## Acceptance Criteria
- [ ] All API endpoints return correct status codes
- [ ] Firebase structure matches PRD specification
- [ ] Socket events broadcast segment changes
- [ ] Edit locks work with 5-minute timeout
- [ ] No console errors on coordinator

## Testing
After implementation:
1. Use curl or Postman to test API endpoints
2. Verify Firebase data structure
3. Test socket events with multiple browser tabs
