# Oblik lica v1 (geometrijska klasifikacija) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Posle PD merenja korisnik jednim klikom dobija predlog oblika lica (top 2 od 7 oblika, sa procentima) i preporuku okvira — sve on-device, iz landmarka koje kalkulator već ima.

**Architecture:** Čist modul `src/lib/faceShape.js` (TDD): imenovane tačke lica → 5 bezdimenzionih featura → gaussian-membership skoring prema prototipovima 7 oblika → normalizovan ranking. `PDMeasurement.jsx` čuva landmarke u trenutku snimka i renderuje rezultat-karticu. Debug overlay (`?debug=oblik`) za vizuelnu verifikaciju landmark indeksa.

**Tech Stack:** postojeći — React 19 + Vite, MediaPipe FaceLandmarker (landmarci već dostupni), Vitest.

**Repo:** `C:\Users\marko\Claude Projects\pd-merenje-Shopify` — nova grana **`feat/face-shape-v1`** od `feat/preciznost-korekcije` (koristi `faceCaptureRef` infrastrukturu koja nastaje u ovom planu, i pose gating sa te grane).

---

## ⚠️ Kritična pravila za izvršioca

1. **NE push-ovati na `main`** — auto-deploy na GitHub Pages (produkcija). Push samo uz Markovu potvrdu.
2. Svaki task = commit. TDD za `src/lib/` module.
3. **Landmark indeksi su hipoteze** dok se ne potvrde debug overlay-em (Task 6) — ne preskakati taj task. Alternativni indeksi su u komentarima koda.
4. Prototipovi oblika i sigme su **početna kalibracija** — fino podešavanje ide na validacionom setu (Task 7, sa Markom). Ne trošiti vreme na "savršene" konstante pre toga.
5. Preduslov znanja: `docs/face-shape-feasibility.md` (zašto ovaj pristup) i plan `2026-07-12-pd-preciznost-faza-1-2.md` (šta već postoji na bazi grani).

## Kontekst: kako klasifikacija radi

Iz 10 imenovanih tačaka lica računa se 5 featura: odnos visina/širina, širina čela/jagodica, širina vilice/jagodica, širina brade/vilice, ugao vilice. Svaki od 7 oblika ima prototip (očekivane vrednosti featura). Skor oblika = geometrijska sredina gaussian membership funkcija po featurima; skorovi se normalizuju da sumiraju 1 i sortiraju. Matematička garancija: feature vektor identičan prototipu oblika X uvek rangira X kao #1 (svaki membership = 1) — to je i osnova testova.

7 oblika (ključ → srpski): `oval`→Ovalno, `round`→Okruglo, `oblong`→Duguljasto, `square`→Četvrtasto, `heart`→Srcoliko, `triangle`→Trouglasto, `diamond`→Dijamantsko.

## File Structure

| Fajl | Odgovornost |
|---|---|
| `src/lib/faceShape.js` (novo) | Landmark indeksi, geometrija (ugao, featuri), prototipovi, skoring, srpski labeli + preporuke okvira |
| `src/lib/faceShape.test.js` (novo) | Vitest testovi |
| `src/PDMeasurement.jsx` (izmena) | Čuvanje landmarka + crop parametara pri snimku, rezultat-kartica, debug overlay |

---

### Task 0: Grana

- [ ] **Step 1: Kreirati granu od preciznost grane**

```bash
cd "C:\Users\marko\Claude Projects\pd-merenje-Shopify"
git checkout feat/preciznost-korekcije
git checkout -b feat/face-shape-v1
```

- [ ] **Step 2: Provera baze**

Run: `npx vitest run`
Expected: 38 testova PASS (nasleđeno sa preciznost grane). Ako ne — STOP, javiti Marku.

---

### Task 1: Geometrija — `angleAtDeg` i `extractFeatures` (TDD)

**Files:**
- Create: `src/lib/faceShape.js`
- Test: `src/lib/faceShape.test.js`

- [ ] **Step 1: Failing testovi**

