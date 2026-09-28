import { useEffect, useState } from 'react';
import useRecordedSource from '../hooks/useRecordedSource';

const RATES = [0.5, 1, 1.5, 2];

const clock = (ms) => {
  const s = Math.max(0, Math.floor((ms || 0) / 1000));
  const h = Math.floor(s / 3600);
  const m = String(Math.floor((s % 3600) / 60)).padStart(h ? 2 : 1, '0');
  return `${h ? `${h}:` : ''}${m}:${String(s % 60).padStart(2, '0')}`;
};

const inTextField = (t) => t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable);

function Athlete({ entry, label }) {
  if (!entry) return <span className="text-zinc-500">{label} done</span>;
  return (
    <span className="truncate">
      <span className="text-zinc-500">{label}</span> {entry.athlete.name} <span className="text-zinc-500">({entry.team})</span>
    </span>
  );
}

/** Marking mode: one key marks the next expected athlete on the selected event. */
function MarkingTool({ rs, active }) {
  const { marks } = rs;
  const events = marks?.events || [];
  const [selected, setSelected] = useState(null);
  const current = selected || events[0]?.event;

  useEffect(() => {
    if (!active) return undefined;
    const onKey = (e) => {
      if (inTextField(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.key.toLowerCase();
      if (k >= '1' && k <= '9' && events[Number(k) - 1]) setSelected(events[Number(k) - 1].event);
      else if (k === 'g' && current) rs.mark('greenLight', current);
      else if (k === 's' && current) rs.mark('scorePosted', current);
      else if (k === 'z') rs.unmark();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!marks) return <div className="text-xs text-zinc-500">Loading the expected order...</div>;
  return (
    <div className="space-y-2" data-testid="recorded-marking">
      <div className="text-xs text-zinc-400">
        Keys: <kbd>1</kbd>-<kbd>{events.length}</kbd> pick the event, <kbd>G</kbd> green light, <kbd>S</kbd> score posted, <kbd>Z</kbd> undo.
        Each mark uses the video time now and the next athlete in the Virtius order.
      </div>
      {marks.synthetic && (
        <div className="text-xs text-amber-300 flex items-center justify-between gap-2" data-testid="recorded-synthetic-note">
          <span>events.jsonl is the synthetic rebuild. Marks would stack on it.</span>
          <button onClick={rs.startMeasuredLog} className="px-2 py-1 rounded bg-amber-600 text-white shrink-0" data-testid="recorded-fresh-log">
            Start measured log
          </button>
        </div>
      )}
      <div className="space-y-1">
        {events.map((ev, i) => (
          <div
            key={ev.event}
            onClick={() => setSelected(ev.event)}
            data-testid={`recorded-event-${ev.event}`}
            className={`rounded px-2 py-1.5 text-xs cursor-pointer border ${ev.event === current ? 'border-emerald-500 bg-zinc-800' : 'border-transparent bg-zinc-800/50 hover:bg-zinc-800'}`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium text-zinc-100"><kbd className="text-zinc-500">{i + 1}</kbd> {ev.event}</span>
              <span className="text-zinc-400 tabular-nums">Go {ev.greenLights}/{ev.total} · Score {ev.scores}/{ev.total}</span>
            </div>
            <div className="flex items-center justify-between gap-2 mt-1 text-zinc-300">
              <div className="min-w-0 flex flex-col">
                <Athlete entry={ev.nextGreen} label="Go:" />
                <Athlete entry={ev.nextScore} label="Score:" />
              </div>
              <div className="flex gap-1 shrink-0">
                <button
                  onClick={(e) => { e.stopPropagation(); rs.mark('greenLight', ev.event); }}
                  disabled={!ev.nextGreen}
                  data-testid={`recorded-go-${ev.event}`}
                  className="px-2 py-1 rounded bg-emerald-600 text-white disabled:opacity-40"
                >Go</button>
                <button
                  onClick={(e) => { e.stopPropagation(); rs.mark('scorePosted', ev.event); }}
                  disabled={!ev.nextScore}
                  data-testid={`recorded-score-${ev.event}`}
                  className="px-2 py-1 rounded bg-sky-600 text-white disabled:opacity-40"
                >Score</button>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between text-xs text-zinc-400">
        <span data-testid="recorded-mark-count">{marks.marks} mark{marks.marks === 1 ? '' : 's'} saved to events.jsonl</span>
        <button onClick={rs.unmark} disabled={!marks.marks} data-testid="recorded-undo" className="px-2 py-1 rounded bg-zinc-700 text-zinc-100 disabled:opacity-40">Undo last</button>
      </div>
    </div>
  );
}

/**
 * Recorded Source panel (ISA2-297). Live leaves Producer View exactly as it was:
 * the panel shows only the selector and sends nothing. Recorded loads a meet
 * onto the show clock and offers transport, offsets, and marking mode.
 */
export default function RecordedSourcePanel({ socket, compId }) {
  const [mode, setMode] = useState('live');
  const recorded = mode === 'recorded';
  const rs = useRecordedSource(socket, compId, recorded);
  const { status, loaded, positionMs } = rs;
  const [pickedMeet, setMeet] = useState('');
  const meet = pickedMeet || (rs.recordings.includes('ecac-2026') ? 'ecac-2026' : rs.recordings[0] || '');
  const [offsets, setOffsets] = useState({ eventsOffsetMs: 0, mediaOffsetMs: 0 });
  const [scrub, setScrub] = useState(null);
  const [marking, setMarking] = useState(false);

  const chooseMode = (next) => {
    if (next === mode) return;
    if (next === 'live') { if (loaded) rs.unload(); setMarking(false); }
    setMode(next);
  };
  const duration = status?.durationMs || 0;
  const shownPos = scrub ?? positionMs;
  const numberField = (key, label) => (
    <label className="flex flex-col gap-0.5 text-xs text-zinc-400">
      {label}
      <input
        type="number" step="100" value={offsets[key]}
        onChange={(e) => setOffsets(o => ({ ...o, [key]: Number(e.target.value) || 0 }))}
        data-testid={`recorded-${key}`}
        className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-100 w-full"
      />
    </label>
  );

  return (
    <div className="bg-zinc-900 rounded-lg border border-zinc-800 p-3 space-y-3" data-testid="recorded-source-panel">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-zinc-400 uppercase tracking-wide">Source</span>
        <div className="flex rounded overflow-hidden border border-zinc-700">
          {['live', 'recorded'].map(m => (
            <button
              key={m}
              onClick={() => chooseMode(m)}
              data-testid={`recorded-source-${m}`}
              className={`px-2 py-1 text-xs capitalize ${m === mode ? 'bg-emerald-600 text-white' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}
            >{m}</button>
          ))}
        </div>
      </div>

      {recorded && (
        <>
          <div className="flex items-end gap-2">
            <label className="flex flex-col gap-0.5 text-xs text-zinc-400 flex-1">
              Meet
              <select value={meet} onChange={(e) => setMeet(e.target.value)} data-testid="recorded-meet"
                className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-100">
                {rs.recordings.length === 0 && <option value="">No recordings</option>}
                {rs.recordings.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
            <button
              onClick={() => rs.load(meet, offsets)}
              disabled={!meet || rs.busy}
              data-testid="recorded-load"
              className="px-3 py-1 rounded bg-emerald-600 text-white text-sm disabled:opacity-40"
            >{rs.busy ? 'Loading...' : loaded ? 'Reload' : 'Load'}</button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {numberField('eventsOffsetMs', 'Log offset (ms)')}
            {numberField('mediaOffsetMs', 'Video offset (ms)')}
          </div>
          {loaded && (
            <button onClick={() => rs.setOffsets(offsets)} data-testid="recorded-apply-offsets"
              className="px-2 py-1 rounded bg-zinc-700 text-zinc-100 text-xs">Apply offsets</button>
          )}

          {loaded && (
            <div className="space-y-2" data-testid="recorded-transport">
              <div className="flex items-center gap-2">
                <button
                  onClick={status.playing ? rs.pause : rs.play}
                  data-testid="recorded-playpause"
                  className="px-3 py-1 rounded bg-zinc-700 text-zinc-100 text-sm w-20"
                >{status.playing ? 'Pause' : 'Play'}</button>
                <select
                  value={status.rate} onChange={(e) => rs.setRate(Number(e.target.value))} data-testid="recorded-rate"
                  className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-100 text-sm"
                >{RATES.map(r => <option key={r} value={r}>{r}x</option>)}</select>
                <span className="ml-auto text-sm text-zinc-200 tabular-nums" data-testid="recorded-position">
                  {clock(shownPos)} / {clock(duration)}
                </span>
              </div>
              <input
                type="range" min="0" max={duration} step="1000" value={Math.min(shownPos, duration)}
                onChange={(e) => setScrub(Number(e.target.value))}
                onPointerUp={() => { if (scrub != null) rs.seek(scrub); setScrub(null); }}
                onKeyUp={() => { if (scrub != null) rs.seek(scrub); setScrub(null); }}
                data-testid="recorded-seek" className="w-full"
              />
              <div className="text-xs text-zinc-500 flex justify-between" data-testid="recorded-obs">
                <span>{status.obsConnected ? `OBS cursor ${clock(status.obsCursorMs)}` : 'OBS not connected'}</span>
                {status.driftMs != null && <span>drift {Math.round(status.driftMs)} ms</span>}
              </div>
              <label className="flex items-center gap-2 text-sm text-zinc-300">
                <input type="checkbox" checked={marking} onChange={(e) => setMarking(e.target.checked)} data-testid="recorded-marking-toggle" />
                Marking mode
              </label>
              {marking && <MarkingTool rs={rs} active={marking} />}
            </div>
          )}
          {rs.error && <div className="text-xs text-amber-400" data-testid="recorded-error">{rs.error}</div>}
          {status?.lastError && <div className="text-xs text-amber-400">{status.lastError}</div>}
        </>
      )}
    </div>
  );
}
