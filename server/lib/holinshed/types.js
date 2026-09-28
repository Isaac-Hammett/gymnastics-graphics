/**
 * Holinshed dossier contract (design.md section 6.13).
 *
 * Firebase paths (top level, beside teamsDatabase):
 *   dossiers/{actorId}            Dossier
 *   dossiers/_sources/{teamKey}   SourceRegistryEntry
 *   dossiers/_cache/{urlHash}     fetched page text
 * Agents build and test under dossiers/_test/ and fixtures only.
 */

export const FACT_TYPES = ['accolade', 'bio', 'history', 'result', 'milestone', 'social', 'relation'];
export const POLARITIES = ['positive', 'neutral'];
export const EXTRACTORS = ['model', 'human'];

// Sensitive material is excluded at extraction. This is the shared screen
// used by validateFact as a backstop and by the research pipeline (HL-02).
export const EXCLUSION_PATTERNS = [
  /\binjur(y|ed|ies)\b/i,
  /\btorn\b|\bfractur|\bsurgery\b|\brehab(ilitation)?\b|\bconcussion\b/i,
  /\bsuspend(ed|sion)\b|\bdisciplin|\barrest|\bdismiss(ed|al)\b|\bviolation\b|\bmisconduct\b/i,
  /\bdivorce|\bpregnan|\bdiagnos|\bmental health\b|\bdeath of\b|\bpassed away\b/i,
];

