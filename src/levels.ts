// Level generation: model → pieces → plates → screws → colours → hives. Deterministic from the seed.
// Every level is checked: all screws can come out, and a careful player (greedy bot) clears it with the
// slot count. `scripts/tune.ts` picks the seeds so a careless bot wins at the right rate per difficulty.

import { MODELS, PAINT } from './models.ts';
import { TUNED } from './tuned.ts';
import {
  Board, DIRS, blockCells, faceKey, greedyPolicy, mulberry, playBot, solvable,
  type BlockSpec, type HiveSpec, type LevelSpec, type PieceSpec, type PlateSpec, type ScrewSpec, type V3,
} from './sim.ts';

/** Screw / hive / bee colours. */
export const COLORS = [
  { name: 'red', base: '#f52d27', light: '#ff8a80', dark: '#a8120d', ink: '#5e0805' },
  { name: 'orange', base: '#ff8a2a', light: '#ffc27a', dark: '#c4560a', ink: '#6b2a02' },
  { name: 'yellow', base: '#ffd500', light: '#fff27a', dark: '#c79a00', ink: '#6b4a00' },
  { name: 'green', base: '#28d938', light: '#9cf590', dark: '#13901f', ink: '#08470d' },
  { name: 'cyan', base: '#12d9ec', light: '#8ff4ff', dark: '#0598aa', ink: '#03465a' },
  { name: 'blue', base: '#1f62f0', light: '#7aa6ff', dark: '#0d36a6', ink: '#061a5c' },
  { name: 'pink', base: '#f863c8', light: '#ffb6e8', dark: '#b42d8a', ink: '#5c0c44' },
  { name: 'white', base: '#f3f4f7', light: '#ffffff', dark: '#b7bcc6', ink: '#1d1d24' },
  { name: 'brown', base: '#9b511f', light: '#cf8a52', dark: '#5f2c0c', ink: '#2e1404' },
  { name: 'purple', base: '#9a4fe0', light: '#cf9bff', dark: '#5f22a0', ink: '#2f0c55' },
];

export interface LevelDef {
  model: keyof typeof MODELS;
  name: string;
  colors: number;
  /** chance an open block face gets a screw */
  density: number;
  plates: number;
  diff: LevelSpec['difficulty'];
  /** spread of the hive order around the natural removal order (0 = in order) */
  mix: number;
  /** overrides the difficulty's colour scatter */
  scatter?: number;
  hives?: number;
  /** plates placed by hand before the random ones: cells (all on face `dir`), screws on every corner cell */
  fixedPlates?: { cells: V3[]; dir: number }[];
  /** chance factor for screws on the front (+z) faces: low = plain wooden fronts, screws on the edges */
  front?: number;
  /** chance factor for screws on hidden faces */
  /** extra layers of blocks added behind the model (thicker toy, more hidden screws) */
  deep?: number;
  /** hard levels: share of the hive order that runs smoothly before the tense finish */
  late?: number;
  inner?: number;
  seed: number;
}

