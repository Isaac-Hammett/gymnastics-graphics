
You can use up to 50 subagents to read these documents
Step 1: Read README-OBS-Architecture.md                (~600 lines)
Step 2: Read /Users/juliacosmiano/code/gymnastics-graphics/docs/PRD-OBS-04-AudioManagement/IMPLEMENTATION-PLAN.md                  (~150 lines)
Step 3: Read /Users/juliacosmiano/code/gymnastics-graphics/docs/PRD-OBS-04-AudioManagement/PRD-OBS-04-AudioManagement.md


Pick the SINGLE highest priority item from IMPLEMENTATION-PLAN.md and implement it.

Update IMPLEMENTATION-PLAN.md with your progress.
Commit and push: git add -A && git commit -m "PRD-OBS-08.1: ..." && git push origin main
Deploy if needed: backend → ssh_exec to coordinator, frontend → build and upload per CLAUDE.md
Verify on production using Playwright MCP at https://commentarygraphic.com/8kyf0rnl/obs-manager

If the verification does not pass via Playwright MCP, record the new bug in the implementation plan and handle it in the next context window.

If there is a discrepancy between IMPLEMENTATION-PLAN.md and the PRD, always update IMPLEMENTATION-PLAN.md to match the PRD.