const ACTOR_ID_RE = /^(ath:[a-z0-9][a-z0-9 .'&-]*|[a-z0-9][a-z0-9-]*)$/;
const TEAM_KEY_RE = /^[a-z0-9][a-z0-9-]*$/;

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isStr = (v) => typeof v === 'string' && v.trim().length > 0;

export function isHttpUrl(v) {
  if (!isStr(v)) return false;
  try {
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function isIsoLike(v) {
  return isStr(v) && !Number.isNaN(Date.parse(v));
}

export function matchesExclusion(text) {
  return typeof text === 'string' && EXCLUSION_PATTERNS.some((re) => re.test(text));
}

/** @returns {string[]} error messages, empty when valid */
export function validateFact(f, path = 'fact') {
  const e = [];
  if (!isObj(f)) return [`${path}: must be an object`];
  if (!isStr(f.id)) e.push(`${path}.id: required string`);
  if (!FACT_TYPES.includes(f.type)) e.push(`${path}.type: must be one of ${FACT_TYPES.join('|')}`);
  if (!isStr(f.text)) e.push(`${path}.text: required string`);
  else if (matchesExclusion(f.text)) e.push(`${path}.text: matches an exclusion rule (injury, discipline, personal)`);
  if (f.date !== undefined && !isStr(f.date)) e.push(`${path}.date: must be a string`);
  if (!isObj(f.source)) e.push(`${path}.source: required object`);
  else {
    if (!isHttpUrl(f.source.url)) e.push(`${path}.source.url: required http(s) URL`);
    if (!isStr(f.source.title)) e.push(`${path}.source.title: required string`);
    if (!isIsoLike(f.source.fetchedAt)) e.push(`${path}.source.fetchedAt: required ISO date string`);
    if (f.source.quote !== undefined && !isStr(f.source.quote)) e.push(`${path}.source.quote: must be a string`);
  }
  if (typeof f.confidence !== 'number' || !(f.confidence >= 0 && f.confidence <= 1)) {
    e.push(`${path}.confidence: number between 0 and 1`);
  }
  if (!POLARITIES.includes(f.polarity)) e.push(`${path}.polarity: must be one of ${POLARITIES.join('|')}`);
  if (!EXTRACTORS.includes(f.extractedBy)) e.push(`${path}.extractedBy: must be one of ${EXTRACTORS.join('|')}`);
  if (f.verified !== undefined) {
    if (!isObj(f.verified) || !isStr(f.verified.by) || typeof f.verified.at !== 'number') {
      e.push(`${path}.verified: must be { by: string, at: number }`);
    }
  }
  return e;
}

export function validateSocial(s, path = 'social') {
  const e = [];
  if (!isObj(s)) return [`${path}: must be an object`];
  if (!isStr(s.platform)) e.push(`${path}.platform: required string`);
  if (!isStr(s.handle)) e.push(`${path}.handle: required string`);
  if (!isHttpUrl(s.url)) e.push(`${path}.url: required http(s) URL`);
  if (typeof s.public !== 'boolean') e.push(`${path}.public: required boolean`);
  else if (s.public === false) e.push(`${path}.public: private accounts are never stored`);
  if (!isIsoLike(s.lastChecked)) e.push(`${path}.lastChecked: required ISO date string`);
  if (s.optOut !== undefined && typeof s.optOut !== 'boolean') e.push(`${path}.optOut: must be a boolean`);
  return e;
}

/**
 * Source registry entry, stored at dossiers/_sources/{teamKey}.
 * bioUrlPattern holds `{slug}` where the athlete's slug goes; rosterUrl lists
 * the athletes so a crawler can discover the slugs.
 */
export function validateSourceRegistryEntry(r, path = 'registry') {
  const e = [];
  if (!isObj(r)) return [`${path}: must be an object`];
  if (r.bioUrl !== undefined && !isHttpUrl(r.bioUrl)) e.push(`${path}.bioUrl: must be an http(s) URL`);
  if (r.bioUrlPattern !== undefined) {
    if (!isHttpUrl(r.bioUrlPattern) || !r.bioUrlPattern.includes('{slug}')) {
      e.push(`${path}.bioUrlPattern: http(s) URL containing {slug}`);
    }
  }
  if (r.recapArchiveUrl !== undefined && !isHttpUrl(r.recapArchiveUrl)) {
    e.push(`${path}.recapArchiveUrl: must be an http(s) URL`);
  }
  if (r.notes !== undefined && typeof r.notes !== 'string') e.push(`${path}.notes: must be a string`);
  if (!r.bioUrl && !r.bioUrlPattern && !r.recapArchiveUrl) {
    e.push(`${path}: needs at least one of bioUrl, bioUrlPattern, recapArchiveUrl`);
  }
  return e;
}

/** Registry as stored: one entry per team plus identifying fields. */
export function validateTeamSource(s, path = 'source') {
  const e = [];
  if (!isObj(s)) return [`${path}: must be an object`];
  if (!isStr(s.teamKey) || !TEAM_KEY_RE.test(s.teamKey)) e.push(`${path}.teamKey: lowercase-hyphen key`);
  if (!isStr(s.name)) e.push(`${path}.name: required string`);
  if (!isStr(s.site)) e.push(`${path}.site: required host`);
  if (s.robotsTxt !== undefined && !isHttpUrl(s.robotsTxt)) e.push(`${path}.robotsTxt: must be an http(s) URL`);
  if (!['verified', 'unverified'].includes(s.urlStatus)) e.push(`${path}.urlStatus: verified|unverified`);
  e.push(...validateSourceRegistryEntry(s.registry, `${path}.registry`));
  return e;
}

export function validateDossier(d, path = 'dossier') {
  const e = [];
  if (!isObj(d)) return [`${path}: must be an object`];
  if (!isStr(d.actorId) || !ACTOR_ID_RE.test(d.actorId)) e.push(`${path}.actorId: team key or 'ath:{nameKey}'`);
  if (!Array.isArray(d.facts)) e.push(`${path}.facts: must be an array`);
  else {
    const seen = new Set();
    d.facts.forEach((f, i) => {
      e.push(...validateFact(f, `${path}.facts[${i}]`));
      if (isObj(f) && isStr(f.id)) {
        if (seen.has(f.id)) e.push(`${path}.facts[${i}].id: duplicate id ${f.id}`);
        seen.add(f.id);
      }
    });
  }
  if (!Array.isArray(d.socials)) e.push(`${path}.socials: must be an array`);
  else d.socials.forEach((s, i) => e.push(...validateSocial(s, `${path}.socials[${i}]`)));
  if (d.sourceRegistry === undefined) e.push(`${path}.sourceRegistry: required object`);
  else if (!isObj(d.sourceRegistry)) e.push(`${path}.sourceRegistry: must be an object`);
  else {
    const r = d.sourceRegistry;
    if (r.bioUrl !== undefined && !isHttpUrl(r.bioUrl)) e.push(`${path}.sourceRegistry.bioUrl: must be an http(s) URL`);
    if (r.recapArchiveUrl !== undefined && !isHttpUrl(r.recapArchiveUrl)) {
      e.push(`${path}.sourceRegistry.recapArchiveUrl: must be an http(s) URL`);
    }
    if (r.notes !== undefined && typeof r.notes !== 'string') e.push(`${path}.sourceRegistry.notes: must be a string`);
  }
  if (!isIsoLike(d.updatedAt)) e.push(`${path}.updatedAt: required ISO date string`);
  return e;
}

/** Throws with every message joined when invalid. */
export function assertValid(errors, label = 'holinshed') {
  if (errors.length) throw new Error(`${label}: ${errors.join('; ')}`);
}
