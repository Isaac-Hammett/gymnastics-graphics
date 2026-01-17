# New Feature - Product Requirements

## Goal

Add [feature name] that allows users to [describe capability].

---

## Success Criteria

### Workflow 1: Feature Works
1. Navigate to feature location
2. Interact with new UI elements
3. Verify expected behavior
4. Check data persists correctly (Firebase/API)

### Workflow 2: Integration
1. Feature works with existing functionality
2. No regressions in related areas
3. Responsive on mobile (if applicable)

### Workflow 3: Error Handling
1. Invalid input shows appropriate error
2. Network errors handled gracefully
3. Loading states work correctly

---

## Environment

| Resource | Value |
|----------|-------|
| Production Frontend | https://commentarygraphic.com |
| Production Frontend Server | 3.87.107.201 |
| Coordinator API | https://api.commentarygraphic.com |

---

## Implementation Notes

### Frontend
- Component location: `show-controller/src/components/`
- Route: `/path/to/feature`
- State management: [Context/Redux/local]

### Backend (if needed)
- API endpoint: `POST /api/...`
- Firebase path: `competitions/{id}/...`

---

## Known Issues (Starting Point)

1. Feature does not exist yet
2. [Any blockers or dependencies]

---

## Verification Method

Every task MUST be verified with:
1. `browser_navigate` to the relevant page
2. `browser_take_screenshot` to capture current state
3. `browser_console_messages` to check for JS errors
