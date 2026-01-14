@plan.md @activity.md

We are extending the gymnastics-graphics show controller with camera management and timesheet-driven automation.

First read activity.md to see what was recently accomplished.

Start the dev server if needed:
- For server: `cd server && npm run dev`
- For show-controller: `cd show-controller && npm run dev`

Open plan.md and choose the single highest priority task where passes is false.

Work on exactly ONE task: implement the change.

After implementing:
1. Run any relevant tests or verify the code compiles
2. If UI changes, use Playwright to:
   - Navigate to http://localhost:5173
   - Take a screenshot using browser_take_screenshot with filename parameter set to "screenshots/[task-name].png"
   - Example: filename: "screenshots/P2-01-camera-panel.png"

Append a dated progress entry to activity.md describing what you changed and the screenshot filename (if applicable).

Update that task's passes in plan.md from false to true.

Make one git commit for that task only with a clear message.

Do not git init, do not change remotes, do not push.

ONLY WORK ON A SINGLE TASK.

When ALL tasks have passes true, output <promise>COMPLETE</promise>
