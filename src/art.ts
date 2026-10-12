// 2D art drawn with code: sky, leafy top bar, hives, bees, slots, booster bar, buttons and popups.

import { COLORS } from './levels.ts';

type C = CanvasRenderingContext2D;

export const FONT = "'Lilita One','Luckiest Guy','Arial Rounded MT Bold',system-ui,sans-serif";

export function text(g: C, s: string, x: number, y: number, size: number, fill = '#fff', stroke = '#3b2a12', align: CanvasTextAlign = 'center'): void {
  g.font = `${Math.round(size)}px ${FONT}`;
  g.textAlign = align;
  g.textBaseline = 'middle';
  g.lineJoin = 'round';
  if (stroke) {
    g.strokeStyle = stroke;
    g.lineWidth = Math.max(2, size * 0.2);
    g.strokeText(s, x, y);
  }
  g.fillStyle = fill;
  g.fillText(s, x, y);
}

export function rr(g: C, x: number, y: number, w: number, h: number, r: number): void {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// ------------------------------------------------------------------ scenery (Screwdom 3D look)

/** Sky, soft clouds, a hazy countryside along the bottom and a soft shadow under the toy. */
export function scenery(g: C, w: number, h: number, shadow: { x: number; y: number; r: number }): void {
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#45b6f2');
  sky.addColorStop(0.45, '#8fd3f8');
  sky.addColorStop(0.75, '#cdeefc');
  sky.addColorStop(1, '#e6f7ee');
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);
  let seed = 11;
  const rnd = (): number => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  // clouds: clusters of soft white puffs
  for (let c = 0; c < 6; c++) {
    const cx = rnd() * w;
    const cy = h * (0.12 + rnd() * 0.5);
    const s = Math.min(w, h) * (0.06 + rnd() * 0.06);
    for (let i = 0; i < 7; i++) {
      const px = cx + (rnd() - 0.5) * s * 3.2;
      const py = cy + (rnd() - 0.5) * s * 0.7;
      const pr = s * (0.5 + rnd() * 0.6);
      const rg = g.createRadialGradient(px, py, 0, px, py, pr);
      rg.addColorStop(0, 'rgba(255,255,255,0.75)');
      rg.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = rg;
      g.beginPath();
      g.arc(px, py, pr, 0, Math.PI * 2);
      g.fill();
    }
  }
  // hazy hills and meadow
  const hill = (y0: number, amp: number, col: string, ph: number): void => {
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(0, h);
    for (let x = 0; x <= w + 10; x += 10) g.lineTo(x, y0 + Math.sin(x / w * 5 + ph) * amp + Math.sin(x / w * 13 + ph * 2) * amp * 0.3);
    g.lineTo(w, h);
    g.fill();
  };
  hill(h * 0.6, h * 0.02, 'rgba(150,205,170,0.55)', 1);
  // little far houses
  for (let i = 0; i < 4; i++) {
    const x = w * (0.1 + i * 0.27 + rnd() * 0.06);
    const y = h * 0.6 + h * 0.01;
    const s = Math.min(w, h) * 0.035;
    g.fillStyle = 'rgba(240,235,225,0.6)';
    g.fillRect(x - s, y - s, s * 2, s * 1.2);
    g.fillStyle = 'rgba(214,120,96,0.55)';
    g.beginPath();
    g.moveTo(x - s * 1.25, y - s); g.lineTo(x, y - s * 1.9); g.lineTo(x + s * 1.25, y - s);
    g.fill();
  }
  hill(h * 0.65, h * 0.018, 'rgba(126,200,110,0.75)', 3);
  hill(h * 0.72, h * 0.015, '#8fd174', 5);
  const meadow = g.createLinearGradient(0, h * 0.72, 0, h);
  meadow.addColorStop(0, '#9edb7c');
  meadow.addColorStop(1, '#6fbf57');
  g.fillStyle = meadow;
  g.fillRect(0, h * 0.76, w, h * 0.24);
  // flowers
  const petals = ['#ffffff', '#ffd6e6', '#fff1a0', '#ffc2c2'];
  for (let i = 0; i < 70; i++) {
    const x = rnd() * w;
    const y = h * (0.72 + rnd() * 0.28);
    g.fillStyle = petals[i % 4];
    g.globalAlpha = 0.55 + rnd() * 0.4;
    g.beginPath();
    g.arc(x, y, Math.min(w, h) * (0.004 + rnd() * 0.004), 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
  // soft contact shadow under the toy
  const sg = g.createRadialGradient(shadow.x, shadow.y, 0, shadow.x, shadow.y, shadow.r);
  sg.addColorStop(0, 'rgba(40,70,110,0.22)');
  sg.addColorStop(1, 'rgba(40,70,110,0)');
  g.fillStyle = sg;
  g.save();
  g.translate(shadow.x, shadow.y);
  g.scale(1, 0.22);
  g.translate(-shadow.x, -shadow.y);
  g.beginPath();
  g.arc(shadow.x, shadow.y, shadow.r, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

/** Tiny screw head used as a rivet on wooden planks. */
export function rivet(g: C, x: number, y: number, r: number): void {
  const grad = g.createRadialGradient(x - r * 0.3, y - r * 0.3, 0, x, y, r);
  grad.addColorStop(0, '#fff3b0');
  grad.addColorStop(0.6, '#f2c032');
  grad.addColorStop(1, '#b07a10');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#8a5a08';
  g.lineWidth = r * 0.3;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(x - r * 0.45, y - r * 0.45); g.lineTo(x + r * 0.45, y + r * 0.45);
  g.moveTo(x + r * 0.45, y - r * 0.45); g.lineTo(x - r * 0.45, y + r * 0.45);
  g.stroke();
}

/** Cream wooden plank with screws in the corners (Screwdom banner). */
export function plank(g: C, x: number, y: number, w: number, h: number, r = h * 0.22): void {
  g.fillStyle = 'rgba(90,50,20,0.25)';
  rr(g, x, y + h * 0.08, w, h, r);
  g.fill();
  g.fillStyle = '#b5672b';
  rr(g, x, y, w, h, r);
  g.fill();
  const in1 = Math.max(2, h * 0.07);
  const grad = g.createLinearGradient(0, y, 0, y + h);
  grad.addColorStop(0, '#fff0cf');
  grad.addColorStop(0.55, '#f9d9a2');
  grad.addColorStop(1, '#efbf7c');
  g.fillStyle = grad;
  rr(g, x + in1, y + in1, w - in1 * 2, h - in1 * 2.3, r * 0.8);
  g.fill();
  g.strokeStyle = 'rgba(200,140,80,0.25)';
  g.lineWidth = 1;
  for (let i = 1; i < 3; i++) {
    g.beginPath();
    g.moveTo(x + in1 * 2, y + h * i / 3.2);
    g.quadraticCurveTo(x + w / 2, y + h * i / 3.2 + h * 0.05, x + w - in1 * 2, y + h * i / 3.2);
    g.stroke();
  }
  const rv = Math.min(h * 0.09, w * 0.05);
  const m = Math.max(rv * 2.2, r * 0.75);
  for (const [px, py] of [[x + m, y + m], [x + w - m, y + m], [x + m, y + h - m], [x + w - m, y + h - m]]) rivet(g, px, py, rv);
}

/** "Level N" plank at the top. */
export function levelBadge(g: C, x: number, y: number, s: number, label: string, punch = 0): void {
  const k = 1 + punch * 0.12;
  const w = s * 1.3 * k;
  const h = s * 0.5 * k;
  plank(g, x - w / 2, y - h / 2, w, h);
  text(g, label, x, y - h * 0.04, h * 0.5, '#fff7e0', '#a5501a');
}

export function coin(g: C, x: number, y: number, r: number): void {
  const grad = g.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
  grad.addColorStop(0, '#fff6a8');
  grad.addColorStop(0.6, '#ffc928');
  grad.addColorStop(1, '#d68a00');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#b06b00';
  g.lineWidth = r * 0.14;
  g.beginPath();
  g.arc(x, y, r * 0.68, 0, Math.PI * 2);
  g.stroke();
}

export function pill(g: C, x: number, y: number, w: number, h: number, fill: string): void {
  g.fillStyle = fill;
  rr(g, x, y, w, h, h / 2);
  g.fill();
}

/** A small stack of screws: the icon of the screw counter. */
export function screwIcon(g: C, x: number, y: number, s: number): void {
  for (let i = 2; i >= 0; i--) {
    const yy = y + (i - 1) * s * 0.28;
    g.fillStyle = i === 0 ? '#ffd23f' : '#e3a500';
    g.beginPath();
    g.ellipse(x, yy, s * 0.42, s * 0.17, -0.25, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#9b6400';
    g.lineWidth = Math.max(1, s * 0.05);
    g.stroke();
  }
  g.strokeStyle = '#9b6400';
  g.lineWidth = s * 0.08;
  g.beginPath();
  g.moveTo(x - s * 0.15, y - s * 0.3); g.lineTo(x + s * 0.15, y - s * 0.26);
  g.moveTo(x, y - s * 0.4); g.lineTo(x, y - s * 0.16);
  g.stroke();
}

// ------------------------------------------------------------------ hives and bees

/**
 * Skep hive (stacked rings) in the colour of its bees. `outline` = white glow of tappable hives,
 * `sx`/`sy` squash and stretch (bounce when a bee launches or the hive is done).
 */
export function hive(g: C, x: number, y: number, r: number, color: number, n: number | null, opts: { outline?: boolean; dim?: number; scale?: number; sx?: number; sy?: number; glow?: number } = {}): void {
  const col = COLORS[color];
  const s = r * (opts.scale ?? 1);
  if (s <= 0.5) return;
  g.save();
  // squash around the base so the hive sits on its slot
  g.translate(x, y + s);
  g.scale(opts.sx ?? 1, opts.sy ?? 1);
  g.translate(-x, -y - s);
  // soft ground shadow
  g.fillStyle = 'rgba(30,50,80,0.22)';
  g.beginPath();
  g.ellipse(x, y + s * 1.02, s * 0.85, s * 0.18, 0, 0, Math.PI * 2);
  g.fill();
  const rings = [0.6, 0.88, 1.0, 0.95, 0.78];
  const bh = s * 0.4;
  const top = y - s * 0.95;
  const shape = (pad: number): void => {
    for (let i = 0; i < rings.length; i++) {
      const ry = top + i * bh + bh / 2;
      const rw = s * 2 * rings[i] + pad;
      rr(g, x - rw / 2, ry - bh * 0.62 - pad / 2, rw, bh * 1.24 + pad, (bh * 1.24 + pad) / 2);
      g.fill();
    }
  };
  if (opts.glow) {
    g.save();
    g.shadowColor = col.light;
    g.shadowBlur = s * 0.9 * opts.glow;
    g.fillStyle = col.light;
    shape(s * 0.1);
    g.restore();
  }
  if (opts.outline) {
    g.fillStyle = '#ffffff';
    shape(s * 0.18);
  }
  for (let i = 0; i < rings.length; i++) {
    const ry = top + i * bh + bh / 2;
    const rw = s * 2 * rings[i];
    const grad = g.createLinearGradient(0, ry - bh * 0.62, 0, ry + bh * 0.62);
    grad.addColorStop(0, col.light);
    grad.addColorStop(0.42, col.base);
    grad.addColorStop(1, col.dark);
    g.fillStyle = grad;
    rr(g, x - rw / 2, ry - bh * 0.62, rw, bh * 1.24, bh * 0.62);
    g.fill();
    // glossy highlight on every ring
    g.fillStyle = 'rgba(255,255,255,0.38)';
    rr(g, x - rw * 0.32, ry - bh * 0.48, rw * 0.38, bh * 0.22, bh * 0.11);
    g.fill();
  }
  if (opts.dim) {
    g.globalAlpha = opts.dim;
    g.fillStyle = '#6b7a92';
    shape(0);
    g.globalAlpha = 1;
  }
  if (n !== null) text(g, String(n), x, y - s * 0.12, s * 0.74, '#fff', color === 7 ? '#7d818c' : 'rgba(30,20,40,0.85)');
  g.restore();
}

export interface BeeLook {
  /** wing phase */
  flap: number;
  /** heading in radians */
  dir?: number;
  /** stretch along the heading (>1 fast, <1 squashed) */
  stretch?: number;
  /** extra tilt (pulling a screw leans back) */
  lean?: number;
  /** screw colour being carried, -1 none; `sway` swings it */
  carry?: number;
  sway?: number;
  scale?: number;
  /** 0..1: straining face (eyes squeezed) */
  strain?: number;
  /** offset (px) of the screw head its legs are gripping */
  grip?: [number, number];
}

const beeCache = new Map<string, HTMLCanvasElement>();

/**
 * The bee's body, pre-rendered: a chubby glossy ball with curved stripes, big shiny eyes, rosy cheeks
 * and a smile, facing right. `s` is the bee's unit (body radius ≈ 0.62 s). The canvas is 3s wide.
 */
function beeBody(color: number, s: number, strain: boolean): HTMLCanvasElement {
  const px = Math.max(8, Math.round(s * 4) / 4);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const key = `${color}:${px}:${strain ? 1 : 0}:${dpr}`;
  let c = beeCache.get(key);
  if (c) return c;
  c = document.createElement('canvas');
  const W = px * 3;
  c.width = c.height = Math.ceil(W * dpr);
  const g = c.getContext('2d')!;
  g.scale(dpr, dpr);
  g.translate(W / 2, W / 2);
  const col = COLORS[color];
  const r = px * 0.64;
  const ink = '#2a2028';
  // stinger
  g.fillStyle = ink;
  g.beginPath();
  g.moveTo(-r * 0.92, -r * 0.02); g.quadraticCurveTo(-r * 1.3, r * 0.12, -r * 0.9, r * 0.26);
  g.fill();
  // tiny legs
  g.strokeStyle = ink;
  g.lineCap = 'round';
  g.lineWidth = r * 0.11;
  for (const lx of [-0.35, -0.05]) {
    g.beginPath();
    g.moveTo(r * lx, r * 0.7);
    g.lineTo(r * (lx - 0.05), r * 0.92);
    g.stroke();
  }
  // striped body (egg shape, lit from the top left)
  const bx = -r * 0.2;
  const by = r * 0.12;
  const body = g.createRadialGradient(bx - r * 0.3, by - r * 0.35, r * 0.06, bx, by, r * 0.95);
  body.addColorStop(0, col.light);
  body.addColorStop(0.5, col.base);
  body.addColorStop(1, col.dark);
  g.fillStyle = body;
  g.beginPath();
  g.ellipse(bx, by, r * 0.82, r * 0.66, -0.18, 0, Math.PI * 2);
  g.fill();
  g.save();
  g.beginPath();
  g.ellipse(bx, by, r * 0.82, r * 0.66, -0.18, 0, Math.PI * 2);
  g.clip();
  for (const sx of [-0.55, -0.12]) {
    const sg = g.createLinearGradient(0, by - r, 0, by + r);
    sg.addColorStop(0, '#4c3e4a');
    sg.addColorStop(1, '#1a141c');
    g.fillStyle = sg;
    g.beginPath();
    g.ellipse(r * sx, by, r * 0.15, r * 0.9, 0.2, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = 'rgba(255,255,255,0.45)';
  g.beginPath();
  g.ellipse(bx - r * 0.15, by - r * 0.38, r * 0.4, r * 0.12, -0.25, 0, Math.PI * 2);
  g.fill();
  g.restore();
  // big round head in front
  const hx = r * 0.55;
  const hy = -r * 0.22;
  const hr = r * 0.56;
  const head = g.createRadialGradient(hx - hr * 0.35, hy - hr * 0.4, hr * 0.1, hx, hy, hr * 1.05);
  head.addColorStop(0, col.light);
  head.addColorStop(0.6, col.base);
  head.addColorStop(1, col.dark);
  g.fillStyle = head;
  g.beginPath();
  g.arc(hx, hy, hr, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.beginPath();
  g.ellipse(hx - hr * 0.35, hy - hr * 0.5, hr * 0.3, hr * 0.14, -0.4, 0, Math.PI * 2);
  g.fill();
  // face: two big eyes, a smile, rosy cheek
  const eye = (ex: number, ey: number, er: number): void => {
    if (strain) {
      g.strokeStyle = ink;
      g.lineWidth = er * 0.5;
      g.beginPath();
      g.moveTo(ex - er * 0.7, ey - er * 0.5); g.lineTo(ex + er * 0.5, ey); g.lineTo(ex - er * 0.7, ey + er * 0.5);
      g.stroke();
      return;
    }
    g.fillStyle = ink;
    g.beginPath();
    g.ellipse(ex, ey, er * 0.78, er, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff';
    g.beginPath();
    g.arc(ex - er * 0.2, ey - er * 0.38, er * 0.36, 0, Math.PI * 2);
    g.fill();
  };
  eye(hx + hr * 0.05, hy - hr * 0.08, hr * 0.26);
  eye(hx + hr * 0.6, hy - hr * 0.05, hr * 0.2);
  g.fillStyle = 'rgba(255,110,140,0.55)';
  g.beginPath();
  g.ellipse(hx - hr * 0.1, hy + hr * 0.38, hr * 0.15, hr * 0.09, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = ink;
  g.lineWidth = hr * 0.1;
  g.beginPath();
  if (strain) { g.moveTo(hx + hr * 0.2, hy + hr * 0.42); g.lineTo(hx + hr * 0.5, hy + hr * 0.42); } else g.arc(hx + hr * 0.36, hy + hr * 0.28, hr * 0.18, 0.15, Math.PI - 0.15);
  g.stroke();
  // antennae
  g.lineWidth = r * 0.07;
  for (const [ax, tx, ty] of [[0.35, 0.3, -1.25], [0.75, 0.95, -1.18]]) {
    g.beginPath();
    g.moveTo(r * ax, -r * 0.7);
    g.quadraticCurveTo(r * (ax - 0.02), -r * 1.05, r * tx, r * ty);
    g.stroke();
    g.fillStyle = ink;
    g.beginPath();
    g.arc(r * tx, r * ty, r * 0.09, 0, Math.PI * 2);
    g.fill();
  }
  beeCache.set(key, c);
  return c;
}

function wing(g: C, x: number, y: number, rx: number, ry: number, rot: number, alpha: number): void {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  const grad = g.createLinearGradient(0, -ry, 0, ry);
  grad.addColorStop(0, `rgba(255,255,255,${0.95 * alpha})`);
  grad.addColorStop(1, `rgba(200,230,255,${0.7 * alpha})`);
  g.fillStyle = grad;
  g.beginPath();
  g.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = `rgba(120,150,190,${0.55 * alpha})`;
  g.lineWidth = Math.max(0.8, rx * 0.12);
  g.stroke();
  g.fillStyle = `rgba(255,255,255,${0.9 * alpha})`;
  g.beginPath();
  g.ellipse(-rx * 0.25, -ry * 0.35, rx * 0.25, ry * 0.18, -0.4, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

/** A chubby cute bee in the colour of its hive. */
export function bee(g: C, x: number, y: number, s: number, color: number, look: BeeLook): void {
  const sc = look.scale ?? 1;
  if (sc <= 0.01 || s <= 0.5) return;
  const dir = look.dir ?? 0;
  g.save();
  g.translate(x, y);
  g.scale(sc, sc);
  const face = Math.cos(dir) >= 0 ? 1 : -1;
  // legs: clutching the screw it carries, or reaching down to the screw head it pulls
  const legs = (tx: number, ty: number): void => {
    g.strokeStyle = '#2a2028';
    g.lineCap = 'round';
    g.lineWidth = Math.max(1.5, s * 0.11);
    for (const k of [-1, 1]) {
      g.beginPath();
      g.moveTo(k * s * 0.16, s * 0.32);
      g.quadraticCurveTo(k * s * 0.3, (s * 0.32 + ty) / 2, tx + k * s * 0.14, ty);
      g.stroke();
      g.fillStyle = '#2a2028';
      g.beginPath();
      g.arc(tx + k * s * 0.14, ty, s * 0.085, 0, Math.PI * 2);
      g.fill();
    }
  };
  if ((look.carry ?? -1) >= 0) {
    g.save();
    g.rotate((look.sway ?? 0) * 0.12);
    carriedScrew(g, 0, s * 0.72, s * 0.85, look.carry!);
    legs(0, s * 0.66);
    g.restore();
  } else if (look.grip) {
    legs(look.grip[0] / sc, look.grip[1] / sc);
  }
  g.scale(face, 1);
  g.rotate(Math.max(-0.55, Math.min(0.55, Math.sin(dir) * face * 0.5)) + (look.lean ?? 0));
  const st = look.stretch ?? 1;
  g.scale(st, 1 / Math.sqrt(st));
  const w = Math.sin(look.flap);
  const r = s * 0.64;
  // far wing behind the body
  wing(g, -r * 0.05, -r * 0.95, r * 0.42, r * 0.62, -0.5 - 0.5 * w, 0.75);
  const img = beeBody(color, s, (look.strain ?? 0) > 0.5);
  const W = Math.max(8, Math.round(s * 4) / 4) * 3;
  g.drawImage(img, -W / 2, -W / 2, W, W);
  // near wing in front
  wing(g, -r * 0.35, -r * 0.9, r * 0.48, r * 0.7, -0.9 - 0.55 * w, 0.85);
  g.restore();
}

/** Big home hive at the top left, where bees bring the screws. */
export function homeHive(g: C, x: number, y: number, r: number, punch = 0): void {
  const k = 1 + punch * 0.14;
  g.save();
  g.translate(x, y + r);
  g.scale(1 + punch * 0.08, k);
  g.translate(-x, -y - r);
  // hanging branch
  g.strokeStyle = '#8a5a2b';
  g.lineWidth = r * 0.12;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(x - r * 1.0, y - r * 1.05);
  g.quadraticCurveTo(x, y - r * 1.2, x + r * 1.0, y - r * 1.0);
  g.stroke();
  g.fillStyle = '#6fbf3f';
  g.beginPath();
  g.ellipse(x + r * 0.75, y - r * 1.12, r * 0.28, r * 0.13, -0.5, 0, Math.PI * 2);
  g.fill();
  // golden rings
  const rings = [0.46, 0.8, 0.98, 1.0, 0.86];
  const bh = r * 0.4;
  const top = y - r * 0.95;
  for (let i = 0; i < rings.length; i++) {
    const ry = top + i * bh + bh / 2;
    const rw = r * 2 * rings[i];
    const grad = g.createLinearGradient(0, ry - bh * 0.6, 0, ry + bh * 0.6);
    grad.addColorStop(0, '#ffe08a');
    grad.addColorStop(0.45, '#f6b52a');
    grad.addColorStop(1, '#c27410');
    g.fillStyle = grad;
    rr(g, x - rw / 2, ry - bh * 0.62, rw, bh * 1.24, bh * 0.62);
    g.fill();
    g.fillStyle = 'rgba(255,255,255,0.4)';
    rr(g, x - rw * 0.32, ry - bh * 0.48, rw * 0.36, bh * 0.2, bh * 0.1);
    g.fill();
  }
  // entrance
  g.fillStyle = '#5a2c08';
  g.beginPath();
  g.ellipse(x, y + r * 0.45, r * 0.26, r * 0.2, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(255,200,90,0.35)';
  g.beginPath();
  g.ellipse(x, y + r * 0.5, r * 0.16, r * 0.08, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

/** A screw as Screwdom draws it pulled out: domed head over a threaded shaft (pointing down). */
export function carriedScrew(g: C, x: number, y: number, s: number, color: number): void {
  const col = COLORS[color];
  const sw = s * 0.36;
  const len = s * 1.0;
  const grad = g.createLinearGradient(x - sw, 0, x + sw, 0);
  grad.addColorStop(0, col.dark);
  grad.addColorStop(0.4, col.light);
  grad.addColorStop(1, col.dark);
  g.fillStyle = grad;
  rr(g, x - sw / 2, y, sw, len, sw * 0.3);
  g.fill();
  g.strokeStyle = col.dark;
  g.lineWidth = Math.max(1, s * 0.07);
  for (let t = y + s * 0.15; t < y + len - s * 0.05; t += s * 0.17) {
    g.beginPath();
    g.moveTo(x - sw * 0.55, t);
    g.lineTo(x + sw * 0.55, t + s * 0.08);
    g.stroke();
  }
  // head seen from the side: a dome
  const hg = g.createLinearGradient(0, y - s * 0.3, 0, y + s * 0.05);
  hg.addColorStop(0, col.light);
  hg.addColorStop(1, col.base);
  g.fillStyle = hg;
  g.beginPath();
  g.ellipse(x, y + s * 0.02, s * 0.5, s * 0.28, 0, Math.PI, 0);
  g.fill();
  g.fillStyle = col.dark;
  rr(g, x - s * 0.5, y - s * 0.02, s, s * 0.1, s * 0.05);
  g.fill();
}

export function screwHead(g: C, x: number, y: number, r: number, color: number): void {
  const col = COLORS[color];
  const grad = g.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
  grad.addColorStop(0, col.light);
  grad.addColorStop(0.6, col.base);
  grad.addColorStop(1, col.dark);
  g.fillStyle = grad;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = col.dark;
  g.lineWidth = r * 0.28;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(x - r * 0.45, y); g.lineTo(x + r * 0.45, y);
  g.moveTo(x, y - r * 0.45); g.lineTo(x, y + r * 0.45);
  g.stroke();
}

/** Screwdom holding spot: grey recess with a white rim. */
export function slot(g: C, x: number, y: number, r: number, extra = false): void {
  g.fillStyle = extra ? '#c9f5b8' : '#ffffff';
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  const grad = g.createRadialGradient(x, y - r * 0.5, r * 0.1, x, y, r * 0.84);
  grad.addColorStop(0, '#6d7581');
  grad.addColorStop(1, '#9aa3ae');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(x, y, r * 0.82, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = 'rgba(40,50,70,0.25)';
  g.lineWidth = Math.max(1, r * 0.06);
  g.beginPath();
  g.arc(x, y + r * 0.03, r * 0.8, Math.PI * 1.1, Math.PI * 1.9);
  g.stroke();
  if (extra) {
    g.strokeStyle = '#4cc63a';
    g.lineWidth = Math.max(1, r * 0.08);
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.stroke();
  }
}

/** A five-point star (sparkles). */
export function star(g: C, x: number, y: number, r: number, rot = 0): void {
  if (r <= 0.2) return;
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = rot + (i * Math.PI) / 5 - Math.PI / 2;
    const rad = i % 2 ? r * 0.45 : r;
    g.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
  }
  g.closePath();
  g.fill();
}

// ------------------------------------------------------------------ booster bar and buttons

/** Wooden plank along the bottom holding the boosters. */
export function boosterBar(g: C, x: number, y: number, w: number, h: number): void {
  plank(g, x + h * 0.08, y, w - h * 0.16, h * 0.92, h * 0.26);
}

export type BoosterIcon = 'drill' | 'slot' | 'hammer' | 'shuffle';

export function boosterButton(g: C, x: number, y: number, r: number, icon: BoosterIcon, opts: { locked?: number; count?: number; armed?: boolean; t?: number }): void {
  // silver ring and a dark blue well
  const ring = g.createLinearGradient(0, y - r, 0, y + r);
  ring.addColorStop(0, '#f2f4ff');
  ring.addColorStop(1, '#8d93c4');
  g.fillStyle = ring;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  const well = g.createRadialGradient(x, y - r * 0.4, r * 0.1, x, y, r * 0.86);
  if (opts.locked) {
    well.addColorStop(0, '#b9bcc9');
    well.addColorStop(1, '#6f7385');
  } else {
    well.addColorStop(0, opts.armed ? '#7fd6ff' : '#5c7cf0');
    well.addColorStop(1, opts.armed ? '#2a7fd0' : '#273a9e');
  }
  g.fillStyle = well;
  g.beginPath();
  g.arc(x, y, r * 0.84, 0, Math.PI * 2);
  g.fill();
  if (opts.armed) {
    g.strokeStyle = `rgba(255,240,120,${0.6 + 0.4 * Math.sin((opts.t ?? 0) * 8)})`;
    g.lineWidth = r * 0.12;
    g.beginPath();
    g.arc(x, y, r * 1.02, 0, Math.PI * 2);
    g.stroke();
  }
  if (opts.locked) {
    lock(g, x, y - r * 0.08, r * 0.5);
    g.fillStyle = '#4d5168';
    rr(g, x - r * 0.48, y + r * 0.62, r * 0.96, r * 0.36, r * 0.18);
    g.fill();
    text(g, `Lv.${opts.locked}`, x, y + r * 0.8, r * 0.27, '#fff', '');
    return;
  }
  boosterGlyph(g, x, y, r * 0.62, icon);
  const bx = x + r * 0.66;
  const by = y + r * 0.62;
  if (opts.count && opts.count > 0) {
    g.fillStyle = '#ff3b4e';
    g.beginPath();
    g.arc(bx, by, r * 0.3, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#fff';
    g.lineWidth = r * 0.06;
    g.stroke();
    text(g, String(opts.count), bx, by, r * 0.34, '#fff', '');
  } else {
    g.fillStyle = '#39c54a';
    g.beginPath();
    g.arc(bx, by, r * 0.3, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#fff';
    g.lineWidth = r * 0.06;
    g.stroke();
    text(g, '+', bx, by - r * 0.02, r * 0.46, '#fff', '');
  }
}

export function lock(g: C, x: number, y: number, s: number): void {
  g.strokeStyle = '#e8eaf2';
  g.lineWidth = s * 0.18;
  g.beginPath();
  g.arc(x, y - s * 0.15, s * 0.32, Math.PI, 0);
  g.stroke();
  const grad = g.createLinearGradient(0, y - s * 0.2, 0, y + s * 0.5);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(1, '#b9bdcc');
  g.fillStyle = grad;
  rr(g, x - s * 0.48, y - s * 0.18, s * 0.96, s * 0.7, s * 0.14);
  g.fill();
  g.fillStyle = '#6f7385';
  g.beginPath();
  g.arc(x, y + s * 0.1, s * 0.1, 0, Math.PI * 2);
  g.fill();
}

export function boosterGlyph(g: C, x: number, y: number, s: number, icon: BoosterIcon): void {
  g.save();
  g.translate(x, y);
  g.lineJoin = 'round';
  g.lineCap = 'round';
  if (icon === 'drill') {
    g.rotate(-0.5);
    g.fillStyle = '#e8463a';
    rr(g, -s * 0.55, -s * 0.28, s * 0.85, s * 0.5, s * 0.16);
    g.fill();
    g.fillStyle = '#b52a22';
    rr(g, -s * 0.38, s * 0.1, s * 0.3, s * 0.62, s * 0.1);
    g.fill();
    g.fillStyle = '#d9dde6';
    g.beginPath();
    g.moveTo(s * 0.3, -s * 0.14); g.lineTo(s * 0.85, -s * 0.03); g.lineTo(s * 0.3, s * 0.08);
    g.fill();
    g.fillStyle = '#ffd23f';
    g.fillRect(-s * 0.46, -s * 0.2, s * 0.18, s * 0.34);
  } else if (icon === 'slot') {
    g.fillStyle = '#2d2d3a';
    g.beginPath();
    g.arc(-s * 0.12, s * 0.05, s * 0.5, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#fff';
    g.lineWidth = s * 0.08;
    g.stroke();
    g.fillStyle = '#39c54a';
    g.beginPath();
    g.arc(s * 0.38, -s * 0.38, s * 0.3, 0, Math.PI * 2);
    g.fill();
    text(g, '+', s * 0.38, -s * 0.4, s * 0.5, '#fff', '');
  } else if (icon === 'hammer') {
    g.rotate(-0.6);
    g.fillStyle = '#c9893f';
    rr(g, -s * 0.09, -s * 0.2, s * 0.18, s * 1.0, s * 0.08);
    g.fill();
    const grad = g.createLinearGradient(0, -s * 0.55, 0, -s * 0.15);
    grad.addColorStop(0, '#f2f4f8');
    grad.addColorStop(1, '#8b93a6');
    g.fillStyle = grad;
    rr(g, -s * 0.55, -s * 0.58, s * 1.1, s * 0.42, s * 0.1);
    g.fill();
  } else {
    // shuffle: two bent arrows
    g.strokeStyle = '#ffd23f';
    g.lineWidth = s * 0.16;
    for (const k of [-1, 1]) {
      g.beginPath();
      g.moveTo(-s * 0.6, k * s * 0.3);
      g.bezierCurveTo(-s * 0.1, k * s * 0.3, s * 0.05, -k * s * 0.3, s * 0.45, -k * s * 0.3);
      g.stroke();
      g.fillStyle = '#ffd23f';
      g.beginPath();
      g.moveTo(s * 0.68, -k * s * 0.3);
      g.lineTo(s * 0.38, -k * s * 0.3 - s * 0.2);
      g.lineTo(s * 0.38, -k * s * 0.3 + s * 0.2);
      g.fill();
    }
  }
  g.restore();
}

export function button(g: C, x: number, y: number, w: number, h: number, label: string, kind: 'green' | 'orange' | 'blue' = 'green', press = 1): void {
  const cols = { green: ['#7ef06a', '#33b93b', '#1c7a24'], orange: ['#ffc46b', '#f58a1a', '#a95207'], blue: ['#7fb6ff', '#3a72e8', '#1f3f9a'] }[kind];
  g.save();
  g.translate(x + w / 2, y + h / 2);
  g.scale(press, press);
  g.fillStyle = cols[2];
  rr(g, -w / 2, -h / 2 + h * 0.08, w, h, h * 0.28);
  g.fill();
  const grad = g.createLinearGradient(0, -h / 2, 0, h / 2);
  grad.addColorStop(0, cols[0]);
  grad.addColorStop(1, cols[1]);
  g.fillStyle = grad;
  rr(g, -w / 2, -h / 2, w, h * 0.94, h * 0.28);
  g.fill();
  g.fillStyle = 'rgba(255,255,255,0.28)';
  rr(g, -w / 2 + h * 0.15, -h / 2 + h * 0.08, w - h * 0.3, h * 0.3, h * 0.15);
  g.fill();
  text(g, label, 0, -h * 0.02, h * 0.42, '#fff', cols[2]);
  g.restore();
}

/** Round white pause button. */
export function pauseIcon(g: C, x: number, y: number, s: number): void {
  g.fillStyle = 'rgba(40,70,110,0.25)';
  g.beginPath();
  g.arc(x, y + s * 0.08, s * 0.62, 0, Math.PI * 2);
  g.fill();
  const grad = g.createLinearGradient(0, y - s * 0.6, 0, y + s * 0.6);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(1, '#dfe9f3');
  g.fillStyle = grad;
  g.beginPath();
  g.arc(x, y, s * 0.6, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#3d86d8';
  rr(g, x - s * 0.24, y - s * 0.24, s * 0.16, s * 0.48, s * 0.06);
  g.fill();
  rr(g, x + s * 0.08, y - s * 0.24, s * 0.16, s * 0.48, s * 0.06);
  g.fill();
}

/** Pointing hand for the tutorial. */
export function hand(g: C, x: number, y: number, s: number): void {
  g.save();
  g.translate(x, y);
  g.rotate(-0.35);
  g.fillStyle = '#ffffff';
  g.strokeStyle = '#2b2b3a';
  g.lineWidth = s * 0.07;
  g.beginPath();
  g.moveTo(-s * 0.12, 0);
  g.lineTo(-s * 0.12, s * 0.55);
  g.quadraticCurveTo(-s * 0.4, s * 0.45, -s * 0.42, s * 0.62);
  g.quadraticCurveTo(-s * 0.3, s * 0.95, -s * 0.05, s * 1.15);
  g.lineTo(s * 0.45, s * 1.15);
  g.quadraticCurveTo(s * 0.62, s * 0.85, s * 0.58, s * 0.55);
  g.lineTo(s * 0.58, s * 0.45);
  g.quadraticCurveTo(s * 0.5, s * 0.36, s * 0.38, s * 0.42);
  g.quadraticCurveTo(s * 0.32, s * 0.32, s * 0.2, s * 0.38);
  g.quadraticCurveTo(s * 0.14, s * 0.3, s * 0.12, s * 0.36);
  g.lineTo(s * 0.12, 0);
  g.quadraticCurveTo(0, -s * 0.14, -s * 0.12, 0);
  g.closePath();
  g.fill();
  g.stroke();
  g.restore();
}

/** Pile of coins on the win screen. */
export function coinPile(g: C, x: number, y: number, s: number): void {
  const spots: [number, number][] = [[-0.55, 0.3], [0.5, 0.32], [-0.1, 0.42], [-0.35, 0.05], [0.25, 0.08], [0, -0.2], [-0.2, -0.4], [0.18, -0.48]];
  for (const [dx, dy] of spots) {
    const cx = x + dx * s;
    const cy = y + dy * s;
    g.fillStyle = '#c47a00';
    g.beginPath();
    g.ellipse(cx, cy + s * 0.08, s * 0.32, s * 0.14, 0, 0, Math.PI * 2);
    g.fill();
    const grad = g.createLinearGradient(cx, cy - s * 0.14, cx, cy + s * 0.14);
    grad.addColorStop(0, '#fff3a0');
    grad.addColorStop(1, '#ffbf1f');
    g.fillStyle = grad;
    g.beginPath();
    g.ellipse(cx, cy, s * 0.32, s * 0.14, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#e09a00';
    g.lineWidth = s * 0.025;
    g.beginPath();
    g.ellipse(cx, cy, s * 0.22, s * 0.09, 0, 0, Math.PI * 2);
    g.stroke();
  }
}
