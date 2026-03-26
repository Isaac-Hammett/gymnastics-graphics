/**
 * Theme Loader for Meet Theme System (v2)
 *
 * This script loads custom meet themes from Firebase and applies them via CSS custom properties.
 * It's designed to be loaded by all overlay HTML files AND output.html.
 *
 * Usage: Add <script src="theme-loader.js"></script> before </body>
 *
 * Behavior:
 * 1. Exposes window.themeReady Promise immediately (synchronously, before any async)
 * 2. Reads `meetTheme` param from URL (takes precedence)
 * 3. If no meetTheme, reads `comp` param → fetches meetTheme from competition config
 * 4. If neither, resolves immediately with no-op
 * 5. Conditionally initializes Firebase SDK
 * 6. Fetches theme from `themes/{themeId}` via Firebase
 * 7. Applies CSS custom properties to document.documentElement
 * 8. Sets `data-meet-theme` attribute on <body> for CSS selector targeting
 * 9. Injects theme-overrides.css stylesheet
 * 10. On timeout (3s) or failure: resolves with fallback, writes error to Firebase
 */

// Create window.themeReady synchronously at top level so it's available immediately
let _resolveThemeReady;
window.themeReady = new Promise(resolve => { _resolveThemeReady = resolve; });

(function() {
  'use strict';

  const TIMEOUT_MS = 3000;

  // Get params from URL
  const params = new URLSearchParams(window.location.search);
  const meetThemeId = params.get('meetTheme');
  const compId = params.get('comp');
  const debugMode = params.get('debug') === 'theme';

  // Detect source for error reporting
  function getSource() {
    const pathname = window.location.pathname;
    if (pathname.includes('/overlays/')) {
      const filename = pathname.split('/').pop().replace('.html', '');
      return `overlay:${filename}`;
    }
    return 'output.html';
  }

  // No-op if no theme specified and no competition to look up
  if (!meetThemeId && !compId) {
    _resolveThemeReady({ success: true, themeId: null });
    // Still show debug panel if debug=theme (even without theme)
    // (createDebugPanel is defined later in the IIFE, but DOMContentLoaded delays execution)
    if (debugMode) {
      const earlyDebugState = {
        themeId: null,
        loadStatus: 'no_theme',
        source: null,
        startTime: Date.now(),
        endTime: Date.now(),
        theme: null,
        error: null
      };
      const showEarlyDebugPanel = () => {
        // createDebugPanel must be called after it's defined, so we defer
        // But since we're returning early, we need a standalone version
        createEarlyDebugPanel(earlyDebugState);
      };
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', showEarlyDebugPanel);
      } else {
        showEarlyDebugPanel();
      }
    }
    return;
  }

  /**
   * Create early debug panel for no-theme cases
   * (Simplified version since we return early before other functions are defined)
   */
  function createEarlyDebugPanel(ds) {
    const root = document.documentElement;
    const pathname = window.location.pathname;
    const isOverlay = pathname.includes('/overlays/');
    const renderingPath = isOverlay ? 'iframe (overlay)' : 'inline (output.html)';
    const graphicId = isOverlay
      ? pathname.split('/').pop().replace('.html', '')
      : params.get('graphic') || '(live mode)';

    const panel = document.createElement('div');
    panel.id = 'theme-debug-panel';
    panel.innerHTML = `
      <style>
        #theme-debug-panel {
          position: fixed;
          bottom: 10px;
          right: 10px;
          background: rgba(0, 0, 0, 0.9);
          color: #fff;
          font-family: 'Monaco', 'Consolas', monospace;
          font-size: 11px;
          border-radius: 8px;
          z-index: 99999;
          max-width: 400px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        }
        #theme-debug-panel .debug-badge {
          padding: 6px 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          border-radius: 8px;
        }
        #theme-debug-panel .debug-badge:hover {
          background: rgba(255,255,255,0.1);
        }
        #theme-debug-panel .badge-indicator {
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #6b7280;
        }
        #theme-debug-panel .debug-content {
          display: none;
          padding: 12px;
          border-top: 1px solid rgba(255,255,255,0.2);
        }
        #theme-debug-panel.expanded .debug-content {
          display: block;
        }
        #theme-debug-panel .debug-section { margin-bottom: 12px; }
        #theme-debug-panel .debug-section-title {
          color: #9ca3af;
          text-transform: uppercase;
          font-size: 9px;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }
        #theme-debug-panel .debug-row {
          display: flex;
          justify-content: space-between;
          padding: 2px 0;
          gap: 12px;
        }
        #theme-debug-panel .debug-label { color: #9ca3af; }
        #theme-debug-panel .debug-value { color: #fff; }
      </style>
      <div class="debug-badge" onclick="this.parentElement.classList.toggle('expanded')">
        <span class="badge-indicator"></span>
        <span>Theme Debug</span>
        <span style="margin-left: auto; color: #6b7280">8/8</span>
      </div>
      <div class="debug-content">
        <div class="debug-section">
          <div class="debug-section-title">Status</div>
          <div class="debug-row">
            <span class="debug-label">Theme ID</span>
            <span class="debug-value">none</span>
          </div>
          <div class="debug-row">
            <span class="debug-label">Load Status</span>
            <span class="debug-value">no_theme</span>
          </div>
          <div class="debug-row">
            <span class="debug-label">Source</span>
            <span class="debug-value">(no theme)</span>
          </div>
        </div>
        <div class="debug-section">
          <div class="debug-section-title">Rendering</div>
          <div class="debug-row">
            <span class="debug-label">Path</span>
            <span class="debug-value">${renderingPath}</span>
          </div>
          <div class="debug-row">
            <span class="debug-label">Graphic ID</span>
            <span class="debug-value">${graphicId}</span>
          </div>
        </div>
        <div class="debug-section">
          <div class="debug-section-title">CSS Variables (8/8)</div>
          <div style="color:#9ca3af;font-size:10px;">No theme applied — using fallback colors</div>
        </div>
      </div>
    `;
    document.body.appendChild(panel);
  }

  // Firebase configuration
  const firebaseConfig = {
    apiKey: "AIzaSyCh0aZUvKl6Qvqsva3hvOgJJlleP1OwcTY",
    authDomain: "gymnastics-graphics.firebaseapp.com",
    databaseURL: "https://gymnastics-graphics-default-rtdb.firebaseio.com",
    projectId: "gymnastics-graphics",
    storageBucket: "gymnastics-graphics.firebasestorage.app",
    messagingSenderId: "117454807823",
    appId: "1:117454807823:web:7ee698cc6379e69e2bd3af"
  };

  /**
   * Load Firebase SDK dynamically (only when theme is requested)
   * @returns {Promise<void>}
   */
  function loadFirebaseSDK() {
    return new Promise((resolve, reject) => {
      // Check if Firebase is already loaded
      if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
        resolve();
        return;
      }

      // Check if Firebase is loaded but not initialized
      if (typeof firebase !== 'undefined') {
        firebase.initializeApp(firebaseConfig);
        resolve();
        return;
      }

      // Load Firebase SDK dynamically
      const appScript = document.createElement('script');
      appScript.src = 'https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js';
      appScript.onload = () => {
        const dbScript = document.createElement('script');
        dbScript.src = 'https://www.gstatic.com/firebasejs/9.22.0/firebase-database-compat.js';
        dbScript.onload = () => {
          firebase.initializeApp(firebaseConfig);
          resolve();
        };
        dbScript.onerror = reject;
        document.head.appendChild(dbScript);
      };
      appScript.onerror = reject;
      document.head.appendChild(appScript);
    });
  }

  /**
   * Get theme ID from competition config
   * @param {string} competitionId - Competition ID
   * @returns {Promise<string|null>} Theme ID or null
   */
  async function getThemeIdFromCompetition(competitionId) {
    try {
      const db = firebase.database();
      const snapshot = await db.ref(`competitions/${competitionId}/config/meetTheme`).once('value');
      return snapshot.val() || null;
    } catch (error) {
      console.error('[theme-loader] Error reading competition config:', error);
      return null;
    }
  }

  /**
   * Fetch theme data from Firebase
   * @param {string} themeId - Theme ID to fetch
   * @returns {Promise<Object|null>} Theme data or null if not found
   */
  async function fetchTheme(themeId) {
    try {
      const db = firebase.database();
      const snapshot = await db.ref(`themes/${themeId}`).once('value');
      return snapshot.val();
    } catch (error) {
      console.error('[theme-loader] Error fetching theme:', error);
      return null;
    }
  }

  /**
   * Write error to Firebase for producer visibility
   * @param {string} type - Error type
   * @param {string} themeId - Theme ID that failed
   * @param {string} message - Error message
   */
  async function writeError(type, themeId, message) {
    // Only write errors if we have a competition ID
    if (!compId) return;

    try {
      const db = firebase.database();
      const errorRef = db.ref(`competitions/${compId}/production/themeErrors`).push();
      await errorRef.set({
        type: type,
        themeId: themeId || 'unknown',
        compId: compId,
        source: getSource(),
        message: message,
        url: window.location.href,
        timestamp: Date.now(),
        resolved: false
      });
      console.log('[theme-loader] Error logged to Firebase');
    } catch (err) {
      // Silent fail - don't block on error logging
      console.error('[theme-loader] Failed to write error to Firebase:', err);
    }
  }

  /**
   * Apply theme colors as CSS custom properties
   * @param {Object} theme - Theme data from Firebase
   * @param {string} themeId - Theme ID used for lookup
   */
  function applyTheme(theme, themeId) {
    if (!theme || !theme.colors) {
      console.warn('[theme-loader] No theme colors found');
      return;
    }

    const root = document.documentElement;
    const colors = theme.colors;

    // Map theme color fields to CSS custom properties
    // Supports both v3.0 field names and v2.0 backward-compat names
    const colorMappings = {
      // v2.0 backward compat FIRST (old themes still work)
      // v3.0 fields below will overwrite these if both exist
      headerBg: '--meet-header-bg',
      accentPrimary: '--meet-content-bg',
      accentSecondary: '--meet-header-bg',
      footerBg: '--meet-header-bg',
      headerText: '--meet-header-text',
      borderColor: '--meet-border-color',
      badgeBg: '--meet-badge-bg',
      overlayBg: '--meet-overlay-bg',
      overlayText: '--meet-overlay-text',
      // v3.0 field names (8 colors) — applied LAST so they take precedence
      headerBar: '--meet-header-bg',
      contentArea: '--meet-content-bg',
      bodyBackground: '--meet-overlay-bg',
      borderDivider: '--meet-border-color',
      badge: '--meet-badge-bg',
      badgeText: '--meet-badge-text',
      textOnHeader: '--meet-header-text',
      textOnContent: '--meet-overlay-text',
    };

    for (const [themeKey, cssVar] of Object.entries(colorMappings)) {
      if (colors[themeKey]) {
        root.style.setProperty(cssVar, colors[themeKey]);
      }
    }

    // Apply logo URLs as CSS custom properties AND data attributes
    // CSS properties use url() format for background-image
    // Data attributes use plain URL for JS img.src access
    if (theme.logos) {
      if (theme.logos.meetLogo) {
        root.style.setProperty('--meet-logo-url', `url(${theme.logos.meetLogo})`);
        document.body.setAttribute('data-meet-logo', theme.logos.meetLogo);
      }
      if (theme.logos.causeLogo) {
        root.style.setProperty('--meet-cause-logo-url', `url(${theme.logos.causeLogo})`);
        document.body.setAttribute('data-meet-cause-logo', theme.logos.causeLogo);
      }
    }

    // Apply branding text as CSS custom properties (can be read via JS if needed)
    if (theme.branding) {
      if (theme.branding.meetTitle) {
        root.style.setProperty('--meet-title', `"${theme.branding.meetTitle}"`);
      }
      if (theme.branding.subtitle) {
        root.style.setProperty('--meet-subtitle', `"${theme.branding.subtitle}"`);
      }
    }

    // Apply texture overlay as CSS custom properties
    if (theme.textures && theme.textures.overlay) {
      root.style.setProperty('--meet-texture', `url(${theme.textures.overlay})`);
      root.style.setProperty('--meet-texture-opacity', theme.textures.opacity || '0.08');
      console.log('[theme-loader] Texture applied:', theme.textures.overlay, 'opacity:', theme.textures.opacity);
    }

    // Set data-meet-theme attribute on body for CSS selector targeting
    document.body.setAttribute('data-meet-theme', theme.id || themeId);

    // Store theme data for live-mode override lookups (Phase 3)
    window.__themeData = theme;

    console.log('[theme-loader] Theme applied:', theme.name || themeId);
  }

  /**
   * Detect graphic ID from current context
   * @returns {string|null} Graphic ID or null if in live mode
   */
  function detectGraphicId() {
    const pathname = window.location.pathname;

    // Overlay files: extract from pathname
    if (pathname.includes('/overlays/')) {
      return pathname.split('/').pop().replace('.html', '');
    }

    // output.html with ?mode=clip or ?mode=clip-preview
    const mode = params.get('mode');
    if (mode === 'clip' || mode === 'clip-preview') {
      return 'clip-overlay';
    }

    // output.html with ?graphic= param (preview mode)
    const graphicParam = params.get('graphic');
    if (graphicParam) {
      return graphicParam;
    }

    // output.html live mode - cannot detect at load time
    // Overrides will be applied in the currentGraphic listener
    return null;
  }

  /**
   * Apply per-graphic override CSS variables
   * @param {Object} theme - Theme data (including overrides)
   * @param {string} graphicId - Graphic ID to apply overrides for
   * @returns {Object} Override status for debug panel
   */
  function applyOverrides(theme, graphicId) {
    const overrideStatus = {
      graphicId: graphicId,
      hasOverrides: false,
      applied: []
    };

    if (!theme || !theme.overrides || !graphicId) {
      return overrideStatus;
    }

    const overrides = theme.overrides[graphicId];
    if (!overrides) {
      return overrideStatus;
    }

    overrideStatus.hasOverrides = true;
    const root = document.documentElement;

    // Map override properties to CSS variable names
    // Pattern: --{graphicId}-{property}
    const overrideMapping = {
      headerBar: 'header-bg',
      contentArea: 'content-bg',
      bodyBackground: 'overlay-bg',
      borderDivider: 'border-color',
      badge: 'badge-bg',
      badgeText: 'badge-text',
      textOnHeader: 'header-text',
      textOnContent: 'overlay-text'
    };

    for (const [propKey, cssSuffix] of Object.entries(overrideMapping)) {
      if (overrides[propKey]) {
        const varName = `--${graphicId}-${cssSuffix}`;
        root.style.setProperty(varName, overrides[propKey]);
        overrideStatus.applied.push({ name: varName, value: overrides[propKey] });
        console.log(`[theme-loader] Override applied: ${varName} = ${overrides[propKey]}`);
      }
    }

    return overrideStatus;
  }

  /**
   * Inject theme-overrides.css stylesheet
   */
  function injectOverrideStyles() {
    // Check if already injected
    if (document.querySelector('link[href*="theme-overrides.css"]')) {
      return;
    }

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    // Determine path relative to current page
    const currentPath = window.location.pathname;
    const isOverlay = currentPath.includes('/overlays/');
    link.href = isOverlay ? 'theme-overrides.css' : 'overlays/theme-overrides.css';
    document.head.appendChild(link);
  }

  // Debug state tracking
  const debugState = {
    themeId: null,
    loadStatus: 'pending',
    source: null,
    startTime: Date.now(),
    endTime: null,
    theme: null,
    error: null,
    overrideStatus: null
  };

  /**
   * Create debug panel showing theme diagnostic information
   * @param {Object} state - Debug state (optional, uses closure if not provided)
   */
  function createDebugPanel(state) {
    if (!debugMode) return;
    const ds = state || debugState;

    const root = document.documentElement;
    const duration = ds.endTime ? ds.endTime - ds.startTime : 0;

    // Detect rendering path and graphic ID
    const pathname = window.location.pathname;
    const isOverlay = pathname.includes('/overlays/');
    const renderingPath = isOverlay ? 'iframe (overlay)' : 'inline (output.html)';
    const graphicId = isOverlay
      ? pathname.split('/').pop().replace('.html', '')
      : params.get('graphic') || '(live mode)';

    // The 8 CSS variables to check
    const cssVars = [
      { name: '--meet-header-bg', themeKey: ['headerBar', 'headerBg'], fallback: '#BFBFBF' },
      { name: '--meet-content-bg', themeKey: ['contentArea', 'accentPrimary'], fallback: '#E5E5E5' },
      { name: '--meet-header-text', themeKey: ['textOnHeader', 'headerText'], fallback: '#000000' },
      { name: '--meet-overlay-bg', themeKey: ['bodyBackground', 'overlayBg'], fallback: '#FFFFFF' },
      { name: '--meet-overlay-text', themeKey: ['textOnContent', 'overlayText'], fallback: '#000000' },
      { name: '--meet-border-color', themeKey: ['borderDivider', 'borderColor'], fallback: '#D1D5DB' },
      { name: '--meet-badge-bg', themeKey: ['badge', 'badgeBg'], fallback: '#16A34A' },
      { name: '--meet-badge-text', themeKey: ['badgeText'], fallback: '#FFFFFF' }
    ];

    // Get expected and actual values for each variable
    const varChecks = cssVars.map(v => {
      const computed = getComputedStyle(root).getPropertyValue(v.name).trim();
      let expected = null;
      if (ds.theme && ds.theme.colors) {
        for (const key of v.themeKey) {
          if (ds.theme.colors[key]) {
            expected = ds.theme.colors[key];
            break;
          }
        }
      }
      const isSet = computed !== '';
      const matches = expected ? computed.toLowerCase() === expected.toLowerCase() : true;
      return {
        name: v.name,
        expected: expected || '(not in theme)',
        actual: computed || '(not set)',
        pass: ds.theme ? (isSet && matches) : !isSet
      };
    });

    // Count pass/fail
    const passCount = varChecks.filter(v => v.pass).length;
    const failCount = varChecks.filter(v => !v.pass).length;

    // Check logo data attributes
    const meetLogo = document.body.getAttribute('data-meet-logo');
    const causeLogo = document.body.getAttribute('data-meet-cause-logo');

    // Create panel HTML
    const panel = document.createElement('div');
    panel.id = 'theme-debug-panel';
    panel.innerHTML = `
      <style>
        #theme-debug-panel {
          position: fixed;
          bottom: 10px;
          right: 10px;
          background: rgba(0, 0, 0, 0.9);
          color: #fff;
          font-family: 'Monaco', 'Consolas', monospace;
          font-size: 11px;
          border-radius: 8px;
          z-index: 99999;
          max-width: 400px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.5);
        }
        #theme-debug-panel .debug-badge {
          padding: 6px 12px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          border-radius: 8px;
        }
        #theme-debug-panel .debug-badge:hover {
          background: rgba(255,255,255,0.1);
        }
        #theme-debug-panel .badge-indicator {
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
        }
        #theme-debug-panel .badge-indicator.success { background: #22c55e; }
        #theme-debug-panel .badge-indicator.fail { background: #ef4444; }
        #theme-debug-panel .badge-indicator.timeout { background: #f59e0b; }
        #theme-debug-panel .badge-indicator.none { background: #6b7280; }
        #theme-debug-panel .debug-content {
          display: none;
          padding: 12px;
          border-top: 1px solid rgba(255,255,255,0.2);
          max-height: 400px;
          overflow-y: auto;
        }
        #theme-debug-panel.expanded .debug-content {
          display: block;
        }
        #theme-debug-panel .debug-section {
          margin-bottom: 12px;
        }
        #theme-debug-panel .debug-section:last-child {
          margin-bottom: 0;
        }
        #theme-debug-panel .debug-section-title {
          color: #9ca3af;
          text-transform: uppercase;
          font-size: 9px;
          letter-spacing: 0.5px;
          margin-bottom: 4px;
        }
        #theme-debug-panel .debug-row {
          display: flex;
          justify-content: space-between;
          padding: 2px 0;
          gap: 12px;
        }
        #theme-debug-panel .debug-label {
          color: #9ca3af;
        }
        #theme-debug-panel .debug-value {
          color: #fff;
          text-align: right;
          word-break: break-all;
        }
        #theme-debug-panel .debug-value.pass { color: #22c55e; }
        #theme-debug-panel .debug-value.fail { color: #ef4444; }
        #theme-debug-panel .debug-value.warn { color: #f59e0b; }
        #theme-debug-panel .var-row {
          display: grid;
          grid-template-columns: 1fr auto auto;
          gap: 8px;
          padding: 3px 0;
          border-bottom: 1px solid rgba(255,255,255,0.1);
        }
        #theme-debug-panel .var-name {
          color: #93c5fd;
        }
        #theme-debug-panel .var-expected {
          color: #9ca3af;
          font-size: 10px;
        }
        #theme-debug-panel .var-actual {
          color: #fff;
        }
        #theme-debug-panel .status-dot {
          display: inline-block;
          width: 6px;
          height: 6px;
          border-radius: 50%;
          margin-right: 4px;
        }
        #theme-debug-panel .status-dot.pass { background: #22c55e; }
        #theme-debug-panel .status-dot.fail { background: #ef4444; }
      </style>
      <div class="debug-badge" onclick="this.parentElement.classList.toggle('expanded')">
        <span class="badge-indicator ${ds.loadStatus === 'success' ? 'success' : ds.loadStatus === 'timeout' ? 'timeout' : ds.themeId === null ? 'none' : 'fail'}"></span>
        <span>Theme Debug</span>
        <span style="margin-left: auto; color: ${failCount > 0 ? '#ef4444' : '#22c55e'}">${passCount}/${varChecks.length}</span>
      </div>
      <div class="debug-content">
        <div class="debug-section">
          <div class="debug-section-title">Status</div>
          <div class="debug-row">
            <span class="debug-label">Theme ID</span>
            <span class="debug-value">${ds.themeId || 'none'}</span>
          </div>
          <div class="debug-row">
            <span class="debug-label">Load Status</span>
            <span class="debug-value ${ds.loadStatus === 'success' ? 'pass' : ds.loadStatus === 'timeout' ? 'warn' : ds.themeId === null ? '' : 'fail'}">${ds.loadStatus}</span>
          </div>
          <div class="debug-row">
            <span class="debug-label">Source</span>
            <span class="debug-value">${ds.source || '(no theme)'}</span>
          </div>
          <div class="debug-row">
            <span class="debug-label">Load Time</span>
            <span class="debug-value">${duration}ms</span>
          </div>
        </div>

        <div class="debug-section">
          <div class="debug-section-title">Rendering</div>
          <div class="debug-row">
            <span class="debug-label">Path</span>
            <span class="debug-value">${renderingPath}</span>
          </div>
          <div class="debug-row">
            <span class="debug-label">Graphic ID</span>
            <span class="debug-value">${graphicId}</span>
          </div>
        </div>

        <div class="debug-section">
          <div class="debug-section-title">CSS Variables (${passCount}/${varChecks.length})</div>
          ${varChecks.map(v => `
            <div class="var-row">
              <span class="var-name"><span class="status-dot ${v.pass ? 'pass' : 'fail'}"></span>${v.name}</span>
              <span class="var-expected">${v.expected}</span>
              <span class="var-actual">${v.actual}</span>
            </div>
          `).join('')}
        </div>

        <div class="debug-section">
          <div class="debug-section-title">Logos</div>
          <div class="debug-row">
            <span class="debug-label">data-meet-logo</span>
            <span class="debug-value ${meetLogo ? 'pass' : ''}">${meetLogo ? 'present' : 'absent'}</span>
          </div>
          ${meetLogo ? `<div class="debug-row"><span class="debug-label"></span><span class="debug-value" style="font-size:9px;color:#9ca3af;">${meetLogo.substring(0, 50)}...</span></div>` : ''}
          <div class="debug-row">
            <span class="debug-label">data-meet-cause-logo</span>
            <span class="debug-value ${causeLogo ? 'pass' : ''}">${causeLogo ? 'present' : 'absent'}</span>
          </div>
          ${causeLogo ? `<div class="debug-row"><span class="debug-label"></span><span class="debug-value" style="font-size:9px;color:#9ca3af;">${causeLogo.substring(0, 50)}...</span></div>` : ''}
        </div>

        ${ds.error ? `
        <div class="debug-section">
          <div class="debug-section-title">Error</div>
          <div class="debug-row">
            <span class="debug-value fail">${ds.error}</span>
          </div>
        </div>
        ` : ''}
      </div>
    `;

    document.body.appendChild(panel);
  }

  /**
   * Main initialization with timeout wrapper
   */
  async function init() {
    let timeoutId;
    let hasResolved = false;

    const resolveWith = (result) => {
      if (hasResolved) return;
      hasResolved = true;
      clearTimeout(timeoutId);
      debugState.endTime = Date.now();
      _resolveThemeReady(result);
      // Create debug panel after resolution (only if debug=theme)
      createDebugPanel();
    };

    // Set timeout - resolve with fallback if theme loading takes too long
    timeoutId = setTimeout(async () => {
      if (hasResolved) return;
      console.warn('[theme-loader] Theme loading timed out after', TIMEOUT_MS, 'ms');
      debugState.loadStatus = 'timeout';
      debugState.error = `Theme fetch timed out after ${TIMEOUT_MS}ms`;
      await writeError('timeout', meetThemeId || `(from comp ${compId})`,
        `Theme fetch timed out after ${TIMEOUT_MS}ms — rendering with fallback colors`);
      resolveWith({ success: false, reason: 'timeout' });
    }, TIMEOUT_MS);

    try {
      // Load Firebase SDK (conditionally)
      await loadFirebaseSDK();

      // Determine theme ID - meetTheme param takes precedence
      let themeId = meetThemeId;
      let source = 'meetTheme param';

      if (!themeId && compId) {
        // Read from competition config
        themeId = await getThemeIdFromCompetition(compId);
        source = 'competition config';

        if (!themeId) {
          console.log('[theme-loader] No theme configured for competition:', compId);
          debugState.loadStatus = 'no_theme';
          debugState.source = source;
          resolveWith({ success: true, themeId: null });
          return;
        }
      }

      debugState.themeId = themeId;
      debugState.source = source;

      console.log('[theme-loader] Loading theme:', themeId, 'from', source);

      // Fetch theme from Firebase
      const theme = await fetchTheme(themeId);

      if (theme) {
        // Inject override stylesheet
        injectOverrideStyles();

        // Apply theme CSS variables
        applyTheme(theme, themeId);

        // Apply per-graphic overrides if we can detect the graphic ID
        const graphicId = detectGraphicId();
        const overrideStatus = applyOverrides(theme, graphicId);
        debugState.overrideStatus = overrideStatus;

        debugState.loadStatus = 'success';
        debugState.theme = theme;
        resolveWith({ success: true, themeId: themeId });
      } else {
        console.warn('[theme-loader] Theme not found:', themeId);
        debugState.loadStatus = 'theme_not_found';
        debugState.error = `Theme "${themeId}" not found in Firebase`;
        await writeError('theme_not_found', themeId,
          `Theme "${themeId}" not found in Firebase — rendering with fallback colors`);
        resolveWith({ success: false, reason: 'theme_not_found', themeId: themeId });
      }
    } catch (error) {
      console.error('[theme-loader] Error initializing theme:', error);
      debugState.loadStatus = 'fetch_failed';
      debugState.error = error.message;
      await writeError('fetch_failed', meetThemeId || `(from comp ${compId})`,
        `Theme fetch failed: ${error.message} — rendering with fallback colors`);
      resolveWith({ success: false, reason: 'fetch_failed', error: error.message });
    }
  }

  // Run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
