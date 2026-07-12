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
