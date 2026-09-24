# Salitreeni

Oma salitreenisovellus Android-puhelimelle. Tämä on PWA (Progressive Web App): asentuu puhelimen kotinäytölle kuin oikea sovellus, toimii ilman verkkoa ja tallentaa kaiken tiedon puhelimeen (IndexedDB). Ei palvelinta, ei tilejä, ei riippuvuuksia. Sovellus keskittyy pelkkään salitreenien seurantaan.

## Ominaisuudet
- Kiertävä ohjelma (A/B/C): sovellus ehdottaa aina seuraavaa treeniä
- Sarjojen kirjaus isoilla napeilla, edellisen kerran tulokset näkyvissä, muistiinpanot
- Lepoajastin (värinä + piippaus), näyttö pysyy päällä treenin aikana
- Ennätysten (PR) tunnistus, liikekohtaiset kuvaajat, treenikalenteri
- Volyymi per lihas: karkea (Rinta/Selkä/Jalat/Olkapäät/Kädet/Vatsa) ja avattava spesifi taso
  (esim. Etureidet, Takareidet, Pakarat) sarjoina ja toistoina, liukuva 7 pv / 30 pv, verrattuna
  muokattaviin tavoitevälehin (Asetukset → Lihasvolyymitavoitteet)
- Kehonpaino ja mitat, kg/lb
- Varmuuskopio JSON-tiedostona (vienti, jako Driveen, tuonti)

## Lihastaksonomia
Jokainen liike kuuluu yhteen karkeaan ryhmään (esim. Jalat) ja saa yhden ensisijaisen eristetyn
lihaksen (esim. Etureidet) sekä 0-2 avustavaa lihasta (esim. Pakarat), jotka molemmat saavat
täyden sarja- ja toistohyvityksen. Karkean ryhmän luku on aina sen lasten (eristettyjen
lihasten) summa, joten esim. penkkipunnerrus (Alarinta + Ojentajat) näkyy Rinta- JA Kädet-ryhmän
volyymissa. Voit muokata liikkeiden lihaksia ja lisätä omia liikkeitä Asetukset → Hallitse
liikkeitä.

## Käyttöönotto puhelimeen
PWA vaatii HTTPS-osoitteen. Helpoin ilmainen tapa on GitHub Pages:

1. Luo GitHubissa uusi repo (esim. `salitreeni`) ja lataa kaikki tämän kansion tiedostot sen juureen.
2. Repo → Settings → Pages → Source: "Deploy from a branch" → `main` / `(root)`.
3. Avaa osoite `https://KÄYTTÄJÄ.github.io/salitreeni/` puhelimen Chromessa.
4. Chromen valikko (⋮) → "Lisää aloitusnäytölle" / "Asenna sovellus".

Paikallinen testaus tietokoneella: `python3 -m http.server 8000` tässä kansiossa ja avaa `http://localhost:8000`.

## Tietojen turvaus
Tiedot ovat vain puhelimessa. Ota varmuuskopio Asetukset → "Vie varmuuskopio" säännöllisesti (sovellus muistuttaa 30 päivän jälkeen).

## Rakenne
`index.html`, `styles.css`, `sw.js` (offline), `manifest.webmanifest`,
`js/` (`state`, `db`, `data` (liikkeet+lihastaksonomia+tavoitteet), `volume` (volyymilaskenta), `views-*`, `charts`), `icons/`.
Päivitä `VERSION` tiedostossa `sw.js`, kun julkaiset muutoksia, niin puhelin hakee uuden version.
