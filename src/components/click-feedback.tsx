"use client";

import { useEffect, useRef, useState } from "react";
import { MeoMark } from "@/components/meo-mark";

export function ClickFeedback() {
  const [pulseKey, setPulseKey] = useState<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      const target = event.target as HTMLElement | null;
      const trigger = target?.closest<HTMLElement>("button, [data-fx]");
      if (!trigger) return;
      if (trigger.hasAttribute("data-fx-skip")) return;
      if (trigger.hasAttribute("disabled")) return;

      clearTimeout(timerRef.current);
      setPulseKey(Date.now());
      timerRef.current = setTimeout(() => setPulseKey(null), 650);
    }

    document.addEventListener("click", handleClick, true);
    return () => {
      document.removeEventListener("click", handleClick, true);
      clearTimeout(timerRef.current);
    };
  }, []);

  if (pulseKey === null) return null;

  return (
    <div key={pulseKey} className="click-feedback">
      <div className="click-feedback-glow" />
      <MeoMark size={56} excited className="click-feedback-mark" />
    </div>
  );
}
