# Claude Code Memory - Gymnastics Graphics

## Git Workflow - IMPORTANT

**Always work on `dev` branch** - Push to `dev` for development work. Only merge to `main` when ready for production deployment.

- `dev` branch: Active development (push freely)
- `main` branch: Production only (triggers Netlify deploy, costs 15 credits each)

To deploy to production: `git checkout main && git merge dev && git push && git checkout dev`

## Competition Formats

### Alternating Format (Default for Dual Meets - used in "By Rotation" view)
Teams start on adjacent apparatus and swap each rotation:
- R1: Home=FX, Away=PH | R2: Home=PH, Away=FX
- R3: Home=SR, Away=VT | R4: Home=VT, Away=SR
- R5: Home=PB, Away=HB | R6: Home=HB, Away=PB

### Head-to-Head Format (used in "By Apparatus" view)
Both teams compete on the SAME apparatus - used when viewing event summary by apparatus (FX, PH, SR, VT, PB, HB buttons).

## Olympic Order

### Men's Gymnastics (6 events)
1. Floor Exercise (FX)
2. Pommel Horse (PH)
3. Still Rings (SR)
4. Vault (VT)
5. Parallel Bars (PB)
6. High Bar (HB)

### Women's Gymnastics (4 events)
1. Vault (VT)
2. Uneven Bars (UB)
3. Balance Beam (BB)
4. Floor Exercise (FX)

## API Event Names (Virtius)
- Men's: FLOOR, HORSE, RINGS, VAULT, PBARS, BAR
- Short codes: FX, PH, SR, VT, PB, HB

## Competition Types
- mens-dual, womens-dual (2 teams) - defaults to head-to-head format
- mens-tri, womens-tri (3 teams)
- mens-quad, womens-quad (4 teams)
- mens-5, mens-6 (5-6 teams)
