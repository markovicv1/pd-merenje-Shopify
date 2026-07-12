// ── Kalibracione konstante ──────────────────────────────────────────────
// Početne vrednosti; finalno podešavanje empirijskom validacijom (pupilometar).
export const CARD_WIDTH_MM = 85.6;
export const CARD_DEPTH_OFFSET_MM = { forehead: 10, nose: 20 }; // kartica ispred ravni zenica
export const EYE_ROTATION_OFFSET_MM = 10.5; // ulazna pupila → centar rotacije oka
export const DEFAULT_DISTANCE_MM = 450;
export const MIN_DISTANCE_MM = 250;
export const MAX_DISTANCE_MM = 900;

export function median(arr) {
  if (!arr.length) return NaN;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function roundToHalfMm(v) {
  return Math.round(v * 2) / 2;
}
