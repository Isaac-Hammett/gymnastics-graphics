/**
 * Gymnastics sport pack: apparatus table, code defaults, vocabulary (ISA2-338).
 *
 * This directory is the only place in server/lib/shakespeare/ allowed to name
 * an apparatus. Everything above the pack works with opaque locus ids.
 * Virtius API names match show-controller/src/lib/eventConfig.js.
 */

export const LOCI = {
  FX: { id: 'FX', apiName: 'FLOOR', name: 'Floor Exercise', noun: 'floor', codes: ['men', 'women'] },
  PH: { id: 'PH', apiName: 'HORSE', name: 'Pommel Horse', noun: 'pommel horse', codes: ['men'] },
  SR: { id: 'SR', apiName: 'RINGS', name: 'Still Rings', noun: 'rings', codes: ['men'] },
  VT: { id: 'VT', apiName: 'VAULT', name: 'Vault', noun: 'vault', codes: ['men', 'women'] },
  PB: { id: 'PB', apiName: 'PBARS', name: 'Parallel Bars', noun: 'parallel bars', codes: ['men'] },
  HB: { id: 'HB', apiName: 'BAR', name: 'Horizontal Bar', noun: 'high bar', codes: ['men'] },
  UB: { id: 'UB', apiName: 'BARS', name: 'Uneven Bars', noun: 'bars', codes: ['women'] },
  BB: { id: 'BB', apiName: 'BEAM', name: 'Balance Beam', noun: 'beam', codes: ['women'] }
};

export const OLYMPIC_ORDER = {
  men: ['FX', 'PH', 'SR', 'VT', 'PB', 'HB'],
  women: ['VT', 'UB', 'BB', 'FX']
};

const BY_API_NAME = Object.fromEntries(Object.values(LOCI).map(l => [l.apiName, l.id]));

/** Virtius event_name (or a locus id) to locus id; null when unknown. */
export function locusFromApiName(name) {
  if (name == null) return null;
  const key = String(name).toUpperCase().trim();
  return BY_API_NAME[key] || (LOCI[key] ? key : null);
}

/**
 * Per-code defaults. Scores are in points. Women's has a 10.0 rule maximum;
 * men's difficulty is uncapped (FIG), so no `max`.
 * capFallback / floorFallback stand in for RTN season extremes on a locus when
 * an actor has no priors; they are starting points to tune against RTN data.
 */
export const CODE_DEFAULTS = {
  men: {
    lineupSize: 4,
    countingScores: 4,
    scoreScale: { min: 0 },
    capFallback: 15.0,
    floorFallback: 10.0,
    capMargin: 0.1,
    fallPenalty: 1.0,
    sd: 0.5
  },
  women: {
    lineupSize: 6,
    countingScores: 5,
    scoreScale: { min: 0, max: 10.0 },
    capFallback: 10.0,
    floorFallback: 9.0,
    capMargin: 0.05,
    fallPenalty: 0.5,
    sd: 0.2
  }
};

/** 'mens-6' / 'womens-dual' / 'men' / 'women' / Virtius meet.sex to 'men' | 'women'. */
export function codeFromString(s) {
  const v = String(s || '').toLowerCase();
  if (v.startsWith('women') || v.startsWith('female') || v === 'w') return 'women';
  if (v.startsWith('men') || v.startsWith('male') || v === 'm') return 'men';
  return null;
}

export const vocabulary = {
  loci: Object.fromEntries(Object.values(LOCI).map(l => [l.id, { name: l.name, short: l.id, noun: l.noun }])),
  locus: 'apparatus',
  loci_plural: 'apparatus',
  unit: 'routine',
  unitGroup: 'lineup',
  leadoff: 'leadoff',
  anchor: 'anchor',
  rotation: 'rotation',
  allAround: 'all-around',
  individual: 'individual',
  team: 'team',
  bye: 'bye'
};
