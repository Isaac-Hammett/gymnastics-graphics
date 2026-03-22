import { useState, useEffect } from 'react';
import {
  PlusIcon,
  TrashIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';

/**
 * ContentSequenceEditor — Configuration panel for content-sequence type segments
 *
 * Allows producers to configure:
 * - Ordered list of content items (graphic type, duration, background, skip-if-no-data)
 * - Graphic-specific parameters
 * - Advance condition selector
 *
 * Data shape:
 * {
 *   contentSequence: [
 *     { graphicType, duration, background, skipIfNoData, params }
 *   ],
 *   advanceCondition: 'next-rotation-detected' | 'all-complete' | 'manual'
 * }
 */

// Graphic types for content sequence
const CONTENT_GRAPHIC_TYPES = [
  { value: 'event-summary', label: 'Event Summary', dataDependent: true },
  { value: 'standings', label: 'Standings', dataDependent: false },
  { value: 'sponsor', label: 'Sponsor', dataDependent: false },
  { value: 'calendar', label: 'Calendar', dataDependent: false },
  { value: 'quad-view', label: 'Quad View', dataDependent: false },
  { value: 'highlight-reel', label: 'Highlight Reel', dataDependent: true },
];

// Advance condition options with tooltips
const ADVANCE_CONDITIONS = [
  {
    value: 'next-rotation-detected',
    label: 'Next rotation scores detected (Virtius API)',
    tooltip: 'Advances when new rotation scores appear in the Virtius API. Falls back to manual advance if API is unavailable.',
  },
  {
    value: 'all-complete',
    label: 'All content items complete (hold items wait for advance)',
    tooltip: 'Advances after all items have played their duration. Items with "hold" duration wait for manual advance or next condition.',
  },
  {
    value: 'manual',
    label: 'Manual advance only',
    tooltip: 'Segment stays active until the producer manually advances to the next segment.',
  },
];

// Default values for a new content item
const DEFAULT_CONTENT_ITEM = {
  graphicType: 'sponsor',
  duration: 10,
  background: true,
  skipIfNoData: false,
  params: {},
};

// Default content sequence configuration
const DEFAULT_CONTENT_SEQUENCE = {
  contentSequence: [],
  advanceCondition: 'next-rotation-detected',
};

// Duration constraints per PRD
const MIN_DURATION = 5;
const MAX_DURATION = 300;

export default function ContentSequenceEditor({ contentConfig, onChange, disabled = false }) {
  const [config, setConfig] = useState(() => ({
    ...DEFAULT_CONTENT_SEQUENCE,
    ...contentConfig,
  }));

  // Sync internal state when prop changes
  useEffect(() => {
    setConfig({
      ...DEFAULT_CONTENT_SEQUENCE,
      ...contentConfig,
    });
  }, [contentConfig]);

  // Notify parent of changes
  const updateConfig = (updates) => {
    const newConfig = { ...config, ...updates };
    setConfig(newConfig);
    onChange?.(newConfig);
  };

  // Content item handlers
  const addContentItem = () => {
    const newSequence = [...(config.contentSequence || []), { ...DEFAULT_CONTENT_ITEM }];
    updateConfig({ contentSequence: newSequence });
  };

  const removeContentItem = (index) => {
    const newSequence = config.contentSequence.filter((_, i) => i !== index);
    updateConfig({ contentSequence: newSequence });
  };

  const updateContentItem = (index, updates) => {
    const newSequence = config.contentSequence.map((item, i) =>
      i === index ? { ...item, ...updates } : item
    );
    updateConfig({ contentSequence: newSequence });
  };

  const moveContentItem = (fromIndex, toIndex) => {
    if (toIndex < 0 || toIndex >= config.contentSequence.length) return;
    const newSequence = [...config.contentSequence];
    const [item] = newSequence.splice(fromIndex, 1);
    newSequence.splice(toIndex, 0, item);
    updateConfig({ contentSequence: newSequence });
  };

  // Validation: at least one content item required
  const isValid = config.contentSequence && config.contentSequence.length > 0;

  return (
    <div className="space-y-4 mt-4 pt-4 border-t border-zinc-700">
      <div className="flex items-center gap-2 mb-2">
        <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
        <span className="text-sm font-medium text-amber-400 uppercase tracking-wide">
          Content Sequence
        </span>
      </div>

      {/* Content items list */}
      <div className="border border-zinc-700 rounded-lg p-3 bg-zinc-800/50">
        <label className="block text-xs text-zinc-400 mb-2 uppercase tracking-wide">
          Content Items
        </label>

        {config.contentSequence && config.contentSequence.length > 0 ? (
          <div className="space-y-2 mb-3">
            {config.contentSequence.map((item, index) => (
              <ContentItem
                key={index}
                index={index}
                item={item}
                disabled={disabled}
                onUpdate={(updates) => updateContentItem(index, updates)}
                onRemove={() => removeContentItem(index)}
                onMoveUp={() => moveContentItem(index, index - 1)}
                onMoveDown={() => moveContentItem(index, index + 1)}
                isFirst={index === 0}
                isLast={index === config.contentSequence.length - 1}
              />
            ))}
          </div>
        ) : (
          <div className="text-sm text-zinc-500 mb-3 py-2 text-center">
            No content items. Add at least one.
          </div>
        )}

        {/* Add button */}
        <button
          type="button"
          onClick={addContentItem}
          disabled={disabled}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg hover:bg-amber-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <PlusIcon className="w-4 h-4" />
          Add Content Item
        </button>
      </div>

      {/* Advance Condition Selector */}
      <div className="border border-zinc-700 rounded-lg p-3 bg-zinc-800/50">
        <label className="block text-xs text-zinc-400 mb-2 uppercase tracking-wide">
          Auto-advance to next segment when
        </label>
        <div className="space-y-2">
          {ADVANCE_CONDITIONS.map((condition) => (
            <label
              key={condition.value}
              className="flex items-start gap-2 cursor-pointer group"
              title={condition.tooltip}
            >
              <input
                type="radio"
                name="advanceCondition"
                value={condition.value}
                checked={config.advanceCondition === condition.value}
                onChange={(e) => updateConfig({ advanceCondition: e.target.value })}
                disabled={disabled}
                className="mt-0.5 w-4 h-4 text-amber-600 border-zinc-600 bg-zinc-800 focus:ring-amber-500 disabled:opacity-50"
              />
              <div className="flex-1">
                <span className="text-sm text-zinc-200 group-hover:text-white transition-colors">
                  {condition.label}
                </span>
                <div className="flex items-center gap-1 mt-0.5">
                  <InformationCircleIcon className="w-3 h-3 text-zinc-500" />
                  <span className="text-xs text-zinc-500">{condition.tooltip}</span>
                </div>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Validation warning */}
      {!isValid && (
        <div className="p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-sm text-amber-300 flex items-center gap-2">
          <span>Add at least one content item to save this segment.</span>
        </div>
      )}
    </div>
  );
}

/**
 * ContentItem — Individual item in the content sequence
 */
function ContentItem({
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
  // Determine if this graphic type is data-dependent (affects skip-if-no-data default)
  const graphicTypeInfo = CONTENT_GRAPHIC_TYPES.find(t => t.value === item.graphicType);
  const isDataDependent = graphicTypeInfo?.dataDependent || false;

  // Handle graphic type change - update skipIfNoData default based on type
  const handleGraphicTypeChange = (newType) => {
    const newTypeInfo = CONTENT_GRAPHIC_TYPES.find(t => t.value === newType);
    const newSkipDefault = newTypeInfo?.dataDependent || false;
    onUpdate({
      graphicType: newType,
      skipIfNoData: newSkipDefault,
      params: {}, // Reset params when type changes
    });
  };

  // Handle duration change - supports number, null (hold), or 'auto'
  const handleDurationChange = (e) => {
    const value = e.target.value;
    if (value === 'hold') {
      onUpdate({ duration: null });
    } else if (value === 'auto') {
      onUpdate({ duration: 'auto' });
    } else {
      const numValue = parseInt(value, 10);
      if (!isNaN(numValue)) {
        // Clamp to valid range
        const clampedValue = Math.max(MIN_DURATION, Math.min(MAX_DURATION, numValue));
        onUpdate({ duration: clampedValue });
      }
    }
  };

  // Determine current duration display value
  const getDurationValue = () => {
    if (item.duration === null) return 'hold';
    if (item.duration === 'auto') return 'auto';
    return item.duration;
  };

  // Check if auto duration is allowed for this type
  const allowsAutoDuration = item.graphicType === 'highlight-reel';

  return (
    <div className="flex flex-col gap-2 p-2 bg-zinc-900 rounded-lg border border-zinc-700">
      {/* Main row: reorder, index, type, duration, toggles, remove */}
      <div className="flex items-center gap-2">
        {/* Reorder buttons */}
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
          onChange={(e) => handleGraphicTypeChange(e.target.value)}
          disabled={disabled}
          className="flex-1 px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:border-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {CONTENT_GRAPHIC_TYPES.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* Duration input/select */}
        <div className="flex items-center gap-1">
          {typeof item.duration === 'number' ? (
            <>
              <input
                type="number"
                min={MIN_DURATION}
                max={MAX_DURATION}
                value={item.duration}
                onChange={handleDurationChange}
                disabled={disabled}
                className="w-14 px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-white text-sm text-center focus:outline-none focus:border-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <span className="text-xs text-zinc-500">sec</span>
            </>
          ) : (
            <select
              value={getDurationValue()}
              onChange={handleDurationChange}
              disabled={disabled}
              className="w-20 px-2 py-1.5 bg-zinc-800 border border-zinc-700 rounded text-white text-sm focus:outline-none focus:border-amber-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <option value="hold">hold</option>
              {allowsAutoDuration && <option value="auto">auto</option>}
              <option value="10">10 sec</option>
            </select>
          )}
          {/* Toggle between number and hold/auto */}
          {typeof item.duration === 'number' ? (
            <button
              type="button"
              onClick={() => onUpdate({ duration: null })}
              disabled={disabled}
              className="p-1 text-zinc-500 hover:text-amber-400 transition-colors disabled:opacity-50"
              title="Switch to hold/auto"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onUpdate({ duration: 10 })}
              disabled={disabled}
              className="p-1 text-zinc-500 hover:text-amber-400 transition-colors disabled:opacity-50"
              title="Switch to fixed duration"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
              </svg>
            </button>
          )}
        </div>

        {/* Background toggle */}
        <label
          className="flex items-center gap-1 cursor-pointer"
          title="Show animated background behind graphic (covers camera feed)"
        >
          <input
            type="checkbox"
            checked={item.background}
            onChange={(e) => onUpdate({ background: e.target.checked })}
            disabled={disabled}
            className="w-3.5 h-3.5 rounded border-zinc-700 bg-zinc-800 text-amber-600 focus:ring-amber-500 disabled:opacity-50"
          />
          <span className="text-xs text-zinc-400">BG</span>
        </label>

        {/* Skip if no data toggle */}
        <label
          className="flex items-center gap-1 cursor-pointer"
          title="Skip this item if no data is available to display"
        >
          <input
            type="checkbox"
            checked={item.skipIfNoData}
            onChange={(e) => onUpdate({ skipIfNoData: e.target.checked })}
            disabled={disabled}
            className="w-3.5 h-3.5 rounded border-zinc-700 bg-zinc-800 text-amber-600 focus:ring-amber-500 disabled:opacity-50"
          />
          <span className="text-xs text-zinc-400" title="Skip if no data">Skip∅</span>
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

      {/* Graphic params row - shown for certain graphic types */}
      <GraphicParams
        graphicType={item.graphicType}
        params={item.params || {}}
        onUpdate={(newParams) => onUpdate({ params: newParams })}
        disabled={disabled}
      />
    </div>
  );
}

/**
 * GraphicParams — Type-specific parameter inputs for content items
 */
function GraphicParams({ graphicType, params, onUpdate, disabled }) {
  // Only show params for types that have configurable options
  switch (graphicType) {
    case 'event-summary':
      return (
        <div className="flex items-center gap-3 pl-8 text-xs">
          <label className="flex items-center gap-1.5">
            <span className="text-zinc-500">Rotation:</span>
            <select
              value={params.rotation || 'current'}
              onChange={(e) => onUpdate({ ...params, rotation: e.target.value })}
              disabled={disabled}
              className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-xs focus:outline-none focus:border-amber-500 disabled:opacity-50"
            >
              <option value="current">Current</option>
              <option value="1">Rotation 1</option>
              <option value="2">Rotation 2</option>
              <option value="3">Rotation 3</option>
              <option value="4">Rotation 4</option>
              <option value="5">Rotation 5</option>
              <option value="6">Rotation 6</option>
            </select>
          </label>
        </div>
      );

    case 'sponsor':
      return (
        <div className="flex items-center gap-3 pl-8 text-xs">
          <label className="flex items-center gap-1.5">
            <span className="text-zinc-500">Sponsor ID:</span>
            <input
              type="text"
              value={params.sponsorId || ''}
              onChange={(e) => onUpdate({ ...params, sponsorId: e.target.value })}
              placeholder="(auto)"
              disabled={disabled}
              className="w-24 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-xs focus:outline-none focus:border-amber-500 disabled:opacity-50"
            />
          </label>
        </div>
      );

    case 'calendar':
      return (
        <div className="flex items-center gap-3 pl-8 text-xs">
          <label className="flex items-center gap-1.5">
            <span className="text-zinc-500">Days ahead:</span>
            <input
              type="number"
              min={1}
              max={30}
              value={params.daysAhead || 7}
              onChange={(e) => onUpdate({ ...params, daysAhead: parseInt(e.target.value, 10) || 7 })}
              disabled={disabled}
              className="w-14 px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-xs text-center focus:outline-none focus:border-amber-500 disabled:opacity-50"
            />
          </label>
        </div>
      );

    case 'highlight-reel':
      return (
        <div className="flex items-center gap-3 pl-8 text-xs">
          <label className="flex items-center gap-1.5">
            <span className="text-zinc-500">Source:</span>
            <select
              value={params.source || 'rotation'}
              onChange={(e) => onUpdate({ ...params, source: e.target.value })}
              disabled={disabled}
              className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-xs focus:outline-none focus:border-amber-500 disabled:opacity-50"
            >
              <option value="rotation">Current Rotation</option>
              <option value="team">Selected Team</option>
              <option value="all">All Available</option>
            </select>
          </label>
        </div>
      );

    case 'quad-view':
      return (
        <div className="flex items-center gap-3 pl-8 text-xs">
          <label className="flex items-center gap-1.5">
            <span className="text-zinc-500">Layout:</span>
            <select
              value={params.layout || '2x2'}
              onChange={(e) => onUpdate({ ...params, layout: e.target.value })}
              disabled={disabled}
              className="px-2 py-1 bg-zinc-800 border border-zinc-700 rounded text-white text-xs focus:outline-none focus:border-amber-500 disabled:opacity-50"
            >
              <option value="2x2">2x2 Grid</option>
              <option value="1+3">1 Large + 3 Small</option>
            </select>
          </label>
        </div>
      );

    // standings has no special params
    default:
      return null;
  }
}

// Export validation helper for parent component
export function isContentSequenceValid(config) {
  return config?.contentSequence && config.contentSequence.length > 0;
}
