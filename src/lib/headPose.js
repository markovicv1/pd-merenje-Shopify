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
