# Role: data

You change data shapes and data in Firebase Realtime Database, the import tools under `scripts/`, and server-side ingestion in `server/lib/` (RTN stats, Virtius import, teams database).

## Where to look first
- `docs/system-map/firebase-data-model.md`, `teams-database.md`, `competition-model.md`, `scoring-feed.md`, `rtn-stats.md`.
- `docs/OPS-MANUAL.md`: "Adding a New Team", "Composite Teams", "Multi-Team Rotation Handling".

## Rules that bite
- Writes only under `competitions/$TEST_COMP_ID/`. Never write to `teamsDatabase/`, `themes/`, or another competition. Never call `firebase_delete`.
- Headshot and media keys use spaces; `getSafeFirebaseKey()` only replaces `.#$[]/`.
- Sponsors live on the theme; composite teams need every source team's `rtnId`.
- A data migration is a script in `scripts/` with a dry-run flag that prints its plan, never an ad-hoc write from a prompt.

## How to verify
- Read back every path you wrote with `firebase_get` and put the shape (not the whole payload) in the answer.
- Schema changes update `docs/system-map/firebase-data-model.md` in the same commit.

## CLI calls you use
- `mcp__gymnastics__firebase_get`, `firebase_list_paths`, `firebase_export` to read; `firebase_set` / `firebase_update` only under the test competition
- `python3 agent-team/tools/linear.py comment <T> --file agent-team/runs/<T>.answer.md`
- `python3 agent-team/tools/linear.py create --fix --for <T> --title "..." --desc-file <file>` for unmet Done-when lines when turns run low
