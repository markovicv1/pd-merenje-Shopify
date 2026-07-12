# PD Kalkulator — Preciznost i ispravke (Faza 1 + Faza 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ukloniti sistematske greške merenja PD-a (paralaksa kartica/zenice, konvergencija pogleda, poza glave) i popraviti bugove (kamera ostaje upaljena, dupli URL decode, open redirect, nepinovan MediaPipe, lažna clipboard poruka, tihi clamp van opsega).

**Architecture:** Čiste računske funkcije se izdvajaju u `src/lib/` module (testirani Vitest-om), a `PDMeasurement.jsx` ih samo poziva. Procena udaljenosti kamere i poza glave dolaze iz MediaPipe `facialTransformationMatrixes` (već dostupno, samo isključeno). Korekcije se primenjuju SAMO kao korekcioni članovi (`1 + Δ/d`), tako da greška procene udaljenosti od 10–15% unosi < 0.3 mm greške u rezultat.

**Tech Stack:** React 19 + Vite 7, MediaPipe `@mediapipe/tasks-vision` (pinovati na `0.10.35`), Vitest 4 za testove.

**Repo:** `C:\Users\marko\Claude Projects\pd-merenje-Shopify` — radna grana `feat/preciznost-korekcije` (NE raditi na `main`!).

> **Status izvršenja (2026-07-12):** Taskovi 0–7 ZAVRŠENI i commitovani na `feat/preciznost-korekcije` (38/38 testova, build OK, dev smoke test OK). Ispravka tokom izvršenja: u `tasks-vision@0.10.35` bundle je `vision_bundle.mjs` (ne `.js` — taj je 404). Odstupanje: "Out of range warning" blok u RESULT sekciji NIJE obrisan jer je dostižan za standalone opseg 40–48 mm. **Task 8 (verifikacija sa pravom kamerom) čeka Marka** — koraci 2–5 ispod.

---

## ⚠️ Kritična pravila za izvršioca

1. **NE push-ovati na `main`** — push na main automatski deploy-uje na GitHub Pages (produkcija, embedovana na opticarka.com). Push bilo koje grane samo uz eksplicitnu potvrdu korisnika.
2. Svaki task = zaseban commit na grani `feat/preciznost-korekcije`.
3. Testovi se pišu PRE implementacije (TDD) za sve `src/lib/` module.
4. Ovaj kalkulator je medicinski-adjacentan alat — konstante kalibracije (`CARD_DEPTH_OFFSET_MM`, pragovi poze) su početne vrednosti koje se finalno podešavaju empirijskom validacijom pupilometrom (vidi "Validacija" na dnu).

## Fizika korekcija (kontekst za izvršioca)

Merenje: skala mm/px se dobija iz kreditne kartice (85.6 mm) koju korisnik drži na čelu ili vrhu nosa. Dve sistematske greške:

1. **Paralaksa:** kartica je bliža kameri od ravni zenica za Δ (čelo ≈ 10 mm, nos ≈ 20 mm — oči su uvučene u duplje). Skala se računa na dubini kartice, pa je PD potcenjen: `PD_stvarno = PD_mereno × (1 + Δ/d)`, gde je `d` udaljenost kamere od lica.
2. **Konvergencija:** korisnik fiksira kameru na ~40 cm, oči rotiraju ka unutra oko centra rotacije ~10.5 mm iza ulazne pupile: `PD_daljina = PD_blizina × (1 + 10.5/d)`.

Na d = 400 mm obe zajedno ≈ +3.5 do +4.5 mm. Udaljenost `d` se čita iz MediaPipe facial transformation matrice (translacija Z, u cm) — dovoljno tačno jer ulazi samo u korekcioni član.

**Pozicija kartice (čelo vs nos)** se određuje automatski: prosečan Y markera kartice iznad prosečnog Y markera zenica (za > 5% visine slike) → čelo, inače → nos.

**Poza glave:** yaw > 5° skraćuje projektovani PD (~1 mm na 10°). Countdown se blokira porukom **"Ispravite glavu, pogled pravo u kameru"** (tekst potvrdio korisnik). 4-corner markiranje kartice je ODBIJENO od korisnika — ne implementirati.

## File Structure

