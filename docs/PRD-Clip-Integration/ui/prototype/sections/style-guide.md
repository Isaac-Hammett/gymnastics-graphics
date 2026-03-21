# Clip Integration UI — Style Guide

This style guide defines the visual language for the Clip Integration UI prototype. All parallel loops must reference these tokens to ensure visual consistency.

---

## 1. CSS Variables

These variables extend the existing Show Controller zinc/dark theme.

```css
:root {
  /* === Existing Show Controller theme (reference) === */
  --bg-primary: #0a0a0b;       /* zinc-950 */
  --bg-secondary: #18181b;     /* zinc-900 */
  --bg-tertiary: #27272a;      /* zinc-800 */
  --text-primary: #e4e4e7;     /* zinc-200 */
  --text-secondary: #a1a1aa;   /* zinc-400 */
  --text-muted: #71717a;       /* zinc-500 */
  --border-color: #3f3f46;     /* zinc-700 */

  /* === Clip Integration additions === */

  /* Apparatus Colors (EVS color-coding pattern) */
  --clip-apparatus-vt: #ef4444;     /* red-500 — Vault */
  --clip-apparatus-ub: #a855f7;     /* purple-500 — Uneven Bars */
  --clip-apparatus-bb: #3b82f6;     /* blue-500 — Balance Beam */
  --clip-apparatus-fx: #22c55e;     /* green-500 — Floor Exercise */
  --clip-apparatus-ph: #f97316;     /* orange-500 — Pommel Horse */
  --clip-apparatus-sr: #14b8a6;     /* teal-500 — Still Rings */
  --clip-apparatus-pb: #6366f1;     /* indigo-500 — Parallel Bars */
  --clip-apparatus-hb: #f59e0b;     /* amber-500 — High Bar */

  /* Segment Type Colors */
  --clip-segment-playout-bg: rgba(6, 182, 212, 0.2);     /* cyan-500/20 */
  --clip-segment-playout-text: #22d3ee;                   /* cyan-400 */
  --clip-segment-content-bg: rgba(245, 158, 11, 0.2);    /* amber-500/20 */
  --clip-segment-content-text: #fbbf24;                   /* amber-400 */

  /* Playout Mode Colors */
  --clip-mode-live-bg: rgba(34, 197, 94, 0.2);           /* green-500/20 */
  --clip-mode-live-text: #4ade80;                         /* green-400 */
  --clip-mode-live-border: #22c55e;                       /* green-500 */

  --clip-mode-clip-bg: rgba(34, 197, 94, 0.2);           /* green-500/20 (same as LIVE) */
  --clip-mode-clip-text: #4ade80;                         /* green-400 */
  --clip-mode-clip-border: #22c55e;                       /* green-500 */

  --clip-mode-replay-bg: rgba(6, 182, 212, 0.2);         /* cyan-500/20 */
  --clip-mode-replay-text: #22d3ee;                       /* cyan-400 */
  --clip-mode-replay-border: #06b6d4;                     /* cyan-500 */

  --clip-mode-queued-bg: rgba(59, 130, 246, 0.2);        /* blue-500/20 */
  --clip-mode-queued-text: #60a5fa;                       /* blue-400 */
  --clip-mode-queued-border: #3b82f6;                     /* blue-500 */

  --clip-mode-break-bg: rgba(113, 113, 122, 0.2);        /* zinc-500/20 */
  --clip-mode-break-text: #a1a1aa;                        /* zinc-400 */
  --clip-mode-break-border: #71717a;                      /* zinc-500 */

  --clip-mode-fallback-bg: rgba(113, 113, 122, 0.15);    /* zinc-500/15 */
  --clip-mode-fallback-text: #a1a1aa;                     /* zinc-400 */
  --clip-mode-fallback-border: #52525b;                   /* zinc-600 */

  --clip-mode-override-bg: rgba(245, 158, 11, 0.2);      /* amber-500/20 */
  --clip-mode-override-text: #fbbf24;                     /* amber-400 */
  --clip-mode-override-border: #f59e0b;                   /* amber-500 */

  --clip-mode-paused-bg: rgba(234, 179, 8, 0.2);         /* yellow-500/20 */
  --clip-mode-paused-text: #facc15;                       /* yellow-400 */
  --clip-mode-paused-border: #eab308;                     /* yellow-500 */

  /* Status Colors (general) */
  --clip-status-success: #22c55e;    /* green-500 */
  --clip-status-warning: #f59e0b;    /* amber-500 */
  --clip-status-error: #ef4444;      /* red-500 */
  --clip-status-info: #3b82f6;       /* blue-500 */
}
```

