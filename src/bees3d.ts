// 3D bees (and the screws they carry), drawn with three.js on their own transparent canvas above the HUD.
// An orthographic camera works in screen pixels (y down on screen = -y in the scene), so game.ts keeps
// steering bees in screen space and only hands this layer a list of poses each frame.

import * as THREE from 'three';
import { COLORS } from './levels.ts';

export interface BeePose {
  id: number;
  x: number;
  y: number;
  /** bee size in px (≈ body width) */
  s: number;
  color: number;
  /** heading on screen (radians, y down) */
  dir: number;
  flap: number;
  lean?: number;
  stretch?: number;
  scale?: number;
  /** screw colour carried under the legs, -1 none */
  carry?: number;
  sway?: number;
  /** screen offset (px) of the screw head the legs grip */
  grip?: [number, number] | null;
  strain?: number;
}

interface BeeRig {
  root: THREE.Group;
  turn: THREE.Group; // faces left/right, tilts
  body: THREE.Group;
  wings: THREE.Mesh[];
  eyes: THREE.Mesh[];
  legs: THREE.Mesh[];
  screw: THREE.Group;
  screwColor: number;
  color: number;
  // smoothed pose
  yaw: number;
  tilt: number;
  /** current facing (+1 right, -1 left), changes only on a clear sideways heading */
  face: number;
  seen: boolean;
}

const UP = new THREE.Vector3(0, 1, 0);
/** yaw (about the vertical) for a bee heading right / left, both turned a little toward the camera */
const YAW_RIGHT = -0.45;
const YAW_LEFT = -Math.PI + 0.45;