| Fajl | Odgovornost |
|---|---|
| `src/lib/pdMath.js` (novo) | Čista matematika: median, zaokruživanje na 0.5 mm, klasifikacija pozicije kartice, korekcije paralakse/konvergencije |
| `src/lib/headPose.js` (novo) | Dekompozicija MediaPipe matrice → yaw/pitch/udaljenost + gate `isPoseFrontal` |
| `src/lib/returnTarget.js` (novo) | Allowlist validacija `return` URL-a + `ALLOWED_ORIGINS` za postMessage |
| `src/lib/*.test.js` (novo) | Vitest testovi za sva tri modula |
| `src/PDMeasurement.jsx` (izmena) | Wiring: gašenje kamere posle snapshot-a, median prefill, pose gating, korekcije u `calculatePD`, siguran `returnValue`, iskrena clipboard poruka |
| `index.html` (izmena) | Viewport bez `user-scalable=no`, Inter font umesto Space Grotesk |
| `package.json` (izmena) | devDependencies, vitest, ime paketa, `test` skripta |

---

### Task 0: Grana + Vitest setup

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Kreirati granu**

```bash
cd "C:\Users\marko\Claude Projects\pd-merenje-Shopify"
git checkout -b feat/preciznost-korekcije
```

- [ ] **Step 2: Srediti package.json**

Zameniti ceo sadržaj `package.json` sa:

```json
{
  "name": "pd-kalkulator",
  "version": "1.1.0",
  "description": "Optičarka PD kalkulator — online merenje pupilarne distance",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "license": "ISC",
  "dependencies": {
    "react": "^19.2.3",
    "react-dom": "^19.2.3"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^5.1.2",
    "terser": "^5.31.0",
    "vite": "^7.3.0",
    "vitest": "^4.1.10"
  }
}
```

- [ ] **Step 3: Instalirati**

Run: `npm install`
Expected: bez grešaka, `node_modules/.bin/vitest` postoji.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: vitest setup, build alati u devDependencies, ime paketa"
```

---

### Task 1: `pdMath.js` — median i zaokruživanje (TDD)

**Files:**
- Create: `src/lib/pdMath.js`
- Test: `src/lib/pdMath.test.js`

- [ ] **Step 1: Napisati failing testove**

`src/lib/pdMath.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { median, roundToHalfMm } from './pdMath.js';

describe('median', () => {
  it('neparan broj elemenata', () => expect(median([3, 1, 2])).toBe(2));
  it('paran broj elemenata', () => expect(median([4, 1, 3, 2])).toBe(2.5));
  it('jedan element', () => expect(median([7])).toBe(7));
  it('prazan niz vraća NaN', () => expect(median([])).toBeNaN());
  it('ne mutira ulaz', () => {
    const a = [3, 1, 2];
    median(a);
    expect(a).toEqual([3, 1, 2]);
  });
});

describe('roundToHalfMm', () => {
  it('63.2 → 63', () => expect(roundToHalfMm(63.2)).toBe(63));
  it('63.26 → 63.5', () => expect(roundToHalfMm(63.26)).toBe(63.5));
  it('63.74 → 63.5', () => expect(roundToHalfMm(63.74)).toBe(63.5));
  it('63.8 → 64', () => expect(roundToHalfMm(63.8)).toBe(64));
});
```

- [ ] **Step 2: Pokrenuti — mora pasti**

Run: `npx vitest run src/lib/pdMath.test.js`
Expected: FAIL — "Failed to load ./pdMath.js" ili slično.

- [ ] **Step 3: Implementacija**

`src/lib/pdMath.js`:

```js
// ── Kalibracione konstante ──────────────────────────────────────────────
// Početne vrednosti; finalno podešavanje empirijskom validacijom (pupilometar).
export const CARD_WIDTH_MM = 85.6;
export const CARD_DEPTH_OFFSET_MM = { forehead: 10, nose: 20 }; // kartica ispred ravni zenica
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
```

- [ ] **Step 4: Testovi prolaze**

Run: `npx vitest run src/lib/pdMath.test.js`
Expected: PASS (9 testova).

- [ ] **Step 5: Commit**

```bash
git add src/lib/pdMath.js src/lib/pdMath.test.js
git commit -m "feat(lib): pdMath — median i zaokruzivanje na 0.5mm (TDD)"
```

---

### Task 2: `pdMath.js` — korekcije paralakse i konvergencije (TDD)

**Files:**
- Modify: `src/lib/pdMath.js`
- Test: `src/lib/pdMath.test.js`

- [ ] **Step 1: Dodati failing testove na kraj `src/lib/pdMath.test.js`**

```js
import {
  sanitizeDistanceMm, classifyCardPosition,
  correctParallax, correctVergence, computeCorrectedPd,
  DEFAULT_DISTANCE_MM,
} from './pdMath.js';