---

## 2. Apparatus Colors

Used for clip thumbnails, filter badges, and camera status panel.

| Apparatus | Code | Color Name | Hex | CSS Variable |
|-----------|------|------------|-----|--------------|
| Vault | VT | Red | `#ef4444` | `--clip-apparatus-vt` |
| Uneven Bars | UB | Purple | `#a855f7` | `--clip-apparatus-ub` |
| Balance Beam | BB | Blue | `#3b82f6` | `--clip-apparatus-bb` |
| Floor Exercise | FX | Green | `#22c55e` | `--clip-apparatus-fx` |
| Pommel Horse | PH | Orange | `#f97316` | `--clip-apparatus-ph` |
| Still Rings | SR | Teal | `#14b8a6` | `--clip-apparatus-sr` |
| Parallel Bars | PB | Indigo | `#6366f1` | `--clip-apparatus-pb` |
| High Bar | HB | Amber | `#f59e0b` | `--clip-apparatus-hb` |

**Apparatus ordering (Olympic order):**
- Women's: VT, UB, BB, FX
- Men's: FX, PH, SR, VT, PB, HB

---

## 3. Segment Type Colors

| Segment Type | Background | Text | Tailwind Classes |
|--------------|------------|------|------------------|
| playout | `rgba(6, 182, 212, 0.2)` | `#22d3ee` | `bg-cyan-500/20 text-cyan-400` |
| content-sequence | `rgba(245, 158, 11, 0.2)` | `#fbbf24` | `bg-amber-500/20 text-amber-400` |

---

## 4. Status/Mode Colors

| Mode | Background | Text | Border | Badge Text |
|------|------------|------|--------|------------|
| LIVE | `rgba(34, 197, 94, 0.2)` | `#4ade80` | `#22c55e` | LIVE |
| CLIP | `rgba(34, 197, 94, 0.2)` | `#4ade80` | `#22c55e` | CLIP |
| MOMENT_REPLAY | `rgba(6, 182, 212, 0.2)` | `#22d3ee` | `#06b6d4` | REPLAY |
| QUEUED | `rgba(59, 130, 246, 0.2)` | `#60a5fa` | `#3b82f6` | QUEUED |
| BREAK | `rgba(113, 113, 122, 0.2)` | `#a1a1aa` | `#71717a` | BREAK |
| FALLBACK | `rgba(113, 113, 122, 0.15)` | `#a1a1aa` | `#52525b` | FALLBACK |
| OVERRIDE | `rgba(245, 158, 11, 0.2)` | `#fbbf24` | `#f59e0b` | OVERRIDE |
| PAUSED | `rgba(234, 179, 8, 0.2)` | `#facc15` | `#eab308` | PAUSED |

**Note:** MOMENT_REPLAY displays as "REPLAY" on badges (short form).

---

## 5. Badge Styles

Badges are small rounded pills with text and background color.

```css
.clip-badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 9999px;           /* fully rounded */
  font-size: 0.625rem;             /* 10px */
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Mode badges */
.clip-badge-live {
  background: var(--clip-mode-live-bg);
  color: var(--clip-mode-live-text);
}

.clip-badge-clip {
  background: var(--clip-mode-clip-bg);
  color: var(--clip-mode-clip-text);
}

.clip-badge-replay {
  background: var(--clip-mode-replay-bg);
  color: var(--clip-mode-replay-text);
}

.clip-badge-queued {
  background: var(--clip-mode-queued-bg);
  color: var(--clip-mode-queued-text);
}

.clip-badge-break {
  background: var(--clip-mode-break-bg);
  color: var(--clip-mode-break-text);
}

.clip-badge-fallback {
  background: var(--clip-mode-fallback-bg);
  color: var(--clip-mode-fallback-text);
}

.clip-badge-override {
  background: var(--clip-mode-override-bg);
  color: var(--clip-mode-override-text);
}

.clip-badge-paused {
  background: var(--clip-mode-paused-bg);
  color: var(--clip-mode-paused-text);
}

/* Apparatus badges */
.clip-badge-apparatus {
  background: rgba(255, 255, 255, 0.1);
  padding: 2px 6px;
  font-size: 0.625rem;
  font-weight: 700;
}

.clip-badge-vt { color: var(--clip-apparatus-vt); }
.clip-badge-ub { color: var(--clip-apparatus-ub); }
.clip-badge-bb { color: var(--clip-apparatus-bb); }
.clip-badge-fx { color: var(--clip-apparatus-fx); }
.clip-badge-ph { color: var(--clip-apparatus-ph); }
.clip-badge-sr { color: var(--clip-apparatus-sr); }
.clip-badge-pb { color: var(--clip-apparatus-pb); }
.clip-badge-hb { color: var(--clip-apparatus-hb); }
```

