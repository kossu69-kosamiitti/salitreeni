# Salitreeni

Oma salitreenisovellus Android-puhelimelle. Tämä on PWA (Progressive Web App): asentuu puhelimen kotinäytölle kuin oikea sovellus, toimii ilman verkkoa ja tallentaa kaiken tiedon puhelimeen (IndexedDB). Ei palvelinta, ei tilejä, ei riippuvuuksia.

## Ominaisuudet
- Kiertävä ohjelma (A/B/C): sovellus ehdottaa aina seuraavaa treeniä
- Sarjojen kirjaus isoilla napeilla, edellisen kerran tulokset näkyvissä, muistiinpanot
- Lepoajastin (värinä + piippaus), näyttö pysyy päällä treenin aikana
- Ennätysten (PR) tunnistus, viikkovolyymi, liikekohtaiset kuvaajat, treenikalenteri
- Muu kuorma (sähly, juoksu…) sekä Oura-yhteys (palautuminen, uni, HRV, treenit)
- Kehonpaino ja mitat, levytyslaskuri, kg/lb
- Varmuuskopio JSON-tiedostona (vienti, jako Driveen, tuonti)

## Käyttöönotto puhelimeen
PWA vaatii HTTPS-osoitteen. Helpoin ilmainen tapa on GitHub Pages:

1. Luo GitHubissa uusi repo (esim. `salitreeni`) ja lataa kaikki tämän kansion tiedostot sen juureen.
2. Repo → Settings → Pages → Source: "Deploy from a branch" → `main` / `(root)`.
3. Avaa osoite `https://KÄYTTÄJÄ.github.io/salitreeni/` puhelimen Chromessa.
4. Chromen valikko (⋮) → "Lisää aloitusnäytölle" / "Asenna sovellus".

Paikallinen testaus tietokoneella: `python3 -m http.server 8000` tässä kansiossa ja avaa `http://localhost:8000`.

## Oura-yhteys
1. Luo sovellus osoitteessa https://cloud.ouraring.com/oauth/applications
2. Lisää Redirect URI:ksi sovelluksen osoite (Asetukset-välilehti näyttää tarkan arvon).
3. Liitä Client ID Asetuksiin ja paina "Yhdistä Oura".

Yhteys käyttää Ouran selainpuolen (implicit) kirjautumista, joten palvelinta ei tarvita, mutta kirjautuminen vanhenee noin 30 päivässä ja se tehdään silloin uudelleen. Jos selain estää Oura-kutsut (CORS), tarvitaan pieni välipalvelin (esim. Cloudflare Worker) – sitä ei ole vielä toteutettu.

## Tietojen turvaus
Tiedot ovat vain puhelimessa. Ota varmuuskopio Asetukset → "Vie varmuuskopio" säännöllisesti (sovellus muistuttaa 30 päivän jälkeen).

## Rakenne
`index.html`, `styles.css`, `sw.js` (offline), `manifest.webmanifest`, `js/` (`state`, `db`, `views-*`, `oura`, `charts`, `data`), `icons/`.
Päivitä `VERSION` tiedostossa `sw.js`, kun julkaiset muutoksia, niin puhelin hakee uuden version.

## Oura-kehittäjäportaali
Ouran sovellus luodaan osoitteessa https://developer.ouraring.com. Lomake vaatii Website-, Privacy Policy- ja Terms of Service -osoitteet: käytä Pages-osoitetta sekä tiedostoja `privacy.html` ja `terms.html` (esim. https://KÄYTTÄJÄ.github.io/salitreeni/privacy.html).

## Oura-välipalvelin (Cloudflare Worker)
Ouran rajapinta ei lähetä CORS-otsakkeita, joten selain ei voi kutsua sitä suoraan (konsolissa: "Response to preflight request doesn't pass access control check"). Ratkaisu on pieni ilmainen välipalvelin, jonka koodi on tiedostossa `worker/oura-proxy.js`.

1. Luo ilmainen tili osoitteessa https://dash.cloudflare.com
2. Workers & Pages → Create → Create Worker → nimeksi `salitreeni-oura` → Deploy.
3. Paina Edit code, korvaa koko sisältö tiedoston `worker/oura-proxy.js` sisällöllä ja paina Deploy.
4. Kopioi Workerin osoite (muotoa `https://salitreeni-oura.XXXX.workers.dev`).
5. Sovellus → Asetukset → Oura → liitä osoite kenttään "Välipalvelimen osoite".
6. Muu-välilehti → Päivitä.

Worker välittää vain GET-kutsut polkuun `/v2/usercollection/*` ja vain listatulta alkuperältä (`ALLOWED_ORIGINS` tiedoston alussa). Se ei tallenna dataa.
