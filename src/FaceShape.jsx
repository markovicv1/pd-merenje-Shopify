// Oblik lica — poseban interfejs (?app=oblik). Specifikacija: docs/superpowers/plans/2026-09-25-oblik-lica-v2-spec.md
// Bez uvodne strane: kamera, obrisi oblika koji se smenjuju dok se prikupljaju frontalni frejmovi,
// pa rezultat koji se vraća stranici koja je pozvala aplikaciju. Sve se računa na uređaju.
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  SHAPE_KEYS, SHAPE_LABELS, FACE_SHAPE_LANDMARKS, pointsFromLandmarks, extractFeatures,
  medianFeatures, scoreShapes, topShapes,
} from './lib/faceShape.js';
import { outlinePath, OUTLINE_PROFILE } from './lib/faceShapeOutlines.js';
import { decomposeFacialMatrix, MAX_YAW_DEG } from './lib/headPose.js';
import { distanceStatus } from './lib/captureGate.js';
import { ALLOWED_ORIGINS, resolveReturnTarget } from './lib/returnTarget.js';

const COLLECT_MS = 1500;      // potrebno trajanje dobrih (frontalnih) frejmova
const CYCLE_MS = 200;         // smena obrisa tokom traženja (7 oblika ≈ 1,4 s)
const RESULT_HOLD_MS = 1200;  // koliko se rezultat vidi pre povratka
const TIMEOUT_MS = 20000;     // posle ovoga: „Pokušajte ponovo"
const MAX_PITCH_DEG = 8;      // strože nego za PD: nagib menja odnos visina/širina
const ACCENT = '#00b8ff';
const PATHS = typeof Path2D !== 'undefined' ? Object.fromEntries(SHAPE_KEYS.map(k => [k, new Path2D(outlinePath(k))])) : {};

const TEXT = {
  start: 'Sklonite kosu sa čela i skinite naočare.',
  none: 'Postavite lice u okvir.',
  pose: 'Gledajte pravo u kameru.',
  far: 'Priđite bliže.',
  close: 'Odmaknite se malo.',
  edge: 'Celo lice treba da bude u kadru.',
  good: 'Mirujte…',
};

const LEFT_IRIS = 468, RIGHT_IRIS = 473;

async function loadFaceLandmarker() {
  const mp = await import(/* @vite-ignore */ 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/vision_bundle.mjs');
  const vision = await mp.FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm');
  const make = (delegate) => mp.FaceLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
      delegate,
    },
    runningMode: 'VIDEO', numFaces: 1, outputFaceBlendshapes: false, outputFacialTransformationMatrixes: true,
  });
  try { return await make('GPU'); } catch { return make('CPU'); }
}

// Obris oblika postavljen na lice: centar između vrha čela i brade, skala po visini lica, rotacija po liniji očiju
function drawOutline(ctx, lm, W, H, key, { dashed, pulse }) {
  const top = lm[FACE_SHAPE_LANDMARKS.foreheadTop], chin = lm[FACE_SHAPE_LANDMARKS.chin];
  const l = lm[LEFT_IRIS], r = lm[RIGHT_IRIS];
  const tx = top.x * W, ty = top.y * H, cx = chin.x * W, cy = chin.y * H;
  const faceH = Math.hypot(cx - tx, cy - ty) * 1.08; // landmark 10 je ispod linije kose
  const p = OUTLINE_PROFILE[key];
  const s = (faceH / (p.chin - p.top)) * pulse;
  const roll = Math.atan2((r.y - l.y) * H, (r.x - l.x) * W);
  ctx.save();
  ctx.translate((tx + cx) / 2, (ty + cy) / 2 - faceH * 0.03);
  ctx.rotate(roll);
  ctx.scale(s, s);
  ctx.translate(-50, -(p.top + p.chin) / 2);
  ctx.lineWidth = (dashed ? 3 : 5) / s;
  ctx.setLineDash(dashed ? [10 / s, 8 / s] : []);
  ctx.strokeStyle = ACCENT;
  ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 4 / s;
  ctx.stroke(PATHS[key]);
  ctx.restore();
}

const pct = (t) => t.drugi
  ? `${SHAPE_LABELS[t.oblik]} ${t.procenti[t.oblik]} % · ${SHAPE_LABELS[t.drugi]} ${t.procenti[t.drugi]} %`
  : SHAPE_LABELS[t.oblik];

