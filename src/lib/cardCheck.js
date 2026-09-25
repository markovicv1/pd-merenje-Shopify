// Provera pre snimka (uživo) i objedinjavanje rafala snimaka.
// Konstante su kalibrisane na merenjima testera 2026-09-24/25 (desktop EMEET C960, iPhone, Android).
import { median } from './pdMath.js';
import { distanceFromCard } from './cardDistance.js';

// MediaPipe udaljenost × k ≈ stvarna (merena karticom): telefoni ~0,99, desktop kamere ~1,33
// (MediaPipe pretpostavlja FOV 63°, desktop kamere su uže).
export const FACE_DISTANCE_K = { mobile: 1.0, desktop: 1.33 };
export const estimateFaceDistance = (dMpMm, mobile) =>
  dMpMm * (mobile ? FACE_DISTANCE_K.mobile : FACE_DISTANCE_K.desktop);

// Ciljna udaljenost (mm). Testeri na 26–33 cm su posle kalibracije mereni tačno, pa je donja granica 28 cm.
// (38 cm je na starom Android telefonu teralo korisnika na ~1 m, gde zenice više nisu prepoznate.)
export const DIST_MIN_MM = 280;
// Upozorenje o udaljenosti ne blokira snimak duže od ovoga — merenje nikad ne sme da se zaglavi.
export const DIST_BLOCK_MAX_MS = 8000;
export const DIST_MAX_MM = 600;
export const MIN_IPD_PX = 60;

// Asistirani režim (druga osoba drži telefon, zadnja kamera): dozvoljeno i dalje, do ~1 m.
export const DIST_MAX_ASSISTED_MM = 1000;

export function distanceStatusMm(dEstMm, ipdPx, maxMm = DIST_MAX_MM) {
  if (!(ipdPx >= MIN_IPD_PX)) return 'far';
  if (!Number.isFinite(dEstMm)) return 'ok';          // bez procene ne blokiramo
  if (dEstMm < DIST_MIN_MM) return 'close';
  if (dEstMm > maxMm) return 'far';
  return 'ok';
}

// Kartica: centar kartice iznad linije zenica, u razmacima zenica (IPD).
// „Na čelu, iznad obrva" ≈ 0,6–0,9 IPD; kartica na liniji kose je znatno više.
export const CARD_CENTER_MAX_IPD = 1.2;
// Kartica odmaknuta od lica (bliže kameri od lica): udaljenost iz kartice / procena udaljenosti lica.
// Testeri: kartica na licu 0,92–1,06; odmaknuta ~0,86.
export const CARD_OFF_FACE_RATIO = 0.88;

export function cardCenterAbovePupils(markers, pupils) {
  const [p0, p1] = pupils[0].x <= pupils[1].x ? pupils : [pupils[1], pupils[0]];
  const ipd = Math.hypot(p1.x - p0.x, p1.y - p0.y);
  if (!(ipd > 0)) return NaN;
  const n = { x: (p1.y - p0.y) / ipd, y: -(p1.x - p0.x) / ipd }; // naviše, normalno na liniju zenica
  const mc = { x: (markers[0].x + markers[1].x) / 2 - (p0.x + p1.x) / 2, y: (markers[0].y + markers[1].y) / 2 - (p0.y + p1.y) / 2 };
  return (mc.x * n.x + mc.y * n.y) / ipd;
}

// status: 'ok' | 'missing' | 'high' | 'off-face'
export function evaluateCard({ det, minConfidence, pupils, frameH, vfovDeg, dFaceMm }) {
  if (!det || !(det.confidence >= minConfidence)) return { status: 'missing' };
  const above = cardCenterAbovePupils(det.markers, pupils);
  if (above > CARD_CENTER_MAX_IPD) return { status: 'high', above };
  const dCard = distanceFromCard({ cardPx: det.widthPx, frameH, vfovDeg });
  const ratio = Number.isFinite(dFaceMm) && dFaceMm > 0 ? dCard / dFaceMm : NaN;
  if (ratio < CARD_OFF_FACE_RATIO) return { status: 'off-face', above, ratio };
  return { status: 'ok', above, ratio };
}

// Rafal: širine kartice iz više frejmova (samo pouzdane detekcije). Vraća indeks frejma sa medijanskom
// širinom i da li se frejmovi slažu (raspon ≤ 2%). Bez bar 2 pouzdane detekcije → null.
export function aggregateBurst(results, minConfidence) {
  const ok = results.map((r, i) => ({ r, i })).filter(({ r }) => r && r.confidence >= minConfidence);
  if (ok.length < 2) return null;
  const widths = ok.map(({ r }) => r.widthPx);
  const m = median(widths);
  const pick = ok.reduce((a, b) => (Math.abs(b.r.widthPx - m) < Math.abs(a.r.widthPx - m) ? b : a));
  const spread = (Math.max(...widths) - Math.min(...widths)) / m;
  return { index: pick.i, widthPx: m, spread, agree: spread <= 0.02, n: ok.length };
}
