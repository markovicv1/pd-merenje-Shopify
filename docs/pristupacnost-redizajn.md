# PD kalkulator — redizajn za pristupačnost (sprovedeno 2026-09-26)

> Cilj: ne menjati izgled aplikacije, nego ukloniti greške u pristupačnosti.
> Polazna tačka: korisnik tokom snimanja **nema naočare** i slabije vidi; glas može biti isključen,
> pa sve što je važno mora biti jasno **ispisano i vidljivo bez naočara**.
> Analiza: snimci ekrana svih koraka (390 px širine) + merenje kontrasta (WCAG 2.1: tekst ≥ 4,5:1, veliki tekst i ivice ≥ 3:1).

## Ključni uvid

Naočare korisnik skida **samo za snimanje** (uvod → kamera → odbrojavanje). Posle snimka može da ih vrati.
Zato najveću pažnju zaslužuje **ekran kamere**, a posle snimka aplikacija treba da kaže:
„Snimak je gotov. Sada možete ponovo da stavite naočare." (nova poruka **G29**).

## Nađene greške (po prioritetu)

### 1. Ekran kamere — tri različite poruke istovremeno (kritično)
Na ekranu u isto vreme stoje: žuta značka gore („Prislonite karticu uz čelo", 13 px), mala oznaka u dnu slike
(„Kartica na čelu, iznad obrva", 13 px) i titl ispod slike (glasovna poruka iz reda — npr. o naočarima, a ne o
onome što treba sada uraditi). Bez naočara se čita samo najveći tekst, a on često ne opisuje trenutni problem.

**Predlog:** jedna poruka, jedno mesto. Uklanjaju se žuta značka i mala oznaka u slici; ostaje **jedan veliki
titl ispod slike** (≥ 24 px, podebljano, belo na crnom), koji uvek prikazuje **trenutno stanje**
(„Priđite bliže", „Kartica na čelo, iznad obrva", „Mirujte"). Uvodne poruke (G01–G04) prikazuju se samo prvih
nekoliko sekundi, pa ih zamenjuje stanje.

### 2. Stanje se vidi samo kroz sitan tekst i boju tačke
Crvena/plava tačka od 8 px i boja kruga oko zenica nisu vidljivi bez naočara.

**Predlog:** **debeo okvir oko cele slike** (8 px): žut = nešto treba ispraviti, zelen = sve je u redu, mirujte.
Uz boju uvek i znak u titlu (⚠ / ✓), da ne zavisi samo od boje.

### 3. Linije na slici su pretanke
Linije se crtaju u pikselima kamere (1440 px), a slika se prikazuje u ~400 px, pa linija od 3 px na ekranu ima
~1 px; isprekidani oval lica je 50 % providna siva, obris kartice tanka bela isprekidana linija.

**Predlog:** debljina linija računa se prema veličini prikaza — najmanje **3 px na ekranu**; svaka linija dobija
**tamnu ivicu (oreol)** da se vidi i na svetloj i na tamnoj pozadini; krugovi oko zenica veći (prečnik ~ 2 × iris).
Isto važi za obrise u interfejsu oblika lica.

### 4. Titl nestaje prebrzo
Titl nestaje 0,6 s posle kraja zvuka; bez zvuka traje prema dužini teksta, ali ga slabovid korisnik ne stigne
pročitati.

**Predlog:** najmanje **4 s**, ili ~ 12 znakova u sekundi (šta je duže); poruka o stanju ostaje dok stanje traje.

### 5. Kontrast teksta i ivica
| Element | Sada | Kontrast | Predlog |
|---|---|---|---|
| podnožje uvoda (`#66738c`) | tekst 12 px | **3,5 : 1** ✗ | `#aab3c5` (≈ 8 : 1), 14 px |
| „mm" na rezultatu (`#666` na `#222`) | | **2,8 : 1** ✗ | `#bbbbbb` |
| ivice sekundarnih dugmadi (`#4d4d4d`) | | **2,1 : 1** ✗ | `#8a94a8` (≥ 3 : 1) |
| ivice kartica/panela (`#404d66`) | | **1,9 : 1** ✗ | `#6b7894` (≥ 3 : 1) |
| sivi pomoćni tekst (`#8c8c8c`) | | 4,9 : 1 (granično) | `#b3b3b3` |
| cijan tekst, dugmad, žuta/crvena značka | | 5,6 – 8,4 : 1 ✓ | bez promene |

### 6. Sitna slova
Na više mesta tekst je 10–13 px (legenda na ekranu oznaka, „Fino: …", značke, podnožje, oznake u debug-u).

**Predlog:** najmanje **14 px** za bilo koji tekst, **16–18 px** za uputstva.
Podešavanje **„Veći tekst"** danas uvećava samo titl i panel — treba da uveća **ceo interfejs** (~ 125 %).

### 7. Ekran za podešavanje oznaka
Uputstvo („Proverite crvene oznake…") nestaje posle 3 s; oznake su tanke (2 px).

**Predlog:** na vrhu koraka stalno uputstvo (16 px): „Crvene zagrade na levu i desnu ivicu kartice. Plavi krugovi
na centar zenica." Oznake debljine 3 px sa tamnim oreolom. Prvo se prikazuje G29 („možete da stavite naočare").

### 8. Dugmad i dodir
Ikonica pristupačnosti u zaglavlju je ~ 36 px (preporuka ≥ 44 px) i nema natpis.

**Predlog:** 44 × 44 px; na uvodnom ekranu uz ikonicu i reč „Pristupačnost".
Značka „AI Powered" u zaglavlju zauzima mesto na ekranu kamere — predlog: samo na uvodu.

### 9. Ostalo
- Greške (npr. vrednost van opsega) prikazuju se sitnim crvenim tekstom iznad zaglavlja → 16 px, sa ikonicom, uz dugme na koje se odnose.
- Animacije (treptanje oka na uvodu, „disanje" obrisa) isključiti kad je u sistemu uključeno „smanji pokrete" (`prefers-reduced-motion`).
- Pozadina se menja između ekrana (`#171f2e` / `#111`) — ujednačiti.

## Šta se ne menja
Raspored ekrana, boje brenda (cijan akcenat, tamna pozadina), tok merenja, veličina broja rezultata (96 px — dobro),
primarna dugmad (kontrast 8,4 : 1 — dobro), odbrojavanje velikim brojevima.

## Nova poruka za snimanje
| ID | Fajl | Kada | Tekst |
|---|---|---|---|
| G29 | `G29_naocare_nazad` | posle snimka, pre oznaka | Snimak je gotov. Sada možete ponovo da stavite naočare. |
