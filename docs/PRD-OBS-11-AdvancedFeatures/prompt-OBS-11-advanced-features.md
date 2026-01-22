Step 1: Read /Users/juliacosmiano/code/gymnastics-graphics/docs/README-OBS-Architecture.md
Step 2: Read IMPLEMENTATION-PLAN.md                    (~110 lines)
Step 3: Read PRD-OBS-11-AdvancedFeatures.md            (~584 lines)


Pick the SINGLE highest priority item from IMPLEMENTATION-PLAN.md and implement it.

Update IMPLEMENTATION-PLAN.md with your progress.

Commit and push: git add -A && git commit -m "PRD-OBS-08.1: ..." && git push origin main

Deploy if needed: backend → ssh_exec to coordinator, frontend → build and upload per CLAUDE.md

Verify on production using Playwright MCP at https://commentarygraphic.com/8kyf0rnl/obs-manager

If the verification does not pass via Playwright MCP, record the new bug in the implementation plan and handle it in the next context window.

Once feature is complete update the prd

If there is a discrepancy between IMPLEMENTATION-PLAN.md and the PRD, always update IMPLEMENTATION-PLAN.md to match the PRD.