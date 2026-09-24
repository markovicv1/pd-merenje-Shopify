// Geometrija koraka podešavanja. Sve koordinate su u pikselima izvornog snimka.
import { CARD_WIDTH_MM } from './pdMath.js';

export const ZOOM_WIDTH_IPD = 2.8;      // širina uvećanog prikaza u razmacima zenica → kartica ≈ 50% širine
const ASSUMED_PD_MM = 63;               // samo za početni položaj markera kartice
const CARD_CENTER_ABOVE_PUPILS_MM = 45; // kartica na čelu, centar iznad linije zenica

const mid = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
export const distPx = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// 3:4 isečak oko očiju i čela; ceo snimak ako zenice nisu poznate.
export function zoomRect(pupils, imgW, imgH, widthIpd = ZOOM_WIDTH_IPD) {
  const full = { x: 0, y: 0, w: imgW, h: imgH };
  if (!pupils || pupils.length !== 2) return full;
  const ipd = distPx(pupils[0], pupils[1]);
  if (!(ipd > 0)) return full;
  let w = Math.min(imgW, ipd * widthIpd);
  let h = (w * 4) / 3;
  if (h > imgH) { h = imgH; w = (h * 3) / 4; }
  const c = mid(pupils[0], pupils[1]);
  const cy = c.y - 0.35 * ipd; // pomereno naviše da stane kartica na čelu
  return {
    x: clamp(c.x - w / 2, 0, imgW - w),
    y: clamp(cy - h / 2, 0, imgH - h),
    w, h,
  };
}

// Početni položaj markera kartice: procena ivica kartice na čelu iz položaja zenica.
export function cardPrefill(pupils, imgW, imgH) {
  if (!pupils || pupils.length !== 2 || !(distPx(pupils[0], pupils[1]) > 0)) {
    return [{ x: imgW * 0.3, y: imgH * 0.35 }, { x: imgW * 0.7, y: imgH * 0.35 }];
  }
  const ipd = distPx(pupils[0], pupils[1]);
  const pxPerMm = ipd / ASSUMED_PD_MM;
  const c = mid(pupils[0], pupils[1]);
  const half = (CARD_WIDTH_MM / 2) * pxPerMm;
  const y = clamp(c.y - CARD_CENTER_ABOVE_PUPILS_MM * pxPerMm, 0, imgH);
  return [
    { x: clamp(c.x - half, 0, imgW), y },
    { x: clamp(c.x + half, 0, imgW), y },
  ];
}

// Sirovi PD iz markera (px izvora); null ako je kartica premala.
export function rawPdFromMarkers(cardMarkers, pupilMarkers) {
  const cardPx = distPx(cardMarkers[0], cardMarkers[1]);
  if (cardPx < 10) return null;
  const pupilPx = distPx(pupilMarkers[0], pupilMarkers[1]);
  return { cardPx, pupilPx, rawPdMm: pupilPx * (CARD_WIDTH_MM / cardPx) };
}
