# Holinshed: dossier store, sources, exclusion rules

Holinshed is the research layer under Shakespeare (`design.md` section 6.13, which lives in the main checkout and is not yet committed): facts about people that are not numbers, each with a citation, never prose. Code: `server/lib/holinshed/types.js`. Tests: `server/__tests__/holinshedTypes.test.js`. Fixtures: `server/__tests__/fixtures/holinshed/`.

## Store

Top-level Firebase paths, beside `teamsDatabase`:

| Path | Holds |
|---|---|
| `dossiers/{actorId}` | a `Dossier`; `actorId` is a team key (`army`) or `ath:{nameKey}` (lowercase, spaces, like headshot keys) |
| `dossiers/_sources/{teamKey}` | the per-team source registry (below) |
| `dossiers/_cache/{urlHash}` | fetched page text, so a page is fetched once |
| `dossiers/_test/` | the only place agents write; production research runs are Isaac's or Claude's |

A `Dossier` has `facts[]`, `socials[]`, `sourceRegistry`, `updatedAt`. Each fact: `id`, `type` (accolade, bio, history, result, milestone, social, relation), one-sentence `text`, optional `date`, `source {url, title, fetchedAt, quote?}`, `confidence` 0 to 1, `polarity` (positive or neutral only), `extractedBy` (model or human), optional `verified {by, at}`. Validators: `validateDossier`, `validateFact`, `validateSocial`, `validateSourceRegistryEntry`, `validateTeamSource`; each returns a list of error strings, empty when valid.

## Source registry

`dossiers/_sources/{teamKey}` holds `{ teamKey, name, site, robotsTxt, urlStatus, registry }`. `registry` has `bioUrl` (roster page), `bioUrlPattern` (contains `{slug}`, the athlete's bio page), `recapArchiveUrl` (schedule and results page with the season selector, which reaches back about twenty years), and `notes`. `urlStatus` is `verified` once a person or the online test has confirmed the URLs, else `unverified`.

The six ECAC 2026 teams (Navy, William & Mary, Simpson, Army, Greenville, Springfield) are in `fixtures/holinshed/ecac-sources.json`.

**Status of those URLs: unverified.** ISA2-329 ran with the team athletics sites blocked by the sandbox, so the URLs follow the Sidearm Sports pattern (`/sports/mens-gymnastics/roster`, `/schedule`) and were not checked by hand. Hosts for Simpson and Greenville are guesses. Run `cd server && node --test __tests__/holinshedTypes.test.js` online: the live-URL test fetches every `bioUrl` and `recapArchiveUrl` and fails on any non-2xx. Fix the fixture, then set `urlStatus` to `verified`.

## Ingestion order

Team athletics sites (bios, recap archives), College Gym News and conference sites, USA Gymnastics and FIG, RTN for results history, public social profiles last (handle and platform only, no stored content, no private accounts, opt-out list honored). Priority: teams in the next competition, last three seasons, then deeper. Respect robots.txt, cache every page, fetch slowly.

## Exclusion rules

Excluded at extraction, not flagged: injuries, discipline, anything personal. A return from injury may enter as "back in the lineup". `EXCLUSION_PATTERNS` and `matchesExclusion` in `types.js` are a keyword backstop used by `validateFact`; the extractor (HL-02) applies the real rule. `polarity` is only `positive` or `neutral`. Private social accounts fail validation.
