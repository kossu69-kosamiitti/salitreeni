// Siemendata: liikelista suomeksi, lihastaksonomia, esimerkkiohjelma ja oletusasetukset

// Karkea taso (6): käytetään volyymin isoina otsikkoina.
export const BROAD = ['Rinta', 'Selkä', 'Jalat', 'Olkapäät', 'Kädet', 'Vatsa'];

// Eristetty/spesifi taso: kukin kuuluu yhteen karkeaan ryhmään (parent).
// Käytetään liikelistan ryhmittelyyn JA volyymin tarkempaan (avattavaan) tasoon.
export const MUSCLES = [
  { id: 'ylarinta', name: 'Ylärinta', parent: 'Rinta' },
  { id: 'alarinta', name: 'Alarinta', parent: 'Rinta' },
  { id: 'leveaselka', name: 'Leveä selkälihas', parent: 'Selkä' },
  { id: 'ylaselka', name: 'Yläselkä', parent: 'Selkä' },
  { id: 'alaselka', name: 'Alaselkä', parent: 'Selkä' },
  { id: 'etureidet', name: 'Etureidet', parent: 'Jalat' },
  { id: 'takareidet', name: 'Takareidet', parent: 'Jalat' },
  { id: 'pakarat', name: 'Pakarat', parent: 'Jalat' },
  { id: 'pohkeet', name: 'Pohkeet', parent: 'Jalat' },
  { id: 'etudeltoid', name: 'Etuolkapää', parent: 'Olkapäät' },
  { id: 'sivudeltoid', name: 'Sivuolkapää', parent: 'Olkapäät' },
  { id: 'takadeltoid', name: 'Takaolkapää', parent: 'Olkapäät' },
  { id: 'hauis', name: 'Hauis', parent: 'Kädet' },
  { id: 'ojentajat', name: 'Ojentajat', parent: 'Kädet' },
  { id: 'kyynarvarret', name: 'Kyynärvarret', parent: 'Kädet' },
  { id: 'suoratvatsa', name: 'Suorat vatsalihakset', parent: 'Vatsa' },
  { id: 'vinotvatsa', name: 'Vinot vatsalihakset', parent: 'Vatsa' },
];
export const muscleById = (id) => MUSCLES.find((m) => m.id === id);
export const muscleName = (id) => (muscleById(id) ? muscleById(id).name : id);
export const muscleParent = (id) => (muscleById(id) ? muscleById(id).parent : null);

// Oletustavoitteet (sarjaa / viikko) per eristetty lihas, suuntaa-antavat lähtöarvot
// mukaillen Renaissance Periodizationin volyymilandmarkkeja (MEV-MRV -tyyppinen vaihteluväli).
// Täysin muokattavissa Asetuksissa.
export const DEFAULT_MUSCLE_TARGETS = {
  ylarinta: { min: 6, max: 16 },
  alarinta: { min: 6, max: 16 },
  leveaselka: { min: 6, max: 16 },
  ylaselka: { min: 6, max: 16 },
  alaselka: { min: 2, max: 8 },
  etureidet: { min: 6, max: 18 },
  takareidet: { min: 4, max: 12 },
  pakarat: { min: 4, max: 12 },
  pohkeet: { min: 6, max: 16 },
  etudeltoid: { min: 0, max: 6 },
  sivudeltoid: { min: 8, max: 20 },
  takadeltoid: { min: 6, max: 16 },
  hauis: { min: 6, max: 20 },
  ojentajat: { min: 6, max: 18 },
  kyynarvarret: { min: 0, max: 10 },
  suoratvatsa: { min: 0, max: 16 },
  vinotvatsa: { min: 0, max: 12 },
};

// muscle = ensisijainen eristetty lihas, secondary = 0-2 avustavaa lihasta.
// Kukin avustava voidaan antaa pelkkänä id:nä (oletuspainotus 0.5x) tai [id, paino]-parina
// (0.25x/0.5x/0.75x/1x), kun jokin liike selvästi kuormittaa avustavaa lihasta eri verran.
const E = (id, name, muscle, secondary = []) => ({
  id,
  name,
  muscle,
  secondary: secondary.map((s) => (Array.isArray(s) ? { id: s[0], weight: s[1] } : { id: s, weight: 0.5 })),
  custom: false,
});

