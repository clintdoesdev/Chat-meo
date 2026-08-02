"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { hexToHsv, hsvToHex, isValidHexColor, type Hsv } from "@/lib/color";

const PANEL_WIDTH = 232;
const SQUARE_SIZE = 200;
const VIEWPORT_MARGIN = 12;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** A from-scratch saturation/value square + hue slider, in the style of Illustrator/Figma's
 * color picker — replacing <input type="color">, which hands off to whatever native OS picker
 * the browser has (a plain 8-swatch grid on Android, see the screenshot this was built from)
 * and looks nothing like the rest of this app. */
export function ColorPicker({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const [open, setOpen] = useState(false);
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(value));
  const [hexInput, setHexInput] = useState(value);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const swatchRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const squareRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);

  // Follow external value changes (e.g. a theme preset button) without fighting drag-in-progress
  // updates — only resync when this picker isn't the thing currently changing the color.
  useEffect(() => {
    if (!open) {
      setHsv(hexToHsv(value));
      setHexInput(value);
    }
  }, [value, open]);

  useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent) {
      const target = event.target as Node;
      if (swatchRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function openPicker() {
    if (swatchRef.current) {
      const rect = swatchRef.current.getBoundingClientRect();
      const left = clamp(rect.left, VIEWPORT_MARGIN, window.innerWidth - PANEL_WIDTH - VIEWPORT_MARGIN);
      const top = Math.min(rect.bottom + 8, window.innerHeight - 320);
      setCoords({ top, left });
    }
    setHsv(hexToHsv(value));
    setHexInput(value);
    setOpen(true);
  }

  function commit(next: Hsv) {
    setHsv(next);
    const hex = hsvToHex(next);
    setHexInput(hex);
    onChange(hex);
  }

  function handleSquarePointer(event: React.PointerEvent) {
    const square = squareRef.current;
    if (!square) return;
    square.setPointerCapture(event.pointerId);

    function update(clientX: number, clientY: number) {
      const rect = square!.getBoundingClientRect();
      const s = clamp((clientX - rect.left) / rect.width, 0, 1);
      const v = 1 - clamp((clientY - rect.top) / rect.height, 0, 1);
      commit({ ...hsv, s, v });
    }

    update(event.clientX, event.clientY);

    function onMove(moveEvent: PointerEvent) {
      update(moveEvent.clientX, moveEvent.clientY);
    }
    function onUp() {
      square!.removeEventListener("pointermove", onMove);
      square!.removeEventListener("pointerup", onUp);
    }
    square.addEventListener("pointermove", onMove);
    square.addEventListener("pointerup", onUp);
  }

  function handleHuePointer(event: React.PointerEvent) {
    const hue = hueRef.current;
    if (!hue) return;
    hue.setPointerCapture(event.pointerId);

    function update(clientX: number) {
      const rect = hue!.getBoundingClientRect();
      const h = clamp((clientX - rect.left) / rect.width, 0, 1) * 360;
      commit({ ...hsv, h });
    }

    update(event.clientX);

    function onMove(moveEvent: PointerEvent) {
      update(moveEvent.clientX);
    }
    function onUp() {
      hue!.removeEventListener("pointermove", onMove);
      hue!.removeEventListener("pointerup", onUp);
    }
    hue.addEventListener("pointermove", onMove);
    hue.addEventListener("pointerup", onUp);
  }

  function handleHexSubmit(raw: string) {
    setHexInput(raw);
    const hex = raw.startsWith("#") ? raw : `#${raw}`;
    if (isValidHexColor(hex)) {
      setHsv(hexToHsv(hex));
      onChange(hex);
    }
  }

  const hueColor = hsvToHex({ h: hsv.h, s: 1, v: 1 });
  const currentHex = hsvToHex(hsv);

  return (
    <div className="relative inline-block">
      <button
        ref={swatchRef}
        type="button"
        data-fx-skip
        aria-label="Pick a color"
        onClick={() => (open ? setOpen(false) : openPicker())}
        className="h-9 w-9 flex-shrink-0 cursor-pointer rounded-lg border border-line-2 shadow-[inset_0_0_0_2px_rgba(0,0,0,.25)]"
        style={{ background: value }}
      />
      {open &&
        coords &&
        createPortal(
          <div
            ref={panelRef}
            style={{ top: coords.top, left: coords.left, width: PANEL_WIDTH }}
            className="fixed z-[100] flex flex-col gap-3 rounded-2xl border border-line-2 bg-[#1c1c1c] p-3.5 shadow-[0_30px_60px_-16px_rgba(0,0,0,.9)]"
          >
            <div
              ref={squareRef}
              onPointerDown={handleSquarePointer}
              className="relative touch-none rounded-xl"
              style={{
                width: SQUARE_SIZE,
                height: 140,
                background: `linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent), ${hueColor}`,
              }}
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,.4)]"
                style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%` }}
              />
            </div>

            <div
              ref={hueRef}
              onPointerDown={handleHuePointer}
              className="relative h-3.5 touch-none rounded-full"
              style={{
                background:
                  "linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)",
              }}
            >
              <span
                aria-hidden="true"
                className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,.4)]"
                style={{ left: `${(hsv.h / 360) * 100}%` }}
              />
            </div>

            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="h-8 w-8 flex-shrink-0 rounded-lg border border-line-2"
                style={{ background: currentHex }}
              />
              <input
                value={hexInput}
                onChange={(event) => handleHexSubmit(event.target.value)}
                spellCheck={false}
                className="w-full rounded-[10px] border border-line-2 bg-card-2 px-2.5 py-2 font-mono text-[12.5px] text-text focus:border-orange-2/60 focus:outline-none"
              />
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
