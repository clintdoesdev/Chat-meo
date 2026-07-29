"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { createGlassScene, disposeGroup } from "@/components/three/glass-icon-engine";
import { buildGlassIcon, type GlassIconType } from "@/components/three/glass-icon-shapes";

const REDUCED_MOTION_T = 1.7;

export default function GlassIcon({ icon, size }: { icon: GlassIconType; size: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const { renderer, camera, scene, env, noise, dispose } = createGlassScene(canvas, size);
    const built = buildGlassIcon(icon, scene, env, noise);

    let raf = 0;
    const clock = new THREE.Clock();
    function frame() {
      const t = reduceMotion ? REDUCED_MOTION_T : clock.getElapsedTime();
      built.update(t);
      renderer.render(scene, camera);
      if (!reduceMotion) raf = requestAnimationFrame(frame);
    }
    frame();

    return () => {
      cancelAnimationFrame(raf);
      disposeGroup(built.group);
      dispose();
    };
  }, [icon, size]);

  return (
    <div className="glass-icon-glow-wrap" style={{ width: size, height: size }} aria-hidden="true">
      <div className="glass-icon-glow" />
      <canvas ref={canvasRef} style={{ width: size, height: size, display: "block", position: "relative" }} />
    </div>
  );
}
