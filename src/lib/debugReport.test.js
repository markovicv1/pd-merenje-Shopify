import { describe, it, expect } from 'vitest';
import { parseDebugFlags, irisDiameterPx, buildReport, IRIS_H_EDGES } from './debugReport.js';

describe('parseDebugFlags', () => {
  it('bez parametara → isključeno', () => expect(parseDebugFlags('')).toEqual({ debug: false, phantom: false }));
  it('?debug=1 → debug', () => expect(parseDebugFlags('?debug=1')).toEqual({ debug: true, phantom: false }));
  it('?debug=0 → isključeno', () => expect(parseDebugFlags('?debug=0').debug).toBe(false));
  it('?debug=1&fantom=1 → fantom', () => expect(parseDebugFlags('?debug=1&fantom=1')).toEqual({ debug: true, phantom: true }));
  it('fantom bez debug-a se ignoriše', () => expect(parseDebugFlags('?fantom=1').phantom).toBe(false));
});

describe('irisDiameterPx', () => {
  const lm = [];
  lm[469] = { x: 0.40, y: 0.5 };
  lm[471] = { x: 0.43, y: 0.5 };
  it('horizontalni prečnik u pikselima frejma', () =>
    expect(irisDiameterPx(lm, IRIS_H_EDGES.left, 1000, 800)).toBeCloseTo(30, 6));
  it('nedostaju tačke → NaN', () => expect(irisDiameterPx([], IRIS_H_EDGES.right, 1000, 800)).toBeNaN());
});

describe('buildReport', () => {
  const base = {
    cardSrcPx: 171.2, pupilSrcPx: 120, pupilPrefillShiftPx: 0,
    cardPosition: 'forehead', distanceMm: 400, pdFinal: 63,
    capture: { irisDiameterPx: [23.4, 23.4] },
  };

  it('skala i sirovi PD iz kartice', () => {
    const m = buildReport(base).measurement;
    expect(m.mmPerPx).toBeCloseTo(0.5, 4);
    expect(m.rawPdMm).toBe(60);
  });

  it('faktori korekcija (čelo, d=400)', () => {
    const m = buildReport(base).measurement;
    expect(m.parallaxFactor).toBe(1.015);
    expect(m.vergenceFactor).toBeCloseTo(1.0263, 4);
    expect(m.correctedPdMm).toBeCloseTo(62.5, 2);
  });

  it('fantom: bez konvergencije', () => {
    const rep = buildReport({ ...base, phantom: true });
    expect(rep.mode).toBe('fantom');
    expect(rep.measurement.vergenceFactor).toBe(1);
    expect(rep.measurement.correctedPdMm).toBe(60.9);
  });

  it('prečnik šarenice u mm preko skale kartice', () =>
    expect(buildReport(base).measurement.irisDiameterMm).toEqual([11.7, 11.7]));

  it('nevalidna udaljenost → default i oznaka', () => {
    const m = buildReport({ ...base, distanceMm: NaN }).measurement;
    expect(m.distanceUsedMm).toBe(450);
    expect(m.distanceSanitized).toBe(true);
    expect(m.distanceMpMm).toBeNull();
  });

  it('izveštaj je serijalizabilan u JSON', () =>
    expect(() => JSON.parse(JSON.stringify(buildReport(base)))).not.toThrow());
});
