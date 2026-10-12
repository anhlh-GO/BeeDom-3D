// Screen design system measured on the reference shot (915 × 1719 px, portrait): every position and size
// in REF px, plus the HUD components drawn with code. game.ts maps REF px to the device (uniform scale,
// top block anchored to the top safe area, slots / hive grid / toolbar anchored to the bottom).

import { COLORS } from './levels.ts';

type C = CanvasRenderingContext2D;

export const REF = { w: 915, h: 1719 };

/** Bounding boxes measured on the reference (centres unless noted). */
export const POS = {
  pause: { x: 90, y: 60, w: 104, h: 96 },
  level: { x: 457, y: 52, w: 280, h: 74, ropes: [352, 557] },
  coin: { x: 726, y: 57, r: 41, pill: { x0: 732, x1: 886, h: 66 }, plus: { x: 755, y: 88, r: 22 } },
  counter: { x0: 60, x1: 228, y: 165, h: 70, icon: { x: 62, y: 165, s: 78 }, textX: 155 },
  hive: { x: 830, y: 192, w: 152, h: 168, door: { x: 800, y: 214 } },
  puzzle: { x0: 135, x1: 775, y0: 240, y1: 800 },
  /** everything below is anchored to the bottom of the screen */
  slots: { y: 915, x0: 152, dx: 152.5, r: 59 },
  grid: { y0: 1057, dy: 119, x0: 205, dx: 167.7, w: 126, rows: 4 },
  bar: { y: 1574, r: 56 },
  boosters: { y: 1586, x0: 147, dx: 206, r: 70 },
};

export const PALETTE = {
  skyTop: '#a3d5f5',
  skyMid: '#b6dcf4',
  skyBottom: '#d3e6f4',
  wood: ['#bf7d4c', '#9a5a30', '#6b3a1b'],
  woodText: '#5b2e12',
  cream: ['#fff6e2', '#f4e0bd'],
  barTop: '#5558a6',
  barBottom: '#34366d',
};

export const FONT = "'Fredoka','Baloo 2','Nunito','Arial Rounded MT Bold','Lilita One',system-ui,sans-serif";