export default function FaceShape() {
  const params = useRef(new URLSearchParams(window.location.search)).current;
  const debug = params.get('debug') === '1';
  const returnUrl = params.get('return');
  const embed = params.get('embed');

  const videoRef = useRef(null), canvasRef = useRef(null), rafRef = useRef(0);
  const [landmarker, setLandmarker] = useState(null);
  const [phase, setPhase] = useState('loading'); // loading | search | result | timeout | error
  const [caption, setCaption] = useState(TEXT.start);
  const [result, setResult] = useState(null);     // { top, ranking, features }
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState(null);
  const st = useRef(null);

  const resetState = () => { st.current = { t0: performance.now(), last: 0, goodMs: 0, feats: [], lastLm: null, status: 'none', final: null }; };

  // MediaPipe
  useEffect(() => {
    let cancelled = false;
    loadFaceLandmarker()
      .then(fl => { if (!cancelled) setLandmarker(fl); })
      .catch(() => { if (!cancelled) { setErr('Greška pri učitavanju. Osvežite stranicu ili koristite Chrome.'); setPhase('error'); } });
    return () => { cancelled = true; };
  }, []);

  const stopCamera = () => {
    const v = videoRef.current;
    v?.srcObject?.getTracks().forEach(t => t.stop());
    if (v) v.srcObject = null;
  };

  const startCamera = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1080 }, height: { ideal: 1440 } }, audio: false,
      });
      const v = videoRef.current;
      if (!v) { stream.getTracks().forEach(t => t.stop()); return; }
      v.srcObject = stream;
      await new Promise(r => { v.onloadedmetadata = () => v.play().then(r).catch(r); });
      resetState(); setCaption(TEXT.start); setResult(null); setPhase('search');
    } catch (e) {
      setErr(e?.name === 'NotAllowedError' ? 'Pristup kameri odbijen. Dozvolite pristup u podešavanjima pretraživača.' : 'Kamera nije dostupna.');
      setPhase('error');
    }
  }, []);

  useEffect(() => { startCamera(); return () => { cancelAnimationFrame(rafRef.current); stopCamera(); }; }, [startCamera]);

  // Povratak rezultata pozivaocu (iframe → opener → povratna adresa → ostaje na ekranu)
  const deliver = useCallback((top) => {
    const msg = { type: 'opticarka:oblik', oblik: top.oblik, drugi: top.drugi, procenti: top.procenti, verzija: 1 };
    const inIframe = window.parent !== window;
    if (inIframe || embed) {
      for (const o of ALLOWED_ORIGINS) { try { window.parent.postMessage(msg, o); } catch { /* drugi origin */ } }
      setSent(true); return;
    }
    if (window.opener && !window.opener.closed) {
      for (const o of ALLOWED_ORIGINS) { try { window.opener.postMessage(msg, o); } catch { /* drugi origin */ } }
      setSent(true); setTimeout(() => window.close(), 300); return;
    }
    const target = resolveReturnTarget(returnUrl);
    if (target) {
      target.searchParams.set('oblik', top.oblik);
      if (top.drugi) { target.searchParams.set('drugi', top.drugi); target.searchParams.set('p', String(top.procenti[top.oblik])); }
      window.location.href = target.toString();
    }
  }, [embed, returnUrl]);

  // Petlja: detekcija, provera uslova, prikupljanje featura, animacija obrisa
  useEffect(() => {
    if (!landmarker || phase !== 'search') return;
    const loop = () => {
      const v = videoRef.current, c = canvasRef.current, s = st.current;
      if (!v || !c || !s || v.readyState < 2) { rafRef.current = requestAnimationFrame(loop); return; }
      const W = v.videoWidth, H = v.videoHeight;
      if (c.width !== W || c.height !== H) { c.width = W; c.height = H; }
      const ctx = c.getContext('2d');
      ctx.clearRect(0, 0, W, H);
      const now = performance.now();
      const dt = s.last ? Math.min(now - s.last, 100) : 0; s.last = now;

      let status = 'none';
      try {
        const res = landmarker.detectForVideo(v, now);
        const lm = res.faceLandmarks?.[0];
        if (lm) {
          s.lastLm = lm;
          const m = res.facialTransformationMatrixes?.[0]?.data;
          const pose = m ? decomposeFacialMatrix(m) : null;
          const ipd = Math.hypot((lm[RIGHT_IRIS].x - lm[LEFT_IRIS].x) * W, (lm[RIGHT_IRIS].y - lm[LEFT_IRIS].y) * H);
          const d = distanceStatus(ipd, W);
          const idx = Object.values(FACE_SHAPE_LANDMARKS);
          const inFrame = idx.every(i => lm[i].x > 0.02 && lm[i].x < 0.98 && lm[i].y > 0.02 && lm[i].y < 0.98);
          const frontal = !pose || (Math.abs(pose.yawDeg) <= MAX_YAW_DEG && Math.abs(pose.pitchDeg) <= MAX_PITCH_DEG);
          status = !inFrame ? 'edge' : d !== 'ok' ? d : !frontal ? 'pose' : 'good';
          if (status === 'good') {
            s.goodMs += dt;
            s.feats.push(extractFeatures(pointsFromLandmarks(lm, W, H)));
          }
          // Animacija: obrisi se smenjuju; blago „disanje"
          const k = SHAPE_KEYS[Math.floor(now / CYCLE_MS) % SHAPE_KEYS.length];
          drawOutline(ctx, lm, W, H, k, { dashed: true, pulse: 1 + 0.02 * Math.sin(now / 180) });
          if (debug) {
            ctx.fillStyle = '#ffe14d';
            for (const i of idx) { ctx.beginPath(); ctx.arc(lm[i].x * W, lm[i].y * H, 5, 0, Math.PI * 2); ctx.fill(); }
          }
        }
      } catch { /* sledeći frejm */ }

      if (status !== s.status) { s.status = status; setCaption(now - s.t0 < 1500 && status !== 'good' ? TEXT.start : TEXT[status]); }

      if (s.goodMs >= COLLECT_MS && s.feats.length >= 10) {
        const features = medianFeatures(s.feats);
        const ranking = scoreShapes(features);
        const top = topShapes(ranking);
        s.final = { top, lm: s.lastLm };
        // Zamrznut poslednji kadar + obris pobedničkog oblika (kamera se gasi odmah)
        ctx.clearRect(0, 0, W, H);
        try { ctx.drawImage(v, 0, 0, W, H); } catch { /* ostaje prazno */ }
        stopCamera();
        if (s.lastLm) drawOutline(ctx, s.lastLm, W, H, top.oblik, { dashed: false, pulse: 1 });
        setResult({ top, ranking, features });
        setCaption(`Vaš oblik lica: ${pct(top)}`);
        setPhase('result');
        return;
      }
      if (now - s.t0 > TIMEOUT_MS) { stopCamera(); setPhase('timeout'); return; }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [landmarker, phase, debug]);

  // Rezultat se vidi RESULT_HOLD_MS, pa se vraća pozivaocu
  useEffect(() => {
    if (phase !== 'result' || !result) return;
    const t = setTimeout(() => deliver(result.top), RESULT_HOLD_MS);
    return () => clearTimeout(t);
  }, [phase, result, deliver]);

  const retry = () => { setSent(false); setPhase('loading'); startCamera(); };

  return (
    <div style={{ minHeight: '100vh', background: '#171f2e', color: '#fff', fontFamily: 'Inter, system-ui, sans-serif', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <style>{`
        .fs-stage { position: relative; width: 100%; max-width: min(480px, calc((100vh - 140px) * 3 / 4)); aspect-ratio: 3 / 4; background: #050508; overflow: hidden; }
        .fs-stage video, .fs-stage canvas { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; transform: scaleX(-1); }
        .fs-btn { margin-top: 12px; padding: 14px 28px; border-radius: 12px; border: 0; background: ${ACCENT}; color: #001018; font-weight: 700; font-size: 16px; cursor: pointer; }
      `}</style>
      <div className="fs-stage">
        <video ref={videoRef} playsInline muted />
        <canvas ref={canvasRef} aria-hidden="true" />
        {phase === 'loading' && !err && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8c95a8' }}>Učitavanje…</div>
        )}
      </div>

      <div aria-live="polite" role="status" style={{ minHeight: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '10px 16px', textAlign: 'center' }}>
        <span style={{ background: 'rgba(0,0,0,0.85)', borderRadius: 10, padding: '8px 14px', fontSize: phase === 'result' ? 22 : 20, fontWeight: 600 }}>
          {err || (phase === 'timeout' ? 'Nismo uspeli da prepoznamo oblik lica. Gledajte pravo u kameru, uz dobro svetlo.' : caption)}
        </span>
      </div>

      {(phase === 'timeout' || (phase === 'result' && !sent && !returnUrl)) && (
        <button className="fs-btn" onClick={retry}>{phase === 'timeout' ? 'Pokušajte ponovo' : 'Ponovi'}</button>
      )}
      {sent && <p style={{ color: '#8c95a8', fontSize: 14 }}>Rezultat je poslat.</p>}

      {debug && result && (
        <pre style={{ fontSize: 11, color: '#9fb3c8', maxWidth: 480, width: '100%', padding: '8px 16px', whiteSpace: 'pre-wrap' }}>
          {JSON.stringify({
            top: result.top,
            features: Object.fromEntries(Object.entries(result.features).map(([k, v]) => [k, Number(v.toFixed(3))])),
            ranking: result.ranking.map(r => `${r.shape} ${(r.score * 100).toFixed(1)}%`),
          }, null, 1)}
        </pre>
      )}
    </div>
  );
}
