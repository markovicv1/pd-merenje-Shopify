// Glasovno vođenje + titlovi. Tekst svake poruke je ujedno titl (docs/zvucni-signali.md).
// Titl se prikazuje UVEK, i kada je glas isključen.

export const PROMPTS = {
  G01: { file: 'G01_pocetak', text: 'Merenje počinje. Držite telefon u visini očiju, oko pola metra od lica.' },
  G02: { file: 'G02_naocare_sociva', text: 'Skinite naočare i sočiva u boji. Obična providna sočiva možete ostaviti.' },
  G03: { file: 'G03_kartica_celo', text: 'Prislonite karticu ravno na čelo, iznad obrva.' },
  // G03A: dopuna standardnog uputstva (prsti ne smeju da prekriju bočne ivice) — još nije snimljen, samo titl
  G03A: { file: null, text: 'Držite je za gornju ivicu.' },
  G04: { file: 'G04_gledajte_kameru', text: 'Gledajte pravo u kameru.' },
  G05: { file: 'G05_lice_nije_vidljivo', text: 'Ne vidim vaše lice. Postavite lice u okvir.' },
  G06: { file: 'G06_pridjite', text: 'Priđite bliže.' },
  G07: { file: 'G07_odmaknite', text: 'Odmaknite se malo.' },
  G08: { file: 'G08_ispravite_glavu', text: 'Ispravite glavu i gledajte pravo u kameru.' },
  // Asistirani režim (P01–P02 još nisu snimljeni — samo titl)
  P01: { file: null, text: 'Režim uz pomoć druge osobe. Osoba koja meri drži telefon oko pola metra od vašeg lica, zadnjom kamerom prema vama.' },
  P02: { file: null, text: 'Gledajte pravo u kameru na poleđini telefona.' },
  P03: { file: null, text: 'Približite telefon.' },
  P04: { file: null, text: 'Udaljite telefon.' },
  // G09: još nije snimljen — samo titl (file: null)
  G09: { file: null, text: 'Ne vidim karticu. Prislonite je na čelo, iznad obrva, i držite je za gornju ivicu.' },
  // G10: novi tekst — potrebno ponovno snimanje (docs/zvucni-signali.md)
  G10: { file: 'G10_kartica_nagnuta', text: 'Kartica je nagnuta. Prislonite je ravno na čelo, iznad obrva.' },
  G11: { file: 'G11_premalo_svetla', text: 'Premalo je svetla. Okrenite se ka prozoru ili lampi.' },
  G12: { file: 'G12_slika_mutna', text: 'Slika je mutna. Mirujte ili se malo odmaknite.' },
  G13: { file: 'G13_odlicno_mirujte', text: 'Odlično. Mirujte.' },
  G14: { file: 'G14_odbrojavanje_snimljeno', text: 'Tri. Dva. Jedan. Snimljeno!' },
  G18: { file: 'G18_jos_jednom', text: 'Još jedan snimak. Ostanite u istom položaju.' },
  G19: { file: 'G19_poslednji', text: 'Poslednji snimak.' },
  G20: { file: 'G20_snimci_se_razlikuju', text: 'Snimci se razlikuju. Ponovićemo merenje.' },
  G21: { file: 'G21_proverite_oznake', text: 'Proverite oznake na kartici i zenicama, pa potvrdite.' },
  G22: { file: 'G22_rezultat_nemoguc', text: 'Rezultat nije moguć. Proverite oznake i pokušajte ponovo.' },
  G23: { file: 'G23_sociva_u_boji', text: 'Da li nosite sočiva u boji? Ako nosite, skinite ih i ponovite merenje.' },
};

// Poruka za status detekcije (prioritet je već sadržan u samom statusu).
export const STATUS_PROMPT = {
  none: 'G05', far: 'G06', close: 'G07', pose: 'G08', dark: 'G11', good: 'G13',
  'card-missing': 'G09', 'card-high': 'G03', 'card-off-face': 'G03',
};

// Asistirani režim: udaljenost menja osoba koja drži telefon
export const STATUS_PROMPT_ASSISTED = { ...STATUS_PROMPT, far: 'P03', close: 'P04' };

export const REPEAT_GAP_MS = 4000;  // ista poruka se ne ponavlja pre 4 s
export const STATUS_HOLD_MS = 1000; // status mora da traje 1 s pre nego što se izgovori

// Da li poruka sme da krene sada. Poruka višeg prioriteta (odbrojavanje) prekida ostale.
export function shouldPlay({ id, now, lastPlayedAt = {}, busy = false, interrupt = false }) {
  if (busy && !interrupt) return false;
  const last = lastPlayedAt[id];
  return !(last != null && now - last < REPEAT_GAP_MS);
}

// Procena trajanja titla kada se ne pušta zvuk (ili dok se ne zna trajanje snimka).
export const captionMs = (text) => Math.max(2000, text.length * 70);

// Upravljač zvukom: jedan HTMLAudioElement. Prva poruka se pokreće iz klika „Započni merenje",
// čime se zvuk otključava (iOS/autoplay pravila) i element ostaje upotrebljiv.
export function createVoice({ baseUrl, onCaption }) {
  const audio = typeof Audio !== 'undefined' ? new Audio() : null;
  if (audio) audio.preload = 'auto';
  let enabled = true;
  let queue = [];
  let current = null;       // id koji se trenutno pušta/prikazuje
  let captionTimer = null;
  const lastPlayedAt = {};

  const clearCaptionLater = (ms) => {
    clearTimeout(captionTimer);
    captionTimer = setTimeout(() => { current = null; onCaption?.(null); next(); }, ms);
  };

  const start = (id) => {
    const p = PROMPTS[id]; if (!p) return;
    current = id;
    lastPlayedAt[id] = Date.now();
    onCaption?.({ id, text: p.text });
    if (enabled && audio && p.file) {
      audio.src = `${baseUrl}${p.file}.m4a`;
      audio.onended = () => clearCaptionLater(600);
      clearCaptionLater(captionMs(p.text) + 4000); // osigurač ako onended ne stigne
      audio.play().catch(() => clearCaptionLater(captionMs(p.text)));
    } else {
      clearCaptionLater(captionMs(p.text));
    }
  };

  function next() {
    if (current || !queue.length) return;
    start(queue.shift());
  }

  return {
    say(id, { interrupt = false } = {}) {
      if (!shouldPlay({ id, now: Date.now(), lastPlayedAt, busy: !!current || queue.length > 0, interrupt })) return false;
      if (interrupt) this.stop();
      start(id);
      return true;
    },
    enqueue(ids) { queue.push(...ids); next(); },
    stop() {
      queue = [];
      clearTimeout(captionTimer);
      if (audio) { audio.onended = null; audio.pause(); }
      current = null;
      onCaption?.(null);
    },
    get current() { return current; },
    setEnabled(v) { enabled = v; if (!v && audio) audio.pause(); },
  };
}
