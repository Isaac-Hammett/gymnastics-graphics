import { useState, useEffect, useCallback, useRef } from 'react';

// How long after a refusal a second tap counts as the producer's override.
export const FORCE_WINDOW_MS = 4000;
const MAX_EVENTS = 20;

/**
 * Run actions through the coordinator's action bus and surface guardrail
 * refusals (ISA2-273). A refused command sets `refusal` ({ key, rule, reason });
 * a second call with the same key inside FORCE_WINDOW_MS resends it with
 * `force: true`. Also collects the competition's `action:refused` broadcasts and
 * `guardrailOverride` acks from `action:executed` into `events` (newest first).
 */
export default function useGuardedAction(socket, compId) {
  const [refusal, setRefusal] = useState(null);
  const [events, setEvents] = useState([]);
  const lastRefusal = useRef(null); // { key, at }
  const clearTimer = useRef(null);

  const clearRefusal = useCallback(() => {
    lastRefusal.current = null;
    setRefusal(null);
  }, []);

  const run = useCallback((key, actionId, params, sender = 'producer') => {
    if (!socket) {
      console.error(`useGuardedAction: no coordinator connection, cannot run ${actionId}`);
      return;
    }
    const last = lastRefusal.current;
    const force = !!last && last.key === key && Date.now() - last.at < FORCE_WINDOW_MS;
    socket.emit('action:execute', { actionId, sender, compId, params, ...(force ? { force: true } : {}) }, (ack) => {
      if (ack?.guardrail) {
        lastRefusal.current = { key, at: Date.now() };
        setRefusal({ key, actionId, rule: ack.guardrail.rule, reason: ack.guardrail.reason });
        clearTimeout(clearTimer.current);
        clearTimer.current = setTimeout(clearRefusal, FORCE_WINDOW_MS);
      } else {
        clearTimeout(clearTimer.current);
        clearRefusal();
        if (!ack?.ok) console.error(`useGuardedAction: ${actionId} failed`, ack);
      }
    });
  }, [socket, compId, clearRefusal]);

  useEffect(() => {
    if (!socket) return undefined;
    const push = (entry) => setEvents(prev => [entry, ...prev].slice(0, MAX_EVENTS));
    const onRefused = (data) => {
      if (data?.compId && compId && data.compId !== compId) return;
      push({ id: `${data.at}-${data.actionId}-r`, kind: 'refused', at: data.at, actionId: data.actionId, sender: data.sender, rule: data.guardrail?.rule, reason: data.guardrail?.reason });
    };
    const onExecuted = (data) => {
      if (!data?.guardrailOverride) return;
      push({ id: `${data.at}-${data.actionId}-o`, kind: 'override', at: data.at, actionId: data.actionId, sender: data.sender, rule: data.guardrailOverride.map(o => o.rule).join(', '), reason: data.guardrailOverride.map(o => o.reason).join('; ') });
    };
    socket.on('action:refused', onRefused);
    socket.on('action:executed', onExecuted);
    return () => {
      socket.off('action:refused', onRefused);
      socket.off('action:executed', onExecuted);
    };
  }, [socket, compId]);

  useEffect(() => () => clearTimeout(clearTimer.current), []);

  return { run, refusal, clearRefusal, events };
}
