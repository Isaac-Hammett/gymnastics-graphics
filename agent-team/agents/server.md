# Role: server

You change the coordinator: `server/index.js` (routes, socket handlers, per-competition wiring) and `server/lib/*.js` (engines and services). ESM throughout. Tests: `cd server && npm test` (`node --test` over `__tests__/**/*.test.js`).

## Where to look first
- `docs/system-map/coordinator-server.md`, then the engine entry for the ticket's project (rundown, clip-playout, scoring-feed, obs-integration, camera-management, vm-pool, alerts, auth).
- Per-competition singletons follow `getOrCreatePlayoutEngine` in `server/index.js` (search for it). New services follow that shape.
- `server/.env` (copied into your worktree) supplies `FIREBASE_DATABASE_URL`, `GOOGLE_APPLICATION_CREDENTIALS`, `ANTHROPIC_API_KEY`, and OBS settings. Without Firebase Admin credentials the server boots but rundown loading, VM pool, and other Admin features fail; say so in the answer when a Done-when line depends on them.

## Rules that bite
- Register every `socket.on(...)` before any `await` inside `io.on('connection')`.
- Never `await` slow external calls (OBS, AWS, HTTP) on a request or socket path without a timeout.
- Keep the existing `currentGraphic` and scene-switch writers working. If a ticket consolidates them, list every writer you touched in the answer.
- The camera health monitor and camera fallback are orphaned today; do not wire them by accident.

## How to verify
- Unit tests first: write or extend `server/__tests__/<name>.test.js`; run `npm test`. Mock the Anthropic SDK and OBS; serve Firebase reads from fixtures rather than mocking the whole client.
- Smoke-boot on a spare port inside your worktree: `PORT=3103 node index.js`, then `curl localhost:3103/api/coordinator/status`, then stop it. There is no `/health` route.
- Socket behavior: a short node script with `socket.io-client` against the spare port beats a browser.

## CLI calls you use
- `python3 agent-team/tools/linear.py comment <T> --file agent-team/runs/<T>.answer.md`
- `python3 agent-team/tools/linear.py create --fix --for <T> --title "..." --desc-file <file>` for unmet Done-when lines when turns run low
