// The 3D toy in a Screwdom 3D look: soft rounded toy blocks, chunky glossy screws with threaded shafts
// (hidden inside the block until pulled), soft shadows. Drawn with three.js
// under the 2D HUD.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { COLORS } from './levels.ts';
import { DIRS, type LevelSpec, type PlateSpec, type V3 } from './sim.ts';

const CUBE = 0.95; // gap between wooden cubes
const FACE = CUBE / 2;
const PLATE_T = 0.13;
const HEAD_R = 0.2;
const HEAD_H = 0.11;
const SHAFT = 0.5;
/** How far a screw travels out: the whole shaft, then a pop. */
export const PULL = SHAFT + 0.08;

interface Drop { obj: THREE.Object3D; vel: THREE.Vector3; spin: THREE.Vector3; t: number }
/**
 * Screw pull, straight out along its axis (no turning):
 *  strain – the bee grips: the screw shivers and creeps out a hair, head squashed;
 *  pop    – "pặc": it shoots out the whole shaft at once, stretched, then hides (the bee carries it), no hole left;
 *  back   – the bee let go: it springs back home.
 */
interface Pull { si: number; mode: 'strain' | 'pop' | 'back'; t: number; from: number; dist: number }
const POP = 0.28;

function woodTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  // light honey wood, a few clear wavy grain lines (as on the reference blocks)
  const grad = g.createLinearGradient(0, 0, 256, 256);
  grad.addColorStop(0, '#f6bd72');
  grad.addColorStop(1, '#eaa95c');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 9; i++) {
    const y0 = 14 + i * 28 + Math.random() * 10;
    g.strokeStyle = `rgba(196,118,48,${0.35 + Math.random() * 0.25})`;
    g.lineWidth = 1.6 + Math.random() * 1.2;
    g.beginPath();
    const amp = 2 + Math.random() * 4;
    const f = 0.02 + Math.random() * 0.02;
    const ph = Math.random() * 6;
    for (let x = -4; x <= 260; x += 6) g.lineTo(x, y0 + Math.sin(x * f + ph) * amp);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** Planar texture for the domed head: colour, deep cross slot, a soft highlight. */
function headTexture(color: number): THREE.CanvasTexture {
  const col = COLORS[color];
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = col.base;
  g.fillRect(0, 0, 128, 128);
  const rg = g.createRadialGradient(54, 50, 4, 64, 64, 64);
  rg.addColorStop(0, col.light);
  rg.addColorStop(0.5, col.base);
  rg.addColorStop(1, col.dark);
  g.fillStyle = rg;
  g.beginPath();
  g.arc(64, 64, 64, 0, Math.PI * 2);
  g.fill();
  const cross = (dx: number, dy: number, style: string, w: number, len: number): void => {
    g.strokeStyle = style;
    g.lineWidth = w;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(64 + dx, 64 - len + dy); g.lineTo(64 + dx, 64 + len + dy);
    g.moveTo(64 - len + dx, 64 + dy); g.lineTo(64 + len + dx, 64 + dy);
    g.stroke();
  };
  // slot: light lip below, dark groove, darker core = depth
  cross(0, 2.5, 'rgba(255,255,255,0.5)', 15, 27);
  cross(0, 0, col.dark, 14, 27);
  cross(0, -1, 'rgba(0,0,0,0.35)', 7, 24);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Domed head (lathe) with planar UVs so the cross texture sits on top. Origin at the base. */
function headGeometry(): THREE.BufferGeometry {
  const prof = [
    [0.001, 0], [HEAD_R * 0.98, 0], [HEAD_R, HEAD_H * 0.22], [HEAD_R * 0.96, HEAD_H * 0.48], [HEAD_R * 0.84, HEAD_H * 0.72],
    [HEAD_R * 0.62, HEAD_H * 0.9], [HEAD_R * 0.32, HEAD_H * 0.985], [0.001, HEAD_H],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const g = new THREE.LatheGeometry(prof, 32);
  const pos = g.getAttribute('position');
  const uv = g.getAttribute('uv');
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / (HEAD_R * 2.05) + 0.5, 0.5 - pos.getZ(i) / (HEAD_R * 2.05));
  uv.needsUpdate = true;
  g.computeVertexNormals();
  return g;
}

/** Threaded shaft going down from the head (into the block). */
function shaftGeometry(): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [new THREE.Vector2(0.001, -SHAFT - 0.04)];
  pts.push(new THREE.Vector2(0.05, -SHAFT - 0.02));
  const pitch = 0.055;
  for (let y = -SHAFT; y < 0; y += pitch) {
    pts.push(new THREE.Vector2(0.072, y));
    pts.push(new THREE.Vector2(0.108, y + pitch * 0.5));
  }
  pts.push(new THREE.Vector2(0.075, 0));
  pts.push(new THREE.Vector2(0.001, 0.001));
  return new THREE.LatheGeometry(pts, 18);
}

export class Scene3D {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  // weak perspective: the toy reads almost front-on, as in the reference
  camera = new THREE.PerspectiveCamera(16, 1, 0.1, 400);
  root = new THREE.Group(); // rotated by the player
  model = new THREE.Group(); // centred inside root
  pieceObj: THREE.Object3D[] = [];
  /** per piece: model-space box used for line-of-sight tests */
  pieceBox: THREE.Box3[] = [];
  screwObj: THREE.Group[] = [];
  screwNormal: THREE.Vector3[] = [];
  /** model-space point at the top of each screw head */
  screwTop: THREE.Vector3[] = [];
  screwBase: THREE.Vector3[] = [];
  drops: Drop[] = [];
  pulls = new Map<number, Pull>();
  radius = 2;
  vel = new THREE.Vector2();
  punch = 0;
  private sun: THREE.DirectionalLight;
  private wood: THREE.MeshStandardMaterial[];
  private plateMat = new THREE.MeshStandardMaterial({ color: '#b3c3c9', roughness: 0.55, metalness: 0.15 });
  private headMats = new Map<number, THREE.Material>();
  private shaftMats = new Map<number, THREE.Material>();
  private paintMats = new Map<string, THREE.MeshStandardMaterial>();
  private headGeo = headGeometry();
  private shaftGeo = shaftGeometry();
  private geoCache = new Map<string, THREE.BufferGeometry>();
  private ray = new THREE.Raycaster();
  private visCache = new Map<number, boolean>();
  view = { w: 1, h: 1, cx: 0.5, cy: 0.5, size: 1, boxW: 1, boxH: 1 };
  /** half extents of the toy at its start orientation */
  extent = new THREE.Vector3(1, 1, 1);

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0xc9b6a0, 1.75));
    const sun = new THREE.DirectionalLight(0xfff6ea, 2.0);
    sun.position.set(-3, 6, 7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.03;
    sun.shadow.radius = 4;
    this.sun = sun;
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight(0xe2f0ff, 0.75);
    fill.position.set(5, -1, 4);
    this.scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffffff, 0.5);
    rim.position.set(2, 3, -6);
    this.scene.add(rim);
    this.root.add(this.model);
    this.scene.add(this.root);
    const tex = woodTexture();
    this.wood = ['#ffffff', '#fff3e6', '#ffeedc'].map((tint) => new THREE.MeshStandardMaterial({ map: tex, color: tint, roughness: 0.62 }));
  }

  private box(sx: number, sy: number, sz: number, r: number): THREE.BufferGeometry {
    const k = `${sx.toFixed(3)},${sy.toFixed(3)},${sz.toFixed(3)},${r}`;
    let g = this.geoCache.get(k);
    if (!g) this.geoCache.set(k, (g = new RoundedBoxGeometry(sx, sy, sz, 4, r)));
    return g;
  }

  private headMat(color: number): THREE.Material {
    let m = this.headMats.get(color);
    if (!m) this.headMats.set(color, (m = new THREE.MeshStandardMaterial({ map: headTexture(color), roughness: 0.22, metalness: 0.05 })));
    return m;
  }

  private shaftMat(color: number): THREE.Material {
    let m = this.shaftMats.get(color);
    if (!m) this.shaftMats.set(color, (m = new THREE.MeshStandardMaterial({ color: COLORS[color].base, roughness: 0.3, metalness: 0.1 })));
    return m;
  }

  private paint(hex: string): THREE.MeshStandardMaterial {
    let m = this.paintMats.get(hex);
    if (!m) this.paintMats.set(hex, (m = new THREE.MeshStandardMaterial({ color: hex, roughness: 0.48 })));
    return m;
  }

  build(spec: LevelSpec): void {
    for (const d of this.drops) d.obj.removeFromParent();
    this.drops = [];
    this.pulls.clear();
    this.model.clear();
    this.pieceObj = [];
    this.pieceBox = [];
    this.screwObj = [];
    this.screwNormal = [];
    this.screwTop = [];
    this.screwBase = [];
    this.visCache.clear();
    const lo = new THREE.Vector3(1e9, 1e9, 1e9);
    const hi = new THREE.Vector3(-1e9, -1e9, -1e9);
    for (const p of spec.pieces) {
      if (p.kind !== 'block') continue;
      lo.min(new THREE.Vector3(...p.min));
      hi.max(new THREE.Vector3(...p.max));
    }
    const centre = lo.clone().add(hi).multiplyScalar(0.5);
    this.model.position.copy(centre).multiplyScalar(-1);
    this.radius = Math.max(1.2, hi.clone().sub(lo).addScalar(1).length() / 2 + 0.15);

    spec.pieces.forEach((p, i) => {
      let mesh: THREE.Mesh;
      if (p.kind === 'block') {
        const size = [p.max[0] - p.min[0] + 1, p.max[1] - p.min[1] + 1, p.max[2] - p.min[2] + 1];
        const wood = p.color === 'wood';
        const g = this.box(size[0] - (1 - CUBE), size[1] - (1 - CUBE), size[2] - (1 - CUBE), wood ? 0.15 : 0.12);
        mesh = new THREE.Mesh(g, wood ? this.wood[i % 3] : this.paint(p.color));
        mesh.position.set((p.min[0] + p.max[0]) / 2, (p.min[1] + p.max[1]) / 2, (p.min[2] + p.max[2]) / 2);
      } else {
        mesh = this.plateMesh(p);
      }
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.userData.piece = i;
      this.model.add(mesh);
      this.pieceObj.push(mesh);
      mesh.geometry.computeBoundingBox();
      const b = mesh.geometry.boundingBox!.clone();
      // shrink a hair so screws resting on a face never count as hidden by that face
      // shrink to the rounded block's core: its bevelled edges must not hide screws that show on screen
      const size = b.getSize(new THREE.Vector3());
      const shrink = new THREE.Vector3(Math.min(0.08, size.x * 0.25), Math.min(0.08, size.y * 0.25), Math.min(0.08, size.z * 0.25));
      b.min.add(shrink);
      b.max.sub(shrink);
      b.translate(mesh.position);
      this.pieceBox.push(b);
    });

    spec.screws.forEach((s, i) => {
      const n = new THREE.Vector3(...DIRS[s.dir]);
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
      const base = FACE + (s.anchor >= 0 ? PLATE_T : 0);
      const grp = new THREE.Group();
      const head = new THREE.Mesh(this.headGeo, this.headMat(s.color));
      const shaft = new THREE.Mesh(this.shaftGeo, this.shaftMat(s.color));
      head.castShadow = true;
      head.userData.screw = i;
      shaft.userData.screw = i;
      grp.add(head, shaft);
      grp.position.set(s.cell[0], s.cell[1], s.cell[2]).addScaledVector(n, base - 0.004);
      grp.quaternion.copy(q);
      grp.rotateY(Math.random() * Math.PI);
      this.model.add(grp);
      this.screwObj.push(grp);
      this.screwBase.push(grp.position.clone());
      this.screwNormal.push(n);
      this.screwTop.push(grp.position.clone().addScaledVector(n, HEAD_H));
    });

    // nearly front-on: a sliver of the top and left sides shows, like the reference
    this.root.quaternion.setFromEuler(new THREE.Euler(0.17, 0.13, 0, 'XYZ'));
    this.root.scale.setScalar(1);
    this.vel.set(0, 0);
    const sc = this.sun.shadow.camera;
    const r = this.radius * 1.3;
    sc.left = -r; sc.right = r; sc.top = r; sc.bottom = -r;
    sc.near = 0.1; sc.far = r * 6;
    this.sun.position.set(-0.35, 0.75, 0.6).normalize().multiplyScalar(r * 3);
    sc.updateProjectionMatrix();
    this.root.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(this.root);
    bb.getSize(this.extent).multiplyScalar(0.5);
    this.fit();
  }

  private plateMesh(p: PlateSpec): THREE.Mesh {
    const n = DIRS[p.dir];
    const lo = [0, 1, 2].map((k) => Math.min(...p.cells.map((c) => c[k])));
    const hi = [0, 1, 2].map((k) => Math.max(...p.cells.map((c) => c[k])));
    const nAxis = n.findIndex((x) => x !== 0);
    const square = p.cells.length === 4;
    // a bar is a narrow strap; a 2×2 plate is a wide rounded square
    const size = [0, 1, 2].map((k) => (k === nAxis ? PLATE_T : hi[k] > lo[k] ? hi[k] - lo[k] + (square ? 0.86 : 0.82) : square ? 0.86 : 0.5)) as V3;
    const mesh = new THREE.Mesh(this.box(size[0], size[1], size[2], square ? 0.06 : 0.05), this.plateMat);
    mesh.position.set((lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2);
    mesh.position.add(new THREE.Vector3(...n).multiplyScalar(FACE + PLATE_T / 2));
    return mesh;
  }

  /** Where the toy sits on screen: a rectangle (CSS px) it must fit in, centred on (cx, cy). */
  setView(w: number, h: number, cx: number, cy: number, boxW: number, boxH: number): void {
    this.view = { w, h, cx, cy, size: Math.max(boxW, boxH), boxW, boxH };
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.setSize(w, h, false);
    this.fit();
  }

  private fit(): void {
    const { w, h, cx, cy, boxW, boxH } = this.view;
    const cam = this.camera;
    cam.aspect = w / h;
    // world extents of the toy as it starts (half width/height around its centre)
    const ex = Math.max(0.5, this.extent.x);
    const ey = Math.max(0.5, this.extent.y);
    // fill the box, but a tiny toy never gets blown up past 1.5× the reference toy's scale (6 cubes across)
    const pxPerUnit = Math.min(boxW / (ex * 2), boxH / (ey * 2), (boxW / 6) * 1.5);
    const half = Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
    const dist = h / 2 / (pxPerUnit * half) + this.extent.z;
    cam.position.set(0, 0, dist);
    cam.near = Math.max(0.1, dist - this.radius * 4);
    cam.far = dist + this.radius * 6;
    cam.lookAt(0, 0, 0);
    cam.setViewOffset(w, h, w / 2 - cx, h / 2 - cy, w, h);
    cam.updateProjectionMatrix();
  }

  rotate(dx: number, dy: number): void {
    const k = 3.2 / Math.max(200, this.view.size);
    const qy = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), dx * k);
    const qx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), dy * k);
    this.root.quaternion.premultiply(qy).premultiply(qx);
    this.visCache.clear();
  }

  /** Screen position (CSS px) of a screw head, and its normal in view space. */
  screwScreen(si: number): { x: number; y: number; facing: number; nx: number; ny: number } {
    const g = this.screwObj[si];
    const p = g.getWorldPosition(new THREE.Vector3());
    const n = this.screwNormal[si].clone().applyQuaternion(this.root.quaternion);
    p.addScaledVector(n, HEAD_H * 0.6);
    p.project(this.camera);
    return { x: (p.x + 1) / 2 * this.view.w, y: (1 - p.y) / 2 * this.view.h, facing: n.z, nx: n.x, ny: n.y };
  }

  /**
   * Can the player (and so a bee) see this screw head? It must face the camera and the line from the camera
   * to the head must not pass through any piece still on the toy.
   */
  visible(si: number, alive: boolean[]): boolean {
    const hit = this.visCache.get(si);
    if (hit !== undefined) return hit;
    // any part of the head showing counts, even a screw seen almost edge-on on a side face
    const n = this.screwNormal[si].clone().applyQuaternion(this.root.quaternion);
    let ok = false;
    if (n.z > -0.08) {
      this.root.updateMatrixWorld();
      const cam = this.model.worldToLocal(this.camera.position.clone());
      const nl = this.screwNormal[si];
      const top = this.screwTop[si];
      const mid = top.clone().addScaledVector(nl, -HEAD_H * 0.4);
      // two directions across the head
      const a = Math.abs(nl.x) < 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
      const t1 = a.clone().cross(nl).normalize();
      const t2 = nl.clone().cross(t1).normalize();
      const pts = [top, ...[t1, t2].flatMap((t) => [mid.clone().addScaledVector(t, HEAD_R * 0.85), mid.clone().addScaledVector(t, -HEAD_R * 0.85)])];
      const at = new THREE.Vector3();
      for (const pt of pts) {
        const dir = pt.clone().sub(cam);
        const len = dir.length();
        dir.divideScalar(len);
        const ray = new THREE.Ray(cam, dir);
        let clear = true;
        for (let p = 0; p < this.pieceBox.length && clear; p++) {
          if (!alive[p]) continue;
          if (ray.intersectBox(this.pieceBox[p], at) && at.distanceTo(cam) < len - 0.02) clear = false;
        }
        if (clear) { ok = true; break; }
      }
    }
    this.visCache.set(si, ok);
    return ok;
  }

  /** Turn the toy so a screw faces the camera (test helper). */
  face(si: number): void {
    const n = this.screwNormal[si].clone();
    this.root.quaternion.setFromUnitVectors(n, new THREE.Vector3(0.15, 0.25, 1).normalize());
    this.visCache.clear();
  }

  /** Is the toy still turning (finger down or coasting)? */
  spinning(): boolean { return this.vel.lengthSq() > 400; }

  /** Pieces changed: line-of-sight answers are stale. */
  invalidate(): void { this.visCache.clear(); }

  /** A bee (or the drill) grips the screw: it starts to strain. */
  grab(si: number): void {
    const cur = this.pulls.get(si);
    this.pulls.set(si, { si, mode: 'strain', t: 0, from: cur?.dist ?? 0, dist: cur?.dist ?? 0 });
  }

  /** Let go before the pop: the screw springs back in. */
  release(si: number): void {
    const cur = this.pulls.get(si);
    if (!cur || cur.mode === 'pop') return;
    this.pulls.set(si, { si, mode: 'back', t: 0, from: cur.dist, dist: cur.dist });
  }

  /** "Pặc": the screw shoots straight out and is gone. */
  pop(si: number): void {
    const cur = this.pulls.get(si);
    this.pulls.set(si, { si, mode: 'pop', t: 0, from: cur?.dist ?? 0, dist: cur?.dist ?? 0 });
  }

  hideScrew(si: number): void { this.screwObj[si].visible = false; }

  /** A piece lost its last screw: let it fly off, out along `dir` (model space) and down. */
  drop(piece: number, dir: V3): void {
    const obj = this.pieceObj[piece];
    if (!obj || !obj.parent) return;
    this.scene.attach(obj);
    const out = new THREE.Vector3(...dir).applyQuaternion(this.root.quaternion);
    const vel = out.multiplyScalar(2.4).add(new THREE.Vector3((Math.random() - 0.5) * 1.2, 2.6, 0.3));
    if (vel.z > 1.2) vel.z = 1.2;
    this.drops.push({ obj, vel, spin: new THREE.Vector3(Math.random() * 5 - 2.5, Math.random() * 5 - 2.5, Math.random() * 5 - 2.5), t: 0 });
    this.punch = 1;
    this.visCache.clear();
  }

  /** Screen position of a piece (for dust). */
  pieceScreen(p: number): { x: number; y: number } {
    const v = this.pieceObj[p].getWorldPosition(new THREE.Vector3()).project(this.camera);
    return { x: (v.x + 1) / 2 * this.view.w, y: (1 - v.y) / 2 * this.view.h };
  }

  /** Raycast a screen point: the screw (or piece) under it. */
  pick(x: number, y: number): { screw: number; piece: number } {
    const ndc = new THREE.Vector2(x / this.view.w * 2 - 1, -(y / this.view.h) * 2 + 1);
    this.ray.setFromCamera(ndc, this.camera);
    const objs: THREE.Object3D[] = [...this.pieceObj.filter((o) => o.parent === this.model)];
    for (const g of this.screwObj) if (g.visible) objs.push(g.children[0]);
    const hit = this.ray.intersectObjects(objs, false)[0];
    if (!hit) return { screw: -1, piece: -1 };
    const ud = hit.object.userData;
    return { screw: ud.screw ?? -1, piece: ud.piece ?? -1 };
  }

  update(dt: number, dragging: boolean): void {
    if (!dragging && this.vel.lengthSq() > 0.01) {
      this.rotate(this.vel.x * dt, this.vel.y * dt);
      this.vel.multiplyScalar(Math.pow(0.04, dt));
    }
    // a piece dropping makes the toy give a little jolt
    if (this.punch > 0) {
      this.punch = Math.max(0, this.punch - dt * 4);
      const k = this.punch;
      this.root.scale.setScalar(1 + Math.sin(k * Math.PI * 2) * 0.025 * k);
    }
    for (const p of this.pulls.values()) {
      p.t += dt;
      const g = this.screwObj[p.si];
      const n = this.screwNormal[p.si];
      let sy = 1;
      if (p.mode === 'strain') {
        // creeps out a little, shivering harder the longer the bee pulls
        const k = Math.min(1, p.t / 0.6);
        // a gentle tug: barely creeps out, a soft shiver
        p.dist = p.from + (0.05 - p.from) * (1 - Math.pow(1 - k, 2)) + Math.sin(p.t * 60) * 0.004 * k;
        sy = 1 - 0.04 * k;
      } else if (p.mode === 'pop') {
        const k = Math.min(1, p.t / POP);
        const e = 1 - Math.pow(1 - k, 2);
        p.dist = p.from + (PULL + 0.05 - p.from) * e;
        sy = 1 + 0.1 * Math.sin(k * Math.PI);
        if (p.t >= POP) { g.visible = false; this.pulls.delete(p.si); continue; }
      } else {
        // spring back with a small bounce
        const k = Math.min(1, p.t / 0.22);
        p.dist = p.from * Math.max(0, 1 - k) * Math.cos(k * Math.PI * 1.5) ** 2;
        if (k >= 1) { p.dist = 0; this.pulls.delete(p.si); }
      }
      const base = this.screwBase[p.si];
      g.position.copy(base).addScaledVector(n, p.dist);
      const w = 1 / Math.sqrt(sy);
      g.scale.set(w, sy, w);
    }
    for (const d of this.drops) {
      d.t += dt;
      d.vel.y -= 13 * dt;
      d.obj.position.addScaledVector(d.vel, dt);
      d.obj.rotation.x += d.spin.x * dt;
      d.obj.rotation.y += d.spin.y * dt;
      d.obj.rotation.z += d.spin.z * dt;
      if (d.t > 0.9) d.obj.scale.multiplyScalar(Math.pow(0.02, dt));
    }
    this.drops = this.drops.filter((d) => {
      if (d.t < 1.8) return true;
      d.obj.removeFromParent();
      return false;
    });
  }

  render(): void { this.renderer.render(this.scene, this.camera); }
}