describe('sanitizeDistanceMm', () => {
  it('validna vrednost prolazi', () => expect(sanitizeDistanceMm(400)).toBe(400));
  it('premala → default', () => expect(sanitizeDistanceMm(100)).toBe(DEFAULT_DISTANCE_MM));
  it('prevelika → default', () => expect(sanitizeDistanceMm(1500)).toBe(DEFAULT_DISTANCE_MM));
  it('NaN → default', () => expect(sanitizeDistanceMm(NaN)).toBe(DEFAULT_DISTANCE_MM));
  it('undefined → default', () => expect(sanitizeDistanceMm(undefined)).toBe(DEFAULT_DISTANCE_MM));
});

describe('classifyCardPosition (Y u %, raste nadole)', () => {
  it('kartica znatno iznad zenica → čelo', () => expect(classifyCardPosition(30, 50)).toBe('forehead'));
  it('kartica ispod zenica → nos', () => expect(classifyCardPosition(70, 42)).toBe('nose'));
  it('kartica tik iznad zenica (unutar praga 5%) → nos', () => expect(classifyCardPosition(47, 50)).toBe('nose'));
});

describe('correctParallax', () => {
  it('čelo: 60mm na 400mm → 61.5', () => expect(correctParallax(60, 400, 'forehead')).toBeCloseTo(61.5, 6));
  it('nos: 60mm na 400mm → 63', () => expect(correctParallax(60, 400, 'nose')).toBeCloseTo(63, 6));
  it('nepoznata pozicija tretira se kao nos', () =>
    expect(correctParallax(60, 400, undefined)).toBeCloseTo(63, 6));
});

describe('correctVergence', () => {
  it('60mm na 400mm → 61.575', () => expect(correctVergence(60, 400)).toBeCloseTo(61.575, 6));
});

describe('computeCorrectedPd (kompozicija + 0.5mm)', () => {
  it('čelo, 60mm, d=400 → 63', () =>
    expect(computeCorrectedPd({ rawPdMm: 60, distanceMm: 400, cardPosition: 'forehead' })).toBe(63));
  it('nos, 60mm, d=400 → 64.5', () =>
    expect(computeCorrectedPd({ rawPdMm: 60, distanceMm: 400, cardPosition: 'nose' })).toBe(64.5));
  it('nevalidna udaljenost koristi default 450', () =>
    expect(computeCorrectedPd({ rawPdMm: 60, distanceMm: NaN, cardPosition: 'nose' })).toBe(64));
});
```

Ručna provera brojeva: `60 × (1+10/400) = 61.5`; `61.5 × (1+10.5/400) = 63.114 → 63`. Nos: `60 × 1.05 = 63`; `63 × 1.02625 = 64.654 → 64.5`. Default d=450: `60 × (1+20/450) = 62.667`; `× (1+10.5/450) = 64.129 → 64`.

- [ ] **Step 2: Pokrenuti — novi testovi padaju**

Run: `npx vitest run src/lib/pdMath.test.js`
Expected: FAIL — funkcije ne postoje.

- [ ] **Step 3: Dodati u `src/lib/pdMath.js`**

```js
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

export function computeCorrectedPd({ rawPdMm, distanceMm, cardPosition }) {
  const d = sanitizeDistanceMm(distanceMm);
  return roundToHalfMm(correctVergence(correctParallax(rawPdMm, d, cardPosition), d));
}
```

- [ ] **Step 4: Testovi prolaze**

Run: `npx vitest run src/lib/pdMath.test.js`
Expected: PASS (svi).

- [ ] **Step 5: Commit**

```bash
git add src/lib/pdMath.js src/lib/pdMath.test.js
git commit -m "feat(lib): korekcije paralakse (celo/nos) i konvergencije pogleda (TDD)"
```

---

### Task 3: `headPose.js` — poza glave i udaljenost iz MediaPipe matrice (TDD)

**Files:**
- Create: `src/lib/headPose.js`
- Test: `src/lib/headPose.test.js`

- [ ] **Step 1: Failing testovi**

`src/lib/headPose.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { decomposeFacialMatrix, isPoseFrontal } from './headPose.js';

// Column-major 4x4: m[0..2]=kolona X rotacije, m[4..6]=kolona Y, m[8..10]=kolona Z, m[12..14]=translacija
const identityAt = (tzCm) => {
  const m = new Float32Array(16);
  m[0] = 1; m[5] = 1; m[10] = 1; m[15] = 1;
  m[14] = tzCm;
  return m;
};

