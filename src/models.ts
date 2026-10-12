// Voxel models for the levels, built from boxes. x → right, y → up, z → toward the viewer.
// Colour keys: 'w' wood, the rest are painted blocks (see PAINT).

export const PAINT: Record<string, string> = {
  w: 'wood',
  G: '#3fae6c', g: '#8ad46a', B: '#8b4c46', P: '#e7a5a6', Y: '#f6c23a', O: '#f27b2c', K: '#34343f',
  E: '#f5f2ea', R: '#e5463d', U: '#3f84e3', C: '#4fcde0', N: '#dcb58e', V: '#9563d8', S: '#a7b1bb',
  M: '#ffd6e6', D: '#6b4a2f', T: '#2f8f8a',
};

export type Model = Map<string, { p: [number, number, number]; c: string }>;

class VM {
  m: Model = new Map();
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, c: string): this {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++)
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
        for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) this.m.set(`${x},${y},${z}`, { p: [x, y, z], c });
    return this;
  }
  at(x: number, y: number, z: number, c: string): this { return this.box(x, y, z, x, y, z, c); }
  cut(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): this {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++)
      for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++)
        for (let z = Math.min(z0, z1); z <= Math.max(z0, z1); z++) this.m.delete(`${x},${y},${z}`);
    return this;
  }
  /** Repaint cells that exist. */
  paint(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, c: string): this {
    for (const v of this.m.values()) {
      const [x, y, z] = v.p;
      if (x >= Math.min(x0, x1) && x <= Math.max(x0, x1) && y >= Math.min(y0, y1) && y <= Math.max(y0, y1) && z >= Math.min(z0, z1) && z <= Math.max(z0, z1)) v.c = c;
    }
    return this;
  }
}

const v = (): VM => new VM();

