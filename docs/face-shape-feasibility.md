# Prepoznavanje oblika lica — analiza izvodljivosti

> **Status:** FEASIBILITY | **Datum:** 2026-07-12 | **Odluka:** čeka Marka
> **Cilj:** klasifikacija lica korisnika u 7 standardnih oblika (okruglo, ovalno, srcoliko, četvrtasto, duguljasto, trouglasto, dijamantsko) radi preporuke okvira naočara.

## Verdikt: izvodljivo, uz dva realna ograničenja

1. **Kategorije su subjektivne.** Ni optičari/stilisti se ne slažu oko oblika lica u značajnom procentu slučajeva — granice su meke (ovalno↔duguljasto, okruglo↔ovalno). Realan cilj je 75–85% poklapanja sa ljudskom ocenom, uz UI koji prikazuje **top 2 oblika sa procentom sigurnosti**, ne jednu "apsolutnu istinu".
2. **Linija kose.** MediaPipe landmarci pokrivaju konturu lica i deo čela, ali NE liniju kose i gornji obris glave — a razlike ovalno/duguljasto i srcoliko/dijamantsko zavise upravo od širine i visine čela. Rešenja: instrukcija "sklonite kosu sa čela" (v1), segmentacija kose (v2, vidi dole).

## Tri moguća pristupa

### A) Geometrijska klasifikacija iz MediaPipe landmarka — PREPORUKA za v1

PD kalkulator **već ima** MediaPipe FaceLandmarker sa 478 landmarka i pose gating (frontalna poza = preduslov za pouzdane proporcije, već implementiran). Nula novih zavisnosti, sve on-device — u skladu sa obećanjem "svi podaci ostaju na vašem uređaju".

Featuri (normalizovani na širinu lica):
| Feature | Razdvaja |
|---|---|
| odnos visina/širina lica | duguljasto vs okruglo/četvrtasto |
| širina čela vs jagodica vs vilice | srcoliko (čelo>vilica), trouglasto (vilica>čelo), dijamantsko (jagodice≫čelo≈vilica) |
| ugao/oštrina vilice | četvrtasto vs okruglo/ovalno |
| zaobljenost brade | srcoliko (špicasta) vs okruglo (zaobljena) |

Klasifikacija: v1 = pravila sa pragovima; v2 = mali klasifikator (logistička regresija / gradient boosting) treniran na istim geometrijskim featurima — koeficijenti se trivijalno portuju u JS, model ostaje on-device i < 5 KB.

**Preduslovi:**
- merljiva rubrika za 7 oblika (tabela odnosa — definisati sa optičarem)
- labelirani validacioni set: 100–200 frontalnih fotografija, svaku ocenjuju 2–3 nezavisna ocenjivača (meriti inter-rater agreement PRE jurenja "tačnosti" modela)
- reuse postojećeg snapshot-a i pose gatinga iz PD kalkulatora

### B) CNN klasifikator (transfer learning)

MobileNetV3 / EfficientNet-Lite fine-tuning, izvršavanje u browseru kroz TensorFlow.js ili ONNX Runtime Web (model 3–8 MB).

- Javni dataset: Kaggle "Face Shape Dataset" (Niten Lama, ~5000 slika) — ali **samo 5 klasa** (heart, oblong, oval, round, square). Za trouglasto i dijamantsko treba sopstveno prikupljanje i labeliranje.
- Prikupljanje slika lica = **GDPR/ZZPL obaveze** (saglasnosti, čuvanje, brisanje).
- Preduslovi: Python trening pipeline, eksport u TFJS/ONNX, hosting modela, +3–8 MB download za korisnika.

Smisleno tek ako pristup A ne dostigne ciljanu tačnost.

### C) Third-party API (Face++, Betaface…) — ODBACITI

Šalje fotografije lica na tuđe servere: krši obećanje privatnosti sa stranice kalkulatora, GDPR rizik, trošak po pozivu, latencija, vendor lock.

## Preporučeni put

1. **v1:** pristup A u PD kalkulatoru — posle merenja PD-a dugme "Saznajte oblik vašeg lica" (isti snapshot, bez novog slikanja) → top 2 oblika + confidence → mapiranje oblik→kategorije okvira (optičarska pravila) → link na kolekcije Optičarke. 
2. **Validacija:** interni test set, inter-rater agreement, pa tek onda javno.
3. **v2 (po potrebi):** trenirani klasifikator na geometrijskim featurima; opciono MediaPipe ImageSegmenter (hair class, ~3 MB) za pravu konturu čela.

## Tehnologije — sumarno

| Tehnologija | Uloga | Status |
|---|---|---|
| MediaPipe FaceLandmarker | 478 landmarka, poza glave | već u projektu |
| Geometrijski feature modul (`src/lib/faceShape.js`) | odnosi širina/visina/uglovi | novo, TDD |
| Vitest | testovi klasifikacije | već u projektu |
| MediaPipe ImageSegmenter (hair) | kontura kose/čela | opcionalno v2 |
| Python + scikit-learn/XGBoost | trening klasifikatora | opcionalno v2 |
| Label Studio (ili sličan) | labeliranje validacionog seta | opcionalno v2 |

## Rizici

- Subjektivnost kategorija → prikazivati kao preporuku, ne dijagnozu; top-2 + confidence
- Kosa preko čela → instrukcija u UI + (v2) segmentacija
- Nagib glave → rešeno postojećim pose gatingom
- Marketing tvrdnje → ne obećavati "100% tačno"; formulacija "AI predlog oblika lica"
