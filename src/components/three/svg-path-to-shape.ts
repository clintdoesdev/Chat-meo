import * as THREE from "three";

/** Minimal SVG path (M/L/H/V/C/S/Z, absolute or relative) -> THREE.Shape parser. */
export function svgPathToShape(d: string): THREE.Shape {
  const shape = new THREE.Shape();
  // Numbers use either digits-then-optional-fraction or a leading-dot fraction —
  // never a combined group, or adjacent implicit numbers like "-.7.7" (two
  // values, "-.7" and ".7") get swallowed into one malformed token.
  const tokens = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/g) ?? [];
  let i = 0;
  let cmd = "";
  let cx = 0;
  let cy = 0;
  let px: number | null = null;
  let py: number | null = null;
  let sx = 0;
  let sy = 0;

  function num(): number {
    return parseFloat(tokens[i++]);
  }

  while (i < tokens.length) {
    const t = tokens[i];
    if (/[a-zA-Z]/.test(t)) {
      cmd = t;
      i++;
    }
    const rel = cmd === cmd.toLowerCase();
    switch (cmd.toUpperCase()) {
      case "M": {
        let x = num();
        let y = num();
        if (rel) {
          x += cx;
          y += cy;
        }
        cx = x;
        cy = y;
        sx = x;
        sy = y;
        px = py = null;
        shape.moveTo(x, y);
        cmd = rel ? "l" : "L";
        break;
      }
      case "L": {
        let x = num();
        let y = num();
        if (rel) {
          x += cx;
          y += cy;
        }
        shape.lineTo(x, y);
        cx = x;
        cy = y;
        px = py = null;
        break;
      }
      case "H": {
        let x = num();
        if (rel) x += cx;
        shape.lineTo(x, cy);
        cx = x;
        px = py = null;
        break;
      }
      case "V": {
        let y = num();
        if (rel) y += cy;
        shape.lineTo(cx, y);
        cy = y;
        px = py = null;
        break;
      }
      case "C": {
        let x1 = num();
        let y1 = num();
        let x2 = num();
        let y2 = num();
        let x = num();
        let y = num();
        if (rel) {
          x1 += cx;
          y1 += cy;
          x2 += cx;
          y2 += cy;
          x += cx;
          y += cy;
        }
        shape.bezierCurveTo(x1, y1, x2, y2, x, y);
        px = x2;
        py = y2;
        cx = x;
        cy = y;
        break;
      }
      case "S": {
        let x2 = num();
        let y2 = num();
        let x = num();
        let y = num();
        if (rel) {
          x2 += cx;
          y2 += cy;
          x += cx;
          y += cy;
        }
        const x1 = px === null ? cx : 2 * cx - px;
        const y1 = py === null ? cy : 2 * cy - py;
        shape.bezierCurveTo(x1, y1, x2, y2, x, y);
        px = x2;
        py = y2;
        cx = x;
        cy = y;
        break;
      }
      case "Z": {
        shape.closePath();
        cx = sx;
        cy = sy;
        px = py = null;
        break;
      }
      default:
        i++;
    }
  }
  return shape;
}
