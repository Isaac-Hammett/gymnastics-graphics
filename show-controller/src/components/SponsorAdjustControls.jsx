import { useState } from 'react';

/**
 * Editable number input with increment/decrement stepper buttons.
 * Supports direct typing, arrow buttons, and keyboard up/down.
 */
function StepperInput({ label, value, onChange, min, max, step = 1, suffix = '' }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');

  const clamp = (v) => Math.max(min, Math.min(max, v));

  const startEdit = () => {
    setDraft(String(value));
    setEditing(true);
  };

  const commitEdit = () => {
    const parsed = parseInt(draft, 10);
    if (!isNaN(parsed)) {
      onChange(clamp(parsed));
    }
    setEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      commitEdit();
    } else if (e.key === 'Escape') {
      setEditing(false);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const parsed = parseInt(draft, 10);
      if (!isNaN(parsed)) {
        const newVal = clamp(parsed + step);
        setDraft(String(newVal));
        onChange(newVal);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const parsed = parseInt(draft, 10);
      if (!isNaN(parsed)) {
        const newVal = clamp(parsed - step);
        setDraft(String(newVal));
        onChange(newVal);
      }
    }
  };

  return (
    <div className="flex flex-col gap-0.5">
      <label className="text-[10px] text-zinc-500">{label}</label>
      <div className="flex items-center gap-0.5">
        <button
          onClick={() => onChange(clamp(value - step))}
          className="w-5 h-6 flex items-center justify-center bg-zinc-700 hover:bg-zinc-600 rounded-l text-zinc-300 text-xs font-bold transition-colors select-none"
          title={`Decrease ${label}`}
        >
          −
        </button>
        {editing ? (
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
            autoFocus
            className="w-14 h-6 text-center text-[11px] font-mono bg-zinc-800 text-white border border-blue-500 outline-none rounded-none"
          />
        ) : (
          <button
            onClick={startEdit}
            className="w-14 h-6 text-center text-[11px] font-mono bg-zinc-800 text-zinc-300 border border-zinc-600 hover:border-zinc-400 cursor-text rounded-none transition-colors"
            title="Click to type a value"
          >
            {value}{suffix}
          </button>
        )}
        <button
          onClick={() => onChange(clamp(value + step))}
          className="w-5 h-6 flex items-center justify-center bg-zinc-700 hover:bg-zinc-600 rounded-r text-zinc-300 text-xs font-bold transition-colors select-none"
          title={`Increase ${label}`}
        >
          +
        </button>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-1 accent-blue-500 mt-0.5"
      />
    </div>
  );
}

/**
 * Sponsor adjustment controls panel.
 * Primary control is crop box. Scale/offset available under "Advanced".
 */
