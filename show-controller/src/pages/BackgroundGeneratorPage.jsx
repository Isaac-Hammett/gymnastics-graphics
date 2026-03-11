import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';

// Animation pattern renderers
const PATTERNS = {
  waves: {
    name: 'Flowing Waves',
    description: 'Smooth gradient waves that flow across the screen',
    render: renderWaves,
  },
  bokeh: {
    name: 'Bokeh Circles',
    description: 'Soft floating circles with gentle movement',
    render: renderBokeh,
  },
  stripes: {
    name: 'Diagonal Stripes',
    description: 'Animated diagonal stripe sweep',
    render: renderStripes,
  },
  geometric: {
    name: 'Geometric Grid',
    description: 'Tessellating shapes with color shifts',
    render: renderGeometric,
  },
  particles: {
    name: 'Particle Drift',
    description: 'Drifting particles with subtle connections',
    render: renderParticles,
  },
  gradient: {
    name: 'Rotating Gradient',
    description: 'Slowly rotating radial gradient blend',
    render: renderGradient,
  },
  cornerPulse: {
    name: 'Corner Pulse',
    description: 'Subtle color glow pulsing from the corners',
    render: renderCornerPulse,
  },
  aurora: {
    name: 'Aurora',
    description: 'Northern lights curtain effect',
    render: renderAurora,
  },
  ripple: {
    name: 'Ripples',
    description: 'Concentric rings expanding from center',
    render: renderRipple,
  },
  smoke: {
    name: 'Smoke',
    description: 'Drifting layered fog clouds',
    render: renderSmoke,
  },
  hexagons: {
    name: 'Hexagon Grid',
    description: 'Honeycomb pattern with shifting fills',
    render: renderHexagons,
  },
  starfield: {
    name: 'Starfield',
    description: 'Stars drifting through space',
    render: renderStarfield,
  },
  lava: {
    name: 'Lava Lamp',
    description: 'Organic blobby shapes that merge and split',
    render: renderLava,
  },
  scanlines: {
    name: 'Scanlines',
    description: 'Retro CRT scanline sweep',
    render: renderScanlines,
  },
  prism: {
    name: 'Prism Rays',
    description: 'Light rays refracting from a central point',
    render: renderPrism,
  },
  vignette: {
    name: 'Vignette Breathe',
    description: 'Breathing vignette with color-tinted edges',
    render: renderVignette,
  },
};

const DEFAULT_COLORS = ['#E91E8C', '#1a1a2e', '#FFFFFF', '#000000'];

// --- Color extraction ---
function extractColors(img, count = 5) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const size = 64;
  canvas.width = size;
  canvas.height = size;
  ctx.drawImage(img, 0, 0, size, size);

  const data = ctx.getImageData(0, 0, size, size).data;
  const pixels = [];
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
    if (a < 128) continue; // skip transparent
    // Skip near-white and near-black
    if (r > 240 && g > 240 && b > 240) continue;
    if (r < 15 && g < 15 && b < 15) continue;
    pixels.push([r, g, b]);
  }

  if (pixels.length === 0) return DEFAULT_COLORS.slice(0, count);

  // Simple k-means clustering
  let centroids = pixels.slice(0, count).map(p => [...p]);
  if (centroids.length < count) {
    while (centroids.length < count) centroids.push([...pixels[Math.floor(Math.random() * pixels.length)]]);
  }

  for (let iter = 0; iter < 10; iter++) {
    const clusters = centroids.map(() => []);
    for (const px of pixels) {
      let minDist = Infinity, minIdx = 0;
      for (let c = 0; c < centroids.length; c++) {
        const d = (px[0] - centroids[c][0]) ** 2 + (px[1] - centroids[c][1]) ** 2 + (px[2] - centroids[c][2]) ** 2;
        if (d < minDist) { minDist = d; minIdx = c; }
      }
      clusters[minIdx].push(px);
    }
    for (let c = 0; c < centroids.length; c++) {
      if (clusters[c].length === 0) continue;
      centroids[c] = clusters[c].reduce(
        (acc, px) => [acc[0] + px[0], acc[1] + px[1], acc[2] + px[2]],
        [0, 0, 0]
      ).map(v => Math.round(v / clusters[c].length));
    }
  }

  // Sort by vibrancy (saturation * brightness)
  centroids.sort((a, b) => {
    const satA = Math.max(...a) - Math.min(...a);
    const satB = Math.max(...b) - Math.min(...b);
    return (satB * Math.max(...b)) - (satA * Math.max(...a));
  });

  return centroids.map(c => `#${c.map(v => v.toString(16).padStart(2, '0')).join('')}`);
}

