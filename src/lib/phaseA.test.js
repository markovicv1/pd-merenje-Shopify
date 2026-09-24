import { describe, it, expect } from 'vitest';
import { zoomRect, cardPrefill, rawPdFromMarkers, distPx } from './adjustGeometry.js';
import { distanceStatus, meanLuma, laplacianVariance, eyeForeheadRoi } from './captureGate.js';
import { shouldPlay, PROMPTS, STATUS_PROMPT, REPEAT_GAP_MS } from './voice.js';
import { loadSettings, saveSettings, DEFAULT_SETTINGS } from './a11ySettings.js';

const pupils = [{ x: 300, y: 400 }, { x: 420, y: 400 }]; // IPD 120 px

describe('zoomRect', () => {
  it('3:4, širina 2.8 × IPD, centriran po x', () => {
    const r = zoomRect(pupils, 1080, 1440);
    expect(r.w).toBeCloseTo(336, 6);
    expect(r.h).toBeCloseTo(448, 6);
    expect(r.x + r.w / 2).toBeCloseTo(360, 6);
  });
  it('pomeren naviše (čelo)', () => {
    const r = zoomRect(pupils, 1080, 1440);
    expect(r.y + r.h / 2).toBeLessThan(400);
  });
  it('ostaje unutar slike', () => {
    const r = zoomRect([{ x: 10, y: 20 }, { x: 130, y: 20 }], 1080, 1440);
    expect(r.x).toBe(0); expect(r.y).toBe(0);
  });
  it('bez zenica → ceo snimak', () => expect(zoomRect(null, 720, 960)).toEqual({ x: 0, y: 0, w: 720, h: 960 }));
  it('ne veći od slike', () => {
    const r = zoomRect([{ x: 100, y: 500 }, { x: 600, y: 500 }], 720, 960);
    expect(r.w).toBeLessThanOrEqual(720); expect(r.h).toBeLessThanOrEqual(960);
  });
});

describe('cardPrefill', () => {
  it('ivice kartice simetrično oko zenica, iznad njih, širina ≈ 85.6/63 × IPD', () => {
    const [a, b] = cardPrefill(pupils, 1080, 1440);
    expect((a.x + b.x) / 2).toBeCloseTo(360, 6);
    expect(distPx(a, b)).toBeCloseTo(120 * 85.6 / 63, 6);
    expect(a.y).toBeLessThan(400);
  });
});

describe('rawPdFromMarkers', () => {
  it('kartica 171.2 px, zenice 120 px → 60 mm', () =>
    expect(rawPdFromMarkers([{ x: 0, y: 0 }, { x: 171.2, y: 0 }], pupils).rawPdMm).toBeCloseTo(60, 6));
  it('premala kartica → null', () =>
    expect(rawPdFromMarkers([{ x: 0, y: 0 }, { x: 5, y: 0 }], pupils)).toBeNull());
});

describe('distanceStatus (udeo širine kadra)', () => {
  it('isti udeo = isti status na različitim rezolucijama', () => {
    expect(distanceStatus(0.15 * 720, 720)).toBe('ok');
    expect(distanceStatus(0.15 * 1440, 1440)).toBe('ok');
  });
  it('premalo → far, previše → close', () => {
    expect(distanceStatus(0.08 * 1080, 1080)).toBe('far');
    expect(distanceStatus(0.25 * 1080, 1080)).toBe('close');
  });
  it('niska rezolucija ispod 60 px → far', () => expect(distanceStatus(55, 400)).toBe('far'));
});

describe('meanLuma / laplacianVariance / ROI', () => {
  it('bela 255, crna 0', () => {
    expect(meanLuma(new Uint8ClampedArray([255, 255, 255, 255, 255, 255, 255, 255]))).toBeCloseTo(255, 6);
    expect(meanLuma(new Uint8ClampedArray([0, 0, 0, 255]))).toBe(0);
  });
  it('ravna slika → oštrina 0, šahovnica → > 0', () => {
    const flat = new Uint8ClampedArray(4 * 16).fill(128);
    expect(laplacianVariance(flat, 4, 4)).toBe(0);
    const chk = new Uint8ClampedArray(4 * 16);
    for (let i = 0; i < 16; i++) { const v = ((i % 4) + Math.floor(i / 4)) % 2 ? 255 : 0; chk.set([v, v, v, 255], i * 4); }
    expect(laplacianVariance(chk, 4, 4)).toBeGreaterThan(0);
  });
  it('ROI obuhvata oči i čelo, unutar kadra', () => {
    const r = eyeForeheadRoi(pupils[0], pupils[1], 1080, 1440);
    expect(r.y).toBeLessThan(400 - 120); expect(r.y + r.h).toBeGreaterThan(400);
    expect(r.x).toBeGreaterThanOrEqual(0);
  });
});

describe('voice.shouldPlay', () => {
  it('slobodno → pušta', () => expect(shouldPlay({ id: 'G06', now: 10000 })).toBe(true));
  it('zauzeto → ne pušta, osim prekida', () => {
    expect(shouldPlay({ id: 'G06', now: 10000, busy: true })).toBe(false);
    expect(shouldPlay({ id: 'G14', now: 10000, busy: true, interrupt: true })).toBe(true);
  });
  it('ista poruka ne pre 4 s', () => {
    expect(shouldPlay({ id: 'G06', now: 10000, lastPlayedAt: { G06: 10000 - REPEAT_GAP_MS + 1 } })).toBe(false);
    expect(shouldPlay({ id: 'G06', now: 10000, lastPlayedAt: { G06: 10000 - REPEAT_GAP_MS } })).toBe(true);
  });
  it('svaki status ima poruku sa fajlom i tekstom', () => {
    for (const id of Object.values(STATUS_PROMPT)) {
      expect(PROMPTS[id].file).toMatch(/^G\d\d_/);
      expect(PROMPTS[id].text.length).toBeGreaterThan(3);
    }
  });
});

describe('a11ySettings', () => {
  const mem = () => { const m = {}; return { getItem: (k) => m[k] ?? null, setItem: (k, v) => { m[k] = v; } }; };
  it('podrazumevano', () => expect(loadSettings(mem())).toEqual(DEFAULT_SETTINGS));
  it('čuva i vraća', () => {
    const s = mem(); saveSettings({ ...DEFAULT_SETTINGS, voice: false, countdown: 'beep' }, s);
    expect(loadSettings(s)).toMatchObject({ voice: false, countdown: 'beep' });
  });
  it('pokvaren sadržaj → podrazumevano', () => {
    const s = { getItem: () => '{nije json', setItem() {} };
    expect(loadSettings(s)).toEqual(DEFAULT_SETTINGS);
  });
  it('storage baca izuzetak → podrazumevano', () => {
    const s = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
    expect(loadSettings(s)).toEqual(DEFAULT_SETTINGS);
    expect(() => saveSettings(DEFAULT_SETTINGS, s)).not.toThrow();
  });
  it('pogrešni tipovi se ignorišu', () => {
    const s = mem(); s.setItem('pd-a11y-v1', JSON.stringify({ voice: 'da', countdown: 'x' }));
    expect(loadSettings(s)).toEqual(DEFAULT_SETTINGS);
  });
});
