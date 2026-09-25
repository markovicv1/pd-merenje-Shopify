# Oblik lica v2 — specifikacija (zamenjuje UI deo plana 2026-07-15)

> **Status:** SPECIFIKACIJA, dogovoreno sa Markom 2026-09-25
> **Nasleđuje:** geometrijsku klasifikaciju iz `2026-07-15-face-shape-v1.md` (landmarci, 5 featura, prototipovi, skoring)
> i analizu `docs/face-shape-feasibility.md`. Menja se **interfejs i tok**, ne princip klasifikacije.

## 1. Cilj

Isti app radi PD merenje i prepoznavanje oblika lica, ali kroz **dva odvojena interfejsa**.
Prepoznavanje oblika lica radi samo to i vraća rezultat stranici koja ga je pozvala. Nema uvodne strane.
Sve se radi na uređaju; van uređaja ide samo rezultat (naziv oblika i procenat).

## 2. Poziv

`https://markovicv1.github.io/pd-merenje-Shopify/?app=oblik[&embed=…|&source=…&return=…]`

- `app=oblik` bira interfejs oblika lica (bez parametra ostaje PD kalkulator, bez promene).
- Povratak rezultata koristi postojeću infrastrukturu (`returnTarget.js`, `ALLOWED_ORIGINS`):
  1. **iframe** (`embed=…`): `window.parent.postMessage(poruka, origin)` za svaki dozvoljeni origin;
  2. **otvoren prozor** (`window.opener`): `window.opener.postMessage(poruka, origin)`, pa zatvaranje prozora;
  3. **povratna adresa** (`return=` sa dozvoljenog domena): preusmerenje sa parametrima
     `?oblik=oval&drugi=heart&p=62` (`drugi` i `p` izostaju kad je rezultat jedan oblik);
  4. nijedno od navedenog: rezultat ostaje prikazan na ekranu.
- **Poruka:**
  ```js
  { type: 'opticarka:oblik', oblik: 'oval', drugi: 'heart' | null,
    procenti: { oval: 62, heart: 38 } | { oval: 100 }, verzija: 1 }
  ```
- Ključevi oblika: `oval`, `round`, `oblong`, `square`, `heart`, `triangle`, `diamond`.
  Srpski nazivi (za prikaz): Ovalno, Okruglo, Duguljasto, Četvrtasto, Srcoliko, Trouglasto, Dijamantsko.

## 3. Ekran i tok

Jedan ekran: prikaz prednje kamere (ogledalski), preko lica obris oblika, titl ispod kamere.

1. Kamera se pokreće odmah (dozvola pretraživača je jedini korak pre toga).
2. **Animacija traženja:** obrisi 7 oblika se smenjuju na **0,2 s** (ceo krug 1,4 s), centrirani i skalirani na lice
   (po landmarkima), blago rotiraju/„dišu" kao sadašnji isprekidani oval. Obris je isprekidana linija, boja akcenta `#00b8ff`.
3. **Prikupljanje:** frejm se uzima samo kada je lice frontalno (postojeći `isPoseFrontal`: yaw i pitch u dozvoljenim granicama),
   dovoljno veliko (razmak zenica ≥ 11 % širine kadra) i dovoljno osvetljeno (`MIN_LUMA`).
   Potrebno je **1,5 s dobrih frejmova** (≈ 45 pri 30 fps; ne moraju biti uzastopni). Featuri = **medijana** po frejmovima.
4. **Titlovi** (uvek na ekranu, glas kasnije kad se snimi; ID-jevi O01–O06 u `docs/zvucni-signali.md`):
   - na početku: „Sklonite kosu sa čela i skinite naočare." (O01)
   - lice nije u kadru: „Postavite lice u okvir." (O02)
   - glava nije ravno: „Gledajte pravo u kameru." (O03)
   - predaleko: „Priđite bliže." (O04) · pretamno: „Premalo svetla." (O05)
   - završetak: „Vaš oblik lica: Ovalno." (O06, sa nazivom)
