export * from './DecisionProvider.js';
export * from './JevProvider.js';
export * from './MockProvider.js';
export * from './XavierService.js';
export * from './XavierControl.js';
export * from './XavierDecisionLog.js';

import { XavierService } from './XavierService.js';
import { XavierControl } from './XavierControl.js';
import { XavierDecisionLog } from './XavierDecisionLog.js';

const services = new Map();
const controls = new Map();
const logs = new Map();

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

/**
 * The competition's control levels (ISA2-277), wrapping its service. Created
 * and started on first call; `options` go to XavierControl.
 */
export function getOrCreateXavierControl(compId, options = {}) {
  let ctl = controls.get(compId);
  if (!ctl) {
    ctl = new XavierControl({ ...options, compId });
    controls.set(compId, ctl);
    ctl.start();
  }
  return ctl;
}

export function getXavierControl(compId) {
  return controls.get(compId) || null;
}

/** The competition's decision log (ISA2-279), started on first call; `options` go to XavierDecisionLog. */
export function getOrCreateXavierLog(compId, options = {}) {
  let log = logs.get(compId);
  if (!log) {
    log = new XavierDecisionLog({ ...options, compId });
    logs.set(compId, log);
    log.start();
  }
  return log;
}

export function getXavierLog(compId) {
  return logs.get(compId) || null;
}

export function removeXavier(compId) {
  logs.get(compId)?.stop();
  logs.delete(compId);
  controls.get(compId)?.stop();
  controls.delete(compId);
  services.get(compId)?.stop();
  services.delete(compId);
}