function stripeTexture(color: number): THREE.CanvasTexture {
  const col = COLORS[color];
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = col.base;
  g.fillRect(0, 0, 64, 128);
  // bands across v (the sphere's poles point along the bee's length)
  g.fillStyle = '#2a2230';
  for (const v of [0.34, 0.56]) g.fillRect(0, v * 128, 64, 0.12 * 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class BeeLayer {
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera = new THREE.OrthographicCamera(0, 1, 0, -1, -2000, 2000);
  private rigs = new Map<number, BeeRig>();
  private bodyMats = new Map<number, THREE.Material>();
  private headMats = new Map<number, THREE.Material>();
  private screwMats = new Map<number, THREE.Material>();
  private dark = new THREE.MeshStandardMaterial({ color: '#2a2230', roughness: 0.5 });
  private eyeMat = new THREE.MeshStandardMaterial({ color: '#15111a', roughness: 0.15, metalness: 0.1 });
  private white = new THREE.MeshBasicMaterial({ color: '#ffffff' });
  private cheek = new THREE.MeshStandardMaterial({ color: '#ff8fa6', roughness: 0.6, transparent: true, opacity: 0.85 });
  private wingMat = new THREE.MeshStandardMaterial({ color: '#eef6ff', roughness: 0.2, transparent: true, opacity: 0.72, side: THREE.DoubleSide, depthWrite: false });
  private geo = {
    sphere: new THREE.SphereGeometry(0.5, 24, 16),
    lowSphere: new THREE.SphereGeometry(0.5, 12, 8),
    cone: new THREE.ConeGeometry(0.08, 0.22, 10),
    stick: new THREE.CylinderGeometry(0.025, 0.025, 1, 6),
    leg: new THREE.CylinderGeometry(0.04, 0.035, 1, 6),
    wing: new THREE.CircleGeometry(0.5, 20),
    smile: new THREE.TorusGeometry(0.07, 0.018, 6, 12, Math.PI),
    head: null as unknown as THREE.BufferGeometry,
    shaft: null as unknown as THREE.BufferGeometry,
  };
  w = 1;
  h = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8a7a6a, 2.0));
    const sun = new THREE.DirectionalLight(0xffffff, 1.8);
    sun.position.set(-0.4, 0.8, 1);
    this.scene.add(sun);
    // screw parts (unit: 1 = the bee size)
    const head = new THREE.LatheGeometry([
      [0.001, 0], [0.2, 0], [0.21, 0.03], [0.19, 0.07], [0.13, 0.1], [0.001, 0.115],
    ].map(([x, y]) => new THREE.Vector2(x, y)), 20);
    const shaft: THREE.Vector2[] = [new THREE.Vector2(0.001, -0.5), new THREE.Vector2(0.05, -0.48)];
    for (let y = -0.45; y < 0; y += 0.06) {
      shaft.push(new THREE.Vector2(0.07, y));
      shaft.push(new THREE.Vector2(0.1, y + 0.03));
    }
    shaft.push(new THREE.Vector2(0.07, 0), new THREE.Vector2(0.001, 0.001));
    // wings pivot at their root
    this.geo.wing.translate(0, 0.5, 0);
    this.geo.head = head;
    this.geo.shaft = new THREE.LatheGeometry(shaft, 14);
  }

  resize(w: number, h: number): void {
    this.w = w;
    this.h = h;
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    this.renderer.setSize(w, h, false);
    this.camera.left = 0;
    this.camera.right = w;
    this.camera.top = 0;
    this.camera.bottom = -h;
    this.camera.updateProjectionMatrix();
  }

  private mat(map: Map<number, THREE.Material>, key: number, make: () => THREE.Material): THREE.Material {
    let m = map.get(key);
    if (!m) map.set(key, (m = make()));
    return m;
  }

  private build(color: number): BeeRig {
    const col = COLORS[color];
    const root = new THREE.Group();
    const turn = new THREE.Group();
    const body = new THREE.Group();
    root.add(turn);
    turn.add(body);
    // abdomen: a sphere with its poles along x, striped around
    const bodyMat = this.mat(this.bodyMats, color, () => new THREE.MeshStandardMaterial({ map: stripeTexture(color), roughness: 0.4 }));
    const abd = new THREE.Mesh(this.geo.sphere, bodyMat);
    abd.rotation.z = Math.PI / 2;
    abd.scale.set(0.86, 1.05, 0.9);
    abd.position.set(-0.16, -0.02, 0);
    body.add(abd);
    const sting = new THREE.Mesh(this.geo.cone, this.dark);
    sting.rotation.z = Math.PI / 2;
    sting.position.set(-0.7, -0.04, 0);
    body.add(sting);
    // big round head
    const headMat = this.mat(this.headMats, color, () => new THREE.MeshStandardMaterial({ color: col.base, roughness: 0.35 }));
    const head = new THREE.Mesh(this.geo.sphere, headMat);
    head.scale.setScalar(0.66);
    head.position.set(0.36, 0.12, 0.04);
    body.add(head);
    // face on the front of the head (+x), symmetric: turning around passes through a front view
    const eyes: THREE.Mesh[] = [];
    for (const ez of [0.15, -0.15]) {
      const eye = new THREE.Mesh(this.geo.sphere, this.eyeMat);
      eye.scale.set(0.11, 0.18, 0.13);
      eye.position.set(0.62, 0.2, ez);
      body.add(eye);
      eyes.push(eye);
      const glint = new THREE.Mesh(this.geo.lowSphere, this.white);
      glint.scale.setScalar(0.05);
      glint.position.set(0.67, 0.26, ez + 0.02);
      body.add(glint);
      const cheek = new THREE.Mesh(this.geo.lowSphere, this.cheek);
      cheek.scale.set(0.05, 0.06, 0.1);
      cheek.position.set(0.6, 0.02, ez * 1.55);
      body.add(cheek);
    }
    const smile = new THREE.Mesh(this.geo.smile, this.dark);
    smile.rotation.set(0, Math.PI / 2, Math.PI);
    smile.position.set(0.67, 0.05, 0);
    body.add(smile);
    for (const az of [0.12, -0.12]) {
      const ant = new THREE.Mesh(this.geo.stick, this.dark);
      ant.scale.set(1, 0.32, 1);
      ant.position.set(0.45, 0.55, az);
      ant.rotation.set(az > 0 ? 0.35 : -0.35, 0, -0.35);
      body.add(ant);
      const tip = new THREE.Mesh(this.geo.lowSphere, this.dark);
      tip.scale.setScalar(0.1);
      tip.position.set(0.51, 0.7, az * 1.9);
      body.add(tip);
    }
    // wings hinge on the back
    const wings: THREE.Mesh[] = [];
    for (const z of [0.18, -0.12]) {
      const wing = new THREE.Mesh(this.geo.wing, this.wingMat);
      wing.scale.set(0.42, 0.62, 1);
      wing.position.set(-0.1, 0.36, z);
      wing.rotation.set(0, 0, 0.35);
      body.add(wing);
      wings.push(wing);
    }
    // legs: hips under the body, pointing down (re-aimed when gripping)
    const legs: THREE.Mesh[] = [];
    for (const z of [0.16, -0.12]) {
      const leg = new THREE.Mesh(this.geo.leg, this.dark);
      leg.position.set(0.02, -0.38, z);
      leg.scale.set(1, 0.3, 1);
      turn.add(leg);
      legs.push(leg);
    }
    // the carried screw: head up, shaft down
    const screw = new THREE.Group();
    screw.add(new THREE.Mesh(this.geo.head, this.dark), new THREE.Mesh(this.geo.shaft, this.dark));
    screw.visible = false;
    root.add(screw);
    this.scene.add(root);
    return { root, turn, body, wings, eyes, legs, screw, screwColor: -1, color, yaw: 0, tilt: 0, face: 1, seen: true };
  }

  private paintScrew(rig: BeeRig, color: number): void {
    if (rig.screwColor === color) return;
    rig.screwColor = color;
    const m = this.mat(this.screwMats, color, () => new THREE.MeshStandardMaterial({ color: COLORS[color].base, roughness: 0.25, metalness: 0.05 }));
    for (const c of rig.screw.children) (c as THREE.Mesh).material = m;
  }

  /** Bring the scene in line with this frame's bees. `dt` smooths turning. */
  sync(poses: BeePose[], dt: number): void {
    for (const r of this.rigs.values()) r.seen = false;
    const k = 1 - Math.exp(-12 * dt);
    const kf = 1 - Math.exp(-9 * dt); // turning around: quick but visible
    for (const p of poses) {
      let rig = this.rigs.get(p.id);
      if (rig && rig.color !== p.color) {
        rig.root.removeFromParent();
        rig = undefined;
      }
      if (!rig) {
        rig = this.build(p.color);
        this.rigs.set(p.id, rig);
        rig.face = Math.cos(p.dir) >= 0 ? 1 : -1;
        rig.yaw = rig.face > 0 ? YAW_RIGHT : YAW_LEFT;
      }
      rig.seen = true;
      const sc = Math.max(0.001, (p.scale ?? 1) * p.s);
      rig.root.position.set(p.x, -p.y, 10);
      rig.root.scale.setScalar(sc);
      // turn around for real (yaw about the vertical), passing through a front view, never flattened;
      // only switch sides on a clearly sideways heading so it doesn't flip back and forth
      const c = Math.cos(p.dir);
      if (c > 0.35) rig.face = 1;
      else if (c < -0.35) rig.face = -1;
      const face = rig.face;
      rig.yaw += ((face > 0 ? YAW_RIGHT : YAW_LEFT) - rig.yaw) * kf;
      rig.turn.rotation.y = rig.yaw;
      // pitch with the climb / dive, plus lean
      const climb = Math.max(-0.55, Math.min(0.55, -Math.sin(p.dir) * 0.5));
      // nose up when climbing or leaning back on a screw (local z: the head is always +x)
      const tiltT = climb + Math.abs(p.lean ?? 0);
      rig.tilt += (tiltT - rig.tilt) * k;
      rig.turn.rotation.z = rig.tilt;
      const st = p.stretch ?? 1;
      rig.body.scale.set(st, 1 / Math.sqrt(st), 1);
      // wings
      const w = Math.sin(p.flap);
      // flap: spread out to the sides and back, wings stay readable from the front
      rig.wings[0].rotation.x = -0.45 - w * 0.55;
      rig.wings[1].rotation.x = 0.45 + w * 0.55;
      // straining: eyes squeezed
      const sq = (p.strain ?? 0) > 0.5 ? 0.3 : 1;
      for (const e of rig.eyes) e.scale.y = 0.18 * sq;
      // legs: grip a screw head, hold the carried screw, or tuck under
      rig.root.updateMatrixWorld(true);
      const carry = p.carry ?? -1;
      rig.screw.visible = carry >= 0;
      if (carry >= 0) {
        this.paintScrew(rig, carry);
        rig.screw.position.set(0, -0.62, 0);
        rig.screw.rotation.set(0.25, 0, (p.sway ?? 0) * 0.12);
        rig.screw.scale.setScalar(1.45);
        this.aimLegs(rig, new THREE.Vector3(p.x, -p.y - sc * 0.5, 10));
      } else if (p.grip) {
        this.aimLegs(rig, new THREE.Vector3(p.x + p.grip[0], -(p.y + p.grip[1]), 10));
      } else {
        for (const leg of rig.legs) {
          leg.scale.set(1, 0.3, 1);
          leg.quaternion.identity();
          leg.position.y = -0.38 - 0.15;
        }
      }
    }
    for (const [id, r] of this.rigs) {
      if (!r.seen) {
        r.root.removeFromParent();
        this.rigs.delete(id);
      }
    }
  }

  /** Point both legs from their hips at a world point (the screw head). */
  private aimLegs(rig: BeeRig, target: THREE.Vector3): void {
    const local = rig.turn.worldToLocal(target.clone());
    rig.legs.forEach((leg, i) => {
      const hip = new THREE.Vector3(0.05 + (i ? -0.08 : 0.08), -0.32, i ? -0.12 : 0.16);
      const foot = local.clone().add(new THREE.Vector3(i ? -0.1 : 0.1, 0, 0));
      const d = foot.clone().sub(hip);
      const len = Math.max(0.12, Math.min(1.4, d.length()));
      const unit = d.normalize();
      // the cylinder runs along its local y: aim it hip → foot and centre it between them
      leg.scale.set(1, len, 1);
      leg.quaternion.setFromUnitVectors(UP, unit);
      leg.position.copy(hip).addScaledVector(unit, len / 2);
    });
  }

  render(visible: boolean): void {
    this.renderer.domElement.style.visibility = visible ? 'visible' : 'hidden';
    if (visible) this.renderer.render(this.scene, this.camera);
  }
}
