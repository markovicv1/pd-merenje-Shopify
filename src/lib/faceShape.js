// ── Oblik lica — geometrijska klasifikacija iz MediaPipe landmarka ────────
// Pristup i ograničenja: docs/face-shape-feasibility.md; specifikacija: docs/superpowers/plans/2026-09-25-oblik-lica-v2-spec.md
// SVE konstante (indeksi, prototipovi, sigme) su početna kalibracija — podešavaju se na podacima iz ankete.

// Indeksi landmarka (MediaPipe FaceMesh). Proveriti vizuelno (?app=oblik&debug=1 crta tačke).
export const FACE_SHAPE_LANDMARKS = {
  foreheadTop: 10,  // vrh čela, sredina (ivica mesh-a — ispod linije kose)
  chin: 152,        // dno brade
  cheekR: 234,      // desna ivica lica u nivou jagodica (alt: 127)
  cheekL: 454,      // leva ivica lica (alt: 356)
  jawR: 58,         // ugao vilice desno (alt: 132, 172)
  jawL: 288,        // ugao vilice levo (alt: 361, 397)
  foreheadR: 54,    // ivica čela desno (alt: 103, 67)
  foreheadL: 284,   // ivica čela levo (alt: 332, 297)
  chinR: 176,       // donja vilica uz bradu desno (alt: 150)
  chinL: 400,       // donja vilica uz bradu levo (alt: 379)
};

export const SHAPE_KEYS = ['oval', 'round', 'oblong', 'square', 'heart', 'triangle', 'diamond'];

export const SHAPE_LABELS = {
  oval: 'Ovalno', round: 'Okruglo', oblong: 'Duguljasto', square: 'Četvrtasto',
  heart: 'Srcoliko', triangle: 'Trouglasto', diamond: 'Dijamantsko',
};

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// Ugao u tački p između krakova ka a i ka b, u stepenima.
export function angleAtDeg(p, a, b) {
  const v1 = { x: a.x - p.x, y: a.y - p.y };
  const v2 = { x: b.x - p.x, y: b.y - p.y };
  const m = Math.hypot(v1.x, v1.y) * Math.hypot(v2.x, v2.y);
  if (m === 0) return NaN;
  const cos = (v1.x * v2.x + v1.y * v2.y) / m;
  return Math.acos(Math.min(1, Math.max(-1, cos))) * (180 / Math.PI);
}

// points: 10 imenovanih tačaka u px. Bezdimenzioni odnosi — ne zavise od rezolucije ni ogledanja.
export function extractFeatures(points) {
  const cheekW = dist(points.cheekR, points.cheekL);
  const jawW = dist(points.jawR, points.jawL);
  return {
    heightToWidth: dist(points.foreheadTop, points.chin) / cheekW,
    foreheadToCheek: dist(points.foreheadR, points.foreheadL) / cheekW,
    jawToCheek: jawW / cheekW,
    chinToJaw: dist(points.chinR, points.chinL) / jawW,
    jawAngleDeg: (angleAtDeg(points.jawR, points.cheekR, points.chin)
                + angleAtDeg(points.jawL, points.cheekL, points.chin)) / 2,
  };
}