`src/lib/faceShape.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { angleAtDeg, extractFeatures } from './faceShape.js';

describe('angleAtDeg', () => {
  it('pravi ugao = 90°', () =>
    expect(angleAtDeg({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 })).toBeCloseTo(90, 5));
  it('opružen ugao = 180°', () =>
    expect(angleAtDeg({ x: 0, y: 0 }, { x: -1, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(180, 5));
  it('degenerisan krak → NaN', () =>
    expect(angleAtDeg({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeNaN());
});

// Sintetičko lice (y raste nadole kao na slici):
// čelo-vrh (0,-70), brada (0,70), jagodice ±50 na y=0,
// vilica ±40 na y=35, čelo-ivice ±45 na y=-40, brada-ivice ±15 na y=55
const syntheticPoints = {
  foreheadTop: { x: 0, y: -70 }, chin: { x: 0, y: 70 },
  cheekR: { x: -50, y: 0 }, cheekL: { x: 50, y: 0 },
  jawR: { x: -40, y: 35 }, jawL: { x: 40, y: 35 },
  foreheadR: { x: -45, y: -40 }, foreheadL: { x: 45, y: -40 },
  chinR: { x: -15, y: 55 }, chinL: { x: 15, y: 55 },
};

describe('extractFeatures', () => {
  const f = extractFeatures(syntheticPoints);
  it('heightToWidth = 140/100', () => expect(f.heightToWidth).toBeCloseTo(1.4, 6));
  it('foreheadToCheek = 90/100', () => expect(f.foreheadToCheek).toBeCloseTo(0.9, 6));
  it('jawToCheek = 80/100', () => expect(f.jawToCheek).toBeCloseTo(0.8, 6));
  it('chinToJaw = 30/80', () => expect(f.chinToJaw).toBeCloseTo(0.375, 6));
  it('jawAngleDeg ≈ 147°', () => expect(f.jawAngleDeg).toBeCloseTo(147.1, 0));
});
```

- [ ] **Step 2: Pokrenuti — FAIL**

Run: `npx vitest run src/lib/faceShape.test.js`
Expected: FAIL — modul ne postoji.

- [ ] **Step 3: Implementacija**

`src/lib/faceShape.js`:

```js
// ── Oblik lica v1 — geometrijska klasifikacija iz MediaPipe landmarka ────
// Pristup i ograničenja: docs/face-shape-feasibility.md
// SVE konstante (indeksi, prototipovi, sigme) su početna kalibracija.

// Indeksi landmarka (MediaPipe FaceMesh). OBAVEZNO vizuelno proveriti debug
// overlay-em (?debug=oblik, Task 6) — tačke moraju ležati na opisanim mestima.
// Ako neka tačka vizuelno ne odgovara, probati alternativu iz komentara.
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

// points: 10 imenovanih tačaka u px (isti koordinatni sistem za sve).
// Vraća bezdimenzione odnose — nezavisno od rezolucije i mirror flipa.
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
```

- [ ] **Step 4: Testovi prolaze**

Run: `npx vitest run src/lib/faceShape.test.js`
Expected: PASS (8 testova).

- [ ] **Step 5: Commit**

```bash
git add src/lib/faceShape.js src/lib/faceShape.test.js
git commit -m "feat(lib): faceShape — geometrija i featuri oblika lica (TDD)"
```

---

### Task 2: Prototipovi i skoring (TDD)

**Files:**
- Modify: `src/lib/faceShape.js`
- Test: `src/lib/faceShape.test.js`

- [ ] **Step 1: Dodati failing testove na kraj test fajla**

```js
import { SHAPE_PROTOTYPES, scoreShapes } from './faceShape.js';

describe('scoreShapes', () => {
  it('prototip svakog oblika rangira taj oblik kao #1', () => {
    for (const shape of Object.keys(SHAPE_PROTOTYPES)) {
      const ranking = scoreShapes({ ...SHAPE_PROTOTYPES[shape] });
      expect(ranking[0].shape).toBe(shape);
    }
  });
  it('skorovi sumiraju na 1', () => {
    const ranking = scoreShapes({ ...SHAPE_PROTOTYPES.oval });
    const sum = ranking.reduce((s, r) => s + r.score, 0);
    expect(sum).toBeCloseTo(1, 6);
  });
  it('ranking je sortiran opadajuće i ima 7 elemenata', () => {
    const ranking = scoreShapes({ ...SHAPE_PROTOTYPES.heart });
    expect(ranking).toHaveLength(7);
    for (let i = 1; i < ranking.length; i++) {
      expect(ranking[i - 1].score).toBeGreaterThanOrEqual(ranking[i].score);
    }
  });
});
```

- [ ] **Step 2: Pokrenuti — FAIL**

