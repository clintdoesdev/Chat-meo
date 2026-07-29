import * as THREE from "three";
import { svgPathToShape } from "@/components/three/svg-path-to-shape";

export type ExtrudeBodyOptions = {
  depth?: number;
  bevelSize?: number;
  bevelThickness?: number;
  bevelSegments?: number;
  colorStart?: string;
  colorEnd?: string;
  metalness?: number;
  roughness?: number;
};

/** Diagonal top-left -> bottom-right gradient baked into vertex colors, matching the SVG fill. */
function applyGradient(geometry: THREE.BufferGeometry, colorStart: string, colorEnd: string) {
  geometry.computeBoundingBox();
  const bb = geometry.boundingBox!;
  const w = bb.max.x - bb.min.x || 1;
  const h = bb.max.y - bb.min.y || 1;
  const pos = geometry.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  // THREE.Color already converts sRGB hex/style strings to the linear working
  // color space on construction (unlike the r128-era reference this technique
  // was ported from) — an extra .convertSRGBToLinear() here would double it.
  const cA = new THREE.Color(colorStart);
  const cB = new THREE.Color(colorEnd);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const t = Math.max(
      0,
      Math.min(1, ((pos.getX(i) - bb.min.x) / w + (bb.max.y - pos.getY(i)) / h) / 2),
    );
    c.copy(cA).lerp(cB, t);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
}

/**
 * Extrudes a flat SVG path into a beveled 3D solid with a diagonal gradient —
 * the same recipe as the Meo 3D Studio reference tool.
 */
export function buildExtrudedBody(pathD: string, opts: ExtrudeBodyOptions = {}) {
  const {
    depth = 8,
    bevelSize = 1.2,
    bevelThickness = 1.2,
    bevelSegments = 4,
    colorStart = "#FF7A2F",
    colorEnd = "#FF5C16",
    metalness = 0.12,
    roughness = 0.32,
  } = opts;

  const shape = svgPathToShape(pathD);
  const bevelEnabled = bevelSize > 0 || bevelThickness > 0;
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    curveSegments: 24,
    bevelEnabled,
    bevelSize,
    bevelThickness,
    bevelSegments,
  });

  geometry.computeBoundingBox();
  const bb = geometry.boundingBox!;
  const center = {
    x: (bb.min.x + bb.max.x) / 2,
    y: (bb.min.y + bb.max.y) / 2,
    z: (bb.min.z + bb.max.z) / 2,
  };
  geometry.translate(-center.x, -center.y, -center.z);
  // SVG y points down; flip to world space, then flip z to restore winding.
  geometry.scale(1, -1, 1);
  geometry.scale(1, 1, -1);
  geometry.computeVertexNormals();
  applyGradient(geometry, colorStart, colorEnd);

  const material = new THREE.MeshStandardMaterial({ vertexColors: true, metalness, roughness });
  const mesh = new THREE.Mesh(geometry, material);

  return {
    mesh,
    center,
    frontZ: depth / 2 + (bevelEnabled ? bevelThickness : 0),
  };
}

/** A small raised, beveled disc — used for the mascot's eyes. */
export function buildRaisedDisc(radius: number, color: string, metalness: number, roughness: number) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, radius, 0, Math.PI * 2, false);
  const depth = 2.2;
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth,
    curveSegments: 28,
    bevelEnabled: true,
    bevelSize: 0.7,
    bevelThickness: 0.7,
    bevelSegments: 4,
  });
  geometry.translate(0, 0, -depth / 2);
  const material = new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    metalness,
    roughness,
  });
  return new THREE.Mesh(geometry, material);
}
