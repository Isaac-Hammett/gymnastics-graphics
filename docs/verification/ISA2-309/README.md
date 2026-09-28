# ISA2-309 real-key run: FAILED (Jev timed out)

Driven through the coordinator on :3109 (test comp `ecac-2026-agent-test`): `recorded:load` ecac-2026 at 34:32,
`xavier:start`, `recorded:play`, two runs of 20 s and 30 s, then `xavier:stop` / `recorded:pause`.
`coordinator-xavier.log` is every `[Xavier:` line (no key). Every call hit the provider's 5 s timeout
(`Jev request failed: This operation was aborted`); zero recommendations, zero usage fields.

Calls caused: 3 (one per logged failure); cap was 500. Offline request size from
`recordings/ecac-2026/virtius-final.json` via `buildRequest`: 17,585 bytes, 13 questions, roughly 5,000 input tokens
(estimate, not API-measured) = about $0.0002 per call at $0.042 per million.
