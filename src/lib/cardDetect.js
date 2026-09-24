// B1 — automatska detekcija leve i desne ivice kartice na čelu, sa preciznošću ispod piksela.
//
// Postupak:
// 1. Iz položaja zenica pravi se „ispravljena traka" iznad očiju: osa u ide duž linije zenica,
//    osa t naviše (normalno na nju). Tako su ivice kartice (paralelne sa licem) uspravne linije.
// 2. Za svaku kolonu traka skuplja dokaze za uspravnu ivicu (horizontalni gradijent jači od vertikalnog).
// 3. Parovi kandidata se biraju po širini (1,15–1,62 × razmak zenica, tj. PD ≈ 53–75 mm), položaju i postojanju
//    gornje i donje ivice kartice između njih (odnos stranica 85,6 × 53,98, uz nagib čela).
// 4. Svaka ivica se dotera po redovima (parabola oko maksimuma gradijenta), kroz redove se provuče
//    prava (dozvoljava blago zakretanje kartice), a širina se meri normalno na ivice.
import { CARD_WIDTH_MM } from './pdMath.js';

const CARD_ASPECT = 53.98 / CARD_WIDTH_MM;

// RGBA → siva (Float32Array)
export function toGray(rgba, w, h) {
  const g = new Float32Array(w * h);
  for (let i = 0, j = 0; j < g.length; i += 4, j++) g[j] = 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
  return g;
}

function bilinear(gray, w, h, x, y) {
  if (x < 0 || y < 0 || x > w - 1.001 || y > h - 1.001) return NaN;
  const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0, k = y0 * w + x0;
  return gray[k] * (1 - fx) * (1 - fy) + gray[k + 1] * fx * (1 - fy)
    + gray[k + w] * (1 - fx) * fy + gray[k + w + 1] * fx * fy;
}

