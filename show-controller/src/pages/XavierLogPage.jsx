import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { db, ref, onValue } from '../lib/firebase';
import { useCompetition } from '../context/CompetitionContext';
import { toRecords, listRuns, takeRateByBucket, BUCKET_COUNT } from '../lib/xavierLog';

/**
 * XavierLogPage (ISA2-279): the decision log for one competition.
 * Reads competitions/{compId}/xavier/decisions (written by the coordinator's
 * XavierDecisionLog) and shows the take rate by confidence bucket for a run,
 * then a table of every decision in it.
 */

const BAR = '#38bdf8';      // one series, one hue
const OUTCOME_STYLE = {
  took: 'text-emerald-400',
  dismissed: 'text-zinc-400',
  other: 'text-amber-400',
  expired: 'text-zinc-500',
};

const pct = (v) => (v == null ? '-' : `${Math.round(v * 100)}%`);
const fmtClock = (ms) => {
  if (ms == null) return '-';
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};
const fmtTime = (ts) => (ts ? new Date(ts).toLocaleTimeString() : '-');

function TakeRateChart({ buckets }) {
  const [hover, setHover] = useState(null);
  const [asTable, setAsTable] = useState(false);
  const W = 640, H = 240, L = 40, R = 12, T = 20, B = 46;
  const plotW = W - L - R, plotH = H - T - B;
  const slot = plotW / BUCKET_COUNT;
  const barW = Math.min(36, slot - 8);
  const y = (v) => T + plotH * (1 - v);

  return (
    <section className="rounded-lg border border-zinc-800 bg-zinc-900 p-4" data-testid="take-rate-chart">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-sm font-semibold text-zinc-100">Take rate by confidence</h2>
          <p className="text-xs text-zinc-400">Share of recommendations the producer took (or Xavier ran), by the top recommendation's confidence.</p>
        </div>
        <button className="text-xs text-zinc-300 underline" onClick={() => setAsTable(v => !v)} data-testid="chart-table-toggle">
          {asTable ? 'Show chart' : 'Show table'}
        </button>
      </div>
      {asTable ? (
        <table className="w-full text-xs text-zinc-300 tabular-nums" data-testid="take-rate-table">
          <thead><tr className="text-left text-zinc-400"><th className="py-1">Confidence</th><th>Shown</th><th>Taken</th><th>Take rate</th></tr></thead>
          <tbody>
            {buckets.map(b => <tr key={b.index} className="border-t border-zinc-800"><td className="py-1">{b.label}</td><td>{b.n}</td><td>{b.took}</td><td>{pct(b.rate)}</td></tr>)}
          </tbody>
        </table>
      ) : (
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Take rate by confidence bucket">
            {[0, 0.25, 0.5, 0.75, 1].map(v => (
              <g key={v}>
                <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="#3f3f46" strokeWidth="1" opacity={v === 0 ? 1 : 0.5} />
                <text x={L - 6} y={y(v) + 4} textAnchor="end" fontSize="10" fill="#a1a1aa">{Math.round(v * 100)}%</text>
              </g>
            ))}
            {buckets.map(b => {
              const cx = L + slot * b.index + slot / 2;
              const h = b.rate == null ? 0 : plotH * b.rate;
              return (
                <g key={b.index} onMouseEnter={() => setHover(b)} onMouseLeave={() => setHover(null)} data-testid={`bucket-${b.index}`}>
                  <rect x={cx - slot / 2} y={T} width={slot} height={plotH} fill="transparent" />
                  {b.rate ? (
                    <path d={`M${cx - barW / 2},${T + plotH} v${-(h - Math.min(4, h))} q0,${-Math.min(4, h)} ${Math.min(4, h)},${-Math.min(4, h)} h${barW - 2 * Math.min(4, h)} q${Math.min(4, h)},0 ${Math.min(4, h)},${Math.min(4, h)} v${h - Math.min(4, h)} z`}
                      fill={BAR} opacity={hover && hover.index !== b.index ? 0.55 : 1} />
                  ) : null}
                  {b.rate != null && <text x={cx} y={y(b.rate) - 5} textAnchor="middle" fontSize="11" fill="#e4e4e7">{pct(b.rate)}</text>}
                  <text x={cx} y={H - 26} textAnchor="middle" fontSize="10" fill="#a1a1aa">{b.label}</text>
                  <text x={cx} y={H - 12} textAnchor="middle" fontSize="10" fill="#71717a">n={b.n}</text>
                </g>
              );
            })}
          </svg>
          {hover && (
            <div className="absolute top-1 right-2 rounded bg-zinc-800 border border-zinc-700 px-2 py-1 text-xs text-zinc-100 pointer-events-none" data-testid="chart-tooltip">
              Confidence {hover.label}: {hover.n ? `${hover.took} of ${hover.n} taken (${pct(hover.rate)})` : 'no recommendations'}
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function DecisionTable({ records }) {
  if (!records.length) return <p className="text-sm text-zinc-400" data-testid="decision-empty">No decisions logged for this run.</p>;
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-800">
      <table className="w-full text-xs text-zinc-300 [&_th]:px-2 [&_td]:px-2" data-testid="decision-table">
        <thead className="bg-zinc-900 text-left text-zinc-400">
          <tr>
            <th className="px-2 py-2">Time</th><th>Clock</th><th>Trigger</th><th>Recommended</th>
            <th className="text-right">Conf.</th><th>Outcome</th><th className="text-right">Response</th><th className="text-right">Latency</th><th className="pr-2">Model</th>
          </tr>
        </thead>
        <tbody>
          {records.map(r => {
            const o = r.outcome;
            return (
              <tr key={r.id} className="border-t border-zinc-800" data-testid="decision-row">
                <td className="px-2 py-1 whitespace-nowrap tabular-nums">{fmtTime(r.ts)}</td>
                <td className="tabular-nums">{fmtClock(r.clockMs)}</td>
                <td className="max-w-[16rem] truncate" title={r.trigger || ''}>{r.trigger || '-'}</td>
                <td className="max-w-[18rem] truncate" title={(r.recommended || []).map(x => `${x.label} ${pct(x.probability)}`).join(', ')}>
                  {(r.recommended || []).map(x => x.label).join(', ')}
                </td>
                <td className="text-right tabular-nums">{pct(r.confidence)}</td>
                <td className={OUTCOME_STYLE[o?.type] || 'text-zinc-500'}>
                  {o ? <>{o.type}{o.auto ? ' (auto)' : ''}{o.actionId ? ` · ${o.actionId}` : ''}{o.type === 'took' && o.ackOk === false ? ' · refused' : ''}</> : 'open'}
                  {r.guardrails?.length ? <span className="text-amber-400"> · guardrail: {r.guardrails.map(g => g.rule).join(', ')}</span> : null}
                </td>
                <td className="text-right tabular-nums">{o?.responseMs != null ? `${(o.responseMs / 1000).toFixed(1)}s` : '-'}</td>
                <td className="text-right tabular-nums">{r.latencyMs != null ? `${r.latencyMs}ms` : '-'}</td>
                <td className="pr-2 text-zinc-400">{r.model || '-'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function XavierLogPage() {
  const { compId } = useCompetition();
  const [records, setRecords] = useState(null);
  const [runId, setRunId] = useState(null);

  useEffect(() => {
    if (!compId) return undefined;
    return onValue(ref(db, `competitions/${compId}/xavier/decisions`),
      (snap) => setRecords(toRecords(snap.val())),
      () => setRecords([]));
  }, [compId]);

  const runs = useMemo(() => listRuns(records || []), [records]);
  const activeRun = runId && runs.some(r => r.runId === runId) ? runId : runs[0]?.runId ?? null;
  const inRun = useMemo(() => (records || []).filter(r => (r.runId || 'unlabeled') === activeRun), [records, activeRun]);
  const buckets = useMemo(() => takeRateByBucket(inRun), [inRun]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-4 space-y-4 max-w-6xl mx-auto" data-testid="xavier-log-page">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Xavier decision log</h1>
          <p className="text-xs text-zinc-400">{compId}</p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          {runs.length > 0 && (
            <label className="flex items-center gap-2 text-zinc-300">
              Run
              <select className="bg-zinc-800 border border-zinc-700 rounded px-2 py-1" value={activeRun || ''} onChange={e => setRunId(e.target.value)} data-testid="run-select">
                {runs.map(r => <option key={r.runId} value={r.runId}>{r.runId} ({r.count})</option>)}
              </select>
            </label>
          )}
          <Link to={`/${compId}/producer`} className="text-zinc-300 underline">Producer View</Link>
        </div>
      </header>
      {records === null ? (
        <p className="text-sm text-zinc-400">Loading...</p>
      ) : (
        <>
          <TakeRateChart buckets={buckets} />
          <DecisionTable records={[...inRun].reverse()} />
        </>
      )}
    </div>
  );
}
