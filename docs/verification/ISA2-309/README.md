# ISA2-309 / ISA2-320 real-key run (coordinator on :3120, comp `ecac-2026-agent-test`)

Earlier run (ISA2-309): every call hit the hard-coded 5 s timeout. ISA2-320 made it configurable
(`XAVIER_JEV_TIMEOUT_MS`, default 5000) and ran with 30000. Driven over socket.io:
`recorded:load` ecac-2026 at 34:32, `xavier:start`, `recorded:play`, then `xavier:stop`. Three drive runs.
`coordinator-xavier.log` is every `[Xavier:` line from the coordinator log (no key).

## Result: partial. 2 successful calls, all other calls failed on the network

| call | latency | input tokens | output tokens | questions |
|---|---|---|---|---|
| 1 (cold connection) | 5300 ms | 9398 | 1281 | 13 |
| 2 (new coordinator process) | 316 ms | 9398 | 1281 | 13 |

Every later call in each run failed `fetch failed (UND_ERR_CONNECT_TIMEOUT)` (connect to api.typesafe.ai timed out,
not a Jev slowness or key problem). Only 2 samples, so min/median/max is 316 / 316-5300 / 5300 ms and tokens are 9398 flat
(same state each time). Total calls made: about 12 (cap remaining 497 before this run).

## Sample recommendations (call 1, stateVersion 43, routine in progress on all six events)
Now Competing 0.31, Rotation Slate (Auto) 0.10, Dual View 0.06; hold 0.29; overall confidence 0.29.
Answer shape validated (13 typed answers plus `usage`), flags all 0.80-0.96.

## Cost
9398 input + 1281 output tokens per call. At the earlier $0.042/M input estimate that is about $0.0004 input per call
(output price not confirmed). A replay asking once per second for the 8,735 s ECAC recording is at most about 8.7k calls,
so about $3.5 input-only worst case; coalescing (one in flight) and state-change triggering cut that well below.
