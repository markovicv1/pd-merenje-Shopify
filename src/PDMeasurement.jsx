import React, { useState, useRef, useEffect, useCallback } from 'react';

const CREDIT_CARD_WIDTH_MM = 85.6;
const LEFT_IRIS  = 468;
const RIGHT_IRIS = 473;
const HISTORY_SIZE   = 25;
const STILL_THRESHOLD = 4;   // px stddev
const MIN_IRIS_PX    = 65;   // too far if below
const MAX_IRIS_PX    = 200;  // too close if above
const COUNTDOWN_MS   = 3000;

function stddev(arr) {
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  return Math.sqrt(arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length);
}

const PDMeasurement = () => {
  const videoRef    = useRef(null);
  const canvasRef   = useRef(null);
  const imgRef      = useRef(null);
  const adjustRef   = useRef(null); // container for adjust markers

  const [step, setStep]               = useState('intro');
  const [cameraReady, setCameraReady] = useState(false);
  const [faceMesh, setFaceMesh]       = useState(null);
  const [loading, setLoading]         = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [error, setError]             = useState(null);
  const [finalPD, setFinalPD]         = useState(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [faceStatus, setFaceStatus]   = useState('none'); // none|far|good|close
  const [countdown, setCountdown]     = useState(null);
  const [snapshotUrl, setSnapshotUrl] = useState(null);
  const [snapshotAspect, setSnapshotAspect] = useState(1);
  const [showManualCopy, setShowManualCopy] = useState(false);

  // Markers stored as % of snapshot (0–100)
  const [cardMarkers, setCardMarkers]   = useState([
    { x: 12, y: 68 }, { x: 88, y: 68 }
  ]);
  const [pupilMarkers, setPupilMarkers] = useState([
    { x: 38, y: 42 }, { x: 62, y: 42 }
  ]);

  const animationRef      = useRef(null);
  const lastTimeRef       = useRef(-1);
  const faceHistoryRef    = useRef([]);
  const cntdwnStartRef    = useRef(null);
  const draggingRef       = useRef(null); // { group:'card'|'pupil', index:0|1 }

  // URL params
  const urlParams = useRef((() => {
    const p = new URLSearchParams(window.location.search);
    return { source: p.get('source'), returnUrl: p.get('return') };
  })());
  const { source, returnUrl } = urlParams.current;

  // ── MediaPipe loading ────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const tryLoad = async (delegate) => {
        const mp = await import('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/vision_bundle.js');
        const vision = await mp.FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );
        return mp.FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate,
          },
          runningMode: 'VIDEO',
          numFaces: 1,
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: false,
        });
      };

      try {
        setLoadingStatus('Učitavanje MediaPipe biblioteke...');
        const fl = await tryLoad('GPU');
        if (!cancelled) { setFaceMesh(fl); setLoading(false); setLoadingStatus(''); }
      } catch (err) {
        try {
          setLoadingStatus('Pokušavam CPU režim...');
          const fl = await tryLoad('CPU');
          if (!cancelled) { setFaceMesh(fl); setLoading(false); setLoadingStatus(''); }
        } catch (e2) {
          if (!cancelled) {
            setError(`Greška: ${err.message}. Probajte osvežiti stranicu ili koristiti Chrome.`);
            setLoading(false);
          }
        }
      }
    })();
    return () => { cancelled = true; cancelAnimationFrame(animationRef.current); };
  }, []);

  // ── Camera ───────────────────────────────────────────────────────────────
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 960 } },
        audio: false,
      });
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await new Promise(resolve => {
        videoRef.current.onloadedmetadata = () => videoRef.current.play().then(resolve).catch(resolve);
      });
      await new Promise(r => setTimeout(r, 300));
      setCameraReady(true);
    } catch (err) {
      if (err.name === 'NotAllowedError')
        setError('Pristup kameri odbijen. Dozvolite pristup u podešavanjima pretraživača.');
      else if (err.name === 'NotFoundError')
        setError('Kamera nije pronađena.');
      else
        setError(`Greška kamere: ${err.message}`);
    }
  };

  // ── Detection loop ────────────────────────────────────────────────────────
  const detectFace = useCallback(() => {
    const video  = videoRef.current;
    const canvas = canvasRef.current;
    if (!faceMesh || !video || !canvas) {
      animationRef.current = requestAnimationFrame(detectFace);
      return;
    }
    if (video.readyState !== 4 || video.currentTime === lastTimeRef.current) {
      animationRef.current = requestAnimationFrame(detectFace);
      return;
    }
    lastTimeRef.current = video.currentTime;

    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width  = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-canvas.width, 0);

    try {
      const results = faceMesh.detectForVideo(video, performance.now());

      if (!results.faceLandmarks?.length) {
        setFaceDetected(false);
        setFaceStatus('none');
        faceHistoryRef.current = [];
        cntdwnStartRef.current = null;
        setCountdown(null);
        ctx.restore();
        animationRef.current = requestAnimationFrame(detectFace);
        return;
      }

      setFaceDetected(true);
      const lm   = results.faceLandmarks[0];
      const lIris = lm[LEFT_IRIS];
      const rIris = lm[RIGHT_IRIS];
      const lX = lIris.x * canvas.width;
      const lY = lIris.y * canvas.height;
      const rX = rIris.x * canvas.width;
      const rY = rIris.y * canvas.height;
      const irisD = Math.abs(rX - lX);

      // Draw iris markers
      ctx.strokeStyle = '#00D4AA'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(lX, lY, 18, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(rX, rY, 18, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#00D4AA';
      ctx.beginPath(); ctx.arc(lX, lY, 5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(rX, rY, 5, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 2; ctx.setLineDash([8, 8]);
      ctx.beginPath(); ctx.moveTo(lX, lY); ctx.lineTo(rX, rY); ctx.stroke();
      ctx.setLineDash([]);

      // Proximity
      let status = irisD < MIN_IRIS_PX ? 'far' : irisD > MAX_IRIS_PX ? 'close' : 'good';
      setFaceStatus(status);

      // Stillness
      const hist = faceHistoryRef.current;
      hist.push({ lX, lY, rX, rY });
      if (hist.length > HISTORY_SIZE) hist.shift();
      const isStill = hist.length >= HISTORY_SIZE
        && stddev(hist.map(h => h.lX)) < STILL_THRESHOLD
        && stddev(hist.map(h => h.rX)) < STILL_THRESHOLD;

      // Countdown
      if (status === 'good' && isStill) {
        if (!cntdwnStartRef.current) cntdwnStartRef.current = Date.now();
        const elapsed  = Date.now() - cntdwnStartRef.current;
        const remaining = Math.max(0, Math.ceil((COUNTDOWN_MS - elapsed) / 1000));
        setCountdown(remaining);

        if (elapsed >= COUNTDOWN_MS) {
          // ── CAPTURE ────────────────────────────────────────────
          cancelAnimationFrame(animationRef.current);
          ctx.restore();

          // Crop snapshot to 3:4 (same crop object-fit:cover shows in the video container)
          const vW = video.videoWidth;
          const vH = video.videoHeight;
          const targetAspect = 3 / 4;
          let srcX, srcY, srcW, srcH;
          if (vW / vH > targetAspect) {
            srcH = vH; srcW = vH * targetAspect;
            srcX = (vW - srcW) / 2; srcY = 0;
          } else {
            srcW = vW; srcH = vW / targetAspect;
            srcX = 0; srcY = (vH - srcH) / 2;
          }
          const snap = document.createElement('canvas');
          snap.width = srcW; snap.height = srcH;
          const sc = snap.getContext('2d');
          sc.save(); sc.scale(-1, 1); sc.translate(-snap.width, 0);
          sc.drawImage(video, srcX, srcY, srcW, srcH, 0, 0, snap.width, snap.height);
          sc.restore();

          const url = snap.toDataURL('image/jpeg', 0.92);

          // Iris positions mapped into the cropped+mirrored frame
          const lXp = ((1 - lIris.x) * vW - srcX) / srcW * 100;
          const rXp = ((1 - rIris.x) * vW - srcX) / srcW * 100;
          const lYp = (lIris.y * vH - srcY) / srcH * 100;
          const rYp = (rIris.y * vH - srcY) / srcH * 100;

          setSnapshotUrl(url);
          setSnapshotAspect(snap.width / snap.height);
          setPupilMarkers([{ x: lXp, y: lYp }, { x: rXp, y: rYp }]);
          setCardMarkers([{ x: 12, y: 70 }, { x: 88, y: 70 }]);
          setCountdown(null);
          setStep('adjust');
          return;
        }
      } else {
        cntdwnStartRef.current = null;
        setCountdown(null);
      }
    } catch (e) {
      console.error('Detection error:', e);
    }

    ctx.restore();
    animationRef.current = requestAnimationFrame(detectFace);
  }, [faceMesh]);

  // Start detection when camera + model ready
  useEffect(() => {
    if (cameraReady && faceMesh && step === 'detecting') {
      lastTimeRef.current = -1;
      detectFace();
    }
    return () => cancelAnimationFrame(animationRef.current);
  }, [cameraReady, faceMesh, step, detectFace]);

  // ── Adjust: marker dragging ───────────────────────────────────────────────
  const getMarkerPct = (e) => {
    const el = adjustRef.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : e.clientX;
    const cy = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: Math.max(0, Math.min(100, (cx - rect.left) / rect.width  * 100)),
      y: Math.max(0, Math.min(100, (cy - rect.top)  / rect.height * 100)),
    };
  };

  const onMarkerDown = (group, index, e) => {
    e.stopPropagation();
    e.preventDefault();
    draggingRef.current = { group, index };
  };

  const onContainerMove = (e) => {
    if (!draggingRef.current) return;
    e.preventDefault();
    const pct = getMarkerPct(e);
    if (!pct) return;
    const { group, index } = draggingRef.current;
    if (group === 'card')  setCardMarkers(prev  => prev.map((m, i) => i === index ? { ...m, ...pct } : m));
    else                   setPupilMarkers(prev => prev.map((m, i) => i === index ? { ...m, ...pct } : m));
  };

  const onContainerUp = () => { draggingRef.current = null; };

  // ── PD calculation from markers ───────────────────────────────────────────
  const calculatePD = () => {
    const el = adjustRef.current;
    if (!el) return;
    const dispW = el.clientWidth;
    const dispH = el.clientHeight;

    const px = (pct, dim) => pct / 100 * dim;
    const dist = (a, b, dw, dh) => Math.sqrt((px(a.x, dw) - px(b.x, dw)) ** 2 + (px(a.y, dh) - px(b.y, dh)) ** 2);

    const cardPx  = dist(cardMarkers[0],  cardMarkers[1],  dispW, dispH);
    const pdPx    = dist(pupilMarkers[0], pupilMarkers[1], dispW, dispH);

    if (cardPx < 10) {
      setError('Postavite markere kartica dalje jedan od drugog.');
      return;
    }

    const rawPd = Math.round(pdPx * (CREDIT_CARD_WIDTH_MM / cardPx));
    const displayPd = source === 'vto' ? Math.max(48, Math.min(80, rawPd)) : rawPd;
    const isOutOfRange = source === 'vto'
      ? (rawPd < 48 || rawPd > 80)
      : (rawPd < 40 || rawPd > 80.5);

    if (isOutOfRange) {
      setError(`Vrednost (${rawPd}mm) je van opsega. Proverite markere ili ponovite merenje.`);
    }
    setFinalPD(displayPd);
    setStep('result');
  };

  // ── Return value to caller ────────────────────────────────────────────────
  const returnValue = (pd) => {
    navigator.clipboard?.writeText(String(pd)).catch(() => {});
    const openerAlive = window.opener && !window.opener.closed;
    if (openerAlive) {
      try { window.opener.postMessage({ type: 'PD_RESULT', value: pd }, '*'); } catch (e) {}
      setTimeout(() => window.close(), 300);
      return;
    }
    if (source === 'vto' && returnUrl) {
      const url = new URL(decodeURIComponent(returnUrl));
      url.searchParams.set('pd', pd);
      url.searchParams.set('reopenVTO', '1');
      window.location.href = url.toString();
      return;
    }
    setShowManualCopy(true);
  };

  // ── Reset ─────────────────────────────────────────────────────────────────
  const reset = () => {
    cancelAnimationFrame(animationRef.current);
    if (videoRef.current?.srcObject)
      videoRef.current.srcObject.getTracks().forEach(t => t.stop());
    setStep('intro');
    setCameraReady(false);
    setFaceDetected(false);
    setFaceStatus('none');
    setCountdown(null);
    setSnapshotUrl(null);
    setFinalPD(null);
    setShowManualCopy(false);
    faceHistoryRef.current = [];
    cntdwnStartRef.current = null;
    lastTimeRef.current = -1;
  };

  const retryDetect = () => {
    setStep('detecting');
    faceHistoryRef.current = [];
    cntdwnStartRef.current = null;
    setCountdown(null);
    lastTimeRef.current = -1;
  };

  // ── Shared styles ─────────────────────────────────────────────────────────
  const SHARED_CSS = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; margin: 0; padding: 0; }
    body { background: #0d1117; }
    .btn-primary {
      background: #00C8FF; border: none; padding: 16px 24px; border-radius: 50px;
      color: #000; font-weight: 700; font-size: 16px; cursor: pointer; width: 100%;
      font-family: inherit; touch-action: manipulation; transition: opacity 0.2s;
      display: flex; align-items: center; justify-content: center; gap: 8px;
    }
    .btn-primary:active { opacity: 0.85; }
    .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }
    .btn-secondary {
      background: transparent; border: 1px solid rgba(255,255,255,0.2);
      padding: 15px 24px; border-radius: 50px; color: #fff; width: 100%;
      font-weight: 500; font-size: 15px; cursor: pointer; font-family: inherit;
      touch-action: manipulation;
    }
    .btn-secondary:active { background: rgba(255,255,255,0.05); }
    .marker {
      position: absolute; width: 32px; height: 32px;
      cursor: grab; transform: translate(-50%, -50%);
      touch-action: none; user-select: none;
    }
    .marker:active { cursor: grabbing; }
    .marker-h, .marker-v { position: absolute; background: currentColor; }
    .marker-h { width: 100%; height: 2px; top: 50%; left: 0; transform: translateY(-50%); }
    .marker-v { width: 2px; height: 100%; left: 50%; top: 0; transform: translateX(-50%); }
    .marker-dot {
      position: absolute; width: 8px; height: 8px; border-radius: 50%;
      border: 2px solid currentColor; top: 50%; left: 50%;
      transform: translate(-50%, -50%); background: transparent;
    }
    .loading-spinner {
      width: 44px; height: 44px;
      border: 3px solid rgba(255,255,255,0.1); border-top-color: #00C8FF;
      border-radius: 50%; animation: spin 0.9s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    video { width: 100%; height: 100%; object-fit: cover; display: block; transform: scaleX(-1); }
    canvas { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
  `;

  // ── Shared header bar ──────────────────────────────────────────────────────
  const HeaderBar = () => (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 8, background: '#161b22',
          border: '1px solid rgba(255,255,255,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
        }}>
          <img
            src="https://opticarka.com/cdn/shop/t/39/assets/opticarka_logo_over_stream_black.png"
            alt="" style={{ width: 26, filter: 'invert(1)', opacity: 0.9 }}
          />
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: '#fff', lineHeight: 1.2 }}>PD Kalkulator</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)' }}>Optičarka.com</div>
        </div>
      </div>
      <div style={{
        background: '#00C8FF', color: '#000', fontSize: 12, fontWeight: 700,
        padding: '5px 12px', borderRadius: 20, letterSpacing: '0.01em',
      }}>✦ AI Powered</div>
    </div>
  );

  // ── Render: ADJUST (full-width, breaks out of 500px container) ───────────
  if (step === 'adjust' && snapshotUrl) {
    return (
      <div style={{ minHeight: '100vh', background: '#0d1117', fontFamily: 'Inter, -apple-system, sans-serif', color: '#fff', display: 'flex', flexDirection: 'column' }}>
        <style>{SHARED_CSS}</style>
        <HeaderBar />
        <div style={{ padding: '8px 16px 6px', display: 'flex', alignItems: 'center', gap: 16, fontSize: 12, color: 'rgba(255,255,255,0.45)' }}>
          <span><span style={{ color: '#FF6B6B' }}>━</span> ivice kartice</span>
          <span><span style={{ color: '#00C8FF' }}>━</span> zenice</span>
          <span style={{ marginLeft: 'auto' }}>Prevucite markere</span>
        </div>
        <div
          ref={adjustRef}
          onMouseMove={onContainerMove} onMouseUp={onContainerUp} onMouseLeave={onContainerUp}
          onTouchMove={onContainerMove} onTouchEnd={onContainerUp}
          style={{ position: 'relative', touchAction: 'none', flex: 1 }}
        >
          <img ref={imgRef} src={snapshotUrl} alt="snapshot" style={{ width: '100%', display: 'block' }} draggable={false} />
          <img src="https://opticarka.com/cdn/shop/t/39/assets/opticarka_logo_over_stream_black.png" alt=""
            style={{ position: 'absolute', top: 10, left: 10, width: 100, pointerEvents: 'none', zIndex: 5, filter: 'invert(1) drop-shadow(0 1px 3px rgba(0,0,0,0.8))' }} />
          {cardMarkers.map((m, i) => (
            <div key={`card-${i}`} className="marker" onMouseDown={e => onMarkerDown('card', i, e)} onTouchStart={e => onMarkerDown('card', i, e)} style={{ left: `${m.x}%`, top: `${m.y}%`, color: '#FF6B6B' }}>
              <div className="marker-h" /><div className="marker-v" /><div className="marker-dot" />
            </div>
          ))}
          {pupilMarkers.map((m, i) => (
            <div key={`pupil-${i}`} className="marker" onMouseDown={e => onMarkerDown('pupil', i, e)} onTouchStart={e => onMarkerDown('pupil', i, e)} style={{ left: `${m.x}%`, top: `${m.y}%`, color: '#00C8FF' }}>
              <div className="marker-h" /><div className="marker-v" /><div className="marker-dot" />
            </div>
          ))}
        </div>
        <div style={{ padding: '12px 16px 28px', display: 'flex', gap: 10 }}>
          <button className="btn-secondary" onClick={retryDetect} style={{ flex: 1 }}>Ponovi</button>
          <button className="btn-primary" onClick={calculatePD} style={{ flex: 2 }}>Izračunaj PD</button>
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh', background: '#0d1117',
      fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
      color: '#fff',
    }}>
      <style>{SHARED_CSS}</style>

      {/* Error banner */}
      {error && (
        <div style={{
          background: 'rgba(200,40,40,0.15)', borderBottom: '1px solid rgba(200,40,40,0.3)',
          padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <span style={{ color: '#FF6B6B', fontSize: 14 }}>{error}</span>
          <button onClick={() => setError(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 18, padding: '0 4px' }}>✕</button>
        </div>
      )}

      <div style={{ maxWidth: 480, margin: '0 auto', display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>

        {/* ── LOADING ── */}
        {loading && (
          <>
            <HeaderBar />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: 32 }}>
              <div className="loading-spinner" />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 600, marginBottom: 6 }}>Učitavanje AI modela</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>{loadingStatus || 'Molimo sačekajte...'}</div>
              </div>
            </div>
          </>
        )}

        {/* ── INTRO ── */}
        {step === 'intro' && !loading && (
          <>
            <HeaderBar />
            <div style={{ flex: 1, padding: '32px 20px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              {/* Camera icon */}
              <div style={{
                width: 80, height: 80, borderRadius: 20, background: '#161b22',
                border: '1px solid rgba(255,255,255,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 36, marginBottom: 20,
              }}>📷</div>

              <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 8, textAlign: 'center' }}>
                Izmerite <span style={{ color: '#00C8FF' }}>PD</span>
              </h1>
              <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14, marginBottom: 32, textAlign: 'center' }}>
                Pupilarna distanca za 30 sekundi
              </p>

              {/* Instruction card */}
              <div style={{
                width: '100%', background: '#161b22', borderRadius: 16,
                border: '1px solid rgba(255,255,255,0.08)', padding: '8px 0', marginBottom: 28,
              }}>
                {[
                  { icon: '💳', text: 'Držite karticu na vrhu nosa ili čela' },
                  { icon: '👁️', text: 'Gledajte TAČNO u kameru' },
                  { icon: '🧍', text: 'Mirujte 3 sekunde' },
                  { icon: '🎯', text: 'Označite ivice kartice' },
                ].map((item, i) => (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '13px 18px',
                    borderBottom: i < 3 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                  }}>
                    <span style={{ fontSize: 20, flexShrink: 0 }}>{item.icon}</span>
                    <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.85)' }}>{item.text}</span>
                  </div>
                ))}
              </div>

              <button
                className="btn-primary"
                onClick={() => { startCamera(); setStep('detecting'); }}
                disabled={!faceMesh}
              >
                {faceMesh ? (<>📹 Započni merenje</>) : 'Učitavanje...'}
              </button>
            </div>

            {/* Footer */}
            <div style={{ padding: '0 20px 28px', textAlign: 'center' }}>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginBottom: 4 }}>
                Na mobilnom: koristite dva prsta za zoom
              </p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}>
                Merenje se dešava u vašem browseru, svi podaci ostaju na vašem uređaju
              </p>
            </div>
          </>
        )}

        {/* ── DETECTING ── */}
        {step === 'detecting' && (
          <>
            <HeaderBar />

            {/* Status badges */}
            <div style={{ display: 'flex', gap: 8, padding: '10px 16px' }}>
              {faceStatus === 'far' && (
                <div style={{ background: 'rgba(180,110,0,0.85)', color: '#fff', fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 20 }}>
                  ↔ Priđite kameri
                </div>
              )}
              {faceStatus === 'close' && (
                <div style={{ background: 'rgba(180,40,40,0.85)', color: '#fff', fontSize: 12, fontWeight: 600, padding: '5px 12px', borderRadius: 20 }}>
                  ↔ Odmaknite se malo
                </div>
              )}
            </div>

            {/* Camera */}
            <div style={{ position: 'relative', background: '#000', aspectRatio: '3/4', overflow: 'hidden', flex: 1 }}>
              {/* Guide oval */}
              <div style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%, -52%)',
                width: '65%', height: '75%', borderRadius: '50%',
                border: `2.5px dashed ${faceStatus === 'good' ? '#00C8FF' : 'rgba(255,255,255,0.3)'}`,
                pointerEvents: 'none', zIndex: 9, transition: 'border-color 0.3s ease',
              }} />

              {/* Countdown */}
              {countdown !== null && (
                <div style={{
                  position: 'absolute', top: '50%', left: '50%',
                  transform: 'translate(-50%, -50%)',
                  fontSize: 96, fontWeight: 900, color: '#00C8FF', zIndex: 20,
                  textShadow: '0 0 40px rgba(0,200,255,0.9)', lineHeight: 1,
                }}>
                  {countdown === 0 ? '📸' : countdown}
                </div>
              )}

              <video ref={videoRef} playsInline muted />
              <canvas ref={canvasRef} />

              {/* Bottom status */}
              <div style={{
                position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
                display: 'flex', alignItems: 'center', gap: 8,
                background: 'rgba(0,0,0,0.75)', padding: '8px 16px', borderRadius: 20,
                fontSize: 13, whiteSpace: 'nowrap', zIndex: 10,
              }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                  background: faceStatus === 'good' ? '#00C8FF' : '#EF4444',
                  boxShadow: faceStatus === 'good' ? '0 0 6px #00C8FF' : '0 0 6px #EF4444',
                }} />
                {!faceDetected ? 'Pozicionirajte lice'
                  : faceStatus === 'far' ? 'Priđite kameri'
                  : faceStatus === 'close' ? 'Odmaknite se malo'
                  : countdown !== null ? 'Ostanite mirni...'
                  : 'Odlično! Ostanite mirni'}
              </div>

              {/* Error badge: face not detected */}
              {!faceDetected && cameraReady && (
                <div style={{
                  position: 'absolute', bottom: 52, left: '50%', transform: 'translateX(-50%)',
                  background: 'rgba(150,20,20,0.9)', color: '#fff',
                  fontSize: 13, fontWeight: 600, padding: '7px 16px', borderRadius: 20,
                  zIndex: 10, whiteSpace: 'nowrap',
                }}>
                  ✕ Lice nije detektovano
                </div>
              )}
            </div>

            <div style={{ padding: '12px 16px 28px' }}>
              <button className="btn-secondary" onClick={reset}>Otkaži</button>
            </div>
          </>
        )}

        {/* ── RESULT ── */}
        {step === 'result' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '36px 20px 28px' }}>
            {/* Optičarka logo */}
            <img
              src="https://opticarka.com/cdn/shop/t/39/assets/opticarka_logo_over_stream_black.png"
              alt="optičarka"
              style={{ width: 160, filter: 'invert(1)', opacity: 0.9, marginBottom: 28 }}
            />

            {/* Badge */}
            <div style={{
              width: 72, height: 72, marginBottom: 12,
              position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="72" height="72" viewBox="0 0 72 72" fill="none">
                <path d="M36 4L40.5 14.5L52 10L49.5 22L60 27L52 33.5L55 45.5L44 41L36 50L28 41L17 45.5L20 33.5L12 27L22.5 22L20 10L31.5 14.5Z" fill="none" stroke="#00C8FF" strokeWidth="2"/>
                <circle cx="36" cy="30" r="16" fill="#00C8FF"/>
                <path d="M27 30L33 36L45 24" stroke="#000" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.5)', marginBottom: 24 }}>Merenje završeno</p>

            {/* PD card */}
            <div style={{
              width: '100%', background: '#161b22', borderRadius: 16,
              border: '1px solid rgba(255,255,255,0.08)', padding: '20px 24px',
              textAlign: 'center', marginBottom: 20,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: 10 }}>
                Vaše PD rastojanje
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: 72, fontWeight: 800, color: '#00C8FF', lineHeight: 1 }}>{finalPD}</span>
                <span style={{ fontSize: 24, fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}>mm</span>
              </div>
              <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Normalan opseg: 48–80 mm</div>
            </div>

            {/* Out of range warning */}
            {finalPD != null && (finalPD < 48 || finalPD > 80) && (
              <div style={{
                width: '100%', background: 'rgba(180,110,0,0.15)', border: '1px solid rgba(180,110,0,0.35)',
                borderRadius: 12, padding: '12px 16px', marginBottom: 20,
                display: 'flex', gap: 10, alignItems: 'flex-start',
              }}>
                <span style={{ fontSize: 16 }}>⚠</span>
                <span style={{ fontSize: 13, color: '#F59E0B', lineHeight: 1.5 }}>
                  Rezultat van opsega 48–80 mm. Pokušajte ponovo ili posetite optičara.
                </span>
              </div>
            )}

            {showManualCopy ? (
              <div style={{ width: '100%', textAlign: 'center' }}>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>Vaš PD broj je:</p>
                <div style={{ fontSize: 52, fontWeight: 800, color: '#00C8FF', marginBottom: 8 }}>{finalPD}</div>
                <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.45)', marginBottom: 20, lineHeight: 1.5 }}>
                  Kopirano u clipboard. Zatvorite ovaj tab i unesite vrednost ručno.
                </p>
                <button className="btn-secondary" onClick={() => window.close()}>Zatvori tab</button>
              </div>
            ) : (
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button className="btn-primary" onClick={() => returnValue(finalPD)}>
                  {source === 'vto' ? 'Vrati u Optičarku' : source === 'lool' ? 'Sačuvaj i vrati se' : 'Kopiraj vrednost'}
                </button>
                <button className="btn-secondary" onClick={reset}>Izmeri ponovo</button>
              </div>
            )}

            {/* Footer */}
            <p style={{ marginTop: 28, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.2)' }}>
              Brinemo o vašim očima i vašoj privatnosti
            </p>
          </div>
        )}

      </div>
    </div>
  );
};

export default PDMeasurement;
