// Bee:Screw — tap a hive, its bees fly up and pull the screws of their colour out of a 3D toy.
// Screwdom 3D (screws, plates, blocks that fall when free) + Colony Flow (colour colonies sent out to work).

import FalconSDK from '@falcongames/game-client-sdk';
import { createFalconEvents, type FalconGame } from './falcon-game';
import { COLORS, LEVELS, generate } from './levels.ts';
import { Board, DIRS, type HiveSpec, type LevelSpec } from './sim.ts';
import { Scene3D } from './scene3d.ts';
import { BeeLayer, type BeePose } from './bees3d.ts';
import { audio, haptic, sfx, unlockAudio } from './audio.ts';
import { FONT, button, coin, coinPile, hand, rr, screwHead, star, text } from './art.ts';
import {
  POS, REF, background, boosterButton, boosterIcon, coinDisplay, hiveToken, levelSign, pauseButton, returnHive,
  screwCounter, slotRing, toolbar, type BoosterIcon,
} from './hud.ts';

export const LEVEL_COUNT = LEVELS.length;

const bgCanvas = document.getElementById('bg') as HTMLCanvasElement;
const view3d = document.getElementById('view') as HTMLCanvasElement;
const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
const scene = new Scene3D(view3d);
/** 3D bees on their own canvas above the HUD */
const beeLayer = new BeeLayer(document.getElementById('fx') as HTMLCanvasElement);
let beePoses: BeePose[] = [];
let frameDt = 0;
let beeDemo = false;
const beeIds = new WeakMap<object, number>();
let nextBeeId = 1;
const beeId = (b: object): number => {
  let id = beeIds.get(b);
  if (id === undefined) beeIds.set(b, (id = nextBeeId++));
  return id;
};
const events = createFalconEvents();
const SDK = (): FalconSDK.SDK | null => {
  try { return FalconSDK as unknown as FalconSDK.SDK; } catch { return null; }
};

// ------------------------------------------------------------------ save

interface Save { coins: number; boosters: Record<BoosterKey, number>; seen: string[] }
type BoosterKey = 'drill' | 'magnet' | 'hammer' | 'shuffle';
const BOOSTERS: { key: BoosterKey; icon: BoosterIcon; unlock: number; title: string; desc: string }[] = [
  { key: 'drill', icon: 'drill', unlock: 2, title: 'Drill', desc: 'Drill open one more slot.' },
  { key: 'magnet', icon: 'magnet', unlock: 3, title: 'Magnet', desc: 'Pick a hive: it fills up at once.' },
  { key: 'hammer', icon: 'hammer', unlock: 7, title: 'Hammer', desc: 'Smash one block, screws and all.' },
  { key: 'shuffle', icon: 'shuffle', unlock: 10, title: 'Shuffle', desc: 'Mix up the waiting hives.' },
];
const WIN_COINS = 10;
const MAX_SLOTS = 7;

const save: Save = { coins: 120, boosters: { drill: 1, magnet: 1, hammer: 1, shuffle: 1 }, seen: [] };
try {
  const s = JSON.parse(localStorage.getItem('beescrew_save') ?? 'null');
  if (s) Object.assign(save, s, { boosters: { ...save.boosters, ...s.boosters } });
} catch { /* storage blocked */ }
function store(): void {
  try { localStorage.setItem('beescrew_save', JSON.stringify(save)); } catch { /* ignore */ }
}

// ------------------------------------------------------------------ state

interface HiveLive { color: number; n: number; total: number }
interface Slot {
  hive: HiveLive | null;
  enter: number; // 0..1 flight from the grid
  fromX: number;
  fromY: number;
  bees: number; // bees still out working
  leave: number; // -1, or 0..1 flying home
  cool: number;
  extra: boolean;
  /** squash wobble 1 → 0 (a bee launched, the hive landed) */
  pulse: number;
  /** 0..1 pop-in of a slot the Drill just opened */
  appear: number;
  /** seconds waiting for screws hidden from view */
  wait: number;
  burst: boolean;
  /** the guard bee buzzing on top of the hive: its 3D rig id, and how far it has popped back in (0..1) */
  guardId: number;
  guard: number;
}
interface Bee {
  color: number;
  slot: number;
  /** target screw, -1 while hovering */
  si: number;
  phase: 'out' | 'work' | 'home' | 'idle' | 'back';
  t: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** hover point while the toy is being turned */
  hx: number;
  hy: number;
  idleT: number;
  dir: number;
  wob: number;
  stretch: number;
  lean: number;
  /** landing / snap squash timer */
  land: number;
  strain: number;
  carry: number;
  /** screen point its legs grip while pulling */
  gx: number;
  gy: number;
}
/** a booster pulling a screw on its own; `carry` sends a bee home with it */
interface Job { si: number; t: number; carry?: boolean }
type PKind = 'dot' | 'star' | 'ring' | 'drop' | 'puff' | 'text' | 'chip' | 'screw';
interface Particle {
  kind: PKind; x: number; y: number; vx: number; vy: number; t: number; life: number;
  color: string; size: number; grav: number; rot: number; vr: number; label?: string;
}
type Popup = null | 'win' | 'lose' | 'pause' | 'intro';

let level = 0;
let spec: LevelSpec;
let board: Board;
let columns: HiveLive[][] = [];
let colShift: number[] = [];
let slots: Slot[] = [];
let bees: Bee[] = [];
let jobs: Job[] = [];
let particles: Particle[] = [];
let popup: Popup = null;
let popupT = 0;
let paused = false;
let playing = false;
let armed: BoosterKey | null = null;
let stuckT = 0;
let winT = -1;
let revived = 0;
let combo = 0;
let comboT = 0;
let time = 0;
let toastMsg = '';
let toastT = 0;
let introKey: BoosterKey | null = null;
let shake = 0;
let shakeCol = -1;
let badgePunch = 0;
let homePunch = 0;
/** tiny screen kick on every snap */
let jolt = 0;
let countPop = 0;
/** seconds since the toy stopped turning */
let settle = 1;
/** a hive is waiting for screws the player has to turn the toy to show */
let hint: { si: number; color: number; t: number } | null = null;
/** "Hard Level!" / "Super Hard!" ribbon at the start of a spike level */
let banner: { text: string; t: number } | null = null;
let winReward = 10;
const REWARD: Record<LevelSpec['difficulty'], number> = { easy: 10, normal: 10, hard: 20, super: 30 };

const PRAISE = ['Sweet!', 'Buzzing!', 'Honey!', 'Great!', 'Nice!'];

// ------------------------------------------------------------------ layout

const L = {
  w: 1, h: 1, u: 1, cx: 0, sbh: 0, topH: 0, badgeY: 0, badgeS: 0,
  barTop: 0, barH: 0, hiveR: 0, rowGap: 0, colGap: 0, gridTop: 0,
  slotY: 0, slotR: 0, slotGap: 0, viewTop: 0, viewBottom: 0, boosterR: 0, viewSize: 0,
  /** reference → screen scale, left edge of the reference column, top anchor */
  k: 1, ox: 0, top: 0, tokenW: 1,
};

function safeTop(): number {
  const probe = document.getElementById('sbh-probe');
  return probe ? probe.getBoundingClientRect().height : 0;
}

/**
 * Map the reference shot (REF px) onto the device: one uniform scale `k` (the reference width fits the
 * screen, or the height on squat screens), centred horizontally. The HUD hangs from the top safe area;
 * slots, hive grid and toolbar stand on the bottom edge; the toy takes the room in between.
 */
function layout(): void {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  const W = Math.min(w, h * (REF.w / REF.h));
  const k = W / REF.w;
  L.w = w; L.h = h; L.k = k; L.ox = (w - W) / 2;
  L.sbh = safeTop();
  L.top = Math.max(0, L.sbh - 20 * k);
  L.u = W;
  L.cx = X(457.5);
  L.topH = YT(225);
  L.badgeY = YT(POS.level.y);
  L.badgeS = POS.level.w * k;
  L.barTop = YB(POS.bar.y);
  L.barH = h - L.barTop;
  L.boosterR = POS.boosters.r * k;
  L.tokenW = POS.grid.w * k;
  L.hiveR = L.tokenW / 2;
  L.rowGap = POS.grid.dy * k;
  L.colGap = POS.grid.dx * k;
  L.gridTop = YB(POS.grid.y0);
  L.slotR = POS.slots.r * k;
  L.slotY = YB(POS.slots.y);
  const n = Math.max(5, slots.length);
  L.slotGap = Math.min(POS.slots.dx * k, (W - L.slotR * 2 - 16 * k) / (n - 1));
  // the toy: the reference box, grown a little if a tall screen leaves room
  const top = YT(POS.puzzle.y0);
  const bottom = YB(POS.puzzle.y1);
  const refH = (POS.puzzle.y1 - POS.puzzle.y0) * k;
  const boxH = Math.min(bottom - top, refH * 1.2);
  const boxW = (POS.puzzle.x1 - POS.puzzle.x0) * k * (boxH / refH);
  L.viewTop = (top + bottom) / 2 - boxH / 2;
  L.viewBottom = (top + bottom) / 2 + boxH / 2;
  L.viewSize = Math.max(boxW, boxH);
  beeLayer.resize(w, h);
  scene.setView(w, h, X((POS.puzzle.x0 + POS.puzzle.x1) / 2), (top + bottom) / 2, Math.min(boxW, w * 0.96), boxH);
  paintBackground();
}

function paintBackground(): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  bgCanvas.width = Math.round(L.w * dpr);
  bgCanvas.height = Math.round(L.h * dpr);
  const g = bgCanvas.getContext('2d')!;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  background(g, L.w, L.h);
}

/** REF x → screen x; REF y → screen y anchored to the top (HUD) or the bottom (slots, grid, toolbar). */
const X = (x: number): number => L.ox + x * L.k;
const YT = (y: number): number => L.top + y * L.k;
const YB = (y: number): number => L.h - (REF.h - y) * L.k;

const slotX = (i: number): number => L.cx + (i - (slots.length - 1) / 2) * L.slotGap;
const colX = (c: number): number => L.cx + (c - (columns.length - 1) / 2) * L.colGap;
const rowY = (r: number): number => L.gridTop + r * L.rowGap;
const boosterX = (i: number): number => X(POS.boosters.x0 + i * POS.boosters.dx);
const boosterY = (): number => YB(POS.boosters.y);
const pauseXY = (): [number, number] => [X(POS.pause.x), YT(POS.pause.y)];
const badgeXY = (): [number, number] => [L.cx, L.badgeY];
/** home hive at the top left: centre, radius; bees fly into its door */
/** the big return hive (top right) and its door, where bees deliver the screws */
const homeXY = (): [number, number] => [X(POS.hive.door.x), YT(POS.hive.door.y)];

// ------------------------------------------------------------------ level flow