Run: `npx vitest run src/lib/faceShape.test.js`
Expected: FAIL — `SHAPE_PROTOTYPES`/`scoreShapes` ne postoje.

- [ ] **Step 3: Dodati u `src/lib/faceShape.js`**

```js
// ── Prototipovi 7 oblika (POČETNA kalibracija — podešava se u Task 7) ────
// Vrednosti su ručno postavljeni priori iz optičarskih opisa oblika:
// heart = šire čelo + špicasta brada; triangle = šira vilica; diamond = jagodice
// dominiraju; square = uglasta vilica (manji jawAngle); oblong = izduženo itd.
export const SHAPE_PROTOTYPES = {
  oval:     { heightToWidth: 1.40, foreheadToCheek: 0.92, jawToCheek: 0.80, chinToJaw: 0.62, jawAngleDeg: 118 },
  round:    { heightToWidth: 1.20, foreheadToCheek: 0.90, jawToCheek: 0.83, chinToJaw: 0.72, jawAngleDeg: 128 },
  oblong:   { heightToWidth: 1.62, foreheadToCheek: 0.92, jawToCheek: 0.82, chinToJaw: 0.65, jawAngleDeg: 120 },
  square:   { heightToWidth: 1.22, foreheadToCheek: 0.94, jawToCheek: 0.94, chinToJaw: 0.75, jawAngleDeg: 100 },
  heart:    { heightToWidth: 1.38, foreheadToCheek: 0.97, jawToCheek: 0.72, chinToJaw: 0.50, jawAngleDeg: 115 },
  triangle: { heightToWidth: 1.30, foreheadToCheek: 0.82, jawToCheek: 0.96, chinToJaw: 0.78, jawAngleDeg: 105 },
  diamond:  { heightToWidth: 1.45, foreheadToCheek: 0.78, jawToCheek: 0.75, chinToJaw: 0.52, jawAngleDeg: 115 },
};

// Tolerancije po featuru (širina gaussiana)
export const FEATURE_SIGMA = {
  heightToWidth: 0.12, foreheadToCheek: 0.06, jawToCheek: 0.07, chinToJaw: 0.10, jawAngleDeg: 10,
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
```

- [ ] **Step 4: Testovi prolaze**

Run: `npx vitest run src/lib/faceShape.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/faceShape.js src/lib/faceShape.test.js
git commit -m "feat(lib): prototipovi 7 oblika lica i gaussian skoring (TDD)"
```

---

### Task 3: Adapter za landmarke, kompozicija, UI sadržaj (TDD)

**Files:**
- Modify: `src/lib/faceShape.js`
- Test: `src/lib/faceShape.test.js`

- [ ] **Step 1: Failing testovi na kraj test fajla**

```js
import {
  pointsFromLandmarks, classifyFaceShape, FACE_SHAPE_LANDMARKS,
  SHAPE_LABELS, SHAPE_RECOMMENDATIONS,
} from './faceShape.js';

// Redak niz landmarka: samo indeksi koje koristimo, normalizovani [0..1]
const makeLandmarks = () => {
  const lm = [];
  lm[FACE_SHAPE_LANDMARKS.foreheadTop] = { x: 0.50, y: 0.15 };
  lm[FACE_SHAPE_LANDMARKS.chin]        = { x: 0.50, y: 0.85 };
  lm[FACE_SHAPE_LANDMARKS.cheekR]      = { x: 0.25, y: 0.50 };
  lm[FACE_SHAPE_LANDMARKS.cheekL]      = { x: 0.75, y: 0.50 };
  lm[FACE_SHAPE_LANDMARKS.jawR]        = { x: 0.30, y: 0.68 };
  lm[FACE_SHAPE_LANDMARKS.jawL]        = { x: 0.70, y: 0.68 };
  lm[FACE_SHAPE_LANDMARKS.foreheadR]   = { x: 0.28, y: 0.30 };
  lm[FACE_SHAPE_LANDMARKS.foreheadL]   = { x: 0.72, y: 0.30 };
  lm[FACE_SHAPE_LANDMARKS.chinR]       = { x: 0.42, y: 0.78 };
  lm[FACE_SHAPE_LANDMARKS.chinL]       = { x: 0.58, y: 0.78 };
  return lm;
};

describe('pointsFromLandmarks', () => {
  it('skalira normalizovane koordinate na px', () => {
    const pts = pointsFromLandmarks(makeLandmarks(), 400, 600);
    expect(pts.foreheadTop).toEqual({ x: 200, y: 90 });
    expect(pts.cheekR).toEqual({ x: 100, y: 300 });
  });
  it('vraća svih 10 imenovanih tačaka', () => {
    const pts = pointsFromLandmarks(makeLandmarks(), 400, 600);
    expect(Object.keys(pts).sort()).toEqual(Object.keys(FACE_SHAPE_LANDMARKS).sort());
  });
});

describe('classifyFaceShape', () => {
  it('vraća features i ranking od 7 oblika', () => {
    const { features, ranking } = classifyFaceShape(makeLandmarks(), 400, 600);
    expect(ranking).toHaveLength(7);
    expect(Number.isFinite(features.heightToWidth)).toBe(true);
    expect(ranking[0].score).toBeGreaterThan(0);
  });
});

describe('UI sadržaj', () => {
  it('svaki oblik ima label i preporuku', () => {
    for (const shape of Object.keys(SHAPE_PROTOTYPES)) {
      expect(SHAPE_LABELS[shape]).toBeTruthy();
      expect(SHAPE_RECOMMENDATIONS[shape]).toBeTruthy();
    }
  });
});
```

