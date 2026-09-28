// Glasovno vođenje + titlovi. Tekst svake poruke je ujedno titl (docs/zvucni-signali.md).
// Titl se prikazuje UVEK, i kada je glas isključen.

export const PROMPTS = {
  G01: { text: 'Merenje počinje. Držite telefon u visini očiju, oko pola metra od lica.' },
  G02: { text: 'Skinite naočare i sočiva u boji. Obična providna sočiva možete ostaviti.' },
  G03: { text: 'Prislonite karticu ravno na čelo, iznad obrva.' },
  G03A: { text: 'Držite je za gornju ivicu.' },
  G04: { text: 'Gledajte pravo u kameru.' },
  G05: { text: 'Ne vidim vaše lice. Postavite lice u okvir.' },
  G06: { text: 'Priđite bliže.' },
  G07: { text: 'Odmaknite se malo.' },
  G08: { text: 'Ispravite glavu i gledajte pravo u kameru.' },
  G09: { text: 'Ne vidim karticu. Prislonite je na čelo, iznad obrva, i držite je za gornju ivicu.' },
  G10: { text: 'Kartica je nagnuta. Prislonite je ravno na čelo, iznad obrva.' },
  G11: { text: 'Premalo je svetla. Okrenite se ka prozoru ili lampi.' },
  G12: { text: 'Slika je mutna. Mirujte ili se malo odmaknite.' },
  G13: { text: 'Odlično. Mirujte.' },
  G14: { text: 'Tri. Dva. Jedan. Snimljeno!' },
  G18: { text: 'Još jedan snimak. Ostanite u istom položaju.' },
  G19: { text: 'Poslednji snimak.' },
  G20: { text: 'Snimci se razlikuju. Ponovićemo merenje.' },
  G21: { text: 'Proverite oznake na kartici i zenicama, pa potvrdite.' },
  G22: { text: 'Rezultat nije moguć. Proverite oznake i pokušajte ponovo.' },
  G23: { text: 'Da li nosite sočiva u boji? Ako nosite, skinite ih i ponovite merenje.' },
  G24: { text: 'Merenje je završeno.' },
  G25: { text: 'Vaš rezultat je' },
  G26: { text: 'Vrednost je upisana u konfigurator.' },
  G27: { text: 'Vrednost je kopirana.' },
  G28: { text: 'Preporučujemo merenje kod optičara.' },
  G29: { text: 'Snimak je gotov. Sada možete ponovo da stavite naočare.' },
  // Asistirani režim (zadnja kamera)
  P01: { text: 'Režim uz pomoć druge osobe. Osoba koja meri drži telefon oko pola metra od vašeg lica, zadnjom kamerom prema vama.' },
  P02: { text: 'Gledajte pravo u kameru na poleđini telefona.' },
  P03: { text: 'Približite telefon.' },
  P04: { text: 'Udaljite telefon.' },
  P05: { text: 'Držite telefon mirno.' },
  P06: { text: 'Još jedan snimak. Spustite karticu i ponovo je prislonite na čelo.' },
  P07: { text: 'Snimci se razlikuju. Još jedan snimak.' },
  // Brojevi za izgovor rezultata (N40–N80, „i po")
  ...Object.fromEntries(Array.from({ length: 41 }, (_, i) => [`N${40 + i}`, { text: String(40 + i) }])),
  N_IPO: { text: 'i po' },
  // Oblik lica (?app=oblik)
  O01: { text: 'Sklonite kosu sa čela i skinite naočare.' },
  O02: { text: 'Postavite lice u okvir.' },
  O03: { text: 'Gledajte pravo u kameru.' },
  O04: { text: 'Priđite bliže.' },
  O05: { text: 'Odmaknite se malo.' },
  O06: { text: 'Celo lice treba da bude u kadru.' },
  O07: { text: 'Mirujte.' },
  O08: { text: 'Nismo uspeli da prepoznamo oblik lica. Gledajte pravo u kameru, uz dobro svetlo.' },
  O10: { text: 'Vaš oblik lica je' },
  O11: { text: 'sa elementima' },
  O20: { text: 'ovalno' }, O21: { text: 'okruglo' }, O22: { text: 'duguljasto' }, O23: { text: 'četvrtasto' },
  O24: { text: 'srcoliko' }, O25: { text: 'trouglasto' }, O26: { text: 'dijamantsko' },
  O30: { text: 'ovalnog' }, O31: { text: 'okruglog' }, O32: { text: 'duguljastog' }, O33: { text: 'četvrtastog' },
  O34: { text: 'srcolikog' }, O35: { text: 'trouglastog' }, O36: { text: 'dijamantskog' },
};
// Svaka poruka ima snimak public/audio/<ID>.m4a (obrađeno: tišina skraćena, −19 dBFS RMS, AAC 96 kbps mono)
for (const [id, p] of Object.entries(PROMPTS)) p.file = id;

