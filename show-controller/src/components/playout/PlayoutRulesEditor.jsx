import { useState, useEffect } from 'react';
import {
  PlusIcon,
  TrashIcon,
  Bars3Icon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline';

/**
 * PlayoutRulesEditor — Configuration panel for playout-type segments
 *
 * Allows producers to configure:
 * - Clip play order (chronological, by-score, by-team, by-apparatus)
 * - Apparatus priority (optional)
 * - Transition type (cut, crossfade with duration, stinger disabled)
 * - Gap fill sequence with drag-to-reorder
 * - Loop toggle
 *
 * Data shape:
 * {
 *   clipOrder: 'chronological' | 'by-score' | 'by-team' | 'by-apparatus',
 *   apparatusPriority: null | 'FX' | 'PH' | 'SR' | 'VT' | 'PB' | 'HB' | 'UB' | 'BB',
 *   transitionType: 'cut' | 'crossfade' | 'stinger',
 *   crossfadeDuration: 100-2000 (ms),
 *   gapFillSequence: [{ graphicType, duration, background }],
 *   gapFillLoop: boolean
 * }
 */

// Clip order options
const CLIP_ORDER_OPTIONS = [
  { value: 'chronological', label: 'Chronological' },
  { value: 'by-score', label: 'By Score (Highest First)' },
  { value: 'by-team', label: 'By Team (Alternating)' },
  { value: 'by-apparatus', label: 'By Apparatus' },
];

// Apparatus options for priority dropdown
const APPARATUS_OPTIONS = [
  { value: '', label: 'No Priority' },
  { value: 'FX', label: 'Floor Exercise (FX)' },
  { value: 'PH', label: 'Pommel Horse (PH)' },
  { value: 'SR', label: 'Still Rings (SR)' },
  { value: 'VT', label: 'Vault (VT)' },
  { value: 'PB', label: 'Parallel Bars (PB)' },
  { value: 'HB', label: 'High Bar (HB)' },
  { value: 'UB', label: 'Uneven Bars (UB)' },
  { value: 'BB', label: 'Balance Beam (BB)' },
];

// Transition type options
const TRANSITION_OPTIONS = [
  { value: 'cut', label: 'Cut' },
  { value: 'crossfade', label: 'Crossfade' },
  { value: 'stinger', label: 'Stinger', disabled: true },
];

// Graphic types for gap fill sequence
const GAP_FILL_GRAPHIC_TYPES = [
  { value: 'event-summary', label: 'Event Summary' },
  { value: 'standings', label: 'Standings' },
  { value: 'sponsor', label: 'Sponsor' },
  { value: 'calendar', label: 'Calendar' },
  { value: 'quad-view', label: 'Quad View' },
  { value: 'highlight-reel', label: 'Highlight Reel' },
];

// Default values for a new gap fill item
const DEFAULT_GAP_FILL_ITEM = {
  graphicType: 'standings',
  duration: 15,
  background: true,
};

// Default playout rules
const DEFAULT_PLAYOUT_RULES = {
  clipOrder: 'chronological',
  apparatusPriority: null,
  transitionType: 'cut',
  crossfadeDuration: 500,
  gapFillSequence: [],
  gapFillLoop: true,
};

export default function PlayoutRulesEditor({ playoutRules, onChange, disabled = false }) {
  const [rules, setRules] = useState(() => ({
    ...DEFAULT_PLAYOUT_RULES,
    ...playoutRules,
  }));

  // Sync internal state when prop changes
  useEffect(() => {
    setRules({
      ...DEFAULT_PLAYOUT_RULES,
      ...playoutRules,
    });
  }, [playoutRules]);

  // Notify parent of changes
  const updateRules = (updates) => {
    const newRules = { ...rules, ...updates };
    setRules(newRules);
    onChange?.(newRules);
  };


  // Gap fill sequence handlers
  const addGapFillItem = () => {
    const newSequence = [...(rules.gapFillSequence || []), { ...DEFAULT_GAP_FILL_ITEM }];
    updateRules({ gapFillSequence: newSequence });
  };

  const removeGapFillItem = (index) => {
    const newSequence = rules.gapFillSequence.filter((_, i) => i !== index);
    updateRules({ gapFillSequence: newSequence });
  };

  const updateGapFillItem = (index, updates) => {
    const newSequence = rules.gapFillSequence.map((item, i) =>
      i === index ? { ...item, ...updates } : item
    );
    updateRules({ gapFillSequence: newSequence });
  };

  const moveGapFillItem = (fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= rules.gapFillSequence.length) return;
    const newSequence = [...rules.gapFillSequence];
    const [item] = newSequence.splice(fromIndex, 1);
    newSequence.splice(toIndex, 0, item);
    updateRules({ gapFillSequence: newSequence });
  };

  // Validation: at least one gap fill item required
  const isValid = rules.gapFillSequence && rules.gapFillSequence.length > 0;

  return (
    <div className="space-y-4 mt-4 pt-4 border-t border-zinc-700">
      <div className="flex items-center gap-2 mb-2">
        <ArrowPathIcon className="w-4 h-4 text-cyan-400" />
        <span className="text-sm font-medium text-cyan-400 uppercase tracking-wide">
          Playout Rules
        </span>
      </div>

      {/* Clip Order */}
      <div>
        <label className="block text-xs text-zinc-400 mb-1.5">Clip Order</label>
        <select
          value={rules.clipOrder}
          onChange={(e) => updateRules({ clipOrder: e.target.value })}
          disabled={disabled}
          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {CLIP_ORDER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Apparatus Priority */}
      <div>
        <label className="block text-xs text-zinc-400 mb-1.5">Apparatus Priority</label>
        <select
          value={rules.apparatusPriority || ''}
          onChange={(e) => updateRules({ apparatusPriority: e.target.value || null })}
          disabled={disabled}
          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {APPARATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Transition Type */}
      <div>
        <label className="block text-xs text-zinc-400 mb-1.5">Clip Transition</label>
        <select
          value={rules.transitionType}
          onChange={(e) => updateRules({ transitionType: e.target.value })}
          disabled={disabled}
          className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {TRANSITION_OPTIONS.map((opt) => (
            <option
              key={opt.value}
              value={opt.value}
              disabled={opt.disabled}
              title={opt.disabled ? 'Coming soon' : undefined}
            >
              {opt.label}
              {opt.disabled ? ' (Coming soon)' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Crossfade Duration - only shown when crossfade is selected */}
      {rules.transitionType === 'crossfade' && (
        <div>
          <label className="block text-xs text-zinc-400 mb-1.5">
            Crossfade Duration: {rules.crossfadeDuration}ms
          </label>
          <input
            type="range"
            min={100}
            max={2000}
            step={50}
            value={rules.crossfadeDuration}
            onChange={(e) => updateRules({ crossfadeDuration: Number(e.target.value) })}
            disabled={disabled}
            className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <div className="flex justify-between text-xs text-zinc-500 mt-1">
            <span>100ms</span>
            <span>2000ms</span>
          </div>
        </div>
      )}

      {/* Gap Fill Sequence */}
      <div className="border border-zinc-700 rounded-lg p-3 bg-zinc-800/50">
        <label className="block text-xs text-zinc-400 mb-2 uppercase tracking-wide">
          Gap Fill Sequence
        </label>

        {/* Gap fill items list */}
        {rules.gapFillSequence && rules.gapFillSequence.length > 0 ? (
          <div className="space-y-2 mb-3">
            {rules.gapFillSequence.map((item, index) => (
              <GapFillItem
                key={index}
                index={index}
                item={item}
                disabled={disabled}
                onUpdate={(updates) => updateGapFillItem(index, updates)}
                onRemove={() => removeGapFillItem(index)}
                onMoveUp={() => moveGapFillItem(index, index - 1)}
                onMoveDown={() => moveGapFillItem(index, index + 1)}
                isFirst={index === 0}
                isLast={index === rules.gapFillSequence.length - 1}
              />
            ))}
          </div>
        ) : (
          <div className="text-sm text-zinc-500 mb-3 py-2 text-center">
            No gap fill items. Add at least one.
          </div>
        )}

        {/* Add button */}
        <button
          type="button"
          onClick={addGapFillItem}
          disabled={disabled}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 rounded-lg hover:bg-cyan-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <PlusIcon className="w-4 h-4" />
          Add Gap Fill Item
        </button>

        {/* Loop toggle */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-zinc-700">
          <input
            type="checkbox"
            id="gapFillLoop"
            checked={rules.gapFillLoop}
            onChange={(e) => updateRules({ gapFillLoop: e.target.checked })}
            disabled={disabled}
            className="w-4 h-4 rounded border-zinc-700 bg-zinc-800 text-cyan-600 focus:ring-cyan-500 disabled:opacity-50"
          />
          <label htmlFor="gapFillLoop" className="text-sm text-zinc-300">
            Loop sequence
            <span className="text-xs text-zinc-500 ml-1">(otherwise hold on last item)</span>
          </label>
        </div>
      </div>

      {/* Validation warning */}
      {!isValid && (
        <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-sm text-amber-300 flex items-center gap-2">
          <span>Add at least one gap fill item to save this segment.</span>
        </div>
      )}
    </div>
  );
}

/**
 * GapFillItem — Individual item in the gap fill sequence
 */
function GapFillItem({
  index,
  item,
  disabled,
  onUpdate,
  onRemove,
  onMoveUp,
  onMoveDown,
  isFirst,
  isLast,
}) {
  return (
    <div className="flex items-center gap-2 p-2 bg-zinc-900 rounded-lg border border-zinc-700">
      {/* Drag handle / reorder buttons */}
      <div className="flex flex-col gap-0.5">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={disabled || isFirst}
          className="p-0.5 text-zinc-500 hover:text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed"
          title="Move up"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
          </svg>
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={disabled || isLast}
          className="p-0.5 text-zinc-500 hover:text-zinc-300 disabled:opacity-30 disabled:cursor-not-allowed"
          title="Move down"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Index number */}
      <span className="text-xs text-zinc-500 w-4 text-center">{index + 1}.</span>

      {/* Graphic type dropdown */}
      <select
        value={item.graphicType}
        onChange={(e) => onUpdate({ graphicType: e.target.value })}
        disabled={disabled}
        className="flex-1 px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:border-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {GAP_FILL_GRAPHIC_TYPES.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Duration input */}
      <div className="flex items-center gap-1">
        <input
          type="number"
          min={1}
          max={300}
          value={item.duration}
          onChange={(e) => onUpdate({ duration: Number(e.target.value) || 15 })}
          disabled={disabled}
          className="w-14 px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-white text-sm text-center focus:outline-none focus:border-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed"
        />
        <span className="text-xs text-zinc-500">sec</span>
      </div>

      {/* Background toggle */}
      <label className="flex items-center gap-1 cursor-pointer" title="Show as background graphic">
        <input
          type="checkbox"
          checked={item.background}
          onChange={(e) => onUpdate({ background: e.target.checked })}
          disabled={disabled}
          className="w-3.5 h-3.5 rounded border-zinc-700 bg-zinc-800 text-cyan-600 focus:ring-cyan-500 disabled:opacity-50"
        />
        <span className="text-xs text-zinc-400">BG</span>
      </label>

      {/* Remove button */}
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        className="p-1 text-zinc-500 hover:text-red-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Remove item"
      >
        <TrashIcon className="w-4 h-4" />
      </button>
    </div>
  );
}

// Export validation helper for parent component
export function isPlayoutRulesValid(rules) {
  return rules?.gapFillSequence && rules.gapFillSequence.length > 0;
}
