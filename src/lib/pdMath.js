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

export function sanitizeDistanceMm(d) {
  return Number.isFinite(d) && d >= MIN_DISTANCE_MM && d <= MAX_DISTANCE_MM
    ? d : DEFAULT_DISTANCE_MM;
}

// Y koordinate u % visine slike (y raste nadole). Kartica iznad zenica → čelo.
export function classifyCardPosition(cardYPct, pupilYPct) {
  return cardYPct < pupilYPct - 5 ? 'forehead' : 'nose';
}

// Paralaksa: skala mm/px važi na dubini kartice, zenice su Δ dalje od kamere.
export function correctParallax(pdMm, distanceMm, cardPosition) {
  const delta = CARD_DEPTH_OFFSET_MM[cardPosition] ?? CARD_DEPTH_OFFSET_MM.nose;
  return pdMm * (1 + delta / distanceMm);
}

// Konvergencija: pogled fiksira kameru na distanceMm → distance PD je veći od merenog.
export function correctVergence(pdMm, distanceMm) {
  return pdMm * (1 + EYE_ROTATION_OFFSET_MM / distanceMm);
}

export function computeCorrectedPd({ rawPdMm, distanceMm, cardPosition }) {
  const d = sanitizeDistanceMm(distanceMm);
  return roundToHalfMm(correctVergence(correctParallax(rawPdMm, d, cardPosition), d));
}