// Seeds come from `node scripts/tune.ts --write`.
export const LEVELS: LevelDef[] = [
  { model: 'box222', name: 'Little Crate', colors: 3, density: 0.75, plates: 0, diff: 'easy', mix: 0, seed: 1 },
  { model: 'box322', name: 'Toy Box', colors: 4, density: 0.7, plates: 1, diff: 'easy', mix: 0.05, seed: 1 },
  { model: 'ref3', name: 'Wood Cube', colors: 8, density: 0.62, front: 0.1, plates: 1, diff: 'normal', mix: 0.15, seed: 9,
    fixedPlates: [
      { cells: [[2, 2, 2], [3, 2, 2], [2, 3, 2], [3, 3, 2]], dir: 4 },
      { cells: [[1, 3, 2], [1, 4, 2]], dir: 4 },
      { cells: [[4, 3, 2], [4, 4, 2]], dir: 4 },
    ] },
  { model: 'duck', name: 'Duck', colors: 7, density: 0.6, plates: 0, diff: 'normal', mix: 0.15, seed: 2 },
  { model: 'box423', name: 'Long Crate', colors: 5, density: 0.55, plates: 4, diff: 'easy', mix: 0.1, seed: 5 },
  { model: 'mushroom', name: 'Mushroom', colors: 6, density: 0.55, plates: 2, diff: 'normal', mix: 0.2, seed: 1 },
  { model: 'tower', name: 'Tower', colors: 5, density: 0.65, plates: 3, diff: 'easy', mix: 0.2, seed: 4 },
  { model: 'heart', name: 'Heart', colors: 6, density: 0.5, plates: 2, diff: 'normal', mix: 0.25, seed: 1 },
  { model: 'house', name: 'Cottage', colors: 7, density: 0.45, plates: 3, diff: 'normal', mix: 0.25, seed: 19 },
  { model: 'box333', name: 'Puzzle Cube', colors: 8, density: 0.6, plates: 7, diff: 'hard', mix: 0.4, seed: 9 },
  { model: 'cat', name: 'Kitty', colors: 6, density: 0.5, plates: 2, diff: 'easy', mix: 0.15, seed: 7 },
  { model: 'tree', name: 'Apple Tree', colors: 7, density: 0.45, plates: 2, diff: 'normal', mix: 0.25, seed: 1 },
  { model: 'pyramid', name: 'Pyramid', colors: 7, density: 0.42, plates: 4, diff: 'normal', mix: 0.3, seed: 4 },
  { model: 'robot', name: 'Robot', colors: 8, density: 0.45, plates: 3, diff: 'normal', mix: 0.3, seed: 11 },
  { model: 'castle', name: 'Castle', colors: 9, density: 0.4, plates: 4, diff: 'normal', mix: 0.45, seed: 1 },
  { model: 'fish', name: 'Goldfish', colors: 6, density: 0.5, plates: 2, diff: 'easy', mix: 0.15, seed: 68 },
  { model: 'cactus', name: 'Cactus', colors: 7, density: 0.5, plates: 2, diff: 'normal', mix: 0.3, seed: 1 },
  { model: 'car', name: 'Red Car', colors: 8, density: 0.5, plates: 3, diff: 'normal', mix: 0.3, seed: 1 },
  { model: 'rocket', name: 'Rocket', colors: 8, density: 0.5, plates: 3, diff: 'normal', mix: 0.35, seed: 1 },
  { model: 'box433', name: 'Big Crate', colors: 8, density: 0.5, plates: 8, diff: 'hard', mix: 0.5, seed: 2 },
  { model: 'penguin', name: 'Penguin', colors: 7, density: 0.45, plates: 2, diff: 'easy', mix: 0.2, seed: 2 },
  { model: 'frog', name: 'Frog', colors: 8, density: 0.45, plates: 3, diff: 'normal', mix: 0.35, seed: 3 },
  { model: 'icecream', name: 'Ice Cream', colors: 8, density: 0.5, plates: 2, diff: 'normal', mix: 0.35, seed: 1 },
  { model: 'stairs', name: 'Stairs', colors: 8, density: 0.5, plates: 5, diff: 'hard', mix: 0.5, seed: 4 },
  { model: 'chick', name: 'Chick', colors: 8, density: 0.42, plates: 3, diff: 'normal', mix: 0.35, seed: 12 },
  { model: 'ring', name: 'Ring', colors: 8, density: 0.6, plates: 4, diff: 'normal', mix: 0.35, seed: 3 },
  { model: 'cross', name: 'Jack', colors: 8, density: 0.6, plates: 3, diff: 'hard', mix: 0.5, seed: 7 },
  { model: 'apple', name: 'Apple', colors: 8, density: 0.42, plates: 3, diff: 'normal', mix: 0.35, seed: 3 },
  { model: 'dog', name: 'Puppy', colors: 9, density: 0.45, plates: 3, diff: 'normal', mix: 0.4, seed: 3 },
  { model: 'box443', name: 'Grand Crate', colors: 9, density: 0.42, plates: 10, diff: 'super', mix: 0.6, seed: 3 },
];

/**
 * Difficulty curve: the careless bot's target win rate per level, hybrid-casual saw-tooth. Five gentle
 * onboarding levels, then a spike every fifth level (hard at 10, 15, 25; super hard at 20 and 30) followed
 * by a breather, while the baseline between spikes slowly drops.
 */
export const CURVE = [
  1.0, 1.0, 0.92, 0.88, 0.8,
  0.72, 0.85, 0.75, 0.68, 0.42,
  0.9, 0.75, 0.68, 0.6, 0.38,
  0.88, 0.72, 0.64, 0.56, 0.26,
  0.85, 0.7, 0.6, 0.52, 0.34,
  0.82, 0.64, 0.55, 0.45, 0.2,
];

export function diffOf(rate: number): LevelSpec['difficulty'] {
  return rate >= 0.85 ? 'easy' : rate >= 0.55 ? 'normal' : rate >= 0.3 ? 'hard' : 'super';
}