export default function SponsorAdjustControls({
  sponsors,
  getOverride,
  onUpdate,
  selectedIndex,
  onSelectIndex,
  showBounds,
  onToggleBounds,
  showGuides,
  onToggleGuides,
}) {
  const [showAdvanced, setShowAdvanced] = useState({});

  return (
    <div className="mb-4 p-3 bg-zinc-800 border border-zinc-700 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-zinc-300">Sponsor Logo Adjustments</h3>
      </div>
      <p className="text-[10px] text-zinc-500 mb-2">
        Select a logo to freeze it. Adjust the crop to control what part of the source image is used.
      </p>

      {/* Global toggles */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-3 pb-2 border-b border-zinc-700">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={showGuides}
            onChange={onToggleGuides}
            className="w-3.5 h-3.5 accent-yellow-500 cursor-pointer"
          />
          <span className="text-[11px] text-zinc-400">Guides</span>
        </label>
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={showBounds}
            onChange={onToggleBounds}
            className="w-3.5 h-3.5 accent-pink-500 cursor-pointer"
          />
          <span className="text-[11px] text-zinc-400">Bounding Box</span>
        </label>
        {selectedIndex >= 0 && (
          <button
            onClick={() => onSelectIndex(-1)}
            className="ml-auto text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
          >
            Unlock (resume cycling)
          </button>
        )}
      </div>

      <div className="space-y-2 max-h-[500px] overflow-y-auto">
        {sponsors.slice(0, 8).map((sponsor, index) => {
          const ov = getOverride(index);
          const isSelected = selectedIndex === index;
          const hasCrop = ov.cropX != null || ov.cropY != null || ov.cropW != null || ov.cropH != null;
          const hasAdvanced = (ov.scale ?? 100) !== 100 || (ov.offsetX ?? 0) !== 0 || (ov.offsetY ?? 0) !== 0;

          return (
            <div
              key={index}
              className={`p-2 rounded-lg transition-colors ${
                isSelected
                  ? 'bg-blue-950 border border-blue-700'
                  : 'bg-zinc-900 border border-transparent hover:border-zinc-700'
              }`}
            >
              {/* Sponsor header with select button */}
              <div className="flex items-center gap-2 mb-2">
                <button
                  onClick={() => onSelectIndex(isSelected ? -1 : index)}
                  className={`flex-shrink-0 w-6 h-6 rounded flex items-center justify-center text-xs font-bold transition-colors ${
                    isSelected
                      ? 'bg-blue-600 text-white'
                      : 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600 hover:text-zinc-200'
                  }`}
                  title={isSelected ? 'Unlock this sponsor' : 'Lock to this sponsor'}
                >
                  {isSelected ? '🔒' : index + 1}
                </button>
                {sponsor.url && (
                  <img
                    src={sponsor.url}
                    alt={sponsor.name || 'Sponsor'}
                    className="w-8 h-8 object-contain bg-white rounded flex-shrink-0"
                    onError={(e) => e.target.style.display = 'none'}
                  />
                )}
                <span className="text-xs text-zinc-300 font-medium truncate flex-1">
                  {sponsor.name || `Sponsor ${index + 1}`}
                </span>
                {hasCrop && <span className="text-[9px] text-green-400 flex-shrink-0">CROP</span>}
                {hasAdvanced && <span className="text-[9px] text-yellow-400 flex-shrink-0">ADJ</span>}
              </div>

              {/* Crop box controls — always visible for selected sponsor */}
              {isSelected && (
                <>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-zinc-400 font-medium">Crop (source image pixels)</span>
                    {hasCrop && (
                      <button
                        onClick={() => {
                          onUpdate(index, { cropX: null, cropY: null, cropW: null, cropH: null });
                        }}
                        className="text-[10px] text-red-400 hover:text-red-300"
                      >
                        Reset to Auto
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    <StepperInput
                      label="X"
                      value={ov.cropX ?? 0}
                      onChange={(v) => onUpdate(index, 'cropX', v)}
                      min={0}
                      max={5000}
                      step={10}
                    />
                    <StepperInput
                      label="Y"
                      value={ov.cropY ?? 0}
                      onChange={(v) => onUpdate(index, 'cropY', v)}
                      min={0}
                      max={5000}
                      step={10}
                    />
                    <StepperInput
                      label="W"
                      value={ov.cropW ?? 0}
                      onChange={(v) => onUpdate(index, 'cropW', v)}
                      min={10}
                      max={5000}
                      step={10}
                    />
                    <StepperInput
                      label="H"
                      value={ov.cropH ?? 0}
                      onChange={(v) => onUpdate(index, 'cropH', v)}
                      min={10}
                      max={5000}
                      step={10}
                    />
                  </div>

                  {/* Advanced: scale/offset — collapsed by default */}
                  <button
                    onClick={() => setShowAdvanced(prev => ({ ...prev, [index]: !prev[index] }))}
                    className="mt-2 text-[10px] text-zinc-500 hover:text-zinc-400 transition-colors"
                  >
                    {showAdvanced[index] ? '▾ Hide' : '▸ Show'} Scale & Offset
                    {hasAdvanced && ' (modified)'}
                  </button>
                  {showAdvanced[index] && (
                    <div className="mt-1 pt-1 border-t border-zinc-700/50 grid grid-cols-3 gap-2">
                      <StepperInput
                        label="Scale"
                        value={ov.scale ?? 100}
                        onChange={(v) => onUpdate(index, 'scale', v)}
                        min={10}
                        max={300}
                        step={5}
                        suffix="%"
                      />
                      <StepperInput
                        label="X Offset"
                        value={ov.offsetX ?? 0}
                        onChange={(v) => onUpdate(index, 'offsetX', v)}
                        min={-500}
                        max={500}
                        step={5}
                        suffix="px"
                      />
                      <StepperInput
                        label="Y Offset"
                        value={ov.offsetY ?? 0}
                        onChange={(v) => onUpdate(index, 'offsetY', v)}
                        min={-500}
                        max={500}
                        step={5}
                        suffix="px"
                      />
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
