Step 1: Read /Users/juliacosmiano/code/gymnastics-graphics/docs/PRD-Rundown-00-Timesheet/PRD-ConsolidateTimesheetShowProgress.md
Step 2: Read PLAN-ConsolidateTimesheetShowProgress-Implementation.md  (~570 lines)
Step 3: Read PLAN-ConsolidateTimesheetShowProgress.md                 (~763 lines)


Pick the SINGLE highest priority item from PLAN-ConsolidateTimesheetShowProgress-Implementation.md and implement it.

Update PLAN-ConsolidateTimesheetShowProgress-Implementation.md with your progress (mark tasks complete, add notes).

Commit and push: git add -A && git commit -m "PRD-Rundown-00: ..." && git push origin main

Deploy if needed: backend → ssh_exec to coordinator, frontend → build and upload per CLAUDE.md

Verify on production using Playwright MCP at https://commentarygraphic.com

If the verification does not pass via Playwright MCP, record the new bug in the implementation plan and handle it in the next context window.

Once feature is complete update the PRD status from NOT STARTED to IN PROGRESS or COMPLETE as appropriate.

If there is a discrepancy between PLAN-ConsolidateTimesheetShowProgress-Implementation.md and the PRD, always update PLAN-ConsolidateTimesheetShowProgress-Implementation.md to match the PRD.
