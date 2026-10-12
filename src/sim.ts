// Rules of Bee:Screw, shared by the game and the tuning bot. No drawing here.
//
// A model is a set of pieces on an integer grid: blocks (cuboids of cells) and plates (thin metal bars
// lying on the outside faces of blocks). Screws sit on a face (cell, dir) and point out along dir.
// A screw can be pulled out only when nothing lies in front of it along its axis. A piece without screws
// drops off, except a block still pinned by a plate screw driven into it.
//
// Hives hold bees of one colour; the number on a hive is how many screws its bees will pull. The player
// taps the front hive of a column; it moves into a free slot and its bees pull free screws of its colour.

export type V3 = [number, number, number];

export const DIRS: V3[] = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];

export interface BlockSpec {
  kind: 'block';
  min: V3;
  max: V3; // inclusive
  /** 'wood' or a hex colour */
  color: string;
}
export interface PlateSpec {
  kind: 'plate';
  /** Cells whose face `dir` the plate covers, end to end. */
  cells: V3[];
  dir: number;
}
export type PieceSpec = BlockSpec | PlateSpec;

export interface ScrewSpec {
  piece: number;
  cell: V3;
  dir: number;
  color: number;
  /** For a plate screw: the block it is driven into. -1 for block screws. */
  anchor: number;
}

export interface HiveSpec { color: number; n: number }

export interface LevelSpec {
  pieces: PieceSpec[];
  screws: ScrewSpec[];
  /** columns[c][0] is the front hive of column c */
  columns: HiveSpec[][];
  slots: number;
  colors: number[];
  difficulty: 'easy' | 'normal' | 'hard' | 'super';
  name: string;
}

const key = (x: number, y: number, z: number): string => `${x},${y},${z}`;

export function blockCells(b: BlockSpec): V3[] {
  const out: V3[] = [];
  for (let x = b.min[0]; x <= b.max[0]; x++)
    for (let y = b.min[1]; y <= b.max[1]; y++)
      for (let z = b.min[2]; z <= b.max[2]; z++) out.push([x, y, z]);
  return out;
}

/** Face key in doubled coordinates: the centre of face `dir` of `cell`. */
export function faceKey(c: V3, dir: number): string {
  const d = DIRS[dir];
  return key(2 * c[0] + d[0], 2 * c[1] + d[1], 2 * c[2] + d[2]);
}

export class Board {
  readonly spec: LevelSpec;
  alive: boolean[];
  screwAlive: boolean[];
  /** a bee is on its way to this screw */
  claimed: boolean[];
  screwsLeft: number[]; // per piece
  pins: number[]; // live plate screws anchored into each block
  cellOwner = new Map<string, number>();
  plateFaces = new Map<string, number>();
  bound = 0;
  removed = 0;

  constructor(spec: LevelSpec) {
    this.spec = spec;
    this.alive = spec.pieces.map(() => true);
    this.screwAlive = spec.screws.map(() => true);
    this.claimed = spec.screws.map(() => false);
    this.screwsLeft = spec.pieces.map(() => 0);
    this.pins = spec.pieces.map(() => 0);
    spec.screws.forEach((s) => {
      this.screwsLeft[s.piece]++;
      if (s.anchor >= 0) this.pins[s.anchor]++;
    });
    spec.pieces.forEach((p, i) => {
      if (p.kind === 'block') {
        for (const c of blockCells(p)) {
          this.cellOwner.set(key(...c), i);
          this.bound = Math.max(this.bound, Math.abs(c[0]), Math.abs(c[1]), Math.abs(c[2]));
        }
      } else {
        for (const c of p.cells) this.plateFaces.set(faceKey(c, p.dir), i);
      }
    });
    this.bound += 2;
  }

  /** Nothing in front of the screw along its axis. */
  isFree(si: number): boolean {
    const s = this.spec.screws[si];
    const d = DIRS[s.dir];
    const [cx, cy, cz] = s.cell;
    for (let k = 0; k <= this.bound * 2; k++) {
      // the face we cross at step k (k = 0 is the screw's own face)
      if (k > 0 || s.anchor < 0) {
        const fp = this.plateFaces.get(key(2 * (cx + k * d[0]) + d[0], 2 * (cy + k * d[1]) + d[1], 2 * (cz + k * d[2]) + d[2]));
        if (fp !== undefined && fp !== s.piece && this.alive[fp]) return false;
      }
      const owner = this.cellOwner.get(key(cx + (k + 1) * d[0], cy + (k + 1) * d[1], cz + (k + 1) * d[2]));
      if (owner !== undefined && owner !== s.piece && this.alive[owner]) return false;
    }
    return true;
  }

  /** How many live pieces stand in front of a screw (0 = free): "outer" screws have fewer. */
  blockers(si: number): number {
    const s = this.spec.screws[si];
    const d = DIRS[s.dir];
    const [cx, cy, cz] = s.cell;
    const seen = new Set<number>();
    for (let k = 0; k <= this.bound * 2; k++) {
      if (k > 0 || s.anchor < 0) {
        const fp = this.plateFaces.get(key(2 * (cx + k * d[0]) + d[0], 2 * (cy + k * d[1]) + d[1], 2 * (cz + k * d[2]) + d[2]));
        if (fp !== undefined && fp !== s.piece && this.alive[fp]) seen.add(fp);
      }
      const owner = this.cellOwner.get(key(cx + (k + 1) * d[0], cy + (k + 1) * d[1], cz + (k + 1) * d[2]));
      if (owner !== undefined && owner !== s.piece && this.alive[owner]) seen.add(owner);
    }
    return seen.size;
  }

