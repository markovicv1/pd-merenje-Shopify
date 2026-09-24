# PD Kalkulator — Preciznost v2, pristupačnost i redosled razvoja

> **Status:** ODOBRENO (Marko, 2026-09-24) | **Prethodi:** `2026-07-12-pd-preciznost-faza-1-2.md` (završeno i na `main`)
> **Posle ovog plana:** `2026-07-15-face-shape-v1.md` (oblik lica)
> **Prateći dokumenti:** `docs/zvucni-signali.md` (lista za snimanje), `docs/pristupacnost-saveti.md` (sadržaj za ikonicu pristupačnosti)

## Problem

Aplikacija se koristi na telefonima, laptopovima i desktop računarima i daje različite rezultate za istu osobu.
Analiza koda (2026-09-24) pokazuje da razlike potiču iz dva dominantna izvora, i oba zavise od uređaja.

## Budžet greške (proračun, NE merenje — potvrditi Fazom 0)

Pretpostavke: telefon portret 720×960, prednja kamera ~80° dijagonalno, korisnik na ~38 cm;
laptop 640×480 ili 1280×720, kamera ~78° dijagonalno (16:9), korisnik na ~55 cm.

| # | Izvor | Gde | Telefon | Laptop |
|---|---|---|---|---|
| 1 | Ručni markeri kartice na prikazu celog kadra (1 CSS px ≈ 1 mm lica, kartica ~87 CSS px, prst prekriva marker jer `onMove` stavlja centar markera pod prst) | `PDMeasurement.jsx` `onMove`, adjust prikaz | **±2–3 mm** (1σ, slučajno) | ±1,2 mm (miš) |
| 2 | Udaljenost iz MediaPipe matrice: FaceLandmarker pretpostavlja fiksni vertikalni FOV kamere (63°) i prosečno lice. Laptop kamere imaju ~43° vertikalno → MediaPipe procenjuje ~35% manju udaljenost → korekcije paralakse i konvergencije preterane | `headPose.js` `distanceMm` | −0,3 mm (sistemski) | **+1,3 mm čelo / +1,9 mm nos** (sistemski) |
| 3 | Kamera se traži kao `ideal 720×960`; laptop kamere su landscape → verovatno 640×480, posle 3:4 isecanja 360 px širine (~0,9 mm/px), fiksni fokus → mutne ivice | `startCamera` | — | niža rezolucija |
| 4 | Prag udaljenosti u pikselima (`MIN_IRIS_PX`/`MAX_IRIS_PX` su zapravo razmak zenica u px) → fizička udaljenost merenja zavisi od rezolucije i FOV-a | konstante | različiti uslovi | različiti uslovi |
| 5 | Pozicija „vrh nosa": Δ dubine varira među ljudima (~15–30 mm), prag 5% u `classifyCardPosition` može pogrešno klasifikovati (skok ~1,5 mm) | `pdMath.js` | ±0,8 mm | ±0,8 mm |
| 6 | Zenice: MediaPipe iris tačka na umanjenom isečku lica; medijana 25 frejmova smanjuje jitter, ne i bias | detekcija | ~0,5 mm | ~0,5 mm |
| 7 | Nema provere kvaliteta (oštrina, svetlo, kartica u kadru, naočare), jedan snimak | — | grube greške | grube greške |

**Posledica:** ista osoba na laptopu dobija ~1,5–2 mm veći PD nego na telefonu (izvor 2), a na telefonu ponovljena
merenja variraju ±2–3 mm (izvor 1).

Provereno i ODBAČENO kao uzrok: prikaz fotografije u adjust koraku je tačno 3:4 i markeri se poklapaju sa slikom
na svim testiranim ekranima (375×667 … 1920×1080, Chromium).

---

## Faza 0 — Merenje trenutnog stanja (prvo!)

Bez podataka ne znamo stvarni udeo svakog izvora po uređaju.

1. **Debug režim `?debug=1`** — overlay u detekciji + izveštaj na rezultatu:
   stvarna rezolucija kamere (`track.getSettings()`), naziv kamere, GPU/CPU delegat, fps, razmak zenica u px i % širine kadra,
   yaw/pitch, udaljenost po MediaPipe-u, širina kartice u px izvora, mm/px, pozicija kartice, sirovi PD, faktori korekcija,
   finalni PD, prečnik šarenice u mm (preko skale kartice), koliko je korisnik pomerio markere zenica.
   Izvoz: „Preuzmi JSON" / „Kopiraj JSON". Kada debug nije uključen — nula promena ponašanja.
   **Status: implementirano** (`src/lib/debugReport.js`, overlay i panel u `PDMeasurement.jsx`).
   Upotreba: dodati `?debug=1` na adresu kalkulatora (za fantom `?debug=1&fantom=1`); overlay je u uglu kamere,
   izveštaj se pojavljuje ispod dugmadi posle „Izračunaj PD". Izveštaj ne sadrži sliku ni identifikator kamere.
