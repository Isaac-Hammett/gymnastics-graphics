import { useState, useEffect } from 'react';
import {
  ArrowPathIcon,
  PlayIcon,
  XMarkIcon,
  ChevronDownIcon
} from '@heroicons/react/24/solid';
import { useOBS } from '../../context/OBSContext';
import { useAutoRefreshScreenshot } from '../../hooks/useAutoRefreshScreenshot';

/**
 * StudioModePanel - Dual preview/program view for OBS Studio Mode
 * PRD-OBS-11: Advanced Features
 */

// Size presets for screenshot windows
const SIZE_PRESETS = {
  small:  { width: 320,  height: 180, label: 'Small (320×180)' },
  medium: { width: 640,  height: 360, label: 'Medium (640×360)' },
  large:  { width: 960,  height: 540, label: 'Large (960×540)' },
  xlarge: { width: 1280, height: 720, label: 'Extra Large (1280×720)' }
};

// Local storage key for size preference
const SIZE_STORAGE_KEY = 'obs-studio-mode-screenshot-size';

export default function StudioModePanel({ onExit }) {
  const {
    obsState,
    obsConnected,
    setPreviewScene,
    transitionToProgram
  } = useOBS();

  const scenes = obsState?.scenes || [];
  const currentScene = obsState?.currentScene;
  const previewScene = obsState?.previewScene;

  // Screenshot size state with persistence
  const [screenshotSize, setScreenshotSize] = useState(() => {
    const saved = localStorage.getItem(SIZE_STORAGE_KEY);
    return saved && SIZE_PRESETS[saved] ? saved : 'medium';
  });

  // Save size preference when changed
  useEffect(() => {
    localStorage.setItem(SIZE_STORAGE_KEY, screenshotSize);
  }, [screenshotSize]);

  // Responsive size limiting
  useEffect(() => {
    const handleResize = () => {
      const width = window.innerWidth;
      if (width < 900 && (screenshotSize === 'large' || screenshotSize === 'xlarge')) {
        setScreenshotSize('medium');
      } else if (width < 1400 && screenshotSize === 'xlarge') {
        setScreenshotSize('large');
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [screenshotSize]);

  const currentSize = SIZE_PRESETS[screenshotSize];

  // Auto-refresh screenshots for preview and program
  const previewScreenshot = useAutoRefreshScreenshot({
    intervalMs: 2000,
    sceneName: previewScene,
    imageWidth: currentSize.width,
    imageHeight: currentSize.height,
    imageFormat: 'jpg',
    enabled: obsConnected && !!previewScene
  });

  const programScreenshot = useAutoRefreshScreenshot({
    intervalMs: 2000,
    sceneName: null, // null = current program scene
    imageWidth: currentSize.width,
    imageHeight: currentSize.height,
    imageFormat: 'jpg',
    enabled: obsConnected
  });

  // Handle preview scene selection
  const handlePreviewSceneChange = (e) => {
    setPreviewScene(e.target.value);
  };

  // Handle TAKE button - transition preview to program
  const handleTake = () => {
    transitionToProgram();
  };

  return (
    <div className="bg-gray-800 rounded-xl p-4 mb-6" data-testid="studio-mode-panel">
      {/* Header with size selector and exit button */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h2 className="text-white font-semibold text-lg">Studio Mode</h2>

          {/* Size selector */}
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-sm">Size:</span>
            <select
              value={screenshotSize}
              onChange={(e) => setScreenshotSize(e.target.value)}
              className="bg-gray-700 text-white text-sm rounded px-3 py-1.5 border border-gray-600 focus:outline-none focus:border-purple-500"
              data-testid="size-selector"
            >
              {Object.entries(SIZE_PRESETS).map(([key, preset]) => (
                <option key={key} value={key}>{preset.label}</option>
              ))}
            </select>
          </div>
        </div>

        <button
          onClick={onExit}
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white rounded-lg transition-colors"
          data-testid="exit-studio-mode"
        >
          <XMarkIcon className="w-4 h-4" />
          Exit Studio Mode
        </button>
      </div>

      {/* Preview and Program side by side */}
      <div className="flex flex-col lg:flex-row gap-6 mb-4">
        {/* Preview Panel */}
        <div className="flex-1">
          <div className="text-yellow-400 font-semibold text-sm mb-2 uppercase tracking-wider">
            Preview
          </div>
          <div
            className="bg-gray-900 rounded-lg overflow-hidden flex items-center justify-center"
            style={{ width: currentSize.width, height: currentSize.height, maxWidth: '100%' }}
            data-testid="preview-screenshot"
          >
            {!previewScene ? (
              <div className="text-gray-500 text-sm text-center px-4">
                Select a preview scene
              </div>
            ) : previewScreenshot.loading && !previewScreenshot.imageData ? (
              <div className="text-gray-500 text-sm flex items-center gap-2">
                <ArrowPathIcon className="w-5 h-5 animate-spin" />
                Loading...
              </div>
            ) : previewScreenshot.error ? (
              <div className="text-red-400 text-sm text-center px-4">
                {previewScreenshot.error}
              </div>
            ) : previewScreenshot.imageData ? (
              <img
                src={previewScreenshot.imageData}
                alt="Preview Output"
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="text-gray-500 text-sm">No preview available</div>
            )}
          </div>
          <div className="mt-2 text-gray-400 text-sm">
            Scene: <span className="text-white">{previewScene || 'None'}</span>
          </div>
        </div>

        {/* Program Panel */}
        <div className="flex-1">
          <div className="text-red-400 font-semibold text-sm mb-2 uppercase tracking-wider flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></div>
            Program
          </div>
          <div
            className="bg-gray-900 rounded-lg overflow-hidden flex items-center justify-center"
            style={{ width: currentSize.width, height: currentSize.height, maxWidth: '100%' }}
            data-testid="program-screenshot"
          >
            {!obsConnected ? (
              <div className="text-gray-500 text-sm text-center px-4">
                OBS Disconnected
              </div>
            ) : programScreenshot.loading && !programScreenshot.imageData ? (
              <div className="text-gray-500 text-sm flex items-center gap-2">
                <ArrowPathIcon className="w-5 h-5 animate-spin" />
                Loading...
              </div>
            ) : programScreenshot.error ? (
              <div className="text-red-400 text-sm text-center px-4">
                {programScreenshot.error}
              </div>
            ) : programScreenshot.imageData ? (
              <img
                src={programScreenshot.imageData}
                alt="Program Output"
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="text-gray-500 text-sm">No preview available</div>
            )}
          </div>
          <div className="mt-2 text-gray-400 text-sm">
            Scene: <span className="text-white">{currentScene || 'None'}</span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Preview Scene Selector */}
        <div className="flex items-center gap-2">
          <label className="text-gray-400 text-sm">Preview Scene:</label>
          <select
            value={previewScene || ''}
            onChange={handlePreviewSceneChange}
            className="bg-gray-700 text-white rounded px-3 py-2 border border-gray-600 focus:outline-none focus:border-purple-500 min-w-[200px]"
            data-testid="preview-scene-selector"
          >
            <option value="">Select scene...</option>
            {scenes.map((scene) => (
              <option key={scene.name || scene.sceneName} value={scene.name || scene.sceneName}>
                {scene.name || scene.sceneName}
              </option>
            ))}
          </select>
        </div>

        {/* TAKE Button */}
        <button
          onClick={handleTake}
          disabled={!previewScene || !obsConnected}
          className="flex items-center gap-2 px-6 py-2 bg-red-600 hover:bg-red-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold rounded-lg transition-colors text-lg"
          data-testid="take-button"
        >
          <PlayIcon className="w-5 h-5" />
          TAKE
        </button>
      </div>
    </div>
  );
}