export const SEED_EXERCISES = [
  E('imp-vinopenkkiflyes-kasipainoilla', 'Vinopenkkiflyes käsipainoilla', 'ylarinta'),
  E('imp-vinopenkkipunnerrus-smithissa', 'Vinopenkkipunnerrus Smithissä', 'ylarinta', ['ojentajat', ['etudeltoid', 0.25]]),
  E('imp-vinopenkkipunnerrus-kasipainoilla', 'Vinopenkkipunnerrus käsipainoilla', 'ylarinta', ['ojentajat', ['etudeltoid', 0.25]]),
  E('imp-vinopenkkipunnerrus-laitteessa', 'Vinopenkkipunnerrus laitteessa', 'ylarinta', ['ojentajat', ['etudeltoid', 0.25]]),
  E('vinopenkki', 'Vinopenkkipunnerrus tangolla', 'ylarinta', ['ojentajat', ['etudeltoid', 0.25]]),
  E('imp-laskeva-penkkipunnerrus-smith', 'Alaviistopenkkipunnerrus laitteessa', 'alarinta', ['ojentajat']),
  E('dippi', 'Dippi', 'alarinta', [['ojentajat', 0.75]]),
  E('imp-levea-penkkipunnerrus', 'Leveä penkkipunnerrus', 'alarinta', ['ojentajat']),
  E('imp-dippi-avustettuna', 'Lisäpainodippi', 'alarinta', [['ojentajat', 0.75]]),
  E('imp-pec-deck', 'Pec deck', 'alarinta'),
  E('penkki', 'Penkkipunnerrus', 'alarinta', ['ojentajat']),
  E('imp-penkkipunnerrus-smithissa', 'Penkkipunnerrus Smithissä', 'alarinta', ['ojentajat']),
  E('kh-penkki', 'Penkkipunnerrus käsipainoilla', 'alarinta', ['ojentajat']),
  E('rintaprassi', 'Rintaprässi laitteessa', 'alarinta', ['ojentajat']),
  E('rintarist', 'Ristikkäistalja', 'alarinta'),
  E('imp-alatalja-taljassa-normaaliote', 'Alatalja kapealla otteella', 'leveaselka', ['hauis']),
  E('alatalja', 'Alatalja lapio-otteella', 'leveaselka', ['hauis']),
  E('leuanveto', 'Leuanveto', 'leveaselka', ['hauis']),
  E('imp-leveaotteinen-leuanveto', 'Leveä leuanveto', 'leveaselka', ['hauis']),
  E('imp-vipuvarsisoutu-ylhaalta', 'Vipuvarsisoutu ylhäältä', 'leveaselka', ['hauis']),
  E('imp-vipuvarsisoutu-ylhaalta-yhdella-kadella', 'Vipuvarsisoutu ylhäältä yhdellä kädellä', 'leveaselka', ['hauis']),
  E('imp-alatalja-yhdella-kadella', 'Yhden käden alatalja', 'leveaselka', ['hauis']),
  E('imp-yhden-kaden-ylatalja', 'Yhden käden ylätalja', 'leveaselka', ['hauis']),
  E('ylatalja', 'Ylätalja kapealla otteella', 'leveaselka', ['hauis']),
  E('imp-ylatalja-lapio-otteella', 'Ylätalja lapio-otteella', 'leveaselka', ['hauis']),
  E('imp-ylatalja-levealla-otteella', 'Ylätalja leveällä otteella', 'leveaselka', ['hauis']),
  E('imp-alatalja-levealla-otteella', 'Alatalja leveällä otteella', 'ylaselka', [['leveaselka', 0.75], 'hauis']),
  E('imp-alatalja-alaotteella-taljassa', 'Alatalja vastaotteella', 'ylaselka', ['leveaselka', 'hauis']),
  E('imp-iso-lateral-soutu-laitteessa', 'Iso-lateral-soutu laitteessa', 'ylaselka', [['leveaselka', 0.75]]),
  E('tangosoutu', 'Kulmasoutu tangolla', 'ylaselka', [['leveaselka', 0.75], 'hauis']),
  E('kh-soutu', 'Käsipainosoutu', 'ylaselka', [['leveaselka', 0.75]]),
  E('imp-pendlay-soutu', 'Pendlay-soutu', 'ylaselka', [['leveaselka', 0.75], 'hauis']),
  E('imp-t-kulmasoutu', 'T-kulmasoutu', 'ylaselka', [['leveaselka', 0.75], 'hauis']),
  E('imp-t-tangolla-soutu', 'T-kulmasoutu tuettuna', 'ylaselka', [['leveaselka', 0.75], 'hauis']),
  E('imp-vipuvarsisoutu-edesta', 'Vipuvarsisoutu edestä', 'ylaselka', [['leveaselka', 0.75]]),
  E('imp-vipuvarsisoutu-edesta-yhdella-kadella', 'Vipuvarsisoutu edestä yhdellä kädellä', 'ylaselka', [['leveaselka', 0.75]]),
  E('maastaveto', 'Maastaveto', 'alaselka', [['pakarat', 1], ['takareidet', 1]]),
  E('askelkyykky', 'Askelkyykky', 'etureidet', [['pakarat', 1]]),
  E('bulg', 'Bulgarialainen askelkyykky', 'etureidet', [['pakarat', 1]]),
  E('etukyykky', 'Etukyykky', 'etureidet', [['pakarat', 1]]),
  E('imp-hack-kyykky', 'Hack-kyykky', 'etureidet', [['pakarat', 0.75]]),
  E('jalkaprassi', 'Jalkaprässi', 'etureidet', [['pakarat', 0.75]]),
  E('imp-jalkaprassi-yhdella-jalalla', 'Jalkaprässi yhdellä jalalla', 'etureidet', [['pakarat', 0.75]]),
  E('jalanojennus', 'Reidenojennus', 'etureidet'),
  E('takakyykky', 'Takakyykky', 'etureidet', [['pakarat', 1]]),
  E('imp-glute-ham-raise-ghr', 'Glute Ham Raise (GHR)', 'takareidet', [['pakarat', 1]]),
  E('imp-reidenkoukistus-istuen', 'Reidenkoukistus istuen', 'takareidet'),
  E('imp-reidenkoukistus-maaten', 'Reidenkoukistus maaten', 'takareidet'),
  E('rmv', 'Romanialainen maastaveto (RDL)', 'takareidet', [['pakarat', 1], 'alaselka']),
  E('lantionnosto', 'Lantionnosto', 'pakarat', ['takareidet']),
  E('imp-lonkan-loitonnus-laitteessa', 'Lonkan loitonnus laitteessa', 'pakarat'),
  E('imp-lonkan-lahennys-laitteessa', 'Lonkan lähennys laitteessa', 'pakarat'),
  E('imp-pakarapotku-laitteessa', 'Pakarapotku laitteessa', 'pakarat'),
  E('imp-pohjenousu-jalkaprassissa', 'Pohjenousu jalkaprässissä', 'pohkeet'),
  E('imp-pohjenousu-laitteessa-istuen', 'Pohjenousu laitteessa istuen', 'pohkeet'),
  E('pohje', 'Pohjenousu laitteessa seisten', 'pohkeet'),
  E('imp-etunosto-kasipainoilla', 'Etunosto käsipainoilla', 'etudeltoid'),
  E('imp-etunosto-tangolla', 'Etunosto tangolla', 'etudeltoid'),
  E('imp-pystypunnerrus-smithissa', 'Pystypunnerrus Smithissä', 'etudeltoid', ['sivudeltoid', 'ojentajat']),
  E('kh-olkapaa', 'Pystypunnerrus käsipainoilla', 'etudeltoid', ['sivudeltoid']),
  E('imp-pystypunnerrus-kasipainoilla-istuen', 'Pystypunnerrus käsipainoilla istuen', 'etudeltoid', ['sivudeltoid']),
  E('imp-pystypunnerrus-laitteessa', 'Pystypunnerrus laitteessa', 'etudeltoid', ['sivudeltoid']),
  E('pystypunnerrus', 'Pystypunnerrus tangolla', 'etudeltoid', ['sivudeltoid', 'ojentajat']),
  E('sivunosto', 'Vipunosto käsipainoilla', 'sivudeltoid'),
  E('imp-vipunosto-laitteessa', 'Vipunosto laitteessa', 'sivudeltoid'),
  E('imp-vipunosto-taljassa', 'Vipunosto taljassa', 'sivudeltoid'),
  E('facepull', 'Face Pull', 'takadeltoid', ['ylaselka']),
  E('imp-reverse-pec-deck-takaolkapaalaite', 'Reverse Pec Deck / takaolkapäälaite', 'takadeltoid'),
  E('imp-takaolkapaaflyes-kasipainoilla', 'Takaolkapääflyes käsipainoilla', 'takadeltoid'),
  E('imp-takaolkapaaflyes-taljassa', 'Takaolkapääflyes taljassa', 'takadeltoid'),
  E('takaolkapaa', 'Takaolkapäänosto', 'takadeltoid'),
  E('imp-bayesian-curl', 'Bayesian curl', 'hauis'),
  E('kh-hauis', 'Hauiskääntö käsipainoilla', 'hauis'),
  E('imp-hauiskaanto-laitteessa', 'Hauiskääntö laitteessa', 'hauis'),
  E('imp-hauiskaanto-taljassa', 'Hauiskääntö taljassa', 'hauis'),
  E('hauiskaanto', 'Hauiskääntö tangolla', 'hauis'),
  E('imp-scott-kaanto', 'Scott-kääntö', 'hauis'),
  E('vasara', 'Vasarakääntö käsipainoilla', 'hauis', ['kyynarvarret']),
  E('imp-vasarakaanto-taljassa', 'Vasarakääntö taljassa', 'hauis', ['kyynarvarret']),
  E('imp-vinopenkkihauiskaanto', 'Vinopenkkihauiskääntö', 'hauis'),
  E('imp-penkkidippi', 'Laitedippi', 'ojentajat'),
  E('imp-ojentajapotku-taljassa', 'Ojentajapotku taljassa', 'ojentajat'),
  E('imp-ojentajapunnerrus-paan-yli-kasipainolla', 'Ojentajapunnerrus pään yli käsipainolla', 'ojentajat'),
  E('imp-ojentajapunnerrus-paan-yli-taljassa', 'Ojentajapunnerrus pään yli taljassa', 'ojentajat'),
  E('ojentaja-talja', 'Ojentajapunnerrus taljassa', 'ojentajat'),
  E('imp-ranskalainen-punnerrus-kasipainoilla', 'Ranskalainen punnerrus käsipainoilla', 'ojentajat'),
  E('ranskalainen', 'Ranskalainen punnerrus tangolla', 'ojentajat'),
  E('imp-rannekaanto-kasipainolla', 'Rannekääntö käsipainolla', 'kyynarvarret'),
  E('imp-rannekaanto-taljassa', 'Rannekääntö taljassa', 'kyynarvarret'),
  E('imp-istumaannousu', 'Istumaannousu', 'suoratvatsa'),
  E('imp-polvennosto-kapteenintuolissa', 'Polvennosto kapteenintuolissa', 'suoratvatsa'),
  E('roikkuva', 'Roikkuva jalannosto', 'suoratvatsa'),
  E('imp-taljavatsarutistus', 'Taljavatsarutistus', 'suoratvatsa'),
  E('ab-wheel', 'Vatsarulla / Ab Wheel', 'suoratvatsa'),
  E('vatsarutistus', 'Vatsarutistus', 'suoratvatsa'),
  E('imp-vatsarutistus-jumppapallolla', 'Vatsarutistus jumppapallolla', 'suoratvatsa'),
  E('imp-vatsarutistus-laitteessa', 'Vatsarutistus laitteessa', 'suoratvatsa'),
  E('imp-vatsarutistus-laskevalla-penkilla', 'Vatsarutistus laskevalla penkillä', 'suoratvatsa'),
  E('imp-vatsarutistus-vinopenkilla', 'Vatsarutistus vinopenkillä', 'suoratvatsa'),
  E('venalainen-kierto', 'Russian Twist', 'vinotvatsa'),
  E('imp-vartalonkierto-laitteessa', 'Vartalonkierto laitteessa', 'vinotvatsa'),
  E('imp-vartalonkierto-taljassa', 'Vartalonkierto taljassa', 'vinotvatsa'),
];