function startLevel(index: number): void {
  level = Math.max(0, Math.min(LEVEL_COUNT - 1, Math.floor(index)));
  spec = generate(level);
  board = new Board(spec);
  columns = spec.columns.map((c) => c.map((h: HiveSpec) => ({ color: h.color, n: h.n, total: h.n })));
  colShift = columns.map(() => 0);
  slots = Array.from({ length: spec.slots }, () => newSlot(false));
  bees = [];
  jobs = [];
  particles = [];
  popup = null;
  armed = null;
  stuckT = 0;
  winT = -1;
  revived = 0;
  combo = 0;
  hint = null;
  paused = false;
  playing = true;
  coachQ = [];
  drillUsed = false;
  drillFx = null; magnetFx = null; hammerFx = null; shuffleFx = null; flyScrews = [];
  scene.build(spec);
  layout();
  // tutorial and booster cards
  if (level === 0) {
    teach('t_tap', 'Tap a hive to send out its bees!', 'hiveTapped', { at: () => (columns[0]?.length ? [colX(0), rowY(0)] : null), max: 30 });
    teach('t_bees', 'Bees pull out screws of their own colour.', 'time', { max: 3 });
    teach('t_win', 'Pull out every screw to win!', 'time', { max: 2.5 });
  }
  if (spec.pieces.some((p) => p.kind === 'plate')) {
    teach('t_plate', 'Metal plates pin blocks: free their screws first!', 'time', { max: 3.5, at: platePos });
  }
  banner = spec.difficulty === 'hard' || spec.difficulty === 'super' ? { text: spec.difficulty === 'super' ? 'Super Hard!' : 'Hard Level!', t: 0 } : null;
  const card = BOOSTERS.find((b) => b.unlock === level + 1 && !save.seen.includes(`b_${b.key}`));
  if (card) { introKey = card.key; if (!banner) { popup = 'intro'; popupT = 0; } }
  events.emit('levelStart', { index: level, difficulty: spec.difficulty, levelId: `${LEVELS[level].model}-${LEVELS[level].seed}` });
}

function newSlot(extra: boolean): Slot {
  return { hive: null, enter: 1, fromX: 0, fromY: 0, bees: 0, leave: -1, cool: 0, extra, pulse: 0, wait: 0, burst: false, appear: 1, guardId: nextBeeId++, guard: 0 };
}

function toast(msg: string): void { toastMsg = msg; toastT = 2.2; }

/** Total screws not yet claimed by a bee, per colour, must equal the hives' numbers: keep it so. */
function takeFromHive(color: number): boolean {
  for (let c = 0; c < columns.length; c++) {
    for (let r = columns[c].length - 1; r >= 0; r--) {
      const h = columns[c][r];
      if (h.color !== color || h.n <= 0) continue;
      h.n--;
      if (h.n === 0) columns[c].splice(r, 1);
      return true;
    }
  }
  for (const s of slots) {
    if (s.hive && s.hive.color === color && s.hive.n > 0) { s.hive.n--; return true; }
  }
  return false;
}

function tapColumn(c: number): void {
  const h = columns[c]?.[0];
  if (!h || boosterBusy() || armed || banner) return;
  const free = slots.findIndex((s) => !s.hive);
  if (free < 0) {
    shake = 0.35; shakeCol = c;
    sfx.warn();
    toast('All slots are busy!');
    teach('t_full', 'All slots are busy: wait for a hive to finish!', 'time', { max: 3, at: () => [L.cx, L.slotY] });
    return;
  }
  columns[c].shift();
  colShift[c] = L.rowGap;
  const s = slots[free];
  s.hive = h;
  s.enter = 0;
  s.fromX = colX(c);
  s.fromY = rowY(0);
  s.leave = -1;
  s.cool = 0.32; // let the guard bee show on the hive, then it leads the way
  s.bees = 0;
  s.wait = 0;
  s.burst = false;
  stuckT = 0;
  sfx.tap();
  haptic(10);
  coachEvent('hiveTapped');
}

/** Where a slot's guard bee hovers on top of its hive (x, y, heading). */
function guardPose(i: number): [number, number, number] {
  const u = L.u;
  return [
    slotX(i) + Math.sin(time * 2.6 + i) * u * 0.018,
    L.slotY - L.tokenW * 0.62 + Math.sin(time * 5 + i) * u * 0.006,
    Math.cos(time * 2.6 + i) > 0 ? 0 : Math.PI,
  ];
}

/** Free screws of a colour the player can see right now: bees only fly to those. */
function visibleFree(color: number): number[] {
  return board.freeOf(color).filter((si) => scene.visible(si, board.alive));
}

function pickScrew(color: number, fromX: number, fromY: number): number {
  let best = -1;
  let score = -1e9;
  for (const si of visibleFree(color)) {
    const p = scene.screwScreen(si);
    const sc = p.facing * 300 - Math.hypot(p.x - fromX, p.y - fromY) * 0.4 + Math.random() * 40;
    if (sc > score) { score = sc; best = si; }
  }
  return best;
}

function removeScrew(si: number, forced = false): void {
  const s = spec.screws[si];
  const pos = scene.screwScreen(si);
  scene.pop(si);
  scene.invalidate();
  const fallen = board.remove(si);
  haptic(4);
  const u = L.u;
  const col = COLORS[s.color];
  // pop: ring, sparkles, a soft puff (boosters bring their own effects)
  if (!forced) spawn('ring', pos.x, pos.y, { color: col.light, size: u * 0.045, life: 0.35 });
  for (let i = 0; i < (forced ? 0 : 3); i++) {
    const a = Math.random() * Math.PI * 2;
    const v = u * (0.25 + Math.random() * 0.3);
    spawn('star', pos.x, pos.y, { vx: Math.cos(a) * v, vy: Math.sin(a) * v - u * 0.1, color: i % 2 ? '#ffffff' : '#fff1a0', size: u * (0.012 + Math.random() * 0.01), grav: u * 0.8, life: 0.5 });
  }
  for (const p of fallen) {
    scene.drop(p, DIRS[s.dir]);
    const at = scene.pieceScreen(p);
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2;
      spawn('puff', at.x + Math.cos(a) * u * 0.03, at.y + Math.sin(a) * u * 0.03, { vx: Math.cos(a) * u * 0.18, vy: Math.sin(a) * u * 0.12 - u * 0.05, color: 'rgba(255,244,225,0.9)', size: u * (0.025 + Math.random() * 0.02), life: 0.55 });
    }
  }
  if (fallen.length) {
    sfx.drop();
    haptic(15);
    teach('t_fall', 'No screws left: the block drops off!', 'time', { max: 2.5 });
  }
  combo++;
  comboT = 0.6;
  sfx.pop(combo);
}

function spawn(kind: PKind, x: number, y: number, o: Partial<Particle> = {}): void {
  particles.push({ kind, x, y, vx: 0, vy: 0, t: 0, life: 0.6, color: '#fff', size: L.u * 0.01, grav: 0, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 8, ...o });
}

function burst(x: number, y: number, color: string, n: number): void {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = L.u * (0.15 + Math.random() * 0.35);
    spawn('star', x, y, { vx: Math.cos(a) * v, vy: Math.sin(a) * v - L.u * 0.1, color, size: L.u * (0.01 + Math.random() * 0.01), grav: L.u * 0.9, life: 0.5 + Math.random() * 0.3 });
  }
}

/** A hive sent all its bees home: honey splash, stars, praise. */
function hiveDone(x: number, y: number, color: number): void {
  const u = L.u;
  const col = COLORS[color];
  spawn('ring', x, y, { color: col.light, size: u * 0.14, life: 0.5 });
  spawn('ring', x, y, { color: '#fff7c2', size: u * 0.1, life: 0.35 });
  for (let i = 0; i < 12; i++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.6;
    const v = u * (0.35 + Math.random() * 0.4);
    spawn('drop', x, y - u * 0.03, { vx: Math.cos(a) * v, vy: Math.sin(a) * v, color: i % 3 ? '#ffc21a' : col.base, size: u * (0.011 + Math.random() * 0.01), grav: u * 1.6, life: 0.8 });
  }
  for (let i = 0; i < 8; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = u * (0.2 + Math.random() * 0.25);
    spawn('star', x, y, { vx: Math.cos(a) * v, vy: Math.sin(a) * v, color: i % 2 ? '#ffffff' : '#ffe766', size: u * (0.016 + Math.random() * 0.012), life: 0.6 });
  }
  spawn('text', x, y - u * 0.11, { vy: -u * 0.12, color: '#fff36b', size: u * 0.05, life: 0.9, label: PRAISE[Math.floor(Math.random() * PRAISE.length)] });
}

// ------------------------------------------------------------------ boosters
//
// Drill   – drills open one more slot (max MAX_SLOTS).
// Magnet  – the hive area lights up and the hives wobble; the hive the player picks fills at once: its
//           screws leave the toy outer ones first (blocked ones too) and fly into it.
// Hammer  – the toy lights up; the player may turn it, then taps a block: the hammer smashes it, its
//           screws are gone and the matching hives count them off.
// Shuffle – the waiting hives flicker and swirl to new places for ~2 s.

interface DrillFx { t: number; slot: number }
interface MagnetFx { hive: HiveLive; slot: number; x0: number; y0: number; t: number; pullT: number; done: number }
interface HammerFx { piece: number; x: number; y: number; t: number; hit: boolean }
interface ShuffleFx { t: number; from: Map<HiveLive, [number, number]> }
interface FlyScrew { x: number; y: number; x0: number; y0: number; t: number; dur: number; color: number; side: number }

const SHUFFLE_TIME = 2;
let drillFx: DrillFx | null = null;
/** the Drill opens one slot per level */
let drillUsed = false;
let magnetFx: MagnetFx | null = null;
let hammerFx: HammerFx | null = null;
let shuffleFx: ShuffleFx | null = null;
let flyScrews: FlyScrew[] = [];
const boosterPress = [0, 0, 0, 0];

/** A booster animation is running: hold other boosters and hive taps. */
const boosterBusy = (): boolean => !!(drillFx || magnetFx || hammerFx || shuffleFx);

function useBooster(key: BoosterKey): void {
  const i = BOOSTERS.findIndex((b) => b.key === key);
  const def = BOOSTERS[i];
  if (level + 1 < def.unlock) { toast(`Unlocks at level ${def.unlock}`); sfx.warn(); return; }
  if (key === 'drill' && drillUsed) { toast('Only one extra slot per level!'); sfx.warn(); return; }
  if (boosterBusy()) return;
  if (armed === key) { armed = null; sfx.click(); return; }
  if (save.boosters[key] <= 0) { buyBooster(key); return; }
  boosterPress[i] = 1;
  spawn('ring', boosterX(i), boosterY(), { color: '#ffffff', size: L.boosterR * 1.3, life: 0.35 });
  coachEvent(`booster:${key}`);
  if (key === 'drill') {
    if (slots.length >= MAX_SLOTS) { toast('No room for more slots'); return; }
    const s = newSlot(true);
    s.appear = 0;
    slots.push(s);
    layout();
    drillFx = { t: 0, slot: slots.length - 1 };
    drillUsed = true;
    sfx.drill();
    spend(key);
  } else if (key === 'magnet') {
    armed = 'magnet';
    sfx.click();
    teach('t_magnet2', 'Pick any hive: it fills up at once!', 'magnetPicked', { max: 12, first: true });
  } else if (key === 'hammer') {
    armed = 'hammer';
    sfx.click();
    teach('t_hammer2', 'Turn the toy, then tap a block to smash it!', 'hammerHit', { max: 12, first: true });
  } else {
    if (columns.flat().length < 2) { toast('Nothing to shuffle'); return; }
    startShuffle();
    spend(key);
  }
}

function spend(key: BoosterKey): void {
  save.boosters[key]--;
  store();
  sfx.booster();
  stuckT = 0;
  try { SDK()?.analytics.turn.useBooster(key); } catch { /* analytics off */ }
}

