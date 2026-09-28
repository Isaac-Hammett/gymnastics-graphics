// Decision log helpers (ISA2-279): bucket recommendation records by confidence
// and compute the take rate. Pure functions; XavierLogPage renders them.

export const BUCKET_COUNT = 10;

/** 0.87 -> 8 (the 0.8-0.9 bucket); 1.0 falls into the last bucket. */
export function bucketIndex(confidence) {
  if (confidence == null || confidence === '') return null;
  const c = Number(confidence);
  if (!Number.isFinite(c)) return null;
  return Math.min(BUCKET_COUNT - 1, Math.max(0, Math.floor(c * BUCKET_COUNT + 1e-9)));
}

export const bucketLabel = (i) => `${(i / BUCKET_COUNT).toFixed(1)}-${((i + 1) / BUCKET_COUNT).toFixed(1)}`;

/** Firebase object of records -> array sorted by time, each with its key as `id`. Skips the older auto-run entries (ISA2-277), which have no `recommended` list. */
export function toRecords(val) {
  return Object.entries(val || {}).filter(([, r]) => Array.isArray(r?.recommended)).map(([id, r]) => ({ id, ...r })).sort((a, b) => (a.ts || 0) - (b.ts || 0));
}

/** Distinct runs, newest first: [{ runId, count, firstTs }]. Records without a runId group as 'unlabeled'. */
export function listRuns(records) {
  const runs = new Map();
  for (const r of records) {
    const id = r.runId || 'unlabeled';
    const run = runs.get(id) || { runId: id, count: 0, firstTs: r.ts || 0 };
    run.count += 1;
    run.firstTs = Math.min(run.firstTs, r.ts || run.firstTs);
    runs.set(id, run);
  }
  return [...runs.values()].sort((a, b) => b.firstTs - a.firstTs);
}

/**
 * Take rate per 0.1 confidence bucket. Every recommendation counts in the
 * denominator; only `took` counts as taken (expired, dismissed and other do not).
 * @returns {{index, label, n, took, rate}[]} rate is null when the bucket is empty
 */
export function takeRateByBucket(records) {
  const buckets = Array.from({ length: BUCKET_COUNT }, (_, index) => ({ index, label: bucketLabel(index), n: 0, took: 0, rate: null }));
  for (const r of records) {
    const i = bucketIndex(r.confidence ?? r.recommended?.[0]?.probability);
    if (i == null) continue;
    buckets[i].n += 1;
    if (r.outcome?.type === 'took') buckets[i].took += 1;
  }
  for (const b of buckets) b.rate = b.n ? b.took / b.n : null;
  return buckets;
}
