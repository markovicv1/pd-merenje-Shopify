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
