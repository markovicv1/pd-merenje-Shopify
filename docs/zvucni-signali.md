# PD Kalkulator — lista zvučnih signala za snimanje

> **Namena:** lista za snimanje glasovnih poruka (spiker/studio) i specifikacija zvučnih efekata.
> **Pravilo:** tekst svake glasovne poruke se na ekranu prikazuje **doslovno isti** kao titl — i kada je zvuk isključen.
> Tekstovi su predlog; ako se izmeni izgovoreni tekst, menja se i titl (kolona „Tekst" je jedini izvor za oba).

## Tehnička specifikacija snimaka

| Stavka | Vrednost |
|---|---|
| Master | WAV, 48 kHz, 24-bit, mono |
| Isporuka za web | MP3, 44,1 kHz, mono, 128 kbps (radi u svim browserima) |
| Glasnoća | −16 LUFS integrisano, true peak ≤ −1 dBTP, isto za sve fajlove |
| Tišina | ≤ 100 ms na početku, ≤ 200 ms na kraju |
| Trajanje | poruke za vođenje (G05–G13) ≤ 2,5 s; ostale ≤ 5 s |
| Glas | jedan spiker za sve poruke; smiren, jasan, umeren tempo; bez muzike i efekata |
| Jezik | srpski, ekavica, obraćanje sa „Vi" (kao u postojećem interfejsu) |
| Takeovi | po 2 snimka svake poruke, odabir u montaži |
| Naziv fajla | `ID_naziv.mp3`, npr. `G06_pridjite.mp3` (ID iz tabele, bez razmaka i dijakritika) |

## 1. Priprema (uvod)

| ID | Fajl | Kada se pušta | Tekst (glas = titl) |
|---|---|---|---|
| G01 | `G01_pocetak` | klik na „Započni merenje" | Merenje počinje. Držite telefon u visini očiju, oko pola metra od lica. |
| G02 | `G02_naocare_sociva` | posle G01 | Skinite naočare i sočiva u boji. Obična providna sočiva možete ostaviti. |
| G03 | `G03_kartica_celo` | posle G02 | Prislonite karticu ravno na čelo, iznad obrva. |
| G03A | `G03A_gornja_ivica` | posle G03 | Držite je za gornju ivicu. **(novo 2026-09-25 — snimiti; zasad samo titl)** |
| G04 | `G04_gledajte_kameru` | posle G03 | Gledajte pravo u kameru. |

## 2. Vođenje tokom detekcije

Puštaju se kada stanje traje ≥ 1 s; ista poruka se ne ponavlja pre 4 s. Prioritet: G05 → G06/G07 → G08 → G09/G10 → G11/G12 → G13.

| ID | Fajl | Kada se pušta | Tekst (glas = titl) |
|---|---|---|---|
| G05 | `G05_lice_nije_vidljivo` | lice nije detektovano | Ne vidim vaše lice. Postavite lice u okvir. |
| G06 | `G06_pridjite` | predaleko | Priđite bliže. |
| G07 | `G07_odmaknite` | preblizu | Odmaknite se malo. |
| G08 | `G08_ispravite_glavu` | glava nije frontalno | Ispravite glavu i gledajte pravo u kameru. |
| G09 | `G09_kartica_nije_vidljiva` | kartica nije detektovana (Faza B) | Ne vidim karticu. Prislonite je na čelo, iznad obrva, i držite je za gornju ivicu. |
| G10 | `G10_kartica_nagnuta` | kartica nagnuta (Faza B) | Kartica je nagnuta. Prislonite je ravno na čelo, iznad obrva. **(novi tekst — snimiti ponovo)** |
| G11 | `G11_premalo_svetla` | slika pretamna | Premalo je svetla. Okrenite se ka prozoru ili lampi. |
| G12 | `G12_slika_mutna` | slika mutna | Slika je mutna. Mirujte ili se malo odmaknite. |
| G13 | `G13_odlicno_mirujte` | sve u redu, počinje odbrojavanje | Odlično. Mirujte. |

## 3. Odbrojavanje i snimanje

Odbrojavanje se ne prekida drugim porukama. Korisnik bira glas ili pisak (Z01 + Z02); broj je uvek i na ekranu.
**Snimljeno kao jedan fajl** (G14–G17 spojeni): `G14_odbrojavanje_snimljeno` — „Tri. Dva. Jedan. Snimljeno!".
Titl prati reči po vremenu u snimku. Početak reči u snimku (izmereno): ~0,2 s, ~1,9 s, ~3,2 s — pri povezivanju
uskladiti odbrojavanje na ekranu sa snimkom (ili snimiti ponovo u ritmu tačno 1 s po reči).

| ID | Fajl | Kada se pušta | Tekst (glas = titl) |
|---|---|---|---|
| G14 | `G14_odbrojavanje_snimljeno` | odbrojavanje + snimak | Tri. Dva. Jedan. Snimljeno! |
| G18 | `G18_jos_jednom` | pre 2. snimka | Još jedan snimak. Ostanite u istom položaju. |
| G19 | `G19_poslednji` | pre 3. snimka | Poslednji snimak. |
| G20 | `G20_snimci_se_razlikuju` | snimci se razlikuju > 1 mm | Snimci se razlikuju. Ponovićemo merenje. |

## 4. Provera oznaka

| ID | Fajl | Kada se pušta | Tekst (glas = titl) |
|---|---|---|---|
| G21 | `G21_proverite_oznake` | ulazak u korak provere | Proverite oznake na kartici i zenicama, pa potvrdite. |
| G22 | `G22_rezultat_nemoguc` | vrednost van opsega | Rezultat nije moguć. Proverite oznake i pokušajte ponovo. |
| G23 | `G23_sociva_u_boji` | šarenica prevelika (Faza B) | Da li nosite sočiva u boji? Ako nosite, skinite ih i ponovite merenje. |

## 5. Rezultat

| ID | Fajl | Kada se pušta | Tekst (glas = titl) |
|---|---|---|---|
| G24 | `G24_zavrseno` | prikaz rezultata | Merenje je završeno. |
| G25 | `G25_vas_rezultat_je` | posle G24, pa broj (N40–N80) i opciono N_IPO | Vaš rezultat je |
| G26 | `G26_upisano` | vrednost poslata u konfigurator | Vrednost je upisana u konfigurator. |
| G27 | `G27_kopirano` | vrednost kopirana | Vrednost je kopirana. |
| G28 | `G28_preporuka_opticar` | merenje više puta neuspešno | Preporučujemo merenje kod optičara. |

### Brojevi za izgovor rezultata (za slepe i slabovide)

Rezultat se sklapa od tri dela: G25 + broj + opciono „i po". Primer: 63,5 mm → „Vaš rezultat je" + „šezdeset tri" + „i po".
Jedinica se ne izgovara (izbegava se promena „milimetar/milimetra/milimetara"); na ekranu piše „mm".

| ID | Fajl | Tekst |
|---|---|---|
| N40 … N80 | `N40` … `N80` | četrdeset, četrdeset jedan, … , osamdeset (41 snimak; izgovor „šezdeset tri", ne „šezdeset i tri") |
| N_IPO | `N_IPO` | i po |

## 6. Režim uz pomoć druge osobe

Telefon drži druga osoba, zadnjom kamerom ka osobi koja se meri, na oko 1 m. Glas je za osobu koja se meri,
titl za oboje. Ostale poruke (G05–G28) se koriste i u ovom režimu.

| ID | Fajl | Kada se pušta | Tekst (glas = titl) |
|---|---|---|---|
| P01 | `P01_pomocnik_uvod` | početak režima | Režim uz pomoć druge osobe. Osoba koja meri drži telefon oko pola metra od vašeg lica, zadnjom kamerom prema vama. **(u upotrebi od 2026-09-25 — zasad samo titl)** |
| P02 | `P02_gledajte_objektiv` | posle P01 i pri skretanju pogleda | Gledajte pravo u kameru na poleđini telefona. |
| P03 | `P03_priblizite` | predaleko | Približite telefon. |
| P04 | `P04_udaljite` | preblizu | Udaljite telefon. |
| P05 | `P05_drzite_mirno` | telefon se trese | Držite telefon mirno. |
| P06 | `P06_jos_jedan_snimak` | posle 1. snimka (zadnja kamera) | Još jedan snimak. Spustite karticu i ponovo je prislonite na čelo. **(novo — zasad samo titl)** |
| P07 | `P07_snimci_se_razlikuju` | dva snimka se razlikuju > 2 mm | Snimci se razlikuju. Još jedan snimak. **(novo — zasad samo titl)** |

## 6a. Oblik lica (`?app=oblik`)

Poseban interfejs, bez uvoda. Titlovi već postoje u aplikaciji (`src/FaceShape.jsx`); glas se dodaje kad se snimi.
Rezultat se sklapa iz delova: O10 + naziv oblika, a za dvojni rezultat O10 + oblik + O11 + oblik
(npr. „Vaš oblik lica je ovalno, sa elementima dijamantskog."). Procenti se samo ispisuju, ne izgovaraju.

| ID | Fajl | Kada se pušta | Tekst (glas = titl) |
|---|---|---|---|
| O01 | `O01_kosa_naocare` | pokretanje kamere | Sklonite kosu sa čela i skinite naočare. |
| O02 | `O02_lice_u_okvir` | lice nije detektovano | Postavite lice u okvir. |
| O03 | `O03_gledajte_pravo` | glava nije frontalno | Gledajte pravo u kameru. |
| O04 | `O04_pridjite` | predaleko | Priđite bliže. |
| O05 | `O05_odmaknite` | preblizu | Odmaknite se malo. |
| O06 | `O06_celo_lice` | deo lica van kadra | Celo lice treba da bude u kadru. |
| O07 | `O07_mirujte` | prikupljanje (1,5 s) | Mirujte. |
| O08 | `O08_nije_uspelo` | posle 20 s bez rezultata | Nismo uspeli da prepoznamo oblik lica. Gledajte pravo u kameru, uz dobro svetlo. |
| O10 | `O10_vas_oblik_je` | rezultat (početak rečenice) | Vaš oblik lica je |
| O11 | `O11_sa_elementima` | dvojni rezultat, između oblika | sa elementima |
| O20 | `O20_ovalno` | naziv oblika | ovalno |
| O21 | `O21_okruglo` | naziv oblika | okruglo |
| O22 | `O22_duguljasto` | naziv oblika | duguljasto |
| O23 | `O23_cetvrtasto` | naziv oblika | četvrtasto |
| O24 | `O24_srcoliko` | naziv oblika | srcoliko |
| O25 | `O25_trouglasto` | naziv oblika | trouglasto |
| O26 | `O26_dijamantsko` | naziv oblika | dijamantsko |
| O30 | `O30_ovalnog` | drugi oblik (genitiv) | ovalnog |
| O31 | `O31_okruglog` | drugi oblik | okruglog |
| O32 | `O32_duguljastog` | drugi oblik | duguljastog |
| O33 | `O33_cetvrtastog` | drugi oblik | četvrtastog |
| O34 | `O34_srcolikog` | drugi oblik | srcolikog |
| O35 | `O35_trouglastog` | drugi oblik | trouglastog |
| O36 | `O36_dijamantskog` | drugi oblik | dijamantskog |

Napomena: O04/O05 imaju isti tekst kao G06/G07 — mogu se preuzeti isti snimci.

## 7. Zvučni efekti (bez govora)

**Odluka: generišu se u kodu (Web Audio), bez fajlova** — nula preuzimanja, isti zvuk na svim uređajima.
Koriste se kada korisnik izabere pisak umesto glasa, i za uspeh/grešku.

| ID | Fajl | Kada | Opis |
|---|---|---|---|
| Z01 | (kod) | svaka sekunda odbrojavanja | sinus 1000 Hz, 90 ms, napad 5 ms, eksponencijalno gašenje; poslednji tik 1500 Hz |
| Z02 | (kod) | snimak | okidač: kratak šum (band-pass ~2 kHz) 40 ms + drugi klik 40 ms posle 70 ms |
| Z03 | (kod) | rezultat | dva rastuća tona 660 → 990 Hz, po 120 ms, blago gašenje ~300 ms |
| Z04 | (kod) | greška / van opsega | dva tiha opadajuća tona 440 → 330 Hz, po 150 ms, niža jačina |

## Ukupno za snimanje

- Glasovne poruke: G01–G28 bez G15–G17 (25) + P01–P07 (7) + G03A (1) = **33**
- Oblik lica: O01–O08 (8) + O10–O11 (2) + O20–O26 (7) + O30–O36 (7) = **24** (O04/O05 mogu biti G06/G07)
- Brojevi: N40–N80 (41) + N_IPO (1) = **42**
- Zvučni efekti: Z01–Z04 — u kodu, ne snimaju se
- **Ukupno: 99 glasovnih snimaka**

## Status snimaka (2026-09-24)

Primljeno i obrađeno u `public/audio/` (AAC `.m4a`, mono, 48 kHz, 96 kbps; tišina skraćena na 0,05 s na početku
i 0,25 s na kraju; glasnoća govora izjednačena na −19 dBFS RMS, vrh ≤ −1 dBFS):
G01–G08, G10–G14, G18–G23 (19 fajlova).

**Nedostaje:** G09 („Ne vidim karticu. Prislonite je na čelo, iznad obrva, i držite je za gornju ivicu."), G03A („Držite je za gornju ivicu.") — potreban za proveru kartice uživo.
**Snimiti ponovo:** G10 — tekst usklađen sa standardnim uputstvom „kartica na čelu, iznad obrva" (2026-09-25).
**Prioritet za asistirani režim (zadnja kamera):** P01–P04, P06, P07 — već se prikazuju kao titl.
**Sledeće serije:** G24–G28, P05, N40–N80, N_IPO.
Originali ostaju kod Marka (master); u repozitorijumu su samo obrađene verzije.
