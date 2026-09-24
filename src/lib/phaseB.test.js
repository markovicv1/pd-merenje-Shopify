import { describe, it, expect } from 'vitest';
import { detectCardEdges, CARD_DETECT_MIN_CONFIDENCE } from './cardDetect.js';
import { distanceFromCard, focalPx, vfovPrior, parseVfovOverride, VFOV_PRIOR } from './cardDistance.js';

// Veštačka slika: koža, kartica (svetlija, sa tamnom trakom), zenice, šum, opcioni „prst" preko leve ivice.
function scene({ W = 1080, H = 1440, ipd = 210, cardW = 290, rollDeg = 0, finger = false, card = true, seed = 7 } = {}) {
  const g = new Float32Array(W * H);
  let s = seed; const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  const cx = 540, py = 640, rot = (rollDeg * Math.PI) / 180, cs = Math.cos(rot), sn = Math.sin(rot);
  const cardH = cardW * 53.98 / 85.6, ccy = py - 0.72 * ipd;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let v = 120 + 10 * Math.sin(x / 90) + 8 * Math.cos(y / 70);            // koža
    const dx = x - cx, dy = y - ccy, u = dx * cs + dy * sn, t = -dx * sn + dy * cs; // u koordinatama kartice
    if (card && Math.abs(u) <= cardW / 2 && Math.abs(t) <= cardH / 2) {
      v = t < -cardH * 0.15 && t > -cardH * 0.38 ? 20 : 200;               // magnetna traka
    }
    if (finger && x > cx - cardW / 2 - 90 && x < cx - 20 && y > ccy - 10 && y < ccy + 45) v = 170; // prst
    g[y * W + x] = v + (rnd() - 0.5) * 16;
  }
  const pupils = [{ x: cx - (ipd / 2) * cs, y: py - (ipd / 2) * sn }, { x: cx + (ipd / 2) * cs, y: py + (ipd / 2) * sn }];
  for (const p of pupils) for (let y = -12; y <= 12; y++) for (let x = -12; x <= 12; x++) if (x * x + y * y < 144) g[(Math.round(p.y) + y) * W + Math.round(p.x) + x] = 15;
  return { gray: g, width: W, height: H, pupils };
}

describe('detectCardEdges', () => {
  it('ravna kartica: širina u okviru 0,5%', () => {
    const r = detectCardEdges(scene());
    expect(r).not.toBeNull();
    expect(Math.abs(r.widthPx / 290 - 1)).toBeLessThan(0.005);
    expect(r.confidence).toBeGreaterThanOrEqual(CARD_DETECT_MIN_CONFIDENCE);
  });
  it('prst delimično preko leve ivice: i dalje tačno', () => {
    const r = detectCardEdges(scene({ finger: true }));
    expect(Math.abs(r.widthPx / 290 - 1)).toBeLessThan(0.01);
  });
  it('nagnuta glava (5°): širina normalno na ivice', () => {
    const r = detectCardEdges(scene({ rollDeg: 5 }));
    expect(Math.abs(r.widthPx / 290 - 1)).toBeLessThan(0.01);
    const d = Math.hypot(r.markers[1].x - r.markers[0].x, r.markers[1].y - r.markers[0].y);
    expect(Math.abs(d - r.widthPx)).toBeLessThan(0.01);   // razmak markera = širina kartice
  });
  it('bez kartice: nema pouzdanog rezultata', () => {
    const r = detectCardEdges(scene({ card: false }));
    expect(!r || r.confidence < CARD_DETECT_MIN_CONFIDENCE).toBe(true);
  });
  it('bez zenica → null', () => expect(detectCardEdges({ ...scene(), pupils: null })).toBeNull());
});

describe('cardDistance (B4)', () => {
  it('žižna daljina iz FOV-a', () => expect(focalPx(1440, 90)).toBeCloseTo(720, 6));
  it('kartica 85,6 mm na 1440 px, FOV 90°, 123,28 px → karta na 500 mm, zenice 510', () =>
    expect(distanceFromCard({ cardPx: 720 * 85.6 / 500, frameH: 1440, vfovDeg: 90 })).toBeCloseTo(510, 6));
  it('prior po uređaju', () => {
    expect(vfovPrior({ mobile: true, frameW: 1080, frameH: 1440 })).toBe(VFOV_PRIOR.phonePortrait);
    expect(vfovPrior({ mobile: true, frameW: 1440, frameH: 1080 })).toBe(VFOV_PRIOR.phoneLandscape);
    expect(vfovPrior({ mobile: false, frameW: 1080, frameH: 1440 })).toBe(VFOV_PRIOR.desktop);
  });
  it('nevalidni ulazi → NaN', () => {
    expect(distanceFromCard({ cardPx: 0, frameH: 1440, vfovDeg: 45 })).toBeNaN();
    expect(distanceFromCard({ cardPx: 200, frameH: 1440, vfovDeg: 0 })).toBeNaN();
  });
  it('?vfov override', () => {
    expect(parseVfovOverride('?debug=1&vfov=52')).toBe(52);
    expect(parseVfovOverride('?vfov=abc')).toBeNull();
    expect(parseVfovOverride('')).toBeNull();
  });
  it('EMEET kalibracija: 292,8 px na 1440 px, 45° → ~53 cm (korisnik: ~55 cm)', () => {
    const d = distanceFromCard({ cardPx: 292.8, frameH: 1440, vfovDeg: 45 });
    expect(d).toBeGreaterThan(480); expect(d).toBeLessThan(560);
  });
});