const T = (id, name, order, items) => ({
  id,
  name,
  order,
  items: items.map(([exId, sets, reps]) => ({ exId, sets, reps })),
});

// Esimerkkiohjelma – muokattavissa Asetukset-välilehdellä
export const SEED_TEMPLATES = [
  T('tpl-a', 'Treeni A', 0, [
    ['takakyykky', 3, '5'],
    ['penkki', 3, '5'],
    ['tangosoutu', 3, '8'],
    ['pystypunnerrus', 3, '8'],
    ['vatsarutistus', 3, '12'],
  ]),
  T('tpl-b', 'Treeni B', 1, [
    ['maastaveto', 3, '5'],
    ['vinopenkki', 3, '8'],
    ['ylatalja', 3, '10'],
    ['askelkyykky', 3, '10'],
    ['hauiskaanto', 3, '10'],
  ]),
  T('tpl-c', 'Treeni C', 2, [
    ['jalkaprassi', 3, '10'],
    ['kh-penkki', 3, '10'],
    ['alatalja', 3, '10'],
    ['sivunosto', 3, '12'],
    ['ojentaja-talja', 3, '12'],
  ]),
];

export const DEFAULT_SETTINGS = {
  unit: 'kg',
  step: 2.5,
  rest: 90,
  muscleTargets: {},
};

export const LB_DEFAULTS = { step: 5 };
export const KG_DEFAULTS = { step: 2.5 };
