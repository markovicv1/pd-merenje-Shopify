// ── Kalibracione konstante ──────────────────────────────────────────────
// Kalibrisano 2026-09-25 na 6 osoba / 10 merenja sa referentnim PD-om (oftalmolog/optometrista),
// iPhone + Android: čelo 10 → 6 mm (prosečna greška +0,85 → 0,0 mm; sve unutar ±1,5 mm;
// unakrsna provera po osobi: SD 1,1 mm, max 2,0 mm). Nos nije kalibrisan (uputstvo je samo čelo).
export const CARD_WIDTH_MM = 85.6;
export const CARD_DEPTH_OFFSET_MM = { forehead: 6, nose: 20 }; // kartica ispred ravni zenica
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

// includeVergence: false samo za fantom (odštampane oči ne konvergiraju).
export function computeCorrectedPd(args) {
  return roundToHalfMm(computeCorrectedPdExact(args));
}

// Isto, bez zaokruživanja — za prosek više snimaka.
export function computeCorrectedPdExact({ rawPdMm, distanceMm, cardPosition, includeVergence = true }) {
  const d = sanitizeDistanceMm(distanceMm);
  const pd = correctParallax(rawPdMm, d, cardPosition);
  return includeVergence ? correctVergence(pd, d) : pd;
}

// Više nezavisnih snimaka (asistirani režim): kartica se između snimaka ponovo prislanja,
// pa se greške držanja kartice i oznaka delimično poništavaju.
export const SHOTS_BASE = 2;
export const SHOTS_MAX = 3;
export const SHOTS_MAX_DIFF_MM = 2; // dva snimka koja se razlikuju više od ovoga → treći snimak

export function shotsNeeded(values) {
  if (values.length < SHOTS_BASE) return SHOTS_BASE;
  if (values.length === SHOTS_BASE && Math.abs(values[0] - values[1]) > SHOTS_MAX_DIFF_MM) return SHOTS_MAX;
  return values.length;
}

// 2 snimka → prosek; 3 → medijana (odbacuje odstupajući snimak). Zaokruženo na 0,5 mm.
export function combineShots(values) {
  if (!values.length) return NaN;
  const v = values.length >= 3 ? median(values) : values.reduce((a, b) => a + b, 0) / values.length;
  return roundToHalfMm(v);
}
