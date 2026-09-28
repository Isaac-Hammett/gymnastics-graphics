/**
 * Score arithmetic in integer thousandths so sums, margins, and needs are
 * exact (13.35 + 13.65 must not drift).
 */

export function toMilli(x) {
  if (x == null || x === '') return null;
  const n = typeof x === 'number' ? x : parseFloat(x);
  return Number.isFinite(n) ? Math.round(n * 1000) : null;
}

export function fromMilli(m) {
  return m == null ? null : m / 1000;
}

/** Sum of the top `n` values (all of them when there are fewer). */
export function topSum(values, n) {
  return [...values].sort((a, b) => b - a).slice(0, n).reduce((s, v) => s + v, 0);
}