export const MODELS: Record<string, () => Model> = {
  // level 3 as in the reference shot: an uneven wall of wooden cubes, protruding left, right and below
  ref3: () => v()
    .box(1, 4, 0, 4, 4, 2, 'w')
    .box(1, 3, 0, 5, 3, 2, 'w')
    .box(0, 2, 1, 5, 2, 2, 'w').box(1, 2, 0, 4, 2, 0, 'w')
    .box(1, 1, 0, 4, 1, 2, 'w')
    .box(2, 0, 1, 3, 0, 2, 'w')
    .cut(5, 3, 0, 5, 3, 0).m,
  box222: () => v().box(0, 0, 0, 1, 1, 1, 'w').m,
  box322: () => v().box(0, 0, 0, 2, 1, 1, 'w').m,
  box333: () => v().box(0, 0, 0, 2, 2, 2, 'w').m,
  box423: () => v().box(0, 0, 0, 3, 1, 2, 'w').m,
  tower: () => v().box(0, 0, 0, 1, 4, 1, 'w').m,
  box433: () => v().box(0, 0, 0, 3, 2, 2, 'w').m,
  box443: () => v().box(0, 0, 0, 3, 3, 2, 'w').m,
  cross: () => v().box(1, 0, 1, 1, 4, 1, 'w').box(0, 2, 1, 2, 2, 1, 'w').box(1, 2, 0, 1, 2, 2, 'w').box(0, 3, 0, 2, 3, 2, 'w').cut(0, 3, 0, 0, 3, 0).cut(2, 3, 2, 2, 3, 2).m,
  stairs: () => v().box(0, 0, 0, 3, 0, 2, 'w').box(1, 1, 0, 3, 1, 2, 'w').box(2, 2, 0, 3, 2, 2, 'w').box(3, 3, 0, 3, 3, 2, 'w').m,
  pyramid: () => v().box(0, 0, 0, 4, 0, 4, 'w').box(1, 1, 1, 3, 1, 3, 'w').box(2, 2, 2, 2, 2, 2, 'w').cut(0, 0, 0, 0, 0, 0).cut(4, 0, 4, 4, 0, 4).cut(0, 0, 4, 0, 0, 4).cut(4, 0, 0, 4, 0, 0).m,
  ring: () => v().box(0, 0, 0, 3, 3, 1, 'w').cut(1, 1, 0, 2, 2, 1).m,

  duck: () => v()
    .box(0, 1, 0, 4, 1, 2, 'P').box(0, 2, 0, 4, 2, 2, 'B').box(-1, 2, 1, -1, 2, 1, 'B')
    .box(3, 3, 0, 5, 5, 2, 'G').box(3, 3, 0, 5, 3, 2, 'E')
    .at(5, 5, 0, 'E').at(5, 5, 2, 'E').at(5, 4, 0, 'K').at(5, 4, 2, 'K')
    .box(6, 4, 0, 7, 4, 2, 'Y')
    .box(2, 0, 0, 2, 0, 0, 'O').box(2, 0, 2, 2, 0, 2, 'O').m,

  mushroom: () => v()
    .box(1, 0, 1, 2, 2, 2, 'N')
    .box(0, 3, 0, 3, 3, 3, 'R').box(1, 4, 1, 2, 4, 2, 'R')
    .at(0, 3, 0, 'E').at(3, 3, 2, 'E').at(1, 4, 1, 'E').at(3, 3, 0, 'E').m,

  heart: () => v()
    .box(1, 4, 0, 2, 4, 1, 'R').box(4, 4, 0, 5, 4, 1, 'R')
    .box(0, 3, 0, 6, 3, 1, 'R').box(0, 2, 0, 6, 2, 1, 'R')
    .box(1, 1, 0, 5, 1, 1, 'R').box(2, 0, 0, 4, 0, 1, 'R').at(3, -1, 0, 'R').at(3, -1, 1, 'R')
    .at(1, 3, 1, 'M').at(2, 4, 1, 'M').m,

  house: () => v()
    .box(0, 0, 0, 3, 2, 3, 'N')
    .box(0, 3, 0, 3, 3, 3, 'R').box(0, 4, 1, 3, 4, 2, 'R')
    .box(1, 0, 3, 1, 1, 3, 'B').at(3, 1, 3, 'C').at(0, 1, 1, 'C').at(3, 1, 0, 'C')
    .at(3, 5, 2, 'S').m,

  cat: () => v()
    .box(0, 0, 0, 4, 3, 2, 'O')
    .at(0, 4, 1, 'O').at(4, 4, 1, 'O').at(0, 4, 2, 'P').at(4, 4, 2, 'P')
    .at(1, 2, 2, 'K').at(3, 2, 2, 'K').at(2, 1, 2, 'P').box(1, 0, 2, 3, 0, 2, 'E').m,

  tree: () => v()
    .box(1, 0, 1, 2, 2, 2, 'D')
    .box(0, 3, 0, 3, 4, 3, 'G').box(1, 5, 1, 2, 5, 2, 'G')
    .at(0, 4, 0, 'g').at(3, 3, 3, 'g').at(1, 5, 2, 'g').at(3, 4, 1, 'R').at(0, 3, 2, 'R').m,

  robot: () => v()
    .box(1, 0, 1, 1, 1, 1, 'S').box(3, 0, 1, 3, 1, 1, 'S')
    .box(0, 2, 0, 4, 4, 2, 'U').box(-1, 3, 1, -1, 4, 1, 'S').box(5, 3, 1, 5, 4, 1, 'S')
    .box(1, 5, 0, 3, 6, 2, 'S').at(1, 6, 2, 'C').at(3, 6, 2, 'C').at(2, 7, 1, 'R')
    .box(1, 3, 2, 3, 3, 2, 'Y').m,

  fish: () => v()
    .box(0, 0, 0, 4, 2, 1, 'C').box(1, 3, 0, 3, 3, 1, 'C').box(1, -1, 0, 3, -1, 1, 'C')
    .box(-2, -1, 0, -1, -1, 1, 'Y').box(-2, 3, 0, -1, 3, 1, 'Y').box(-1, 0, 0, -1, 2, 1, 'Y')
    .at(3, 2, 1, 'K').at(3, 2, 0, 'K').box(1, 1, 0, 1, 1, 1, 'U').box(2, 0, 0, 2, 0, 1, 'U').m,

  cactus: () => v()
    .box(0, 0, 0, 3, 1, 3, 'O').box(1, 2, 1, 2, 6, 2, 'G')
    .box(0, 4, 1, 0, 4, 1, 'G').box(-1, 4, 1, -1, 5, 1, 'G').box(3, 3, 2, 3, 3, 2, 'G').box(4, 3, 2, 4, 4, 2, 'G')
    .at(1, 7, 1, 'M').m,

  car: () => v()
    .box(0, 1, 0, 5, 2, 2, 'R').box(1, 3, 0, 3, 3, 2, 'C').box(1, 4, 0, 3, 4, 2, 'R')
    .at(1, 0, 0, 'K').at(4, 0, 0, 'K').at(1, 0, 2, 'K').at(4, 0, 2, 'K')
    .at(5, 2, 0, 'Y').at(5, 2, 2, 'Y').m,

  rocket: () => v()
    .box(0, 1, 0, 2, 5, 2, 'E').box(1, 6, 1, 1, 7, 1, 'R').box(0, 6, 0, 2, 6, 2, 'R')
    .at(1, 4, 2, 'C').at(1, 4, 0, 'C')
    .box(-1, 0, 1, -1, 2, 1, 'R').box(3, 0, 1, 3, 2, 1, 'R').box(1, 0, 1, 1, 0, 1, 'O').m,

  penguin: () => v()
    .box(0, 1, 0, 3, 5, 2, 'K').box(1, 1, 2, 2, 4, 2, 'E').at(1, 4, 2, 'K')
    .box(1, 3, 3, 2, 3, 3, 'O').box(0, 0, 1, 1, 0, 2, 'O').box(2, 0, 1, 3, 0, 2, 'O')
    .at(0, 5, 2, 'E').at(3, 5, 2, 'E').m,

  frog: () => v()
    .box(0, 0, 0, 4, 2, 3, 'G').box(0, 3, 2, 1, 3, 3, 'G').box(3, 3, 2, 4, 3, 3, 'G')
    .at(0, 3, 3, 'E').at(4, 3, 3, 'E').at(1, 3, 3, 'K').at(3, 3, 3, 'K')
    .box(1, 1, 3, 3, 1, 3, 'R').box(0, 0, 3, 0, 0, 3, 'g').box(4, 0, 3, 4, 0, 3, 'g').m,

  icecream: () => v()
    .box(1, 0, 1, 1, 1, 1, 'N').box(0, 2, 0, 2, 2, 2, 'N')
    .box(0, 3, 0, 2, 4, 2, 'M').box(0, 5, 0, 2, 5, 2, 'D').box(1, 6, 1, 1, 6, 1, 'R')
    .at(0, 4, 2, 'E').at(2, 3, 0, 'E').m,

  chick: () => v()
    .box(0, 0, 0, 3, 3, 3, 'Y').box(1, 4, 1, 2, 4, 2, 'Y')
    .at(1, 3, 3, 'K').at(2, 3, 3, 'K').box(1, 2, 4, 2, 2, 4, 'O')
    .at(-1, 1, 1, 'Y').at(-1, 1, 2, 'Y').at(4, 1, 1, 'Y').at(4, 1, 2, 'Y').m,

  castle: () => v()
    .box(0, 0, 0, 3, 3, 3, 'S').box(1, 0, 3, 2, 1, 3, 'D')
    .at(0, 4, 0, 'S').at(3, 4, 0, 'S').at(0, 4, 3, 'S').at(3, 4, 3, 'S').at(1, 4, 0, 'S').at(2, 4, 3, 'S')
    .box(1, 4, 1, 1, 6, 1, 'D').box(2, 6, 1, 2, 6, 1, 'R').m,

  apple: () => v()
    .box(0, 0, 1, 4, 3, 3, 'R').box(1, 0, 0, 3, 3, 4, 'R').cut(0, 0, 1, 0, 0, 1).cut(4, 0, 3, 4, 0, 3)
    .box(2, 4, 2, 2, 5, 2, 'D').box(3, 5, 2, 3, 5, 2, 'G').at(1, 3, 4, 'M').m,

  dog: () => v()
    .box(0, 1, 0, 4, 2, 2, 'N').box(4, 3, 0, 6, 4, 2, 'N').at(7, 3, 1, 'K')
    .at(4, 5, 0, 'D').at(4, 5, 2, 'D').at(6, 4, 0, 'K').at(6, 4, 2, 'K')
    .at(0, 0, 0, 'N').at(0, 0, 2, 'N').at(3, 0, 0, 'N').at(3, 0, 2, 'N').at(-1, 2, 1, 'D')
    .box(1, 2, 0, 2, 2, 2, 'D').m,
};
