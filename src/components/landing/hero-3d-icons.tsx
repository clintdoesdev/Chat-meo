"use client";

import { useEffect, useState, type ComponentType } from "react";
import type { GlassIconType } from "@/components/three/glass-icon-shapes";

type GlassIconProps = { icon: GlassIconType; size: number };

export function HeroGlassIcon({ icon, size }: GlassIconProps) {
  const [Comp, setComp] = useState<ComponentType<GlassIconProps> | null>(null);

  useEffect(() => {
    let cancelled = false;
    import("@/components/three/glass-icon").then((mod) => {
      if (!cancelled) setComp(() => mod.default);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={{ width: size, height: size }} aria-hidden="true">
      {Comp && <Comp icon={icon} size={size} />}
    </div>
  );
}
