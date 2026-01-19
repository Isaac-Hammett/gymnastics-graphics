# {{PROJECT_NAME}} - Product Requirements

## Goal

{{GOAL_DESCRIPTION}}

---

## Success Criteria

All workflows must pass with Playwright screenshot verification:

### Workflow 1: {{WORKFLOW_1_NAME}}
1. {{STEP_1}}
2. {{STEP_2}}
3. {{STEP_3}}

### Workflow 2: {{WORKFLOW_2_NAME}}
1. {{STEP_1}}
2. {{STEP_2}}
3. {{STEP_3}}

---

## Environment

| Resource | Value |
|----------|-------|
| Production Frontend | https://commentarygraphic.com |
| Production Frontend Server | 3.87.107.201 |
| Frontend Directory | /var/www/commentarygraphic |
| Coordinator API | https://api.commentarygraphic.com |
| Coordinator VM | 44.193.31.120 |
| Coordinator Port | 3003 |
| Firebase | production |

---

## Known Issues (Starting Point)

1. {{KNOWN_ISSUE_1}}
2. {{KNOWN_ISSUE_2}}

---

## Verification Method

Every task MUST be verified with:
1. `browser_navigate` to the relevant page
2. `browser_take_screenshot` to capture current state
3. `browser_console_messages` to check for JS errors
4. Screenshot saved to `screenshots/` with descriptive filename

If verification fails, the task fails and a NEW task must be created to address the specific issue found.
