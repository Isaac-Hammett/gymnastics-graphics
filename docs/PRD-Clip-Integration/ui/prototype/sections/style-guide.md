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