**Tailwind equivalents:**
```html
<!-- Mode badge -->
<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-green-500/20 text-green-400">
  LIVE
</span>

<!-- Apparatus badge -->
<span class="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-red-500">
  VT
</span>
```

---

## 6. Component Patterns

### Status Bar States

The status bar displays current playout mode with colored border indicator.

```css
.clip-status-bar {
  background: var(--bg-secondary);
  border-left: 3px solid transparent;
  padding: 8px 12px;
}

.clip-status-bar--autonomous {
  border-left-color: var(--clip-mode-live-border);  /* green */
}

.clip-status-bar--override {
  border-left-color: var(--clip-mode-override-border);  /* amber */
}

.clip-status-bar--paused {
  border-left-color: var(--clip-mode-paused-border);  /* yellow */
}
```

### Button Styles

Follow existing Show Controller patterns:

```css
/* Primary action button */
.clip-btn-primary {
  background: #3b82f6;           /* blue-500 */
  color: white;
  padding: 8px 16px;
  border-radius: 6px;
  font-weight: 500;
  transition: background 150ms;
}

.clip-btn-primary:hover {
  background: #2563eb;           /* blue-600 */
}

/* Secondary/outline button */
.clip-btn-outline {
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  padding: 8px 16px;
  border-radius: 6px;
  font-weight: 500;
  transition: all 150ms;
}

.clip-btn-outline:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

/* Danger button */
.clip-btn-danger {
  background: rgba(239, 68, 68, 0.2);   /* red-500/20 */
  color: #f87171;                        /* red-400 */
  padding: 8px 16px;
  border-radius: 6px;
  font-weight: 500;
  transition: background 150ms;
}

.clip-btn-danger:hover {
  background: rgba(239, 68, 68, 0.3);
}
```

**Tailwind equivalents:**
```html
<!-- Primary -->
<button class="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md font-medium transition-colors">
  Take
</button>

<!-- Outline -->
<button class="px-4 py-2 bg-transparent border border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200 rounded-md font-medium transition-colors">
  Skip
</button>

<!-- Danger -->
<button class="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-md font-medium transition-colors">
  Clear
</button>
```

---

## 7. Typography

| Element | Size | Weight | Color | Tailwind |
|---------|------|--------|-------|----------|
| Panel header | 14px | 600 | `--text-primary` | `text-sm font-semibold text-zinc-200` |
| Card title | 13px | 500 | `--text-primary` | `text-[13px] font-medium text-zinc-200` |
| Card subtitle | 12px | 400 | `--text-secondary` | `text-xs text-zinc-400` |
| Badge text | 10px | 600 | (per mode) | `text-[10px] font-semibold` |
| Timestamp | 11px | 500 | `--text-muted` | `text-[11px] font-medium text-zinc-500` |
| Icon button | 18px | — | `--text-secondary` | `w-[18px] h-[18px] text-zinc-400` |

---

## 8. Spacing Scale

Follow Tailwind 4px base:

| Token | Value | Tailwind |
|-------|-------|----------|
| xs | 4px | `p-1`, `gap-1` |
| sm | 8px | `p-2`, `gap-2` |
| md | 12px | `p-3`, `gap-3` |
| lg | 16px | `p-4`, `gap-4` |
| xl | 24px | `p-6`, `gap-6` |

---

## 9. Border Radius

| Element | Radius | Tailwind |
|---------|--------|----------|
| Cards | 8px | `rounded-lg` |
| Buttons | 6px | `rounded-md` |
| Badges | 9999px | `rounded-full` |
| Thumbnails | 4px | `rounded` |
| Input fields | 6px | `rounded-md` |

