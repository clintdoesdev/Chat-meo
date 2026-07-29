"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { createIconRenderer, disposeGroup } from "@/components/three/create-icon-renderer";
import { buildExtrudedBody } from "@/components/three/extrude-icon";

// A simple lightning-bolt silhouette — "powered by" energy, extruded with the
// same bevel + gradient recipe as the mascot for a matching 3D icon set.
const BOLT_PATH = "M35 3 L12 35 L27 35 L20 61 L52 26 L34 26 Z";

function buildBolt(): THREE.Group {
  const group = new THREE.Group();
  group.rotation.set(
    THREE.MathUtils.degToRad(-8),
    THREE.MathUtils.degToRad(-18),
    THREE.MathUtils.degToRad(10),
  );
  group.scale.setScalar(0.06);

  const { mesh } = buildExtrudedBody(BOLT_PATH, {
    depth: 7,
    bevelSize: 1,
    bevelThickness: 1,
    bevelSegments: 4,
    colorStart: "#FFC79A",
    colorEnd: "#FF5C16",
    metalness: 0.16,
    roughness: 0.3,
  });
  group.add(mesh);

  return group;
}

export default function Bolt3DIcon({ size }: { size: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const { renderer, camera, scene } = createIconRenderer(canvas, size);
    camera.position.set(0, 0, 5);

    const group = buildBolt();
    scene.add(group);

    const baseRotX = group.rotation.x;
    const baseRotY = group.rotation.y;

    let raf = 0;
    const clock = new THREE.Clock();
    function animate() {
      if (!reduceMotion) {
        const t = clock.getElapsedTime();
        group.rotation.x = baseRotX + Math.sin(t * 0.45) * 0.18;
        group.rotation.y = baseRotY + Math.sin(t * 0.3 + 1) * 0.3;
        group.rotation.z = THREE.MathUtils.degToRad(10) + t * 0.15;
        group.position.y = Math.sin(t * 0.65 + 2) * 0.1;
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
