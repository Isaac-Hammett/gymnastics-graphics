# Bug Fix - Product Requirements

## Goal

Fix [describe the bug] that occurs when [describe trigger conditions].

---

## Success Criteria

### Workflow 1: Reproduce and Verify Fix
1. Navigate to affected page
2. Perform action that triggers the bug
3. Verify bug no longer occurs
4. Check console for no errors

### Workflow 2: Regression Check
1. Test related functionality still works
2. Verify no new errors introduced
3. Check edge cases

---

## Environment

| Resource | Value |
|----------|-------|
| Production Frontend | https://commentarygraphic.com |
| Production Frontend Server | 3.87.107.201 |
| Coordinator API | https://api.commentarygraphic.com |

---

## Known Issues (Starting Point)

1. [Describe the bug symptoms]
2. [Describe when it occurs]
3. [Any error messages seen]

---

## Verification Method

Every task MUST be verified with:
1. `browser_navigate` to the relevant page
2. `browser_take_screenshot` to capture current state
3. `browser_console_messages` to check for JS errors
