import { useState, useEffect, useCallback } from 'react';

/**
 * useXavier - Xavier AI producer state and actions (ISA2-276).
 *
 * State comes from the coordinator's XavierService over the socket:
 *   xavier:snapshot / xavier:recommendations / xavier:status / xavier:dismissed
 * Actions: setMode('off' | 'suggest'), take(rec), dismiss(rec).
 * Take runs the recommendation through the action bus as sender 'xavier-suggest',
 * so guardrails apply and the ack tells us whether it fired.
 *
 * `results` maps recommendationId -> { pending } | { ok, error, guardrail }.
 */
export default function useXavier(socket, compId) {
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState({ ok: true, reason: null });
  const [recommendations, setRecommendations] = useState([]);
  const [results, setResults] = useState({});

  useEffect(() => {
    if (!socket || !compId) return undefined;
    const mine = (d) => !d?.compId || d.compId === compId;
    const applyLast = (last) => setRecommendations(last?.recommendations || []);
    const onSnapshot = (snap) => {
      if (!mine(snap)) return;
      setRunning(!!snap.running);
      if (snap.status) setStatus(snap.status);
      applyLast(snap.last);
    };
    const onRecs = (payload) => {
      if (!mine(payload)) return;
      setRecommendations(payload.recommendations || []);
      setResults({});
    };
    const onStatus = (s) => { if (mine(s)) setStatus({ ok: s.ok, reason: s.reason, message: s.message }); };
    const onDismissed = (d) => {
      if (!mine(d)) return;
      setRecommendations(prev => prev.filter(r => r.recommendationId !== d.recommendationId));
    };
    socket.on('xavier:snapshot', onSnapshot);
    socket.on('xavier:recommendations', onRecs);
    socket.on('xavier:status', onStatus);
    socket.on('xavier:dismissed', onDismissed);
    const ask = () => socket.emit('xavier:get', { compId });
    if (socket.connected) ask();
    socket.on('connect', ask);
    return () => {
      socket.off('xavier:snapshot', onSnapshot);
      socket.off('xavier:recommendations', onRecs);
      socket.off('xavier:status', onStatus);
      socket.off('xavier:dismissed', onDismissed);
      socket.off('connect', ask);
    };
  }, [socket, compId]);

  const setMode = useCallback((mode) => {
    if (!socket) return;
    if (mode === 'suggest') {
      socket.emit('xavier:start', { compId }, (ack) => {
        if (ack?.ok) { setRunning(true); if (ack.status) setStatus(ack.status); }
      });
    } else {
      socket.emit('xavier:stop', { compId }, () => {
        setRunning(false);
        setRecommendations([]);
        setResults({});
        setStatus({ ok: true, reason: null });
      });
    }
  }, [socket, compId]);

  const take = useCallback((rec) => {
    if (!socket) return;
    const id = rec.recommendationId;
    setResults(prev => ({ ...prev, [id]: { pending: true } }));
    socket.emit('action:execute', { actionId: rec.actionId, sender: 'xavier-suggest', recommendationId: id, compId }, (ack) => {
      setResults(prev => ({ ...prev, [id]: { ok: !!ack?.ok, error: ack?.error || null, guardrail: ack?.guardrail || null } }));
    });
  }, [socket, compId]);

  const dismiss = useCallback((rec) => {
    if (!socket) return;
    setRecommendations(prev => prev.filter(r => r.recommendationId !== rec.recommendationId));
    socket.emit('xavier:dismiss', { compId, recommendationId: rec.recommendationId });
  }, [socket, compId]);

  return { running, status, recommendations, results, setMode, take, dismiss };
}
