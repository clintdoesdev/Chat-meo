"use client";

import { useEffect, useState, type ComponentType } from "react";

function use3DIcon(loader: () => Promise<{ default: ComponentType<{ size: number }> }>) {
  const [Comp, setComp] = useState<ComponentType<{ size: number }> | null>(null);
  useEffect(() => {
    let cancelled = false;
    loader().then((mod) => {
      if (!cancelled) setComp(() => mod.default);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return Comp;
}

export function HeroPaperPlane3D({ size = 150 }: { size?: number }) {
  const Icon = use3DIcon(() => import("@/components/three/paper-plane-icon"));
  return (
    <div style={{ width: size, height: size }} aria-hidden="true">
      {Icon && <Icon size={size} />}
    </div>
  );
}

export function HeroSparkle3D({ size = 84 }: { size?: number }) {
  const Icon = use3DIcon(() => import("@/components/three/sparkle-icon"));
  return (
    <div style={{ width: size, height: size }} aria-hidden="true">
      {Icon && <Icon size={size} />}
    </div>
  );
}
