export * from './DecisionProvider.js';
export * from './JevProvider.js';
export * from './MockProvider.js';
export * from './XavierService.js';

import { XavierService } from './XavierService.js';

const services = new Map();

export function getOrCreateXavier(compId, options = {}) {
  let svc = services.get(compId);
  if (!svc) {
    svc = new XavierService({ ...options, compId });
    services.set(compId, svc);
  }
  return svc;
}

export function getXavier(compId) {
  return services.get(compId) || null;
}

export function removeXavier(compId) {
  services.get(compId)?.stop();
  services.delete(compId);
}