/** Out of a booster: tapping it gives 3 more, free. */
function buyBooster(key: BoosterKey): void {
  save.boosters[key] += 3;
  store();
  const i = BOOSTERS.findIndex((b) => b.key === key);
  boosterPress[i] = 1;
  spawn('ring', boosterX(i), boosterY(), { color: '#9cf590', size: L.boosterR * 1.4, life: 0.4 });
  burst(boosterX(i), boosterY() - L.boosterR * 0.4, '#fff6b0', 8);
  spawn('text', boosterX(i), boosterY() - L.boosterR * 1.3, { vy: -L.u * 0.1, color: '#9cf590', size: L.u * 0.05, life: 0.9, label: '+3' });
  sfx.booster();
}

/** Magnet: which hive is under the finger (grid or slot)? */
function hiveAt(x: number, y: number): { hive: HiveLive; slot: number; col: number; row: number; x: number; y: number } | null {
  for (let c = 0; c < columns.length; c++) {
    for (let r = 0; r < Math.min(columns[c].length, POS.grid.rows); r++) {
      if (Math.abs(x - colX(c)) < L.colGap / 2 && Math.abs(y - rowY(r)) < L.rowGap / 2) return { hive: columns[c][r], slot: -1, col: c, row: r, x: colX(c), y: rowY(r) };
    }
  }
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i];
    if (s.hive && s.hive.n > 0 && s.leave < 0 && s.enter >= 1 && Math.abs(x - slotX(i)) < L.slotGap / 2 && Math.abs(y - L.slotY) < L.slotR * 1.2) {
      return { hive: s.hive, slot: i, col: -1, row: -1, x: slotX(i), y: L.slotY };
    }
  }
  return null;
}

function applyArmed(x: number, y: number): boolean {
  if (armed === 'magnet') {
    const t = hiveAt(x, y);
    if (!t) { armed = null; return false; }
    if (t.hive.n <= 0) { toast('That hive is already full'); return false; }
    // take it out of its column now: it flies up and fills
    if (t.slot < 0) {
      columns[t.col].splice(t.row, 1);
      if (t.row === 0) colShift[t.col] = L.rowGap;
    }
    magnetFx = { hive: t.hive, slot: t.slot, x0: t.x, y0: t.y, t: 0, pullT: 0, done: 0 };
    armed = null;
    spend('magnet');
    coachEvent('magnetPicked');
    burst(t.x, t.y, '#ffffff', 10);
    return true;
  }
  if (armed === 'hammer') {
    const hit = scene.pick(x, y);
    let p = hit.piece;
    if (p < 0 && hit.screw >= 0) p = spec.screws[hit.screw].piece;
    if (p < 0 || !board.alive[p]) { toast('Tap a block on the toy'); return false; }
    hammerFx = { piece: p, x, y, t: 0, hit: false };
    armed = null;
    spend('hammer');
    sfx.click();
    return true;
  }
  return false;
}

/** Where the magnet hive hovers while it fills: just under the toy. */
const magnetSpot = (): [number, number] => [L.cx, L.viewBottom - L.u * 0.02];

function magnetPos(m: MagnetFx): [number, number] {
  const [tx, ty] = magnetSpot();
  const k = Math.min(1, m.t / 0.45);
  const e = 1 - Math.pow(1 - k, 3);
  return [m.x0 + (tx - m.x0) * e, m.y0 + (ty - m.y0) * e - Math.sin(k * Math.PI) * L.u * 0.06];
}

/** Outer screws first: free ones, then the ones with the fewest pieces in front. */
function nextMagnetScrew(color: number): number {
  let best = -1;
  let score = 1e9;
  spec.screws.forEach((s, i) => {
    if (s.color !== color || !board.screwAlive[i] || board.claimed[i]) return;
    const q = scene.screwScreen(i);
    const sc = board.blockers(i) * 10 - q.facing;
    if (sc < score) { score = sc; best = i; }
  });
  return best;
}

function updateBoosters(dt: number): void {
  const u = L.u;
  for (let i = 0; i < boosterPress.length; i++) boosterPress[i] = Math.max(0, boosterPress[i] - dt * 4);
  slots.forEach((s) => { if (s.appear < 1 && !drillFx) s.appear = Math.min(1, s.appear + dt * 3); });

  if (drillFx) {
    const d = drillFx;
    d.t += dt;
    const x = slotX(d.slot);
    if (d.t < 0.75 && Math.random() < dt * 40) {
      spawn('star', x + (Math.random() - 0.5) * L.slotR, L.slotY - L.slotR * 0.2, { vx: (Math.random() - 0.5) * u * 0.5, vy: -u * (0.2 + Math.random() * 0.3), grav: u * 1.4, color: Math.random() < 0.5 ? '#ffe36a' : '#ffffff', size: u * 0.009, life: 0.45 });
      if (Math.random() < 0.4) spawn('puff', x, L.slotY + L.slotR * 0.4, { vx: (Math.random() - 0.5) * u * 0.2, vy: -u * 0.05, color: 'rgba(210,215,225,0.8)', size: u * 0.02, life: 0.5 });
    }
    if (d.t >= 0.75 && slots[d.slot] && slots[d.slot].appear === 0) {
      slots[d.slot].appear = 0.001;
      spawn('ring', x, L.slotY, { color: '#9cf590', size: L.slotR * 2, life: 0.45 });
      burst(x, L.slotY, '#ffffff', 10);
      sfx.hive();
    }
    if (d.t >= 0.75) slots[d.slot].appear = Math.min(1, slots[d.slot].appear + dt * 3);
    if (d.t > 1.15) drillFx = null;
  }

  if (magnetFx) {
    const m = magnetFx;
    m.t += dt;
    if (m.t > 0.45 && m.hive.n > 0) {
      m.pullT -= dt;
      if (m.pullT <= 0) {
        m.pullT = 0.075;
        const si = nextMagnetScrew(m.hive.color);
        if (si < 0) m.hive.n = 0;
        else {
          const p = scene.screwScreen(si);
          m.hive.n--;
          removeScrew(si, true);
          flyScrews.push({ x: p.x, y: p.y, x0: p.x, y0: p.y, t: 0, dur: 0.38 + Math.random() * 0.12, color: m.hive.color, side: Math.random() < 0.5 ? -1 : 1 });
        }
      }
    }
    if (m.hive.n <= 0 && !flyScrews.length && m.t > 0.5) {
      m.done += dt;
      if (m.done > 0.15) {
        const [x, y] = magnetPos(m);
        hiveDone(x, y, m.hive.color);
        sfx.hive();
        homePunch = 1;
        // a hive taken from a slot frees it (its bees already out still finish their screws)
        if (m.slot >= 0) {
          const sl = slots[m.slot];
          if (sl && sl.hive === m.hive && sl.bees <= 0) { sl.hive = null; sl.leave = -1; }
        }
        magnetFx = null;
        stuckT = 0;
      }
    }
  }
  if (flyScrews.length) {
    const [hx, hy] = magnetFx ? magnetPos(magnetFx) : magnetSpot();
    for (const f of flyScrews) {
      f.t += dt;
      const k = Math.min(1, f.t / f.dur);
      const e = k * k * (3 - 2 * k);
      f.x = f.x0 + (hx - f.x0) * e + Math.sin(k * Math.PI) * u * 0.08 * f.side;
      f.y = f.y0 + (hy - f.y0) * e - Math.sin(k * Math.PI) * u * 0.05;
      if (k >= 1) {
        f.t = -1;
        if (magnetFx) magnetFx.pullT = Math.max(magnetFx.pullT, 0);
        spawn('star', hx, hy - L.tokenW * 0.2, { vy: -u * 0.12, vx: (Math.random() - 0.5) * u * 0.2, color: '#fff1a0', size: u * 0.011, life: 0.35 });
        sfx.home();
      }
    }
    flyScrews = flyScrews.filter((f) => f.t >= 0);
  }

  if (hammerFx) {
    const hm = hammerFx;
    hm.t += dt;
    if (!hm.hit && hm.t >= 0.3) {
      hm.hit = true;
      smash(hm.piece, hm.x, hm.y);
    }
    if (hm.t > 0.75) hammerFx = null;
  }

  if (shuffleFx) {
    shuffleFx.t += dt;
    if (Math.random() < dt * 14) {
      const c = Math.floor(Math.random() * columns.length);
      const r = Math.floor(Math.random() * Math.min(POS.grid.rows, columns[c]?.length ?? 0));
      if (columns[c]?.[r]) spawn('star', colX(c) + (Math.random() - 0.5) * L.tokenW, rowY(r) + (Math.random() - 0.5) * L.tokenW * 0.6, { color: '#fff6b0', size: u * 0.012, life: 0.5, vr: 6 });
    }
    if (shuffleFx.t >= SHUFFLE_TIME) {
      shuffleFx = null;
      columns.forEach((c, ci) => c.forEach((_, r) => { if (r < POS.grid.rows) burst(colX(ci), rowY(r), '#fff6b0', 4); }));
      sfx.hive();
    }
  }
}

/** Hammer impact: the piece is gone with all its screws; matching hives count them off. */
function smash(p: number, x: number, y: number): void {
  const u = L.u;
  const list = spec.screws.map((_, i) => i).filter((i) => board.screwAlive[i] && (spec.screws[i].piece === p || spec.screws[i].anchor === p));
  // bees heading for these screws let go first (their hives get the count back)
  for (const b of bees) if (b.si >= 0 && list.includes(b.si) && (b.phase === 'out' || b.phase === 'work')) releaseBee(b);
  for (const si of list) {
    const q = scene.screwScreen(si);
    const col = spec.screws[si].color;
    takeFromHive(col);
    removeScrew(si, true);
    const a = Math.atan2(q.y - y, q.x - x);
    spawn('screw', q.x, q.y, { vx: Math.cos(a) * u * 0.6, vy: Math.sin(a) * u * 0.6 - u * 0.4, grav: u * 2.2, color: COLORS[col].base, size: u * 0.016, life: 0.8, vr: 10, label: String(col) });
  }
  if (board.alive[p]) {
    board.alive[p] = false;
    scene.drop(p, [0, 0, 1]);
    scene.invalidate();
  }
  const piece = spec.pieces[p];
  const chips = piece.kind === 'plate' ? ['#c9d4d9', '#9aaab2'] : piece.color === 'wood' ? ['#f2b56a', '#d08c43', '#ffd39b'] : [piece.color, '#ffffff'];
  for (let i = 0; i < 16; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = u * (0.3 + Math.random() * 0.5);
    spawn('chip', x, y, { vx: Math.cos(a) * v, vy: Math.sin(a) * v - u * 0.3, grav: u * 2.4, color: chips[i % chips.length], size: u * (0.01 + Math.random() * 0.012), life: 0.8, vr: (Math.random() - 0.5) * 20 });
  }
  for (let i = 0; i < 6; i++) spawn('puff', x + (Math.random() - 0.5) * u * 0.06, y + (Math.random() - 0.5) * u * 0.06, { vx: (Math.random() - 0.5) * u * 0.3, vy: -u * 0.08, color: 'rgba(255,246,230,0.9)', size: u * 0.03, life: 0.6 });
  spawn('ring', x, y, { color: '#ffffff', size: u * 0.12, life: 0.35 });
  jolt = 0.2;
  sfx.smash();
  haptic(35);
  stuckT = 0;
  coachEvent('hammerHit');
}

function startShuffle(): void {
  const from = new Map<HiveLive, [number, number]>();
  columns.forEach((c, ci) => c.forEach((h, r) => from.set(h, [colX(ci), rowY(Math.min(r, POS.grid.rows))])));
  const all = columns.flat();
  for (let i = all.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [all[i], all[j]] = [all[j], all[i]];
  }
  let k = 0;
  columns = columns.map((c) => c.map(() => all[k++]));
  shuffleFx = { t: 0, from };
  sfx.buzz();
}