---

## 10. Shadows

```css
/* Card hover shadow */
.clip-card-shadow {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

/* Modal/dropdown shadow */
.clip-modal-shadow {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
}
```

**Tailwind:**
```html
<div class="shadow-lg">...</div>
<div class="shadow-xl">...</div>
```

---

## 11. Card Patterns

Cards follow the EVS/Ross pattern: metadata-rich but scannable, with clear visual hierarchy.

### Clip Card

The clip card displays athlete info, apparatus, duration, and status in a compact format.

```css
.clip-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-color);
  border-radius: 8px;
  padding: 12px;
  display: flex;
  gap: 12px;
  align-items: flex-start;
  transition: background 150ms, border-color 150ms;
}

.clip-card:hover {
  background: var(--bg-tertiary);
  border-color: var(--text-muted);
}

.clip-card--selected {
  border-color: #3b82f6;                /* blue-500 */
  background: rgba(59, 130, 246, 0.1);  /* blue-500/10 */
}

.clip-card--playing {
  border-color: var(--clip-mode-live-border);
  background: rgba(34, 197, 94, 0.1);   /* green-500/10 */
}

.clip-card__thumbnail {
  width: 64px;
  height: 48px;
  border-radius: 4px;
  background: var(--bg-tertiary);
  flex-shrink: 0;
  overflow: hidden;
}

.clip-card__content {
  flex: 1;
  min-width: 0;  /* enable text truncation */
}

.clip-card__header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.clip-card__title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.clip-card__meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-secondary);
}

.clip-card__duration {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
```

**Tailwind equivalent:**
```html
<div class="bg-zinc-900 border border-zinc-700 rounded-lg p-3 flex gap-3 hover:bg-zinc-800 hover:border-zinc-500 transition-colors">
  <div class="w-16 h-12 rounded bg-zinc-800 flex-shrink-0 overflow-hidden">
    <!-- thumbnail -->
  </div>
  <div class="flex-1 min-w-0">
    <div class="flex items-center gap-2 mb-1">
      <span class="text-[13px] font-medium text-zinc-200 truncate">Athlete Name</span>
      <span class="clip-badge clip-badge-vt">VT</span>
    </div>
    <div class="flex items-center gap-2 text-xs text-zinc-400">
      <span>Team Name</span>
      <span>R3</span>
      <span class="text-[11px] font-medium text-zinc-500 tabular-nums">0:42</span>
    </div>
  </div>
</div>
```

### Now Playing Card

The Now Playing card follows Ross's minimal focused design: progress bar, athlete info, and 3 action buttons.

```css
.clip-now-playing {
  background: var(--bg-secondary);
  border: 2px solid var(--clip-mode-live-border);
  border-radius: 8px;
  padding: 16px;
}

.clip-now-playing--paused {
  border-color: var(--clip-mode-paused-border);
}

.clip-now-playing__header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.clip-now-playing__info {
  flex: 1;
  min-width: 0;
}

.clip-now-playing__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.clip-now-playing__subtitle {
  font-size: 12px;
  color: var(--text-secondary);
}

.clip-now-playing__actions {
  display: flex;
  gap: 8px;
}

.clip-now-playing__progress {
  margin-top: 12px;
}

.clip-now-playing__timecode {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  font-weight: 500;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
  margin-top: 4px;
}
```

---

## 12. Transport Controls

Transport controls follow Ross's minimal clip player design: simple, clear iconography.

```css
.clip-transport {
  display: flex;
  align-items: center;
  gap: 4px;
}

.clip-transport__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid transparent;
  transition: all 150ms;
  cursor: pointer;
}

.clip-transport__btn:hover {
  background: var(--bg-tertiary);
  color: var(--text-primary);
}

.clip-transport__btn:focus-visible {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

.clip-transport__btn--active {
  background: var(--clip-mode-live-bg);
  color: var(--clip-mode-live-text);
  border-color: var(--clip-mode-live-border);
}

.clip-transport__btn--paused {
  background: var(--clip-mode-paused-bg);
  color: var(--clip-mode-paused-text);
  border-color: var(--clip-mode-paused-border);
}

/* Keyboard shortcut hint on buttons */
.clip-transport__btn-hint {
  position: absolute;
  top: -6px;
  right: -6px;
  font-size: 9px;
  font-weight: 700;
  background: var(--bg-tertiary);
  color: var(--text-muted);
  padding: 1px 4px;
  border-radius: 3px;
  border: 1px solid var(--border-color);
}
```