// Helper: scale a hex alpha string by intensity
function scaleAlpha(hexAlpha, intensity) {
  const val = parseInt(hexAlpha, 16);
  return Math.min(255, Math.round(val * intensity)).toString(16).padStart(2, '0');
}

// --- Animation renderers ---

function renderWaves(ctx, w, h, t, colors, state, intensity = 1) {
  ctx.fillStyle = colors[3] || '#000';
  ctx.fillRect(0, 0, w, h);

  for (let layer = 0; layer < 3; layer++) {
    const color = colors[layer % colors.length];
    ctx.globalAlpha = Math.min(1, (0.3 - layer * 0.05) * intensity);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 4) {
      const y = h * 0.5 + Math.sin((x / w) * 4 + t * 0.8 + layer * 2) * h * 0.15
        + Math.sin((x / w) * 2 + t * 0.5 + layer) * h * 0.1;
      ctx.lineTo(x, y + layer * h * 0.12);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function renderBokeh(ctx, w, h, t, colors, state, intensity = 1) {
  if (!state.circles) {
    state.circles = Array.from({ length: 30 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: 20 + Math.random() * 80,
      dx: (Math.random() - 0.5) * 0.5,
      dy: (Math.random() - 0.5) * 0.3,
      color: colors[Math.floor(Math.random() * colors.length)],
      phase: Math.random() * Math.PI * 2,
    }));
  }

  ctx.fillStyle = colors[3] || '#000';
  ctx.fillRect(0, 0, w, h);

  for (const c of state.circles) {
    c.x += c.dx;
    c.y += c.dy;
    if (c.x < -c.r) c.x = w + c.r;
    if (c.x > w + c.r) c.x = -c.r;
    if (c.y < -c.r) c.y = h + c.r;
    if (c.y > h + c.r) c.y = -c.r;

    const pulse = 1 + Math.sin(t + c.phase) * 0.15;
    const a0 = Math.min(255, Math.round(0x40 * intensity)).toString(16).padStart(2, '0');
    const a1 = Math.min(255, Math.round(0x20 * intensity)).toString(16).padStart(2, '0');
    const grad = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r * pulse);
    grad.addColorStop(0, c.color + a0);
    grad.addColorStop(0.5, c.color + a1);
    grad.addColorStop(1, c.color + '00');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r * pulse, 0, Math.PI * 2);
    ctx.fill();
  }
}

function renderStripes(ctx, w, h, t, colors, state, intensity = 1) {
  ctx.fillStyle = colors[3] || '#000';
  ctx.fillRect(0, 0, w, h);

  const stripeW = 60;
  const angle = Math.PI / 4;
  const offset = (t * 40) % (stripeW * colors.length);

  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.rotate(angle);

  const diag = Math.sqrt(w * w + h * h);
  for (let x = -diag - offset; x < diag; x += stripeW) {
    const idx = Math.abs(Math.floor((x + offset) / stripeW)) % colors.length;
    ctx.globalAlpha = Math.min(1, 0.25 * intensity);
    ctx.fillStyle = colors[idx];
    ctx.fillRect(x, -diag, stripeW * 0.7, diag * 2);
  }

  ctx.restore();
  ctx.globalAlpha = 1;
}