// labels follow the curve; seeds and knobs come from scripts/tune.ts (src/tuned.ts)
LEVELS.forEach((d, i) => {
  d.diff = diffOf(CURVE[i] ?? 0.7);
  const t = TUNED[i];
  // thicker toys and more screws as the game goes on
  d.deep = d.deep ?? (i < 2 ? 0 : d.diff === 'super' ? 2 : 1);
  d.density = Math.min(0.85, d.density + (i < 2 ? 0 : 0.12));
  if (t) { d.seed = t.seed; d.hives = t.hives; d.mix = t.mix; if (t.late) d.late = t.late; }
});

export const SLOTS = 5;
const COLS = 4;
const MAX_HIVES = 20;

const k3 = (c: V3): string => `${c[0]},${c[1]},${c[2]}`;
const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];

function shuffle<T>(a: T[], rnd: () => number): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Painted models: merge same-colour neighbours into bars of up to 3 cells. Wood: one cube per cell. */
function makeBlocks(model: ReturnType<(typeof MODELS)[string]>, rnd: () => number): BlockSpec[] {
  const left = new Map(model);
  const blocks: BlockSpec[] = [];
  const cells = shuffle([...model.values()], rnd);
  for (const cell of cells) {
    const k = k3(cell.p);
    if (!left.has(k)) continue;
    left.delete(k);
    let min: V3 = [...cell.p];
    let max: V3 = [...cell.p];
    if (cell.c !== 'w') {
      const axis = Math.floor(rnd() * 3);
      const want = 1 + Math.floor(rnd() * 3);
      for (const sgn of [1, -1]) {
        while (max[axis] - min[axis] + 1 < want) {
          const end = (sgn > 0 ? [...max] : [...min]) as V3;
          end[axis] += sgn;
          const n = left.get(k3(end));
          if (!n || n.c !== cell.c) break;
          left.delete(k3(end));
          if (sgn > 0) max = end; else min = end;
        }
      }
    }
    blocks.push({ kind: 'block', min, max, color: PAINT[cell.c] ?? cell.c });
  }
  return blocks;
}

export function generate(index: number, def: LevelDef = LEVELS[index], seedOverride?: number): LevelSpec {
  const baseSeed = seedOverride ?? def.seed;
  for (let attempt = 0; attempt < 60; attempt++) {
    const spec = tryGenerate(def, baseSeed * 1000 + attempt);
    if (spec) return spec;
  }
  throw new Error(`level ${index + 1}: no solvable layout`);
}