const rotY = (deg, tzCm = -40) => {
  const r = (deg * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
  const m = identityAt(tzCm);
  m[0] = c; m[2] = -s; m[8] = s; m[10] = c;
  return m;
};

const rotX = (deg, tzCm = -40) => {
  const r = (deg * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r);
  const m = identityAt(tzCm);
  m[5] = c; m[6] = s; m[9] = -s; m[10] = c;
  return m;
};

describe('decomposeFacialMatrix', () => {
  it('identitet → yaw 0, pitch 0', () => {
    const { yawDeg, pitchDeg } = decomposeFacialMatrix(identityAt(-40));
    expect(yawDeg).toBeCloseTo(0, 4);
    expect(pitchDeg).toBeCloseTo(0, 4);
  });
  it('rotacija oko Y 30° → yaw 30', () => {
    expect(decomposeFacialMatrix(rotY(30)).yawDeg).toBeCloseTo(30, 3);
  });
  it('rotacija oko X 15° → pitch 15', () => {
    expect(decomposeFacialMatrix(rotX(15)).pitchDeg).toBeCloseTo(15, 3);
  });
  it('translacija Z -40cm → 400mm', () => {
    expect(decomposeFacialMatrix(identityAt(-40)).distanceMm).toBeCloseTo(400, 3);
  });
});

describe('isPoseFrontal', () => {
  it('frontalno prolazi', () => expect(isPoseFrontal({ yawDeg: 2, pitchDeg: -3 })).toBe(true));
  it('yaw preko praga pada', () => expect(isPoseFrontal({ yawDeg: 8, pitchDeg: 0 })).toBe(false));
  it('pitch preko praga pada', () => expect(isPoseFrontal({ yawDeg: 0, pitchDeg: 15 })).toBe(false));
});
```

- [ ] **Step 2: Pokrenuti — FAIL**

Run: `npx vitest run src/lib/headPose.test.js`
Expected: FAIL — modul ne postoji.

- [ ] **Step 3: Implementacija**

`src/lib/headPose.js`:

```js
// MediaPipe facialTransformationMatrixes[0].data: Float32Array(16), column-major.
// Rotacija u gornjoj 3x3 podmatrici, translacija u m[12..14], jedinice translacije: cm.
export const MAX_YAW_DEG = 5;
export const MAX_PITCH_DEG = 12; // blaži prag: pitch minimalno utiče na horizontalni PD

export function decomposeFacialMatrix(m) {
  const r00 = m[0], r10 = m[1], r20 = m[2];
  const r21 = m[6], r22 = m[10];
  return {
    yawDeg: Math.atan2(-r20, Math.hypot(r00, r10)) * (180 / Math.PI),
    pitchDeg: Math.atan2(r21, r22) * (180 / Math.PI),
    distanceMm: Math.abs(m[14]) * 10,
  };
}

export function isPoseFrontal({ yawDeg, pitchDeg }) {
  return Math.abs(yawDeg) <= MAX_YAW_DEG && Math.abs(pitchDeg) <= MAX_PITCH_DEG;
}
```

- [ ] **Step 4: Testovi prolaze**

Run: `npx vitest run src/lib/headPose.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/headPose.js src/lib/headPose.test.js
git commit -m "feat(lib): headPose — yaw/pitch/udaljenost iz MediaPipe matrice (TDD)"
```

> **Napomena za manuelnu verifikaciju (kasnije, Task 8):** znak/osa yaw-pitch i jedinica translacije se moraju potvrditi uživo logovanjem — ako MediaPipe konvencija odstupa, korigovati znak u `decomposeFacialMatrix` (testovi definišu željeno ponašanje: okretanje glave ulevo/udesno menja yaw, klimanje menja pitch, udaljenost na ~40 cm daje ~400).

---

### Task 4: `returnTarget.js` — allowlist za redirect i postMessage (TDD)

**Files:**
- Create: `src/lib/returnTarget.js`
- Test: `src/lib/returnTarget.test.js`

- [ ] **Step 1: Failing testovi**

`src/lib/returnTarget.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { resolveReturnTarget, ALLOWED_ORIGINS } from './returnTarget.js';

describe('resolveReturnTarget', () => {
  it('opticarka.com prolazi', () => {
    const u = resolveReturnTarget('https://opticarka.com/products/neki-okvir');
    expect(u).not.toBeNull();
    expect(u.hostname).toBe('opticarka.com');
  });
  it('www i dev store prolaze', () => {
    expect(resolveReturnTarget('https://www.opticarka.com/x')).not.toBeNull();
    expect(resolveReturnTarget('https://j35uug-4s.myshopify.com/x')).not.toBeNull();
  });
  it('tudji domen pada', () => expect(resolveReturnTarget('https://evil.com/phish')).toBeNull());
  it('http pada', () => expect(resolveReturnTarget('http://opticarka.com/x')).toBeNull());
  it('subdomen-spoofing pada', () =>
    expect(resolveReturnTarget('https://opticarka.com.evil.com/x')).toBeNull());
  it('null/prazno/nevalidan URL → null', () => {
    expect(resolveReturnTarget(null)).toBeNull();
    expect(resolveReturnTarget('')).toBeNull();
    expect(resolveReturnTarget('nije url')).toBeNull();
  });
});

describe('ALLOWED_ORIGINS', () => {
  it('sadrži produkcioni origin', () => expect(ALLOWED_ORIGINS).toContain('https://opticarka.com'));
});
```

- [ ] **Step 2: Pokrenuti — FAIL**

Run: `npx vitest run src/lib/returnTarget.test.js`
Expected: FAIL.

- [ ] **Step 3: Implementacija**

`src/lib/returnTarget.js`:

```js
const ALLOWED_HOSTS = new Set([
  'opticarka.com',
  'www.opticarka.com',
  'j35uug-4s.myshopify.com',
]);

export const ALLOWED_ORIGINS = [...ALLOWED_HOSTS].map((h) => `https://${h}`);

// URLSearchParams.get() već dekodira vrednost — NIKAD ne raditi decodeURIComponent ponovo.
export function resolveReturnTarget(returnUrl) {
  if (!returnUrl) return null;
  try {
    const url = new URL(returnUrl);
    if (url.protocol !== 'https:' || !ALLOWED_HOSTS.has(url.hostname)) return null;
    return url;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Testovi prolaze**

Run: `npx vitest run`
Expected: PASS — svi testovi iz sva tri modula.

- [ ] **Step 5: Commit**

```bash
git add src/lib/returnTarget.js src/lib/returnTarget.test.js
git commit -m "feat(lib): returnTarget — origin allowlist za redirect/postMessage (TDD)"
```

---

### Task 5: `index.html` — viewport, font, i pin MediaPipe verzije

**Files:**
- Modify: `index.html`
- Modify: `src/PDMeasurement.jsx` (linije ~130 i ~282–288)

- [ ] **Step 1: Viewport i font u `index.html`**

Zameniti viewport meta (linija 5) — ukloniti zabranu zooma (WCAG + intro poruka "koristite dva prsta za zoom" je do sada lagala jer je zoom bio blokiran):

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
```

Zameniti Google Fonts link (linija 10) — app koristi Inter, ne Space Grotesk:

```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
```

U inline `<style>` u `index.html` zameniti `font-family: 'Space Grotesk', ...` sa `font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;`.

- [ ] **Step 2: Ukloniti `@import` iz `GLOBAL_CSS`**

U `src/PDMeasurement.jsx` obrisati prvu liniju `GLOBAL_CSS` konstante:

```
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
```

(Font sada stiže iz `<link>` u index.html — brže i bez duplog učitavanja.)

- [ ] **Step 3: Pin MediaPipe verzije**

U `src/PDMeasurement.jsx` u `tryLoad` funkciji zameniti obe `@latest` reference sa `@0.10.35`:

```js
const mp = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/vision_bundle.js');
const vision = await mp.FilesetResolver.forVisionTasks(
  'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm'
);
```

- [ ] **Step 4: Build provera**

Run: `npm run build`
Expected: uspešan build bez grešaka.

- [ ] **Step 5: Commit**

```bash
git add index.html src/PDMeasurement.jsx
git commit -m "fix: dozvoljen zoom, Inter font bez @import, pin @mediapipe/tasks-vision@0.10.35"
```

---

### Task 6: Kamera se gasi posle snapshot-a + median prefill + pose gating

**Files:**
- Modify: `src/PDMeasurement.jsx`

- [ ] **Step 1: Importi i novi ref na vrhu komponente**

Na vrh fajla (posle React importa):

```js
import { median } from './lib/pdMath.js';
import { decomposeFacialMatrix, isPoseFrontal } from './lib/headPose.js';
```

U telu komponente, pored postojećih refova:

```js
const captureDistanceRef = useRef(null); // udaljenost kamere (mm) u trenutku snimka
```

- [ ] **Step 2: Uključiti transformation matrice**

U `tryLoad` opcijama promeniti:

```js
outputFaceBlendshapes: false, outputFacialTransformationMatrixes: true,
```

- [ ] **Step 3: Pose gating + bogatija istorija u `detectFace`**

Posle postojećeg računanja `irisD` dodati pozu (matrica može izostati — tada se ne blokira):

```js
const matrixData = results.facialTransformationMatrixes?.[0]?.data;
const pose = matrixData ? decomposeFacialMatrix(matrixData) : null;
const poseOk = !pose || isPoseFrontal(pose);
```

Promeniti liniju statusa:

```js
const status = irisD < MIN_IRIS_PX ? 'far' : irisD > MAX_IRIS_PX ? 'close' : !poseOk ? 'pose' : 'good';
```

Promeniti punjenje istorije (čuvamo i Y i udaljenost, za medianu pri snimku):

```js
hist.push({ lX, lY, rX, rY, distanceMm: pose?.distanceMm ?? NaN });
```

- [ ] **Step 4: Na snimku — median pozicija, sačuvana udaljenost, gašenje kamere**

U capture grani (`elapsed >= COUNTDOWN_MS`), PRE kreiranja snapshot canvasa, izračunati medijane iz istorije (25 frejmova mirovanja — smanjuje jitter landmarka):

```js
const mLX = median(hist.map((h) => h.lX)), mLY = median(hist.map((h) => h.lY));
const mRX = median(hist.map((h) => h.rX)), mRY = median(hist.map((h) => h.rY));
const dSamples = hist.map((h) => h.distanceMm).filter(Number.isFinite);
captureDistanceRef.current = dSamples.length ? median(dSamples) : null;
```

Zatim u `setPupilMarkers` koristiti medijane umesto poslednjeg frejma. Pošto su `lX = lIris.x * canvas.width` itd. već u canvas pikselima, a postojeći kod koristi normalizovane `lIris.x`, prefill postaje (canvas.width === vW, canvas.height === vH):

```js
setPupilMarkers([
  { x: ((vW - mLX) - srcX) / srcW * 100, y: (mLY - srcY) / srcH * 100 },
  { x: ((vW - mRX) - srcX) / srcW * 100, y: (mRY - srcY) / srcH * 100 },
]);
```

(`vW - mLX` je mirror flip, ekvivalent postojećem `(1 - lIris.x) * vW`.)

Odmah posle `setSnapshotUrl(...)` ugasiti kameru (privatnost — indikator kamere se gasi čim je slika uhvaćena):

```js
video.srcObject?.getTracks().forEach((t) => t.stop());
video.srcObject = null;
setCameraReady(false);
```

- [ ] **Step 5: `retryDetect` mora ponovo pokrenuti kameru**

Zameniti postojeći `retryDetect`:

```js
const retryDetect = () => {
  faceHistoryRef.current = []; cntdwnStartRef.current = null; setCountdown(null); lastTimeRef.current = -1;
  captureDistanceRef.current = null;
  setSnapshotUrl(null); setStep('detecting'); startCamera();
};
```

- [ ] **Step 6: Cleanup na unmount — stream i faceMesh**

Dodati dva useEffect-a (posle postojećeg MediaPipe useEffect-a):

```js
useEffect(() => () => { faceMesh?.close?.(); }, [faceMesh]);
useEffect(() => () => {
  videoRef.current?.srcObject?.getTracks().forEach((t) => t.stop());
}, []);
```

- [ ] **Step 7: UI za `pose` status — poruka koju je korisnik specificirao**

U DETECTING sekciji, kod warning badge-ova, dodati posle `close` badge-a:

```jsx
{faceStatus === 'pose' && (
  <div style={{ display: 'flex', padding: '9px 10px', borderRadius: 8, background: '#664700', color: '#ffd94d', fontWeight: 500 }}>
    ↻ Ispravite glavu, pogled pravo u kameru
  </div>
)}
```

U status baru (ternarni lanac) dodati granu pre `countdown !== null`:

```js
: faceStatus === 'pose' ? 'Ispravite glavu, pogled pravo u kameru'
```

Face guide oval i status dot koriste `faceStatus === 'good'` — već rade ispravno za novi status.

- [ ] **Step 8: Build + testovi**

Run: `npm run build && npx vitest run`
Expected: build OK, testovi PASS.

- [ ] **Step 9: Commit**

```bash
git add src/PDMeasurement.jsx
git commit -m "feat: pose gating (Ispravite glavu...), median prefill iz 25 frejmova, kamera se gasi posle snimka"
```

---

### Task 7: `calculatePD` sa korekcijama + siguran `returnValue` + iskrena clipboard poruka

**Files:**
- Modify: `src/PDMeasurement.jsx`

- [ ] **Step 1: Proširiti importe**

```js
import { median, computeCorrectedPd, classifyCardPosition, CARD_WIDTH_MM } from './lib/pdMath.js';
import { resolveReturnTarget, ALLOWED_ORIGINS } from './lib/returnTarget.js';
```

Obrisati lokalnu konstantu `CREDIT_CARD_WIDTH_MM` (sada `CARD_WIDTH_MM` iz lib-a).

- [ ] **Step 2: Novi `calculatePD`**

Zameniti celu funkciju:

```js
const formatPd = (v) => v.toLocaleString('sr-RS', { maximumFractionDigits: 1 });

const calculatePD = () => {
  const el = adjustRef.current; if (!el) return;
  const dw = el.clientWidth, dh = el.clientHeight;
  const px = (pct, d) => pct / 100 * d;
  const dist = (a, b) => Math.sqrt((px(a.x, dw) - px(b.x, dw)) ** 2 + (px(a.y, dh) - px(b.y, dh)) ** 2);
  const cardPx = dist(cardMarkers[0], cardMarkers[1]);
  if (cardPx < 10) { setError('Postavite markere kartice dalje jedan od drugog.'); return; }

  const rawPd = dist(pupilMarkers[0], pupilMarkers[1]) * (CARD_WIDTH_MM / cardPx);
  const cardPosition = classifyCardPosition(
    (cardMarkers[0].y + cardMarkers[1].y) / 2,
    (pupilMarkers[0].y + pupilMarkers[1].y) / 2,
  );
  const pd = computeCorrectedPd({
    rawPdMm: rawPd,
    distanceMm: captureDistanceRef.current,
    cardPosition,
  });

  const [min, max] = source === 'vto' ? [48, 80] : [40, 80.5];
  if (pd < min || pd > max) {
    // Van opsega → korisnik ostaje na adjust koraku i popravlja markere. Bez tihog clamp-a.
    setError(`Vrednost (${formatPd(pd)} mm) je van opsega ${min}–${max} mm. Pomerite markere na ivice kartice i centre zenica, pa pokušajte ponovo.`);
    return;
  }
  setError(null);
  setFinalPD(pd); setStep('result');
};
```

Napomena: error banner se trenutno renderuje samo u ne-adjust grani komponente. Dodati isti error banner JSX blok i u adjust granu (odmah posle `<Header ...>`), da korisnik vidi poruku o vrednosti van opsega:

```jsx
{error && (
  <div style={{ background: 'rgba(200,40,40,0.15)', borderBottom: '1px solid rgba(200,40,40,0.3)', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexShrink: 0 }}>
    <span style={{ color: '#ff8080', fontSize: 14 }}>{error}</span>
    <button onClick={() => setError(null)} style={{ color: 'rgba(255,255,255,0.5)', fontSize: 18, padding: '0 4px' }}>✕</button>
  </div>
)}
```

- [ ] **Step 3: Novi `returnValue` — allowlist + bez duplog decode + iskren clipboard**

Dodati state `const [copyOk, setCopyOk] = useState(false);` i zameniti funkciju:

```js
const returnValue = async (pd) => {
  const pdForVto = Math.round(pd); // VTO dropdown radi u celim mm

  let clipboardOk = false;
  try { await navigator.clipboard?.writeText(String(pd)); clipboardOk = true; } catch {}

  const openerAlive = window.opener && !window.opener.closed;
  if (openerAlive) {
    // targetOrigin ograničen na allowlist — poruka stiže samo Optičarkinim stranicama
    for (const origin of ALLOWED_ORIGINS) {
      try { window.opener.postMessage({ type: 'PD_RESULT', value: pdForVto }, origin); } catch {}
    }
    setTimeout(() => window.close(), 300);
    return;
  }

  const target = resolveReturnTarget(returnUrl); // bez decodeURIComponent — get() je već dekodirao
  if (source === 'vto' && target) {
    target.searchParams.set('pd', String(pdForVto));
    target.searchParams.set('reopenVTO', '1');
    window.location.href = target.toString();
    return;
  }

  setCopyOk(clipboardOk);
  setShowManualCopy(true);
};
```

- [ ] **Step 4: Poruka zavisi od uspeha kopiranja**

U RESULT sekciji zameniti `showManualCopy` blok:

```jsx
{showManualCopy ? (
  <>
    <p style={{ fontSize: 13, color: '#8c8c8c', textAlign: 'center' }}>
      {copyOk
        ? 'Vrednost je kopirana u clipboard. Zatvorite ovaj tab i nalepite je gde je potrebno.'
        : `Zabeležite vrednost: ${formatPd(finalPD)} mm — unesite je ručno.`}
    </p>
    <button className="btn-secondary" onClick={() => window.close()}>Zatvori tab</button>
  </>
) : (
```

- [ ] **Step 5: Prikaz rezultata na 0.5 mm**

U RESULT sekciji zameniti `{finalPD}` sa `{formatPd(finalPD)}` (prikaz "63,5"). Ako "63,5" vizuelno prelije karticu širine 165px na fontu 80 — smanjiti font na 64 za vrednosti sa decimalom:

```jsx
<span style={{ color: '#00b8ff', fontSize: Number.isInteger(finalPD) ? 80 : 64, fontWeight: 700, lineHeight: 1.1 }}>{formatPd(finalPD)}</span>
```

Obrisati "Out of range warning" blok u RESULT sekciji (nedostižan — van opsega više ne stiže do rezultata). U `reset()` dodati `setCopyOk(false); captureDistanceRef.current = null;`.

- [ ] **Step 6: Intro tekst — kartica paralelna sa ekranom**

U intro checklisti (Row 1) zameniti tekst `Držite karticu na vrhu nosa ili čela` sa:

```
Karticu držite ravno na čelu ili vrhu nosa, paralelno sa ekranom
```

(Nagib kartice po dubini je jedina preostala neispravljiva greška — instrukcija je jedina odbrana; 4-corner markiranje je odbijeno.)

- [ ] **Step 7: Build + testovi**

Run: `npm run build && npx vitest run`
Expected: PASS / build OK.

- [ ] **Step 8: Commit**

```bash
git add src/PDMeasurement.jsx
git commit -m "feat: PD korekcije u calculatePD, origin allowlist u returnValue, 0.5mm prikaz, iskrena clipboard poruka"
```

---

### Task 8: Manuelna verifikacija (dev server + kamera)

Ovaj task zahteva čoveka ili browser automatizaciju sa pravom kamerom — ako izvršilac nema kameru, označiti kao "čeka Marka" i navesti tačne korake.

- [ ] **Step 1: Pokrenuti dev server**

Run: `npm run dev` → otvoriti prikazani localhost URL u Chrome.

- [ ] **Step 2: Verifikovati osnovni tok**

- Intro se prikazuje, dugme aktivno kad se model učita, novi tekst za karticu vidljiv.
- Merenje: lice se detektuje, countdown radi.
- **Okretanje glave levo/desno > ~5°** → pojavljuje se "Ispravite glavu, pogled pravo u kameru" i countdown se prekida. Ako se badge pojavljuje kad je glava ispravna ili ne reaguje na okretanje → proveriti znak yaw u `decomposeFacialMatrix` (logovati `pose` u konzoli).
- Posle snimka: **indikator kamere u browseru se gasi** (ključna provera).
- "Ponovi" na adjust ekranu ponovo pali kameru i vraća na merenje.

- [ ] **Step 3: Verifikovati udaljenost**

Privremeno dodati `console.log('d =', captureDistanceRef.current)` posle snimka (ili logovati u detectFace). Sesti na izmerenih 40 cm od kamere (lenjir/metar) → log mora biti ~350–450. Na 60 cm → ~550–650. Ako su vrednosti u cm umesto mm (faktor 10) ili potpuno van — korigovati faktor u `decomposeFacialMatrix` i AŽURIRATI test. Obrisati log posle provere.

- [ ] **Step 4: Verifikovati klasifikaciju čelo/nos**

Jedno merenje sa karticom na čelu, jedno sa karticom na vrhu nosa. Logovati `cardPosition` u `calculatePD` — mora biti 'forehead' odnosno 'nose'. Obrisati log.

- [ ] **Step 5: End-to-end PD provera**

Izmeriti osobu poznatog PD-a (izmerenog pupilometrom kod optičara). Rezultat mora biti unutar ±1.5 mm. Zabeležiti sirovu (`rawPd`) i korigovanu vrednost u komentar commit-a ili u `docs/validacija-log.md`.

- [ ] **Step 6: Commit eventualnih ispravki**

```bash
git add -A
git commit -m "fix: korekcije nakon manuelne verifikacije (znak yaw / faktor udaljenosti)"
```

---

## Validacija i kalibracija (posle implementacije — sa Markom)

1. **Protokol:** 10–15 osoba u partnerskom salonu; svakoj izmeriti PD pupilometrom (ground truth), zatim 2× kalkulatorom (jednom kartica na čelu, jednom na nosu).
2. **Podešavanje:** ako postoji sistematski offset po grupi, korigovati `CARD_DEPTH_OFFSET_MM.forehead` / `.nose` (u `src/lib/pdMath.js`) — svaka promena kroz commit sa podacima u poruci.
3. Tek posle validacije ažurirati marketinšku tvrdnju "±1mm" na Shopify stranici (i ukloniti/implementirati tvrdnju o monokularnom PD — trenutno netačna).

## Van opsega ovog plana (Faza 3 backlog)

- Lupa (magnifier) pri prevlačenju markera
- Automatsko dvostruko merenje sa poređenjem
- Monokularni PD (landmark sredine nosa)
- Refaktorisanje `PDMeasurement.jsx` u hook-ove + step komponente
- Viša rezolucija kamere (`ideal: 1080+`) — testirati uticaj na performanse MediaPipe-a pre uvođenja
- Prepoznavanje oblika lica (poseban feasibility dokument: `docs/face-shape-feasibility.md`)
- Deploy na GitHub Pages (push na main) — SAMO uz Markovu potvrdu