/** Where a waiting hive is drawn (the shuffle swirls it from its old place to its new one). */
function tokenPos(h: HiveLive, c: number, r: number): { x: number; y: number; flash: number; scale: number } {
  const x = colX(c);
  const y = rowY(r) + colShift[c];
  if (!shuffleFx) return { x, y, flash: 0, scale: 1 };
  const t = shuffleFx.t;
  const [ox, oy] = shuffleFx.from.get(h) ?? [x, y];
  // 0–0.35 s: shiver in place; 0.35–1.65 s: swirl across; then settle with a bounce
  const k = Math.max(0, Math.min(1, (t - 0.35) / 1.3));
  const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
  const cx = L.cx;
  const cy = rowY(1.5);
  const swirl = Math.sin(k * Math.PI);
  let px = ox + (x - ox) * e;
  let py = oy + (y - oy) * e;
  // pull toward the centre and orbit around it mid-way
  const ang = Math.atan2(py - cy, px - cx) + swirl * 1.2;
  const rad = Math.hypot(px - cx, py - cy) * (1 - swirl * 0.45);
  px = px + (cx + Math.cos(ang) * rad - px) * swirl;
  py = py + (cy + Math.sin(ang) * rad - py) * swirl;
  if (t < 0.35) px += Math.sin(t * 70 + c * 3 + r) * L.u * 0.006;
  const settle = t > 1.65 ? Math.max(0, 1 - (t - 1.65) / 0.35) : 0;
  const flash = t < 1.7 ? (Math.sin(t * 28 + c + r * 2) > 0.3 ? 0.55 : 0) : 0;
  return { x: px, y: py, flash, scale: 1 + 0.12 * swirl + 0.1 * Math.sin(settle * Math.PI * 2) * settle };
}

// ------------------------------------------------------------------ update

const STRAIN = 0.55; // seconds a bee strains on a screw before it snaps out
/** then it rides the screw out to the end of its shaft before flying off (matches the 3D pop) */
const POP_RIDE = 0.26;

/** Which way is "out of the toy" on screen for a screw (its normal, projected). */
function outward(p: { nx: number; ny: number }): number {
  return Math.hypot(p.nx, p.ny) > 0.05 ? Math.atan2(-p.ny, p.nx) : -Math.PI / 2;
}

/**
 * Fly a bee toward (tx, ty): velocity eases toward a desired velocity (slowing on arrival, with a lazy
 * side-to-side wiggle), so changing targets mid-flight always curves smoothly. Returns the distance left.
 */
function steer(b: Bee, tx: number, ty: number, max: number, grip: number, arrive: number, dt: number): number {
  const dx = tx - b.x;
  const dy = ty - b.y;
  const d = Math.hypot(dx, dy);
  const sp = max * Math.min(1, d / arrive);
  let ux = d > 0 ? dx / d : 0;
  let uy = d > 0 ? dy / d : 0;
  const wig = Math.sin(time * 4 + b.wob) * 0.16 * Math.min(1, d / (L.u * 0.25));
  [ux, uy] = [ux - uy * wig, uy + ux * wig];
  const k = 1 - Math.exp(-grip * dt);
  b.vx += (ux * sp - b.vx) * k;
  b.vy += (uy * sp - b.vy) * k;
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  return d;
}

/** Give the screw back and hover clear of the toy until the player stops turning it. */
function releaseBee(b: Bee): void {
  if (b.si >= 0) {
    board.claimed[b.si] = false;
    if (b.phase === 'work') scene.release(b.si);
    const h = slots[b.slot].hive;
    if (h) h.n++;
  }
  b.si = -1;
  b.phase = 'idle';
  b.idleT = 0;
  b.strain = 0;
  const cx = L.cx;
  const cy = (L.viewTop + L.viewBottom) / 2;
  let vx = b.x - cx;
  let vy = b.y - cy;
  const len = Math.hypot(vx, vy) || 1;
  vx /= len; vy /= len;
  const u = L.u;
  b.hx = Math.max(u * 0.06, Math.min(L.w - u * 0.06, b.x + vx * u * 0.16 + (Math.random() - 0.5) * u * 0.05));
  b.hy = Math.max(L.topH + u * 0.04, Math.min(L.slotY - u * 0.12, b.y + vy * u * 0.16 + (Math.random() - 0.5) * u * 0.05));
  // drift gently away from the toy
  b.vx += vx * u * 0.2;
  b.vy += vy * u * 0.2;
}


/** Cubic bezier point. */
function bez(a: number, b: number, c: number, d: number, t: number): number {
  const m = 1 - t;
  return m * m * m * a + 3 * m * m * t * b + 3 * m * t * t * c + t * t * t * d;
}

function update(dt: number): void {
  time += dt;
  if (toastT > 0) toastT -= dt;
  if (shake > 0) shake -= dt;
  if (badgePunch > 0) badgePunch = Math.max(0, badgePunch - dt * 4);
  if (jolt > 0) jolt = Math.max(0, jolt - dt);
  if (homePunch > 0) homePunch = Math.max(0, homePunch - dt * 4);
  if (countPop > 0) countPop = Math.max(0, countPop - dt * 5);
  if (comboT > 0) { comboT -= dt; if (comboT <= 0) combo = 0; }
  if (popup) popupT += dt;
  for (let c = 0; c < colShift.length; c++) colShift[c] = Math.max(0, colShift[c] - dt * L.rowGap * 6);
  for (const p of particles) {
    p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += p.grav * dt; p.rot += p.vr * dt;
    if (p.kind === 'puff' || p.kind === 'text') { p.vx *= Math.pow(0.1, dt); p.vy *= Math.pow(0.2, dt); }
  }
  particles = particles.filter((p) => p.t < p.life);
  coachUpdate(dt);
  if (banner) {
    banner.t += dt;
    if (banner.t > 1.9) {
      banner = null;
      if (introKey && !popup) { popup = 'intro'; popupT = 0; }
    }
  }
  if (!playing || paused || popup) { scene.update(dt, dragging); return; }
  const u = L.u;
  updateBoosters(dt);

  // while the toy turns, bees still find screws they can see and fly over, but only pull once it stops
  if (dragging || scene.spinning()) settle = 0; else settle += dt;
  const calm = settle > 0.2;

  // hives in slots send bees
  let waiting: { si: number; color: number } | null = null;
  slots.forEach((s, i) => {
    s.pulse = Math.max(0, s.pulse - dt * 3.5);
    // a new guard bee climbs out after the last one left to work
    if (s.hive && s.enter >= 1 && s.leave < 0) s.guard = Math.min(1, s.guard + dt * (s.guard < 0.35 ? 2.2 : 5)); else s.guard = 0;
    if (!s.hive) return;
    if (s.enter < 1) {
      s.enter = Math.min(1, s.enter + dt / 0.34);
      // landed: the guard bee pops right out on top
      if (s.enter >= 1) { s.pulse = 1; s.guard = Math.max(s.guard, 0.35); }
      return;
    }
    if (s.leave >= 0) {
      s.leave += dt / 0.85;
      if (!s.burst && s.leave >= 0.32) {
        s.burst = true;
        hiveDone(slotX(i), L.slotY, s.hive.color);
        sfx.hive();
        haptic(20);
        teach('t_done', 'Hive done: its slot is free again!', 'time', { max: 2.5, at: () => [slotX(i), L.slotY] });
      }
      if (s.leave >= 1) { s.hive = null; s.leave = -1; homePunch = 1; }
      return;
    }
    const h = s.hive;
    s.cool -= dt;
    // a hive the Magnet is filling sends no bees
    if (h.n > 0 && s.cool <= 0 && magnetFx?.hive !== h) {
      const si = pickScrew(h.color, slotX(i), L.slotY);
      if (si >= 0) {
        s.wait = 0;
        board.claimed[si] = true;
        h.n--;
        s.bees++;
        s.pulse = 1;
        // the guard bee on top goes first: it takes off from where it hovers, same 3D bee, no pop
        const fromGuard = s.guard > 0.6 && h.n > 0;
        const [gx0, gy0, gdir] = guardPose(i);
        const nb: Bee = {
          color: h.color, slot: i, si, phase: 'out', t: 0,
          x: fromGuard ? gx0 : slotX(i), y: fromGuard ? gy0 : L.slotY - L.hiveR * 1.0,
          vx: (Math.random() - 0.5) * u * 0.4, vy: -u * (fromGuard ? 0.35 : 0.6 + Math.random() * 0.25), hx: 0, hy: 0, idleT: fromGuard ? 1e-6 : 0,
          dir: fromGuard ? gdir : -Math.PI / 2, wob: Math.random() * 6, stretch: 1, lean: 0, land: 0, strain: 0, carry: -1, gx: 0, gy: 0,
        };
        if (fromGuard) {
          beeIds.set(nb, s.guardId);
          s.guardId = nextBeeId++;
          s.guard = 0;
        }
        bees.push(nb);
        s.cool = 0.24;
        if (Math.random() < 0.25) sfx.buzz();
      } else if (board.freeOf(h.color).length > 0) {
        // there is work, but on a side the player isn't showing
        s.wait += dt;
        if (s.wait > 0.9 && !waiting) {
          let best = -1;
          let face = -9;
          for (const f of board.freeOf(h.color)) {
            const q = scene.screwScreen(f);
            if (q.facing > face) { face = q.facing; best = f; }
          }
          if (best >= 0) waiting = { si: best, color: h.color };
        }
      }
    }
    if (h.n <= 0 && s.bees <= 0) {
      s.leave = 0;
      s.pulse = 1;
    }
  });
  if (waiting) {
    const w2: { si: number; color: number } = waiting;
    hint = hint && hint.color === w2.color ? { ...hint, si: w2.si, t: hint.t + dt } : { si: w2.si, color: w2.color, t: 0 };
    if (hint.t > 0.3) teach('t_rotate', 'Turn the toy: bees only see screws facing you!', 'rotated', { swipe: true, max: 10 });
  } else hint = null;

  // bees
  const [hx0, hy0] = homeXY();
  for (const b of bees) {
    b.t += dt;
    if (b.land > 0) b.land = Math.max(0, b.land - dt);
    // turning: a pulling bee lets go but keeps its screw and hovers by it; a bee whose screw turned out of
    // sight gives it back and looks for another one it can see
    if (!calm && b.phase === 'work' && b.carry < 0) {
      scene.release(b.si);
      b.phase = 'out';
      b.t = 0;
      b.strain = 0;
    }
    if (b.phase === 'out' && !scene.visible(b.si, board.alive)) releaseBee(b);
    if (b.phase === 'out') {
      const p = scene.screwScreen(b.si);
      const off = outward(p);
      // ready position: right at the screw, or a little off it while the toy is still turning
      const r0 = u * (calm ? 0.03 : 0.06);
      const bob = calm ? 0 : Math.sin(time * 5 + b.wob) * u * 0.006;
      const d = steer(b, p.x + Math.cos(off) * r0, p.y + Math.sin(off) * r0 - u * 0.012 + bob, u * 0.85, 3.4, u * 0.24, dt);
      if (calm && (d < u * 0.012 || (d < u * 0.04 && b.t > 2.5))) {
        // grip point must be valid from the very first 'work' frame (a stale 0,0 drew a long black leg)
        b.gx = p.x;
        b.gy = p.y - u * 0.008;
        b.phase = 'work';
        b.t = 0;
        b.land = 0.14;
        b.vx = 0; b.vy = 0;
        scene.grab(b.si);
        sfx.grip();
      }
    } else if (b.phase === 'work') {
      // the bee stands on the screw head, legs gripping it, strains, then rides the screw out ("pặc")
      const p = scene.screwScreen(b.si);
      const off = outward(p);
      const popped = b.carry >= 0;
      const k = Math.min(1, b.t / STRAIN);
      const tr = popped ? 0 : Math.sin(time * 40 + b.wob) * u * 0.0012 * k;
      // perched above the head so its legs show, reaching down to grip the rim
      const up = u * (0.05 + (popped ? 0 : 0.006 * k));
      b.gx = p.x;
      b.gy = p.y - u * 0.008;
      b.x = p.x + Math.cos(off) * up * 0.35 + tr;
      b.y = p.y + Math.sin(off) * up * 0.35 - up + tr * 0.5;
      // keep facing the way it flew in (a screw straight below would flip it every frame)
      const face = Math.cos(b.dir) >= 0 ? 1 : -1;
      b.lean = popped ? 0 : -0.25 * k * face;
      b.strain = !popped && k > 0.75 ? k : 0;
      if (!popped && b.t >= STRAIN) {
        // out it comes: the bee keeps hold and rides it to the end of the shaft
        b.carry = spec.screws[b.si].color;
        removeScrew(b.si);
        slots[b.slot].bees--;
        b.strain = 0;
      }
      if (popped && b.t >= STRAIN + POP_RIDE) {
        scene.hideScrew(b.si);
        b.phase = 'home';
        b.t = 0;
        b.land = 0.12;
        b.vx = Math.cos(off) * u * 0.25;
        b.vy = Math.sin(off) * u * 0.25 - u * 0.15;
      }
    } else if (b.phase === 'home') {
      // slows down well before the hive door
      const d = steer(b, hx0, hy0, u * 0.78, 2.2 + Math.min(2, b.t * 2), u * 0.36, dt);
      if (d < u * 0.025) {
        b.t = -1; // gone
        homePunch = 1;
        countPop = 1;
        sfx.home();
        spawn('star', hx0 + (Math.random() - 0.5) * u * 0.06, hy0, { vy: -u * 0.15, vx: (Math.random() - 0.5) * u * 0.2, color: '#fff1a0', size: u * 0.013, life: 0.45 });
      }
    } else if (b.phase === 'idle') {
      b.idleT += dt;
      steer(b, b.hx + Math.sin(time * 1.7 + b.wob) * u * 0.02, b.hy + Math.sin(time * 2.3 + b.wob) * u * 0.015, u * 0.6, 3, u * 0.12, dt);
      // look for another visible screw at once, turning or not; give up and go home after a while
      const h = slots[b.slot].hive;
      const si = h && h.n > 0 ? pickScrew(b.color, b.x, b.y) : -1;
      if (si >= 0 && h) {
        board.claimed[si] = true;
        h.n--;
        b.si = si;
        b.phase = 'out';
        b.t = 0;
      } else if ((calm && b.idleT > 1.4) || !h || h.n <= 0) {
        b.phase = 'back';
        b.t = 0;
      }
    } else if (b.phase === 'back') {
      const d = steer(b, slotX(b.slot), L.slotY - L.hiveR * 0.9, u * 0.75, 3.4, u * 0.2, dt);
      if (d < u * 0.02) {
        b.t = -1;
        slots[b.slot].bees--;
        slots[b.slot].pulse = 1;
      }
    }
    // heading and speed stretch from the actual motion
    const sp = Math.hypot(b.vx, b.vy);
    if (b.phase !== 'work' && sp > u * 0.05) b.dir = Math.atan2(b.vy, b.vx);
    b.stretch = b.phase === 'work' ? 1 : 1 + Math.min(0.15, sp / (u * 9));
    if (b.phase !== 'work') b.lean *= Math.pow(0.005, dt);
  }
  bees = bees.filter((b) => b.t >= 0);

  // drill / hammer jobs
  for (const j of jobs) {
    j.t -= dt;
    if (j.t > 0) continue;
    const p = scene.screwScreen(j.si);
    const color = spec.screws[j.si].color;
    removeScrew(j.si);
    if (j.carry) {
      bees.push({
        color, slot: -1, si: -1, phase: 'home', t: 0, x: p.x, y: p.y, vx: 0, vy: -u * 0.6, hx: 0, hy: 0, idleT: 0,
        dir: -Math.PI / 2, wob: Math.random() * 6, stretch: 1, lean: 0, land: 0.12, strain: 0, carry: color, gx: 0, gy: 0,
      });
    }
  }
  jobs = jobs.filter((j) => j.t > 0);

  scene.update(dt, dragging);

  // win
  // busy = a bee on its way to a screw or pulling one, or a booster still drilling
  const working = bees.some((b) => b.phase === 'out' || b.phase === 'work') || jobs.length > 0 || boosterBusy() || flyScrews.length > 0;
  if (board.done() && !working) {
    if (winT < 0) winT = 0;
    winT += dt;
    if (winT > 1.1) win();
    return;
  }

  // stuck → Revive popup: every slot is taken, and nowhere on the toy (any side) is there a free screw of
  // a colour waiting in the slots, and no bee is still busy
  // (screws on the far side count as reachable: the player can turn the toy)
  const full = slots.every((s) => s.hive && s.leave < 0 && s.enter >= 1);
  const canWork = slots.some((s) => s.hive && s.hive.n > 0 && board.freeOf(s.hive.color).length > 0);
  if (full && !working && !canWork) {
    stuckT += dt;
    if (stuckT > 1.2) lose();
  } else stuckT = 0;
}