2. **Fantom za testiranje** — odštampano lice u prirodnoj veličini, PD izmeren šublerom, kartica na podlošci 10 mm.
   Isti „pacijent" na svim uređajima. `?debug=1&fantom=1` isključuje korekciju konvergencije (odštampane oči ne konvergiraju).
3. **Matrica uređaja** — 2× iPhone, 3× Android (različiti proizvođači, uključujući jeftin model), 2–3 laptopa (Win/Mac), 1 eksterna kamera.
4. **Telemetrija (opciono)** — anonimna, bez slika. Stranica obećava „svi podaci ostaju na vašem uređaju":
   telemetrija samo uz pristanak ili uz izmenu teksta. Odluka: Marko.

## Faza A — Brza poboljšanja postojećeg toka

> **Status (2026-09-24): implementirano na grani `claude/happy-mendel-t00n04`**, osim tačke 8 (vidi dole).
> - 1–3, 9: `src/components/AdjustView.jsx` + `src/lib/adjustGeometry.js` — uvećani prikaz (≈2,8 × razmak zenica,
>   kartica ~2× šira na ekranu), lupa 3×, relativno prevlačenje, dugmad za pomeranje po 1 px snimka, tastatura,
>   oblici `[ ]` / krug; markeri i proračun u pikselima snimka (ne zavise od ekrana); početni položaj markera kartice
>   procenjen iz zenica.
> - 4: kamera traži 1080×1440.
> - 5: uputstvo samo za čelo. Automatska klasifikacija čelo/nos je ZADRŽANA kao zaštita za korisnike koji ipak stave karticu na nos.
> - 6: `src/lib/captureGate.js` — prag udaljenosti kao udeo širine kadra (11–20%).
> - 7: provera svetla (srednja luminansa oblasti očiju i čela < 55 → „Premalo svetla"). Oštrina se za sada samo meri
>   i beleži u debug izveštaju; prag se uvodi kad se prikupe podaci sa više uređaja.
> - **8 (tri snimka) prebačeno u Fazu B:** dok se kartica označava ručno, tri snimka znače tri puta označavanje.
>   Sa automatskom detekcijom kartice (B1) tri snimka ne koštaju korisnika ništa.
> - Pristupačnost: glasovno vođenje (G01–G08, G11, G13, G14, G21, G22) sa titlom za svaku poruku, efekti u kodu,
>   vibracija, ikonica i panel pristupačnosti sa podešavanjima (pamte se na uređaju).

1. **Zumirani adjust prikaz** — iseći prikaz na oblast čela i očiju (širina ≈ 1,8× kartica) → kartica ~55% širine umesto ~22% (≈2,5× preciznije).
2. **Lupa + relativno prevlačenje + fino pomeranje** — marker se pomera za pomeraj prsta (ne skače pod prst), lupa 3× iznad prsta,
   dugmad/strelice za pomeranje po 1 px izvora. Na desktopu markeri fokusabilni i pomerljivi tastaturom (WCAG 2.1.1).
3. **Oblik markera, ne samo boja** — kartica: uglaste zagrade; zenice: krug (daltonizam).
4. **Maksimalna rezolucija kamere** — telefon ~1080×1440, laptop ~1920×1080; detekcija na umanjenom frejmu, snimak u punoj.
   `ImageCapture.takePhoto()` gde postoji (Chrome Android).
5. **Samo čelo** — ukloniti „vrh nosa" iz uputstva i klasifikacije; `CARD_DEPTH_OFFSET_MM` = samo čelo.
6. **Fizička ciljna udaljenost** — prag normalizovan na širinu kadra, uzak opseg (npr. 40–50 cm) isti za sve uređaje.
7. **Provere pre snimka** — oštrina (varijansa Laplasijana u oblasti čela), osvetljenje; uputstvo „Skinite naočare i sočiva u boji.
   Obična providna sočiva možete ostaviti."
8. **Tri snimka** — rezultat = medijana; razlika > 1 mm → ponavljanje.
9. **`touchAction: 'none'`** na fotografiji blokira pinch-zoom iako uputstvo kaže „koristite dva prsta za zoom" — rešava se tačkama 1–2,
   pa tekst uputstva uskladiti.

## Faza B — Automatizacija (najveći dobitak)

> **Status (2026-09-24): B1 i B4 implementirani** na grani `claude/happy-mendel-t00n04`.
> - B1 `src/lib/cardDetect.js`: traži se ceo pravougaonik kartice (4 ivice) u ispravljenoj traci iznad očiju;
>   ivice se doteruju ispod piksela i kroz redove se provlači prava. Na 4 stvarna snimka (EMEET C960, sa
>   ucrtanim oznakama koje su morale da se maskiraju): 2 tačna na 0,4–0,5% od ručnih oznaka (pouzdanost
>   0,67–0,79), 2 pogrešna (pouzdanost 0,51–0,56) → prag 0,6; ispod praga markeri ostaju na proceni iz zenica.
>   Za veći test skup: debug dugme „Snimak bez oznaka".
> - B4 `src/lib/cardDistance.js`: udaljenost = f·85,6/širina kartice; FOV po klasi uređaja (telefon portret 70°,
>   telefon landscape 55°, desktop 45°), `?vfov=` za kalibraciju. MediaPipe udaljenost ostaje samo kao rezerva
>   i u debug izveštaju.
> - Nalaz validacije (1 osoba, pupilometar 60 mm za daljinu): dva testa sa lenjirom na istom snimku potvrđuju
>   skalu kartice na 0,2–0,6%, a razmak centara šarenica u ravni lenjira je 62,7–63,5 mm. Razlika u odnosu na
>   pupilometar (refleks rožnjače) je veća od očekivane razlike metoda (ugao kapa, ~1–2 mm) — proveriti na više
>   osoba; ako je sistemska, kalibrisati konstantu. Ideja za B2: beli ekran kao izvor svetla i merenje refleksa
>   na rožnjači, kao pupilometar.

1. **Automatska detekcija ivica kartice** — ROI iz landmarka čela; dve paralelne vertikalne ivice (gradijent + fit prave, subpikselno);
   provera odnosa stranica 85,6 × 53,98 (otkriva nagnutu karticu). Korisnik samo potvrđuje; ručno ostaje kao rezerva.
   (Nije ručno 4-corner markiranje koje je ranije odbijeno — korisnik nema dodatnog posla.)
2. **Precizan centar zenica na punoj rezoluciji** — primarno tamni disk zenice kad je jasno vidljiv; rezerva: sredina leve i desne
   ivice šarenice (limbusa). Traženje ivice samo neposredno oko šarenice (ivica mekog sočiva je na beonjači).
3. **Rafal 5–10 frejmova pune rezolucije**, detekcija na svakom, medijana.
4. **Udaljenost iz kartice** — `d = f · 85,6 / širina_kartice_px`, `f` iz FOV priora po klasi uređaja (kasnije: tabela iz telemetrije/EXIF-a).
   Uklanja pretpostavku o prosečnom licu i veći deo razlike laptop/telefon.
5. **Kontrola šarenicom** — prečnik šarenice u mm mora biti 10,5–13 mm; ako je veći od ~13 mm prvo pitati
   „Da li nosite sočiva u boji?", tek onda sumnjati na oznake kartice.

## Faza C — Veće promene procedure

1. **Režim uz pomoć druge osobe (PREPORUKA za određene grupe, ne samo opcija)** — zadnja kamera, ~1 m, zum 2–3×.
   Korekcije padaju sa ~5% na ~2%, greška udaljenosti skoro ne utiče; zadnje kamere imaju autofokus i veću rezoluciju
   (kod jeftinih telefona razlika u odnosu na prednju kameru je najveća).
   Aplikacija ga nudi kada: prednja kamera < 720p ili spora detekcija; tri snimka se ne slažu / korisnik ne može da miruje (tremor);
   korisnik izabere „Teško mi je da sam držim telefon i karticu"; korisnik bez naočara ne vidi ekran.
   Proveriti: izbor telefoto kamere u iOS Safari / Chrome Android.
2. **Nativna fotografija (`<input type="file" capture>`)** — 12 MP + EXIF žižna daljina → tačna udaljenost. Bez vođenja uživo;
   proveriti da li iOS zadržava EXIF FocalLength.
3. **iPhone TrueDepth (App Clip, ARKit)** — metrička geometrija, bez kartice. Samo ako A+B ne dostignu cilj.

## Kontaktna sočiva i očna stanja

| Stanje | Uticaj | Postupanje |
|---|---|---|
| Providna meka sočiva | zanemarljiv (< 0,1 mm); bolje od naočara | dozvoliti, čak preporučiti onima koji bez naočara ne vide ekran |
| Tvrda (RGP) sočiva | ivica preko šarenice, pomeraju se pri treptaju | medijana rafala (B3) |
| Sočiva u boji | kamera vidi odštampanu šarenicu → centar sočiva, ne oka (okvirno 0,5 mm, do 1 mm); „big eye" 13–14,5 mm; slabo svetlo krije zenicu | skinuti; B2 primarno na zenicu; B5 pitanje |
| Neprozirna efektna sočiva | merenje nemoguće | skinuti |
| Naočare | odsjaji, ram smeta kartici i detekciji | skinuti |
| Razrokost, ambliopija sa skretanjem | jedno oko ne fiksira kameru → binokularni PD netačan | optičar (monokularno merenje sa pokrivanjem oka) |
| Nistagmus | pokretne zenice | rafal delimično pomaže; preporuka optičar |
| Ptoza | kapak krije deo zenice | bočne ivice šarenice (B2) |
| Nepravilna zenica, stanje posle operacije/povrede šarenice | centar zenice ≠ centar šarenice | optičar |
| Progresivna/multifokalna stakla, prizme u receptu, visoke dioptrije | potrebni monokularni PD i visina centriranja | optičar |

## Pristupačnost

1. **Glasovno vođenje + titl za svaku komandu** — svaki glasovni signal ima identičan tekst na ekranu (titl), prikazan uvek,
   i kada je zvuk isključen ili utišan (iPhone prekidač tišine može utišati zvuk stranice). Lista: `docs/zvucni-signali.md`.
   - titl: ≥ 20 px, kontrast ≥ 4.5:1, `aria-live`, ne preko lica, ostaje najmanje trajanje signala + 1 s
   - odbrojavanje: glas („Tri, dva, jedan") ili pisak — uvek i vizuelno
   - vibracija pri odbrojavanju i snimku (Android; iOS Safari ne podržava)
   - zvuk se otključava klikom na „Započni merenje" (autoplay pravila browsera)
2. **Ikonica pristupačnosti** — univerzalni simbol pristupačnosti (figura u krugu, ne invalidska kolica jer pokriva vid, sluh i motoriku)
   u zaglavlju i na uvodnom ekranu; otvara panel sa podešavanjima (glasovno vođenje, zvučni signali, vibracija, veći tekst)
   i savetima iz `docs/pristupacnost-saveti.md`.
3. **Bez vremenskog ograničenja** u koraku podešavanja; jednostavan jezik, jedan korak po ekranu.

## Validacija

Proširenje protokola iz plana 2026-07-12: matrica uređaja (Faza 0.3) × 10–15 osoba × 2 ponavljanja, referenca pupilometar.
Analiza: sistemska greška po klasi uređaja i Bland-Altman.
**Cilj:** sistemska greška po klasi uređaja < 0,5 mm; 95% merenja unutar ±1,5 mm od pupilometra.
Napomena: pupilometar meri refleks rožnjače, kamera centar zenice/šarenice — mali sistemski pomak se apsorbuje kalibracijom.

## Redosled

0. Faza 0 (debug + fantom) → izmeriti stanje po uređajima
1. Faza A + glasovno vođenje/titlovi + ikonica pristupačnosti → ponoviti merenje
2. Faza B → validacija pupilometrom
3. C1 (režim uz pomoć druge osobe) → validacija
4. Oblik lica (`2026-07-15-face-shape-v1.md`) — koristi višu rezoluciju, landmarke na punoj rezoluciji i pose gating iz ovog plana

## Pravila za izvršioca

- **NE push-ovati na `main`** — auto-deploy na GitHub Pages (produkcija, embedovano na opticarka.com). Merge samo uz Markovu potvrdu.
- Čiste funkcije u `src/lib/` uz Vitest testove (TDD).
- Konstante (FOV priori, pragovi, `CARD_DEPTH_OFFSET_MM`) su početne vrednosti — menjaju se samo na osnovu podataka iz Faze 0 / validacije,
  sa podacima u commit poruci.