- [ ] **Step 2: Pokrenuti — FAIL**

Run: `npx vitest run src/lib/faceShape.test.js`
Expected: FAIL.

- [ ] **Step 3: Dodati u `src/lib/faceShape.js`**

```js
// Adapter: MediaPipe landmarks (normalizovani [0..1]) → imenovane tačke u px.
// Mirror flip NIJE potreban — svi featuri su rastojanja/uglovi (invarijantni).
export function pointsFromLandmarks(landmarks, width, height) {
  const px = (i) => ({ x: landmarks[i].x * width, y: landmarks[i].y * height });
  return Object.fromEntries(
    Object.entries(FACE_SHAPE_LANDMARKS).map(([name, i]) => [name, px(i)]),
  );
}

export function classifyFaceShape(landmarks, width, height) {
  const features = extractFeatures(pointsFromLandmarks(landmarks, width, height));
  return { features, ranking: scoreShapes(features) };
}

// ── UI sadržaj (srpski) ──────────────────────────────────────────────────
export const SHAPE_LABELS = {
  oval: 'Ovalno', round: 'Okruglo', oblong: 'Duguljasto', square: 'Četvrtasto',
  heart: 'Srcoliko', triangle: 'Trouglasto', diamond: 'Dijamantsko',
};

// Standardna optičarska pravila oblik → okvir. Marko može kasnije zameniti
// tekstove i dodati linkove ka specifičnim kolekcijama.
export const SHAPE_RECOMMENDATIONS = {
  oval: 'Skoro svi oblici okvira vam dobro stoje — birajte po stilu.',
  round: 'Uglasti i pravougaoni okviri dodaju definiciju licu.',
  oblong: 'Viši okviri i oversized modeli vizuelno skraćuju liniju lica.',
  square: 'Okrugli i ovalni okviri ublažavaju izražene uglove lica.',
  heart: 'Okviri sa naglaskom na donjoj polovini, ovalni i aviator modeli balansiraju šire čelo.',
  triangle: 'Browline i cat-eye okviri naglašavaju gornji deo lica i balansiraju širu vilicu.',
  diamond: 'Ovalni, rimless i cat-eye okviri ističu jagodice i omekšavaju linije.',
};
```

- [ ] **Step 4: Svi testovi prolaze**

Run: `npx vitest run`
Expected: PASS (38 starih + novi faceShape testovi).

- [ ] **Step 5: Commit**

```bash
git add src/lib/faceShape.js src/lib/faceShape.test.js
git commit -m "feat(lib): landmark adapter, classifyFaceShape i srpski UI sadrzaj (TDD)"
```

---

### Task 4: Čuvanje landmarka pri snimku (`PDMeasurement.jsx`)

**Files:**
- Modify: `src/PDMeasurement.jsx`

- [ ] **Step 1: Import i ref**

Na vrh fajla, uz postojeće lib importe:

```js
import { classifyFaceShape, FACE_SHAPE_LANDMARKS, SHAPE_LABELS, SHAPE_RECOMMENDATIONS } from './lib/faceShape.js';
```

U telu komponente, pored `captureDistanceRef`:

```js
const faceCaptureRef = useRef(null); // {landmarks, width, height, srcX, srcY, srcW, srcH} u trenutku snimka
```

i novi state pored `copyOk`:

```js
const [faceShape, setFaceShape] = useState(null); // top-2 ranking ili null
```

- [ ] **Step 2: Snimiti landmarke u capture grani `detectFace`**

U capture grani (`elapsed >= COUNTDOWN_MS`), ODMAH POSLE bloka koji računa `srcX/srcY/srcW/srcH` (potrebni su za debug overlay), dodati:

```js
faceCaptureRef.current = {
  landmarks: lm.map(p => ({ x: p.x, y: p.y })), // kopija — MediaPipe reciklira objekte
  width: vW, height: vH, srcX, srcY, srcW, srcH,
};
```

(`lm` već postoji u scope-u — `results.faceLandmarks[0]`.)

- [ ] **Step 3: Čišćenje u `reset` i `retryDetect`**

U `reset()` dodati: `setFaceShape(null); faceCaptureRef.current = null;`
U `retryDetect()` dodati: `setFaceShape(null); faceCaptureRef.current = null;`

- [ ] **Step 4: Handler**

Pored `calculatePD`:

```js
const handleFaceShape = () => {
  const cap = faceCaptureRef.current; if (!cap) return;
  const { ranking } = classifyFaceShape(cap.landmarks, cap.width, cap.height);
  setFaceShape(ranking.slice(0, 2));
};
```

- [ ] **Step 5: Build + testovi + commit**

Run: `npm run build && npx vitest run`
Expected: PASS / build OK.

```bash
git add src/PDMeasurement.jsx
git commit -m "feat: cuvanje landmarka i crop parametara u trenutku snimka"
```

---

### Task 5: Rezultat-kartica u RESULT sekciji

**Files:**
- Modify: `src/PDMeasurement.jsx`

- [ ] **Step 1: UI blok**

U RESULT sekciji, IZMEĐU PD kartice (div sa "Vaše PD rastojanje") i "Out of range warning" bloka, dodati:

```jsx
{/* Oblik lica (beta) */}
{faceShape ? (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: '#1a1f2c', padding: '20px 18px', border: '1px solid #404d66', borderRadius: 16 }}>
    <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', color: '#999' }}>Oblik vašeg lica (beta)</p>
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
      <span style={{ fontSize: 26, fontWeight: 700, color: '#00b8ff' }}>{SHAPE_LABELS[faceShape[0].shape]}</span>
      <span style={{ fontSize: 13, color: '#8c8c8c' }}>{Math.round(faceShape[0].score * 100)}%</span>
    </div>
    <p style={{ fontSize: 12, color: '#8c8c8c' }}>
      Moguće i: {SHAPE_LABELS[faceShape[1].shape]} ({Math.round(faceShape[1].score * 100)}%)
    </p>
    <p style={{ fontSize: 13, color: '#ccc', lineHeight: 1.45 }}>{SHAPE_RECOMMENDATIONS[faceShape[0].shape]}</p>
    <a href="https://opticarka.com/collections/dioptrijske-naocare" target="_blank" rel="noreferrer" style={{ color: '#00b8ff', fontSize: 13, fontWeight: 600 }}>
      Pogledajte okvire →
    </a>
    <p style={{ fontSize: 10, color: '#66738c' }}>AI predlog na osnovu proporcija lica — orijentaciono, nije stručna procena.</p>
  </div>
) : faceCaptureRef.current ? (
  <button className="btn-secondary" onClick={handleFaceShape}>Otkrijte oblik vašeg lica (beta)</button>
) : null}
```

- [ ] **Step 2: Build + testovi + commit**

Run: `npm run build && npx vitest run`
Expected: OK.

```bash
git add src/PDMeasurement.jsx
git commit -m "feat: kartica oblika lica (top-2 + preporuka okvira) na rezultat ekranu"
```

---

### Task 6: Debug overlay `?debug=oblik` + verifikacija indeksa

**Files:**
- Modify: `src/PDMeasurement.jsx`

- [ ] **Step 1: Debug flag**

U `urlParams` ref-u proširiti povratnu vrednost:

```js
const urlParams = useRef((() => {
  const p = new URLSearchParams(window.location.search);
  return { source: p.get('source'), returnUrl: p.get('return'), debugShape: p.get('debug') === 'oblik' };
})());
const { source, returnUrl, debugShape } = urlParams.current;
```

