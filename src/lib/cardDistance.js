// B4 — udaljenost kamere iz poznate širine kartice umesto iz MediaPipe modela lica.
// MediaPipe pretpostavlja vertikalni FOV 63° i prosečno lice; kartica ima tačno poznatu širinu,
// pa ostaje samo nepoznat FOV kamere, koji procenjujemo po klasi uređaja.
import { CARD_WIDTH_MM, CARD_DEPTH_OFFSET_MM } from './pdMath.js';

// Vertikalni FOV (stepeni) za vertikalnu dimenziju frejma.
// Telefon u portretu: vertikala je duža strana senzora prednje kamere (~23–26 mm ekv.).
// Desktop/laptop: vertikala je kraća strana senzora (i kad Chrome iseče portret, visina ostaje cela).
// Kalibracija: EMEET C960 2K ≈ 44–45° (merenja 2026-09-24).
// Zadnja (glavna) kamera telefona (asistirani režim): Chrome daje 1440×1080 isečen iz 16:9 režima senzora → uska vertikala.
// Kalibracija: stari Android 10, „camera 0, facing back", kartica 282,2 px, udaljenost ~55 cm (procena testera, ne metar)
// → vertikalni FOV ≈ 33,5° (2026-09-25). Samo jedna tačka — potvrditi merenjem metrom i na iPhone-u.
export const VFOV_PRIOR = { phonePortrait: 70, phoneLandscape: 55, desktop: 45, rearPortrait: 44, rearLandscape: 33.5 };

export function vfovPrior({ mobile, frameW, frameH, rear = false }) {
  if (mobile && rear) return frameH >= frameW ? VFOV_PRIOR.rearPortrait : VFOV_PRIOR.rearLandscape;
  if (mobile) return frameH >= frameW ? VFOV_PRIOR.phonePortrait : VFOV_PRIOR.phoneLandscape;
  return VFOV_PRIOR.desktop;
}

// Žižna daljina u pikselima frejma iz vertikalnog FOV-a.
export const focalPx = (frameH, vfovDeg) => (frameH / 2) / Math.tan((vfovDeg * Math.PI) / 360);

// Udaljenost kamere do ravni zenica (mm): kartica je CARD_DEPTH_OFFSET ispred zenica.
export function distanceFromCard({ cardPx, frameH, vfovDeg, cardPosition = 'forehead' }) {
  if (!(cardPx > 0) || !(frameH > 0) || !(vfovDeg > 0 && vfovDeg < 170)) return NaN;
  const dCard = (focalPx(frameH, vfovDeg) * CARD_WIDTH_MM) / cardPx;
  return dCard + (CARD_DEPTH_OFFSET_MM[cardPosition] ?? CARD_DEPTH_OFFSET_MM.nose);
}

// ?vfov=52 (samo za debug/kalibraciju) — ručno zadat FOV konkretne kamere.
export function parseVfovOverride(search) {
  const v = Number(new URLSearchParams(search).get('vfov'));
  return v > 10 && v < 170 ? v : null;
}