function win(): void {
  playing = false;
  popup = 'win';
  popupT = 0;
  winReward = REWARD[spec.difficulty];
  save.coins += winReward;
  store();
  sfx.win();
  events.emit('win');
}

function lose(): void {
  playing = false;
  popup = 'lose';
  popupT = 0;
  sfx.lose();
  haptic(40);
}

function retry(): void {
  events.emit('lose', { canRevive: false });
  startLevel(level);
}

async function revive(): Promise<void> {
  const sdk = SDK();
  if (sdk?.ads.enabled) {
    paused = true;
    const ok = await sdk.ads.showRewarded().catch(() => false);
    paused = false;
    if (!ok) return;
  } else if (revived > 0) return;
  revived++;
  if (slots.length < MAX_SLOTS) slots.push(newSlot(true));
  layout();
  popup = null;
  playing = true;
  stuckT = 0;
  sfx.booster();
}

// ------------------------------------------------------------------ draw

/** Damped wobble 0..1 → squash factor around 0. */
const wobble = (p: number): number => p * Math.sin((1 - p) * Math.PI * 3);

function draw(): void {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    layout();
  }
  const g = ctx;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  beePoses = [];
  const jy = jolt > 0 ? Math.sin(jolt * 90) * L.u * 0.004 * (jolt / 0.12) : 0;
  view3d.style.transform = jy ? `translateY(${jy.toFixed(2)}px)` : '';
  scene.render();
  const u = L.u;

  // top HUD: pause, hanging level sign, coins, screw counter, return hive with its bees
  const k = L.k;
  const [px, py] = pauseXY();
  pauseButton(g, px, py, POS.pause.w * k, POS.pause.h * k);
  levelSign(g, X(POS.level.x), YT(POS.level.y), POS.level.w * k, POS.level.h * k, [X(POS.level.ropes[0]), X(POS.level.ropes[1])], `LEVEL ${level + 1}`, wobble(badgePunch));
  coinDisplay(g, POS.coin, k, L.ox, L.top, save.coins);
  const ct = POS.counter;
  screwCounter(g, X(ct.x0), X(ct.x1), YT(ct.y), ct.h * k, X(ct.icon.x), YT(ct.icon.y), ct.icon.s * k, X(ct.textX), `${board.removed}/${spec.screws.length}`, wobble(countPop));
  returnHive(g, X(POS.hive.x), YT(POS.hive.y), POS.hive.w * k, POS.hive.h * k, wobble(homePunch));

  // slots and hives in them
  slots.forEach((s, i) => { if (s.appear > 0) slotRing(g, slotX(i), L.slotY, L.slotR * easeBack(s.appear), s.extra); });
  slots.forEach((s, i) => {
    if (!s.hive || magnetFx?.hive === s.hive) return;
    const tx = slotX(i);
    let x = tx;
    let y = L.slotY;
    let scale = 1;
    let sxq = 1;
    let syq = 1;
    let glow = 0;
    if (s.enter < 1) {
      const k = s.enter;
      const e = 1 - (1 - k) * (1 - k);
      x = s.fromX + (tx - s.fromX) * e;
      y = s.fromY + (L.slotY - s.fromY) * e - Math.sin(k * Math.PI) * u * 0.1;
      syq = 1 + 0.15 * Math.sin(k * Math.PI);
      sxq = 1 / Math.sqrt(syq);
    }
    const q = wobble(s.pulse);
    sxq *= 1 + 0.12 * q;
    syq *= 1 - 0.14 * q;
    if (armed === 'magnet' && s.hive.n > 0) { sxq *= 1 + 0.05 * Math.sin(time * 14 + i); syq *= 1 - 0.05 * Math.sin(time * 14 + i); }
    if (s.leave >= 0) {
      const k = s.leave;
      if (k < 0.32) {
        // pump up: squash, swell and glow
        const f = k / 0.32;
        scale = 1 + 0.25 * f;
        syq *= 1 - 0.12 * Math.sin(f * Math.PI * 2);
        glow = f;
      } else {
        // whoosh up to the level plank, spinning smaller
        const f = (k - 0.32) / 0.68;
        const e = f * f;
        const [bx, by] = homeXY();
        x = tx + (bx - tx) * e + Math.sin(f * Math.PI) * u * 0.12;
        y = L.slotY + (by - L.slotY) * e - Math.sin(f * Math.PI) * u * 0.08;
        scale = Math.max(0, 1.25 * (1 - f * 0.85));
        glow = 1 - f;
      }
    }
    // about to be stuck: the hives shiver before the Revive popup
    if (stuckT > 0.3) x += Math.sin(time * 42 + i) * u * 0.007;
    hiveToken(g, x, y, L.tokenW, s.hive.color, s.hive.n > 0 ? s.hive.n : null, { scale, sx: sxq, sy: syq, glow });
    if (s.hive.n <= 0 && s.leave < 0.32) check(g, x, y + L.slotR * 0.05, L.hiveR * 0.5 * scale);
    // a guard bee buzzes on top while the hive still has work
    if (s.enter >= 1 && s.leave < 0 && s.hive.n > 0) {
      const waitingHere = s.wait > 0.9;
      if (s.guard > 0) {
        const [gx0, gy0, gdir] = guardPose(i);
        beePoses.push({ id: s.guardId, x: gx0 + (x - tx), y: gy0 + (y - L.slotY), s: u * 0.048, color: s.hive.color, flap: time * 46 + i, dir: gdir, scale: easeBack(s.guard) });
      }
      if (waitingHere) text(g, '?', x + u * 0.04, y - L.tokenW * 0.8 + Math.sin(time * 6) * u * 0.006, u * 0.045, '#fff', '#3a4b7a');
    }
  });

  // waiting hives
  columns.forEach((col, c) => {
    const x = colX(c) + (shake > 0 && shakeCol === c ? Math.sin(time * 60) * u * 0.01 : 0);
    const rows = POS.grid.rows;
    for (let r = Math.min(col.length, rows) - 1; r >= 0; r--) {
      const tp = tokenPos(col[r], c, r);
      let breathe = r === 0 ? 1 + 0.02 * Math.sin(time * 3 + c) : 1;
      if (armed === 'magnet') breathe = 1 + 0.05 * Math.sin(time * 14 + c * 1.7 + r * 2.3);
      hiveToken(g, tp.x + (x - colX(c)), tp.y, L.tokenW, col[r].color, col[r].n, { sx: 2 - breathe, sy: breathe, scale: tp.scale, glow: tp.flash });
    }
    if (col.length > rows) text(g, `+${col.length - rows}`, x + L.tokenW * 0.42, rowY(rows - 1) + L.tokenW * 0.4, u * 0.032, '#fff', '#4b5a75');
  });

  // booster bar
  toolbar(g, w, L.barTop, L.barH + 4, POS.bar.r * k);
  BOOSTERS.forEach((b, i) => {
    const locked = level + 1 < b.unlock ? b.unlock : 0;
    const pr = boosterPress[i] > 0 ? 1 - 0.18 * Math.sin(boosterPress[i] * Math.PI) : 1;
    g.save();
    g.translate(boosterX(i), boosterY());
    g.scale(pr, pr);
    boosterButton(g, 0, 0, L.boosterR, b.icon, { locked, count: save.boosters[b.key], armed: armed === b.key, t: time });
    g.restore();
  });

  drawHint(g);

  // bees
  for (const b of bees) {
    let scale = 1;
    if (b.phase === 'out' && b.t < 0.14 && b.si >= 0 && b.carry < 0 && b.idleT === 0) {
      // pop out of the hive with a little overshoot
      const k = b.t / 0.14;
      scale = Math.max(0, 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2));
    }
    if (b.phase === 'home') {
      const [hx, hy] = homeXY();
      scale = Math.min(1, Math.hypot(b.x - hx, b.y - hy) / (u * 0.08) + 0.25);
    }
    if (b.phase === 'back') scale = Math.min(1, Math.hypot(b.x - slotX(b.slot), b.y - L.slotY) / (u * 0.1) + 0.3);
    const land = b.land > 0 ? Math.sin((b.land / 0.14) * Math.PI) : 0;
    beePoses.push({
      id: beeId(b), x: b.x, y: b.y, s: u * 0.062, color: b.color,
      flap: time * (b.phase === 'work' ? 70 : 48) + b.wob, dir: b.dir, stretch: b.stretch * (1 - 0.2 * land),
      lean: b.lean, carry: b.phase === 'home' ? b.carry : -1, sway: Math.sin(time * 5 + b.wob), scale: Math.max(0, scale),
      grip: b.phase === 'work' ? [b.gx - b.x, b.gy - b.y] : null,
      strain: b.strain,
    });
  }
  drawParticles(g);

  drawBoosterFx(g);
  if (armed === 'magnet') {
    const top = L.slotY - L.slotR * 1.45;
    const rows = Math.min(POS.grid.rows, Math.max(1, ...columns.map((c) => c.length)));
    spotlight(g, [u * 0.02 + L.ox, top, L.u - u * 0.04, rowY(rows - 1) + L.tokenW * 0.62 - top]);
    if (!coachQ.length) bubble(g, 'Pick a hive to fill it at once', L.cx, top - u * 0.05);
  } else if (armed === 'hammer') {
    spotlight(g, [u * 0.02 + L.ox, L.topH, L.u - u * 0.04, L.viewBottom + u * 0.06 - L.topH]);
    if (!coachQ.length) bubble(g, 'Turn the toy, tap a block to smash it', L.cx, L.viewBottom + u * 0.11);
  }

  drawCoach(g);
  if (banner) drawBanner(g, banner);
  if (toastT > 0 && !armed) {
    g.globalAlpha = Math.min(1, toastT * 3);
    bubble(g, toastMsg, L.cx, L.topH + u * 0.13);
    g.globalAlpha = 1;
  }
  if (popup) drawPopup(g);
  if (import.meta.env.DEV && beeDemo) {
    // test row of bees: right, left, climbing, diving, and one turning back and forth
    [0, Math.PI, -0.7, Math.PI + 0.7, 0.8].forEach((dir, i) => beePoses.push({ id: 9e5 + i, x: L.w * (0.14 + i * 0.18), y: L.h * 0.5, s: L.u * 0.12, color: [2, 5, 0, 7, 3][i], flap: time * 40, dir }));
    beePoses.push({ id: 9e5 + 9, x: L.w * 0.5, y: L.h * 0.62, s: L.u * 0.16, color: 2, flap: time * 40, dir: Math.sin(time * 1.2) > 0 ? 0 : Math.PI });
  }
  beeLayer.sync(beePoses, frameDt);
  beeLayer.render(!popup);
}