function renderGeometric(ctx, w, h, t, colors, state, intensity = 1) {
  ctx.fillStyle = colors[3] || '#000';
  ctx.fillRect(0, 0, w, h);

  const cellSize = 80;
  const cols = Math.ceil(w / cellSize) + 1;
  const rows = Math.ceil(h / cellSize) + 1;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = col * cellSize;
      const y = row * cellSize;
      const colorIdx = (row + col) % (colors.length - 1);
      const phase = Math.sin(t * 0.5 + row * 0.3 + col * 0.2);

      ctx.globalAlpha = Math.min(1, (0.15 + phase * 0.1) * intensity);
      ctx.fillStyle = colors[colorIdx];

      if ((row + col) % 2 === 0) {
        // Diamond
        ctx.beginPath();
        ctx.moveTo(x + cellSize / 2, y);
        ctx.lineTo(x + cellSize, y + cellSize / 2);
        ctx.lineTo(x + cellSize / 2, y + cellSize);
        ctx.lineTo(x, y + cellSize / 2);
        ctx.closePath();
        ctx.fill();
      } else {
        // Circle
        const r = (cellSize / 3) * (0.8 + phase * 0.2);
        ctx.beginPath();
        ctx.arc(x + cellSize / 2, y + cellSize / 2, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
  ctx.globalAlpha = 1;
}

function renderParticles(ctx, w, h, t, colors, state, intensity = 1) {
  if (!state.particles) {
    state.particles = Array.from({ length: 60 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.8,
      vy: (Math.random() - 0.5) * 0.8,
      r: 2 + Math.random() * 3,
      color: colors[Math.floor(Math.random() * (colors.length - 1))],
    }));
  }

  ctx.fillStyle = (colors[3] || '#000') + 'E0';
  ctx.fillRect(0, 0, w, h);

  const particles = state.particles;
  for (const p of particles) {
    p.x += p.vx;
    p.y += p.vy;
    if (p.x < 0) p.x = w;
    if (p.x > w) p.x = 0;
    if (p.y < 0) p.y = h;
    if (p.y > h) p.y = 0;
  }

  // Draw connections
  ctx.strokeStyle = colors[0] + '30';
  ctx.lineWidth = 0.5;
  for (let i = 0; i < particles.length; i++) {
    for (let j = i + 1; j < particles.length; j++) {
      const dx = particles[i].x - particles[j].x;
      const dy = particles[i].y - particles[j].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 120) {
        ctx.globalAlpha = Math.min(1, (1 - dist / 120) * 0.3 * intensity);
        ctx.beginPath();
        ctx.moveTo(particles[i].x, particles[i].y);
        ctx.lineTo(particles[j].x, particles[j].y);
        ctx.stroke();
      }
    }
  }

  // Draw particles
  ctx.globalAlpha = Math.min(1, 0.8 * intensity);
  for (const p of particles) {
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function renderGradient(ctx, w, h, t, colors, state, intensity = 1) {
  const cx = w / 2 + Math.cos(t * 0.3) * w * 0.2;
  const cy = h / 2 + Math.sin(t * 0.2) * h * 0.2;
  const radius = Math.max(w, h) * 0.8;

  const grad = ctx.createRadialGradient(cx, cy, 0, w / 2, h / 2, radius);
  grad.addColorStop(0, colors[0]);
  grad.addColorStop(0.4, colors[1] || colors[0]);
  grad.addColorStop(0.7, colors[2] || colors[1] || colors[0]);
  grad.addColorStop(1, colors[3] || '#000');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);
}

// --- Corner Pulse ---
function renderCornerPulse(ctx, w, h, t, colors, state, intensity = 1) {
  ctx.fillStyle = colors[3] || '#000';
  ctx.fillRect(0, 0, w, h);

  const corners = [[0, 0], [w, 0], [w, h], [0, h]];
  for (let i = 0; i < 4; i++) {
    const [cx, cy] = corners[i];
    const pulse = 0.4 + Math.sin(t * 0.6 + i * Math.PI / 2) * 0.25;
    const radius = Math.max(w, h) * (0.4 + pulse * 0.3);
    const a0 = scaleAlpha('35', intensity);
    const a1 = scaleAlpha('12', intensity);
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    grad.addColorStop(0, colors[i % colors.length] + a0);
    grad.addColorStop(0.5, colors[i % colors.length] + a1);
    grad.addColorStop(1, colors[i % colors.length] + '00');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }
}

// --- Aurora ---
function renderAurora(ctx, w, h, t, colors, state, intensity = 1) {
  ctx.fillStyle = colors[3] || '#000';
  ctx.fillRect(0, 0, w, h);

  for (let band = 0; band < 5; band++) {
    const color = colors[band % (colors.length - 1)];
    ctx.globalAlpha = Math.min(1, (0.12 + Math.sin(t * 0.3 + band) * 0.06) * intensity);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    for (let x = 0; x <= w; x += 4) {
      const baseY = h * (0.15 + band * 0.1);
      const y = baseY
        + Math.sin((x / w) * 3 + t * 0.4 + band * 1.5) * h * 0.08
        + Math.sin((x / w) * 7 + t * 0.7 + band) * h * 0.03;
      ctx.lineTo(x, y);
    }
    for (let x = w; x >= 0; x -= 4) {
      const baseY = h * (0.15 + band * 0.1) + h * 0.12;
      const y = baseY
        + Math.sin((x / w) * 3 + t * 0.4 + band * 1.5 + 1) * h * 0.06
        + Math.sin((x / w) * 5 + t * 0.6 + band) * h * 0.04;
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// --- Ripple ---
function renderRipple(ctx, w, h, t, colors, state, intensity = 1) {
  ctx.fillStyle = colors[3] || '#000';
  ctx.fillRect(0, 0, w, h);

  const cx = w / 2, cy = h / 2;
  const maxR = Math.sqrt(cx * cx + cy * cy);
  const ringCount = 8;

  for (let i = 0; i < ringCount; i++) {
    const phase = (t * 0.5 + i / ringCount) % 1;
    const r = phase * maxR;
    const alpha = Math.min(1, (1 - phase) * 0.3 * intensity);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = colors[i % (colors.length - 1)];
    ctx.lineWidth = 3 + (1 - phase) * 4;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// --- Smoke ---
function renderSmoke(ctx, w, h, t, colors, state, intensity = 1) {
  if (!state.clouds) {
    state.clouds = Array.from({ length: 12 }, (_, i) => ({
      x: Math.random() * w,
      y: h * 0.3 + Math.random() * h * 0.5,
      rx: 100 + Math.random() * 200,
      ry: 40 + Math.random() * 80,
      dx: (Math.random() - 0.5) * 0.4,
      phase: Math.random() * Math.PI * 2,
      color: colors[i % (colors.length - 1)],
    }));
  }

  ctx.fillStyle = colors[3] || '#000';
  ctx.fillRect(0, 0, w, h);

  for (const c of state.clouds) {
    c.x += c.dx;
    if (c.x < -c.rx * 2) c.x = w + c.rx;
    if (c.x > w + c.rx * 2) c.x = -c.rx;

    const pulse = 1 + Math.sin(t * 0.3 + c.phase) * 0.2;
    const grad = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.rx * pulse);
    grad.addColorStop(0, c.color + scaleAlpha('18', intensity));
    grad.addColorStop(0.6, c.color + scaleAlpha('0A', intensity));
    grad.addColorStop(1, c.color + '00');
    ctx.fillStyle = grad;

    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.scale(1, c.ry / c.rx);
    ctx.beginPath();
    ctx.arc(0, 0, c.rx * pulse, 0, Math.PI * 2);
    ctx.restore();
    ctx.fill();
  }
}

// --- Hexagons ---
function renderHexagons(ctx, w, h, t, colors, state, intensity = 1) {
  ctx.fillStyle = colors[3] || '#000';
  ctx.fillRect(0, 0, w, h);

  const size = 40;
  const hGap = size * 1.75;
  const vGap = size * 1.5;
  const cols = Math.ceil(w / hGap) + 2;
  const rows = Math.ceil(h / vGap) + 2;

  for (let row = -1; row < rows; row++) {
    for (let col = -1; col < cols; col++) {
      const cx = col * hGap + (row % 2) * hGap * 0.5;
      const cy = row * vGap;
      const dist = Math.sqrt((cx - w / 2) ** 2 + (cy - h / 2) ** 2);
      const phase = Math.sin(t * 0.4 + dist * 0.005);
      const colorIdx = Math.abs(row + col) % (colors.length - 1);

      ctx.globalAlpha = Math.min(1, (0.08 + phase * 0.08) * intensity);
      ctx.fillStyle = colors[colorIdx];
      ctx.strokeStyle = colors[colorIdx] + scaleAlpha('30', intensity);
      ctx.lineWidth = 1;

      ctx.beginPath();
      for (let a = 0; a < 6; a++) {
        const angle = (Math.PI / 3) * a - Math.PI / 6;
        const px = cx + size * Math.cos(angle);
        const py = cy + size * Math.sin(angle);
        if (a === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}

// --- Starfield ---
function renderStarfield(ctx, w, h, t, colors, state, intensity = 1) {
  if (!state.stars) {
    state.stars = Array.from({ length: 150 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      z: Math.random(),
      phase: Math.random() * Math.PI * 2,
    }));
  }

  ctx.fillStyle = colors[3] || '#000';
  ctx.fillRect(0, 0, w, h);

  for (const s of state.stars) {
    s.x -= s.z * 0.5 + 0.1;
    if (s.x < 0) { s.x = w; s.y = Math.random() * h; }

    const twinkle = 0.4 + Math.sin(t * 2 + s.phase) * 0.4;
    const r = 0.5 + s.z * 2;
    const colorIdx = Math.floor(s.phase) % (colors.length - 1);
    ctx.globalAlpha = Math.min(1, twinkle * s.z * intensity);
    ctx.fillStyle = colors[colorIdx];
    ctx.beginPath();
    ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// --- Lava Lamp ---
function renderLava(ctx, w, h, t, colors, state, intensity = 1) {
  ctx.fillStyle = colors[3] || '#000';
  ctx.fillRect(0, 0, w, h);

  const blobCount = 6;
  for (let i = 0; i < blobCount; i++) {
    const cx = w * (0.2 + 0.6 * (i / blobCount)) + Math.sin(t * 0.3 + i * 2) * w * 0.1;
    const cy = h * 0.5 + Math.sin(t * 0.2 + i * 1.5) * h * 0.3;
    const rx = 80 + Math.sin(t * 0.4 + i) * 30;
    const ry = 100 + Math.cos(t * 0.3 + i * 0.7) * 40;
    const color = colors[i % (colors.length - 1)];

    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry));
    grad.addColorStop(0, color + scaleAlpha('50', intensity));
    grad.addColorStop(0.5, color + scaleAlpha('20', intensity));
    grad.addColorStop(1, color + '00');
    ctx.fillStyle = grad;

    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, ry / rx);
    ctx.beginPath();
    ctx.arc(0, 0, rx, 0, Math.PI * 2);
    ctx.restore();
    ctx.fill();
  }
}

// --- Scanlines ---
function renderScanlines(ctx, w, h, t, colors, state, intensity = 1) {
  // Base gradient
  const grad = ctx.createLinearGradient(0, 0, w, h);
  grad.addColorStop(0, colors[3] || '#000');
  grad.addColorStop(0.5, colors[1] + '40');
  grad.addColorStop(1, colors[3] || '#000');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Scanlines
  const lineH = 3;
  const sweep = ((t * 60) % (h + 200)) - 100;
  for (let y = 0; y < h; y += lineH * 2) {
    const distFromSweep = Math.abs(y - sweep);
    const glow = Math.max(0, 1 - distFromSweep / 100);
    ctx.globalAlpha = Math.min(1, (0.03 + glow * 0.15) * intensity);
    ctx.fillStyle = glow > 0.3 ? colors[0] : colors[2] || '#333';
    ctx.fillRect(0, y, w, lineH);
  }

  // Sweep highlight
  ctx.globalAlpha = 0.1;
  const sweepGrad = ctx.createLinearGradient(0, sweep - 50, 0, sweep + 50);
  sweepGrad.addColorStop(0, colors[0] + '00');
  sweepGrad.addColorStop(0.5, colors[0] + '30');
  sweepGrad.addColorStop(1, colors[0] + '00');
  ctx.fillStyle = sweepGrad;
  ctx.fillRect(0, sweep - 50, w, 100);
  ctx.globalAlpha = 1;
}

// --- Prism Rays ---
function renderPrism(ctx, w, h, t, colors, state, intensity = 1) {
  ctx.fillStyle = colors[3] || '#000';
  ctx.fillRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;
  const rayCount = 24;
  const maxLen = Math.max(w, h);

  for (let i = 0; i < rayCount; i++) {
    const angle = (i / rayCount) * Math.PI * 2 + t * 0.15;
    const width = (Math.PI * 2 / rayCount) * 0.4;
    const pulse = 0.5 + Math.sin(t * 0.8 + i * 0.5) * 0.3;
    const color = colors[i % (colors.length - 1)];

    ctx.globalAlpha = Math.min(1, (0.08 + pulse * 0.07) * intensity);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, maxLen, angle - width / 2, angle + width / 2);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// --- Vignette Breathe ---
function renderVignette(ctx, w, h, t, colors, state, intensity = 1) {
  // Fill center color
  ctx.fillStyle = colors[3] || '#000';
  ctx.fillRect(0, 0, w, h);

  // Breathing vignette from edges
  const breath = 0.6 + Math.sin(t * 0.4) * 0.2;
  const innerR = Math.min(w, h) * (0.2 + breath * 0.2);
  const outerR = Math.max(w, h) * 0.9;

  const grad = ctx.createRadialGradient(w / 2, h / 2, innerR, w / 2, h / 2, outerR);
  grad.addColorStop(0, (colors[3] || '#000') + '00');
  grad.addColorStop(0.4, colors[1] + scaleAlpha('20', intensity));
  grad.addColorStop(0.7, colors[0] + scaleAlpha('40', intensity));
  grad.addColorStop(1, colors[0] + scaleAlpha('60', intensity));
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  // Subtle secondary color wash
  const wash = 0.5 + Math.sin(t * 0.25 + 1) * 0.3;
  ctx.globalAlpha = Math.min(1, wash * 0.08 * intensity);
  ctx.fillStyle = colors[2] || colors[0];
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 1;
}

// --- Main Component ---

export default function BackgroundGeneratorPage() {
  const canvasRef = useRef(null);
  const animFrameRef = useRef(null);
  const stateRef = useRef({});

  const [pattern, setPattern] = useState('waves');
  const [colors, setColors] = useState([...DEFAULT_COLORS]);
  const [logoSrc, setLogoSrc] = useState(null);
  const [speed, setSpeed] = useState(1);
  const [intensity, setIntensity] = useState(1);
  const [resolution, setResolution] = useState('1920x1080');
  const [editingColorIdx, setEditingColorIdx] = useState(null);

  const [resW, resH] = useMemo(() => resolution.split('x').map(Number), [resolution]);

  // Reset animation state when pattern changes
  useEffect(() => {
    stateRef.current = {};
  }, [pattern, colors]);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let startTime = performance.now();

    function frame(now) {
      const t = ((now - startTime) / 1000) * speed;
      canvas.width = resW;
      canvas.height = resH;
      PATTERNS[pattern].render(ctx, resW, resH, t, colors, stateRef.current, intensity);
      animFrameRef.current = requestAnimationFrame(frame);
    }

    animFrameRef.current = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [pattern, colors, speed, intensity, resW, resH]);

  // Logo upload handler
  const handleLogoUpload = useCallback((e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const extracted = extractColors(img);
        setColors(extracted.slice(0, 4));
        setLogoSrc(reader.result);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  }, []);

  // Load from URL
  const handleLogoUrl = useCallback((url) => {
    if (!url) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const extracted = extractColors(img);
      setColors(extracted.slice(0, 4));
      setLogoSrc(url);
    };
    img.onerror = () => {
      // Try with proxy if CORS fails
      console.warn('Direct load failed, logo may have CORS restrictions');
    };
    img.src = url;
  }, []);

  const updateColor = (idx, value) => {
    const next = [...colors];
    next[idx] = value;
    setColors(next);
    stateRef.current = {};
  };

  // Build OBS browser source URL
  const obsUrl = useMemo(() => {
    const base = window.location.origin;
    const params = new URLSearchParams({
      pattern,
      colors: colors.join(','),
      speed: speed.toString(),
      intensity: intensity.toString(),
    });
    return `${base}/overlays/animated-background.html?${params}`;
  }, [pattern, colors, speed, intensity]);

  const [copied, setCopied] = useState(false);
  const copyUrl = () => {
    navigator.clipboard.writeText(obsUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="border-b border-zinc-800 bg-zinc-900/50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/" className="text-zinc-400 hover:text-white text-sm">&larr; Back</Link>
          <h1 className="text-lg font-bold">Animated Background Generator</h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Preview */}
          <div className="lg:col-span-2">
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between">
                <span className="text-sm font-medium text-zinc-400">Preview ({resolution})</span>
                <select
                  value={resolution}
                  onChange={e => setResolution(e.target.value)}
                  className="bg-zinc-800 text-white text-sm rounded px-2 py-1 border border-zinc-700"
                >
                  <option value="1920x1080">1920x1080 (1080p)</option>
                  <option value="1280x720">1280x720 (720p)</option>
                  <option value="3840x2160">3840x2160 (4K)</option>
                </select>
              </div>
              <div className="relative" style={{ paddingBottom: `${(resH / resW) * 100}%` }}>
                <canvas
                  ref={canvasRef}
                  className="absolute inset-0 w-full h-full"
                  width={resW}
                  height={resH}
                />
              </div>
            </div>
          </div>

          {/* Controls */}
          <div className="space-y-6">

            {/* Logo Upload */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide mb-3">Extract Colors from Logo</h2>
              <label className="block w-full cursor-pointer bg-zinc-800 hover:bg-zinc-700 border-2 border-dashed border-zinc-600 rounded-lg p-4 text-center transition-colors">
                <input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                {logoSrc ? (
                  <img src={logoSrc} alt="Logo" className="h-16 mx-auto object-contain" />
                ) : (
                  <span className="text-zinc-400 text-sm">Drop or click to upload a logo</span>
                )}
              </label>
              <div className="mt-3">
                <input
                  type="text"
                  placeholder="Or paste a logo URL..."
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500"
                  onKeyDown={e => { if (e.key === 'Enter') handleLogoUrl(e.target.value); }}
                  onBlur={e => { if (e.target.value) handleLogoUrl(e.target.value); }}
                />
              </div>
            </div>

            {/* Colors */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide mb-3">Colors</h2>
              <div className="grid grid-cols-4 gap-2">
                {colors.map((color, i) => (
                  <div key={i} className="relative">
                    <button
                      onClick={() => setEditingColorIdx(editingColorIdx === i ? null : i)}
                      className="w-full aspect-square rounded-lg border-2 border-zinc-700 hover:border-zinc-500 transition-colors"
                      style={{ backgroundColor: color }}
                      title={`Color ${i + 1}: ${color}`}
                    />
                    <span className="block text-center text-xs text-zinc-500 mt-1">
                      {['Primary', 'Secondary', 'Accent', 'BG'][i]}
                    </span>
                    {editingColorIdx === i && (
                      <div className="absolute top-full left-0 z-10 mt-2 bg-zinc-800 border border-zinc-700 rounded-lg p-3 shadow-xl">
                        <input
                          type="color"
                          value={color}
                          onChange={e => updateColor(i, e.target.value)}
                          className="w-20 h-10 cursor-pointer"
                        />
                        <input
                          type="text"
                          value={color}
                          onChange={e => {
                            if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) updateColor(i, e.target.value);
                          }}
                          className="w-20 bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-xs text-white mt-2"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Pattern */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide mb-3">Pattern</h2>
              <div className="space-y-2">
                {Object.entries(PATTERNS).map(([key, p]) => (
                  <button
                    key={key}
                    onClick={() => setPattern(key)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                      pattern === key
                        ? 'bg-blue-600 text-white'
                        : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                    }`}
                  >
                    <div className="font-medium">{p.name}</div>
                    <div className={`text-xs ${pattern === key ? 'text-blue-200' : 'text-zinc-500'}`}>{p.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Speed & Intensity */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
              <div>
                <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide mb-2">Speed</h2>
                <input
                  type="range"
                  min="0.1"
                  max="3"
                  step="0.1"
                  value={speed}
                  onChange={e => setSpeed(parseFloat(e.target.value))}
                  className="w-full"
                />
                <div className="text-xs text-zinc-500 text-center mt-1">{speed.toFixed(1)}x</div>
              </div>
              <div>
                <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide mb-2">Color Intensity</h2>
                <input
                  type="range"
                  min="0.2"
                  max="3"
                  step="0.1"
                  value={intensity}
                  onChange={e => setIntensity(parseFloat(e.target.value))}
                  className="w-full"
                />
                <div className="text-xs text-zinc-500 text-center mt-1">{intensity.toFixed(1)}x</div>
              </div>
            </div>

            {/* OBS URL */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
              <h2 className="text-sm font-semibold text-zinc-300 uppercase tracking-wide mb-3">OBS Browser Source URL</h2>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={obsUrl}
                  className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-zinc-300 font-mono"
                />
                <button
                  onClick={copyUrl}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <p className="text-xs text-zinc-500 mt-2">
                Add this as a Browser Source in OBS for a live animated background.
              </p>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}
