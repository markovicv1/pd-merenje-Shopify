import React, { useState, useRef, useEffect, useCallback } from 'react';

const CREDIT_CARD_WIDTH_MM = 85.6;

const PDMeasurement = () => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [step, setStep] = useState('intro');
  const [cameraReady, setCameraReady] = useState(false);
  const [faceMesh, setFaceMesh] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('');
  const [error, setError] = useState(null);
  const [cardWidth, setCardWidth] = useState(null);
  const [measurements, setMeasurements] = useState([]);
  const [finalPD, setFinalPD] = useState(null);
  const [faceDetected, setFaceDetected] = useState(false);
  const [currentPD, setCurrentPD] = useState(null);
  const [showManualCopy, setShowManualCopy] = useState(false);
  const animationRef = useRef(null);
  const lastVideoTimeRef = useRef(-1);

  // URL params (parsed once, stable across renders)
  const urlParams = useRef((() => {
    const p = new URLSearchParams(window.location.search);
    return {
      source: p.get('source'),     // 'vto' | 'lool' | null
      returnUrl: p.get('return'),  // encoded return URL (VTO only)
    };
  })());
  const { source, returnUrl } = urlParams.current;

  // Load MediaPipe Face Mesh
  useEffect(() => {
    const loadMediaPipe = async () => {
      setLoading(true);
      
      try {
        setLoadingStatus('Učitavanje MediaPipe biblioteke...');
        
        // Load MediaPipe Vision
        if (!window.FaceLandmarker) {
          await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/vision_bundle.min.js';
            script.onload = resolve;
            script.onerror = () => reject(new Error('Nije moguće učitati MediaPipe'));
            document.head.appendChild(script);
          });
        }

        setLoadingStatus('Inicijalizacija Face Mesh modela...');
        
        // Wait for the module to be available
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const vision = await window.FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm'
        );

        setLoadingStatus('Preuzimanje AI modela (~5MB)...');

        const faceLandmarker = await window.FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU'
          },
          runningMode: 'VIDEO',
          numFaces: 1,
          outputFaceBlendshapes: false,
          outputFacialTransformationMatrixes: false
        });

        setFaceMesh(faceLandmarker);
        setLoading(false);
        setLoadingStatus('');
        
      } catch (err) {
        console.error('MediaPipe loading error:', err);
        
        // Try CPU fallback
        try {
          setLoadingStatus('Pokušavam CPU režim...');
          
          const vision = await window.FilesetResolver.forVisionTasks(
            'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.8/wasm'
          );

          const faceLandmarker = await window.FaceLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
              delegate: 'CPU'
            },
            runningMode: 'VIDEO',
            numFaces: 1
          });

          setFaceMesh(faceLandmarker);
          setLoading(false);
          setLoadingStatus('');
          
        } catch (fallbackErr) {
          console.error('CPU fallback failed:', fallbackErr);
          setError(`Greška: ${err.message}. Probajte osvežiti stranicu ili koristiti drugi pretraživač (Chrome preporučen).`);
          setLoading(false);
        }
      }
    };

    loadMediaPipe();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  // Start camera
  const startCamera = async () => {
    try {
      // Request camera with mobile-friendly constraints
      const constraints = {
        video: {
          facingMode: 'user',
          width: { ideal: 1280, max: 1920 },
          height: { ideal: 720, max: 1080 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Wait for video to be ready
        await new Promise((resolve) => {
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play().then(resolve).catch(resolve);
          };
        });
        
        // Give it a moment to stabilize
        await new Promise(resolve => setTimeout(resolve, 300));
        setCameraReady(true);
      }
    } catch (err) {
      console.error('Camera error:', err);
      if (err.name === 'NotAllowedError') {
        setError('Pristup kameri je odbijen. Dozvolite pristup kameri u podešavanjima pretraživača.');
      } else if (err.name === 'NotFoundError') {
        setError('Kamera nije pronađena na ovom uređaju.');
      } else {
        setError(`Greška kamere: ${err.message}`);
      }
    }
  };

  // MediaPipe Face Mesh landmark indices
  // Left iris: 468-472, center at 468
  // Right iris: 473-477, center at 473
  const LEFT_IRIS = 468;
  const RIGHT_IRIS = 473;

  // Detect face
  const detectFace = useCallback(() => {
    if (!faceMesh || !videoRef.current || !canvasRef.current) {
      animationRef.current = requestAnimationFrame(detectFace);
      return;
    }

    const video = videoRef.current;
    
    if (video.readyState !== 4 || video.currentTime === lastVideoTimeRef.current) {
      animationRef.current = requestAnimationFrame(detectFace);
      return;
    }
    
    lastVideoTimeRef.current = video.currentTime;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    // Set canvas size to match video
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }

    try {
      const startTimeMs = performance.now();
      const results = faceMesh.detectForVideo(video, startTimeMs);

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      // Mirror the canvas
      ctx.save();
      ctx.scale(-1, 1);
      ctx.translate(-canvas.width, 0);

      if (results.faceLandmarks && results.faceLandmarks.length > 0) {
        setFaceDetected(true);
        const landmarks = results.faceLandmarks[0];

        // Get iris positions (normalized 0-1, need to scale to video dimensions)
        const leftIris = landmarks[LEFT_IRIS];
        const rightIris = landmarks[RIGHT_IRIS];

        if (leftIris && rightIris) {
          const leftX = leftIris.x * canvas.width;
          const leftY = leftIris.y * canvas.height;
          const rightX = rightIris.x * canvas.width;
          const rightY = rightIris.y * canvas.height;

          // Draw iris circles
          ctx.strokeStyle = '#00D4AA';
          ctx.lineWidth = 3;
          
          ctx.beginPath();
          ctx.arc(leftX, leftY, 18, 0, Math.PI * 2);
          ctx.stroke();
          
          ctx.beginPath();
          ctx.arc(rightX, rightY, 18, 0, Math.PI * 2);
          ctx.stroke();

          // Draw iris centers
          ctx.fillStyle = '#00D4AA';
          ctx.beginPath();
          ctx.arc(leftX, leftY, 5, 0, Math.PI * 2);
          ctx.fill();
          
          ctx.beginPath();
          ctx.arc(rightX, rightY, 5, 0, Math.PI * 2);
          ctx.fill();

          // Draw PD line
          ctx.strokeStyle = '#FFD700';
          ctx.lineWidth = 2;
          ctx.setLineDash([8, 8]);
          ctx.beginPath();
          ctx.moveTo(leftX, leftY);
          ctx.lineTo(rightX, rightY);
          ctx.stroke();
          ctx.setLineDash([]);

          // Calculate pixel distance
          const pixelDistance = Math.sqrt(
            Math.pow(rightX - leftX, 2) +
            Math.pow(rightY - leftY, 2)
          );

          // Calculate PD if calibrated
          if (cardWidth && step === 'measure') {
            const mmPerPixel = CREDIT_CARD_WIDTH_MM / cardWidth;
            const pd = pixelDistance * mmPerPixel;
            setCurrentPD(Math.round(pd));
            
            // Store measurement
            setMeasurements(prev => [...prev, pd].slice(-30));
          }
        }
      } else {
        setFaceDetected(false);
        setCurrentPD(null);
      }

      ctx.restore();
    } catch (err) {
      console.error('Detection error:', err);
    }

    animationRef.current = requestAnimationFrame(detectFace);
  }, [faceMesh, cardWidth, step]);

  // Start detection when ready
  useEffect(() => {
    if (cameraReady && faceMesh && (step === 'calibrate' || step === 'measure')) {
      lastVideoTimeRef.current = -1;
      detectFace();
    }
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [cameraReady, faceMesh, step, detectFace]);

  // Card calibration
  const [cardPoints, setCardPoints] = useState([]);
  
  const handleCanvasClick = (e) => {
    if (step !== 'calibrate') return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = canvas.width - ((e.clientX - rect.left) * scaleX);
    const y = (e.clientY - rect.top) * scaleY;
    
    const newPoints = [...cardPoints, { x, y }];
    setCardPoints(newPoints);
    
    // Draw point immediately
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.scale(-1, 1);
    ctx.translate(-canvas.width, 0);
    
    ctx.fillStyle = '#FF6B6B';
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, 12, 0, Math.PI * 2);
    ctx.stroke();
    
    ctx.restore();
    
    if (newPoints.length === 2) {
      const distance = Math.sqrt(
        Math.pow(newPoints[1].x - newPoints[0].x, 2) +
        Math.pow(newPoints[1].y - newPoints[0].y, 2)
      );
      setCardWidth(distance);
      
      setTimeout(() => {
        setStep('measure');
        setCardPoints([]);
      }, 300);
    }
  };

  // Touch support for mobile
  const handleTouch = (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    handleCanvasClick({
      clientX: touch.clientX,
      clientY: touch.clientY
    });
  };

  // Return value to caller (postMessage → close tab → URL redirect → manual copy)
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

    // LOOL (or unknown) without opener — show manual copy UI
    setShowManualCopy(true);
  };

  // Calculate final PD
  const finalizeMeasurement = () => {
    if (measurements.length < 10) {
      setError('Potrebno je više merenja. Držite glavu mirno još nekoliko sekundi.');
      return;
    }

    const sorted = [...measurements].sort((a, b) => a - b);
    const q1 = sorted[Math.floor(sorted.length * 0.25)];
    const q3 = sorted[Math.floor(sorted.length * 0.75)];
    const iqr = q3 - q1;

    const filtered = sorted.filter(v => v >= q1 - 1.5 * iqr && v <= q3 + 1.5 * iqr);
    const median = filtered[Math.floor(filtered.length / 2)];
    const rawPd = Math.round(median);

    // Clamp only for VTO (dropdown range 48–80)
    const displayPd = source === 'vto' ? Math.max(48, Math.min(80, rawPd)) : rawPd;
    const isOutOfRange = source === 'vto'
      ? (rawPd < 48 || rawPd > 80)
      : (rawPd < 40 || rawPd > 80.5);

    if (isOutOfRange) {
      setError(`Izmerena vrednost (${rawPd} mm) je van normalnog opsega. Pokušajte ponovo uz bolju kalibraciju.`);
    }

    setFinalPD(displayPd);
    setStep('result');
    
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    
    // Stop camera
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
    }
  };

  const reset = () => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    if (videoRef.current?.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
    }
    
    setStep('intro');
    setCameraReady(false);
    setCardWidth(null);
    setMeasurements([]);
    setFinalPD(null);
    setCardPoints([]);
    setFaceDetected(false);
    setCurrentPD(null);
    lastVideoTimeRef.current = -1;
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%)',
      fontFamily: '"Space Grotesk", -apple-system, BlinkMacSystemFont, sans-serif',
      color: '#fff',
      padding: '16px',
      paddingBottom: '40px'
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap');
        
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        
        .glass-card {
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          padding: 24px;
        }
        
        .btn-primary {
          background: linear-gradient(135deg, #00D4AA 0%, #00A388 100%);
          border: none;
          padding: 16px 28px;
          border-radius: 12px;
          color: #000;
          font-weight: 600;
          font-size: 16px;
          cursor: pointer;
          transition: all 0.3s ease;
          font-family: inherit;
          touch-action: manipulation;
        }
        
        .btn-primary:active { transform: scale(0.98); }
        .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
        
        .btn-secondary {
          background: rgba(255, 255, 255, 0.1);
          border: 1px solid rgba(255, 255, 255, 0.2);
          padding: 14px 20px;
          border-radius: 10px;
          color: #fff;
          font-weight: 500;
          font-size: 15px;
          cursor: pointer;
          font-family: inherit;
          touch-action: manipulation;
        }
        
        .video-container {
          position: relative;
          border-radius: 16px;
          overflow: hidden;
          background: #000;
          aspect-ratio: 4/3;
        }
        
        @media (max-width: 480px) {
          .video-container { aspect-ratio: 3/4; }
        }
        
        video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
          transform: scaleX(-1);
        }
        
        canvas {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
        }
        
        canvas.clickable {
          touch-action: none;
          cursor: crosshair;
        }
        
        .face-status {
          position: absolute;
          top: 12px;
          left: 12px;
          padding: 8px 14px;
          border-radius: 20px;
          font-size: 13px;
          font-weight: 600;
          z-index: 10;
        }
        
        .face-status.detected { background: rgba(0, 212, 170, 0.95); color: #000; }
        .face-status.not-detected { background: rgba(255, 107, 107, 0.95); color: #fff; }
        
        .pd-display {
          position: absolute;
          top: 12px;
          right: 12px;
          background: rgba(0, 0, 0, 0.85);
          padding: 10px 18px;
          border-radius: 12px;
          font-size: 20px;
          font-weight: 700;
          color: #00D4AA;
          z-index: 10;
        }
        
        .result-value {
          font-size: 64px;
          font-weight: 700;
          background: linear-gradient(135deg, #00D4AA 0%, #00A388 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        
        .info-box {
          background: rgba(0, 212, 170, 0.1);
          border: 1px solid rgba(0, 212, 170, 0.3);
          border-radius: 12px;
          padding: 16px;
        }
        
        .loading-spinner {
          width: 48px;
          height: 48px;
          border: 4px solid rgba(255, 255, 255, 0.1);
          border-top-color: #00D4AA;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        
        @keyframes spin { to { transform: rotate(360deg); } }
        
        .progress-bar {
          height: 8px;
          background: rgba(255,255,255,0.1);
          border-radius: 4px;
          overflow: hidden;
        }
        
        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #00D4AA, #00A388);
          border-radius: 4px;
          transition: width 0.3s ease;
        }
        
        .instruction-overlay {
          position: absolute;
          bottom: 16px;
          left: 50%;
          transform: translateX(-50%);
          background: rgba(0,0,0,0.9);
          padding: 12px 20px;
          border-radius: 12px;
          font-size: 14px;
          text-align: center;
          max-width: 90%;
          z-index: 10;
        }
      `}</style>

      <div style={{ maxWidth: '500px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <h1 style={{ 
            fontSize: '24px', 
            fontWeight: '700', 
            marginBottom: '4px',
            background: 'linear-gradient(135deg, #fff 0%, #00D4AA 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text'
          }}>
            PD Merenje
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px', margin: 0 }}>
            Pupilarna distanca • Optičarka.com
          </p>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: 'rgba(255, 107, 107, 0.15)',
            border: '1px solid rgba(255, 107, 107, 0.4)',
            borderRadius: '12px',
            padding: '16px',
            marginBottom: '20px'
          }}>
            <p style={{ color: '#FF6B6B', margin: '0 0 12px 0', fontSize: '14px' }}>{error}</p>
            <button className="btn-secondary" onClick={() => setError(null)}>
              OK
            </button>
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

        {/* Intro */}
        {step === 'intro' && !loading && (
          <div className="glass-card">
            <div style={{ textAlign: 'center' }}>
              <div style={{ 
                width: '72px', 
                height: '72px', 
                background: 'linear-gradient(135deg, #00D4AA 0%, #00A388 100%)',
                borderRadius: '18px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
                fontSize: '32px'
              }}>
                👁️
              </div>
              
              <h2 style={{ fontSize: '20px', marginBottom: '12px' }}>
                Izmerite svoju PD vrednost
              </h2>
              
              <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '20px', lineHeight: '1.6', fontSize: '15px' }}>
                PD (pupilarna distanca) je rastojanje između centara zenica, potrebno za preciznu izradu naočara.
              </p>

              <div className="info-box" style={{ textAlign: 'left', marginBottom: '24px' }}>
                <p style={{ fontWeight: '600', marginBottom: '10px', fontSize: '14px' }}>📋 Priprema:</p>
                <ul style={{ margin: 0, paddingLeft: '18px', color: 'rgba(255,255,255,0.8)', fontSize: '14px', lineHeight: '1.8' }}>
                  <li>Kreditna/bankovna kartica</li>
                  <li>Dobro osvetljenje (ne pozadinsko)</li>
                  <li>Skinite naočare ako ih nosite</li>
                </ul>
              </div>

              <button 
                className="btn-primary" 
                onClick={() => { startCamera(); setStep('calibrate'); }}
                disabled={!faceMesh}
                style={{ width: '100%' }}
              >
                {faceMesh ? '📷 Započni merenje' : 'Učitavanje...'}
              </button>
            </div>
          </div>
        )}

        {/* Calibration */}
        {step === 'calibrate' && (
          <div className="glass-card" style={{ padding: '16px' }}>
            <div style={{ marginBottom: '12px' }}>
              <h2 style={{ fontSize: '17px', marginBottom: '6px' }}>
                Korak 1: Kalibracija
              </h2>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', margin: 0 }}>
                Držite karticu pored obraza, horizontalno
              </p>
            </div>

            <div className="video-container">
              {cameraReady && (
                <div className={`face-status ${faceDetected ? 'detected' : 'not-detected'}`}>
                  {faceDetected ? '✓ Lice' : '✗ Lice'}
                </div>
              )}
              
              <video ref={videoRef} playsInline muted />
              <canvas 
                ref={canvasRef} 
                className="clickable"
                onClick={handleCanvasClick}
                onTouchStart={handleTouch}
              />
              
              <div className="instruction-overlay">
                {cardPoints.length === 0 && '👆 Tapnite LEVU ivicu kartice'}
                {cardPoints.length === 1 && '👆 Tapnite DESNU ivicu kartice'}
              </div>
            </div>

            <button 
              className="btn-secondary" 
              onClick={reset} 
              style={{ width: '100%', marginTop: '12px' }}
            >
              Otkaži
            </button>
          </div>
        )}

        {/* Measurement */}
        {step === 'measure' && (
          <div className="glass-card" style={{ padding: '16px' }}>
            <div style={{ marginBottom: '12px' }}>
              <h2 style={{ fontSize: '17px', marginBottom: '6px' }}>
                Korak 2: Merenje
              </h2>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px', margin: 0 }}>
                Gledajte u kameru, držite glavu mirno
              </p>
            </div>

            <div className="video-container">
              <div className={`face-status ${faceDetected ? 'detected' : 'not-detected'}`}>
                {faceDetected ? '✓ Lice' : '✗ Lice'}
              </div>
              
              {currentPD && (
                <div className="pd-display">
                  {currentPD} mm
                </div>
              )}
              
              <video ref={videoRef} playsInline muted />
              <canvas ref={canvasRef} />
            </div>

            {/* Progress */}
            <div style={{ marginTop: '16px' }}>
              <div style={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                marginBottom: '8px',
                fontSize: '13px' 
              }}>
                <span>Uzorci: {measurements.length}/30</span>
                <span style={{ color: measurements.length >= 10 ? '#00D4AA' : 'rgba(255,255,255,0.5)' }}>
                  {measurements.length >= 10 ? '✓ Spremno za završetak' : 'Prikupljanje...'}
                </span>
              </div>
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${Math.min((measurements.length / 30) * 100, 100)}%` }} 
                />
              </div>
            </div>

            <div style={{ marginTop: '16px', display: 'flex', gap: '10px' }}>
              <button className="btn-secondary" onClick={reset} style={{ flex: 1 }}>
                Ispočetka
              </button>
              <button 
                className="btn-primary" 
                onClick={finalizeMeasurement}
                disabled={measurements.length < 10}
                style={{ flex: 2 }}
              >
                Završi merenje
              </button>
            </div>
          </div>
        )}

        {/* Result */}
        {step === 'result' && (
          <div className="glass-card" style={{ textAlign: 'center' }}>
            <div style={{ 
              width: '72px', 
              height: '72px', 
              background: 'linear-gradient(135deg, #00D4AA 0%, #00A388 100%)',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 20px',
              fontSize: '32px'
            }}>
              ✓
            </div>

            <h2 style={{ fontSize: '18px', marginBottom: '4px' }}>
              Vaša pupilarna distanca
            </h2>
            
            <div className="result-value">
              {finalPD} mm
            </div>

            <div className="info-box" style={{ textAlign: 'left', marginTop: '20px' }}>
              <p style={{ fontWeight: '600', marginBottom: '6px', fontSize: '14px' }}>ℹ️ Napomena</p>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)', margin: 0, lineHeight: '1.6' }}>
                Ovo je približna vrednost. Za dioptriju ±4.00 i veću, preporučujemo profesionalno merenje.
              </p>
            </div>

            <div style={{ 
              marginTop: '16px', 
              padding: '14px',
              background: 'rgba(255,255,255,0.05)',
              borderRadius: '10px',
              fontSize: '13px'
            }}>
              <span style={{ color: 'rgba(255,255,255,0.5)' }}>Normalne vrednosti: </span>
              <strong>Odrasli:</strong> 54-74mm &nbsp;|&nbsp; <strong>Deca:</strong> 43-58mm
            </div>

            {showManualCopy ? (
              <div style={{
                marginTop: '20px',
                background: 'rgba(0, 212, 170, 0.1)',
                border: '1px solid rgba(0, 212, 170, 0.4)',
                borderRadius: '12px',
                padding: '20px',
                textAlign: 'center'
              }}>
                <p style={{ margin: '0 0 8px 0', fontSize: '14px', color: 'rgba(255,255,255,0.7)' }}>
                  Vaš PD broj je:
                </p>
                <div style={{ fontSize: '48px', fontWeight: '700', color: '#00D4AA', margin: '0 0 8px 0' }}>
                  {finalPD}
                </div>
                <p style={{ margin: '0 0 16px 0', fontSize: '13px', color: 'rgba(255,255,255,0.6)', lineHeight: '1.5' }}>
                  Kopirano u clipboard. Zatvorite ovaj tab i unesite vrednost ručno.
                </p>
                <button className="btn-secondary" onClick={() => window.close()} style={{ width: '100%' }}>
                  Zatvori tab
                </button>
              </div>
            ) : (
              <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
                <button className="btn-secondary" onClick={reset} style={{ flex: 1 }}>
                  Ponovi
                </button>
                <button
                  className="btn-primary"
                  onClick={() => returnValue(finalPD)}
                  style={{ flex: 2 }}
                >
                  {source === 'vto'  ? 'Vrati u Optičarku' :
                   source === 'lool' ? 'Sačuvaj i vrati se' :
                                       'Kopiraj vrednost'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <p style={{ 
          textAlign: 'center', 
          marginTop: '24px',
          color: 'rgba(255,255,255,0.3)',
          fontSize: '11px'
        }}>
          🔒 Merenje se vrši lokalno - podaci ne napuštaju vaš uređaj
        </p>
      </div>
    </div>
  );
};

export default PDMeasurement;
