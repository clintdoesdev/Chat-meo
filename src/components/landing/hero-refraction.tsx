"use client";

import { useEffect } from "react";

export function HeroRefraction() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const root = document.documentElement;
    let raf = 0;

    function onScroll() {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        root.style.setProperty("--refraction-shift", `${window.scrollY * 0.12}px`);
      });
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
      root.style.removeProperty("--refraction-shift");
    };
  }, []);

  return (
    <div className="hero-refraction" aria-hidden="true">
      <div className="glow" />
      <div className="glow-soft" />
      <div className="streaks" />
      <div className="streaks alt" />
    </div>
  );
}