- [ ] **Step 2: Overlay u ADJUST grani**

U adjust grani, unutar `<div ref={adjustRef} ...>`, POSLE pupil markera, dodati:

```jsx
{debugShape && faceCaptureRef.current && Object.entries(FACE_SHAPE_LANDMARKS).map(([name, idx]) => {
  const cap = faceCaptureRef.current;
  const p = cap.landmarks[idx];
  // isti mirror+crop mapping kao za zenice
  const xPct = (((1 - p.x) * cap.width) - cap.srcX) / cap.srcW * 100;
  const yPct = ((p.y * cap.height) - cap.srcY) / cap.srcH * 100;
  return (
    <div key={name} style={{ position: 'absolute', left: `${xPct}%`, top: `${yPct}%`, transform: 'translate(-50%, -50%)', pointerEvents: 'none', zIndex: 7, textAlign: 'center' }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#ffe14d', border: '1px solid #000', margin: '0 auto' }} />
      <span style={{ fontSize: 9, color: '#ffe14d', textShadow: '0 1px 2px #000' }}>{name}</span>
    </div>
  );
})}
```

- [ ] **Step 3: Vizuelna verifikacija indeksa (treba kamera — ako je nema, označiti "čeka Marka")**

1. `npm run dev` → otvoriti `http://localhost:5173/pd-merenje-Shopify/?debug=oblik` u Chrome.
2. Izmeriti do adjust ekrana. Žute tačke moraju ležati: `foreheadTop` vrh čela sredina; `chin` dno brade; `cheekR/L` najšire tačke lica; `jawR/L` uglovi vilice (ispod uha, gde vilica skreće ka bradi); `foreheadR/L` ivice čela u visini slepoočnica; `chinR/L` na vilici neposredno uz bradu.
3. Ako neka tačka ne odgovara → zameniti indeks alternativom iz komentara u `FACE_SHAPE_LANDMARKS` i ponoviti.
4. Napomena: `cheekR` je na DESNOJ strani lica korisnika, što je zbog mirror flipa na LEVOJ strani ekrana — za featuere je svejedno (rastojanja), bitno je samo da su par tačaka simetrične.

- [ ] **Step 4: Build + commit**

Run: `npm run build && npx vitest run`
Expected: OK.

```bash
git add src/PDMeasurement.jsx
git commit -m "feat: debug overlay ?debug=oblik za verifikaciju landmark indeksa"
```

---

### Task 7: Manuelna verifikacija i kalibracija (sa Markom)

- [ ] **Step 1: Smoke test celog toka**

Merenje → rezultat → "Otkrijte oblik vašeg lica" → kartica prikazuje top-2 + preporuku; "Izmeri ponovo" resetuje karticu na dugme.

- [ ] **Step 2: Mini validacija (Marko)**

5–10 osoba/fotografija poznatog oblika lica (Marko proceni ili optičar). Za svaku zabeležiti: očekivani oblik, top-2 iz aplikacije, features (logovati `features` iz `handleFaceShape` privremeno u konzolu). Cilj v1: očekivani oblik u top-2 za ≥ 80% slučajeva.

- [ ] **Step 3: Kalibracija**

Ako neka klasa sistematski promašuje → pomeriti njen prototip u `SHAPE_PROTOTYPES` prema izmerenim features vrednostima (ili proširiti `FEATURE_SIGMA` za feature koji pravi problem). Svaka promena = commit sa podacima u poruci. Testovi iz Task 2 garantuju konzistentnost i nakon promene prototipova (svaki prototip i dalje mora pobediti za sebe — ako test padne, prototipovi su se preblizu primakli i treba ih razdvojiti).

- [ ] **Step 4: Finalna odluka**

Merge u `feat/preciznost-korekcije` ili čekanje — Markova odluka. Deploy (push na main) SAMO uz Markovu potvrdu.

---

## Van opsega v1 (backlog za v2)

- Segmentacija kose (MediaPipe ImageSegmenter) za pravu konturu čela
- Trenirani klasifikator na geometrijskim featurima (logistička regresija — koeficijenti u JS)
- Mapiranje oblik → specifične Shopify kolekcije/filteri umesto generičkog linka
- Prikaz oblika u VTO popup-u (preporuka okvira pre probe)