5. **Završetak:** animacija staje na obrisu pobedničkog oblika (puna linija), ispod naziv:
   - „Ovalno" ili „Ovalno 62 % · Srcoliko 38 %".
   Posle **1,2 s** rezultat se vraća pozivaocu (tačka 2). Kamera se gasi odmah posle prikupljanja.
6. Ako se 1,5 s dobrih frejmova ne skupi za **20 s**, prikazuje se „Pokušajte ponovo" (dugme) i saveti iz titla.

## 4. Klasifikacija i pravilo 35 %

- Featuri i skoring kao u planu v1 (`faceShape.js`): 5 bezdimenzionih odnosa → gaussian skor za svaki od 7 prototipova.
- Dva najbolja oblika `s1 ≥ s2`; procenti se računaju **samo između njih**: `p1 = s1/(s1+s2)`, `p2 = s2/(s1+s2)`.
- **Ako je `p2 < 35 %` → prikazuje se i vraća samo preovlađujući oblik** (`drugi: null`, `procenti: { oblik: 100 }`).
  Inače se vraćaju oba, zaokruženo na cele procente (zbir 100).
- Isti format ima i anketa (jedan oblik ili dva sa podelom), pa se model i ocenjivači porede direktno.

## 5. Kalibracija — anketa testera

Umesto optičara, oblik lica ocenjuje nekoliko odabranih testera.

- **Anketa:** statička stranica `…/test/anketa/` (bez logovanja, `noindex`). Za svaku fotografiju tester bira
  jedan oblik ili dva sa podelom 50/50, 60/40 ili 70/30, ili „Ne mogu da procenim".
  Redosled fotografija je nasumičan po testeru; napredak se pamti na uređaju.
  Na kraju tester dobija kod sa odgovorima i šalje ga (Podeli / Kopiraj / mejl) — Marko ih prosleđuje.
- **Fotografije:** frontalne, kosa sklonjena sa čela, bez naočara i **bez kartice** (lični podaci);
  isključivo uz saglasnost osobe na fotografiji. Priprema: isecanje na glavu i vrat, uklanjanje metapodataka (EXIF),
  smanjivanje na 800 px, anonimni ID-jevi (`a01`, `a02`…). Cilj: 30–50 fotografija, 5+ ocenjivača.
- **Featuri fotografija:** stranica za obradu (`…/test/anketa/obrada.html`, v2 zadatak) pokreće MediaPipe na istim
  fotografijama u pretraživaču i daje `featuri.json` — okruženje u kome radim ne može da učita model.
- **Obrada:** prosečna ocena ocenjivača po fotografiji (raspodela na 7 oblika) → pomeranje prototipova i sigmi
  → provera: poklapanje modela sa većinom ocenjivača i sa slaganjem samih ocenjivača (inter-rater), jer je to gornja granica.

## 6. Arhitektura

| Fajl | Uloga |
|---|---|
| `src/lib/faceShape.js` (novo, TDD) | landmark indeksi, featuri, prototipovi, skoring, pravilo 35 % |
| `src/lib/faceShapeOutlines.js` (novo) | obrisi 7 oblika (isti kao u anketi) za animaciju |
| `src/FaceShape.jsx` (novo) | interfejs oblika lica (kamera, animacija, titl, povratak) |
| `src/main.jsx` (izmena) | `?app=oblik` → `FaceShape`, inače `PDMeasurement` |
| `public/anketa/` | anketa (statički HTML, bez zavisnosti) i `foto/manifest.json` |

Deljeno sa PD kalkulatorom: MediaPipe inicijalizacija, `headPose.js`, `captureGate.js`, `returnTarget.js`, titl i glas (`voice.js`).

## 7. Otvoreno

- Fotografije za anketu (saglasnost) — Marko.
- Prototipovi v1 su početna procena; menjaju se tek na podacima iz ankete.
- Stranica za obradu fotografija (featuri) — posle prikupljanja fotografija.