  canTake(si: number): boolean {
    return this.screwAlive[si] && !this.claimed[si] && this.isFree(si);
  }

  /** Free, unclaimed screws of a colour. */
  freeOf(color: number): number[] {
    const out: number[] = [];
    this.spec.screws.forEach((s, i) => { if (s.color === color && this.canTake(i)) out.push(i); });
    return out;
  }

  /** Pull a screw out. Returns the pieces that drop off because of it, in order. */
  remove(si: number): number[] {
    if (!this.screwAlive[si]) return [];
    const s = this.spec.screws[si];
    this.screwAlive[si] = false;
    this.claimed[si] = false;
    this.removed++;
    this.screwsLeft[s.piece]--;
    const fallen: number[] = [];
    const check = (p: number): void => {
      if (!this.alive[p] || this.screwsLeft[p] > 0 || this.pins[p] > 0) return;
      this.alive[p] = false;
      fallen.push(p);
      // a dropped plate releases the blocks its screws were pinning (none left by then, but stay general)
      this.spec.screws.forEach((t, ti) => {
        if (t.piece === p && t.anchor >= 0 && this.screwAlive[ti]) { this.pins[t.anchor]--; check(t.anchor); }
      });
    };
    if (s.anchor >= 0) { this.pins[s.anchor]--; check(s.anchor); }
    check(s.piece);
    return fallen;
  }

  /** Knock a whole piece off (Hammer). Returns the screws pulled, then drops it. */
  smash(p: number): number[] {
    const out: number[] = [];
    this.spec.screws.forEach((s, i) => { if (s.piece === p && this.screwAlive[i]) out.push(i); });
    return out;
  }

  done(): boolean { return this.removed >= this.spec.screws.length; }
}

/** With unlimited slots, can every screw come out? (removal only ever frees more, so greedy decides it) */
export function solvable(spec: LevelSpec): { ok: boolean; order: number[] } {
  const b = new Board(spec);
  const order: number[] = [];
  let progress = true;
  while (progress) {
    progress = false;
    for (let i = 0; i < spec.screws.length; i++) {
      if (b.screwAlive[i] && b.isFree(i)) { b.remove(i); order.push(i); progress = true; }
    }
  }
  return { ok: b.done(), order };
}

// ---------------------------------------------------------------- bot (instant, no animation)

export type Policy = (tops: { col: number; hive: HiveSpec; free: number }[], rnd: () => number) => number;

export const greedyPolicy: Policy = (tops) => {
  let best = 0;
  let score = -1e9;
  tops.forEach((t, i) => {
    const s = Math.min(t.free, t.hive.n) * 10 - t.hive.n + (t.free >= t.hive.n ? 50 : 0);
    if (s > score) { score = s; best = i; }
  });
  return best;
};

/** A careless player: mostly taps hives that can work right now, sometimes anything. */
export const casualPolicy: Policy = (tops, rnd) => {
  const working = tops.map((t, i) => (t.free > 0 ? i : -1)).filter((i) => i >= 0);
  if (working.length && rnd() < 0.75) return working[Math.floor(rnd() * working.length)];
  return Math.floor(rnd() * tops.length);
};

export function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function playBot(spec: LevelSpec, policy: Policy, seed: number, slots = spec.slots): boolean {
  return botRun(spec, policy, seed, slots) >= 1;
}

/** Play a level; returns how far the bot got (share of screws out, 1 = cleared). */
export function botRun(spec: LevelSpec, policy: Policy, seed: number, slots = spec.slots): number {
  const rnd = mulberry(seed);
  const b = new Board(spec);
  const cols = spec.columns.map((c) => c.map((h) => ({ ...h })));
  const slot: (HiveSpec | null)[] = Array(slots).fill(null);
  for (let guard = 0; guard < 10000; guard++) {
    // every hive in a slot pulls what it can, until nothing moves
    let moved = true;
    while (moved) {
      moved = false;
      for (let i = 0; i < slot.length; i++) {
        const h = slot[i];
        if (!h) continue;
        const free = b.freeOf(h.color);
        while (h.n > 0 && free.length) {
          const si = free.shift()!;
          if (!b.canTake(si)) continue;
          b.remove(si);
          h.n--;
          moved = true;
        }
        if (h.n <= 0) slot[i] = null;
        if (moved) break;
      }
    }
    if (b.done()) return 1;
    const empty = slot.indexOf(null);
    const tops = cols.map((c, col) => ({ col, hive: c[0], free: c[0] ? b.freeOf(c[0].color).length : 0 })).filter((t) => t.hive);
    if (empty < 0 || !tops.length) return b.removed / spec.screws.length;
    const pick = tops[policy(tops, rnd)];
    slot[empty] = cols[pick.col].shift()!;
  }
  return b.removed / spec.screws.length;
}