### Progress Bar

```css
.clip-progress {
  position: relative;
  height: 6px;
  background: var(--bg-tertiary);
  border-radius: 3px;
  cursor: pointer;
  overflow: hidden;
}

.clip-progress__fill {
  position: absolute;
  top: 0;
  left: 0;
  height: 100%;
  background: var(--clip-mode-live-border);
  border-radius: 3px;
  transition: width 100ms linear;
}

.clip-progress:hover {
  height: 8px;
}

.clip-progress:hover .clip-progress__fill {
  background: #4ade80;  /* green-400 */
}

/* Seekable progress bar (for clips) */
.clip-progress--seekable:hover::after {
  content: '';
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 12px;
  height: 12px;
  background: white;
  border-radius: 50%;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  pointer-events: none;
}
```

### Speed Control (vMix pattern)

```css
.clip-speed-control {
  display: flex;
  gap: 4px;
}

.clip-speed-btn {
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 600;
  border-radius: 4px;
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  border: 1px solid var(--border-color);
  cursor: pointer;
  transition: all 150ms;
}

.clip-speed-btn:hover {
  background: var(--bg-secondary);
  color: var(--text-primary);
}

.clip-speed-btn--active {
  background: #3b82f6;
  color: white;
  border-color: #3b82f6;
}
```

**Tailwind equivalent:**
```html
<div class="flex gap-1">
  <button class="px-2 py-1 text-[11px] font-semibold rounded bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-900 hover:text-zinc-200">0.25x</button>
  <button class="px-2 py-1 text-[11px] font-semibold rounded bg-blue-500 text-white border border-blue-500">0.5x</button>
  <button class="px-2 py-1 text-[11px] font-semibold rounded bg-zinc-800 text-zinc-400 border border-zinc-700 hover:bg-zinc-900 hover:text-zinc-200">1x</button>
</div>
```

---

## 13. Thumbnail Specification

Thumbnails use apparatus-colored placeholder backgrounds when no image is available.

```css
.clip-thumbnail {
  position: relative;
  width: 64px;
  height: 48px;
  border-radius: 4px;
  overflow: hidden;
  background: var(--bg-tertiary);
  flex-shrink: 0;
}

/* Apparatus-colored placeholder */
.clip-thumbnail--vt { background: linear-gradient(135deg, rgba(239, 68, 68, 0.3), rgba(239, 68, 68, 0.1)); }
.clip-thumbnail--ub { background: linear-gradient(135deg, rgba(168, 85, 247, 0.3), rgba(168, 85, 247, 0.1)); }
.clip-thumbnail--bb { background: linear-gradient(135deg, rgba(59, 130, 246, 0.3), rgba(59, 130, 246, 0.1)); }
.clip-thumbnail--fx { background: linear-gradient(135deg, rgba(34, 197, 94, 0.3), rgba(34, 197, 94, 0.1)); }
.clip-thumbnail--ph { background: linear-gradient(135deg, rgba(249, 115, 22, 0.3), rgba(249, 115, 22, 0.1)); }
.clip-thumbnail--sr { background: linear-gradient(135deg, rgba(20, 184, 166, 0.3), rgba(20, 184, 166, 0.1)); }
.clip-thumbnail--pb { background: linear-gradient(135deg, rgba(99, 102, 241, 0.3), rgba(99, 102, 241, 0.1)); }
.clip-thumbnail--hb { background: linear-gradient(135deg, rgba(245, 158, 11, 0.3), rgba(245, 158, 11, 0.1)); }

/* Apparatus icon placeholder */
.clip-thumbnail__icon {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 18px;
  font-weight: 700;
  opacity: 0.6;
}

.clip-thumbnail--vt .clip-thumbnail__icon { color: var(--clip-apparatus-vt); }
.clip-thumbnail--ub .clip-thumbnail__icon { color: var(--clip-apparatus-ub); }
.clip-thumbnail--bb .clip-thumbnail__icon { color: var(--clip-apparatus-bb); }
.clip-thumbnail--fx .clip-thumbnail__icon { color: var(--clip-apparatus-fx); }
.clip-thumbnail--ph .clip-thumbnail__icon { color: var(--clip-apparatus-ph); }
.clip-thumbnail--sr .clip-thumbnail__icon { color: var(--clip-apparatus-sr); }
.clip-thumbnail--pb .clip-thumbnail__icon { color: var(--clip-apparatus-pb); }
.clip-thumbnail--hb .clip-thumbnail__icon { color: var(--clip-apparatus-hb); }

/* Duration overlay */
.clip-thumbnail__duration {
  position: absolute;
  bottom: 4px;
  right: 4px;
  padding: 1px 4px;
  font-size: 10px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  border-radius: 2px;
}

/* Playing indicator */
.clip-thumbnail__playing {
  position: absolute;
  top: 4px;
  left: 4px;
  width: 8px;
  height: 8px;
  background: var(--clip-mode-live-text);
  border-radius: 50%;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
```

