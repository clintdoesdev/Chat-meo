import * as THREE from "three";
import { coreMaterial, glassMaterial } from "@/components/three/glass-icon-engine";

export type GlassIconType = "bubble" | "bolt" | "spark" | "flow" | "naira" | "plane";

export type BuiltGlassIcon = {
  group: THREE.Group;
  update: (t: number) => void;
};

// All shapes are authored on the same 64-grid as the app's flat SVG icons, then scaled to world units.
const K = 0.07;
function pt(s: THREE.Shape, x: number, y: number, move = false) {
  if (move) {
    s.moveTo((x - 32) * K, (32 - y) * K);
  } else {
    s.lineTo((x - 32) * K, (32 - y) * K);
  }
}
function qt(s: THREE.Shape, cx: number, cy: number, x: number, y: number) {
  s.quadraticCurveTo((cx - 32) * K, (32 - cy) * K, (x - 32) * K, (32 - y) * K);
}

function roundedRectShape(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

function extrude(shape: THREE.Shape, depth: number, bevel: number): THREE.ExtrudeGeometry {
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    curveSegments: 56,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 12,
  });
  g.center();
  return g;
}

function bubbleShape(): THREE.Shape {
  const s = new THREE.Shape();
  pt(s, 32, 6, true);
  qt(s, 6, 6, 6, 30);
  qt(s, 6, 42, 15.9, 48.9);
  qt(s, 15.5, 53.5, 12.5, 58.4);
  qt(s, 12, 60, 13.5, 59.9);
  qt(s, 21, 59, 26.3, 55.4);
  qt(s, 29, 55.9, 32, 55.9);
  qt(s, 58, 55.9, 58, 30);
  qt(s, 58, 6, 32, 6);
  return s;
}
function boltShape(): THREE.Shape {
  const s = new THREE.Shape();
  pt(s, 36.5, 7, true);
  pt(s, 15, 35);
  pt(s, 26.5, 35);
  pt(s, 22, 57);
  pt(s, 49, 28);
  pt(s, 36, 28);
  pt(s, 40, 7);
  return s;
}
function sparkShape(): THREE.Shape {
  const s = new THREE.Shape();
  pt(s, 32, 6, true);
  qt(s, 36, 24, 55, 28);
  qt(s, 36, 32, 32, 50);
  qt(s, 28, 32, 9, 28);
  qt(s, 28, 24, 32, 6);
  return s;
}
function planeShape(): THREE.Shape {
  const s = new THREE.Shape();
  pt(s, 57.5, 9.5, true);
  pt(s, 40, 55.5);
  pt(s, 30.5, 28.5);
  pt(s, 12, 21);
  return s;
}

type Builder = (scene: THREE.Scene, env: THREE.Texture, noise: THREE.Texture) => BuiltGlassIcon;

