"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { createIconRenderer, disposeGroup } from "@/components/three/create-icon-renderer";
import { buildExtrudedBody, buildRaisedDisc } from "@/components/three/extrude-icon";

// Same body outline as the flat MeoMark logo, extruded via Meo 3D Studio's recipe.
const BODY_PATH =
  "M32 6C17 6 6 16.4 6 30c0 7.8 3.8 14.5 9.9 18.9-.4 3.2-1.7 6.3-4.2 8.7-.7.7-.2 1.9.8 1.8 5.4-.5 10.2-2.6 13.8-5 1.8.3 3.7.5 5.7.5 15 0 26-10.4 26-23.9S47 6 32 6z";
const EYES = [
  { cx: 24, cy: 30, r: 4.4 },
  { cx: 40, cy: 30, r: 4.4 },
];
const EYE_POP = 1.6;

function buildMascot(): THREE.Group {
  const group = new THREE.Group();
  group.rotation.set(
    THREE.MathUtils.degToRad(-10),
    THREE.MathUtils.degToRad(22),
    THREE.MathUtils.degToRad(-7),
  );
  group.scale.setScalar(0.052);

  const { mesh: body, center, frontZ } = buildExtrudedBody(BODY_PATH, {
    depth: 8,
    bevelSize: 1.2,
    bevelThickness: 1.2,
    bevelSegments: 4,
    colorStart: "#FF7A2F",
    colorEnd: "#FF5C16",
    metalness: 0.12,
    roughness: 0.32,
  });
  group.add(body);

  const eyes = EYES.map((eye) => {
    const disc = buildRaisedDisc(eye.r, "#1A0B00", 0.17, 0.32);
    disc.position.set(eye.cx - center.x, -(eye.cy - center.y), frontZ + EYE_POP - 1.1);
    group.add(disc);
    return disc;
  });

  return Object.assign(group, { eyes });
}

export default function Mascot3DIcon({ size }: { size: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const { renderer, camera, scene } = createIconRenderer(canvas, size);
    camera.position.set(0, 0, 5.4);

    const group = buildMascot() as THREE.Group & { eyes: THREE.Mesh[] };
    scene.add(group);

    const baseRotX = group.rotation.x;
    const baseRotZ = group.rotation.z;

    let raf = 0;
    const clock = new THREE.Clock();
    function animate() {
      const t = clock.getElapsedTime();
      if (!reduceMotion) {
        group.rotation.y = THREE.MathUtils.degToRad(22) + Math.sin(t * 0.35) * 0.22;
        group.rotation.x = baseRotX + Math.sin(t * 0.5) * 0.05;
        group.rotation.z = baseRotZ + Math.sin(t * 0.4 + 1) * 0.04;
        group.position.y = Math.sin(t * 0.6) * 0.12;

        // Slow, occasional blink: eyes squash on Y briefly every ~4.6s.
        const cycle = t % 4.6;
        const blink = cycle > 4.4 ? 1 - Math.abs((cycle - 4.5) / 0.1) : 0;
        const scaleY = 1 - Math.max(0, Math.min(1, blink)) * 0.85;
        group.eyes.forEach((eye) => eye.scale.setY(scaleY));
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
