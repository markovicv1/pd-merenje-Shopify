import React, { useEffect, useRef, useState } from 'react';

// Prikaz za podešavanje markera. Markeri su u pikselima izvornog snimka;
// `rect` je deo snimka koji se prikazuje (uvećano ili ceo snimak).
const CARD_COLOR = '#FF6B6B';
const PUPIL_COLOR = '#00b8ff';
const LOUPE = 128;      // prečnik lupe (CSS px)
const LOUPE_ZOOM = 3;

const LABELS = {
  card: ['leva ivica kartice', 'desna ivica kartice'],
  pupil: ['leva zenica', 'desna zenica'],
};

// Kartica: vertikalna linija sa zagradom okrenutom ka unutra („[" levo, „]" desno). Zenica: krug.
const MarkerShape = ({ group, index, size = 44 }) => {
  const c = size / 2;
  if (group === 'card') {
    const dir = index === 0 ? 1 : -1;
    return (
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <g stroke={CARD_COLOR} strokeWidth="2" strokeLinecap="round" fill="none">
          <line x1={c} y1={4} x2={c} y2={size - 4} />
          <line x1={c} y1={4} x2={c + dir * 8} y2={4} />
          <line x1={c} y1={size - 4} x2={c + dir * 8} y2={size - 4} />
        </g>
        <circle cx={c} cy={c} r="2" fill={CARD_COLOR} />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <g stroke={PUPIL_COLOR} strokeWidth="2" fill="none">
        <circle cx={c} cy={c} r="11" />
        <line x1={c} y1={c - 17} x2={c} y2={c - 13} /><line x1={c} y1={c + 13} x2={c} y2={c + 17} />
        <line x1={c - 17} y1={c} x2={c - 13} y2={c} /><line x1={c + 13} y1={c} x2={c + 17} y2={c} />
      </g>
      <circle cx={c} cy={c} r="1.6" fill={PUPIL_COLOR} />
    </svg>
  );
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export default function AdjustView({
  snapshotUrl, snapSize, rect, cardMarkers, pupilMarkers, onMove, onInteract, logoUrl, hint,
}) {
  const boxRef = useRef(null);
  const dragRef = useRef(null);
  const [boxW, setBoxW] = useState(0);
  const [drag, setDrag] = useState(null);         // { group, index, px, py } dok traje prevlačenje
  const [selected, setSelected] = useState({ group: 'card', index: 0 });

  useEffect(() => {
    const el = boxRef.current; if (!el) return;
    const update = () => setBoxW(el.clientWidth);
    update();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    ro?.observe(el);
    window.addEventListener('resize', update);
    return () => { ro?.disconnect(); window.removeEventListener('resize', update); };
  }, []);

  const s = boxW && rect.w ? boxW / rect.w : 0;   // CSS px po px izvora
  const toView = (m) => ({ x: (m.x - rect.x) * s, y: (m.y - rect.y) * s });
  const markers = { card: cardMarkers, pupil: pupilMarkers };

  const moveTo = (group, index, pos) => onMove(group, index, {
    x: clamp(pos.x, 0, snapSize.w), y: clamp(pos.y, 0, snapSize.h),
  });

  const onPointerDown = (group, index) => (e) => {
    e.preventDefault(); e.stopPropagation();
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const box = boxRef.current.getBoundingClientRect();
    dragRef.current = { group, index, sx: e.clientX, sy: e.clientY, start: markers[group][index] };
    setSelected({ group, index });
    setDrag({ group, index, px: e.clientX - box.left, py: e.clientY - box.top });
    onInteract?.();
  };
  const onPointerMove = (e) => {
    const d = dragRef.current; if (!d || !s) return;
    e.preventDefault();
    // Relativno prevlačenje: marker se pomera za pomeraj prsta, ne skače pod prst
    moveTo(d.group, d.index, { x: d.start.x + (e.clientX - d.sx) / s, y: d.start.y + (e.clientY - d.sy) / s });
    const box = boxRef.current.getBoundingClientRect();
    setDrag({ group: d.group, index: d.index, px: e.clientX - box.left, py: e.clientY - box.top });
  };
  const onPointerUp = () => { dragRef.current = null; setDrag(null); };

  const nudge = (dx, dy, { group, index } = selected) => {
    const m = markers[group][index];
    moveTo(group, index, { x: m.x + dx, y: m.y + dy });
    onInteract?.();
  };
  const onKeyDown = (group, index) => (e) => {
    const step = e.shiftKey ? 5 : 1;
    const map = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (!map[e.key]) return;
    e.preventDefault();
    setSelected({ group, index });
    nudge(...map[e.key], { group, index });
  };

  // Lupa iznad prsta (ispod ako nema mesta), prikazuje okolinu markera uvećano
  let loupe = null;
  if (drag && s) {
    const m = markers[drag.group][drag.index];
    const z = s * LOUPE_ZOOM;
    const top = drag.py - LOUPE - 48 < 0 ? drag.py + 48 : drag.py - LOUPE - 48;
    loupe = (
      <div aria-hidden="true" style={{
        position: 'absolute', left: clamp(drag.px - LOUPE / 2, 0, Math.max(0, boxW - LOUPE)), top,
        width: LOUPE, height: LOUPE, borderRadius: '50%', overflow: 'hidden', zIndex: 20, pointerEvents: 'none',
        border: '3px solid #fff', boxShadow: '0 4px 16px rgba(0,0,0,0.6)',
        backgroundImage: `url(${snapshotUrl})`, backgroundRepeat: 'no-repeat',
        backgroundSize: `${snapSize.w * z}px ${snapSize.h * z}px`,
        backgroundPosition: `${LOUPE / 2 - m.x * z}px ${LOUPE / 2 - m.y * z}px`,
      }}>
        <div style={{ position: 'absolute', left: LOUPE / 2 - 22, top: LOUPE / 2 - 22 }}>
          <MarkerShape group={drag.group} index={drag.index} />
        </div>
      </div>
    );
  }

  const sel = markers[selected.group][selected.index];
  const nudgeBtn = { width: 44, height: 44, borderRadius: 10, border: '1px solid #4d4d4d', color: '#fff', fontSize: 18 };

  return (
    <>
      <div
        ref={boxRef}
        onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
        style={{ position: 'relative', width: '100%', aspectRatio: '3/4', overflow: 'hidden', touchAction: 'none', background: '#050508' }}
      >
        {s > 0 && (
          <img src={snapshotUrl} alt="" draggable={false} style={{
            position: 'absolute', left: -rect.x * s, top: -rect.y * s,
            width: snapSize.w * s, height: snapSize.h * s, maxWidth: 'none', userSelect: 'none',
          }} />
        )}
        {logoUrl && (
          <img src={logoUrl} alt="" style={{
            position: 'absolute', top: 10, left: 10, zIndex: 5, pointerEvents: 'none',
            width: 90, filter: 'invert(1) drop-shadow(0 1px 4px rgba(0,0,0,0.6))',
          }} />
        )}
        {s > 0 && ['card', 'pupil'].map(group => markers[group].map((m, i) => {
          const v = toView(m);
          const isSel = selected.group === group && selected.index === i;
          return (
            <button
              key={group + i}
              type="button"
              aria-label={`${LABELS[group][i]} — strelice pomeraju marker`}
              onPointerDown={onPointerDown(group, i)}
              onKeyDown={onKeyDown(group, i)}
              onFocus={() => setSelected({ group, index: i })}
              style={{
                position: 'absolute', left: v.x - 22, top: v.y - 22, width: 44, height: 44, padding: 0,
                touchAction: 'none', cursor: 'grab', zIndex: 10, borderRadius: 8,
                outline: isSel ? '1px dashed rgba(255,255,255,0.55)' : 'none',
              }}
            >
              <MarkerShape group={group} index={i} />
            </button>
          );
        }))}
        {loupe}
        {hint}
      </div>

      {/* Fino pomeranje izabranog markera za 1 piksel snimka */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '10px 16px 0' }}>
        <span style={{ fontSize: 12, color: '#8c8c8c', flex: 1 }}>
          Fino: <span style={{ color: selected.group === 'card' ? CARD_COLOR : PUPIL_COLOR }}>{LABELS[selected.group][selected.index]}</span>
        </span>
        <button type="button" aria-label="Pomeri levo" style={nudgeBtn} onClick={() => nudge(-1, 0)} disabled={!sel}>◀</button>
        <button type="button" aria-label="Pomeri gore" style={nudgeBtn} onClick={() => nudge(0, -1)} disabled={!sel}>▲</button>
        <button type="button" aria-label="Pomeri dole" style={nudgeBtn} onClick={() => nudge(0, 1)} disabled={!sel}>▼</button>
        <button type="button" aria-label="Pomeri desno" style={nudgeBtn} onClick={() => nudge(1, 0)} disabled={!sel}>▶</button>
      </div>
    </>
  );
}