### Thumbnail Sizes

| Context | Width | Height | Aspect Ratio |
|---------|-------|--------|--------------|
| Clip Queue Card | 64px | 48px | 4:3 |
| Now Playing | 80px | 60px | 4:3 |
| Camera Preview | 120px | 68px | 16:9 |
| Full Preview | 320px | 180px | 16:9 |

---

## 14. Responsive Breakpoints

The UI adapts to different screen sizes, optimizing for laptop and desktop monitors.

```css
/* Breakpoints */
:root {
  --clip-breakpoint-sm: 640px;   /* Mobile (not primary target) */
  --clip-breakpoint-md: 768px;   /* Tablet */
  --clip-breakpoint-lg: 1024px;  /* Laptop */
  --clip-breakpoint-xl: 1280px;  /* Desktop */
  --clip-breakpoint-2xl: 1536px; /* Large desktop */
}

/* Panel layout */
@media (min-width: 1024px) {
  .clip-layout {
    display: grid;
    grid-template-columns: 1fr 400px;  /* Main content + sidebar */
    gap: 16px;
  }
}

@media (min-width: 1280px) {
  .clip-layout {
    grid-template-columns: 1fr 480px;  /* Wider sidebar on desktop */
  }
}

@media (min-width: 1536px) {
  .clip-layout {
    grid-template-columns: 1fr 560px;  /* EVS-style 60/40 split */
  }
}

/* Clip queue density */
@media (max-width: 1279px) {
  .clip-card__thumbnail {
    width: 48px;
    height: 36px;
  }

  .clip-card {
    padding: 8px;
    gap: 8px;
  }
}

/* Camera grid */
@media (min-width: 1024px) {
  .clip-camera-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);  /* 3-up for women's */
    gap: 8px;
  }
}

@media (min-width: 1280px) {
  .clip-camera-grid--mens {
    grid-template-columns: repeat(3, 1fr);  /* 3x2 for 6 cameras */
  }
}

/* Keyboard shortcut panel overlay */
@media (max-width: 767px) {
  .clip-shortcuts-panel {
    position: fixed;
    inset: 0;
    padding: 16px;
  }
}

@media (min-width: 768px) {
  .clip-shortcuts-panel {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 480px;
    max-height: 80vh;
  }
}
```

**Tailwind breakpoint equivalents:**
```html
<!-- Main layout -->
<div class="lg:grid lg:grid-cols-[1fr_400px] xl:grid-cols-[1fr_480px] 2xl:grid-cols-[1fr_560px] gap-4">
  <!-- content -->
</div>

<!-- Camera grid -->
<div class="grid grid-cols-2 lg:grid-cols-3 gap-2">
  <!-- camera previews -->
</div>
```

---

## 15. Accessibility

All interactive elements must be accessible per PRD §8C requirements.

### Focus Styles

```css
/* Global focus-visible style */
*:focus-visible {
  outline: 2px solid #3b82f6;  /* blue-500 */
  outline-offset: 2px;
}

/* High contrast focus for dark backgrounds */
.clip-card:focus-visible,
.clip-transport__btn:focus-visible,
.clip-speed-btn:focus-visible {
  outline-color: #60a5fa;  /* blue-400 for better contrast */
}

/* Skip focus ring for mouse users */
*:focus:not(:focus-visible) {
  outline: none;
}
```

### ARIA Labels

All interactive elements require descriptive ARIA labels:

```html
<!-- Transport controls -->
<button aria-label="Pause playback" class="clip-transport__btn">
  <svg><!-- pause icon --></svg>
</button>

<button aria-label="Skip current clip" class="clip-transport__btn">
  <svg><!-- skip icon --></svg>
</button>

<button aria-label="Flag current moment for replay" class="clip-transport__btn">
  <svg><!-- flag icon --></svg>
</button>

<!-- Progress bar -->
<div
  role="progressbar"
  aria-label="Clip playback progress"
  aria-valuenow="25"
  aria-valuemin="0"
  aria-valuemax="100"
  class="clip-progress">
  <div class="clip-progress__fill" style="width: 25%"></div>
</div>

<!-- Mode badge -->
<span aria-label="Current mode: Live" class="clip-badge clip-badge-live">
  LIVE
</span>

<!-- Clip card -->
<div
  role="button"
  tabindex="0"
  aria-label="Select clip: Simone Biles, Vault, 15.400"
  class="clip-card">
  <!-- content -->
</div>
```

### Color + Text Requirement

Badges and status indicators must have text, not color alone:

```html
<!-- CORRECT: Text + color -->
<span class="clip-badge clip-badge-live">LIVE</span>
<span class="clip-badge clip-badge-paused">PAUSED</span>
<span class="clip-badge clip-badge-override">OVERRIDE</span>

<!-- INCORRECT: Color only -->
<span class="w-3 h-3 rounded-full bg-green-500"></span>
```

### Keyboard Navigation

| Action | Key | Scope |
|--------|-----|-------|
| Force Camera 1-6 | `1` - `6` | Global (when no input focused) |
| Skip Current | `S` | Global |
| Pause/Resume | `Space` | Global |
| Release Override | `Escape` | Global |
| Flag Moment | `F` | Global |
| Show Shortcuts | `?` | Global |
| Navigate clips | `↑` / `↓` | Clip queue focused |
| Select clip | `Enter` | Clip queue focused |
| Close modal | `Escape` | Modal open |

### Implementation Notes

```javascript
// Keyboard shortcut handler (PRD §8B)
useEffect(() => {
  const handler = (e) => {
    // Skip when in form elements
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;

    // Skip when modal is open (except Escape)
    if (document.querySelector('[role="dialog"]') && e.key !== 'Escape') return;

    switch (e.key) {
      case '1': case '2': case '3': case '4': case '5': case '6':
        e.preventDefault();
        forceCamera(parseInt(e.key));
        break;
      case 's': case 'S':
        e.preventDefault();
        skipCurrent();
        break;
      case ' ':
        e.preventDefault();
        togglePause();
        break;
      case 'Escape':
        e.preventDefault();
        releaseOverride();
        break;
      case 'f': case 'F':
        e.preventDefault();
        flagMoment();
        break;
      case '?':
        e.preventDefault();
        showShortcuts();
        break;
    }
  };

  document.addEventListener('keydown', handler);
  return () => document.removeEventListener('keydown', handler);
}, []);
```

### Color Contrast

All text meets WCAG AA (4.5:1 minimum contrast ratio):

| Element | Foreground | Background | Ratio |
|---------|------------|------------|-------|
| Primary text | `#e4e4e7` (zinc-200) | `#18181b` (zinc-900) | 12.6:1 |
| Secondary text | `#a1a1aa` (zinc-400) | `#18181b` (zinc-900) | 6.0:1 |
| Muted text | `#71717a` (zinc-500) | `#18181b` (zinc-900) | 4.5:1 |
| Badge (LIVE) | `#4ade80` (green-400) | `rgba(34,197,94,0.2)` | 7.2:1 |
| Badge (PAUSED) | `#facc15` (yellow-400) | `rgba(234,179,8,0.2)` | 8.9:1 |

### Screen Reader Support

Use semantic HTML elements:

```html
<!-- Use <button> not <div> -->
<button type="button" class="clip-transport__btn">...</button>

<!-- Use heading hierarchy -->
<h2 class="clip-panel__title">Clip Queue</h2>

<!-- Use <nav> for navigation -->
<nav aria-label="Clip queue tabs">
  <button aria-selected="true">Queued</button>
  <button aria-selected="false">Played</button>
</nav>

<!-- Use <dialog> for modals -->
<dialog role="dialog" aria-labelledby="dialog-title" aria-modal="true">
  <h2 id="dialog-title">Moment Replay</h2>
  ...
</dialog>
```