/** Red ribbon sweeping across: "Hard Level!" / "Super Hard!". */
function drawBanner(g: CanvasRenderingContext2D, b: { text: string; t: number }): void {
  const u = L.u;
  const t = b.t;
  const inK = Math.min(1, t / 0.3);
  const outK = Math.max(0, (t - 1.55) / 0.35);
  const slide = (1 - easeBack(inK)) * -L.w + outK * outK * L.w;
  g.fillStyle = `rgba(20,10,30,${0.4 * Math.min(inK, 1 - outK)})`;
  g.fillRect(0, 0, L.w, L.h);
  const y = L.h * 0.42;
  const h = u * 0.16;
  g.save();
  g.translate(slide, 0);
  const grad = g.createLinearGradient(0, y - h / 2, 0, y + h / 2);
  grad.addColorStop(0, '#ff7a6a');
  grad.addColorStop(1, '#c4102e');
  g.fillStyle = '#6a0816';
  g.fillRect(0, y - h / 2 + h * 0.1, L.w, h);
  g.fillStyle = grad;
  g.fillRect(0, y - h / 2, L.w, h);
  g.fillStyle = 'rgba(255,255,255,0.25)';
  g.fillRect(0, y - h / 2 + h * 0.08, L.w, h * 0.12);
  const pulse = 1 + 0.06 * Math.sin(t * 10);
  text(g, b.text, L.cx, y, h * 0.62 * pulse, '#fff36b', '#6a0816');
  g.restore();
}

function drawParticles(g: CanvasRenderingContext2D): void {
  for (const p of particles) {
    const k = p.t / p.life;
    const a = Math.max(0, 1 - k);
    g.globalAlpha = a;
    g.fillStyle = p.color;
    g.strokeStyle = p.color;
    if (p.kind === 'ring') {
      g.lineWidth = Math.max(0.5, p.size * 0.25 * a);
      g.beginPath();
      g.arc(p.x, p.y, Math.max(0, p.size * (0.2 + k)), 0, Math.PI * 2);
      g.stroke();
    } else if (p.kind === 'star') {
      star(g, p.x, p.y, p.size * (k < 0.2 ? k / 0.2 : 1), p.rot);
    } else if (p.kind === 'puff') {
      g.beginPath();
      g.arc(p.x, p.y, Math.max(0, p.size * (0.6 + k * 0.8)), 0, Math.PI * 2);
      g.fill();
    } else if (p.kind === 'drop') {
      // honey drop: stretched along its fall
      const ang = Math.atan2(p.vy, p.vx);
      g.save();
      g.translate(p.x, p.y);
      g.rotate(ang);
      g.beginPath();
      g.ellipse(0, 0, p.size * 1.6, p.size, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    } else if (p.kind === 'chip') {
      // wood / metal splinter tumbling away
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.rot);
      g.fillRect(-p.size, -p.size * 0.55, p.size * 2, p.size * 1.1);
      g.restore();
    } else if (p.kind === 'screw') {
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.rot);
      screwHead(g, 0, 0, p.size, Number(p.label ?? 0));
      g.restore();
    } else if (p.kind === 'text') {
      const pop = k < 0.15 ? 0.5 + (k / 0.15) * 0.7 : k < 0.25 ? 1.2 - (k - 0.15) * 2 : 1;
      text(g, p.label ?? '', p.x, p.y, p.size * pop, p.color, '#8a4a00');
    } else {
      g.beginPath();
      g.arc(p.x, p.y, Math.max(0, p.size), 0, Math.PI * 2);
      g.fill();
    }
  }
  g.globalAlpha = 1;
}

/** Arrow at the edge of the toy toward a hidden screw a waiting hive wants. */
function drawHint(g: CanvasRenderingContext2D): void {
  if (!hint || hint.t < 0.2 || armed) return;
  const u = L.u;
  const p = scene.screwScreen(hint.si);
  let dx = p.nx;
  let dy = -p.ny;
  const len = Math.hypot(dx, dy);
  if (len < 0.15) { dx = 1; dy = 0; } else { dx /= len; dy /= len; }
  const cx = L.cx;
  const cy = (L.viewTop + L.viewBottom) / 2;
  const R = Math.min(L.viewSize * 0.44, L.w * 0.42);
  const bob = Math.sin(time * 6) * u * 0.015;
  const ax = cx + dx * (R + bob);
  const ay = cy + dy * (R + bob);
  const a = Math.min(1, hint.t * 3);
  g.globalAlpha = a;
  // badge with the screw colour
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.arc(ax, ay, u * 0.045, 0, Math.PI * 2);
  g.fill();
  screwHead(g, ax, ay, u * 0.032, hint.color);
  // curved swipe arrow from the badge toward the centre
  const ex = ax - dx * u * 0.17;
  const ey = ay - dy * u * 0.17;
  const nx = -dy;
  const ny = dx;
  g.strokeStyle = '#ffffff';
  g.lineCap = 'round';
  g.lineWidth = u * 0.018;
  g.beginPath();
  g.moveTo(ax - dx * u * 0.055, ay - dy * u * 0.055);
  g.quadraticCurveTo((ax + ex) / 2 + nx * u * 0.04, (ay + ey) / 2 + ny * u * 0.04, ex, ey);
  g.stroke();
  const ang = Math.atan2(ey - ((ay + ey) / 2 + ny * u * 0.04), ex - ((ax + ex) / 2 + nx * u * 0.04));
  g.fillStyle = '#ffffff';
  g.beginPath();
  g.moveTo(ex + Math.cos(ang) * u * 0.03, ey + Math.sin(ang) * u * 0.03);
  g.lineTo(ex + Math.cos(ang + 2.4) * u * 0.03, ey + Math.sin(ang + 2.4) * u * 0.03);
  g.lineTo(ex + Math.cos(ang - 2.4) * u * 0.03, ey + Math.sin(ang - 2.4) * u * 0.03);
  g.fill();
  g.globalAlpha = 1;
}

/** White tick on a hive that has sent all its bees. */
function check(g: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  if (s <= 0.5) return;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (const [col, lw] of [['rgba(30,20,40,0.8)', 0.5], ['#fff', 0.28]] as const) {
    g.strokeStyle = col;
    g.lineWidth = s * lw;
    g.beginPath();
    g.moveTo(x - s * 0.55, y);
    g.lineTo(x - s * 0.12, y + s * 0.45);
    g.lineTo(x + s * 0.6, y - s * 0.45);
    g.stroke();
  }
}

function bubble(g: CanvasRenderingContext2D, msg: string, x: number, y: number): void {
  const u = L.u;
  g.font = `${Math.round(u * 0.04)}px ${FONT}`;
  const tw = g.measureText(msg).width + u * 0.08;
  g.fillStyle = 'rgba(40,46,90,0.86)';
  rr(g, x - tw / 2, y - u * 0.04, tw, u * 0.08, u * 0.04);
  g.fill();
  text(g, msg, x, y, u * 0.04, '#fff', '');
}

