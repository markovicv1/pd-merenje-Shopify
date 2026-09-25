// Obrisi 7 oblika lica za animaciju (isti kao u anketi — public/anketa/index.html).
// viewBox 100×130; polu-širine na visinama OUTLINE_Y, vrh čela i brada.
export const OUTLINE_Y = [18, 30, 50, 70, 90, 105, 116];
export const OUTLINE_PROFILE = {
  oval:     { top: 8,  chin: 124, w: [20, 30, 36, 37, 32, 22, 11] },
  round:    { top: 12, chin: 120, w: [26, 36, 41, 42, 39, 30, 16] },
  oblong:   { top: 4,  chin: 128, w: [22, 29, 31, 31, 30, 25, 14] },
  square:   { top: 10, chin: 122, w: [30, 36, 38, 38, 38, 34, 22] },
  heart:    { top: 8,  chin: 124, w: [30, 38, 40, 37, 29, 18, 6] },
  triangle: { top: 10, chin: 122, w: [16, 24, 31, 36, 40, 36, 22] },
  diamond:  { top: 8,  chin: 124, w: [12, 22, 34, 40, 30, 18, 7] },
};

// Zatvorena Catmull-Rom kriva kroz tačke obrisa → SVG path (radi i sa Path2D)
export function outlinePath(key) {
  const p = OUTLINE_PROFILE[key];
  const pts = [[50, p.top], ...OUTLINE_Y.map((y, i) => [50 + p.w[i], y]), [50, p.chin],
    ...OUTLINE_Y.map((y, i) => [50 - p.w[i], y]).reverse()];
  const n = pts.length;
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d + 'Z';
}

// Vertikalni raspon obrisa (za skaliranje na lice: vrh čela → brada)
export const outlineSpan = (key) => OUTLINE_PROFILE[key].chin - OUTLINE_PROFILE[key].top;
