# Salitreeni

Oma salitreenisovellus Android-puhelimelle. Tämä on PWA (Progressive Web App): asentuu puhelimen kotinäytölle kuin oikea sovellus, toimii ilman verkkoa ja tallentaa kaiken tiedon puhelimeen (IndexedDB). Ei palvelinta, ei tilejä, ei riippuvuuksia.

## Ominaisuudet
- Kiertävä ohjelma (A/B/C): sovellus ehdottaa aina seuraavaa treeniä
- Sarjojen kirjaus isoilla napeilla, edellisen kerran tulokset näkyvissä, muistiinpanot
- Lepoajastin (värinä + piippaus), näyttö pysyy päällä treenin aikana
- Ennätysten (PR) tunnistus, viikkovolyymi, liikekohtaiset kuvaajat, treenikalenteri
- Muu kuorma (sähly, juoksu…) erikseen salivolyymistä
- Kehonpaino ja mitat, levytyslaskuri, kg/lb
- Varmuuskopio JSON-tiedostona (vienti, jako Driveen, tuonti)

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
`index.html`, `styles.css`, `sw.js` (offline), `manifest.webmanifest`, `js/` (`state`, `db`, `views-*`, `charts`, `data`), `icons/`.
Päivitä `VERSION` tiedostossa `sw.js`, kun julkaiset muutoksia, niin puhelin hakee uuden version.
