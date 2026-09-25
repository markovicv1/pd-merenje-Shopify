// Uslovi za snimak koji ne zavise od rezolucije kamere.

// Razmak zenica kao udeo širine kadra (ne apsolutni pikseli): isti opseg važi za 640 px i 1440 px kameru.
// Telefon (~53° horizontalno u portretu): 11–20% ≈ 31–57 cm.
export const IPD_FRAC_MIN = 0.11;
export const IPD_FRAC_MAX = 0.20;
export const MIN_IPD_PX = 60; // donja granica rezolucije za kamere niske rezolucije

export function distanceStatus(ipdPx, frameW) {
  if (!(ipdPx > 0) || !(frameW > 0)) return 'far';
  const f = ipdPx / frameW;
  if (ipdPx < MIN_IPD_PX || f < IPD_FRAC_MIN) return 'far';
  if (f > IPD_FRAC_MAX) return 'close';
  return 'ok';
}

// Osvetljenje: srednja luminansa (0–255) oblasti očiju i čela.
export const MIN_LUMA = 55;

export function meanLuma(rgba) {
  let sum = 0, n = 0;
  for (let i = 0; i < rgba.length; i += 4) {
    sum += 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
    n++;
  }
  return n ? sum / n : NaN;
}

// Oštrina: varijansa Laplasijana na sivoj slici (za debug i buduće podešavanje praga).
export function laplacianVariance(rgba, w, h) {
  if (w < 3 || h < 3) return NaN;
  const g = new Float32Array(w * h);
  for (let i = 0, j = 0; j < g.length; i += 4, j++) g[j] = 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
  let sum = 0, sum2 = 0, n = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const k = y * w + x;
      const v = g[k - w] + g[k + w] + g[k - 1] + g[k + 1] - 4 * g[k];
      sum += v; sum2 += v * v; n++;
    }
  }
  const m = sum / n;
  return sum2 / n - m * m;
}

// Oblast očiju i čela u pikselima frejma (za merenje svetla/oštrine).
export function eyeForeheadRoi(l, r, frameW, frameH) {
  const ipd = Math.hypot(r.x - l.x, r.y - l.y);
  const x0 = Math.max(0, Math.min(l.x, r.x) - 0.4 * ipd);
  const x1 = Math.min(frameW, Math.max(l.x, r.x) + 0.4 * ipd);
  const cy = (l.y + r.y) / 2;
  const y0 = Math.max(0, cy - 1.1 * ipd);
  const y1 = Math.min(frameH, cy + 0.3 * ipd);
  return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
}

// Mirovanje za snimak. Ne gledamo apsolutni položaj zenica u kadru: kada se telefon drži u ruci (tremor,
// bez optičke stabilizacije), celo lice se pomera po kadru, a to merenju ne smeta — PD se računa iz odnosa
// zenica i kartice na JEDNOM frejmu. Bitno je:
//  - razmera: razmak zenica (px) stabilan → udaljenost se ne menja;
//  - brzina: pomeraj između uzastopnih frejmova mali → slika nije razmazana.
export const STILL_SCALE_FRAC = 0.025; // SD razmaka zenica < 2,5% razmaka
export const STILL_SPEED_FRAC = 0.025; // medijana pomeraja po frejmu < 2,5% razmaka zenica
export const STILL_SPEED_WINDOW = 10;  // poslednjih N frejmova za brzinu

// relax > 1: blaži prag dok odbrojavanje već traje (da ga jedan trzaj ne prekine)
export function stillness(hist, minFrames, relax = 1) {
  if (!hist || hist.length < minFrames) return { ok: false, scale: NaN, speed: NaN };
  const ipd = hist.map(h => Math.hypot(h.rX - h.lX, h.rY - h.lY));
  const mean = ipd.reduce((a, b) => a + b, 0) / ipd.length;
  const sd = Math.sqrt(ipd.reduce((a, b) => a + (b - mean) ** 2, 0) / ipd.length);
  const tail = hist.slice(-STILL_SPEED_WINDOW);
  const steps = [];
  for (let i = 1; i < tail.length; i++) {
    const a = tail[i - 1], b = tail[i];
    steps.push(Math.hypot((b.lX + b.rX - a.lX - a.rX) / 2, (b.lY + b.rY - a.lY - a.rY) / 2));
  }
  steps.sort((a, b) => a - b);
  const med = steps.length ? steps[steps.length >> 1] : 0;
  const scale = mean > 0 ? sd / mean : Infinity;
  const speed = mean > 0 ? med / mean : Infinity;
  return { ok: scale < STILL_SCALE_FRAC * relax && speed < STILL_SPEED_FRAC * relax, scale, speed };
}
