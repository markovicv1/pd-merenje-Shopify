import React, { useEffect, useRef } from 'react';

// Univerzalni simbol pristupačnosti (figura raširenih ruku u krugu).
export const IcoAccessibility = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="12" cy="12" r="11" stroke="currentColor" strokeWidth="1.6" />
    <circle cx="12" cy="6.6" r="1.6" fill="currentColor" />
    <path d="M6.5 9.3c1.9.5 3.7.7 5.5.7s3.6-.2 5.5-.7M12 10v3.6m0 0-2.4 5m2.4-5 2.4 5"
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// Titl: isti tekst kao glasovna poruka, prikazuje se uvek (i bez zvuka).
export const Caption = ({ caption, large }) => (
  <div aria-live="polite" role="status" style={{
    minHeight: large ? 64 : 52, display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: '8px 12px', textAlign: 'center',
  }}>
    {caption && (
      <span style={{
        background: 'rgba(0,0,0,0.85)', color: '#fff', borderRadius: 10, padding: '8px 14px',
        fontSize: large ? 26 : 20, fontWeight: 600, lineHeight: 1.3,
      }}>{caption.text}</span>
    )}
  </div>
);

const Toggle = ({ label, checked, onChange }) => (
  <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 0', cursor: 'pointer' }}>
    <span>{label}</span>
    <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
      style={{ width: 22, height: 22, accentColor: '#00b8ff' }} />
  </label>
);

const H = ({ children }) => <h3 style={{ fontSize: 16, fontWeight: 700, margin: '20px 0 6px', color: '#fff' }}>{children}</h3>;
const Ul = ({ items }) => (
  <ul style={{ paddingLeft: 20, listStyle: 'disc', display: 'flex', flexDirection: 'column', gap: 4 }}>
    {items.map((t, i) => <li key={i}>{t}</li>)}
  </ul>
);

// Panel „Pristupačnost": podešavanja + saveti (docs/pristupacnost-saveti.md).
export function AccessibilityPanel({ open, onClose, settings, onChange, canVibrate }) {
  const closeRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  const set = (k) => (v) => onChange({ ...settings, [k]: v });
  const fs = settings.largeText ? 18 : 15;

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="a11y-title" onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto', background: '#121724',
        border: '1px solid #404d66', borderRadius: '20px 20px 0 0', padding: '20px 20px 32px',
        color: '#d9d9d9', fontSize: fs, lineHeight: 1.5,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 id="a11y-title" style={{ fontSize: 20, fontWeight: 700, color: '#fff', display: 'flex', alignItems: 'center', gap: 8 }}>
            <IcoAccessibility size={22} /> Pristupačnost
          </h2>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Zatvori"
            style={{ fontSize: 22, padding: '4px 10px', color: '#fff' }}>✕</button>
        </div>

        <H>Podešavanja</H>
        <Toggle label="Glasovno vođenje" checked={settings.voice} onChange={set('voice')} />
        <Toggle label="Zvučni signali" checked={settings.sounds} onChange={set('sounds')} />
        <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 0' }}>
          <span>Odbrojavanje</span>
          <select value={settings.countdown} onChange={e => set('countdown')(e.target.value)}
            style={{ background: '#1f293d', color: '#fff', border: '1px solid #404d66', borderRadius: 8, padding: '6px 10px', fontSize: fs }}>
            <option value="voice">glasom</option>
            <option value="beep">piskom</option>
          </select>
        </label>
        {canVibrate && <Toggle label="Vibracija" checked={settings.vibration} onChange={set('vibration')} />}
        <Toggle label="Veći tekst" checked={settings.largeText} onChange={set('largeText')} />
        <p style={{ fontSize: 13, color: '#8c8c8c' }}>Sva uputstva su uvek i ispisana na ekranu, bez obzira na podešavanje zvuka.</p>

        <H>Ako slabije vidite</H>
        <Ul items={[
          'Uključite glasovno vođenje — aplikacija će vam govoriti šta da uradite.',
          'Ako bez naočara ne vidite ekran dovoljno jasno, stavite obična providna kontaktna sočiva — ona ne smetaju merenju.',
          'Uključite veći tekst.',
          'Najlakše je uz pomoć druge osobe: ona drži telefon, a vi samo gledate u kameru.',
        ]} />

        <H>Ako slabije čujete</H>
        <Ul items={[
          'Svako glasovno uputstvo je ispisano na ekranu.',
          'Odbrojavanje je uvek prikazano velikim brojevima.',
          ...(canVibrate ? ['Možete uključiti vibraciju pri odbrojavanju i snimanju.'] : []),
        ]} />

        <H>Ako vam je teško da držite telefon i karticu</H>
        <Ul items={[
          'Zalepite karticu selotejpom na čelo, iznad obrva — ruke su slobodne, a kartica stoji ravno.',
          'Naslonite telefon na nešto stabilno (knjige, stalak) u visini očiju.',
          'Zamolite drugu osobu da drži telefon.',
          'Za podešavanje oznaka nema vremenskog ograničenja. Na računaru oznake možete pomerati i strelicama na tastaturi.',
        ]} />

        <H>Ako ne razlikujete boje</H>
        <p>Oznake se razlikuju i oblikom: ivice kartice su označene uglastim zagradama, a zenice krugom.</p>

        <H>Očna stanja kod kojih merenje kamerom nije pouzdano</H>
        <p>Kod sledećih stanja preporučujemo merenje kod optičara:</p>
        <Ul items={[
          'razrokost (strabizam) ili „lenjo oko" koje skreće — oči ne gledaju u istu tačku, pa zajednička PD vrednost nije tačna; optičar meri svako oko posebno',
          'nistagmus (nevoljno podrhtavanje očiju)',
          'nepravilan oblik zenice, stanje posle operacije ili povrede šarenice',
          'očna proteza ili vid na samo jedno oko — tada je važna PD vrednost za svako oko posebno',
        ]} />

        <H>Kada vam je potreban optičar i uz tačno merenje</H>
        <p>Za sledeća stakla nije dovoljna samo PD vrednost, već i mere koje se uzimaju uz ram na licu:</p>
        <Ul items={['progresivna (multifokalna) stakla', 'prizme u receptu', 'visoke dioptrije']} />

        <H>Pre merenja</H>
        <Ul items={[
          'Kartica (kreditna, lična karta ili zdravstvena) na čelu, iznad obrva. Držite je za gornju ivicu, da prsti ne prekriju bočne ivice.',
          'Skinite naočare — odsjaji i ram ometaju merenje.',
          'Skinite sočiva u boji — kamera tada vidi odštampanu šaru, a ne vaše oko.',
          'Obična providna sočiva možete ostaviti.',
          'Merite pri dobrom svetlu, okrenuti ka prozoru ili lampi.',
        ]} />
      </div>
    </div>
  );
}
