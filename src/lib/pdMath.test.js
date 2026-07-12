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
