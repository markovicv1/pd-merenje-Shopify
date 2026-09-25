# PD Kalkulator — saveti za pristupačnost (sadržaj panela)

> **Namena:** tekst koji se prikazuje kada korisnik dodirne ikonicu pristupačnosti (zaglavlje i uvodni ekran).
> **Status:** NACRT — sekciju „Očna stanja" pre objavljivanja treba da pregleda optometrista/oftalmolog.
> **Ikonica:** univerzalni simbol pristupačnosti (figura raširenih ruku u krugu), natpis „Pristupačnost".
> Ne koristiti simbol invalidskih kolica — panel pokriva vid, sluh, motoriku i očna stanja.

---

## Podešavanja (na vrhu panela)

- **Glasovno vođenje** — uključeno / isključeno
- **Zvučni signali** (odbrojavanje i snimak) — uključeno / isključeno
- **Odbrojavanje** — glasom / piskom
- **Vibracija** — uključeno / isključeno *(prikazati samo na uređajima koji je podržavaju)*
- **Veći tekst** — uključeno / isključeno

Sva uputstva su uvek i ispisana na ekranu, bez obzira na podešavanje zvuka.

---

## Ako slabije vidite

- Uključite **glasovno vođenje** — aplikacija će vam govoriti šta da uradite i pročitati rezultat.
- Ako bez naočara ne vidite ekran dovoljno jasno, stavite **obična providna kontaktna sočiva** — ona ne smetaju merenju.
- Uključite **veći tekst**.
- Najlakše je uz **pomoć druge osobe**: ona drži telefon, a vi samo gledate u kameru.

## Ako slabije čujete

- Svako glasovno uputstvo je **ispisano na ekranu**.
- Odbrojavanje je uvek prikazano **velikim brojevima**.
- Na Android telefonima možete uključiti **vibraciju** pri odbrojavanju i snimanju.

## Ako vam je teško da držite telefon i karticu

- **Zalepite karticu selotejpom** na čelo, iznad obrva — ruke su slobodne, a kartica stoji ravno.
- **Naslonite telefon** na nešto stabilno (knjige, stalak) u visini očiju.
- Izaberite režim **uz pomoć druge osobe**.
- Za podešavanje oznaka **nema vremenskog ograničenja**. Na računaru oznake možete pomerati i strelicama na tastaturi.

## Ako ne razlikujete boje

Oznake se razlikuju i **oblikom**: ivice kartice su označene uglastim zagradama, a zenice krugom.

---

## Očna stanja kod kojih merenje kamerom nije pouzdano

Kod sledećih stanja preporučujemo merenje kod optičara:

- **Razrokost (strabizam)** ili „lenjo oko" koje skreće — oči ne gledaju u istu tačku, pa zajednička PD vrednost nije tačna.
  Optičar meri svako oko posebno.
- **Nistagmus** (nevoljno podrhtavanje očiju).
- **Nepravilan oblik zenice**, stanje posle operacije ili povrede šarenice.
- **Očna proteza** ili vid na samo jedno oko — tada je važna PD vrednost za svako oko posebno.

## Kada vam je potreban optičar i uz tačno merenje

Za sledeća stakla nije dovoljna samo PD vrednost, već i mere koje se uzimaju uz ram na licu:

- **progresivna (multifokalna) stakla**
- **prizme** u receptu
- **visoke dioptrije**

## Pre merenja

- **Kartica (kreditna, lična karta ili zdravstvena) na čelu, iznad obrva.**
- **Skinite naočare** — odsjaji i ram ometaju merenje.
- **Skinite sočiva u boji** — kamera tada vidi odštampanu šaru, a ne vaše oko.
- **Obična providna sočiva možete ostaviti.**
- Merite pri **dobrom svetlu**, okrenuti ka prozoru ili lampi.

---

## Tehnički zahtevi za implementaciju

- Panel dostupan tastaturom i čitačem ekrana (fokus se vraća na ikonicu po zatvaranju, `Esc` zatvara).
- Kontrast teksta ≥ 4.5:1; veći tekst ≥ 20 px osnovne veličine.
- Podešavanja se pamte na uređaju (`localStorage`, uz `try/catch`).
- Titlovi glasovnih uputstava: `aria-live="polite"` za vođenje, `aria-live="assertive"` za greške.
