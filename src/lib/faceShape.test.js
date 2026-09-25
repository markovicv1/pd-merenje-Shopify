import { describe, it, expect } from 'vitest';
import {
  angleAtDeg, extractFeatures, SHAPE_PROTOTYPES, scoreShapes, pointsFromLandmarks, classifyFaceShape,
  FACE_SHAPE_LANDMARKS, SHAPE_LABELS, medianFeatures, topShapes,
} from './faceShape.js';
import { outlinePath, OUTLINE_PROFILE } from './faceShapeOutlines.js';

describe('angleAtDeg', () => {
  it('pravi ugao = 90°', () => expect(angleAtDeg({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 })).toBeCloseTo(90, 5));
  it('opružen ugao = 180°', () => expect(angleAtDeg({ x: 0, y: 0 }, { x: -1, y: 0 }, { x: 1, y: 0 })).toBeCloseTo(180, 5));
  it('degenerisan krak → NaN', () => expect(angleAtDeg({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 })).toBeNaN());
});

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

describe('scoreShapes', () => {
  it('prototip svakog oblika rangira taj oblik kao #1', () => {
    for (const shape of Object.keys(SHAPE_PROTOTYPES)) expect(scoreShapes({ ...SHAPE_PROTOTYPES[shape] })[0].shape).toBe(shape);
  });
  it('skorovi sumiraju 1, sortirano opadajuće, 7 elemenata', () => {
    const r = scoreShapes({ ...SHAPE_PROTOTYPES.heart });
    expect(r).toHaveLength(7);
    expect(r.reduce((s, x) => s + x.score, 0)).toBeCloseTo(1, 6);
    for (let i = 1; i < r.length; i++) expect(r[i - 1].score).toBeGreaterThanOrEqual(r[i].score);
  });
});

describe('landmarci', () => {
  const lm = [];
  const set = (k, x, y) => { lm[FACE_SHAPE_LANDMARKS[k]] = { x, y }; };
  set('foreheadTop', 0.5, 0.15); set('chin', 0.5, 0.85); set('cheekR', 0.25, 0.5); set('cheekL', 0.75, 0.5);
  set('jawR', 0.3, 0.68); set('jawL', 0.7, 0.68); set('foreheadR', 0.28, 0.3); set('foreheadL', 0.72, 0.3);
  set('chinR', 0.42, 0.78); set('chinL', 0.58, 0.78);
  it('skalira na px', () => expect(pointsFromLandmarks(lm, 400, 600).foreheadTop).toEqual({ x: 200, y: 90 }));
  it('classifyFaceShape daje featurе i 7 oblika', () => {
    const { features, ranking } = classifyFaceShape(lm, 400, 600);
    expect(ranking).toHaveLength(7);
    expect(Number.isFinite(features.heightToWidth)).toBe(true);
  });
  it('svaki oblik ima naziv i obris', () => {
    for (const k of Object.keys(SHAPE_PROTOTYPES)) {
      expect(SHAPE_LABELS[k]).toBeTruthy();
      expect(OUTLINE_PROFILE[k]).toBeTruthy();
      expect(outlinePath(k)).toMatch(/^M.*Z$/);
    }
  });
});

describe('medianFeatures', () => {
  it('medijana po featuru', () => {
    const m = medianFeatures([{ a: 1, b: 10 }, { a: 3, b: 30 }, { a: 100, b: 20 }]);
    expect(m).toEqual({ a: 3, b: 20 });
  });
});

describe('topShapes (pravilo 35 %)', () => {
  it('drugi ispod 35 % → samo preovlađujući', () => {
    const t = topShapes([{ shape: 'oval', score: 0.5 }, { shape: 'heart', score: 0.2 }, { shape: 'round', score: 0.1 }]);
    expect(t).toEqual({ oblik: 'oval', drugi: null, procenti: { oval: 100 } });
  });
  it('drugi iznad 35 % → oba, zbir 100', () => {
    const t = topShapes([{ shape: 'oval', score: 0.3 }, { shape: 'heart', score: 0.2 }]);
    expect(t).toEqual({ oblik: 'oval', drugi: 'heart', procenti: { oval: 60, heart: 40 } });
  });
  it('granica: tačno 35 % ostaje dvojni rezultat', () => {
    const t = topShapes([{ shape: 'oval', score: 0.65 }, { shape: 'heart', score: 0.35 }]);
    expect(t.drugi).toBe('heart');
  });
});
