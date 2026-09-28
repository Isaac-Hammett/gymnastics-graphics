# ISA2-339 ECAC 2026 RTN Priors Coverage Report

Date: 2026-09-28 | Status: AUDIT COMPLETE

## Overall Coverage Summary

- **Total ECAC Athletes in Virtius**: 70
- **Headshots Matched**: 60/70 (85%)
- **RTN 2026 Priors Available**: 70/70 (100%)

**Status**: ✅ ALL TEAMS HAVE COMPLETE RTN 2026 PRIORS

---

## Army (army-mens)

**Virtius Athletes**: 11

**RTN Priors**: ✅ All 11 athletes have RTN 2026 stats (averages, highs, lineup)

**Headshots Status**: ⚠️ 10/11 matched

**Missing Headshots (1):**
- Jaden Blank (id: 8228, normalized: 'jaden blank')
  - RTN ID exists: 8228 ✅
  - AA 2026 average: 75.283 (all-around composite athlete)

---

## Navy (navy-mens)

**Virtius Athletes**: 12

**RTN Priors**: ✅ All 12 athletes have RTN 2026 stats

**Headshots Status**: ⚠️ 10/12 matched

**Missing Headshots (2):**
- Aaron Stein (id: 7987, normalized: 'aaron stein')
  - RTN ID exists: 7987 ✅
  - Events: SR (12.629 avg), VT (12.913 avg)
- Jonah Soltz (id: 8425, normalized: 'jonah soltz')
  - RTN ID exists: 8425 ✅
  - AA 2026 average: 76.317 (all-around composite athlete)

---

## William & Mary (william-mary-mens)

**Virtius Athletes**: 11

**RTN Priors**: ✅ All 11 athletes have RTN 2026 stats

**Headshots Status**: ⚠️ 10/11 matched

**Missing Headshots (1):**
- Gavin Zborowski (id: 8107, normalized: 'gavin zborowsk' — note: normalization truncates to 'zborowsk')
  - RTN ID exists: 8107 ✅
  - Events: HB (12.17 avg), PH (12.817 avg), SR (12.319 avg)
  - Note: Normalization issue with this name may cause matching failures

---

## Greenville (greenville-mens)

**Virtius Athletes**: 12

**RTN Priors**: ✅ All 12 athletes have RTN 2026 stats

**Headshots Status**: ⚠️ 10/12 matched

**Missing Headshots (2):**
- Jacob Foster (id: 7979, normalized: 'jacob foster')
  - RTN ID exists: 7979 ✅
  - Events: HB (12.5 avg), PH (12.486 avg)
- Sergey Popov (id: 8211, normalized: 'sergey popo' — note: normalization truncates to 'popo')
  - RTN ID exists: 8211 ✅
  - Events: PB (12.85 avg), SR (13.006 avg)
  - Note: Name normalization issue causes 'popov' → 'popo'

---

## Springfield (springfield-mens)

**Virtius Athletes**: 12

**RTN Priors**: ✅ All 12 athletes have RTN 2026 stats

**Headshots Status**: ⚠️ 11/12 matched

**Missing Headshots (1):**
- Carl Jacob Soederqvist (id: 8449, normalized: 'carl jacob soederqvist')
  - RTN ID exists: 8449 ✅
  - AA 2026 average: 72.35 (all-around composite athlete)

---

## Simpson (simpson-mens)

**Virtius Athletes**: 12

**RTN Priors**: ✅ All 12 athletes have RTN 2026 stats

**Headshots Status**: ⚠️ 9/12 matched

**Missing Headshots (3):**
- Alex Campbell (id: 8297, normalized: 'alex campbell')
  - RTN ID exists: 8297 ✅
  - Events: FX (11.75 avg), PB (11.979 avg), SR (12.75 avg), VT (12.5 avg)
- Brian Rollison (id: 8092, normalized: 'brian rollison')
  - RTN ID exists: 8092 ✅
  - Events: HB (11.625 avg), SR (13.417 avg)
- Kenny Rabe (id: 8500, normalized: 'kenny rabe')
  - RTN ID exists: 8500 ✅
  - Events: FX (12.85 avg), PB (12.42 avg)

---

## Summary of Findings

### RTN 2026 Priors Coverage
**Status**: ✅ COMPLETE

All 70 ECAC athletes have RTN 2026 priors stored in teamsDatabase/stats/{team}/individualAverages and individualHighs:
- Army: 14 athlete records in stats
- Navy: 19 athlete records in stats
- Greenville: 22 athlete records in stats
- Simpson: 21 athlete records in stats
- William & Mary: 18 athlete records in stats
- Springfield: 16 athlete records in stats

### Headshot Coverage
**Status**: ⚠️ PARTIAL (85%)

10 athletes missing headshots across 6 teams. Missing headshots are:
1. Jaden Blank (Army) — AA composite, key lineup athlete
2. Aaron Stein (Navy)
3. Jonah Soltz (Navy) — AA composite, key lineup athlete
4. Gavin Zborowski (William & Mary) — name normalization issue
5. Jacob Foster (Greenville)
6. Sergey Popov (Greenville) — name normalization issue ('popov' → 'popo')
7. Carl Jacob Soederqvist (Springfield) — AA composite
8. Alex Campbell (Simpson)
9. Brian Rollison (Simpson)
10. Kenny Rabe (Simpson)

### Name Normalization Issues
Two athletes have normalization issues that may cause headshot lookup failures:
- **Gavin Zborowski**: Normalizes to 'gavin zborowsk' (truncation)
- **Sergey Popov**: Normalizes to 'sergey popo' (last character loss in v→o)

These names should be verified in the headshots database to ensure proper lookup during athlete binding.

### Ingestion Status
No ingestion commands needed — all RTN stats are present for all teams as of 2026-09-28.
