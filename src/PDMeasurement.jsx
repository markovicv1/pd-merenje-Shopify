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
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
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

          const snap = document.createElement('canvas');
          snap.width  = video.videoWidth;
          snap.height = video.videoHeight;
          const sc = snap.getContext('2d');
          sc.save(); sc.scale(-1, 1); sc.translate(-snap.width, 0);
          sc.drawImage(video, 0, 0);
          sc.restore();

          const url = snap.toDataURL('image/jpeg', 0.92);

          // Mirrored iris positions as pct of snapshot
          const lXp = (1 - lIris.x) * 100;
          const rXp = (1 - rIris.x) * 100;
          const lYp = lIris.y * 100;
          const rYp = rIris.y * 100;

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

  // ── Status helpers ────────────────────────────────────────────────────────
  const statusConfig = {
    none:  { color: 'rgba(255,107,107,0.9)', text: '✗ Lice nije pronađeno' },
    far:   { color: 'rgba(255,193,7,0.9)',   text: '↔ Priđite bliže kameri' },
    close: { color: 'rgba(255,107,107,0.9)', text: '↔ Odmaknite se malo' },
    good:  { color: 'rgba(0,212,170,0.9)',   text: '✓ Dobra pozicija' },
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%)',
      fontFamily: '"Space Grotesk", -apple-system, BlinkMacSystemFont, sans-serif',
      color: '#fff',
      padding: '16px',
      paddingBottom: '40px',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        .glass-card {
          background: rgba(255,255,255,0.05);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 20px;
          padding: 24px;
        }
        .btn-primary {
          background: linear-gradient(135deg, #00D4AA 0%, #00A388 100%);
          border: none; padding: 16px 28px; border-radius: 12px;
          color: #000; font-weight: 600; font-size: 16px; cursor: pointer;
          transition: all 0.3s ease; font-family: inherit; touch-action: manipulation;
        }
        .btn-primary:active { transform: scale(0.98); }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-secondary {
          background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.2);
          padding: 14px 20px; border-radius: 10px; color: #fff;
          font-weight: 500; font-size: 15px; cursor: pointer; font-family: inherit;
          touch-action: manipulation;
        }
        .video-container {
          position: relative; border-radius: 16px; overflow: hidden;
          background: #000; aspect-ratio: 4/3;
        }
        @media (max-width: 480px) { .video-container { aspect-ratio: 3/4; } }
        video { width: 100%; height: 100%; object-fit: cover; display: block; transform: scaleX(-1); }
        canvas { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
        .loading-spinner {
          width: 48px; height: 48px;
          border: 4px solid rgba(255,255,255,0.1); border-top-color: #00D4AA;
          border-radius: 50%; animation: spin 1s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .info-box {
          background: rgba(0,212,170,0.1); border: 1px solid rgba(0,212,170,0.3);
          border-radius: 12px; padding: 16px;
        }
        .marker {
          position: absolute; width: 28px; height: 28px; border-radius: 50%;
          border: 3px solid white; display: flex; align-items: center;
          justify-content: center; font-size: 10px; font-weight: 700;
          cursor: grab; transform: translate(-50%, -50%);
          touch-action: none; user-select: none; color: #fff;
          box-shadow: 0 0 8px rgba(0,0,0,0.6);
        }
        .marker:active { cursor: grabbing; transform: translate(-50%,-50%) scale(1.2); }
      `}</style>

      <div style={{ maxWidth: '500px', margin: '0 auto' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h1 style={{
            fontSize: '24px', fontWeight: '700', marginBottom: '4px',
            background: 'linear-gradient(135deg, #fff 0%, #00D4AA 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>PD Merenje</h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', margin: 0 }}>
            Pupilarna distanca • Optičarka.com
          </p>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: 'rgba(255,107,107,0.15)', border: '1px solid rgba(255,107,107,0.4)',
            borderRadius: '12px', padding: '16px', marginBottom: '20px',
          }}>
            <p style={{ color: '#FF6B6B', margin: '0 0 12px 0', fontSize: '14px' }}>{error}</p>
            <button className="btn-secondary" onClick={() => setError(null)}>OK</button>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="glass-card" style={{ textAlign: 'center', padding: '40px' }}>
            <div className="loading-spinner" style={{ margin: '0 auto 24px' }} />
            <p style={{ marginBottom: '8px', fontWeight: '500' }}>Učitavanje AI modela</p>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.5)', margin: 0 }}>
              {loadingStatus || 'Molimo sačekajte...'}
            </p>
          </div>
        )}

        {/* ── INTRO ── */}
        {step === 'intro' && !loading && (
          <div className="glass-card">
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '72px', height: '72px',
                background: 'linear-gradient(135deg, #00D4AA 0%, #00A388 100%)',
                borderRadius: '18px', display: 'flex', alignItems: 'center',
                justifyContent: 'center', margin: '0 auto 20px', fontSize: '32px',
              }}>👁️</div>
              <h2 style={{ fontSize: '20px', marginBottom: '12px' }}>Izmerite svoju PD vrednost</h2>
              <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '20px', lineHeight: '1.6', fontSize: '15px' }}>
                PD (pupilarna distanca) je rastojanje između centara zenica, potrebno za preciznu izradu naočara.
              </p>
              <div className="info-box" style={{ textAlign: 'left', marginBottom: '24px' }}>
                <p style={{ fontWeight: '600', marginBottom: '10px', fontSize: '14px' }}>📋 Priprema:</p>
                <ul style={{ margin: 0, paddingLeft: '18px', color: 'rgba(255,255,255,0.8)', fontSize: '14px', lineHeight: '1.8' }}>
                  <li>Kreditna/bankovna kartica — držite je pored lica</li>
                  <li>Dobro osvetljenje (ne pozadinsko)</li>
                  <li>Skinite naočare ako ih nosite</li>
                </ul>
              </div>
              <button
                className="btn-primary"
                onClick={() => { startCamera(); setStep('detecting'); }}
                disabled={!faceMesh}
                style={{ width: '100%' }}
              >
                {faceMesh ? '📷 Započni merenje' : 'Učitavanje...'}
              </button>
            </div>
          </div>
        )}

        {/* ── DETECTING ── */}
        {step === 'detecting' && (
          <div className="glass-card" style={{ padding: '16px' }}>
            <div style={{ marginBottom: '12px' }}>
              <h2 style={{ fontSize: '17px', marginBottom: '4px' }}>Pozicionirajte lice</h2>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', margin: 0 }}>
                Gledajte u kameru. Kartica pored lica, horizontalno.
              </p>
            </div>

            <div className="video-container">
              {/* Face status */}
              <div style={{
                position: 'absolute', top: 12, left: 12,
                background: statusConfig[faceStatus]?.color || 'rgba(100,100,100,0.9)',
                padding: '7px 14px', borderRadius: '20px',
                fontSize: '13px', fontWeight: '600', zIndex: 10,
                color: faceStatus === 'far' ? '#000' : '#fff',
              }}>
                {statusConfig[faceStatus]?.text || ''}
              </div>

              {/* Countdown */}
              {countdown !== null && (
                <div style={{
                  position: 'absolute', top: '50%', left: '50%',
                  transform: 'translate(-50%, -50%)',
                  fontSize: '96px', fontWeight: '900',
                  color: '#00D4AA', zIndex: 20,
                  textShadow: '0 0 30px rgba(0,212,170,0.8)',
                  lineHeight: 1,
                }}>
                  {countdown === 0 ? '📸' : countdown}
                </div>
              )}

              <video ref={videoRef} playsInline muted />
              <canvas ref={canvasRef} />

              {/* Bottom hint */}
              <div style={{
                position: 'absolute', bottom: 12, left: '50%',
                transform: 'translateX(-50%)',
                background: 'rgba(0,0,0,0.85)',
                padding: '10px 18px', borderRadius: '10px',
                fontSize: '13px', textAlign: 'center',
                maxWidth: '90%', zIndex: 10,
              }}>
                {!faceDetected
                  ? 'Okrenite lice prema kameri'
                  : faceStatus === 'far'
                    ? 'Priđite kameri'
                    : faceStatus === 'close'
                      ? 'Odmaknite se malo'
                      : countdown !== null
                        ? 'Ostanite mirni...'
                        : 'Odlično! Ostanite mirni 3 sekunde'}
              </div>
            </div>

            <button className="btn-secondary" onClick={reset} style={{ width: '100%', marginTop: '12px' }}>
              Otkaži
            </button>
          </div>
        )}

        {/* ── ADJUST ── */}
        {step === 'adjust' && snapshotUrl && (
          <div className="glass-card" style={{ padding: '16px' }}>
            <h2 style={{ fontSize: '17px', marginBottom: '4px' }}>Postavite markere</h2>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', marginBottom: '12px' }}>
              Crveni markeri — ivice kartice &nbsp;|&nbsp; Tirkizni markeri — zenice
            </p>

            {/* Snapshot + draggable markers */}
            <div
              ref={adjustRef}
              onMouseMove={onContainerMove}
              onMouseUp={onContainerUp}
              onMouseLeave={onContainerUp}
              onTouchMove={onContainerMove}
              onTouchEnd={onContainerUp}
              style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', touchAction: 'none' }}
            >
              <img
                ref={imgRef}
                src={snapshotUrl}
                alt="snapshot"
                style={{ width: '100%', display: 'block', borderRadius: '12px' }}
                draggable={false}
              />

              {/* Card edge markers */}
              {cardMarkers.map((m, i) => (
                <div
                  key={`card-${i}`}
                  className="marker"
                  onMouseDown={e => onMarkerDown('card', i, e)}
                  onTouchStart={e => onMarkerDown('card', i, e)}
                  style={{
                    left: `${m.x}%`, top: `${m.y}%`,
                    background: '#FF6B6B',
                  }}
                >
                  {i === 0 ? '◀' : '▶'}
                </div>
              ))}

              {/* Pupil markers */}
              {pupilMarkers.map((m, i) => (
                <div
                  key={`pupil-${i}`}
                  className="marker"
                  onMouseDown={e => onMarkerDown('pupil', i, e)}
                  onTouchStart={e => onMarkerDown('pupil', i, e)}
                  style={{
                    left: `${m.x}%`, top: `${m.y}%`,
                    background: '#00A388',
                  }}
                >
                  {i === 0 ? 'L' : 'R'}
                </div>
              ))}
            </div>

            <p style={{ fontSize: '12px', color: 'rgba(255,255,255,0.45)', textAlign: 'center', marginTop: '8px', marginBottom: '16px' }}>
              Prevucite markere na tačne pozicije
            </p>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button className="btn-secondary" onClick={retryDetect} style={{ flex: 1 }}>
                Ponovi
              </button>
              <button className="btn-primary" onClick={calculatePD} style={{ flex: 2 }}>
                Izračunaj PD
              </button>
            </div>
          </div>
        )}

        {/* ── RESULT ── */}
        {step === 'result' && (
          <div className="glass-card" style={{ textAlign: 'center' }}>
            <div style={{
              width: '72px', height: '72px',
              background: 'linear-gradient(135deg, #00D4AA 0%, #00A388 100%)',
              borderRadius: '50%', display: 'flex', alignItems: 'center',
              justifyContent: 'center', margin: '0 auto 20px', fontSize: '32px',
            }}>✓</div>

            <h2 style={{ fontSize: '18px', marginBottom: '4px' }}>Vaša pupilarna distanca</h2>
            <div style={{
              fontSize: '64px', fontWeight: '700',
              background: 'linear-gradient(135deg, #00D4AA 0%, #00A388 100%)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>
              {finalPD} mm
            </div>

            <div className="info-box" style={{ textAlign: 'left', marginTop: '20px' }}>
              <p style={{ fontWeight: '600', marginBottom: '6px', fontSize: '14px' }}>ℹ️ Napomena</p>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)', margin: 0, lineHeight: '1.6' }}>
                Ovo je približna vrednost. Za dioptriju ±4.00 i veću, preporučujemo profesionalno merenje.
              </p>
            </div>

            <div style={{
              marginTop: '16px', padding: '14px',
              background: 'rgba(255,255,255,0.05)', borderRadius: '10px', fontSize: '13px',
            }}>
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>Normalne vrednosti: </span>
              <strong>Odrasli:</strong> 54–74mm &nbsp;|&nbsp; <strong>Deca:</strong> 43–58mm
            </div>

            {showManualCopy ? (
              <div style={{
                marginTop: '20px', background: 'rgba(0,212,170,0.1)',
                border: '1px solid rgba(0,212,170,0.4)', borderRadius: '12px', padding: '20px',
              }}>
                <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: 'rgba(255,255,255,0.7)' }}>Vaš PD broj je:</p>
                <div style={{ fontSize: '48px', fontWeight: '700', color: '#00D4AA', margin: '0 0 8px 0' }}>{finalPD}</div>
                <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: 'rgba(255,255,255,0.6)', lineHeight: '1.5' }}>
                  Kopirano u clipboard. Zatvorite ovaj tab i unesite vrednost ručno.
                </p>
                <button className="btn-secondary" onClick={() => window.close()} style={{ width: '100%' }}>Zatvori tab</button>
              </div>
            ) : (
              <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                <button className="btn-secondary" onClick={reset} style={{ flex: 1 }}>Ponovi</button>
                <button className="btn-primary" onClick={() => returnValue(finalPD)} style={{ flex: 2 }}>
                  {source === 'vto'  ? 'Vrati u Optičarku' :
                   source === 'lool' ? 'Sačuvaj i vrati se' :
                                       'Kopiraj vrednost'}
                </button>
              </div>
            )}
          </div>
        )}

        <p style={{ textAlign: 'center', marginTop: '24px', color: 'rgba(255,255,255,0.3)', fontSize: '11px' }}>
          🔒 Merenje se vrši lokalno — podaci ne napuštaju vaš uređaj
        </p>
      </div>
    </div>
  );
};

export default PDMeasurement;
