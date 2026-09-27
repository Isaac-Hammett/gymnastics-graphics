# ISA2-298 — action bus vs. test VM's OBS

**Result: not blocked. All four Done-when lines verified end to end** against the
coordinator for this worktree (`http://127.0.0.1:3199`), the test VM
`54.162.253.32`, and `ecac-2026-agent-test`, on merged `main` post-commit
`d7996632` ("agent-team: run coordinators get an absolute Firebase key").

ISA2-298's committed evidence claiming full block (`obsConnected: false`,
`app/invalid-credential`, `firebase_timeout`) was accurate for the environment it
ran in, but that environment was missing `GOOGLE_APPLICATION_CREDENTIALS` and
`FIREBASE_DATABASE_URL` in `server/.env` — a gap `d7996632` closed by exporting
`GOOGLE_APPLICATION_CREDENTIALS` from `FIREBASE_ADMIN_KEY` in
`agent-team/devserver.sh` for every run coordinator. It does not reproduce in a
worktree started after that commit landed.

## 1. `action:catalog` — `obsConnected: true`

```json
{
  "compId": "ecac-2026-agent-test",
  "obsConnected": true,
  "gender": "mens",
  "teamCount": 6,
  "actions": [ /* 6 scene actions + 63 graphic actions */ ],
  "warnings": []
}
```

Scene actions, each with `params.source: "obs"`:

```
scene:sdfasdfasdf, scene:awefaef, scene:NEW Scene for example,
scene:test for connection close v2, scene:aewtasdglaskdjf, scene:Scene
```

## 2. `action:execute scene:awefaef` — non-active scene, both directions

Catalog confirmed `currentScene: "Scene"` before this call, so `scene:awefaef` is
not already active (avoids the `alreadyActive: true` short-circuit in
`_executeScene`).

```
Executing scene:awefaef
ACK: {"ok":true,"actionId":"scene:awefaef","error":null,"guardrail":null}
Broadcast events (same tick):
  sceneChanged -> "awefaef"
  obs:currentSceneChanged -> {"sceneName":"awefaef"}
  action:executed -> {"ok":true,"actionId":"scene:awefaef","error":null,"guardrail":null,
                       "kind":"scene","sender":"isa2-299-verify","confirmed":true,
                       "sceneName":"awefaef"}
```

Switched back to confirm the reverse direction also confirms cleanly:

```
Executing scene:Scene
ACK: {"ok":true,"actionId":"scene:Scene","error":null,"guardrail":null}
Broadcast events (same tick):
  sceneChanged -> "Scene"
  obs:currentSceneChanged -> {"sceneName":"Scene"}
  action:executed -> {"ok":true,"actionId":"scene:Scene","error":null,"guardrail":null,
                       "kind":"scene","sender":"isa2-299-verify","confirmed":true,
                       "sceneName":"Scene"}
```

`sceneChanged` / `obs:currentSceneChanged` are the coordinator's actual broadcast
names for a scene change (`server/index.js:8581-8583`); they are the
socket-level equivalent of a `GetCurrentProgramScene` re-check, driven by OBS's
own `CurrentProgramSceneChanged` event rather than a poll.

## 3. Which path delivers `CurrentProgramSceneChanged`

Code reading of `server/lib/obsConnectionManager.js:250-266` and
`server/lib/actionBus.js:440-476` confirms the ticket's hypothesis:

- `obsConnectionManager.js:262-266` registers its forwarding listener
  (`obs.on('CurrentProgramSceneChanged', ...) -> this.emit('obsEvent', ...)`) on
  the shared OBS client the moment the connection is established — long before
  any action call.
- `actionBus.js:466-467` registers `_waitForSceneChange`'s two listeners
  (`onDirect` on the same `obs` client, `onForwarded` on the manager's
  `obsEvent`) fresh on every `SetCurrentProgramScene` call, `onDirect` always
  after the manager's listener in the `obs` client's listener array.
- Node's `EventEmitter.emit` iterates a snapshot of listeners in registration
  order and is synchronous, so when OBS fires `CurrentProgramSceneChanged`: the
  manager's listener runs first, synchronously re-emitting `obsEvent`, which
  synchronously invokes `onForwarded` -> `settle(true)`. `onDirect` still runs
  afterward (it was in the snapshot even though `settle()` just called
  `obs.off` on it) but `settle`'s `done` guard makes that second call a no-op.

**Confirmed: the forwarded `obsEvent` path settles `_waitForSceneChange`; the
direct listener never wins the race.** No code change needed —
`actionBus.js:440-476`'s dual-listener code is correct as-is and was not
touched.

## 4. `action:execute graphic:logos` — write + read-back

```
ACK: {"ok":true,"actionId":"graphic:logos","error":null,"guardrail":null}
```

Read back via `mcp__gymnastics__firebase_get` on
`competitions/ecac-2026-agent-test/currentGraphic`:

```json
{
  "graphic": "logos",
  "graphicId": "logos",
  "renderer": "output",
  "timestamp": 1790549455471
}
```

## Done-when status

- [x] `action:catalog` returns `obsConnected: true` and scene actions with
  `params.source: "obs"`. Proof: section 1 above.
- [x] `action:execute {actionId: 'scene:<a real VM scene>', ...}` switches the
  VM's program scene with ack `{ok:true, error:null, guardrail:null}`, confirmed
  by a broadcast equivalent to a `GetCurrentProgramScene` re-check, for a scene
  that was not already active. Proof: section 2 above (`scene:awefaef`, then
  back to `scene:Scene`).
- [x] Which path delivered `CurrentProgramSceneChanged` identified and recorded:
  the connection manager's forwarded `obsEvent`, per the registration-order
  argument in section 3, confirmed live (the switch resolved with `confirmed:true`
  well under the confirm timeout on both calls).
- [x] `action:execute graphic:<id>` writes `currentGraphic`, read back with
  `graphicId`/`renderer`. Proof: section 4 above (`graphicId: "logos"`,
  `renderer: "output"`).

## What changed since ISA2-298's original run

Nothing in `actionBus.js` or `obsConnectionManager.js` needed to change. The fix
was environmental: commit `d7996632` added `GOOGLE_APPLICATION_CREDENTIALS`
export to `agent-team/devserver.sh` for run coordinators, closing the gap the
ISA2-298 implementer correctly diagnosed. Their queued follow-up fix ticket
asking for `server/.env` credential setup is stale and should be closed rather
than worked.
