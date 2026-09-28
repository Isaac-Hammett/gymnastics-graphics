# Role: frontend

You change the show controller: `show-controller/src/` (pages, components, hooks, lib, contexts). It is a Vite + React SPA. Build with `cd show-controller && npm run build`; lint with `npm run lint`.

## Where to look first
- `docs/system-map/surfaces.md` for the page you touch, then the engine entry the ticket's project names.
- The `Page:` label tells you the route: Producer View `/:compId/producer` · Talent View `/:compId/talent` · Rundown Editor `/:compId/rundown` · Checklist `/:compId/checklist` · Camera Setup `/:compId/camera-setup` · OBS Manager `/:compId/obs-manager` · Theme Editor `/theme-editor` · Graphics Tools `/graphics-manager`, `/url-generator`, `/media-manager` · VM Pool Admin `/_admin/vm-pool` · Home `/`.
- Patterns to copy: the state/actions hook split (`hooks/usePlayoutState.js` + `hooks/usePlayoutActions.js`), socket access through `CompetitionContext`, server URL only through `lib/serverUrl.js`.

## Rules that bite
- Never hardcode `api.commentarygraphic.com`. The SPA finds its coordinator through `VITE_API_URL` (`lib/serverUrl.js`); in runs it points at your worktree's coordinator.
- Browser Firebase reads use the client SDK; server-side state arrives over the socket. Do not add a second writer to a Firebase path another system owns (check the system-map entry).
- When a feature is off, Producer View must look and behave exactly as before. Several tickets carry that as a Done-when line; screenshot the off state too.

## How to verify
- `npm run build` must pass. Then screenshot the page in the app the runner started for you (Run facts); it serves your worktree and hot-reloads.
- Log in with `VERIFY_LOGIN_EMAIL` / `VERIFY_LOGIN_PASSWORD` from the environment (`$VERIFY_LOGIN_EMAIL` / `$VERIFY_LOGIN_PASSWORD`, already set in your shell; `agent-team/.env` is not readable from a run). Read them with `printenv VERIFY_LOGIN_EMAIL` / `printenv VERIFY_LOGIN_PASSWORD` and type them into the login form with the Playwright browser tools: that is their purpose, and it is allowed. It is a test account on the test competition. Never write them into answers, tickets, commits, screenshots' file names, or docs.. Use `TEST_COMP_ID` for any `/:compId/...` route.
- Read the screenshot back. Check the console. Save under `docs/verification/<TICKET>/` and commit it with the code.

## CLI calls you use
- `python3 agent-team/tools/linear.py comment <T> --file agent-team/runs/<T>.answer.md`
- `python3 agent-team/tools/linear.py create --fix --for <T> --title "..." --desc-file <file>` for unmet Done-when lines when turns run low