function median(a) {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// Prava s = a + b·t kroz tačke (t, s), sa jednim krugom odbacivanja odstupanja.
function fitLine(pts) {
  const fit = (p) => {
    const n = p.length; let st = 0, ss = 0, stt = 0, sts = 0;
    for (const [t, s] of p) { st += t; ss += s; stt += t * t; sts += t * s; }
    const den = n * stt - st * st;
    const b = Math.abs(den) < 1e-9 ? 0 : (n * sts - st * ss) / den;
    return { a: (ss - b * st) / n, b };
  };
  if (pts.length < 3) return null;
  let l = fit(pts);
  const res = pts.map(([t, s]) => Math.abs(s - (l.a + l.b * t)));
  const tol = Math.max(1, 2.5 * median(res));
  const keep = pts.filter((_, i) => res[i] <= tol);
  if (keep.length >= 3) l = fit(keep);
  // Pravost: RMS odstupanja i udeo tačaka na pravoj (ivica kartice je prava, ivica prsta nije)
  const r2 = keep.map(([t, s]) => (s - (l.a + l.b * t)) ** 2);
  const rms = Math.sqrt(r2.reduce((x, y) => x + y, 0) / Math.max(1, r2.length));
  return { ...l, n: keep.length, rms, inlier: keep.length / pts.length };
}

export function detectCardEdges({ gray, width, height, pupils, mask = null }) {
  if (!pupils || pupils.length !== 2) return null;
  const [p0, p1] = pupils[0].x <= pupils[1].x ? pupils : [pupils[1], pupils[0]];
  const ipd = Math.hypot(p1.x - p0.x, p1.y - p0.y);
  if (!(ipd > 20)) return null;
  const u = { x: (p1.x - p0.x) / ipd, y: (p1.y - p0.y) / ipd };
  const n = { x: u.y, y: -u.x };                           // naviše u slici
  const mid = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };

  // Ispravljena traka: s ∈ [-S, S], t ∈ [T0, T1] (u pikselima slike)
  const S = Math.round(1.45 * ipd), T0 = Math.round(0.2 * ipd), T1 = Math.round(1.75 * ipd);
  const W = 2 * S + 1, H = T1 - T0 + 1;
  const strip = new Float32Array(W * H), bad = new Uint8Array(W * H);
  for (let r = 0; r < H; r++) {
    const t = T0 + r;
    for (let c = 0; c < W; c++) {
      const s = c - S;
      const x = mid.x + s * u.x + t * n.x, y = mid.y + s * u.y + t * n.y;
      const v = bilinear(gray, width, height, x, y);
      const k = r * W + c;
      if (Number.isNaN(v)) { bad[k] = 1; strip[k] = 0; continue; }
      strip[k] = v;
      if (mask && mask[(Math.round(y) * width) + Math.round(x)]) bad[k] = 1;
    }
  }
  // Blago zamućenje 3×3 (JPEG šum)
  const sm = new Float32Array(W * H);
  for (let r = 1; r < H - 1; r++) for (let c = 1; c < W - 1; c++) {
    let a = 0; for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) a += strip[(r + dr) * W + c + dc];
    sm[r * W + c] = a / 9;
  }
  // Gradijenti; V = dokaz za uspravnu ivicu, Hh = za vodoravnu
  const gs = new Float32Array(W * H), V = new Float32Array(W * H), Hh = new Float32Array(W * H);
  for (let r = 2; r < H - 2; r++) for (let c = 2; c < W - 2; c++) {
    const k = r * W + c;
    if (bad[k] || bad[k - 1] || bad[k + 1] || bad[k - W] || bad[k + W]) continue;
    const gx = sm[k + 1] - sm[k - 1], gy = sm[k + W] - sm[k - W];
    gs[k] = gx;
    V[k] = Math.max(0, Math.abs(gx) - 0.5 * Math.abs(gy));
    Hh[k] = Math.max(0, Math.abs(gy) - 0.5 * Math.abs(gx));
  }
  // Kolonski dokaz: zbir V u lokalnim maksimumima reda
  const C = new Float32Array(W);
  for (let r = 2; r < H - 2; r++) {
    let rowMax = 0;
    for (let c = 2; c < W - 2; c++) rowMax = Math.max(rowMax, V[r * W + c]);
    if (rowMax < 4) continue;
    const thr = 0.25 * rowMax;
    for (let c = 3; c < W - 3; c++) {
      const k = r * W + c, v = V[k];
      if (v > thr && v >= V[k - 1] && v >= V[k + 1]) C[c] += v / rowMax;
    }
  }
  const Cs = new Float32Array(W);
  for (let c = 2; c < W - 2; c++) Cs[c] = (C[c - 2] + C[c - 1] + C[c] + C[c + 1] + C[c + 2]) / 5;
  // Kandidati: lokalni maksimumi
  const peaks = [];
  for (let c = 3; c < W - 3; c++) if (Cs[c] > 0 && Cs[c] >= Cs[c - 1] && Cs[c] > Cs[c + 1]) peaks.push(c);
  peaks.sort((a, b) => Cs[b] - Cs[a]);
  const top = peaks.slice(0, 24);

  // Prefiks-sume za brzo bodovanje pravougaonika: V po kolonama (niz redova), Hh po redovima (niz kolona).
  // Jačina ivica se normalizuje robusnom skalom (95. percentil), maskirani pikseli se ne broje.
  const scale = (arr) => {
    const vals = []; for (let k = 0; k < arr.length; k += 7) if (arr[k] > 0) vals.push(arr[k]);
    vals.sort((x, y) => x - y); return vals.length ? vals[Math.floor(vals.length * 0.95)] || 1 : 1;
  };
  const vs = scale(V), hs = scale(Hh);
  const colSum = new Float32Array(W * (H + 1)), colCnt = new Float32Array(W * (H + 1));
  for (let c = 0; c < W; c++) for (let r = 0; r < H; r++) {
    const k = r * W + c, ok = bad[k] ? 0 : 1;
    // najjača vrednost u koloni c±1 (ivica može biti između piksela)
    const v = ok ? Math.min(1, Math.max(V[k], c > 0 ? V[k - 1] : 0, c < W - 1 ? V[k + 1] : 0) / vs) : 0;
    colSum[(r + 1) * W + c] = colSum[r * W + c] + v;
    colCnt[(r + 1) * W + c] = colCnt[r * W + c] + ok;
  }
  const rowSum = new Float32Array(H * (W + 1)), rowCnt = new Float32Array(H * (W + 1));
  for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
    const k = r * W + c, ok = bad[k] ? 0 : 1;
    const v = ok ? Math.min(1, Math.max(Hh[k], r > 0 ? Hh[k - W] : 0, r < H - 1 ? Hh[k + W] : 0) / hs) : 0;
    rowSum[r * (W + 1) + c + 1] = rowSum[r * (W + 1) + c] + v;
    rowCnt[r * (W + 1) + c + 1] = rowCnt[r * (W + 1) + c] + ok;
  }
  const vMean = (c, r0, r1) => {
    const s = colSum[(r1 + 1) * W + c] - colSum[r0 * W + c], n = colCnt[(r1 + 1) * W + c] - colCnt[r0 * W + c];
    return n > 0.3 * (r1 - r0 + 1) ? s / n : 0;
  };
  const hMean = (r, c0, c1) => {
    const s = rowSum[r * (W + 1) + c1 + 1] - rowSum[r * (W + 1) + c0], n = rowCnt[r * (W + 1) + c1 + 1] - rowCnt[r * (W + 1) + c0];
    return n > 0.3 * (c1 - c0 + 1) ? s / n : 0;
  };

  // Pravougaonik kartice: leva/desna ivica iz kandidata, gornja/donja po svim redovima
  // (visina = odnos stranica × širina, skraćena nagibom čela do ~45°).
  let best = null, second = 0;
  for (let i = 0; i < top.length; i++) for (let j = 0; j < top.length; j++) {
    const a = top[i], b = top[j]; if (b <= a) continue;
    const w = b - a;
    if (w < 1.15 * ipd || w > 1.62 * ipd) continue;          // PD ≈ 53–75 mm (uz paralaksu)
    if (Math.abs((a + b) / 2 - S) > 0.6 * ipd) continue;
    const hLo = Math.round(0.72 * CARD_ASPECT * w), hHi = Math.round(1.05 * CARD_ASPECT * w);
    const c0 = a + 3, c1 = b - 3;
    let pairBest = null;
    for (let r0 = 2; r0 < H - 2 - hLo; r0++) {
      const top_ = hMean(r0, c0, c1); if (top_ < 0.15) continue;
      for (let d = hLo; d <= hHi; d++) {
        const r1 = r0 + d; if (r1 >= H - 2) break;
        const bot = hMean(r1, c0, c1); if (bot < 0.15) continue;
        const left = vMean(a, r0 + 2, r1 - 2), right = vMean(b, r0 + 2, r1 - 2);
        // Ugao: gornja i donja ivica moraju da se ZAVRŠE kod a i b (ivica prsta unutar kartice
        // to ne ispunjava — ivica kartice se nastavlja dalje)
        const ext = Math.max(
          c0 - 24 >= 0 ? hMean(r0, Math.max(0, a - 24), a - 5) : 0, c1 + 24 < W ? hMean(r0, b + 5, Math.min(W - 1, b + 24)) : 0,
          c0 - 24 >= 0 ? hMean(r1, Math.max(0, a - 24), a - 5) : 0, c1 + 24 < W ? hMean(r1, b + 5, Math.min(W - 1, b + 24)) : 0);
        // Obe uspravne ivice moraju postojati; zbir sa težinom po dužini ivice
        const score = (Math.min(left, right) * 2 * d + (top_ + bot) * w) / (2 * d + 2 * w) + 0.5 * Math.min(left, right)
          - 0.6 * Math.max(0, ext - 0.1);
        if (!pairBest || score > pairBest.score) pairBest = { score, r0, r1 };
      }
    }
    if (!pairBest) continue;
    if (!best || pairBest.score > best.score) {
      if (best) second = Math.max(second, best.score);
      best = { a, b, score: pairBest.score, hz: { r0: pairBest.r0, r1: pairBest.r1 } };
    } else second = Math.max(second, pairBest.score);
  }
  if (!best) return null;

  // Doterivanje ivica po redovima između gornje i donje ivice kartice
  const r0 = best.hz.r0 + 3, r1 = best.hz.r1 - 3;
  const refine = (col) => {
    const pts = [];
    for (let r = Math.max(2, r0); r <= Math.min(H - 3, r1); r++) {
      let bc = -1, bv = 0;
      for (let c = col - 3; c <= col + 3; c++) { const v = Math.abs(gs[r * W + c]); if (V[r * W + c] > 0 && v > bv) { bv = v; bc = c; } }
      if (bc < 1 || bv < 6) continue;
      const k = r * W + bc, l = Math.abs(gs[k - 1]), m = Math.abs(gs[k]), rr = Math.abs(gs[k + 1]);
      const den = l - 2 * m + rr;
      const off = Math.abs(den) > 1e-6 ? Math.max(-0.5, Math.min(0.5, 0.5 * (l - rr) / den)) : 0;
      pts.push([r, bc + off]);
    }
    return fitLine(pts);
  };
  const la = refine(best.a), lb = refine(best.b);
  if (!la || !lb || la.n < 6 || lb.n < 6) return null;

  // Širina normalno na ivice, na sredini kartice po visini
  const rm = (best.hz.r0 + best.hz.r1) / 2;
  const slope = (la.b + lb.b) / 2;                       // ds/dt (zakretanje kartice u odnosu na liniju zenica)
  const sa = la.a + la.b * rm, sb = lb.a + lb.b * rm;
  const widthPx = (sb - sa) / Math.sqrt(1 + slope * slope);
  const toImg = (c, r) => {
    const s = c - S, t = T0 + r;
    return { x: mid.x + s * u.x + t * n.x, y: mid.y + s * u.y + t * n.y };
  };
  const L = toImg(sa, rm);
  // Desni marker u podnožju normale iz levog → razmak markera = širina kartice
  const dir = { s: 1 / Math.sqrt(1 + slope * slope), t: -slope / Math.sqrt(1 + slope * slope) };
  const R = toImg(sa + widthPx * dir.s, rm + widthPx * dir.t);

  const heightPx = best.hz.r1 - best.hz.r0;
  const coverage = Math.min(la.n, lb.n) / Math.max(1, r1 - r0 + 1);
  // Pouzdanost: pre svega pravost obe ivice (ivica kartice je prava, ivica prsta/kose nije),
  // zatim koliki deo visine kartice ivice pokrivaju. Kalibrisano na 6 stvarnih snimaka:
  // tačne detekcije max RMS 0,30–1,29 px, pogrešne 1,64–1,90 px.
  const maxRms = Math.max(la.rms, lb.rms);
  const straight = Math.max(0, Math.min(1, (1.6 - maxRms) / 1.1));
  const confidence = 0.6 * straight + 0.4 * Math.min(1, coverage / 0.5);

  return {
    markers: [L, R],
    widthPx,
    heightPx,
    tiltDeg: Math.atan(slope) * 180 / Math.PI,
    coverage,
    confidence,
    rms: [la.rms, lb.rms],
    inlier: [la.inlier, lb.inlier],
  };
}

// Ispod praga se ne koristi automatski rezultat (markeri ostaju na proceni iz zenica).
// Na 6 stvarnih snimaka: tačne detekcije (≤0,8% od ručnih oznaka) 0,57–1,00, pogrešne 0,30–0,40.
export const CARD_DETECT_MIN_CONFIDENCE = 0.5;