export function label(g: C, s: string, x: number, y: number, size: number, fill: string, stroke: string, strokeW = 0.2): void {
  g.font = `bold ${Math.round(size)}px ${FONT}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  if (stroke) {
    g.strokeStyle = stroke;
    g.lineWidth = Math.max(1.5, size * strokeW);
    g.strokeText(s, x, y);
  }
  g.fillStyle = fill;
  g.fillText(s, x, y);
}

export function rrect(g: C, x: number, y: number, w: number, h: number, r: number): void {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// ------------------------------------------------------------------ background

export function background(g: C, w: number, h: number): void {
  const grad = g.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, PALETTE.skyTop);
  grad.addColorStop(0.5, PALETTE.skyMid);
  grad.addColorStop(1, PALETTE.skyBottom);
  g.fillStyle = grad;
  g.fillRect(0, 0, w, h);
  // the faintest light from above the toy
  const rg = g.createRadialGradient(w / 2, h * 0.3, 0, w / 2, h * 0.3, Math.max(w, h) * 0.6);
  rg.addColorStop(0, 'rgba(255,255,255,0.12)');
  rg.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = rg;
  g.fillRect(0, 0, w, h);
}

// ------------------------------------------------------------------ top HUD

/** Brown wooden rounded-square pause button. */
export function pauseButton(g: C, x: number, y: number, w: number, h: number, press = 0): void {
  const r = w * 0.22;
  const x0 = x - w / 2;
  const y0 = y - h / 2 + press * h * 0.05;
  g.fillStyle = PALETTE.wood[2];
  rrect(g, x0, y0 + h * 0.08, w, h, r);
  g.fill();
  const grad = g.createLinearGradient(0, y0, 0, y0 + h);
  grad.addColorStop(0, '#c88655');
  grad.addColorStop(1, '#9b5b31');
  g.fillStyle = grad;
  rrect(g, x0, y0, w, h * 0.94, r);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.16)';
  rrect(g, x0 + w * 0.1, y0 + h * 0.06, w * 0.8, h * 0.3, r * 0.6);
  g.fill();
  // two thick white bars with a soft shadow
  for (const dx of [-0.17, 0.17]) {
    g.fillStyle = 'rgba(70,30,10,0.35)';
    rrect(g, x + dx * w - w * 0.09, y0 + h * 0.27 + h * 0.04, w * 0.18, h * 0.42, w * 0.07);
    g.fill();
    g.fillStyle = '#ffffff';
    rrect(g, x + dx * w - w * 0.09, y0 + h * 0.25, w * 0.18, h * 0.42, w * 0.07);
    g.fill();
  }
}

/** Wooden sign hanging on two ropes from the top edge, with the level name. */
export function levelSign(g: C, x: number, y: number, w: number, h: number, ropes: [number, number], text: string, punch = 0): void {
  const top = y - h / 2;
  // ropes (twisted: light / dark dashes)
  for (const rx of ropes) {
    g.strokeStyle = '#b48a55';
    g.lineWidth = h * 0.12;
    g.beginPath();
    g.moveTo(rx, -2);
    g.lineTo(rx, top + h * 0.2);
    g.stroke();
    g.strokeStyle = '#e2c290';
    g.lineWidth = h * 0.05;
    g.setLineDash([h * 0.08, h * 0.08]);
    g.beginPath();
    g.moveTo(rx, -2);
    g.lineTo(rx, top + h * 0.2);
    g.stroke();
    g.setLineDash([]);
  }
  g.save();
  g.translate(x, y);
  const k = 1 + punch * 0.08;
  g.scale(k, k);
  // plank with notched ends
  const shape = (dy: number): void => {
    const hw = w / 2;
    const hh = h / 2;
    g.beginPath();
    g.moveTo(-hw + h * 0.25, -hh + dy);
    g.lineTo(hw - h * 0.25, -hh + dy);
    g.quadraticCurveTo(hw, -hh + dy, hw - h * 0.04, -hh * 0.2 + dy);
    g.lineTo(hw - h * 0.12, dy);
    g.lineTo(hw - h * 0.02, hh * 0.3 + dy);
    g.quadraticCurveTo(hw, hh + dy, hw - h * 0.25, hh + dy);
    g.lineTo(-hw + h * 0.25, hh + dy);
    g.quadraticCurveTo(-hw, hh + dy, -hw + h * 0.02, hh * 0.3 + dy);
    g.lineTo(-hw + h * 0.12, dy);
    g.lineTo(-hw + h * 0.04, -hh * 0.2 + dy);
    g.quadraticCurveTo(-hw, -hh + dy, -hw + h * 0.25, -hh + dy);
    g.closePath();
  };
  g.fillStyle = PALETTE.wood[2];
  shape(h * 0.08);
  g.fill();
  const grad = g.createLinearGradient(0, -h / 2, 0, h / 2);
  grad.addColorStop(0, '#b97a4c');
  grad.addColorStop(1, '#94562f');
  g.fillStyle = grad;
  shape(0);
  g.fill();
  // grain
  g.strokeStyle = 'rgba(90,45,15,0.25)';
  g.lineWidth = 1;
  for (const gy of [-0.22, 0.24]) {
    g.beginPath();
    g.moveTo(-w * 0.42, gy * h);
    g.quadraticCurveTo(0, gy * h + h * 0.06, w * 0.42, gy * h);
    g.stroke();
  }
  g.strokeStyle = 'rgba(255,220,180,0.25)';
  g.lineWidth = h * 0.04;
  g.beginPath();
  g.moveTo(-w / 2 + h * 0.3, -h / 2 + h * 0.08);
  g.lineTo(w / 2 - h * 0.3, -h / 2 + h * 0.08);
  g.stroke();
  label(g, text, 0, h * 0.02, h * 0.5, '#ffffff', PALETTE.woodText, 0.22);
  g.restore();
}

/** Gold star coin + cream pill + green plus. */
export function coinDisplay(g: C, p: typeof POS.coin, k: number, ox: number, oy: number, value: number): void {
  const X = (v: number): number => ox + v * k;
  const Y = (v: number): number => oy + v * k;
  const ph = p.pill.h * k;
  const px0 = X(p.pill.x0);
  const pw = (p.pill.x1 - p.pill.x0) * k;
  const py = Y(p.y) - ph / 2;
  g.fillStyle = 'rgba(120,90,50,0.25)';
  rrect(g, px0, py + ph * 0.08, pw, ph, ph / 2);
  g.fill();
  const pg = g.createLinearGradient(0, py, 0, py + ph);
  pg.addColorStop(0, PALETTE.cream[0]);
  pg.addColorStop(1, PALETTE.cream[1]);
  g.fillStyle = pg;
  rrect(g, px0, py, pw, ph, ph / 2);
  g.fill();
  label(g, String(value), px0 + pw * 0.56, Y(p.y) + ph * 0.02, ph * 0.56, '#5b2e12', '', 0);
  starCoin(g, X(p.x), Y(p.y), p.r * k);
  plusBadge(g, X(p.plus.x), Y(p.plus.y), p.plus.r * k);
}

export function starCoin(g: C, x: number, y: number, r: number): void {
  g.fillStyle = '#c87d00';
  g.beginPath();
  g.arc(x, y + r * 0.08, r, 0, Math.PI * 2);
  g.fill();
  const grad = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  grad.addColorStop(0, '#fff3a0');
  grad.addColorStop(0.55, '#ffd21c');
  grad.addColorStop(1, '#f2a300');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#e59400';
  g.lineWidth = r * 0.1;
  g.beginPath();
  g.arc(x, y, r * 0.72, 0, Math.PI * 2);
  g.stroke();
  // star
  g.fillStyle = '#ffe24a';
  g.strokeStyle = '#e08a00';
  g.lineWidth = r * 0.08;
  g.lineJoin = 'round';
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 ? r * 0.24 : r * 0.52;
    g.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
  }
  g.closePath();
  g.fill();
  g.stroke();
}

export function plusBadge(g: C, x: number, y: number, r: number): void {
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.arc(x, y, r * 1.12, 0, Math.PI * 2);
  g.fill();
  const grad = g.createLinearGradient(0, y - r, 0, y + r);
  grad.addColorStop(0, '#7be35e');
  grad.addColorStop(1, '#2fa52a');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#ffffff';
  g.lineWidth = r * 0.32;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(x - r * 0.48, y); g.lineTo(x + r * 0.48, y);
  g.moveTo(x, y - r * 0.48); g.lineTo(x, y + r * 0.48);
  g.stroke();
}

export function countBadge(g: C, x: number, y: number, r: number, n: number): void {
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.arc(x, y, r * 1.12, 0, Math.PI * 2);
  g.fill();
  const grad = g.createLinearGradient(0, y - r, 0, y + r);
  grad.addColorStop(0, '#ffab3d');
  grad.addColorStop(1, '#f06a0a');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  label(g, String(n), x, y + r * 0.04, r * 1.25, '#ffffff', '#a8420a', 0.16);
}

/** Dark translucent capsule with a golden screw: removed / total. */
export function screwCounter(g: C, x0: number, x1: number, y: number, h: number, ix: number, iy: number, is: number, tx: number, text: string, pop = 0): void {
  g.fillStyle = 'rgba(66,88,108,0.55)';
  rrect(g, x0, y - h / 2, x1 - x0, h, h / 2);
  g.fill();
  goldScrew(g, ix, iy, is);
  label(g, text, tx, y + h * 0.02, h * 0.5 * (1 + pop * 0.2), '#ffffff', '#1d2a38', 0.16);
}

/** A golden screw lying tilted: head with a cross and a threaded shaft. */
export function goldScrew(g: C, x: number, y: number, s: number): void {
  g.save();
  g.translate(x, y);
  g.rotate(-0.35);
  // shaft
  const sh = g.createLinearGradient(-s * 0.18, 0, s * 0.18, 0);
  sh.addColorStop(0, '#b07a00');
  sh.addColorStop(0.45, '#ffe066');
  sh.addColorStop(1, '#a86f00');
  g.fillStyle = sh;
  rrect(g, -s * 0.17, -s * 0.12, s * 0.34, s * 0.62, s * 0.08);
  g.fill();
  g.strokeStyle = '#9a6200';
  g.lineWidth = s * 0.05;
  for (let t = -0.02; t < 0.46; t += 0.1) {
    g.beginPath();
    g.moveTo(-s * 0.2, s * t);
    g.quadraticCurveTo(0, s * (t + 0.06), s * 0.2, s * (t - 0.02));
    g.stroke();
  }
  // head
  g.fillStyle = '#b07a00';
  g.beginPath();
  g.ellipse(0, -s * 0.18, s * 0.36, s * 0.16, 0, 0, Math.PI * 2);
  g.fill();
  const hg = g.createLinearGradient(0, -s * 0.38, 0, -s * 0.18);
  hg.addColorStop(0, '#fff09a');
  hg.addColorStop(1, '#ffc414');
  g.fillStyle = hg;
  g.beginPath();
  g.ellipse(0, -s * 0.24, s * 0.36, s * 0.15, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#b07a00';
  g.lineWidth = s * 0.06;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(-s * 0.15, -s * 0.24); g.lineTo(s * 0.15, -s * 0.24);
  g.moveTo(0, -s * 0.31); g.lineTo(0, -s * 0.17);
  g.stroke();
  g.restore();
}

// ------------------------------------------------------------------ return hive

/** The big golden hive at the top right; its dark door faces left. */
export function returnHive(g: C, x: number, y: number, w: number, h: number, punch = 0): void {
  g.save();
  g.translate(x, y + h / 2);
  g.scale(1 + punch * 0.06, 1 - punch * 0.05 + punch * 0.12 * Math.sin(punch * 6));
  g.translate(-x, -y - h / 2);
  // hanging stick
  g.fillStyle = '#7a4a22';
  rrect(g, x - w * 0.03, y - h * 0.62, w * 0.06, h * 0.18, w * 0.03);
  g.fill();
  const rings = [0.5, 0.82, 0.98, 1.0, 0.86];
  const rh = h * 0.21;
  const top = y - h * 0.48;
  for (let i = 0; i < rings.length; i++) {
    const cy = top + i * rh * 0.92 + rh / 2;
    const rw = w * rings[i];
    const grad = g.createLinearGradient(0, cy - rh * 0.6, 0, cy + rh * 0.6);
    grad.addColorStop(0, '#ffe96b');
    grad.addColorStop(0.45, '#ffd52c');
    grad.addColorStop(1, '#f0a01a');
    g.fillStyle = grad;
    rrect(g, x - rw / 2, cy - rh * 0.6, rw, rh * 1.2, rh * 0.6);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.35)';
    rrect(g, x - rw * 0.3, cy - rh * 0.45, rw * 0.32, rh * 0.22, rh * 0.11);
    g.fill();
  }
  // door: on the left-front, deep and dark
  const dx = x - w * 0.18;
  const dy = y + h * 0.06;
  g.fillStyle = '#e39a18';
  g.beginPath();
  g.ellipse(dx, dy, w * 0.22, h * 0.24, 0, 0, Math.PI * 2);
  g.fill();
  const dg = g.createRadialGradient(dx + w * 0.05, dy, w * 0.02, dx, dy, w * 0.2);
  dg.addColorStop(0, '#8a4a10');
  dg.addColorStop(1, '#4a2205');
  g.fillStyle = dg;
  g.beginPath();
  g.ellipse(dx, dy, w * 0.18, h * 0.2, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

// ------------------------------------------------------------------ hive tokens and slots

/**
 * Puffy stacked hive token: four rounded ridges (narrow top, widest third), glossy toy plastic,
 * big white number with a dark outline in the token's own hue.
 */
export function hiveToken(g: C, x: number, y: number, w: number, color: number, n: number | null, o: { scale?: number; sx?: number; sy?: number; glow?: number; dim?: number; shadow?: boolean } = {}): void {
  const col = COLORS[color];
  const s = w * (o.scale ?? 1);
  if (s <= 1) return;
  g.save();
  g.translate(x, y + s * 0.46);
  g.scale(o.sx ?? 1, o.sy ?? 1);
  g.translate(-x, -y - s * 0.46);
  if (o.shadow !== false) {
    g.fillStyle = 'rgba(40,70,110,0.16)';
    g.beginPath();
    g.ellipse(x, y + s * 0.47, s * 0.4, s * 0.07, 0, 0, Math.PI * 2);
    g.fill();
  }
  // puffy: tall ridges overlapping a lot, so the token reads as one round hive with grooves
  const widths = [0.64, 0.93, 1.0, 0.86];
  const H = s * 0.92;
  const rh = s * 0.37;
  const top = y - H / 2;
  if (o.glow) {
    g.save();
    g.shadowColor = col.light;
    g.shadowBlur = s * 0.5 * o.glow;
    g.fillStyle = col.light;
    g.beginPath();
    g.ellipse(x, y, s * 0.5, s * 0.45, 0, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  for (let i = widths.length - 1; i >= 0; i--) {
    const cy = top + rh / 2 + (i * (H - rh)) / (widths.length - 1);
    const rw = s * widths[i];
    const grad = g.createLinearGradient(0, cy - rh / 2, 0, cy + rh / 2);
    grad.addColorStop(0, col.light);
    grad.addColorStop(0.35, col.base);
    grad.addColorStop(0.8, col.base);
    grad.addColorStop(1, col.dark);
    g.fillStyle = grad;
    rrect(g, x - rw / 2, cy - rh / 2, rw, rh, rh / 2);
    g.fill();
    // round the ends: darker at the sides
    const side = g.createLinearGradient(x - rw / 2, 0, x + rw / 2, 0);
    side.addColorStop(0, 'rgba(0,0,0,0.12)');
    side.addColorStop(0.25, 'rgba(0,0,0,0)');
    side.addColorStop(0.75, 'rgba(0,0,0,0)');
    side.addColorStop(1, 'rgba(0,0,0,0.16)');
    g.fillStyle = side;
    rrect(g, x - rw / 2, cy - rh / 2, rw, rh, rh / 2);
    g.fill();
  }
  // a soft top light over the whole body
  const sheen = g.createRadialGradient(x - s * 0.15, y - s * 0.3, 0, x - s * 0.15, y - s * 0.3, s * 0.55);
  sheen.addColorStop(0, 'rgba(255,255,255,0.32)');
  sheen.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = sheen;
  g.beginPath();
  g.ellipse(x, y - s * 0.05, s * 0.5, s * 0.45, 0, 0, Math.PI * 2);
  g.fill();
  if (o.dim) {
    g.globalAlpha = o.dim;
    g.fillStyle = '#6b7a92';
    g.beginPath();
    g.ellipse(x, y, s * 0.5, s * 0.46, 0, 0, Math.PI * 2);
    g.fill();
    g.globalAlpha = 1;
  }
  if (n !== null) {
    const fs = s * 0.36;
    label(g, String(n), x + s * 0.01, y + s * 0.035, fs, col.ink, col.ink, 0.2);
    label(g, String(n), x, y + s * 0.015, fs, '#ffffff', col.ink, 0.17);
  }
  g.restore();
}

/** Empty slot: dark round well in a grey metal ring. */
export function slotRing(g: C, x: number, y: number, r: number, extra = false): void {
  const ring = g.createLinearGradient(0, y - r, 0, y + r);
  ring.addColorStop(0, extra ? '#c9f5b8' : '#e4e7ea');
  ring.addColorStop(1, extra ? '#5fb84c' : '#8c9198');
  g.fillStyle = ring;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  const well = g.createLinearGradient(0, y - r, 0, y + r);
  well.addColorStop(0, '#2c2a30');
  well.addColorStop(1, '#45424a');
  g.fillStyle = well;
  g.beginPath();
  g.arc(x, y, r * 0.86, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.35)';
  g.lineWidth = r * 0.06;
  g.beginPath();
  g.arc(x, y + r * 0.03, r * 0.82, Math.PI * 1.05, Math.PI * 1.95);
  g.stroke();
}

// ------------------------------------------------------------------ bottom toolbar

export function toolbar(g: C, w: number, y: number, h: number, r: number): void {
  const grad = g.createLinearGradient(0, y, 0, y + h);
  grad.addColorStop(0, PALETTE.barTop);
  grad.addColorStop(1, PALETTE.barBottom);
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(0, y + h);
  g.lineTo(0, y + r);
  g.quadraticCurveTo(0, y, r, y);
  g.lineTo(w - r, y);
  g.quadraticCurveTo(w, y, w, y + r);
  g.lineTo(w, y + h);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.18)';
  g.lineWidth = Math.max(1, r * 0.06);
  g.beginPath();
  g.moveTo(r * 0.3, y + r * 0.5);
  g.quadraticCurveTo(r * 0.3, y + r * 0.08, r, y + r * 0.06);
  g.lineTo(w - r, y + r * 0.06);
  g.quadraticCurveTo(w - r * 0.3, y + r * 0.08, w - r * 0.3, y + r * 0.5);
  g.stroke();
}

export type BoosterIcon = 'drill' | 'magnet' | 'hammer' | 'shuffle';

export function boosterButton(g: C, x: number, y: number, r: number, icon: BoosterIcon, o: { locked?: number; count?: number; armed?: boolean; t?: number }): void {
  // soft drop shadow, navy outer ring, a thin light rim, then the domed body (reference style)
  g.fillStyle = 'rgba(20,22,70,0.45)';
  g.beginPath();
  g.arc(x, y + r * 0.07, r, 0, Math.PI * 2);
  g.fill();
  const ring = g.createLinearGradient(0, y - r, 0, y + r);
  ring.addColorStop(0, o.locked ? '#50548a' : '#3b41a6');
  ring.addColorStop(1, o.locked ? '#2c2f5c' : '#1d2063');
  g.fillStyle = ring;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = o.locked ? '#dfe2f2' : o.armed ? '#fff09a' : '#8aa6ff';
  g.beginPath();
  g.arc(x, y, r * 0.9, 0, Math.PI * 2);
  g.fill();
  const body = g.createRadialGradient(x - r * 0.22, y - r * 0.35, r * 0.05, x, y, r * 0.84);
  if (o.locked) {
    body.addColorStop(0, '#eef0f8');
    body.addColorStop(0.55, '#c6cadf');
    body.addColorStop(1, '#9196b4');
  } else {
    body.addColorStop(0, o.armed ? '#a9e6ff' : '#86a6ff');
    body.addColorStop(0.55, o.armed ? '#4aa6ff' : '#4566f2');
    body.addColorStop(1, o.armed ? '#2a78d8' : '#2540c4');
  }
  g.fillStyle = body;
  g.beginPath();
  g.arc(x, y, r * 0.83, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.16)';
  g.beginPath();
  g.ellipse(x - r * 0.05, y - r * 0.5, r * 0.48, r * 0.17, -0.1, 0, Math.PI * 2);
  g.fill();
  if (o.armed) {
    g.strokeStyle = `rgba(255,236,120,${0.6 + 0.4 * Math.sin((o.t ?? 0) * 8)})`;
    g.lineWidth = r * 0.1;
    g.beginPath();
    g.arc(x, y, r * 1.06, 0, Math.PI * 2);
    g.stroke();
  }
  if (o.locked) {
    padlock(g, x, y - r * 0.12, r * 0.7);
    const lw = r * 1.2;
    const lh = r * 0.46;
    const ly = y + r * 0.66;
    g.fillStyle = '#3c406a';
    rrect(g, x - lw / 2, ly - lh / 2 + lh * 0.1, lw, lh, lh * 0.4);
    g.fill();
    const lg = g.createLinearGradient(0, ly - lh / 2, 0, ly + lh / 2);
    lg.addColorStop(0, '#7a80a6');
    lg.addColorStop(1, '#5a5f86');
    g.fillStyle = lg;
    rrect(g, x - lw / 2, ly - lh / 2, lw, lh, lh * 0.4);
    g.fill();
    label(g, `Lv.${o.locked}`, x, ly + lh * 0.02, lh * 0.62, '#ffffff', '#33375c', 0.2);
    return;
  }
  boosterIcon(g, x, y, r * 0.66, icon);
  if (o.count && o.count > 0) countBadge(g, x + r * 0.66, y + r * 0.6, r * 0.36, o.count);
  else plusBadge(g, x + r * 0.66, y + r * 0.6, r * 0.36);
}

/** Glossy padlock: thick shackle, rounded body, keyhole. */
export function padlock(g: C, x: number, y: number, s: number): void {
  // shackle: dark edge, light face
  for (const [col, w] of [['#8c90b3', 0.26], ['#f4f5fb', 0.16]] as const) {
    g.strokeStyle = col;
    g.lineWidth = s * w;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(x - s * 0.3, y - s * 0.02);
    g.lineTo(x - s * 0.3, y - s * 0.2);
    g.arc(x, y - s * 0.2, s * 0.3, Math.PI, 0);
    g.lineTo(x + s * 0.3, y - s * 0.02);
    g.stroke();
  }
  g.fillStyle = '#8c90b3';
  rrect(g, x - s * 0.5, y - s * 0.1, s, s * 0.72, s * 0.2);
  g.fill();
  const grad = g.createLinearGradient(0, y - s * 0.1, 0, y + s * 0.62);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(1, '#c5c9de');
  g.fillStyle = grad;
  rrect(g, x - s * 0.46, y - s * 0.07, s * 0.92, s * 0.63, s * 0.17);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.8)';
  rrect(g, x - s * 0.36, y - s * 0.02, s * 0.5, s * 0.1, s * 0.05);
  g.fill();
  g.fillStyle = '#5d6286';
  g.beginPath();
  g.arc(x, y + s * 0.2, s * 0.1, 0, Math.PI * 2);
  g.fill();
  rrect(g, x - s * 0.045, y + s * 0.2, s * 0.09, s * 0.2, s * 0.04);
  g.fill();
}

/** Fill a path twice: a darker edge, then the face (toy-like outlined shapes). */
function edged(g: C, path: () => void, face: string | CanvasGradient, edge: string, w: number): void {
  g.lineJoin = 'round';
  g.strokeStyle = edge;
  g.lineWidth = w;
  path();
  g.stroke();
  g.fillStyle = face;
  path();
  g.fill();
}

export function boosterIcon(g: C, x: number, y: number, s: number, icon: BoosterIcon): void {
  g.save();
  g.translate(x, y);
  g.lineCap = 'round';
  const ew = s * 0.08;
  if (icon === 'drill') {
    // red power drill, bit pointing up-left
    g.rotate(0.7);
    const steel = g.createLinearGradient(0, -s * 0.2, 0, s * 0.2);
    steel.addColorStop(0, '#ffffff');
    steel.addColorStop(0.5, '#c4cad8');
    steel.addColorStop(1, '#7d8496');
    // bit
    edged(g, () => { g.beginPath(); g.moveTo(-s * 0.78, -s * 0.11); g.lineTo(-s * 1.15, 0); g.lineTo(-s * 0.78, s * 0.11); g.closePath(); }, steel, '#5b6172', ew);
    // chuck
    edged(g, () => rrect(g, -s * 0.84, -s * 0.22, s * 0.32, s * 0.44, s * 0.1), steel, '#5b6172', ew);
    g.strokeStyle = 'rgba(80,86,100,0.6)';
    g.lineWidth = s * 0.04;
    for (const cx of [-0.74, -0.64]) { g.beginPath(); g.moveTo(cx * s, -s * 0.2); g.lineTo(cx * s, s * 0.2); g.stroke(); }
    const red = g.createLinearGradient(0, -s * 0.36, 0, s * 0.36);
    red.addColorStop(0, '#ff7b6e');
    red.addColorStop(0.5, '#ec2a26');
    red.addColorStop(1, '#a8131a');
    // grip, then body over it
    edged(g, () => rrect(g, s * 0.02, -s * 0.05, s * 0.42, s * 0.92, s * 0.17), red, '#7d0e14', ew);
    edged(g, () => rrect(g, -s * 0.02, s * 0.62, s * 0.5, s * 0.3, s * 0.12), '#3b3442', '#1d1820', ew);
    edged(g, () => rrect(g, -s * 0.6, -s * 0.36, s * 1.22, s * 0.66, s * 0.3), red, '#7d0e14', ew);
    g.fillStyle = 'rgba(255,255,255,0.5)';
    rrect(g, -s * 0.46, -s * 0.28, s * 0.86, s * 0.12, s * 0.06);
    g.fill();
    g.fillStyle = '#3b3442';
    g.beginPath();
    g.arc(s * 0.42, -s * 0.03, s * 0.08, 0, Math.PI * 2);
    g.fill();
  } else if (icon === 'magnet') {
    // horseshoe: red arm on the left, blue on the right, silver tips, tilted
    g.rotate(0.38);
    g.scale(1.15, 1.15);
    const w = s * 0.42;
    const R = s * 0.4;
    const cy = s * 0.18;
    const arc = (a0: number, a1: number, col: string, edge: string): void => {
      g.lineCap = 'butt';
      g.strokeStyle = edge;
      g.lineWidth = w + ew * 2;
      g.beginPath();
      g.arc(0, cy, R, a0, a1);
      g.stroke();
      g.strokeStyle = col;
      g.lineWidth = w;
      g.beginPath();
      g.arc(0, cy, R, a0, a1);
      g.stroke();
    };
    arc(Math.PI / 2, Math.PI, '#e8323a', '#7d0e14');
    arc(0, Math.PI / 2, '#2f62e8', '#122c7a');
    const arm = (ax: number, c0: string, c1: string, edge: string): void => {
      const gr = g.createLinearGradient(ax - w / 2, 0, ax + w / 2, 0);
      gr.addColorStop(0, c0);
      gr.addColorStop(1, c1);
      edged(g, () => rrect(g, ax - w / 2, -s * 0.52, w, cy + s * 0.54, s * 0.03), gr, edge, ew);
      const st = g.createLinearGradient(ax - w / 2, 0, ax + w / 2, 0);
      st.addColorStop(0, '#ffffff');
      st.addColorStop(1, '#a9b0c2');
      edged(g, () => rrect(g, ax - w / 2, -s * 0.78, w, s * 0.3, s * 0.07), st, '#5b6172', ew);
    };
    arm(-R, '#ff6a6a', '#c8151d', '#7d0e14');
    arm(R, '#6b93ff', '#2449c8', '#122c7a');
    g.fillStyle = 'rgba(255,255,255,0.45)';
    rrect(g, -R - w * 0.32, -s * 0.44, w * 0.2, s * 0.56, w * 0.1);
    g.fill();
  } else if (icon === 'hammer') {
    // toy mallet: wooden handle, glossy red-capped steel head
    g.rotate(-0.65);
    const wood = g.createLinearGradient(-s * 0.1, 0, s * 0.1, 0);
    wood.addColorStop(0, '#f0b26a');
    wood.addColorStop(1, '#b06e2c');
    edged(g, () => rrect(g, -s * 0.11, -s * 0.15, s * 0.22, s * 1.05, s * 0.1), wood, '#6e3f14', ew);
    const head = g.createLinearGradient(0, -s * 0.62, 0, -s * 0.1);
    head.addColorStop(0, '#ffffff');
    head.addColorStop(0.45, '#c7cdda');
    head.addColorStop(1, '#7a8295');
    edged(g, () => rrect(g, -s * 0.62, -s * 0.62, s * 1.24, s * 0.5, s * 0.14), head, '#4c5263', ew);
    const cap = g.createLinearGradient(0, -s * 0.62, 0, -s * 0.1);
    cap.addColorStop(0, '#ff7b6e');
    cap.addColorStop(1, '#b8141c');
    edged(g, () => rrect(g, -s * 0.66, -s * 0.66, s * 0.26, s * 0.58, s * 0.1), cap, '#7d0e14', ew);
    edged(g, () => rrect(g, s * 0.4, -s * 0.66, s * 0.26, s * 0.58, s * 0.1), cap, '#7d0e14', ew);
    g.fillStyle = 'rgba(255,255,255,0.55)';
    rrect(g, -s * 0.36, -s * 0.56, s * 0.7, s * 0.1, s * 0.05);
    g.fill();
  } else {
    // two chunky crossing arrows, golden
    const gold = g.createLinearGradient(0, -s * 0.5, 0, s * 0.5);
    gold.addColorStop(0, '#fff07a');
    gold.addColorStop(1, '#f2a20e');
    for (const k of [-1, 1]) {
      const path = (): void => {
        g.beginPath();
        g.moveTo(-s * 0.7, k * s * 0.36);
        g.bezierCurveTo(-s * 0.15, k * s * 0.36, -s * 0.05, -k * s * 0.32, s * 0.38, -k * s * 0.32);
      };
      g.strokeStyle = '#8a5200';
      g.lineWidth = s * 0.3;
      path();
      g.stroke();
      g.strokeStyle = gold;
      g.lineWidth = s * 0.18;
      path();
      g.stroke();
      const head = (): void => {
        g.beginPath();
        g.moveTo(s * 0.78, -k * s * 0.32);
        g.lineTo(s * 0.32, -k * s * 0.32 - s * 0.32);
        g.lineTo(s * 0.32, -k * s * 0.32 + s * 0.32);
        g.closePath();
      };
      edged(g, head, gold, '#8a5200', ew * 1.2);
    }
  }
  g.restore();
}
