"use client";

import { useEffect, useState } from "react";
import { MeoMark } from "@/components/meo-mark";

/** Route transitions that resolve almost instantly shouldn't flash a full-screen mascot at all —
 * that reads as the page glitching, not loading, and can make people click again thinking their
 * first click missed. Stay invisible for a beat; only fade in once a navigation is genuinely
 * taking a moment, then hold until Next unmounts us (i.e. until the route actually finishes). */
const SHOW_DELAY_MS = 220;

/** Full-screen loading state: a solid, heartbeat-pulsing Meo with blinking eyes. */
export function LoadingMeo() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      // Next's loading.tsx mounts in place of the route's children — inside <main>, below the
      // sticky header, inset by its padding — so min-h-screen centered within *that* box lands
      // visibly off-center in the real viewport. Fixed positioning centers it in the actual
      // viewport regardless of how deep in the layout this ends up mounted.
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-bg transition-opacity duration-200 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="relative flex items-center justify-center">
        <div
          aria-hidden="true"
          className="meo-heartbeat-glow absolute h-[150px] w-[150px] rounded-full bg-orange/40 blur-[32px]"
        />
        <div className="meo-heartbeat">
          <MeoMark size={72} excited />
        </div>
      </div>
    </div>
  );
}
