/**
 * Mock provider (ISA2-275). Tests only. Returns canned Jev-shaped answers.
 * `answers` is an object keyed by question id, or a function
 * ({state, questions}) => object. Missing ids get a neutral default.
 */

import { DecisionProvider, DecisionError } from './DecisionProvider.js';

export class MockProvider extends DecisionProvider {
  constructor({ answers = {}, latencyMs = 1, model = 'mock', delayMs = 0, error = null } = {}) {
    super();
    this.answers = answers;
    this.latencyMs = latencyMs;
    this.model = model;
    this.delayMs = delayMs;
    this.error = error;
    this.calls = [];
  }

  async evaluate({ state, questions }) {
    this.calls.push({ state, questions });
    if (this.delayMs) await new Promise(r => setTimeout(r, this.delayMs));
    if (this.error) throw new DecisionError(this.error, `mock error: ${this.error}`);
    const canned = typeof this.answers === 'function' ? this.answers({ state, questions }) : this.answers;
    const out = {};
    for (const [id, q] of Object.entries(questions)) {
      if (canned[id]) { out[id] = canned[id]; continue; }
      if (q.type === 'noul') { out[id] = { type: 'noul', noul: 0.5 }; continue; }
      const options = Object.keys(q.criteria || {});
      const p = options.length ? 1 / options.length : 0;
      out[id] = {
        type: 'choice', choice: options[0], confidence: p,
        probabilities: Object.fromEntries(options.map(o => [o, p]))
      };
    }
    return { answers: out, latencyMs: this.latencyMs, model: this.model };
  }
}
