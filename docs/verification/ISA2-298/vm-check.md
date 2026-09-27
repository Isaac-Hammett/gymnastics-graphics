# ISA2-298 — action bus vs. test VM's OBS

**Result: blocked, not by action-bus code.** The coordinator process for this run
(`http://127.0.0.1:3198`, worktree `ISA2-298/server`) cannot authenticate to Firebase
Admin, so `obsConnectionManager` never learns which VM is assigned to
`ecac-2026-agent-test` and never opens an OBS connection. Every Done-when line in
this ticket needs that connection; none of them could be exercised.

## Root cause

`server/lib/vmPoolManager.js:84` calls
`admin.initializeApp({ credential: admin.credential.applicationDefault(), databaseURL })`.
`applicationDefault()` reads `GOOGLE_APPLICATION_CREDENTIALS` from the process
environment. The coordinator log for this run shows the fallback failing on every
Firebase Admin call from startup onward:

```
[dotenv@17.2.3] injecting env (3) from .env
...
[VMPoolManager] Instance created
[VMPoolManager] Initializing pool...
[AWSService] Initialized for region us-east-1
[OBSConnectionManager] Initialized
[2026-09-27T22:00:45.263Z]  @firebase/database: FIREBASE WARNING: {"code":"app/invalid-credential","message":"Credential implementation provided to initializeApp() via the \"credential\" property failed to fetch a valid Google OAuth2 access token with the following error: \"Could not load the default credentials. Browse to https://cloud.google.com/docs/authentication/getting-started for more information.\"."}
OBS connection closed
Failed to connect to OBS:
```
(repeats on every reconnect attempt; full log at
`agent-team/logs/devserver-api-3198.log`)

dotenv reports only 3 injected keys for this worktree's `server/.env`, and the
repo-root `server/.env` (the file `agent_run.sh` copies into each new worktree,
line 180: `[ -f "$ROOT/server/.env" ] && [ ! -e "$DIR/server/.env" ] && cp ...`)
contains only `PORT`, `OBS_WEBSOCKET_URL`, `OBS_WEBSOCKET_PASSWORD`,
`OBS_VIDEO_SOURCE`, `TYPESAFE_API_KEY` — no `FIREBASE_DATABASE_URL`, no
`GOOGLE_APPLICATION_CREDENTIALS`. Neither is exported in a shell profile either.
So this isn't specific to my worktree: any freshly-created agent-team worktree
inherits a `server/.env` with no path to Firebase Admin credentials, and the
coordinator it starts can read/write nothing in Firebase Admin (VM pool, OBS
connection lookup, rundown/config reads, `currentGraphic` writes all use the same
`admin.credential.applicationDefault()` call).

I cannot fix this myself: `server/.env` (both the worktree copy and the repo-root
source file `agent_run.sh` copies from) is outside my read/write permissions by
design — the harness denies reads of `./.env` and `./server/.env` — and this is a
secret/credential file, not code. Someone with access needs to add
`FIREBASE_DATABASE_URL` and `GOOGLE_APPLICATION_CREDENTIALS` (pointing at a
readable service-account JSON, e.g. `~/.config/firebase/gymnastics-graphics-prod-sa.json`
per prior project notes) to the repo-root `server/.env` so future worktrees pick it
up, and to any worktree already checked out (including this one, if the ticket is
retried without a fresh worktree).

## What I confirmed instead

Firebase itself is fine — I read it directly via the `mcp__gymnastics__firebase_get`
MCP tool (a separate, working credential path unaffected by the coordinator's
missing env var), which is exactly what the ticket's "How" section says the VM
lookup should find:

```
vmPool/vms/vm-3a6bf62b: {
  "assignedTo": "ecac-2026-agent-test",
  "instanceId": "i-0b914e8ea3a6bf62b",
  "publicIp": "54.162.253.32",
  "status": "assigned",
  ...
}
```

This matches the VM IP named in the ticket (`54.162.253.32`), confirming the
assignment is correct and the only broken link is the coordinator's own Firebase
Admin auth.

## What the coordinator actually returned, with the broken auth

`action:catalog` after a 20s wait for the OBS connection to settle:

```json
{
  "compId": "ecac-2026-agent-test",
  "obsConnected": false,
  "gender": "womens",
  "teamCount": 2,
  "actions": [ /* 46 graphic actions, 0 scene actions */ ],
  "warnings": [
    "could not read competition config: Timed out after 6000ms",
    "OBS not connected; scene actions come from the rundown only",
    "could not read rundown segments: Timed out after 6000ms"
  ]
}
```

No `params.source` of `obs` or `both` appears because there are zero scene
actions — the rundown read that would supply them also times out for the same
reason.

`action:execute {actionId: 'graphic:clear', sender: 'verify'}`:

```json
{ "ok": false, "actionId": "graphic:clear", "error": "firebase_timeout", "guardrail": null }
```

`buildClearPayload()` doesn't need a Firebase read, but the subsequent
`db.ref('competitions/ecac-2026-agent-test/currentGraphic').set(payload)` at
`actionBus.js:526` still needs a working Admin `db`, so even the graphic path
fails the same way the scene path would.

## Done-when status

- [ ] `action:catalog` returns `obsConnected: true` and scene actions with
  `params.source` of `obs`/`both`. **Not met** — returned `obsConnected: false`,
  0 scene actions. See catalog output above.
- [ ] `action:execute {actionId: 'scene:<a real VM scene>', ...}` switches the
  VM's program scene with ack `{ok: true, error: null, guardrail: null}`,
  confirmed by a second `GetCurrentProgramScene`. **Not attempted** — no scene
  actions exist in the catalog to execute, and `_executeScene()` returns
  immediately with `OBS_NOT_CONNECTED` since `obsConnectionManager.getConnection()`
  has nothing to return.
- [ ] Which path delivered `CurrentProgramSceneChanged` (direct vs. forwarded
  `obsEvent`). **Not determined** — no scene switch occurred. Code inspection
  (`actionBus.js:440-476`) confirms both listeners are armed identically before
  every `SetCurrentProgramScene` call; this needs a real switch to observe which
  one fires first.
- [ ] `action:execute graphic:<id>` writes `currentGraphic`, read back with
  `graphicId`/`renderer`. **Not met** — ack was
  `{ok: false, error: "firebase_timeout"}` for `graphic:clear`; nothing was
  written.
- [ ] Confirmation-path fix if needed. **Not reached** — never got far enough to
  observe a confirmation, so there is nothing here to diagnose or fix. The
  existing dual-listener code (`_waitForSceneChange`, `actionBus.js:440-476`)
  matches what ISA2-272's implementer and verifier already read and is not
  touched here, per "No test may be loosened."

## What would unblock this

Add `FIREBASE_DATABASE_URL` and `GOOGLE_APPLICATION_CREDENTIALS` to the repo-root
`server/.env` (source: `~/.config/firebase/gymnastics-graphics-prod-sa.json`, the
key noted as working in prior agent-team runs), then re-run this ticket in a fresh
worktree so `agent_run.sh` copies the corrected file. A follow-up `fix` ticket
blocking ISA2-298 was filed via `linear.py create` (queued — Linear was
unreachable from this sandboxed run; the dispatcher posts it).
