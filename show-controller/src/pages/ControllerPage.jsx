import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useCompetition } from '../hooks/useCompetitions';
import { graphicButtons, graphicNames, getApparatusButtons, eventFrameIds, isMensCompetition } from '../lib/graphicButtons';

// Fields that can be locked to prevent auto-sync from RTN stats
const LOCKABLE_FIELDS = [
  'team1Ave', 'team1High', 'team1Con', 'team1Coaches',
  'team2Ave', 'team2High', 'team2Con', 'team2Coaches',
];

export default function ControllerPage() {
  const [searchParams] = useSearchParams();
  const compId = searchParams.get('comp');

  const { config, currentGraphic, loading, updateConfig, setGraphic, clearGraphic } = useCompetition(compId);
  const [toast, setToast] = useState('');
  const [formData, setFormData] = useState({});
  const locksRef = useRef({});

  // Derive locks from config (lives at config._locks in Firebase)
  const locks = config?._locks || {};
  locksRef.current = locks;

  // Toggle lock for a field
  const toggleLock = useCallback(async (fieldName) => {
    const currentlyLocked = locksRef.current[fieldName] === true;
    const newLockValue = !currentlyLocked;
    // Write to Firebase: _locks/{fieldName} = true/false
    // If unlocking, remove the key by setting null
    await updateConfig({ [`_locks/${fieldName}`]: newLockValue || null });
  }, [updateConfig]);

  // Handle field change with auto-lock: when user manually edits a lockable field, engage the lock
  const handleFieldChange = useCallback((fieldName, value) => {
    setFormData(prev => ({ ...prev, [fieldName]: value }));
    // Auto-lock on manual edit for lockable fields
    if (LOCKABLE_FIELDS.includes(fieldName) && !locksRef.current[fieldName]) {
      updateConfig({ [`_locks/${fieldName}`]: true });
    }
  }, [updateConfig]);

  // Initialize form data when config loads
  useEffect(() => {
    if (config) {
      setFormData({
        eventName: config.eventName || '',
        meetDate: config.meetDate || '',
        venue: config.venue || '',
        location: config.location || '',
        hosts: config.hosts || '',
        team1Name: config.team1Name || '',
        team1Logo: config.team1Logo || '',
        team1Ave: config.team1Ave || '',
        team1High: config.team1High || '',
        team1Con: config.team1Con || '',
        team1Coaches: config.team1Coaches || '',
        team2Name: config.team2Name || '',
        team2Logo: config.team2Logo || '',
        team2Ave: config.team2Ave || '',
        team2High: config.team2High || '',
        team2Con: config.team2Con || '',
        team2Coaches: config.team2Coaches || '',
      });
    }
  }, [config]);

  const showToast = useCallback((message) => {
    setToast(message);
    setTimeout(() => setToast(''), 2000);
  }, []);

  const handleSendGraphic = useCallback(async (graphicId, frameTitle = null) => {
    const data = { ...formData };
    if (frameTitle) {
      data.frameTitle = frameTitle;
    }

    let graphicType = graphicId;
    if (eventFrameIds.includes(graphicId)) {
      graphicType = 'event-frame';
    }

    await setGraphic(graphicType, data);
    showToast(`Showing: ${graphicNames[graphicId] || graphicId}`);
  }, [formData, setGraphic, showToast]);

  const handleClear = useCallback(async () => {
    await clearGraphic();
    showToast('Graphic cleared');
  }, [clearGraphic, showToast]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.key === 'Escape' || e.key === ' ') {
        e.preventDefault();
        handleClear();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleClear]);

  if (!compId) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-zinc-400 mb-4">No competition ID specified.</p>
          <Link to="/" className="text-blue-500 hover:underline">
            Go to Home
          </Link>
        </div>
      </div>
    );
  }

  const activeGraphicId = currentGraphic?.graphic === 'event-frame'
    ? currentGraphic?.data?.frameTitle
    : currentGraphic?.graphic;

  const apparatusButtons = getApparatusButtons(config?.compType);

  return (
    <div className="h-screen bg-zinc-950 flex">
      {/* Config Panel */}
      <div className="w-80 bg-zinc-900 border-r border-zinc-800 p-5 overflow-y-auto flex-shrink-0">
        <Link
          to="/"
          className="flex items-center gap-2 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-zinc-300 text-xs hover:bg-zinc-700 transition-colors mb-4"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          Back to Hub
        </Link>

        <div className="mb-5">
          <h1 className="text-lg font-bold text-white mb-1">Meet Setup</h1>
          <p className="text-xs text-zinc-500">Configure before going live</p>
        </div>

        <ConfigSection title="Event Info">
          <ConfigInput
            label="Event Name"
            value={formData.eventName}
            onChange={(v) => setFormData({ ...formData, eventName: v })}
          />
          <ConfigInput
            label="Meet Date"
            value={formData.meetDate}
            onChange={(v) => setFormData({ ...formData, meetDate: v })}
          />
          <ConfigInput
            label="Venue"
            value={formData.venue}
            onChange={(v) => setFormData({ ...formData, venue: v })}
          />
          <ConfigInput
            label="Location"
            value={formData.location}
            onChange={(v) => setFormData({ ...formData, location: v })}
          />
          <ConfigTextarea
            label="Hosts (one per line)"
            value={formData.hosts}
            onChange={(v) => setFormData({ ...formData, hosts: v })}
            rows={2}
          />
        </ConfigSection>

        <ConfigSection title="Team 1">
          <ConfigInput
            label="Name"
            value={formData.team1Name}
            onChange={(v) => setFormData({ ...formData, team1Name: v })}
          />
          <ConfigInput
            label="Logo URL"
            value={formData.team1Logo}
            onChange={(v) => setFormData({ ...formData, team1Logo: v })}
            placeholder="https://..."
          />
          <div className="flex gap-1">
            <LockableInput
              label="AVE"
              fieldName="team1Ave"
              value={formData.team1Ave}
              locked={locks.team1Ave}
              onChange={handleFieldChange}
              onToggleLock={toggleLock}
            />
            <LockableInput
              label="HIGH"
              fieldName="team1High"
              value={formData.team1High}
              locked={locks.team1High}
              onChange={handleFieldChange}
              onToggleLock={toggleLock}
            />
            <LockableInput
              label="CON"
              fieldName="team1Con"
              value={formData.team1Con}
              locked={locks.team1Con}
              onChange={handleFieldChange}
              onToggleLock={toggleLock}
            />
          </div>
          <LockableTextarea
            label="Coaches"
            fieldName="team1Coaches"
            value={formData.team1Coaches}
            locked={locks.team1Coaches}
            onChange={handleFieldChange}
            onToggleLock={toggleLock}
            rows={3}
          />
        </ConfigSection>

        <ConfigSection title="Team 2">
          <ConfigInput
            label="Name"
            value={formData.team2Name}
            onChange={(v) => setFormData({ ...formData, team2Name: v })}
          />
          <ConfigInput
            label="Logo URL"
            value={formData.team2Logo}
            onChange={(v) => setFormData({ ...formData, team2Logo: v })}
            placeholder="https://..."
          />
          <div className="flex gap-1">
            <LockableInput
              label="AVE"
              fieldName="team2Ave"
              value={formData.team2Ave}
              locked={locks.team2Ave}
              onChange={handleFieldChange}
              onToggleLock={toggleLock}
            />
            <LockableInput
              label="HIGH"
              fieldName="team2High"
              value={formData.team2High}
              locked={locks.team2High}
              onChange={handleFieldChange}
              onToggleLock={toggleLock}
            />
            <LockableInput
              label="CON"
              fieldName="team2Con"
              value={formData.team2Con}
              locked={locks.team2Con}
              onChange={handleFieldChange}
              onToggleLock={toggleLock}
            />
          </div>
          <LockableTextarea
            label="Coaches"
            fieldName="team2Coaches"
            value={formData.team2Coaches}
            locked={locks.team2Coaches}
            onChange={handleFieldChange}
            onToggleLock={toggleLock}
            rows={3}
          />
        </ConfigSection>
      </div>

      {/* Main Controller */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Status Bar */}
        <div className="px-6 py-3 bg-zinc-900 border-b border-zinc-800 flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-zinc-400">Connected</span>
          </div>
          <div className="flex-1 text-center text-xs text-zinc-500">
            Competition: <span className="text-blue-500 font-semibold">{compId.toUpperCase()}</span>
          </div>
          <div className="text-sm text-zinc-300">
            Current: <span className="text-blue-500 font-semibold">
              {graphicNames[activeGraphicId] || 'None'}
            </span>
          </div>
        </div>

        {/* Control Area */}
        <div className="flex-1 p-6 overflow-y-auto">
          <ButtonSection title="Pre-Meet Graphics">
            {graphicButtons.preMeet.map((btn) => (
              <GraphicButton
                key={btn.id}
                {...btn}
                active={activeGraphicId === btn.id}
                onClick={() => handleSendGraphic(btn.id)}
              />
            ))}
          </ButtonSection>

          <ButtonSection title="Event Frames">
            {apparatusButtons.map((btn) => (
              <GraphicButton
                key={btn.id}
                {...btn}
                active={activeGraphicId === btn.id}
                onClick={() => handleSendGraphic(btn.id, btn.title)}
              />
            ))}
          </ButtonSection>

          <ButtonSection title="Stream">
            {graphicButtons.stream.map((btn) => (
              <GraphicButton
                key={btn.id}
                {...btn}
                active={activeGraphicId === btn.id}
                onClick={() => handleSendGraphic(btn.id)}
              />
            ))}
          </ButtonSection>
        </div>

        {/* Clear Button */}
        <div className="p-5 bg-zinc-900 border-t border-zinc-800">
          <button
            onClick={handleClear}
            className="w-full py-4 bg-red-600 hover:bg-red-500 text-white text-lg font-bold rounded-xl transition-colors"
          >
            CLEAR GRAPHIC
          </button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 px-6 py-3 bg-green-500 text-white rounded-lg font-medium shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

function ConfigSection({ title, children }) {
  return (
    <div className="mb-6">
      <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-3">{title}</div>
      {children}
    </div>
  );
}

function ConfigInput({ label, value, onChange, placeholder }) {
  return (
    <div className="mb-3">
      <label className="block text-xs text-zinc-500 mb-1">{label}</label>
      <input
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-2.5 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-white text-sm focus:outline-none focus:border-blue-500"
      />
    </div>
  );
}

function ConfigTextarea({ label, value, onChange, rows = 2 }) {
  return (
    <div className="mb-3">
      <label className="block text-xs text-zinc-500 mb-1">{label}</label>
      <textarea
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        className="w-full px-2.5 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-white text-sm focus:outline-none focus:border-blue-500 resize-none"
      />
    </div>
  );
}

function LockIcon({ locked, onClick }) {
  return (
    <button
      onClick={onClick}
      title={locked ? 'Locked (manual override) — click to unlock' : 'Unlocked (auto-sync enabled) — click to lock'}
      className={`ml-1 p-0 transition-colors ${
        locked ? 'text-amber-400 hover:text-amber-300' : 'text-zinc-600 hover:text-zinc-400'
      }`}
    >
      {locked ? (
        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4" fill="none" strokeWidth="2"/>
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 9.9-1"/>
        </svg>
      )}
    </button>
  );
}

function LockableInput({ label, fieldName, value, locked, onChange, onToggleLock, placeholder }) {
  return (
    <div className="mb-3">
      <div className="flex items-center mb-1">
        <label className="block text-xs text-zinc-500">{label}</label>
        <LockIcon locked={locked} onClick={() => onToggleLock(fieldName)} />
        {locked && <span className="ml-1 text-[9px] text-amber-400/70">Manual</span>}
      </div>
      <input
        type="text"
        value={value || ''}
        onChange={(e) => onChange(fieldName, e.target.value)}
        placeholder={placeholder}
        className={`w-full px-2.5 py-2 bg-zinc-800 border rounded-md text-white text-sm focus:outline-none focus:border-blue-500 ${
          locked ? 'border-amber-500/30' : 'border-zinc-700'
        }`}
      />
    </div>
  );
}

function LockableTextarea({ label, fieldName, value, locked, onChange, onToggleLock, rows = 2 }) {
  return (
    <div className="mb-3">
      <div className="flex items-center mb-1">
        <label className="block text-xs text-zinc-500">{label}</label>
        <LockIcon locked={locked} onClick={() => onToggleLock(fieldName)} />
        {locked && <span className="ml-1 text-[9px] text-amber-400/70">Manual</span>}
      </div>
      <textarea
        value={value || ''}
        onChange={(e) => onChange(fieldName, e.target.value)}
        rows={rows}
        className={`w-full px-2.5 py-2 bg-zinc-800 border rounded-md text-white text-sm focus:outline-none focus:border-blue-500 resize-none ${
          locked ? 'border-amber-500/30' : 'border-zinc-700'
        }`}
      />
    </div>
  );
}

function ButtonSection({ title, children }) {
  return (
    <div className="mb-8">
      <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-3">{title}</div>
      <div className="grid grid-cols-4 lg:grid-cols-6 xl:grid-cols-8 gap-2">
        {children}
      </div>
    </div>
  );
}

function GraphicButton({ id, label, number, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-4 rounded-xl text-sm font-medium transition-all ${
        active
          ? 'bg-blue-600 border-2 border-blue-500 text-white'
          : 'bg-zinc-800 border-2 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:border-zinc-600'
      }`}
    >
      <span className={`block text-xs mb-1 ${active ? 'text-blue-200' : 'text-zinc-500'}`}>{number}</span>
      {label}
    </button>
  );
}
