import { describe, expect, it } from "vitest";
import { hexToHsv, hsvToHex } from "./color";

describe("hexToHsv / hsvToHex", () => {
  it("round-trips primary brand colors", () => {
    for (const hex of ["#ff5c16", "#25d366", "#2aabee", "#7c5cff", "#ff4d8d", "#000000", "#ffffff"]) {
      expect(hsvToHex(hexToHsv(hex))).toBe(hex);
    }
  });

  it("converts known values correctly", () => {
    expect(hexToHsv("#ff0000")).toEqual({ h: 0, s: 1, v: 1 });
    expect(hsvToHex({ h: 0, s: 1, v: 1 })).toBe("#ff0000");
    expect(hsvToHex({ h: 0, s: 0, v: 0 })).toBe("#000000");
    expect(hsvToHex({ h: 0, s: 0, v: 1 })).toBe("#ffffff");
  });
});
