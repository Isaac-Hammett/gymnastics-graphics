import { useState, useEffect, useCallback } from 'react';

/**
 * useXavier - Xavier AI producer state and actions (ISA2-276, ISA2-277).
 *
 * State comes from the coordinator's XavierService and XavierControl over the socket:
 *   xavier:snapshot / xavier:recommendations / xavier:status / xavier:dismissed
 *   xavier:control (mode, thresholds, cooldown, pending) / xavier:auto (each Xavier execution)
 * Actions: setMode('off' | 'suggest' | 'auto' | 'full'), take(rec), dismiss(rec).
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
  const [control, setControl] = useState(null);
  const [autoRan, setAutoRan] = useState({});

  useEffect(() => {
    if (!socket || !compId) return undefined;
    const mine = (d) => !d?.compId || d.compId === compId;
    const applyLast = (last) => setRecommendations(last?.recommendations || []);
    const onSnapshot = (snap) => {
      if (!mine(snap)) return;
      setRunning(!!snap.running);
      if (snap.status) setStatus(snap.status);
      applyLast(snap.last);
      if (snap.control) setControl(snap.control);
    };
    const onControl = (c) => { if (mine(c)) setControl(c); };
    const onRecs = (payload) => {
      if (!mine(payload)) return;
      setRecommendations(payload.recommendations || []);
      setResults({});
      setAutoRan({});
    };
    const onAuto = (d) => {
      if (!mine(d) || d.outcome !== 'auto' || !d.recommendationId) return;
      setAutoRan(prev => ({ ...prev, [d.recommendationId]: true }));
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
    socket.on('xavier:control', onControl);
    socket.on('xavier:auto', onAuto);
    const ask = () => socket.emit('xavier:get', { compId });
    if (socket.connected) ask();
    socket.on('connect', ask);
    return () => {
      socket.off('xavier:snapshot', onSnapshot);
      socket.off('xavier:recommendations', onRecs);
      socket.off('xavier:status', onStatus);
      socket.off('xavier:dismissed', onDismissed);
      socket.off('xavier:control', onControl);
      socket.off('xavier:auto', onAuto);
      socket.off('connect', ask);
    };
  }, [socket, compId]);

  const setMode = useCallback((mode) => {
    if (!socket) return;
    setControl(prev => prev ? { ...prev, mode } : prev);
    socket.emit('xavier:setMode', { compId, mode }, (ack) => {
      if (!ack?.ok) return;
      setRunning(!!ack.running);
      if (ack.control) setControl(ack.control);
      if (mode === 'off') {
        setRecommendations([]);
        setResults({});
        setStatus({ ok: true, reason: null });
      } else if (ack.status) {
        setStatus(ack.status);
      }
    });
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

  // Ran by Xavier itself: this session's xavier:auto events, plus the control's recent log (covers a reload).
  const ranIds = { ...autoRan };
  (control?.recent || []).forEach(r => { if (r.outcome === 'auto' && r.recommendationId) ranIds[r.recommendationId] = true; });

  const mode = control?.mode || (running ? 'suggest' : 'off');
  return { running, mode, control, status, recommendations, results, ranIds, setMode, take, dismiss };
}
