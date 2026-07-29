"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { createIconRenderer, disposeGroup } from "@/components/three/create-icon-renderer";

function triangleGeometry(a: THREE.Vector3Tuple, b: THREE.Vector3Tuple, c: THREE.Vector3Tuple) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array([...a, ...b, ...c]), 3));
  geometry.computeVertexNormals();
  return geometry;
}

// Nose forward (+Z), tail back, wingtips out and slightly down, keel dipping
// below the ridge — a minimal folded-paper-airplane silhouette in 3 flat facets.
const NOSE: THREE.Vector3Tuple = [0, 0.06, 1.4];
const TAIL: THREE.Vector3Tuple = [0, -0.06, -1.0];
const LEFT_TIP: THREE.Vector3Tuple = [-1.3, -0.3, -0.7];
const RIGHT_TIP: THREE.Vector3Tuple = [1.3, -0.3, -0.7];
const KEEL: THREE.Vector3Tuple = [0, -0.42, 0.25];

function buildPlane(): THREE.Group {
  const group = new THREE.Group();
  group.rotation.set(-0.45, 0.5, 0.1);
  group.scale.setScalar(0.95);

  const facets: [THREE.BufferGeometry, string][] = [
    [triangleGeometry(NOSE, LEFT_TIP, TAIL), "#FFC79A"],
    [triangleGeometry(NOSE, TAIL, RIGHT_TIP), "#FF7C2E"],
    [triangleGeometry(NOSE, TAIL, KEEL), "#C24A12"],
  ];

  for (const [geometry, color] of facets) {
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.45,
      metalness: 0.05,
      flatShading: true,
      side: THREE.DoubleSide,
    });
    group.add(new THREE.Mesh(geometry, material));
  }

  return group;
}

export default function PaperPlaneIcon({ size }: { size: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const { renderer, camera, scene } = createIconRenderer(canvas, size);
    const group = buildPlane();
    scene.add(group);

    let raf = 0;
    const clock = new THREE.Clock();
    function animate() {
      if (!reduceMotion) {
        const t = clock.getElapsedTime();
        group.rotation.y = Math.sin(t * 0.35) * 0.5 + 0.15;
        group.rotation.z = Math.sin(t * 0.5) * 0.12 - 0.15;
        group.position.y = Math.sin(t * 0.6) * 0.12;
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
