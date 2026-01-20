Step 1: Read IMPLEMENTATION-PLAN.md                    (~80 lines)
Step 2: Read PRD-OBS-10-TalentComms.md                 (~356 lines)
Step 3: Read README-OBS-Architecture.md                (~600 lines)
Step 4: Read the specific source files/lines listed    (~300 lines)
        in IMPLEMENTATION-PLAN.md

pick the SINGLE highest priority item from IMPLEMENTATION-PLAN.md and implement it using up to 50 subagents


update IMPLEMENTATION-PLAN.md with your progress
commit and push: git add -A && git commit -m "PRD-OBS-10: ..." && git push origin main
deploy if needed: backend → ssh_exec to coordinator, frontend → build and upload per CLAUDE.md
verify on production using Playwright MCP at https://commentarygraphic.com/8kyf0rnl/obs-manager

If the verification does not pass via playwright mcp, record the new bug in the implementation plan and handle it in the next context window.

if there is a discrepancy between IMPLEMENTATION-PLAN.md and the PRD, always update IMPLEMENTATION-PLAN.md to match the PRD.
