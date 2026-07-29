"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { createIconRenderer, disposeGroup } from "@/components/three/create-icon-renderer";

function quadGeometry(
  a: THREE.Vector3Tuple,
  b: THREE.Vector3Tuple,
  c: THREE.Vector3Tuple,
  d: THREE.Vector3Tuple,
) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.BufferAttribute(new Float32Array([...a, ...b, ...c, ...a, ...c, ...d]), 3),
  );
  geometry.computeVertexNormals();
  return geometry;
}

// A faceted 4-point sparkle/star: four outer tips, four concave "waist" points
// pulled toward the center, and a raised center apex — four kite-shaped facets
// meeting there, each catching light differently for a low-poly gem look.
const TOP: THREE.Vector3Tuple = [0, 1, 0];
const RIGHT: THREE.Vector3Tuple = [1, 0, 0];
const BOTTOM: THREE.Vector3Tuple = [0, -1, 0];
const LEFT: THREE.Vector3Tuple = [-1, 0, 0];
const TR: THREE.Vector3Tuple = [0.42, 0.42, -0.08];
const BR: THREE.Vector3Tuple = [0.42, -0.42, -0.08];
const BL: THREE.Vector3Tuple = [-0.42, -0.42, -0.08];
const TL: THREE.Vector3Tuple = [-0.42, 0.42, -0.08];
const CENTER: THREE.Vector3Tuple = [0, 0, 0.4];

function buildSparkle(): THREE.Group {
  const group = new THREE.Group();
  group.rotation.set(0.3, 0.4, 0);
  group.scale.setScalar(1.05);

  const facets: [THREE.BufferGeometry, string][] = [
    [quadGeometry(TOP, TR, CENTER, TL), "#FFC79A"],
    [quadGeometry(TR, RIGHT, BR, CENTER), "#FF7C2E"],
    [quadGeometry(CENTER, BR, BOTTOM, BL), "#E24A0C"],
    [quadGeometry(TL, CENTER, BL, LEFT), "#FF9A52"],
  ];

  for (const [geometry, color] of facets) {
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.4,
      metalness: 0.1,
      flatShading: true,
      side: THREE.DoubleSide,
    });
    group.add(new THREE.Mesh(geometry, material));
  }

  return group;
}

export default function SparkleIcon({ size }: { size: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const { renderer, camera, scene } = createIconRenderer(canvas, size);
    const group = buildSparkle();
    scene.add(group);

    let raf = 0;
    const clock = new THREE.Clock();
    function animate() {
      if (!reduceMotion) {
        const t = clock.getElapsedTime();
        group.rotation.z = t * 0.25;
        group.rotation.x = Math.sin(t * 0.4) * 0.25;
        group.position.y = Math.sin(t * 0.7 + 1) * 0.1;
      }
      renderer.render(scene, camera);
      raf = requestAnimationFrame(animate);
    }
    animate();

    return () => {
      cancelAnimationFrame(raf);
      disposeGroup(group);
      renderer.dispose();
    };
  }, [size]);

  return <canvas ref={canvasRef} style={{ width: size, height: size, display: "block" }} aria-hidden="true" />;
}