// ------------------------------------------------------------------ tutorial
//
// A queue of short lessons, each shown once ever (ids saved in save.seen): a speech bubble, a hand that
// taps a target or swipes the toy, and what ends it ('time', or a game event like 'hiveTapped').

interface Step {
  id: string;
  text: string;
  until: string;
  t: number;
  max: number;
  at?: () => [number, number] | null;
  swipe?: boolean;
}
let coachQ: Step[] = [];

function teach(id: string, text: string, until: string, o: { max?: number; at?: () => [number, number] | null; swipe?: boolean; first?: boolean } = {}): void {
  if (save.seen.includes(id) || coachQ.some((s) => s.id === id)) return;
  const step = { id, text, until, t: 0, max: o.max ?? (until === 'time' ? 3 : 15), at: o.at, swipe: o.swipe };
  // `first`: jumps the queue (a lesson the player just asked for, like a new booster)
  if (o.first) coachQ.unshift(step); else coachQ.push(step);
}

function finishStep(): void {
  const s = coachQ.shift();
  if (!s) return;
  save.seen.push(s.id);
  store();
}

function coachEvent(name: string): void {
  if (coachQ[0]?.until === name) finishStep();
}

function coachUpdate(dt: number): void {
  const s = coachQ[0];
  if (!s || popup || banner) return;
  s.t += dt;
  if (s.t >= s.max) finishStep();
}

/** Screen position of the first metal plate still on the toy. */
function platePos(): [number, number] | null {
  const p = spec.pieces.findIndex((q, i) => q.kind === 'plate' && board.alive[i]);
  if (p < 0) return null;
  const q = scene.pieceScreen(p);
  return [q.x, q.y];
}

function drawCoach(g: CanvasRenderingContext2D): void {
  const s = coachQ[0];
  if (!s || popup || banner) return;
  const u = L.u;
  g.globalAlpha = Math.min(1, s.t * 4);
  let by = L.slotY - u * 0.13;
  if (s.swipe) {
    // swipe from the side the hidden screw is on, toward the middle
    let dx = 1;
    let dy = 0;
    if (hint) {
      const p = scene.screwScreen(hint.si);
      const len = Math.hypot(p.nx, p.ny);
      if (len > 0.15) { dx = p.nx / len; dy = -p.ny / len; }
    }
    const k = (time * 0.8) % 1;
    const cy = (L.viewTop + L.viewBottom) / 2;
    const R = L.viewSize * 0.3;
    hand(g, L.cx + dx * R * (1 - 1.6 * k), cy + dy * R * (1 - 1.6 * k) + u * 0.04, u * 0.11);
    by = L.viewBottom + u * 0.015;
  } else {
    const at = s.at?.() ?? null;
    if (at) {
      const bob = Math.sin(time * 6) * u * 0.015;
      hand(g, at[0] + u * 0.015, at[1] + u * 0.025 + bob, u * 0.11);
      // above the slot row when pointing at the hives / boosters, under the target otherwise
      by = at[1] > L.slotY + L.slotR ? L.slotY - L.slotR - u * 0.06 : at[1] > L.h * 0.55 ? at[1] - u * 0.13 : at[1] + u * 0.2;
    }
  }
  bubble(g, s.text, L.cx, Math.max(L.topH + u * 0.05, Math.min(L.h - u * 0.05, by)));
  g.globalAlpha = 1;
}

// ------------------------------------------------------------------ booster drawing

const easeBack = (k: number): number => Math.max(0, 1 + 2.4 * Math.pow(k - 1, 3) + 1.4 * Math.pow(k - 1, 2));

/** Dim everything but `hole` (screen rect): the Magnet / Hammer pick mode. */
function spotlight(g: CanvasRenderingContext2D, hole: [number, number, number, number]): void {
  // one path: the screen, then the rounded hole drawn the other way round (rr() would restart the path)
  const [hx, hy, hw, hh] = hole;
  const r = L.u * 0.04;
  g.fillStyle = 'rgba(14,22,48,0.55)';
  g.beginPath();
  g.rect(0, 0, L.w, L.h);
  g.moveTo(hx + r, hy);
  g.arcTo(hx, hy, hx, hy + hh, r);
  g.arcTo(hx, hy + hh, hx + hw, hy + hh, r);
  g.arcTo(hx + hw, hy + hh, hx + hw, hy, r);
  g.arcTo(hx + hw, hy, hx, hy, r);
  g.closePath();
  g.fill('evenodd');
  g.strokeStyle = `rgba(255,236,140,${0.55 + 0.35 * Math.sin(time * 6)})`;
  g.lineWidth = L.u * 0.008;
  rr(g, hole[0], hole[1], hole[2], hole[3], L.u * 0.04);
  g.stroke();
}

function drawBoosterFx(g: CanvasRenderingContext2D): void {
  const u = L.u;
  // Drill: a drill drops onto the new slot spot, drills with sparks, then lifts away
  if (drillFx) {
    const d = drillFx;
    const x = slotX(d.slot);
    const drop = Math.min(1, d.t / 0.15);
    const lift = Math.max(0, (d.t - 0.8) / 0.35);
    const y = L.slotY - L.slotR * 0.75 - (1 - drop) * u * 0.25 - lift * u * 0.2 + Math.sin(time * 90) * u * 0.004 * (d.t < 0.75 ? 1 : 0);
    g.save();
    g.globalAlpha = 1 - lift;
    g.translate(x + Math.sin(time * 70) * u * 0.003, y);
    g.rotate(-Math.PI / 2 - 0.62);
    boosterIcon(g, 0, 0, u * 0.07, 'drill');
    g.restore();
    g.globalAlpha = 1;
  }
  // Magnet: the picked hive glows under the toy, a magnet on top, screws fly into it
  if (magnetFx) {
    const m = magnetFx;
    const [x, y] = magnetPos(m);
    const pulse = 1 + 0.05 * Math.sin(time * 12);
    g.save();
    g.globalAlpha = Math.min(1, m.t * 3) * 0.35;
    g.strokeStyle = COLORS[m.hive.color].light;
    g.lineWidth = u * 0.01;
    for (let i = -2; i <= 2; i++) {
      g.beginPath();
      g.moveTo(x + i * u * 0.02, y - L.tokenW * 0.6);
      g.lineTo(x + i * u * 0.09, L.viewTop + u * 0.05);
      g.stroke();
    }
    g.restore();
    hiveToken(g, x, y, L.tokenW, m.hive.color, m.hive.n, { scale: 1.15 * pulse, glow: 1 });
    g.save();
    g.translate(x, y - L.tokenW * 0.75 + Math.sin(time * 8) * u * 0.006);
    g.rotate(Math.PI);
    boosterIcon(g, 0, 0, u * 0.05, 'magnet');
    g.restore();
  }
  for (const f of flyScrews) {
    g.globalAlpha = 0.35;
    screwHead(g, f.x - (f.x - f.x0) * 0.08, f.y - (f.y - f.y0) * 0.08, u * 0.012, f.color);
    g.globalAlpha = 1;
    screwHead(g, f.x, f.y, u * 0.016, f.color);
  }
  // Hammer: a target ring, then the hammer swings down on the tap point
  if (hammerFx) {
    const hm = hammerFx;
    const t = hm.t;
    if (t < 0.3) {
      g.strokeStyle = '#ffffff';
      g.lineWidth = u * 0.006;
      g.beginPath();
      g.arc(hm.x, hm.y, Math.max(0, u * (0.08 - t * 0.15)), 0, Math.PI * 2);
      g.stroke();
    }
    let ang: number;
    if (t < 0.3) ang = -1.5 * (1 - Math.pow(t / 0.3, 2));
    else if (t < 0.45) ang = -0.3 * Math.sin(((t - 0.3) / 0.15) * Math.PI);
    else ang = 0;
    const fade = t > 0.55 ? Math.max(0, 1 - (t - 0.55) / 0.2) : 1;
    const len = u * 0.2;
    const px = hm.x + len * 0.75;
    const py = hm.y + len * 0.6;
    g.save();
    g.globalAlpha = fade;
    g.translate(px, py);
    g.rotate(Math.atan2(hm.y - py, hm.x - px) + ang);
    // handle
    g.fillStyle = '#b8742f';
    rr(g, 0, -u * 0.012, len * 0.95, u * 0.024, u * 0.012);
    g.fill();
    // head across the end of the handle
    const hg = g.createLinearGradient(0, -u * 0.05, 0, u * 0.05);
    hg.addColorStop(0, '#f4f6fa');
    hg.addColorStop(1, '#7f889c');
    g.fillStyle = hg;
    rr(g, len * 0.88, -u * 0.055, u * 0.075, u * 0.11, u * 0.018);
    g.fill();
    g.restore();
    g.globalAlpha = 1;
  }
}

// popup buttons (set while drawing, read by input)
let hits: { x: number; y: number; w: number; h: number; act: () => void }[] = [];