// Izgovor PD vrednosti iz delova: [N62] ili [N62, N_IPO]; null ako je van snimljenog opsega
export function numberPromptIds(v) {
  const whole = Math.floor(v + 1e-9), half = Math.abs(v - whole - 0.5) < 0.01;
  if (!(whole >= 40 && whole <= 80)) return null;
  return half ? [`N${whole}`, 'N_IPO'] : [`N${whole}`];
}

// Oblik lica: [O10, O2x] ili [O10, O2x, O11, O3x]
const SHAPE_ORDER = ['oval', 'round', 'oblong', 'square', 'heart', 'triangle', 'diamond'];
export function shapePromptIds(oblik, drugi) {
  const a = SHAPE_ORDER.indexOf(oblik), b = SHAPE_ORDER.indexOf(drugi);
  if (a < 0) return null;
  return b < 0 ? ['O10', `O2${a}`] : ['O10', `O2${a}`, 'O11', `O3${b}`];
}

// Poruka za status detekcije (prioritet je već sadržan u samom statusu).
export const STATUS_PROMPT = {
  none: 'G05', far: 'G06', close: 'G07', pose: 'G08', dark: 'G11', good: 'G13',
  'card-missing': 'G09', 'card-high': 'G03', 'card-off-face': 'G03', shake: 'G12',
};

// Asistirani režim: udaljenost menja osoba koja drži telefon
export const STATUS_PROMPT_ASSISTED = { ...STATUS_PROMPT, far: 'P03', close: 'P04', shake: 'P05' };

export const REPEAT_GAP_MS = 4000;  // ista poruka se ne ponavlja pre 4 s
export const STATUS_HOLD_MS = 1000; // status mora da traje 1 s pre nego što se izgovori

// Da li poruka sme da krene sada. Poruka višeg prioriteta (odbrojavanje) prekida ostale.
export function shouldPlay({ id, now, lastPlayedAt = {}, busy = false, interrupt = false }) {
  if (busy && !interrupt) return false;
  const last = lastPlayedAt[id];
  return !(last != null && now - last < REPEAT_GAP_MS);
}

// Procena trajanja titla kada se ne pušta zvuk (ili dok se ne zna trajanje snimka).
// Titl mora da se stigne pročitati i bez zvuka (slabiji vid, bez naočara): najmanje 4 s, ~12 znakova u sekundi
export const captionMs = (text) => Math.max(4000, text.length * 83);

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

  // Niz snimaka jedne rečenice (npr. „Vaš rezultat je" + „62" + „i po") sa jednim zajedničkim titlom
  const startSeq = ({ key, ids, text }) => {
    current = key;
    lastPlayedAt[key] = Date.now();
    onCaption?.({ id: key, text });
    if (!(enabled && audio)) { clearCaptionLater(captionMs(text)); return; }
    const t0 = Date.now(); let i = 0;
    clearCaptionLater(captionMs(text) + 2000 * ids.length); // osigurač
    const playNext = () => {
      if (i >= ids.length) { clearCaptionLater(Math.max(600, captionMs(text) - (Date.now() - t0))); return; }
      audio.src = `${baseUrl}${PROMPTS[ids[i++]].file}.m4a`;
      audio.onended = playNext;
      audio.play().catch(() => clearCaptionLater(captionMs(text)));
    };
    playNext();
  };

  const start = (id) => {
    if (typeof id === 'object') return startSeq(id);
    const p = PROMPTS[id]; if (!p) return;
    current = id;
    lastPlayedAt[id] = Date.now();
    onCaption?.({ id, text: p.text });
    if (enabled && audio && p.file) {
      audio.src = `${baseUrl}${p.file}.m4a`;
      audio.onended = () => clearCaptionLater(Math.max(600, captionMs(p.text) - (audio.duration || 0) * 1000));
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
    // Rečenica iz više snimaka, jedan titl; ide u red iza ostalih poruka
    sequence(key, ids, text) { queue.push({ key, ids: ids.filter(id => PROMPTS[id]), text }); next(); },
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