const builders: Record<GlassIconType, Builder> = {
  bubble(scene, env, noise) {
    const g = new THREE.Group();
    const glass = new THREE.Mesh(extrude(bubbleShape(), 0.85, 0.21), glassMaterial(env, noise, 0xff8a3e));
    g.add(glass);
    const eyeGeo = new THREE.SphereGeometry(0.3, 32, 24);
    const e1 = new THREE.Mesh(eyeGeo, coreMaterial(env));
    e1.position.set(-0.56, 0.12, 0.62);
    const e2 = new THREE.Mesh(eyeGeo, coreMaterial(env));
    e2.position.set(0.56, 0.12, 0.62);
    g.add(e1, e2);
    scene.add(g);
    return {
      group: g,
      update(t) {
        g.rotation.y = Math.sin(t * 0.8) * 0.38;
        g.rotation.x = Math.sin(t * 0.6 + 1) * 0.1;
        g.position.y = Math.sin(t * 1.1) * 0.12;
        const blink = t % 3.6 > 3.42 ? 0.12 : 1;
        e1.scale.y = e2.scale.y = blink;
      },
    };
  },
  flow(scene, env, noise) {
    const g = new THREE.Group();
    const a = new THREE.Mesh(new THREE.SphereGeometry(0.62, 48, 32), glassMaterial(env, noise, 0xff8a3e));
    a.position.set(-1.15, 0, 0);
    const bGeo = extrude(roundedRectShape(1.0, 1.0, 0.34), 0.55, 0.13);
    const b = new THREE.Mesh(bGeo, glassMaterial(env, noise, 0xff9b52));
    b.position.set(1.05, 0.95, 0);
    const c = new THREE.Mesh(bGeo.clone(), glassMaterial(env, noise, 0xff9b52));
    c.position.set(1.05, -0.95, 0);
    const linkMat = coreMaterial(env);
    function link(p1: THREE.Vector3, p2: THREE.Vector3) {
      const dir = new THREE.Vector3().subVectors(p2, p1);
      const len = dir.length();
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, len, 28), linkMat);
      m.position.copy(p1).add(dir.multiplyScalar(0.5));
      m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
      return m;
    }
    g.add(link(a.position, b.position), link(a.position, c.position), a, b, c);
    scene.add(g);
    return {
      group: g,
      update(t) {
        g.rotation.y = Math.sin(t * 0.7) * 0.5;
        a.position.y = Math.sin(t * 1.3) * 0.1;
        b.rotation.z = Math.sin(t * 0.9) * 0.15;
        c.rotation.z = Math.sin(t * 0.9 + 2) * 0.15;
        g.position.y = Math.sin(t * 0.9 + 0.5) * 0.08;
      },
    };
  },
  bolt(scene, env, noise) {
    const g = new THREE.Group();
    const m = new THREE.Mesh(extrude(boltShape(), 0.7, 0.18), glassMaterial(env, noise, 0xff7a2f));
    g.add(m);
    scene.add(g);
    return {
      group: g,
      update(t) {
        g.rotation.y = t * 0.9;
        g.position.y = Math.sin(t * 1.4) * 0.1;
        const s = 1 + Math.max(0, Math.sin(t * 1.4 - 1.2)) * 0.04;
        g.scale.set(s, s, s);
      },
    };
  },
  spark(scene, env, noise) {
    const g = new THREE.Group();
    const main = new THREE.Mesh(extrude(sparkShape(), 0.6, 0.18), glassMaterial(env, noise, 0xff9b52));
    const babyGeo = extrude(sparkShape(), 0.5, 0.15);
    const baby = new THREE.Mesh(babyGeo, glassMaterial(env, noise, 0xff6a22));
    baby.scale.set(0.32, 0.32, 0.32);
    baby.position.set(1.35, 1.1, 0.25);
    g.add(main, baby);
    scene.add(g);
    return {
      group: g,
      update(t) {
        main.rotation.z = Math.sin(t * 0.55) * 0.45;
        g.rotation.y = Math.sin(t * 0.5 + 1) * 0.35;
        const p = 1 + Math.sin(t * 2.2) * 0.05;
        main.scale.set(p, p, p);
        const q = 0.32 + Math.sin(t * 3 + 1.5) * 0.06;
        baby.scale.set(q, q, q);
        baby.rotation.z = -t * 0.8;
      },
    };
  },
  naira(scene, env, noise) {
    const g = new THREE.Group();
    const vGeo = extrude(roundedRectShape(0.44, 2.5, 0.21), 0.5, 0.11);
    const dGeo = extrude(roundedRectShape(0.44, 2.9, 0.21), 0.5, 0.11);
    const hGeo = extrude(roundedRectShape(2.6, 0.4, 0.19), 0.5, 0.1);
    const l = new THREE.Mesh(vGeo, glassMaterial(env, noise, 0xff8a3e));
    l.position.x = -0.85;
    const r = new THREE.Mesh(vGeo.clone(), glassMaterial(env, noise, 0xff8a3e));
    r.position.x = 0.85;
    const d = new THREE.Mesh(dGeo, glassMaterial(env, noise, 0xff8a3e));
    d.rotation.z = -0.6;
    const h1 = new THREE.Mesh(hGeo, glassMaterial(env, noise, 0xff6a22));
    h1.position.y = 0.5;
    const h2 = new THREE.Mesh(hGeo.clone(), glassMaterial(env, noise, 0xff6a22));
    h2.position.y = -0.5;
    g.add(l, r, d, h1, h2);
    scene.add(g);
    return {
      group: g,
      update(t) {
        g.rotation.y = t * 0.7;
        g.position.y = Math.sin(t) * 0.1;
      },
    };
  },
  plane(scene, env, noise) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(extrude(planeShape(), 0.45, 0.15), glassMaterial(env, noise, 0xff8a3e));
    g.add(body);
    const sGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.9, 24);
    const streakMat1 = coreMaterial(env);
    streakMat1.transparent = true;
    const streakMat2 = coreMaterial(env);
    streakMat2.transparent = true;
    const s1 = new THREE.Mesh(sGeo, streakMat1);
    s1.rotation.z = Math.PI / 2 - 0.35;
    s1.position.set(-1.7, 0.5, 0);
    const s2 = new THREE.Mesh(sGeo.clone(), streakMat2);
    s2.rotation.z = Math.PI / 2 - 0.35;
    s2.position.set(-2.0, -0.25, 0.1);
    g.add(s1, s2);
    scene.add(g);
    return {
      group: g,
      update(t) {
        g.position.x = Math.sin(t * 0.9) * 0.28;
        g.position.y = Math.sin(t * 1.8) * 0.18;
        g.rotation.z = Math.sin(t * 0.9 + 1.2) * 0.14;
        g.rotation.y = Math.sin(t * 0.7) * 0.3;
        streakMat1.opacity = streakMat2.opacity = 0.6 + Math.sin(t * 3) * 0.3;
      },
    };
  },
};

export function buildGlassIcon(
  icon: GlassIconType,
  scene: THREE.Scene,
  env: THREE.Texture,
  noise: THREE.Texture,
): BuiltGlassIcon {
  return builders[icon](scene, env, noise);
}