function drawPopup(g: CanvasRenderingContext2D): void {
  hits = [];
  const u = L.u;
  const w = L.w;
  const h = L.h;
  const a = Math.min(1, popupT * 4);
  const pop = Math.max(0, Math.min(1.08, 1 - Math.pow(1 - Math.min(1, popupT * 3.5), 3) * 1.0)) || 0.001;
  g.fillStyle = `rgba(28,34,44,${0.82 * a})`;
  g.fillRect(0, 0, w, h);
  const cx = L.cx;
  const bw = u * 0.42;
  const bh = u * 0.11;
  const addBtn = (x: number, y: number, label: string, kind: 'green' | 'orange' | 'blue', act: () => void): void => {
    button(g, x - bw / 2, y - bh / 2, bw, bh, label, kind);
    hits.push({ x: x - bw / 2, y: y - bh / 2, w: bw, h: bh, act });
  };
  g.save();
  g.translate(cx, h * 0.45);
  g.scale(pop, pop);
  g.translate(-cx, -h * 0.45);
  if (popup === 'win') {
    text(g, 'You Win!', cx, h * 0.25, u * 0.13, '#fff36b', '#7a3d00');
    coinPile(g, cx, h * 0.42, u * 0.22);
    text(g, 'Rewards', cx, h * 0.56, u * 0.04, '#fff', '');
    coin(g, cx - u * 0.07, h * 0.6, u * 0.03);
    text(g, `+${winReward}`, cx + u * 0.03, h * 0.6, u * 0.05, '#fff', '');
    g.restore();
    if (popupT > 0.5) addBtn(cx, h * 0.68, level + 1 < LEVEL_COUNT ? `Level ${level + 2}` : 'Play Again', 'green', () => startLevel(level + 1 < LEVEL_COUNT ? level + 1 : 0));
    return;
  }
  // card
  const cw = Math.min(w - u * 0.08, u * 0.84);
  const ch = u * 0.78;
  const cy = h * 0.45 - ch / 2;
  g.fillStyle = '#2e3a8c';
  rr(g, cx - cw / 2, cy + u * 0.015, cw, ch, u * 0.06);
  g.fill();
  const grad = g.createLinearGradient(0, cy, 0, cy + ch);
  grad.addColorStop(0, '#fffaf0');
  grad.addColorStop(1, '#f3e6c8');
  g.fillStyle = grad;
  rr(g, cx - cw / 2, cy, cw, ch, u * 0.06);
  g.fill();
  // ribbon title
  const title = popup === 'lose' ? 'Out of Slots!' : popup === 'pause' ? 'Settings' : 'New Booster!';
  g.fillStyle = '#d4102e';
  rr(g, cx - cw * 0.42, cy - u * 0.05, cw * 0.84, u * 0.11, u * 0.03);
  g.fill();
  text(g, title, cx, cy + u * 0.005, u * 0.065, '#fff', '#7a0818');
  g.restore();
  if (popup === 'lose') {
    // the stuck hives
    slots.slice(0, 7).forEach((s, i) => {
      if (s.hive) hiveToken(g, cx + (i - (slots.length - 1) / 2) * u * 0.115, cy + u * 0.22, u * 0.1, s.hive.color, s.hive.n);
    });
    text(g, 'No screws left for these bees!', cx, cy + u * 0.34, u * 0.042, '#5a4630', '');
    text(g, 'Add one more slot to keep going?', cx, cy + u * 0.4, u * 0.042, '#5a4630', '');
    const ads = !!SDK()?.ads.enabled;
    const canRevive = (ads || revived === 0) && slots.length < MAX_SLOTS;
    if (canRevive) addBtn(cx, cy + u * 0.53, ads ? '▶ +1 Slot' : '+1 Slot', 'green', () => void revive());
    addBtn(cx, cy + u * (canRevive ? 0.67 : 0.55), 'Play Again', 'orange', retry);
  } else if (popup === 'pause') {
    const row = (y: number, label: string, key: 'sound' | 'haptic'): void => {
      text(g, label, cx - cw * 0.3, y, u * 0.05, '#4a3a2a', '', 'left');
      const on = audio.get(key);
      const tx = cx + cw * 0.2;
      g.fillStyle = on ? '#3cc248' : '#b9b2a6';
      rr(g, tx, y - u * 0.03, u * 0.12, u * 0.06, u * 0.03);
      g.fill();
      g.fillStyle = '#fff';
      g.beginPath();
      g.arc(on ? tx + u * 0.09 : tx + u * 0.03, y, u * 0.024, 0, Math.PI * 2);
      g.fill();
      hits.push({ x: tx - u * 0.02, y: y - u * 0.05, w: u * 0.16, h: u * 0.1, act: () => { audio.set(key, !on); sfx.click(); } });
    };
    row(cy + u * 0.17, 'Sound', 'sound');
    row(cy + u * 0.27, 'Vibration', 'haptic');
    addBtn(cx, cy + u * 0.43, 'Resume', 'green', () => { popup = null; });
    addBtn(cx, cy + u * 0.57, 'Restart', 'orange', retry);
  } else if (popup === 'intro' && introKey) {
    const b = BOOSTERS.find((x) => x.key === introKey)!;
    g.fillStyle = '#3c3f8c';
    g.beginPath();
    g.arc(cx, cy + u * 0.25, u * 0.11, 0, Math.PI * 2);
    g.fill();
    boosterIcon(g, cx, cy + u * 0.25, u * 0.08, b.icon);
    text(g, b.title, cx, cy + u * 0.43, u * 0.06, '#d4102e', '');
    text(g, b.desc, cx, cy + u * 0.51, u * 0.04, '#5a4630', '');
    addBtn(cx, cy + u * 0.64, 'Got it!', 'green', () => {
      save.seen.push(`b_${b.key}`);
      if (save.boosters[b.key] < 1) save.boosters[b.key] = 1;
      store();
      popup = null;
      introKey = null;
      const bi = BOOSTERS.indexOf(b);
      teach(`t_b_${b.key}`, `Tap the ${b.title} to use it!`, `booster:${b.key}`, { at: () => [boosterX(bi), boosterY()], max: 10, first: true });
    });
  }
}

// ------------------------------------------------------------------ input

let dragging = false;
let downX = 0;
let downY = 0;
let lastX = 0;
let lastY = 0;
let lastT = 0;
let moved = 0;
/** the press started on a popup: its release must not reach the board */
let downOnPopup = false;

function local(e: PointerEvent): [number, number] {
  const r = canvas.getBoundingClientRect();
  return [e.clientX - r.left, e.clientY - r.top];
}

canvas.addEventListener('pointerdown', (e) => {
  unlockAudio();
  const [x, y] = local(e);
  downX = lastX = x;
  downY = lastY = y;
  lastT = performance.now();
  moved = 0;
  downOnPopup = !!popup;
  if (popup) {
    for (const b of hits) if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) { sfx.click(); b.act(); return; }
    return;
  }
  if (!playing || paused) return;
  dragging = y > L.topH && y < L.slotY - L.slotR * 1.3 && armed !== 'magnet' && !shuffleFx;
  if (dragging) { scene.vel.set(0, 0); canvas.setPointerCapture(e.pointerId); }
});

canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const [x, y] = local(e);
  const now = performance.now();
  const dx = x - lastX;
  const dy = y - lastY;
  moved += Math.abs(dx) + Math.abs(dy);
  scene.rotate(dx, dy);
  const dtm = Math.max(1, now - lastT) / 1000;
  scene.vel.set(dx / dtm * 0.6, dy / dtm * 0.6);
  lastX = x; lastY = y; lastT = now;
  if (moved > 60) coachEvent('rotated');
});

canvas.addEventListener('pointerup', (e) => {
  const [x, y] = local(e);
  const wasDrag = dragging;
  dragging = false;
  if (downOnPopup) { downOnPopup = false; return; }
  if (popup || !playing || paused) return;
  if (wasDrag && moved > 8) return;
  if (performance.now() - lastT > 100) scene.vel.set(0, 0);
  // pause
  const [px, py] = pauseXY();
  if (Math.hypot(x - px, y - py) < L.u * 0.07) { popup = 'pause'; popupT = 0; sfx.click(); return; }
  // boosters
  for (let i = 0; i < BOOSTERS.length; i++) {
    if (Math.hypot(x - boosterX(i), y - boosterY()) < L.boosterR * 1.1) { useBooster(BOOSTERS[i].key); return; }
  }
  if (armed === 'hammer') {
    if (y > L.topH && y < L.slotY - L.slotR * 1.3) applyArmed(x, y);
    else armed = null;
    return;
  }
  if (armed === 'magnet') { applyArmed(x, y); return; }
  // hives
  for (let c = 0; c < columns.length; c++) {
    if (Math.abs(x - colX(c)) < L.colGap / 2 && Math.abs(y - rowY(0)) < L.hiveR * 1.25) { tapColumn(c); return; }
  }
});

window.addEventListener('keydown', (e) => {
  if (popup || !playing) return;
  const n = Number(e.key);
  if (n >= 1 && n <= columns.length) tapColumn(n - 1);
  if (e.key === 'ArrowLeft') scene.rotate(-40, 0);
  if (e.key === 'ArrowRight') scene.rotate(40, 0);
  if (e.key === 'ArrowUp') scene.rotate(0, -40);
  if (e.key === 'ArrowDown') scene.rotate(0, 40);
});

// ------------------------------------------------------------------ loop

let last = performance.now();
function frame(now: number): void {
  requestAnimationFrame(frame);
  // rAF stamps can run behind performance.now(): never let time go backwards
  const dt = Math.max(0, Math.min(0.05, (now - last) / 1000));
  last = Math.max(last, now);
  if (canvas.clientWidth < 1 || canvas.clientHeight < 1 || !spec) return;
  try {
    frameDt = dt;
    update(dt);
    draw();
    if (playing && !paused && !popup) {
      try { SDK()?.analytics.turn.tick(dt); } catch { /* analytics off */ }
    }
  } catch (err) {
    console.error('draw failed', err);
    ctx.reset?.();
  }
}
requestAnimationFrame(frame);
window.addEventListener('resize', () => { if (spec) layout(); });

// DEV hooks for headless testing
if (import.meta.env.DEV) {
  (window as unknown as Record<string, unknown>).__bee = {
    dbg: () => ({ L, colShift, rows: columns.map((c) => c.length) }),
    bees: () => bees.map((b) => `${b.phase}:s${b.slot}:si${b.si}:t${b.t.toFixed(1)}:d${b.si >= 0 ? Math.round(Math.hypot(scene.screwScreen(b.si).x - b.x, scene.screwScreen(b.si).y - b.y)) : -1}:v${b.si >= 0 ? +scene.visible(b.si, board.alive) : -1}`),
    slotInfo: () => slots.map((s) => s.hive && { n: s.hive.n, bees: s.bees, enter: s.enter, leave: s.leave, cool: +s.cool.toFixed(2) }),
    info: () => ({ hint: hint && { ...hint }, waits: slots.map((s) => +s.wait.toFixed(2)), level, removed: board.removed, total: spec.screws.length, popup, slots: slots.map((s) => s.hive && `${s.hive.color}:${s.hive.n}`), columns: columns.map((c) => c.map((h) => `${h.color}:${h.n}`)) }),
    tap: tapColumn,
    screwXY: (i: number) => scene.screwScreen(i),
    firstScrew: () => board.screwAlive.findIndex((a, i) => a && board.isFree(i) && scene.screwScreen(i).facing > 0.5),
    /** greedy auto-play: tap the column whose hive can work most */
    auto: () => {
      let best = -1;
      let score = -1;
      columns.forEach((c, i) => {
        if (!c[0]) return;
        const f = board.freeOf(c[0].color).length;
        if (f > score) { score = f; best = i; }
      });
      if (best >= 0) tapColumn(best);
    },
    booster: useBooster,
    demo: (on: boolean) => { beeDemo = on; },
    /** replace the save and restart the level (headless tests can't reload the page) */
    setSave: (o: Partial<Save>, lv?: number) => { Object.assign(save, o); store(); popup = null; startLevel(lv ?? level); },
    /** free screws vs. the ones bees can see right now */
    sight: () => { const f = spec.screws.map((_, i) => i).filter((i) => board.canTake(i)); return { free: f.length, seen: f.filter((i) => scene.visible(i, board.alive)).length }; },
    turn: (dx: number, dy: number) => scene.rotate(dx, dy),
    /** follow the hint arrow like a player would */
    followHint: () => { if (hint) scene.face(hint.si); return !!hint; },
    /** a bad player: tap the column whose hive can do the least right now */
    worst: () => {
      let best = -1;
      let score = 1e9;
      columns.forEach((c, i) => {
        if (!c[0]) return;
        const f = board.freeOf(c[0].color).length;
        if (f < score) { score = f; best = i; }
      });
      if (best >= 0) tapColumn(best);
    },
    /** fill empty slots with waiting hives whose colour has no free screw anywhere (a real jam) */
    jam: () => {
      let placed = 0;
      for (const sl of slots) {
        if (sl.hive) continue;
        for (const col of columns) {
          const k = col.findIndex((h) => board.freeOf(h.color).length === 0);
          if (k < 0) continue;
          const [h] = col.splice(k, 1);
          Object.assign(sl, { hive: h, enter: 1, leave: -1, bees: 0, wait: 0, cool: 0 });
          placed++;
          break;
        }
      }
      return placed;
    },
    pick: (x: number, y: number) => applyArmed(x, y),
  };
}

/** What the studio layer attaches to. See falcon-game.ts for every member. */
export const game: FalconGame = {
  getLevelCount: () => LEVEL_COUNT,
  startLevel,
  on: events.on,
  pause: () => { paused = true; },
  resume: () => { paused = false; },
  getProgress: () => (spec ? Math.round((board.removed / spec.screws.length) * 100) : 0),
  audio: { set: audio.set, get: audio.get },
};