// Prototipovi 7 oblika — PRIVREMENA kalibracija (2026-09-25).
// MediaPipe mesh je izglađen: na pravim licima featuri variraju u uskom opsegu (npr. jawToCheek 0,88–0,94),
// daleko od prvobitnih „optičarskih" vrednosti (0,72–0,96), pa bi skoro sva lica bila okrugla/ovalna.
// Zato su prvobitni prototipovi preslikani na raspodelu izmerenu na 40 frontalnih snimaka (~10 osoba, testeri PD-a):
// za svaki feature — medijana populacije + (odstupanje prototipa od proseka prototipova) / SD prototipova × 1,5 × SD populacije.
// Sigma = SD populacije. Relativni odnosi među oblicima su zadržani; konačna kalibracija ide iz ankete.
export const SHAPE_PROTOTYPES = {
  oval:     { heightToWidth: 1.179, foreheadToCheek: 0.888, jawToCheek: 0.900, chinToJaw: 0.384, jawAngleDeg: 138.2 },
  round:    { heightToWidth: 0.985, foreheadToCheek: 0.878, jawToCheek: 0.908, chinToJaw: 0.402, jawAngleDeg: 144.6 },
  oblong:   { heightToWidth: 1.393, foreheadToCheek: 0.888, jawToCheek: 0.905, chinToJaw: 0.389, jawAngleDeg: 139.5 },
  square:   { heightToWidth: 1.005, foreheadToCheek: 0.898, jawToCheek: 0.937, chinToJaw: 0.408, jawAngleDeg: 126.7 },
  heart:    { heightToWidth: 1.160, foreheadToCheek: 0.913, jawToCheek: 0.879, chinToJaw: 0.362, jawAngleDeg: 136.3 },
  triangle: { heightToWidth: 1.082, foreheadToCheek: 0.837, jawToCheek: 0.942, chinToJaw: 0.413, jawAngleDeg: 129.9 },
  diamond:  { heightToWidth: 1.228, foreheadToCheek: 0.816, jawToCheek: 0.886, chinToJaw: 0.365, jawAngleDeg: 136.3 },
};

// Tolerancije po featuru (širina gaussiana) = SD featura na pravim licima
export const FEATURE_SIGMA = {
  heightToWidth: 0.0867, foreheadToCheek: 0.0214, jawToCheek: 0.0147, chinToJaw: 0.0124, jawAngleDeg: 3.7,
};

const gauss = (x, mu, sigma) => Math.exp(-0.5 * ((x - mu) / sigma) ** 2);

// features → sortiran niz [{shape, score}], skorovi normalizovani (suma = 1)
export function scoreShapes(features) {
  const raw = Object.entries(SHAPE_PROTOTYPES).map(([shape, proto]) => {
    const keys = Object.keys(proto);
    let product = 1;
    for (const k of keys) product *= gauss(features[k], proto[k], FEATURE_SIGMA[k]);
    return { shape, score: product ** (1 / keys.length) }; // geometrijska sredina
  });
  const total = raw.reduce((s, r) => s + r.score, 0) || 1;
  return raw
    .map(r => ({ shape: r.shape, score: r.score / total }))
    .sort((a, b) => b.score - a.score);
}

// Adapter: MediaPipe landmarci (normalizovani [0..1]) → imenovane tačke u px.
export function pointsFromLandmarks(landmarks, width, height) {
  return Object.fromEntries(
    Object.entries(FACE_SHAPE_LANDMARKS).map(([name, i]) => [name, { x: landmarks[i].x * width, y: landmarks[i].y * height }]),
  );
}

// Medijana svakog featura kroz više frejmova (manji šum landmarka)
export function medianFeatures(list) {
  const med = (a) => { const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const keys = Object.keys(list[0] ?? {});
  return Object.fromEntries(keys.map(k => [k, med(list.map(f => f[k]).filter(Number.isFinite))]));
}

// Pravilo prikaza: procenti samo između dva najbolja oblika; drugi ispod 35 % → samo preovlađujući.
export const SECOND_SHAPE_MIN = 0.35;

export function topShapes(ranking) {
  const [a, b] = ranking;
  const sum = a.score + (b?.score ?? 0);
  const p2 = b && sum > 0 ? b.score / sum : 0;
  if (!b || p2 < SECOND_SHAPE_MIN) return { oblik: a.shape, drugi: null, procenti: { [a.shape]: 100 } };
  const q2 = Math.round(p2 * 100);
  return { oblik: a.shape, drugi: b.shape, procenti: { [a.shape]: 100 - q2, [b.shape]: q2 } };
}

export function classifyFaceShape(landmarks, width, height) {
  const features = extractFeatures(pointsFromLandmarks(landmarks, width, height));
  return { features, ranking: scoreShapes(features) };
}
