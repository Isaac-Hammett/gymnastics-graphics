# ISA2-323 evidence: Xavier Auto with Jev over recorded ECAC

Run: `cd server && node ../docs/verification/ISA2-323/live-check.cjs 3123 2072000 420 240` (recorded:load at 34:32, play, Auto, manual cut at +240 s; no xavier:inject).
Coordinator env: XAVIER_JEV_TIMEOUT_MS=30000, XAVIER_JEV_CALL_CAP=450 (new hard cap in JevProvider).

- Playback: recorded:load/play worked on the test VM (OBS cursor drift 162-200 ms).
- Jev: 1 successful call per coordinator start (4.4 s cold, inputTokens 9633, output ~1420), then every call fails `fetch failed (UND_ERR_CONNECT_TIMEOUT)` (same as ISA2-309/320). The provider now retries connect timeouts 3 times, which did not help.
- The one real recommendation set (Cam PH 28%, Rotation Slate 7%, Now Competing 6%) shows in Producer View: producer-view-jev-unreachable.png (also shows "Jev is unreachable").
- Nothing reached the 0.8 / 0.92 thresholds, so no xavier-auto action and no decision record came from Jev in this run.
- Manual cut at +240 s: ok, cooldown started (cooldownUntil in live-check-output.json), no pending action to cancel.
- Jev HTTP attempts used: about 130-150 of 450 (counter resets on each coordinator restart; the log line `jevCalls=` shows the count at the last success, 1). Budget for the rest of the ticket's 500 total is untouched.