function tryGenerate(def: LevelDef, seed: number): LevelSpec | null {
  const rnd = mulberry(seed);
  const model = MODELS[def.model]();
  // extrude the back of every (x, y) column by `deep` more blocks
  if (def.deep) {
    const back = new Map<string, { p: V3; c: string }>();
    for (const v of model.values()) {
      const k2 = `${v.p[0]},${v.p[1]}`;
      const cur = back.get(k2);
      if (!cur || v.p[2] < cur.p[2]) back.set(k2, v);
    }
    for (const v of back.values()) {
      for (let d = 1; d <= def.deep; d++) {
        const p: V3 = [v.p[0], v.p[1], v.p[2] - d];
        model.set(k3(p), { p, c: v.c });
      }
    }
  }
  const blocks = makeBlocks(model, rnd);
  const owner = new Map<string, number>();
  blocks.forEach((b, i) => blockCells(b).forEach((c) => owner.set(k3(c), i)));
  const span = Math.max(...[...owner.keys()].flatMap((k) => k.split(',').map((x) => Math.abs(Number(x))))) * 2 + 2;
  /** nothing at all in front of this face: plates only go where their screws are free from the start */
  const open = (c: V3, d: number): boolean => {
    for (let k = 1; k <= span; k++) if (owner.has(k3(add(c, DIRS[d].map((x) => x * k) as V3)))) return false;
    return true;
  };

  // plates: a bar of 2–3 cells or a 2×2 square lying on open faces, tying at least two blocks together
  const pieces: PieceSpec[] = [...blocks];
  const covered = new Set<string>();
  const screws: ScrewSpec[] = [];
  const allCells = [...owner.keys()].map((k) => k.split(',').map(Number) as V3);
  const addPlate = (cells: V3[], dir: number): boolean => {
    if (cells.some((p) => !owner.has(k3(p)) || !open(p, dir) || covered.has(faceKey(p, dir)))) return false;
    // screws: both ends of a bar, all four corners of a square
    const at = cells.length === 4 ? cells : [cells[0], cells[cells.length - 1]];
    const owners = at.map((p) => owner.get(k3(p))!);
    if (new Set(owners).size < 2) return false;
    const pi = pieces.length;
    pieces.push({ kind: 'plate', cells, dir } satisfies PlateSpec);
    cells.forEach((p) => covered.add(faceKey(p, dir)));
    at.forEach((p, i) => screws.push({ piece: pi, cell: p, dir, color: 0, anchor: owners[i] }));
    return true;
  };
  for (const f of def.fixedPlates ?? []) if (!addPlate(f.cells, f.dir)) return null;
  for (let tries = 0, made = 0; made < def.plates && tries < 300; tries++) {
    const c = allCells[Math.floor(rnd() * allCells.length)];
    // mostly on the faces the camera sees first (+x, +y, +z)
    const dir = rnd() < 0.75 ? [0, 2, 4][Math.floor(rnd() * 3)] : Math.floor(rnd() * 6);
    if (!open(c, dir)) continue;
    const axes = [0, 1, 2].filter((a) => DIRS[dir][a] === 0);
    if (rnd() < 0.25) {
      const sq: V3[] = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([i, j]) => {
        const p = [...c] as V3;
        p[axes[0]] += i;
        p[axes[1]] += j;
        return p;
      });
      if (addPlate(sq, dir)) made++;
      continue;
    }
    const axis = axes[Math.floor(rnd() * 2)];
    const len = rnd() < 0.6 ? 2 : 3;
    const cells: V3[] = [];
    for (let i = 0; i < len; i++) {
      const p = [...c] as V3;
      p[axis] += i;
      if (!owner.has(k3(p)) || !open(p, dir) || covered.has(faceKey(p, dir))) break;
      cells.push(p);
    }
    if (cells.length < len) continue;
    if (addPlate(cells, dir)) made++;
  }

  // block screws. Faces looking out of the model are free from the start; faces against another block
  // (or across a gap) stay locked until the blocks in front drop. To stay solvable, peel the model first
  // (random order, each block leaves through a side that is clear by then) and only let a screw point at
  // blocks that peel off before its own block.
  let bound = 0;
  for (const c of allCells) bound = Math.max(bound, ...c.map(Math.abs));
  const ray = (c: V3, d: number): number[] => {
    const out: number[] = [];
    for (let k = 1; k <= bound * 2 + 2; k++) {
      const o = owner.get(k3(add(c, DIRS[d].map((x) => x * k) as V3)));
      if (o !== undefined && !out.includes(o)) out.push(o);
    }
    return out;
  };
  const faceList = blocks.map((b, bi) => {
    const f: { cell: V3; dir: number; hits: number[] }[] = [];
    for (const c of blockCells(b)) {
      for (let d = 0; d < 6; d++) {
        if (owner.get(k3(add(c, DIRS[d]))) === bi || covered.has(faceKey(c, d))) continue;
        f.push({ cell: c, dir: d, hits: ray(c, d).filter((o) => o !== bi) });
      }
    }
    return f;
  });
  const peel: number[] = blocks.map(() => -1);
  for (let t = 0; t < blocks.length; t++) {
    const ready = blocks.map((_, bi) => bi).filter((bi) => peel[bi] < 0 && faceList[bi].some((f) => f.hits.every((o) => peel[o] >= 0)));
    if (!ready.length) return null;
    // outer layers first: prefer blocks with many clear sides
    peel[ready[Math.floor(rnd() * ready.length)]] = t;
  }
  const inner = def.inner ?? INNER[def.diff];
  blocks.forEach((_, bi) => {
    const faces = shuffle(faceList[bi].filter((f) => f.hits.every((o) => peel[o] < peel[bi])), rnd);
    // clear faces first; with plain fronts wanted, the block's must-have screw goes on a side or the top
    const fr = (f: { dir: number }): number => ((def.front ?? 1) < 1 && f.dir === 4 ? 1 : 0);
    faces.sort((a, b2) => fr(a) - fr(b2) || a.hits.length - b2.hits.length);
    let n = 0;
    for (const f of faces) {
      const chance = (f.hits.length ? def.density * inner : def.density) * (f.dir === 4 ? def.front ?? 1 : 1);
      if (rnd() < chance || n === 0) { screws.push({ piece: bi, cell: f.cell, dir: f.dir, color: 0, anchor: -1 }); n++; }
    }
  });

  const spec: LevelSpec = {
    pieces, screws, columns: [], slots: SLOTS, colors: [], difficulty: def.diff, name: def.name,
  };
  if (!solvable(spec).ok) return null;

  // colours in layers: walk a removal order and cut it into hive-sized runs, one colour per run, so a hive
  // can only work once the layers above its screws are gone. Then scatter some screws (easier levels more).
  const order = randomOrder(spec, rnd);
  const posOf = new Map<number, number>();
  order.forEach((si, i) => posOf.set(si, i));
  // hard / super: smooth until `late` of the way, then the order turns hard
  const tense = def.diff === 'hard' || def.diff === 'super';
  const cut = tense ? def.late ?? 0.65 : 1;
  const target = Math.max(3, Math.min(MAX_HIVES, def.hives ?? HIVES[def.diff], Math.floor(screws.length / 4)));
  const sizes = splitHive(screws.length, target, rnd);
  const palette = shuffle([...COLORS.keys()], rnd).slice(0, Math.min(def.colors, sizes.length));
  const hives: (HiveSpec & { key: number })[] = [];
  let at = 0;
  sizes.forEach((n, i) => {
    // the next colour not used by the last two runs
    const color = palette[i % palette.length];
    for (const si of order.slice(at, at + n)) screws[si].color = color;
    const N = sizes.length;
    const c0 = Math.floor(cut * N);
    let key: number;
    if (!tense) key = i + (rnd() - 0.5) * def.mix * N;
    else if (i < c0) key = i + (rnd() - 0.5) * 0.8; // early hives come almost in removal order: smooth
    else {
      // late hives are shuffled among themselves: the player must plan the finish
      const m = Math.min(1, def.mix * 2);
      key = c0 + (i - c0) * (1 - m) + rnd() * (N - c0) * m;
    }
    hives.push({ color, n, key });
    at += n;
  });
  const scatter = def.scatter ?? SCATTER[def.diff];
  const lateFrom = Math.floor(cut * screws.length);
  for (let i = 0; i < screws.length; i++) {
    // tense finish: late screws keep their layer colours (no easy spare screws), early ones mix freely
    const late = (posOf.get(i) ?? 0) >= lateFrom;
    if (rnd() >= (late ? scatter * 0.3 : tense ? scatter * 1.6 : scatter)) continue;
    let j = Math.floor(rnd() * screws.length);
    if (tense) for (let g = 0; g < 8 && ((posOf.get(j) ?? 0) >= lateFrom) !== late; g++) j = Math.floor(rnd() * screws.length);
    [screws[i].color, screws[j].color] = [screws[j].color, screws[i].color];
  }
  spec.colors = palette;
  hives.sort((a, b) => a.key - b.key);
  const cols = Math.min(COLS, hives.length);
  spec.columns = Array.from({ length: cols }, () => []);
  hives.forEach((h, i) => spec.columns[i % cols].push({ color: h.color, n: h.n }));

  if (!playBot(spec, greedyPolicy, seed)) return null;
  return spec;
}

