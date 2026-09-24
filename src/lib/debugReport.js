// Debug režim (?debug=1, opciono &fantom=1) — dijagnostika preciznosti po uređaju.
// Kada debug nije uključen, ništa odavde ne menja ponašanje aplikacije.
import {
  CARD_WIDTH_MM, CARD_DEPTH_OFFSET_MM, EYE_ROTATION_OFFSET_MM, sanitizeDistanceMm,
} from './pdMath.js';

// MediaPipe iris konture (refined landmarks): 468 centar, 469/471 horizontalne ivice; 473 centar, 474/476.
export const IRIS_H_EDGES = { left: [469, 471], right: [474, 476] };

export function parseDebugFlags(search) {
  const p = new URLSearchParams(search);
  const on = (k) => p.has(k) && p.get(k) !== '0';
  const debug = on('debug');
  return { debug, phantom: debug && on('fantom') };
}

// Horizontalni prečnik šarenice u pikselima (normalizovane koordinate × dimenzije frejma).
export function irisDiameterPx(lm, [a, b], width, height) {
  const p = lm?.[a], q = lm?.[b];
  if (!p || !q) return NaN;
  return Math.hypot((p.x - q.x) * width, (p.y - q.y) * height);
}

const r = (v, d = 2) => (Number.isFinite(v) ? Number(v.toFixed(d)) : null);

// Sastavlja izveštaj jednog merenja. Sve mere u pikselima su u pikselima izvornog snimka.
export function buildReport({
  capture = {}, camera = {}, env = {},
  cardSrcPx, pupilSrcPx, pupilPrefillShiftPx,
  cardPosition, distanceMm, pdFinal, phantom = false,
  distanceMpMm = distanceMm, distanceCardMm = NaN, distanceSource = 'mediapipe', vfovDeg = NaN,
  cardDetect = null, cardMarkersMovedPx = null,
}) {
  const mmPerPx = cardSrcPx > 0 ? CARD_WIDTH_MM / cardSrcPx : NaN;
  const rawPd = pupilSrcPx * mmPerPx;
  const d = sanitizeDistanceMm(distanceMm);
  const delta = CARD_DEPTH_OFFSET_MM[cardPosition] ?? CARD_DEPTH_OFFSET_MM.nose;
  const parallax = 1 + delta / d;
  const vergence = phantom ? 1 : 1 + EYE_ROTATION_OFFSET_MM / d;
  const irisMm = (capture.irisDiameterPx ?? []).map((px) => r(px * mmPerPx));

  return {
    version: 1,
    timestamp: new Date().toISOString(),
    mode: phantom ? 'fantom' : 'normal',
    env,
    camera,
    capture: {
      ...capture,
      irisDiameterPx: (capture.irisDiameterPx ?? []).map((v) => r(v, 1)),
    },
    measurement: {
      cardSrcPx: r(cardSrcPx, 1),
      mmPerPx: r(mmPerPx, 4),
      pupilSrcPx: r(pupilSrcPx, 1),
      pupilPrefillShiftPx: r(pupilPrefillShiftPx, 1),
      cardPosition,
      distanceSource,
      distanceMpMm: r(distanceMpMm, 0),
      distanceCardMm: r(distanceCardMm, 0),
      vfovDeg: r(vfovDeg, 1),
      distanceUsedMm: r(d, 0),
      distanceSanitized: !Number.isFinite(distanceMm) || d !== distanceMm,
      rawPdMm: r(rawPd),
      parallaxFactor: r(parallax, 4),
      vergenceFactor: r(vergence, 4),
      correctedPdMm: r(rawPd * parallax * vergence),
      finalPdMm: pdFinal ?? null,
      irisDiameterMm: irisMm,
      cardDetect: cardDetect ? {
        used: !!cardDetect.used,
        confidence: r(cardDetect.confidence),
        widthPx: r(cardDetect.widthPx, 1),
        heightPx: r(cardDetect.heightPx, 0),
        tiltDeg: r(cardDetect.tiltDeg, 1),
        coverage: r(cardDetect.coverage),
      } : null,
      cardMarkersMovedPx: r(cardMarkersMovedPx, 1),
    },
  };
}
