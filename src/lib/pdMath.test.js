import { describe, it, expect } from 'vitest';
import {
  median, roundToHalfMm,
  sanitizeDistanceMm, classifyCardPosition,
  correctParallax, correctVergence, computeCorrectedPd,
  DEFAULT_DISTANCE_MM,
} from './pdMath.js';

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