/** Screws on faces hidden behind other blocks, relative to open faces. */
const INNER: Record<LevelSpec['difficulty'], number> = { easy: 0.5, normal: 0.75, hard: 0.95, super: 1 };

/** Hives per level (more hives than slots is what makes the order matter). */
export const HIVES: Record<LevelSpec['difficulty'], number> = { easy: 10, normal: 15, hard: 17, super: 18 };

/** How many screws trade colours with a random other one (1 = colours all over the model). */
const SCATTER: Record<LevelSpec['difficulty'], number> = { easy: 0.6, normal: 0.3, hard: 0.15, super: 0.08 };

/** A removal order a player could follow: random among the screws that are free. */
function randomOrder(spec: LevelSpec, rnd: () => number): number[] {
  const out: number[] = [];
  const b = new Board(spec);
  while (out.length < spec.screws.length) {
    const free = spec.screws.map((_, i) => i).filter((i) => b.screwAlive[i] && b.isFree(i));
    const si = free[Math.floor(rnd() * free.length)];
    b.remove(si);
    out.push(si);
  }
  return out;
}

/** Cut `total` screws into `parts` hives of uneven sizes (about half to one and a half times the mean). */
function splitHive(total: number, parts: number, rnd: () => number): number[] {
  const mean = total / parts;
  const out = Array.from({ length: parts }, () => Math.max(3, Math.round(mean * (0.55 + rnd() * 0.9))));
  // fix the sum, nudging random hives without going under 3
  let diff = total - out.reduce((x, y) => x + y, 0);
  for (let guard = 0; diff !== 0 && guard < 10000; guard++) {
    const i = Math.floor(rnd() * parts);
    if (diff > 0) { out[i]++; diff--; } else if (out[i] > 3) { out[i]--; diff++; }
  }
  return out;
}
