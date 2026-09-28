/**
 * Jev provider (ISA2-275): POST https://api.typesafe.ai/v1/systemone.
 * Retries 429 and 529 with exponential backoff. Server-side only; the key
 * comes from TYPESAFE_API_KEY and is never logged.
 */

import { DecisionProvider, DecisionError } from './DecisionProvider.js';

const DEFAULT_URL = 'https://api.typesafe.ai/v1/systemone';
const RETRYABLE = new Set([429, 529]);
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export class JevProvider extends DecisionProvider {
  constructor({
    apiKey = process.env.TYPESAFE_API_KEY,
    url = DEFAULT_URL,
    model = 'jev-latest',
    fetchImpl = globalThis.fetch,
    maxRetries = 3,
    baseDelayMs = 200,
    timeoutMs = Number(process.env.XAVIER_JEV_TIMEOUT_MS) || 5000,
    sleepFn = sleep,
    now = Date.now
  } = {}) {
    super();
    this.apiKey = apiKey;
    this.url = url;
    this.model = model;
    this._fetch = fetchImpl;
    this.maxRetries = maxRetries;
    this.baseDelayMs = baseDelayMs;
    this.timeoutMs = timeoutMs;
    this._sleep = sleepFn;
    this._now = now;
  }

  async evaluate({ state, questions }) {
    if (!this.apiKey) throw new DecisionError('no_api_key', 'TYPESAFE_API_KEY is not set');
    const body = JSON.stringify({ state, model: this.model, questions });
    const started = this._now();

    for (let attempt = 0; ; attempt++) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
      let res;
      try {
        res = await this._fetch(this.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.apiKey}` },
          body,
          signal: ctrl.signal
        });
      } catch (err) {
        throw new DecisionError(err?.name === 'AbortError' ? 'timeout' : 'unreachable', `Jev request failed: ${err.message}${err.cause?.code ? ` (${err.cause.code})` : ''}`);
      } finally {
        clearTimeout(timer);
      }

      if (RETRYABLE.has(res.status) && attempt < this.maxRetries) {
        await this._sleep(this.baseDelayMs * 2 ** attempt);
        continue;
      }
      if (!res.ok) {
        throw new DecisionError(res.status === 401 || res.status === 403 ? 'unauthorized' : 'http_error',
          `Jev returned HTTP ${res.status}`, { status: res.status });
      }
      const json = await res.json();
      if (!json || typeof json.answers !== 'object') throw new DecisionError('bad_response', 'Jev response had no answers');
      return { answers: json.answers, latencyMs: this._now() - started, model: json.model || this.model, usage: json.usage };
    }
  }
}
