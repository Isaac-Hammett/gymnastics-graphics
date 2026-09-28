/**
 * Decision provider interface (ISA2-275)
 *
 * evaluate({ state, questions }) -> { answers, latencyMs, model }
 *
 * `questions` is keyed by question id, in Jev's request shape:
 *   { [id]: { type: 'choice'|'noul', instructions, criteria } }
 * `answers` is keyed by the same ids, in Jev's response shape:
 *   choice: { type:'choice', choice, confidence, probabilities:{option:p} }
 *   noul:   { type:'noul', noul: P(yes) }
 * Providers throw DecisionError (with a `code`) when they cannot answer.
 */

export class DecisionError extends Error {
  constructor(code, message, extra = {}) {
    super(message);
    this.name = 'DecisionError';
    this.code = code;
    Object.assign(this, extra);
  }
}

export class DecisionProvider {
  // eslint-disable-next-line no-unused-vars
  async evaluate({ state, questions }) {
    throw new Error('DecisionProvider.evaluate is not implemented');
  }
}

/** Shape check shared by the contract test and the service. */
export function isValidAnswer(a) {
  if (!a || typeof a !== 'object') return false;
  if (a.type === 'noul') return typeof a.noul === 'number' && a.noul >= 0 && a.noul <= 1;
  if (a.type === 'choice') {
    return typeof a.choice === 'string' && !!a.probabilities && typeof a.probabilities === 'object';
  }
  return false;
}
