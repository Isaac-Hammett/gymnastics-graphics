import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * useRecordedSource - recorded-source show state and actions (ISA2-297).
 *
 * Talks to the coordinator's ShowClock (ISA2-296) over the socket:
 *   recorded:list / load / unload / play / pause / seek / rate / offset / status
 *   recorded:marks / mark / unmark / marks-fresh (marking mode, writes events.jsonl)
 * Every call acks { ok, ...status } or { ok: false, error }. `status` mirrors the
 * clock; `positionMs` is interpolated locally while playing so the panel ticks
 * smoothly, and a slow poll re-reads the OBS media cursor to catch drift.
 */
const POLL_MS = 2000;

export default function useRecordedSource(socket, compId, enabled) {
  const [recordings, setRecordings] = useState([]);
  const [status, setStatus] = useState(null);
  const [marks, setMarks] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [positionMs, setPositionMs] = useState(0);
  const anchor = useRef({ at: 0, pos: 0, playing: false, rate: 1 });

  const applyStatus = useCallback((s) => {
    if (!s) return;
    setStatus(s);
    anchor.current = { at: Date.now(), pos: s.positionMs || 0, playing: !!s.playing, rate: s.rate || 1 };
    setPositionMs(s.positionMs || 0);
  }, []);

  const call = useCallback((event, payload = {}) => new Promise((resolve) => {
    if (!socket) return resolve({ ok: false, error: 'not connected' });
    socket.emit(event, { compId, ...payload }, (ack) => {
      if (ack?.ok) {
        setError(null);
        if (ack.marks) setMarks(ack.marks);
        if (ack.compId) applyStatus(ack);
      } else {
        setError(ack?.error || 'request failed');
      }
      resolve(ack || { ok: false });
    });
  }), [socket, compId, applyStatus]);

  useEffect(() => {
    if (!socket || !compId || !enabled) return undefined;
    const mine = (d) => !d?.compId || d.compId === compId;
    const onStatus = (s) => { if (mine(s)) applyStatus(s); };
    const onMarks = (m) => { if (mine(m)) setMarks(m); };
    socket.on('recorded:status', onStatus);
    socket.on('recorded:marks', onMarks);
    call('recorded:list').then(ack => ack.ok && setRecordings(ack.recordings || []));
    // A show may already be loaded (another tab, or before a reload).
    call('recorded:status').then(ack => { if (ack.ok) call('recorded:marks'); else setError(null); });
    return () => {
      socket.off('recorded:status', onStatus);
      socket.off('recorded:marks', onMarks);
    };
  }, [socket, compId, enabled, call, applyStatus]);

  const loaded = !!status?.recording;

  useEffect(() => {
    if (!enabled || !loaded) return undefined;
    const tick = setInterval(() => {
      const a = anchor.current;
      const pos = a.playing ? a.pos + (Date.now() - a.at) * a.rate : a.pos;
      setPositionMs(Math.round(Math.min(pos, status?.durationMs ?? pos)));
    }, 200);
    const poll = setInterval(() => call('recorded:status', { readObs: true }), POLL_MS);
    return () => { clearInterval(tick); clearInterval(poll); };
  }, [enabled, loaded, call, status?.durationMs]);

  const load = useCallback(async (recording, offsets = {}) => {
    setBusy(true);
    const ack = await call('recorded:load', { recording, ...offsets });
    if (ack.ok) await call('recorded:marks');
    setBusy(false);
    return ack;
  }, [call]);

  const unload = useCallback(async () => {
    await call('recorded:unload');
    setStatus(null);
    setMarks(null);
    setError(null);
  }, [call]);

  return {
    recordings, status, marks, error, busy, positionMs, loaded,
    load, unload,
    play: () => call('recorded:play'),
    pause: () => call('recorded:pause'),
    seek: (tMs) => call('recorded:seek', { tMs }),
    setRate: (rate) => call('recorded:rate', { rate }),
    setOffsets: (offsets) => call('recorded:offset', offsets),
    mark: (kind, event) => call('recorded:mark', { kind, event }),
    unmark: () => call('recorded:unmark'),
    startMeasuredLog: () => call('recorded:marks-fresh')
  };
}
